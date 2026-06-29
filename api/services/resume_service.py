import asyncio
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer, load_only

from db.models import (
    Conversation,
    JD,
    JDNote,
    Memory,
    Profile,
    Resume,
)
from prompts import resume_generation_prompt
from services.ai_service import AIService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


class ResumeService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def generate_resume(self, jd_id: uuid.UUID, clerk_user_id: str) -> Resume:
        """
        Full resume generation flow:
          1. Load conversation state (answers gathered during coaching).
          2. Retrieve relevant user memories via semantic search.
          3. Find similar past resumes by JD label overlap.
          4. Call LLM to produce structured resume + retrieval tags.
          5. Persist resume; backfill tags onto JD.labels.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd = await self._get_jd(jd_id, profile.id)

        # Fetch conversation and JD notes in parallel — both independent queries.
        conv_result, notes_result = await asyncio.gather(
            self.db.execute(select(Conversation).filter_by(jd_id=jd_id)),
            self.db.execute(select(JDNote).filter_by(jd_id=jd_id)),
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No coaching conversation found for this JD. Start a conversation first.",
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
        similar_resumes = await self._find_similar_resumes(jd=jd, profile_id=profile.id, exclude_jd_id=jd_id)

        labels = jd.labels or {}
        result = self._ai.structured(
            resume_generation_prompt,
            langsmith_extra={
                "jd_id": str(jd_id),
                "profile_id": str(profile.id),
                "step": "resume_generation",
            },
            company=jd.company_name or "the company",
            role=jd.role_title or "this role",
            company_size=labels.get("company_size", "unknown"),
            role_focus=labels.get("role_focus", "unknown"),
            tech_depth=labels.get("tech_depth", "unknown"),
            domain=labels.get("domain", "unknown"),
            required_skills=", ".join(required_skills) if required_skills else "Not specified",
            responsibilities="\n- " + "\n- ".join(responsibilities) if responsibilities else "Not specified",
            jd_notes=self._format_jd_notes(jd_notes),
            answers=self._format_answers(answers),
            user_memories=user_memories,
            similar_resumes_section=self._format_similar_resumes(similar_resumes),
        )

        logger.info(
            "Resume generated for jd_id=%s: %d experience entries, %d skills, tags=%s",
            jd_id, len(result.experience), len(result.skills), result.tags,
        )

        # Merge generated tags into the existing JD labels so future retrieval is tag-aware.
        merged_labels = {**(jd.labels or {}), "tags": result.tags}

        content_payload = {
            "summary": result.summary,
            "experience": [e.model_dump() for e in result.experience],
            "skills": result.skills,
        }

        resume = Resume(
            user_id=profile.id,
            jd_id=jd_id,
            content=content_payload,
            labels=merged_labels,
            is_generated=True,
        )
        self.db.add(resume)

        # Write tags back onto the JD so it can be retrieved for similar future applications.
        jd.labels = merged_labels

        await self.db.commit()
        await self.db.refresh(resume)

        # Compute ATS score cache (non-fatal).
        try:
            from services.ats_score_service import ATSScoreService
            from sqlalchemy.orm import selectinload
            from sqlalchemy import select as sa_select

            resume_with_jd = (
                await self.db.execute(
                    sa_select(Resume)
                    .options(selectinload(Resume.jd))
                    .filter_by(id=resume.id)
                )
            ).scalars().unique().one_or_none()
            if resume_with_jd:
                await ATSScoreService(db=self.db, ai=self._ai).compute_and_cache_for_resume(
                    resume_with_jd
                )
                await self.db.commit()
                resume = resume_with_jd
        except Exception:
            logger.warning("ATS score cache after resume creation failed — skipping", exc_info=True)

        # Generate and persist the DOCX file so users can download it immediately.
        try:
            from routers.resume import _build_resume_docx
            from sqlalchemy import select as sa_select
            from db.models import JD as JDModel
            from sqlalchemy.orm import selectinload

            resume_with_jd = (
                await self.db.execute(
                    sa_select(Resume)
                    .options(selectinload(Resume.jd))
                    .filter_by(id=resume.id)
                )
            ).scalars().unique().one_or_none()

            if resume_with_jd:
                resume_with_jd.docx_content = _build_resume_docx(resume_with_jd)
                await self.db.commit()
                resume = resume_with_jd
        except Exception:
            logger.warning("DOCX generation after resume creation failed — skipping", exc_info=True)

        # Extract STAR stories from coaching answers (non-fatal).
        stars_extracted = 0
        try:
            from services.star_service import StarService
            created_stories = await StarService(db=self.db, ai=self._ai).extract_from_conversation(
                jd_id=jd_id, profile_id=profile.id
            )
            stars_extracted = len(created_stories)
        except Exception:
            logger.warning("STAR extraction after resume generation failed — skipping", exc_info=True)

        resume.stars_extracted = stars_extracted  # type: ignore[attr-defined]
        return resume

    async def list_resumes(self, jd_id: uuid.UUID, clerk_user_id: str) -> list[Resume]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        await self._get_jd(jd_id, profile.id)
        return (
            await self.db.execute(
                select(Resume)
                .options(defer(Resume.docx_content))
                .filter_by(jd_id=jd_id, user_id=profile.id)
                .order_by(Resume.created_at.desc())
            )
        ).scalars().all()

    async def get_resume(self, resume_id: uuid.UUID, clerk_user_id: str) -> Resume:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        resume = (
            await self.db.execute(
                select(Resume)
                .options(defer(Resume.docx_content))
                .filter_by(id=resume_id, user_id=profile.id)
            )
        ).scalar_one_or_none()
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found."
            )
        return resume

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_jd(self, jd_id: uuid.UUID, profile_id: uuid.UUID) -> JD:
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile_id))
        ).scalar_one_or_none()
        if not jd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="JD not found."
            )
        return jd

    async def _retrieve_memories(self, profile: Profile, query_text: str) -> str:
        """
        Semantic search for the user's memories most relevant to the JD.
        Retrieves more entries than coaching turns (15) for a complete picture.
        """
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
                    .limit(15)
                )
            ).scalars().all()
            if not memories:
                return "No background information available."
            return "\n\n".join(f"[{m.chunk_type.value}] {m.content}" for m in memories)
        except Exception:
            logger.warning(
                "Memory retrieval failed for resume generation — profile %s",
                profile.id,
                exc_info=True,
            )
            return "No background information available."

    async def _find_similar_resumes(
        self, jd: JD, profile_id: uuid.UUID, exclude_jd_id: uuid.UUID
    ) -> list[Resume]:
        """
        Finds up to 3 past resumes whose JD labels share the same role_focus or domain.
        The LLM uses these as inspiration for proven patterns and bullet styles.
        """
        if not jd.labels:
            return []

        role_focus = jd.labels.get("role_focus")
        domain = jd.labels.get("domain")
        if not role_focus and not domain:
            return []

        try:
            # Use JSONB .astext operator to compare without JSON-quote wrapping.
            conditions = []
            if role_focus:
                conditions.append(Resume.labels["role_focus"].astext == role_focus)
            if domain:
                conditions.append(Resume.labels["domain"].astext == domain)

            return (
                await self.db.execute(
                    select(Resume)
                    .options(
                        load_only(
                            Resume.id, Resume.jd_id, Resume.content,
                            Resume.labels, Resume.created_at,
                        )
                    )
                    .filter(
                        Resume.user_id == profile_id,
                        Resume.jd_id != exclude_jd_id,
                        Resume.content.isnot(None),
                        or_(*conditions),
                    )
                    .order_by(Resume.created_at.desc())
                    .limit(3)
                )
            ).scalars().all()
        except Exception:
            logger.warning("Similar resume lookup failed — proceeding without", exc_info=True)
            return []

    @staticmethod
    def _format_jd_notes(notes: list[JDNote]) -> str:
        if not notes:
            return "None"
        return "\n".join(f"[{n.note_type.value}] {n.content}" for n in notes)

    @staticmethod
    def _format_answers(answers: list[str]) -> str:
        if not answers:
            return "No coaching conversation recorded yet — generate from available background."
        return "\n".join(f"- {a}" for a in answers)

    @staticmethod
    def _format_similar_resumes(resumes: list[Resume]) -> str:
        if not resumes:
            return ""
        lines = ["\nSimilar past resumes (use as style/pattern inspiration only):"]
        for r in resumes:
            content = r.content or {}
            tags = (r.labels or {}).get("tags", [])
            tag_str = ", ".join(tags[:6]) if tags else "untagged"
            summary_snippet = (content.get("summary") or "")[:180]
            exp_count = len(content.get("experience") or [])
            lines.append(
                f"  [{tag_str}] — {exp_count} experience entries. Summary: {summary_snippet}"
            )
        return "\n".join(lines)
