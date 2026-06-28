import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

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


@router.get(
    "/api/profiles/me",
    response_model=ProfileResponse,
)
async def get_my_profile(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the current user's profile, or 404 if they haven't completed
    onboarding yet. The frontend uses this 404 as the signal to redirect
    into the onboarding flow.
    """
    service = ProfileService(db)
    profile = await service.get_by_clerk_id(clerk_user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


@router.post(
    "/api/profiles",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_profile(
    body: CreateProfileRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProfileService(db)
    profile, created = await service.create_or_get_profile(
        clerk_user_id=clerk_user_id,
        name=body.name,
        target_roles=body.target_roles,
        preferred_company_size=body.preferred_company_size,
        years_experience=body.years_experience,
    )
    return profile
