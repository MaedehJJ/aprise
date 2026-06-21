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
    """
    profile = get_profile_or_404(db, clerk_user_id)
    user_id = str(profile.id)

    # Unnest the JSONB tags array from jds table
    jd_tags = db.execute(
        text("""
            SELECT tag, COUNT(*) AS cnt
            FROM jds,
                 jsonb_array_elements_text(labels->'tags') AS tag
            WHERE user_id = :uid::uuid
              AND labels ? 'tags'
            GROUP BY tag
        """),
        {"uid": user_id},
    ).fetchall()

    # Unnest the JSONB tags array from resumes table
    resume_tags = db.execute(
        text("""
            SELECT tag, COUNT(*) AS cnt
            FROM resumes,
                 jsonb_array_elements_text(labels->'tags') AS tag
            WHERE user_id = :uid::uuid
              AND labels ? 'tags'
            GROUP BY tag
        """),
        {"uid": user_id},
    ).fetchall()

    # Merge into a single dict keyed by tag
    counts: dict[str, dict] = {}
    for row in jd_tags:
        counts.setdefault(row.tag, {"jd_count": 0, "resume_count": 0})
        counts[row.tag]["jd_count"] = row.cnt
    for row in resume_tags:
        counts.setdefault(row.tag, {"jd_count": 0, "resume_count": 0})
        counts[row.tag]["resume_count"] = row.cnt

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

    tag_filter = {"tags": [tag]}

    jds = (
        db.query(JD)
        .filter(
            JD.user_id == profile.id,
            JD.labels.op("@>")(cast(tag_filter, JSONB)),
        )
        .order_by(JD.created_at.desc())
        .all()
    )

    resumes = (
        db.query(Resume)
        .filter(
            Resume.user_id == profile.id,
            Resume.labels.op("@>")(cast(tag_filter, JSONB)),
        )
        .order_by(Resume.created_at.desc())
        .all()
    )

    return BrowseResult(
        tag=tag,
        jds=[TaggedJD.model_validate(j) for j in jds],
        resumes=[TaggedResume.model_validate(r) for r in resumes],
    )
