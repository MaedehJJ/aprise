import uuid
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.models import CompanySize
from db.neon import get_db
from routers.auth import get_current_user
from services.profile_service import ProfileService

router = APIRouter()


class CreateProfileRequest(BaseModel):
    name: str
    target_roles: list[str]
    preferred_company_size: CompanySize | None = None
    years_experience: int | None = None


class ProfileResponse(BaseModel):
    id: uuid.UUID
    clerk_user_id: str
    name: str
    target_roles: list[str]
    preferred_company_size: CompanySize | None
    years_experience: int | None

    model_config = {"from_attributes": True}


@router.post(
    "/api/profiles",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    body: CreateProfileRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ProfileService(db)
    profile, created = service.create_or_get_profile(
        clerk_user_id=clerk_user_id,
        name=body.name,
        target_roles=body.target_roles,
        preferred_company_size=body.preferred_company_size,
        years_experience=body.years_experience,
    )
    return profile
