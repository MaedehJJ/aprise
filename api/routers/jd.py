import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.neon import get_db
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.jd_service import JDService

router = APIRouter()


class CreateJDRequest(BaseModel):
    raw_text: str


class JDResponse(BaseModel):
    id: uuid.UUID
    raw_text: str
    company_name: str | None
    role_title: str | None
    labels: dict | None
    parsed_requirements: dict | None

    model_config = {"from_attributes": True}


@router.post("/api/jds", response_model=JDResponse, status_code=status.HTTP_201_CREATED)
def create_jd(
    body: CreateJDRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    # create_jd now parses AND embeds in one transaction — no separate embed_jd call needed.
    jd = service.create_jd(clerk_user_id=clerk_user_id, raw_text=body.raw_text)
    return jd


@router.get("/api/jds", response_model=list[JDResponse])
def list_jds(
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    return service.list_jds(clerk_user_id)


@router.get("/api/jds/{jd_id}", response_model=JDResponse)
def get_jd(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = JDService(db=db, ai=ai)
    return service.get_jd(clerk_user_id, jd_id)
