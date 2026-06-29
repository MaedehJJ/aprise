"""Fit score computation with JD-level caching."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from db.models import JD, Memory
from prompts import fit_score_prompt
from services.ai_service import AIService
from services.score_cache_utils import (
    compute_fit_input_hash,
    compute_jd_requirements_fingerprint,
    compute_memory_fingerprint,
    utc_now_iso,
)
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)

_FIT_MEMORY_LIMIT = 30


class FitScoreService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def get_or_compute(
        self,
        clerk_user_id: str,
        jd_id: uuid.UUID,
        *,
        refresh: bool = False,
    ) -> dict[str, Any]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile.id))
        ).scalar_one_or_none()
        if not jd:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JD not found.")

        memories = await self._load_memories(profile.id)
        input_hash = compute_fit_input_hash(
            compute_jd_requirements_fingerprint(jd.parsed_requirements, jd.labels),
            compute_memory_fingerprint(memories),
        )

        if not refresh and jd.fit_score_cache:
            cached = jd.fit_score_cache
            if cached.get("input_hash") == input_hash:
                logger.info("fit_score cache_hit for jd_id=%s", jd_id)
                return {k: v for k, v in cached.items() if k not in ("input_hash", "computed_at")}
            logger.info("fit_score cache_stale for jd_id=%s — recomputing", jd_id)
        else:
            logger.info("fit_score cache_miss for jd_id=%s", jd_id)

        result = self._call_llm(jd, memories)
        payload = {
            **result.model_dump(),
            "input_hash": input_hash,
            "computed_at": utc_now_iso(),
        }
        jd.fit_score_cache = payload
        await self.db.commit()
        logger.info("fit_score computed and cached for jd_id=%s score=%s", jd_id, result.score)
        return result.model_dump()

    async def compute_and_cache_for_jd(self, jd_id: uuid.UUID, profile_id: uuid.UUID) -> None:
        """Background-friendly fit score after JD creation."""
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile_id))
        ).scalar_one_or_none()
        if not jd:
            return
        memories = await self._load_memories(profile_id)
        input_hash = compute_fit_input_hash(
            compute_jd_requirements_fingerprint(jd.parsed_requirements, jd.labels),
            compute_memory_fingerprint(memories),
        )
        if jd.fit_score_cache and jd.fit_score_cache.get("input_hash") == input_hash:
            return
        try:
            result = self._call_llm(jd, memories)
            jd.fit_score_cache = {
                **result.model_dump(),
                "input_hash": input_hash,
                "computed_at": utc_now_iso(),
            }
            await self.db.commit()
            logger.info("fit_score auto-computed for jd_id=%s", jd_id)
        except Exception:
            await self.db.rollback()
            logger.warning("fit_score auto-compute failed for jd_id=%s", jd_id, exc_info=True)

    async def _load_memories(self, profile_id: uuid.UUID) -> list[Memory]:
        return (
            await self.db.execute(
                select(Memory)
                .options(load_only(Memory.id, Memory.content, Memory.chunk_type, Memory.updated_at))
                .filter(Memory.user_id == profile_id)
                .order_by(Memory.created_at.desc())
                .limit(_FIT_MEMORY_LIMIT)
            )
        ).scalars().all()

    def _call_llm(self, jd: JD, memories: list[Memory]):
        user_memories_text = (
            "\n\n".join(f"[{m.chunk_type.value}] {m.content}" for m in memories)
            if memories
            else "No background information available."
        )
        requirements = jd.parsed_requirements or {}
        labels = jd.labels or {}
        return self._ai.structured(
            fit_score_prompt,
            langsmith_extra={"jd_id": str(jd.id), "step": "fit_score"},
            company=jd.company_name or "the company",
            role=jd.role_title or "this role",
            company_size=labels.get("company_size", "unknown"),
            role_focus=labels.get("role_focus", "unknown"),
            tech_depth=labels.get("tech_depth", "unknown"),
            domain=labels.get("domain", "unknown"),
            required_skills=", ".join(requirements.get("required_skills", [])) or "Not specified",
            nice_to_have=", ".join(requirements.get("nice_to_have", [])) or "None",
            years_required=str(requirements.get("years_required") or "Not specified"),
            responsibilities=(
                "\n- " + "\n- ".join(requirements.get("responsibilities", []))
                if requirements.get("responsibilities")
                else "Not specified"
            ),
            user_memories=user_memories_text,
        )
