import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Application, ApplicationStatus
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
    conversation_id: uuid.UUID | None = None


def _application_response(
    app: Application, conversation_id: uuid.UUID | None = None
) -> ApplicationResponse:
    data = ApplicationResponse.model_validate(app)
    data.conversation_id = conversation_id
    return data


@router.post("/api/applications", response_model=ApplicationResponse, status_code=201)
async def create_application(
    body: CreateApplicationInput,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ApplicationService(db=db)
    app = await service.create_application(
        clerk_user_id=clerk_user_id,
        jd_id=body.jd_id,
        resume_id=body.resume_id,
    )
    conv_id = await service.conversation_id_for_application(clerk_user_id, app)
    return _application_response(app, conv_id)


@router.get("/api/applications", response_model=list[ApplicationResponse])
async def list_applications(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ApplicationService(db=db)
    apps = await service.list_applications(clerk_user_id=clerk_user_id)
    conv_map = await service.conversation_ids_for_applications(clerk_user_id, apps)
    return [_application_response(a, conv_map.get(a.jd_id)) for a in apps]


@router.get("/api/applications/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ApplicationService(db=db)
    app = await service.get_application(
        application_id=application_id, clerk_user_id=clerk_user_id
    )
    conv_id = await service.conversation_id_for_application(clerk_user_id, app)
    return _application_response(app, conv_id)


@router.patch("/api/applications/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: uuid.UUID,
    body: UpdateApplicationInput,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ApplicationService(db=db)
    app = await service.update_application(
        application_id=application_id,
        clerk_user_id=clerk_user_id,
        new_status=body.status,
        notes=body.notes,
    )
    conv_id = await service.conversation_id_for_application(clerk_user_id, app)
    return _application_response(app, conv_id)


@router.delete("/api/applications/{application_id}", status_code=204)
async def delete_application(
    application_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ApplicationService(db=db)
    await service.delete_application(
        application_id=application_id, clerk_user_id=clerk_user_id
    )
