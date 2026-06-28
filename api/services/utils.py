import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Profile

logger = logging.getLogger(__name__)


async def get_profile_or_404(db: AsyncSession, clerk_user_id: str) -> Profile:
    """Fetches the Profile for a Clerk user or raises HTTP 404."""
    profile = (
        await db.execute(select(Profile).filter_by(clerk_user_id=clerk_user_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found."
        )
    return profile
