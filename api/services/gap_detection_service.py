import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from db.models import JD, Memory, Profile
from prompts import gap_detection_prompt
from prompts.gap_detection import GapDetectionOutput
from services.ai_service import AIService
from services.jd_similarity_service import JDSimilarityService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


@dataclass
class GapDetectionResult:
    gaps: list[str]
    covered: list[str]
    initial_message: str
    relevant_memories: list[Memory]


class GapDetectionService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def detect(self, jd: JD, profile: Profile) -> GapDetectionResult:
        """
        Runs semantic search to find the user's most relevant memories for this JD,
        then uses an LLM to identify gaps and generate the opening coaching message.
        """
        requirements = jd.parsed_requirements or {}
        required_skills: list[str] = requirements.get("required_skills", [])
        responsibilities: list[str] = requirements.get("responsibilities", [])

        logger.info("Running gap detection for jd_id=%s profile_id=%s", jd.id, profile.id)
        relevant_memories = await self._retrieve_relevant_memories(
            profile=profile,
            required_skills=required_skills,
            responsibilities=responsibilities,
        )

        # Retrieve similar past JDs for context calibration.
        similarity_svc = JDSimilarityService(db=self.db, ai=self._ai)
        similar_jds = await similarity_svc.find_similar(jd=jd, profile_id=profile.id)
        similar_jd_context = JDSimilarityService.format_for_prompt(similar_jds)

        labels = jd.labels or {}
        memories_text = self._format_memories(relevant_memories)
        result: GapDetectionOutput = self._ai.structured(
            gap_detection_prompt,
            langsmith_extra={"jd_id": str(jd.id), "profile_id": str(profile.id)},
            company=jd.company_name or "the company",
            role=jd.role_title or "this role",
            company_size=labels.get("company_size", "unknown"),
            role_focus=labels.get("role_focus", "unknown"),
            tech_depth=labels.get("tech_depth", "unknown"),
            domain=labels.get("domain", "unknown"),
            required_skills=", ".join(required_skills) if required_skills else "Not specified",
            responsibilities="\n- ".join(responsibilities) if responsibilities else "Not specified",
            company_research=jd.company_research or "No company research available.",
            similar_jd_context=similar_jd_context,
            memories=memories_text,
        )

        logger.info(
            "Gap detection complete for jd_id=%s: %d gaps, %d covered",
            jd.id, len(result.gaps), len(result.covered),
        )
        return GapDetectionResult(
            gaps=result.gaps,
            covered=result.covered,
            initial_message=result.initial_message,
            relevant_memories=relevant_memories,
        )

    async def _retrieve_relevant_memories(
        self,
        profile: Profile,
        required_skills: list[str],
        responsibilities: list[str],
    ) -> list[Memory]:
        """
        Combines required skills and responsibilities into a single search query,
        then retrieves the top semantically similar memories for the user.
        """
        if not required_skills and not responsibilities:
            return (
                await self.db.execute(
                    select(Memory)
                    .options(load_only(Memory.content, Memory.chunk_type))
                    .filter(Memory.user_id == profile.id)
                    .limit(10)
                )
            ).scalars().all()

        query_text = " ".join(required_skills + responsibilities[:5])
        query_vector = self._ai.embed(query_text)

        return (
            await self.db.execute(
                select(Memory)
                .options(load_only(Memory.content, Memory.chunk_type))
                .filter(Memory.user_id == profile.id)
                .order_by(Memory.embedding.op("<=>")(query_vector))
                .limit(10)
            )
        ).scalars().all()

    @staticmethod
    def _format_memories(memories: list[Memory]) -> str:
        if not memories:
            return "No memories available yet."
        lines = []
        for m in memories:
            lines.append(f"[{m.chunk_type.value}] {m.content}")
        return "\n\n".join(lines)
