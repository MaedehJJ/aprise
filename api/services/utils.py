import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from db.models import Profile

logger = logging.getLogger(__name__)


def get_profile_or_404(db: Session, clerk_user_id: str) -> Profile:
    """Fetches the Profile for a Clerk user or raises HTTP 404."""
    profile = db.query(Profile).filter_by(clerk_user_id=clerk_user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found."
        )
    return profile
