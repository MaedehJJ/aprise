import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Conversation, Memory
from db.neon import get_db
from routers._limiter import limiter
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.fit_score_service import FitScoreService
from services.jd_service import JDService
from services.jd_similarity_service import JDSimilarityService
from services.score_cache_utils import (
    compute_fit_input_hash,
    compute_jd_requirements_fingerprint,
    compute_memory_fingerprint,
)
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)

router = APIRouter()


class FitScoreResponse(BaseModel):
    score: int
    fit_level: Literal["strong", "moderate", "weak"]
    strengths: list[str]
    gaps: list[str]
    recommendation: str


class CreateJDRequest(BaseModel):
    raw_text: str


class JDResponse(BaseModel):
    id: uuid.UUID
    raw_text: str
    company_name: str | None
    role_title: str | None
    labels: dict | None
    parsed_requirements: dict | None
    company_research: str | None
    company_research_status: Literal["pending", "ready", "unavailable"] = "unavailable"
    fit_score: FitScoreResponse | None = None

    model_config = {"from_attributes": True}


def _jd_to_response(jd) -> JDResponse:
    fit_data = None
    if jd.fit_score_cache:
        cache = {k: v for k, v in jd.fit_score_cache.items() if k not in ("input_hash", "computed_at")}
        if "score" in cache:
            fit_data = FitScoreResponse(**cache)
    return JDResponse(
        id=jd.id,
        raw_text=jd.raw_text,
        company_name=jd.company_name,
        role_title=jd.role_title,
        labels=jd.labels,
        parsed_requirements=jd.parsed_requirements,
        company_research=jd.company_research,
        company_research_status=JDService.company_research_status(jd),
        fit_score=fit_data,
    )


@router.post("/api/jds", response_model=JDResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def create_jd(
    request: Request,
    body: CreateJDRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    jd = await service.create_jd(clerk_user_id=clerk_user_id, raw_text=body.raw_text)
    return _jd_to_response(jd)


@router.get("/api/jds", response_model=list[JDResponse])
async def list_jds(
    tag: Optional[str] = Query(None, description="Filter JDs by tag (e.g. ?tag=Python)"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    jds = await service.list_jds(clerk_user_id, tag=tag)
    return [_jd_to_response(jd) for jd in jds]


@router.get("/api/jds/{jd_id}", response_model=JDResponse)
async def get_jd(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    jd = await service.get_jd(clerk_user_id, jd_id)

    # Validate fit score cache hash so stale scores are never served.
    if jd.fit_score_cache and jd.fit_score_cache.get("input_hash"):
        profile = await get_profile_or_404(db, clerk_user_id)
        memories = (
            await db.execute(
                select(Memory)
                .filter(Memory.user_id == profile.id)
                .order_by(Memory.created_at.desc())
                .limit(30)
            )
        ).scalars().all()
        current_hash = compute_fit_input_hash(
            compute_jd_requirements_fingerprint(jd.parsed_requirements, jd.labels),
            compute_memory_fingerprint(memories),
        )
        if jd.fit_score_cache["input_hash"] != current_hash:
            logger.info("fit_score cache_stale for jd_id=%s — omitting from response", jd_id)
            jd.fit_score_cache = None
        else:
            logger.info("fit_score cache_hit for jd_id=%s", jd_id)

    return _jd_to_response(jd)


class SimilarJDResponse(BaseModel):
    jd_id: uuid.UUID
    company_name: str | None
    role_title: str | None
    match_count: int
    tags: list[str]
    conversation_id: uuid.UUID | None


class JDConversationResponse(BaseModel):
    conversation_id: uuid.UUID | None


@router.get("/api/jds/{jd_id}/similar", response_model=list[SimilarJDResponse])
async def get_similar_jds(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    jd_service = JDService(db=db, ai=ai)
    jd = await jd_service.get_jd(clerk_user_id, jd_id)
    profile = await get_profile_or_404(db, clerk_user_id)

    similar = await JDSimilarityService(db=db, ai=ai).find_similar(jd, profile.id)

    results = []
    for r in similar:
        conv = (
            await db.execute(
                select(Conversation.id).filter_by(user_id=profile.id, jd_id=r.jd.id).limit(1)
            )
        ).scalar_one_or_none()
        labels = r.jd.labels or {}
        tags: list[str] = labels.get("tags", [])
        results.append(
            SimilarJDResponse(
                jd_id=r.jd.id,
                company_name=r.jd.company_name,
                role_title=r.jd.role_title,
                match_count=r.match_count,
                tags=tags,
                conversation_id=conv,
            )
        )
    return results


@router.get("/api/jds/{jd_id}/conversation", response_model=JDConversationResponse)
async def get_jd_conversation(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(db, clerk_user_id)
    conv_id = (
        await db.execute(
            select(Conversation.id).filter_by(user_id=profile.id, jd_id=jd_id).limit(1)
        )
    ).scalar_one_or_none()
    return JDConversationResponse(conversation_id=conv_id)


@router.get("/api/jds/{jd_id}/fit-score", response_model=FitScoreResponse)
@limiter.limit("30/hour")
async def get_fit_score(
    request: Request,
    jd_id: uuid.UUID,
    refresh: bool = Query(False, description="Force recompute even if cache is valid"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    """
    Returns fit score for the JD, using cache when inputs are unchanged.
    Pass refresh=true to force an LLM recomputation.
    """
    result = await FitScoreService(db=db, ai=ai).get_or_compute(
        clerk_user_id, jd_id, refresh=refresh
    )
    return FitScoreResponse(**result)
