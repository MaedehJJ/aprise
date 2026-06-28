"""
GET /api/tags — returns all unique tags across the current user's JDs and
resumes, with occurrence counts. Used by the Browse page to build the tag cloud.

Tags live in JSONB labels columns as `{"tags": ["Python", "LLM", ...]}`.
We use jsonb_array_elements_text to unnest them in Postgres.
"""
import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import cast, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

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
async def list_tags(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all distinct tags for the current user with their occurrence counts,
    sorted by total usage descending.

    Uses jsonb_array_elements_text for unnesting and avoids the ? operator
    (existence operator) in favour of ->> IS NOT NULL so the raw SQL string
    is never ambiguous with parameter-placeholder characters in any driver.
    """
    profile = await get_profile_or_404(db, clerk_user_id)
    user_id = str(profile.id)

    # Unnest tags from jds and resumes in parallel — independent queries.
    jd_result, resume_result = await asyncio.gather(
        db.execute(
            text("""
                SELECT t.tag, COUNT(*) AS cnt
                FROM jds j,
                     jsonb_array_elements_text(j.labels->'tags') AS t(tag)
                WHERE j.user_id = CAST(:uid AS uuid)
                  AND (j.labels->>'tags') IS NOT NULL
                GROUP BY t.tag
            """),
            {"uid": user_id},
        ),
        db.execute(
            text("""
                SELECT t.tag, COUNT(*) AS cnt
                FROM resumes r,
                     jsonb_array_elements_text(r.labels->'tags') AS t(tag)
                WHERE r.user_id = CAST(:uid AS uuid)
                  AND (r.labels->>'tags') IS NOT NULL
                GROUP BY t.tag
            """),
            {"uid": user_id},
        ),
    )

    jd_tags = jd_result.fetchall()
    resume_tags = resume_result.fetchall()

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
async def browse_tag(
    tag: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all JDs and resumes that carry the given tag for the current user.
    """
    profile = await get_profile_or_404(db, clerk_user_id)

    from db.models import JD, Resume

    # Single ORM query per resource type using JSONB containment (@>).
    # Both queries are independent — run them in parallel.
    tag_json = f'["{tag}"]'

    jd_result, resume_result = await asyncio.gather(
        db.execute(
            select(JD)
            .options(
                load_only(
                    JD.id, JD.company_name, JD.role_title,
                    JD.labels, JD.company_research, JD.created_at,
                )
            )
            .filter(
                JD.user_id == profile.id,
                JD.labels.op("@>")(cast(tag_json, JSONB)),
            )
            .order_by(JD.created_at.desc())
        ),
        db.execute(
            select(Resume)
            .options(load_only(Resume.id, Resume.jd_id, Resume.labels, Resume.created_at))
            .filter(
                Resume.user_id == profile.id,
                Resume.labels.op("@>")(cast(tag_json, JSONB)),
            )
            .order_by(Resume.created_at.desc())
        ),
    )

    jd_objects = jd_result.scalars().all()
    resume_objects = resume_result.scalars().all()

    return BrowseResult(
        tag=tag,
        jds=[TaggedJD.model_validate(j) for j in jd_objects],
        resumes=[TaggedResume.model_validate(r) for r in resume_objects],
    )
