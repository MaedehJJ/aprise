"""
Unit tests for GapDetectionService.

Run from api/ directory:
    uv run pytest evals/test_gap_detection.py -v

No real LLM or DB required — all dependencies are mocked.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.gap_detection_service import GapDetectionService


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _jd(**kwargs):
    j = MagicMock()
    j.id = uuid.uuid4()
    j.company_name = kwargs.get("company_name", "Acme Corp")
    j.role_title = kwargs.get("role_title", "Senior Engineer")
    j.parsed_requirements = kwargs.get("parsed_requirements", {
        "required_skills": ["Python", "Kafka", "Kubernetes"],
        "responsibilities": ["Design distributed systems", "Own the data pipeline"],
    })
    j.labels = kwargs.get("labels", {
        "company_size": "mid",
        "role_focus": "backend",
        "tech_depth": "high",
        "domain": "fintech",
    })
    j.company_research = "Acme Corp is a fintech startup processing $2B in payments."
    return j


def _profile():
    p = MagicMock()
    p.id = uuid.uuid4()
    return p


def _memory(content: str, chunk_type_value: str = "EXPERIENCE"):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.content = content
    chunk_type = MagicMock()
    chunk_type.value = chunk_type_value
    m.chunk_type = chunk_type
    m.embedding = [0.1] * 1536
    return m


def _mock_ai(gaps: list[str], covered: list[str], initial_message: str):
    ai = MagicMock()
    result = MagicMock()
    result.gaps = gaps
    result.covered = covered
    result.initial_message = initial_message
    ai.structured.return_value = result
    ai.embed.return_value = [0.1] * 1536
    return ai


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestGapDetectionOutputShape:

    @pytest.mark.asyncio
    async def test_returns_gaps_list(self):
        """detect() returns GapDetectionResult with non-empty gaps list."""
        jd = _jd()
        profile = _profile()
        memories = [_memory("5 years Python at a fintech startup")]
        ai = _mock_ai(
            gaps=["Kafka experience", "Kubernetes proficiency"],
            covered=["Python"],
            initial_message="Hi! I noticed you have strong Python but want to explore Kafka.",
        )
        db = MagicMock()

        service = GapDetectionService(db=db, ai=ai)
        service._retrieve_relevant_memories = AsyncMock(return_value=memories)

        # stub out JDSimilarityService so we don't hit the db
        from unittest.mock import patch, AsyncMock as AM
        with patch(
            "services.gap_detection_service.JDSimilarityService"
        ) as MockSim:
            sim_instance = MagicMock()
            sim_instance.find_similar = AsyncMock(return_value=[])
            MockSim.return_value = sim_instance
            MockSim.format_for_prompt = MagicMock(return_value="No similar JDs.")

            result = await service.detect(jd, profile)

        assert isinstance(result.gaps, list)
        assert len(result.gaps) == 2
        assert "Kafka experience" in result.gaps

    @pytest.mark.asyncio
    async def test_returns_covered_and_initial_message(self):
        """detect() populates covered skills and initial_message."""
        jd = _jd()
        profile = _profile()
        memories = [_memory("Kafka streaming pipelines at scale")]
        ai = _mock_ai(
            gaps=["Kubernetes"],
            covered=["Python", "Kafka"],
            initial_message="Great Kafka background! Let's talk about Kubernetes.",
        )
        db = MagicMock()

        service = GapDetectionService(db=db, ai=ai)
        service._retrieve_relevant_memories = AsyncMock(return_value=memories)

        from unittest.mock import patch
        with patch("services.gap_detection_service.JDSimilarityService") as MockSim:
            sim_instance = MagicMock()
            sim_instance.find_similar = AsyncMock(return_value=[])
            MockSim.return_value = sim_instance
            MockSim.format_for_prompt = MagicMock(return_value="No similar JDs.")

            result = await service.detect(jd, profile)

        assert "Kafka" in result.covered
        assert "Kubernetes" in result.initial_message

    @pytest.mark.asyncio
    async def test_no_gaps_when_fully_covered(self):
        """detect() returns empty gaps list when user fully covers requirements."""
        jd = _jd(parsed_requirements={
            "required_skills": ["Python"],
            "responsibilities": ["Build APIs"],
        })
        profile = _profile()
        memories = [_memory("10 years Python, FastAPI expert")]
        ai = _mock_ai(
            gaps=[],
            covered=["Python"],
            initial_message="You're a great fit! Let's refine your story.",
        )
        db = MagicMock()

        service = GapDetectionService(db=db, ai=ai)
        service._retrieve_relevant_memories = AsyncMock(return_value=memories)

        from unittest.mock import patch
        with patch("services.gap_detection_service.JDSimilarityService") as MockSim:
            sim_instance = MagicMock()
            sim_instance.find_similar = AsyncMock(return_value=[])
            MockSim.return_value = sim_instance
            MockSim.format_for_prompt = MagicMock(return_value="No similar JDs.")

            result = await service.detect(jd, profile)

        assert result.gaps == []
        assert result.relevant_memories == memories
