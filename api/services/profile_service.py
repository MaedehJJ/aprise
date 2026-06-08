from sqlalchemy.orm import Session

from db.models import CompanySize, Profile


class ProfileService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_or_get_profile(
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
            self.db.query(Profile)
            .filter(Profile.clerk_user_id == clerk_user_id)
            .first()
        )
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
        self.db.commit()
        self.db.refresh(profile)
        return profile, True