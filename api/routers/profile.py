import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CompanySize, Conversation, ConversationMessage, JD, Profile, Resume
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
    preferences: dict = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class UpdatePreferencesRequest(BaseModel):
    preferences: dict


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    target_roles: list[str] | None = None
    preferred_company_size: CompanySize | None = None
    years_experience: int | None = None


class ProfileUsageResponse(BaseModel):
    jds_this_month: int
    resumes_this_month: int
    coaching_messages_this_month: int


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get(
    "/api/profiles/me",
    response_model=ProfileResponse,
)
async def get_my_profile(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    profile, _created = await service.create_or_get_profile(
        clerk_user_id=clerk_user_id,
        name=body.name,
        target_roles=body.target_roles,
        preferred_company_size=body.preferred_company_size,
        years_experience=body.years_experience,
    )
    return profile


@router.patch("/api/profiles/me", response_model=ProfileResponse)
async def update_my_profile(
    body: UpdateProfileRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProfileService(db)
    profile = await service.get_by_clerk_id(clerk_user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    if body.name is not None:
        profile.name = body.name
    if body.target_roles is not None:
        profile.target_roles = body.target_roles
    if body.preferred_company_size is not None:
        profile.preferred_company_size = body.preferred_company_size
    if body.years_experience is not None:
        profile.years_experience = body.years_experience
    await db.commit()
    await db.refresh(profile)
    return profile


@router.patch("/api/profiles/me/preferences", response_model=ProfileResponse)
async def update_preferences(
    body: UpdatePreferencesRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProfileService(db)
    profile = await service.get_by_clerk_id(clerk_user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    incoming = dict(body.preferences)
    # Clamp reminder_days to the accepted range
    if "reminder_days" in incoming:
        try:
            incoming["reminder_days"] = max(3, min(30, int(incoming["reminder_days"])))
        except (TypeError, ValueError):
            incoming["reminder_days"] = 7
    merged = {**(profile.preferences or {}), **incoming}
    profile.preferences = merged
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/api/profiles/me/usage", response_model=ProfileUsageResponse)
async def get_profile_usage(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProfileService(db)
    profile = await service.get_by_clerk_id(clerk_user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    since = _month_start()
    jds_count = (
        await db.execute(
            select(func.count()).select_from(JD).where(
                JD.user_id == profile.id,
                JD.created_at >= since,
            )
        )
    ).scalar_one()
    resumes_count = (
        await db.execute(
            select(func.count()).select_from(Resume).where(
                Resume.user_id == profile.id,
                Resume.created_at >= since,
            )
        )
    ).scalar_one()
    messages_count = (
        await db.execute(
            select(func.count())
            .select_from(ConversationMessage)
            .join(Conversation, ConversationMessage.conversation_id == Conversation.id)
            .where(
                Conversation.user_id == profile.id,
                ConversationMessage.created_at >= since,
            )
        )
    ).scalar_one()

    return ProfileUsageResponse(
        jds_this_month=jds_count,
        resumes_this_month=resumes_count,
        coaching_messages_this_month=messages_count,
    )
