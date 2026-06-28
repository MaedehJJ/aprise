import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from db.neon import get_db
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.star_service import StarService

logger = logging.getLogger(__name__)
router = APIRouter()


class StarStoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    jd_id: uuid.UUID | None = None
    title: str
    situation: str
    task_action: str
    result: str
    skills: list[str]
    created_at: datetime


@router.get("/api/stars", response_model=list[StarStoryResponse])
async def list_star_stories(
    jd_id: uuid.UUID | None = None,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    """List all STAR stories for the current user, optionally filtered by JD."""
    service = StarService(db=db, ai=ai)
    return await service.list_stories(clerk_user_id=clerk_user_id, jd_id=jd_id)


@router.get("/api/stars/{story_id}", response_model=StarStoryResponse)
async def get_star_story(
    story_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = StarService(db=db, ai=ai)
    return await service.get_story(story_id=story_id, clerk_user_id=clerk_user_id)


@router.delete("/api/stars/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_star_story(
    story_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = StarService(db=db, ai=ai)
    await service.delete_story(story_id=story_id, clerk_user_id=clerk_user_id)
