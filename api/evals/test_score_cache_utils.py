import pytest

from services.score_cache_utils import (
    compute_ats_input_hash,
    compute_fit_input_hash,
    compute_jd_requirements_fingerprint,
    compute_memory_fingerprint,
    content_hash,
    normalize_company_name,
)


class _Mem:
    def __init__(self, id_: str, content: str, updated_at: str):
        from datetime import datetime, timezone
        self.id = id_
        self.content = content
        self.updated_at = datetime.fromisoformat(updated_at).replace(tzinfo=timezone.utc)


def test_content_hash_stable():
    assert content_hash("hello") == content_hash("hello")
    assert content_hash("hello") != content_hash("world")


def test_memory_fingerprint_changes_when_content_changes():
    m1 = [_Mem("a", "Python dev", "2026-01-01T00:00:00+00:00")]
    m2 = [_Mem("a", "Rust dev", "2026-01-01T00:00:00+00:00")]
    assert compute_memory_fingerprint(m1) != compute_memory_fingerprint(m2)


def test_fit_input_hash_combines_jd_and_memories():
    jd_fp = compute_jd_requirements_fingerprint({"required_skills": ["Python"]}, {"domain": "SaaS"})
    mem_fp = compute_memory_fingerprint([])
    h1 = compute_fit_input_hash(jd_fp, mem_fp)
    h2 = compute_fit_input_hash(jd_fp, "other")
    assert h1 != h2


def test_ats_input_hash_changes_with_resume():
    h1 = compute_ats_input_hash({"summary": "A"}, {"required_skills": ["Go"]})
    h2 = compute_ats_input_hash({"summary": "B"}, {"required_skills": ["Go"]})
    assert h1 != h2


def test_normalize_company_name():
    assert normalize_company_name("Stripe, Inc.") == normalize_company_name("stripe inc")
