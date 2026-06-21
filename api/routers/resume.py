import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from db.neon import get_db
from routers._limiter import limiter
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.resume_service import ResumeService

logger = logging.getLogger(__name__)
router = APIRouter()


class ExperienceEntryResponse(BaseModel):
    company: str
    role: str
    dates: str
    bullets: list[str]


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    jd_id: uuid.UUID
    content: dict | None = None
    labels: dict | None = None
    is_generated: bool
    created_at: datetime


@router.post("/api/jds/{jd_id}/resume", response_model=ResumeResponse, status_code=201)
@limiter.limit("10/hour")
def generate_resume(
    request: Request,
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    """
    Generates a tailored resume for the given JD.

    Pre-conditions:
      - A coaching conversation must exist for this JD.
      - The user must have memories ingested (CV upload).

    Post-effects:
      - Persists a new Resume row with structured content and retrieval tags.
      - Writes the generated tags back onto JD.labels for future similarity search.
    """
    service = ResumeService(db=db, ai=ai)
    resume = service.generate_resume(jd_id=jd_id, clerk_user_id=clerk_user_id)
    return resume


@router.get("/api/jds/{jd_id}/resumes", response_model=list[ResumeResponse])
def list_resumes(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ResumeService(db=db, ai=ai)
    return service.list_resumes(jd_id=jd_id, clerk_user_id=clerk_user_id)


@router.get("/api/resumes/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = ResumeService(db=db, ai=ai)
    return service.get_resume(resume_id=resume_id, clerk_user_id=clerk_user_id)
