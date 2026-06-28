from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CompanySize, Profile


class ProfileService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_clerk_id(self, clerk_user_id: str) -> Profile | None:
        return (
            await self.db.execute(
                select(Profile).filter(Profile.clerk_user_id == clerk_user_id)
            )
        ).scalar_one_or_none()

    async def create_or_get_profile(
        self,
        clerk_user_id: str,
        name: str,
        target_roles: list[str],
        preferred_company_size: CompanySize | None,
        years_experience: int | None,
    ) -> tuple[Profile, bool]:
        """
        Returns (profile, created) where created=True if a new row was inserted.
        Idempotent: safe to call multiple times for the same user.
        """
        existing = (
            await self.db.execute(
                select(Profile).filter(Profile.clerk_user_id == clerk_user_id)
            )
        ).scalar_one_or_none()
        if existing:
            return existing, False

        profile = Profile(
            clerk_user_id=clerk_user_id,
            name=name,
            target_roles=target_roles,
            preferred_company_size=preferred_company_size,
            years_experience=years_experience,
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile, True
