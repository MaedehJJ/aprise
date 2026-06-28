"""
JD similarity service using pgvector cosine distance.

Queries the existing jd_memories table (which already has HNSW indexes) to
find the user's most semantically similar past JDs. No separate vector store
or LangChain abstraction needed — we own the schema and the indexes are already
in place from migration c3d4e5f6a7b8.

Usage: called once at JD creation time to surface past related applications
as context for gap detection and coaching prompts.
"""
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from db.models import JD, JDMemory
from services.ai_service import AIService

logger = logging.getLogger(__name__)

# Number of jd_memory chunks to scan, then group + deduplicate.
_CHUNK_SCAN_LIMIT = 30
# Max similar JDs returned.
_MAX_SIMILAR = 3
# Max characters of a past JD's summary to include in the context string.
_SUMMARY_MAX_CHARS = 300


@dataclass
class SimilarJDResult:
    jd: JD
    match_count: int   # number of jd_memory chunks that matched


class JDSimilarityService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    async def find_similar(
        self,
        jd: JD,
        profile_id: uuid.UUID,
        limit: int = _MAX_SIMILAR,
    ) -> list[SimilarJDResult]:
        """
        Finds past JDs from the same user that are most semantically similar to
        the given JD, using cosine distance on jd_memory embeddings.

        Strategy:
          1. Embed the new JD's raw text (first 2000 chars to keep it fast).
          2. Query jd_memories for the closest chunks, excluding the current JD.
          3. Group by jd_id, rank by chunk hit count.
          4. Load the top JD rows and return them with their hit count.

        Falls back gracefully on any error.
        """
        if not jd.raw_text:
            return []

        try:
            query_vector = self._ai.embed(jd.raw_text[:2000])

            similar_chunks: list[JDMemory] = (
                await self.db.execute(
                    select(JDMemory)
                    .filter(
                        JDMemory.user_id == profile_id,
                        JDMemory.jd_id != jd.id,
                    )
                    .order_by(JDMemory.embedding.op("<=>")(query_vector))
                    .limit(_CHUNK_SCAN_LIMIT)
                )
            ).scalars().all()

            if not similar_chunks:
                return []

            # Count chunk hits per JD — more hits means more semantic overlap.
            hit_counts: dict[uuid.UUID, int] = {}
            for chunk in similar_chunks:
                hit_counts[chunk.jd_id] = hit_counts.get(chunk.jd_id, 0) + 1

            top_ids = sorted(hit_counts, key=lambda k: hit_counts[k], reverse=True)[:limit]

            past_jds: list[JD] = (
                await self.db.execute(
                    select(JD)
                    .options(
                        load_only(
                            JD.id, JD.company_name, JD.role_title,
                            JD.labels, JD.parsed_requirements,
                        )
                    )
                    .filter(JD.id.in_(top_ids))
                )
            ).scalars().all()

            # Preserve ranking order.
            jd_map = {j.id: j for j in past_jds}
            results = [
                SimilarJDResult(jd=jd_map[jid], match_count=hit_counts[jid])
                for jid in top_ids
                if jid in jd_map
            ]

            logger.info(
                "JD similarity: found %d similar past JDs for jd_id=%s",
                len(results), jd.id,
            )
            return results

        except Exception:
            logger.warning(
                "JD similarity search failed for jd_id=%s — continuing without", jd.id, exc_info=True
            )
            return []

    @staticmethod
    def format_for_prompt(results: list[SimilarJDResult]) -> str:
        """
        Formats similar JD results as a concise string block for injection
        into the gap detection prompt.
        """
        if not results:
            return "None"

        lines = []
        for r in results:
            j = r.jd
            labels = j.labels or {}
            tags = labels.get("tags", [])
            tag_str = ", ".join(tags[:5]) if tags else (
                f"{labels.get('role_focus', '')}/{labels.get('domain', '')}".strip("/")
            )
            role_str = f"{j.company_name or '?'} — {j.role_title or '?'}"
            reqs = j.parsed_requirements or {}
            skills = ", ".join((reqs.get("required_skills") or [])[:5])
            lines.append(f"  • [{tag_str or 'untagged'}] {role_str}  |  skills: {skills or 'N/A'}")

        return "\n".join(lines)
