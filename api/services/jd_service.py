import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from db.models import JD, JDMemory, Profile
from prompts import jd_parsing_prompt
from services.ai_service import AIService
from services.company_research_service import CompanyResearchService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


class JDService:

    def __init__(self, db: Session, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    def create_jd(self, clerk_user_id: str, raw_text: str) -> JD:
        """
        Parses and embeds the JD in a single transaction.
        If either the LLM parse or the embedding fails, nothing is committed.
        """
        profile = get_profile_or_404(self.db, clerk_user_id)

        jd = JD(user_id=profile.id, raw_text=raw_text)
        self.db.add(jd)
        self.db.flush()  # assign jd.id before LLM call

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

        # Embed and store in the same transaction — if embedding fails,
        # the JD row is also rolled back, leaving no dangling records.
        vector = self._ai.embed_documents([raw_text])[0]
        jd_memory = JDMemory(
            user_id=jd.user_id,
            jd_id=jd.id,
            content=raw_text,
            embedding=vector,
        )
        self.db.add(jd_memory)

        self.db.commit()
        self.db.refresh(jd)
        logger.info("JD created: id=%s company='%s' role='%s'", jd.id, jd.company_name, jd.role_title)

        # ── Post-commit enrichment (best-effort; failures never surface to user) ──
        self._enrich_jd(jd, profile)
        return jd

    def _enrich_jd(self, jd: JD, profile: Profile) -> None:
        """
        Runs company research (Tavily) and JD similarity search after the JD
        has been committed.  Updates jd.company_research in a separate transaction
        so a failure here never rolls back the JD creation.
        """
        research_svc = CompanyResearchService()

        company_research = research_svc.research(
            company_name=jd.company_name or "",
            role_title=jd.role_title or "",
        )

        if company_research:
            jd.company_research = company_research
            try:
                self.db.commit()
                self.db.refresh(jd)
                logger.info(
                    "JD %s enriched: company_research=%d chars",
                    jd.id, len(company_research),
                )
            except Exception:
                self.db.rollback()
                logger.warning("Failed to persist company_research for jd %s", jd.id, exc_info=True)

    def list_jds(self, clerk_user_id: str, tag: str | None = None) -> list[JD]:
        profile = get_profile_or_404(self.db, clerk_user_id)
        q = self.db.query(JD).filter_by(user_id=profile.id)
        if tag:
            # JSONB containment: labels @> '{"tags": ["<tag>"]}'
            from sqlalchemy import cast
            from sqlalchemy.dialects.postgresql import JSONB
            q = q.filter(JD.labels.op("@>")(cast({"tags": [tag]}, JSONB)))
        return q.order_by(JD.created_at.desc()).all()

    def get_jd(self, clerk_user_id: str, jd_id: uuid.UUID) -> JD:
        profile = get_profile_or_404(self.db, clerk_user_id)
        jd = self.db.query(JD).filter_by(id=jd_id, user_id=profile.id).first()
        if not jd:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JD not found.")
        return jd
