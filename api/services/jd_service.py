import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CompanyResearchCache, JD, JDMemory, Profile
from prompts import jd_parsing_prompt
from services.ai_service import AIService
from services.company_research_service import CompanyResearchService
from services.score_cache_utils import normalize_company_name
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)

_COMPANY_RESEARCH_TTL = timedelta(days=30)


class JDService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def create_jd(self, clerk_user_id: str, raw_text: str) -> JD:
        """
        Parses and embeds the JD in a single transaction.
        If either the LLM parse or the embedding fails, nothing is committed.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)

        jd = JD(user_id=profile.id, raw_text=raw_text)
        self.db.add(jd)
        await self.db.flush()  # assign jd.id before LLM call

        logger.info("Parsing JD for user %s", profile.id)
        parsed = self._ai.structured(
            jd_parsing_prompt,
            langsmith_extra={"user_id": str(profile.id)},
            jd_text=raw_text,
        )
        jd.company_name = parsed.company_name
        jd.role_title = parsed.role_title
        jd.parsed_requirements = parsed.requirements.model_dump()
        jd.labels = parsed.labels.model_dump()

        vector = self._ai.embed_documents([raw_text])[0]
        jd_memory = JDMemory(
            user_id=jd.user_id,
            jd_id=jd.id,
            content=raw_text,
            embedding=vector,
        )
        self.db.add(jd_memory)

        await self.db.commit()
        await self.db.refresh(jd)
        logger.info("JD created: id=%s company='%s' role='%s'", jd.id, jd.company_name, jd.role_title)

        await self._enrich_jd(jd, profile)
        return jd

    async def _enrich_jd(self, jd: JD, profile: Profile) -> None:
        """
        Runs company research (Tavily) and fit score after the JD is committed.
        Failures never roll back JD creation.
        """
        await self._enrich_company_research(jd)
        await self._compute_fit_score(jd, profile)

    async def _enrich_company_research(self, jd: JD) -> None:
        company_name = (jd.company_name or "").strip()
        if not company_name:
            return

        normalized = normalize_company_name(company_name)
        if normalized:
            cached = (
                await self.db.execute(
                    select(CompanyResearchCache).filter_by(normalized_company_name=normalized)
                )
            ).scalar_one_or_none()
            if cached:
                age = datetime.now(timezone.utc) - cached.fetched_at.replace(tzinfo=timezone.utc)
                if age < _COMPANY_RESEARCH_TTL:
                    jd.company_research = cached.summary
                    try:
                        await self.db.commit()
                        await self.db.refresh(jd)
                        logger.info("JD %s company research from cache", jd.id)
                        return
                    except Exception:
                        await self.db.rollback()
                        logger.warning("Failed to persist cached company_research for jd %s", jd.id, exc_info=True)

        if not os.environ.get("TAVILY_API_KEY"):
            return

        research_svc = CompanyResearchService()
        company_research = await asyncio.to_thread(
            research_svc.research,
            company_name=company_name,
            role_title=jd.role_title or "",
        )

        if not company_research:
            return

        jd.company_research = company_research
        try:
            if normalized:
                existing = (
                    await self.db.execute(
                        select(CompanyResearchCache).filter_by(normalized_company_name=normalized)
                    )
                ).scalar_one_or_none()
                if existing:
                    existing.summary = company_research
                    existing.fetched_at = datetime.now(timezone.utc)
                else:
                    self.db.add(
                        CompanyResearchCache(
                            normalized_company_name=normalized,
                            summary=company_research,
                        )
                    )
            await self.db.commit()
            await self.db.refresh(jd)
            logger.info(
                "JD %s enriched: company_research=%d chars",
                jd.id, len(company_research),
            )
        except Exception:
            await self.db.rollback()
            logger.warning("Failed to persist company_research for jd %s", jd.id, exc_info=True)

    async def _compute_fit_score(self, jd: JD, profile: Profile) -> None:
        from services.fit_score_service import FitScoreService

        try:
            await FitScoreService(db=self.db, ai=self._ai).compute_and_cache_for_jd(
                jd_id=jd.id,
                profile_id=profile.id,
            )
            await self.db.refresh(jd)
        except Exception:
            logger.warning("Fit score auto-compute failed for jd %s", jd.id, exc_info=True)

    async def list_jds(self, clerk_user_id: str, tag: str | None = None) -> list[JD]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        q = select(JD).filter_by(user_id=profile.id)
        if tag:
            from sqlalchemy.dialects.postgresql import JSONB
            q = q.filter(JD.labels.op("@>")(cast({"tags": [tag]}, JSONB)))
        return (await self.db.execute(q.order_by(JD.created_at.desc()))).scalars().all()

    async def get_jd(self, clerk_user_id: str, jd_id: uuid.UUID) -> JD:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile.id))
        ).scalar_one_or_none()
        if not jd:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JD not found.")
        return jd

    @staticmethod
    def company_research_status(jd: JD) -> str:
        """pending | ready | unavailable"""
        if jd.company_research:
            return "ready"
        if not os.environ.get("TAVILY_API_KEY"):
            return "unavailable"
        created = jd.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - created
        # 180s is the outer timeout for Tavily to complete — keep polling until then
        if age < timedelta(seconds=180) and not jd.company_research:
            return "pending"
        return "unavailable"
