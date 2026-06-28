import asyncio
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Conversation, JD, StarStory
from prompts import star_extraction_prompt
from services.ai_service import AIService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


class StarService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def extract_from_conversation(
        self,
        jd_id: uuid.UUID,
        profile_id: uuid.UUID,
    ) -> list[StarStory]:
        """
        Extract STAR stories from a JD's coaching conversation answers and persist them.
        Called automatically after resume generation. Silently skips on failure.

        Returns the list of newly created StarStory rows.
        """
        try:
            # Fetch JD and conversation in parallel — they're independent.
            jd_result, conv_result = await asyncio.gather(
                self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile_id)),
                self.db.execute(select(Conversation).filter_by(jd_id=jd_id)),
            )
            jd = jd_result.scalar_one_or_none()
            if not jd:
                return []

            conversation = conv_result.scalar_one_or_none()
            if not conversation:
                return []

            answers: list[str] = (conversation.state or {}).get("answers", [])
            if not answers:
                return []

            requirements = jd.parsed_requirements or {}
            required_skills: list[str] = requirements.get("required_skills", [])

            result = self._ai.structured(
                star_extraction_prompt,
                langsmith_extra={"jd_id": str(jd_id), "profile_id": str(profile_id), "step": "star_extraction"},
                company=jd.company_name or "the company",
                role=jd.role_title or "this role",
                required_skills=", ".join(required_skills) if required_skills else "Not specified",
                answers="\n".join(f"- {a}" for a in answers),
            )

            if not result.stories:
                logger.info("star_extraction: no STAR stories found for jd_id=%s", jd_id)
                return []

            story_texts = [
                f"{story.title}: {story.situation} {story.task_action} {story.result}"
                for story in result.stories
            ]
            try:
                embeddings = self._ai.embed_documents(story_texts)
            except Exception:
                logger.warning(
                    "Batch embedding failed for %d STAR stories — skipping all",
                    len(result.stories),
                    exc_info=True,
                )
                return []

            created: list[StarStory] = []
            for story, embedding in zip(result.stories, embeddings):
                row = StarStory(
                    user_id=profile_id,
                    jd_id=jd_id,
                    title=story.title,
                    situation=story.situation,
                    task_action=story.task_action,
                    result=story.result,
                    skills=story.skills,
                    embedding=embedding,
                )
                self.db.add(row)
                created.append(row)

            await self.db.commit()
            logger.info("star_extraction: persisted %d stories for jd_id=%s", len(created), jd_id)
            return created

        except Exception:
            logger.warning("STAR extraction failed for jd_id=%s — continuing", jd_id, exc_info=True)
            await self.db.rollback()
            return []

    async def list_stories(self, clerk_user_id: str, jd_id: uuid.UUID | None = None) -> list[StarStory]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        q = select(StarStory).filter_by(user_id=profile.id)
        if jd_id:
            q = q.filter_by(jd_id=jd_id)
        return (
            await self.db.execute(q.order_by(StarStory.created_at.desc()))
        ).scalars().all()

    async def get_story(self, story_id: uuid.UUID, clerk_user_id: str) -> StarStory:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        story = (
            await self.db.execute(
                select(StarStory).filter_by(id=story_id, user_id=profile.id)
            )
        ).scalar_one_or_none()
        if not story:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="STAR story not found.")
        return story

    async def find_relevant(self, query_text: str, profile_id: uuid.UUID, limit: int = 5) -> list[StarStory]:
        """Semantic search for STAR stories most relevant to the query."""
        try:
            vector = self._ai.embed(query_text)
            return (
                await self.db.execute(
                    select(StarStory)
                    .filter(StarStory.user_id == profile_id)
                    .order_by(StarStory.embedding.op("<=>")(vector))
                    .limit(limit)
                )
            ).scalars().all()
        except Exception:
            logger.warning("STAR story semantic search failed", exc_info=True)
            return []

    async def delete_story(self, story_id: uuid.UUID, clerk_user_id: str) -> None:
        story = await self.get_story(story_id, clerk_user_id)
        await self.db.delete(story)
        await self.db.commit()
