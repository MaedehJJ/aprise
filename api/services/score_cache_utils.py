"""Hash helpers for fit/ATS score cache invalidation."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compute_memory_fingerprint(memories: list[Any]) -> str:
    """Fingerprint all memories that affect fit scoring for a user."""
    parts = sorted(
        f"{m.id}:{m.updated_at.isoformat()}:{m.content}"
        for m in memories
    )
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def compute_jd_requirements_fingerprint(parsed_requirements: dict | None, labels: dict | None) -> str:
    payload = json.dumps(
        {"req": parsed_requirements or {}, "labels": labels or {}},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_fit_input_hash(jd_fp: str, memory_fp: str) -> str:
    return hashlib.sha256(f"{jd_fp}:{memory_fp}".encode("utf-8")).hexdigest()


def compute_ats_input_hash(
    resume_content: dict | None,
    parsed_requirements: dict | None,
) -> str:
    payload = json.dumps(
        {"resume": resume_content or {}, "req": parsed_requirements or {}},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_company_name(name: str) -> str:
    """Lowercase, strip legal suffixes for cache lookup."""
    import re

    n = name.strip().lower()
    n = re.sub(r"\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?)$", "", n, flags=re.IGNORECASE)
    n = re.sub(r"[^a-z0-9]+", " ", n).strip()
    return n
