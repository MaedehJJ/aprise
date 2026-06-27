import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.neon import get_db
from routers._limiter import limiter
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.jd_service import JDService

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

    model_config = {"from_attributes": True}


@router.post("/api/jds", response_model=JDResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
def create_jd(
    request: Request,
    body: CreateJDRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    jd = service.create_jd(clerk_user_id=clerk_user_id, raw_text=body.raw_text)
    return jd


@router.get("/api/jds", response_model=list[JDResponse])
def list_jds(
    tag: Optional[str] = Query(None, description="Filter JDs by tag (e.g. ?tag=Python)"),
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    return service.list_jds(clerk_user_id, tag=tag)


@router.get("/api/jds/{jd_id}", response_model=JDResponse)
def get_jd(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    return service.get_jd(clerk_user_id, jd_id)


@router.get("/api/jds/{jd_id}/fit-score", response_model=FitScoreResponse)
@limiter.limit("30/hour")
def get_fit_score(
    request: Request,
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    """
    Computes a 0-100 fit score between the JD and the user's background memories.
    Returns strengths, gaps, and a strategic recommendation.
    """
    from db.models import JD, Memory
    from services.utils import get_profile_or_404
    from prompts import fit_score_prompt

    profile = get_profile_or_404(db, clerk_user_id)
    jd = db.query(JD).filter_by(id=jd_id, user_id=profile.id).first()
    if not jd:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JD not found.")

    # Load all user memories (not just top-k — the fit scorer needs the full picture).
    memories = (
        db.query(Memory)
        .filter(Memory.user_id == profile.id)
        .order_by(Memory.created_at.desc())
        .limit(30)
        .all()
    )
    user_memories_text = (
        "\n\n".join(f"[{m.chunk_type.value}] {m.content}" for m in memories)
        if memories
        else "No background information available."
    )

    requirements = jd.parsed_requirements or {}
    labels = jd.labels or {}

    result = ai.structured(
        fit_score_prompt,
        langsmith_extra={"jd_id": str(jd_id), "step": "fit_score"},
        company=jd.company_name or "the company",
        role=jd.role_title or "this role",
        company_size=labels.get("company_size", "unknown"),
        role_focus=labels.get("role_focus", "unknown"),
        tech_depth=labels.get("tech_depth", "unknown"),
        domain=labels.get("domain", "unknown"),
        required_skills=", ".join(requirements.get("required_skills", [])) or "Not specified",
        nice_to_have=", ".join(requirements.get("nice_to_have", [])) or "None",
        years_required=str(requirements.get("years_required") or "Not specified"),
        responsibilities="\n- " + "\n- ".join(requirements.get("responsibilities", [])) if requirements.get("responsibilities") else "Not specified",
        user_memories=user_memories_text,
    )
    return result
