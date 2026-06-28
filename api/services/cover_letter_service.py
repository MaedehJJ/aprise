import asyncio
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from db.models import (
    Conversation,
    CoverLetter,
    JD,
    JDNote,
    Memory,
    Profile,
    Resume,
)
from prompts import cover_letter_generation_prompt
from services.ai_service import AIService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


class CoverLetterService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def generate(self, jd_id: uuid.UUID, clerk_user_id: str) -> CoverLetter:
        """
        Full cover letter generation flow:
          1. Load JD details and coaching answers.
          2. Retrieve relevant user memories.
          3. Find the latest generated resume for context (if available).
          4. Call LLM to produce structured cover letter + retrieval tags.
          5. Persist CoverLetter row with the same tags as the resume.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd = await self._get_jd(jd_id, profile.id)

        # Fetch conversation and JD notes in parallel — independent queries.
        conv_result, notes_result = await asyncio.gather(
            self.db.execute(select(Conversation).filter_by(jd_id=jd_id)),
            self.db.execute(select(JDNote).filter_by(jd_id=jd_id)),
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No coaching conversation found. Start a conversation first.",
            )
        jd_notes = notes_result.scalars().all()

        db_state = conversation.state or {}
        answers: list[str] = db_state.get("answers", [])

        requirements = jd.parsed_requirements or {}
        required_skills: list[str] = requirements.get("required_skills", [])
        responsibilities: list[str] = requirements.get("responsibilities", [])

        user_memories = await self._retrieve_memories(
            profile=profile,
            query_text=" ".join(required_skills + responsibilities[:5]),
        )

        labels = jd.labels or {}
        result = self._ai.structured(
            cover_letter_generation_prompt,
            langsmith_extra={
                "jd_id": str(jd_id),
                "profile_id": str(profile.id),
                "step": "cover_letter_generation",
            },
            company=jd.company_name or "the company",
            role=jd.role_title or "this role",
            company_size=labels.get("company_size", "unknown"),
            role_focus=labels.get("role_focus", "unknown"),
            tech_depth=labels.get("tech_depth", "unknown"),
            domain=labels.get("domain", "unknown"),
            company_research=jd.company_research or "No company research available.",
            required_skills=", ".join(required_skills) if required_skills else "Not specified",
            responsibilities="\n- " + "\n- ".join(responsibilities) if responsibilities else "Not specified",
            answers=self._format_answers(answers),
            user_memories=user_memories,
        )

        logger.info(
            "Cover letter generated for jd_id=%s: %d body paragraphs, tags=%s",
            jd_id, len(result.body_paragraphs), result.tags,
        )

        merged_labels = {**(jd.labels or {}), "tags": result.tags}

        cover_letter = CoverLetter(
            user_id=profile.id,
            jd_id=jd_id,
            content={
                "opening_paragraph": result.opening_paragraph,
                "body_paragraphs": result.body_paragraphs,
                "closing_paragraph": result.closing_paragraph,
            },
            labels=merged_labels,
            is_generated=True,
        )
        self.db.add(cover_letter)
        await self.db.commit()
        await self.db.refresh(cover_letter)
        return cover_letter

    async def list_cover_letters(self, jd_id: uuid.UUID, clerk_user_id: str) -> list[CoverLetter]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        await self._get_jd(jd_id, profile.id)
        return (
            await self.db.execute(
                select(CoverLetter)
                .filter_by(jd_id=jd_id, user_id=profile.id)
                .order_by(CoverLetter.created_at.desc())
            )
        ).scalars().all()

    async def get(self, cover_letter_id: uuid.UUID, clerk_user_id: str) -> CoverLetter:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        cl = (
            await self.db.execute(
                select(CoverLetter).filter_by(id=cover_letter_id, user_id=profile.id)
            )
        ).scalar_one_or_none()
        if not cl:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover letter not found.")
        return cl

    # ── Helpers ────────────────────────────────────────────────────────────────

    async def _get_jd(self, jd_id: uuid.UUID, profile_id: uuid.UUID) -> JD:
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile_id))
        ).scalar_one_or_none()
        if not jd:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JD not found.")
        return jd

    async def _retrieve_memories(self, profile: Profile, query_text: str) -> str:
        if not query_text.strip():
            return "No background information available."
        try:
            vector = self._ai.embed(query_text)
            memories = (
                await self.db.execute(
                    select(Memory)
                    .options(load_only(Memory.content, Memory.chunk_type))
                    .filter(Memory.user_id == profile.id)
                    .order_by(Memory.embedding.op("<=>")(vector))
                    .limit(12)
                )
            ).scalars().all()
            if not memories:
                return "No background information available."
            return "\n\n".join(f"[{m.chunk_type.value}] {m.content}" for m in memories)
        except Exception:
            logger.warning("Memory retrieval failed for cover letter generation", exc_info=True)
            return "No background information available."

    @staticmethod
    def _format_answers(answers: list[str]) -> str:
        if not answers:
            return "No coaching conversation recorded yet — write from available background."
        return "\n".join(f"- {a}" for a in answers)
