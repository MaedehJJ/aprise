import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from db.models import ApplicationStatus
from db.neon import get_db
from routers.auth import get_current_user
from services.application_service import ApplicationService

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateApplicationInput(BaseModel):
    jd_id: uuid.UUID
    resume_id: uuid.UUID | None = None


class UpdateApplicationInput(BaseModel):
    status: ApplicationStatus | None = None
    notes: str | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    jd_id: uuid.UUID
    resume_id: uuid.UUID | None
    status: ApplicationStatus
    company_name: str | None
    role_title: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


@router.post("/api/applications", response_model=ApplicationResponse, status_code=201)
def create_application(
    body: CreateApplicationInput,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ApplicationService(db=db)
    return service.create_application(
        clerk_user_id=clerk_user_id,
        jd_id=body.jd_id,
        resume_id=body.resume_id,
    )


@router.get("/api/applications", response_model=list[ApplicationResponse])
def list_applications(
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ApplicationService(db=db)
    return service.list_applications(clerk_user_id=clerk_user_id)


@router.get("/api/applications/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ApplicationService(db=db)
    return service.get_application(
        application_id=application_id, clerk_user_id=clerk_user_id
    )


@router.patch("/api/applications/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: uuid.UUID,
    body: UpdateApplicationInput,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ApplicationService(db=db)
    return service.update_application(
        application_id=application_id,
        clerk_user_id=clerk_user_id,
        new_status=body.status,
        notes=body.notes,
    )


@router.delete("/api/applications/{application_id}", status_code=204)
def delete_application(
    application_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ApplicationService(db=db)
    service.delete_application(
        application_id=application_id, clerk_user_id=clerk_user_id
    )
