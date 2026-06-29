"""
Unit tests for fit score cache hit / miss / invalidation.

Run from api/ directory:
    uv run pytest evals/test_fit_score_cache.py -v

No real LLM or DB required — all dependencies are mocked.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.score_cache_utils import (
    compute_fit_input_hash,
    compute_jd_requirements_fingerprint,
    compute_memory_fingerprint,
    utc_now_iso,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mem(content: str, updated_at: str = "2026-01-01T00:00:00+00:00"):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.content = content
    m.updated_at = datetime.fromisoformat(updated_at).replace(tzinfo=timezone.utc)
    return m


def _jd(parsed_requirements=None, labels=None, fit_score_cache=None):
    j = MagicMock()
    j.id = uuid.uuid4()
    j.parsed_requirements = parsed_requirements or {"required_skills": ["Python"]}
    j.labels = labels or {"domain": "SaaS"}
    j.fit_score_cache = fit_score_cache
    j.company_name = "Acme"
    j.role_title = "Engineer"
    return j


def _profile():
    p = MagicMock()
    p.id = uuid.uuid4()
    return p


def _make_service(jd, memories, profile, llm_result=None):
    """Build a FitScoreService with mocked db and ai."""
    from services.fit_score_service import FitScoreService

    db = MagicMock()
    ai = MagicMock()

    # profile lookup
    profile_row = MagicMock()
    profile_row.scalar_one_or_none = MagicMock(return_value=profile)

    jd_row = MagicMock()
    jd_row.scalar_one_or_none = MagicMock(return_value=jd)

    mem_row = MagicMock()
    mem_row.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=memories)))

    db.execute = AsyncMock(side_effect=[profile_row, jd_row, mem_row])
    db.commit = AsyncMock()

    # LLM response
    if llm_result is not None:
        result_obj = MagicMock()
        result_obj.model_dump.return_value = llm_result
        result_obj.score = llm_result["score"]
        ai.structured.return_value = result_obj

    service = FitScoreService(db=db, ai=ai)
    service._load_memories = AsyncMock(return_value=memories)
    return service, ai


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestFitScoreCacheHit:

    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_value_without_llm(self):
        """Second call with same inputs returns cached value; LLM not called."""
        memories = [_mem("Python dev")]
        profile = _profile()
        jd_reqs = {"required_skills": ["Python"]}
        jd_labels = {"domain": "SaaS"}

        mem_fp = compute_memory_fingerprint(memories)
        jd_fp = compute_jd_requirements_fingerprint(jd_reqs, jd_labels)
        input_hash = compute_fit_input_hash(jd_fp, mem_fp)

        cached_payload = {
            "score": 82,
            "fit_level": "strong",
            "strengths": ["Python"],
            "gaps": [],
            "recommendation": "Apply",
            "input_hash": input_hash,
            "computed_at": utc_now_iso(),
        }
        jd = _jd(parsed_requirements=jd_reqs, labels=jd_labels, fit_score_cache=cached_payload)

        service, ai = _make_service(jd, memories, profile)

        result = await service.get_or_compute("user_clerk_id", jd.id)

        assert result["score"] == 82
        ai.structured.assert_not_called()


class TestFitScoreCacheMiss:

    @pytest.mark.asyncio
    async def test_cache_miss_calls_llm_and_stores(self):
        """No cache → LLM is called; result stored on jd object."""
        memories = [_mem("Python dev")]
        profile = _profile()
        jd = _jd(fit_score_cache=None)

        llm_result = {
            "score": 75,
            "fit_level": "moderate",
            "strengths": ["Python"],
            "gaps": ["Go experience"],
            "recommendation": "Apply with cover letter",
        }
        service, ai = _make_service(jd, memories, profile, llm_result=llm_result)

        result = await service.get_or_compute("user_clerk_id", jd.id)

        assert result["score"] == 75
        ai.structured.assert_called_once()
        assert jd.fit_score_cache is not None
        assert jd.fit_score_cache["score"] == 75
        assert "input_hash" in jd.fit_score_cache


class TestFitScoreCacheInvalidation:

    @pytest.mark.asyncio
    async def test_stale_cache_recomputes_after_memory_change(self):
        """Cache hash mismatches new memory → LLM recomputes."""
        old_memories = [_mem("Java dev")]
        new_memories = [_mem("Python dev")]  # changed content
        profile = _profile()
        jd_reqs = {"required_skills": ["Python"]}
        jd_labels = {"domain": "SaaS"}

        # Cache was computed with old memories
        old_fp = compute_memory_fingerprint(old_memories)
        old_hash = compute_fit_input_hash(
            compute_jd_requirements_fingerprint(jd_reqs, jd_labels),
            old_fp,
        )
        cached_payload = {
            "score": 40,
            "fit_level": "weak",
            "strengths": [],
            "gaps": ["Python"],
            "recommendation": "Pass",
            "input_hash": old_hash,
            "computed_at": utc_now_iso(),
        }
        jd = _jd(parsed_requirements=jd_reqs, labels=jd_labels, fit_score_cache=cached_payload)

        llm_result = {
            "score": 90,
            "fit_level": "strong",
            "strengths": ["Python"],
            "gaps": [],
            "recommendation": "Apply",
        }
        service, ai = _make_service(jd, new_memories, profile, llm_result=llm_result)

        result = await service.get_or_compute("user_clerk_id", jd.id)

        # New memories → stale hash → recomputed
        assert result["score"] == 90
        ai.structured.assert_called_once()
        # New hash stored
        new_fp = compute_memory_fingerprint(new_memories)
        expected_hash = compute_fit_input_hash(
            compute_jd_requirements_fingerprint(jd_reqs, jd_labels),
            new_fp,
        )
        assert jd.fit_score_cache["input_hash"] == expected_hash
