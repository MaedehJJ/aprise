"""
GET /api/tags — returns all unique tags across the current user's JDs and
resumes, with occurrence counts. Used by the Browse page to build the tag cloud.

Tags live in JSONB labels columns as `{"tags": ["Python", "LLM", ...]}`.
We use jsonb_array_elements_text to unnest them in Postgres.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.neon import get_db
from routers.auth import get_current_user
from services.utils import get_profile_or_404

router = APIRouter()


class TagCount(BaseModel):
    tag: str
    jd_count: int
    resume_count: int
    total: int


class TaggedJD(BaseModel):
    id: uuid.UUID
    company_name: str | None
    role_title: str | None
    labels: dict | None
    company_research: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaggedResume(BaseModel):
    id: uuid.UUID
    jd_id: uuid.UUID
    labels: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BrowseResult(BaseModel):
    tag: str
    jds: list[TaggedJD]
    resumes: list[TaggedResume]


@router.get("/api/tags", response_model=list[TagCount])
def list_tags(
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all distinct tags for the current user with their occurrence counts,
    sorted by total usage descending.

    Uses jsonb_array_elements_text for unnesting and avoids the ? operator
    (existence operator) in favour of ->> IS NOT NULL so the raw SQL string
    is never ambiguous with parameter-placeholder characters in any driver.
    """
    profile = get_profile_or_404(db, clerk_user_id)
    user_id = str(profile.id)

    # Unnest tags from jds. ->> extracts the value as text; the LATERAL
    # produces one row per tag.  The IS NOT NULL guard ensures we skip rows
    # where the key is absent without relying on the ? operator.
    jd_tags = db.execute(
        text("""
            SELECT t.tag, COUNT(*) AS cnt
            FROM jds j,
                 jsonb_array_elements_text(j.labels->'tags') AS t(tag)
            WHERE j.user_id = CAST(:uid AS uuid)
              AND (j.labels->>'tags') IS NOT NULL
            GROUP BY t.tag
        """),
        {"uid": user_id},
    ).fetchall()

    resume_tags = db.execute(
        text("""
            SELECT t.tag, COUNT(*) AS cnt
            FROM resumes r,
                 jsonb_array_elements_text(r.labels->'tags') AS t(tag)
            WHERE r.user_id = CAST(:uid AS uuid)
              AND (r.labels->>'tags') IS NOT NULL
            GROUP BY t.tag
        """),
        {"uid": user_id},
    ).fetchall()

    # Use positional access (row[0], row[1]) — named attribute access on
    # SQLAlchemy 2.0 text() Row objects is fragile across driver versions.
    counts: dict[str, dict] = {}
    for row in jd_tags:
        tag, cnt = row[0], int(row[1])
        counts.setdefault(tag, {"jd_count": 0, "resume_count": 0})
        counts[tag]["jd_count"] = cnt
    for row in resume_tags:
        tag, cnt = row[0], int(row[1])
        counts.setdefault(tag, {"jd_count": 0, "resume_count": 0})
        counts[tag]["resume_count"] = cnt

    result = [
        TagCount(
            tag=tag,
            jd_count=v["jd_count"],
            resume_count=v["resume_count"],
            total=v["jd_count"] + v["resume_count"],
        )
        for tag, v in counts.items()
    ]
    return sorted(result, key=lambda t: t.total, reverse=True)


@router.get("/api/tags/{tag}/browse", response_model=BrowseResult)
def browse_tag(
    tag: str,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all JDs and resumes that carry the given tag for the current user.
    """
    profile = get_profile_or_404(db, clerk_user_id)

    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import JSONB
    from db.models import JD, Resume

    # Build the containment filter using raw SQL so we don't rely on the
    # SQLAlchemy JSONB operator shim (which can behave differently across
    # driver versions).  jsonb_path_exists is available in PG 12+.
    tag_json = f'["{tag}"]'  # e.g. '["Python"]'

    jds = db.execute(
        text("""
            SELECT id FROM jds
            WHERE user_id = CAST(:uid AS uuid)
              AND labels->'tags' @> CAST(:tag_json AS jsonb)
            ORDER BY created_at DESC
        """),
        {"uid": str(profile.id), "tag_json": tag_json},
    ).fetchall()
    jd_ids = [row[0] for row in jds]
    jd_objects = (
        db.query(JD).filter(JD.id.in_(jd_ids)).order_by(JD.created_at.desc()).all()
        if jd_ids else []
    )

    resumes = db.execute(
        text("""
            SELECT id FROM resumes
            WHERE user_id = CAST(:uid AS uuid)
              AND labels->'tags' @> CAST(:tag_json AS jsonb)
            ORDER BY created_at DESC
        """),
        {"uid": str(profile.id), "tag_json": tag_json},
    ).fetchall()
    resume_ids = [row[0] for row in resumes]
    resume_objects = (
        db.query(Resume).filter(Resume.id.in_(resume_ids)).order_by(Resume.created_at.desc()).all()
        if resume_ids else []
    )

    return BrowseResult(
        tag=tag,
        jds=[TaggedJD.model_validate(j) for j in jd_objects],
        resumes=[TaggedResume.model_validate(r) for r in resume_objects],
    )
