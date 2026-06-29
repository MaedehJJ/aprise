import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from db.models import Application, ApplicationStatus, Conversation, JD, Profile, Resume
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)


class ApplicationService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_application(
        self,
        clerk_user_id: str,
        jd_id: uuid.UUID,
        resume_id: uuid.UUID | None = None,
    ) -> Application:
        """
        Creates an application for a JD, optionally linking a resume.
        Copies company_name and role_title from the JD for denormalized display.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd = await self._get_jd(jd_id, profile.id)

        if resume_id:
            await self._assert_resume_ownership(resume_id, profile.id)

        # Prevent duplicate applications for the same JD.
        existing = (
            await self.db.execute(
                select(Application).filter_by(user_id=profile.id, jd_id=jd_id)
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An application for this JD already exists.",
            )

        application = Application(
            user_id=profile.id,
            jd_id=jd_id,
            resume_id=resume_id,
            status=ApplicationStatus.APPLIED,
            company_name=jd.company_name,
            role_title=jd.role_title,
        )
        self.db.add(application)
        await self.db.commit()
        await self.db.refresh(application)
        logger.info("Created application %s for user %s jd %s", application.id, profile.id, jd_id)
        return application

    async def list_applications(self, clerk_user_id: str) -> list[Application]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        apps = (
            await self.db.execute(
                select(Application)
                .filter_by(user_id=profile.id)
                .options(joinedload(Application.resume))
                .order_by(Application.updated_at.desc())
            )
        ).scalars().unique().all()
        return apps

    async def conversation_ids_for_applications(
        self, clerk_user_id: str, applications: list[Application]
    ) -> dict[uuid.UUID, uuid.UUID]:
        """Map jd_id → conversation_id for the given applications."""
        if not applications:
            return {}
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd_ids = [a.jd_id for a in applications]
        rows = (
            await self.db.execute(
                select(Conversation.jd_id, Conversation.id).where(
                    Conversation.user_id == profile.id,
                    Conversation.jd_id.in_(jd_ids),
                )
            )
        ).all()
        return {jd_id: conv_id for jd_id, conv_id in rows}

    async def conversation_id_for_application(
        self, clerk_user_id: str, application: Application
    ) -> uuid.UUID | None:
        mapping = await self.conversation_ids_for_applications(clerk_user_id, [application])
        return mapping.get(application.jd_id)

    async def get_application(self, application_id: uuid.UUID, clerk_user_id: str) -> Application:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        app = (
            await self.db.execute(
                select(Application)
                .filter_by(id=application_id, user_id=profile.id)
                .options(joinedload(Application.resume))
            )
        ).scalars().unique().one_or_none()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Application not found."
            )
        return app

    async def update_application(
        self,
        application_id: uuid.UUID,
        clerk_user_id: str,
        new_status: ApplicationStatus | None = None,
        notes: str | None = None,
    ) -> Application:
        app = await self.get_application(application_id, clerk_user_id)

        if new_status is not None:
            logger.info(
                "Application %s status %s → %s", app.id, app.status.value, new_status.value
            )
            app.status = new_status

        if notes is not None:
            app.notes = notes

        await self.db.commit()
        await self.db.refresh(app)
        return app

    async def delete_application(self, application_id: uuid.UUID, clerk_user_id: str) -> None:
        app = await self.get_application(application_id, clerk_user_id)
        await self.db.delete(app)
        await self.db.commit()
        logger.info("Deleted application %s", application_id)

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_jd(self, jd_id: uuid.UUID, profile_id: uuid.UUID) -> JD:
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile_id))
        ).scalar_one_or_none()
        if not jd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="JD not found."
            )
        return jd

    async def _assert_resume_ownership(self, resume_id: uuid.UUID, profile_id: uuid.UUID) -> None:
        resume = (
            await self.db.execute(select(Resume).filter_by(id=resume_id, user_id=profile_id))
        ).scalar_one_or_none()
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found or does not belong to this user.",
            )
