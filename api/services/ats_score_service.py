"""ATS score computation with resume-level caching."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import Resume
from prompts import ats_score_prompt
from services.ai_service import AIService
from services.score_cache_utils import compute_ats_input_hash, utc_now_iso
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


class ATSScoreService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def get_or_compute(
        self,
        clerk_user_id: str,
        resume_id: uuid.UUID,
        *,
        refresh: bool = False,
    ) -> dict[str, Any]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        resume = (
            await self.db.execute(
                select(Resume)
                .options(selectinload(Resume.jd))
                .filter_by(id=resume_id, user_id=profile.id)
            )
        ).scalars().unique().one_or_none()
        if not resume:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
        if not resume.content:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Resume has no generated content.",
            )

        jd = resume.jd
        requirements = (jd.parsed_requirements or {}) if jd else {}
        input_hash = compute_ats_input_hash(resume.content, requirements)

        if not refresh and resume.ats_score_cache:
            cached = resume.ats_score_cache
            if cached.get("input_hash") == input_hash:
                logger.info("ats_score cache hit for resume_id=%s", resume_id)
                return {k: v for k, v in cached.items() if k not in ("input_hash", "computed_at")}

        result = self._call_llm(resume, jd, requirements)
        resume.ats_score_cache = {
            **result.model_dump(),
            "input_hash": input_hash,
            "computed_at": utc_now_iso(),
        }
        await self.db.commit()
        logger.info("ats_score computed and cached for resume_id=%s score=%s", resume_id, result.score)
        return result.model_dump()

    async def compute_and_cache_for_resume(self, resume: Resume) -> dict[str, Any] | None:
        """Called after resume generation; persists ATS cache on the resume row."""
        if not resume.content:
            return None
        jd = resume.jd
        requirements = (jd.parsed_requirements or {}) if jd else {}
        input_hash = compute_ats_input_hash(resume.content, requirements)
        try:
            result = self._call_llm(resume, jd, requirements)
            resume.ats_score_cache = {
                **result.model_dump(),
                "input_hash": input_hash,
                "computed_at": utc_now_iso(),
            }
            await self.db.flush()
            return result.model_dump()
        except Exception:
            logger.warning("ats_score compute failed for resume_id=%s", resume.id, exc_info=True)
            return None

    def _call_llm(self, resume: Resume, jd, requirements: dict):
        content = resume.content or {}
        experience_text = "\n".join(
            f"{e.get('role', '')} at {e.get('company', '')} ({e.get('dates', '')}): "
            + " | ".join(e.get("bullets", [])[:3])
            for e in (content.get("experience") or [])
        )
        return self._ai.structured(
            ats_score_prompt,
            langsmith_extra={"resume_id": str(resume.id), "step": "ats_score"},
            company=jd.company_name if jd else "the company",
            role=jd.role_title if jd else "the role",
            required_skills=", ".join(requirements.get("required_skills", [])) or "Not specified",
            nice_to_have=", ".join(requirements.get("nice_to_have", [])) or "None",
            responsibilities=(
                "\n- " + "\n- ".join(requirements.get("responsibilities", []))
                if requirements.get("responsibilities")
                else "Not specified"
            ),
            resume_summary=content.get("summary", ""),
            resume_experience=experience_text,
            resume_skills=", ".join(content.get("skills", [])),
        )
