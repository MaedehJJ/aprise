"""
Stale-application reminder service.

Called exclusively from the cron route — never from request handlers.

Flow:
  1. Load all profiles with email_reminders === true.
  2. For each profile, find applications in (applied, screening) whose
     updated_at is older than profile.preferences.reminder_days.
  3. Skip applications already reminded within 7 days.
  4. Resolve the user's verified email via Clerk Backend API.
  5. Send one reminder email per stale application via Resend.
  6. Stamp last_reminder_sent_at = now().

Dry-run mode (REMINDER_DRY_RUN=true or dry_run=True arg):
  Logs what would be sent but skips email + timestamp update.
"""
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Application, ApplicationStatus, Profile
from services.email_service import EmailService, EmailServiceError

logger = logging.getLogger(__name__)

REPEAT_REMINDER_DAYS = 7  # minimum days between reminders for the same application
CLERK_API_BASE = "https://api.clerk.com/v1"


class ReminderService:
    def __init__(self, db: AsyncSession, dry_run: bool = False) -> None:
        self.db = db
        self._email = EmailService()
        self._dry_run = dry_run or os.environ.get("REMINDER_DRY_RUN", "").lower() in ("1", "true")
        self._clerk_secret = os.environ.get("CLERK_SECRET_KEY", "")

    async def run(self) -> dict:
        """
        Main entry point for the cron job.
        Returns a summary dict suitable for the HTTP response body.
        """
        now = datetime.now(timezone.utc)
        sent = 0
        skipped_prefs = 0
        skipped_dedup = 0
        errors = 0

        profiles: list[Profile] = (
            await self.db.execute(select(Profile))
        ).scalars().all()

        for profile in profiles:
            prefs = profile.preferences or {}
            if not prefs.get("email_reminders"):
                skipped_prefs += 1
                continue

            reminder_days = int(prefs.get("reminder_days", 7))
            reminder_days = max(3, min(30, reminder_days))
            stale_cutoff = now - timedelta(days=reminder_days)
            dedup_cutoff = now - timedelta(days=REPEAT_REMINDER_DAYS)

            stale_apps: list[Application] = (
                await self.db.execute(
                    select(Application).filter(
                        Application.user_id == profile.id,
                        Application.status.in_([
                            ApplicationStatus.APPLIED,
                            ApplicationStatus.SCREENING,
                        ]),
                        Application.updated_at < stale_cutoff,
                    )
                )
            ).scalars().all()

            if not stale_apps:
                continue

            # Resolve user email once per profile
            email_address = await self._resolve_clerk_email(profile.clerk_user_id)
            if not email_address:
                logger.warning(
                    "Could not resolve email for clerk_user_id=%s — skipping",
                    profile.clerk_user_id,
                )
                errors += 1
                continue

            for app in stale_apps:
                # Dedup: skip if already reminded within REPEAT_REMINDER_DAYS
                if (
                    app.last_reminder_sent_at is not None
                    and app.last_reminder_sent_at > dedup_cutoff
                ):
                    skipped_dedup += 1
                    continue

                company = app.company_name or "the company"
                role = app.role_title or "the role"
                subject = f"Follow up on your {role} application at {company}?"
                body = (
                    f"Hi {profile.name},\n\n"
                    f"Your application for {role} at {company} has been sitting "
                    f"in '{app.status.value}' for {reminder_days}+ days.\n\n"
                    f"It might be a good time to follow up with the recruiter.\n\n"
                    f"View your applications: https://aprise.app/app/applications\n\n"
                    f"— The Aprise team\n\n"
                    f"To stop these reminders, go to Settings and disable email reminders."
                )

                if self._dry_run:
                    logger.info(
                        "[DRY RUN] Would send reminder to %s for app_id=%s (%s @ %s)",
                        email_address, app.id, role, company,
                    )
                    sent += 1
                    continue

                try:
                    await self._email.send(to=email_address, subject=subject, text=body)
                    app.last_reminder_sent_at = now
                    sent += 1
                except EmailServiceError as exc:
                    logger.error(
                        "Failed to send reminder for app_id=%s: %s", app.id, exc
                    )
                    errors += 1

        if not self._dry_run:
            await self.db.commit()

        summary = {
            "dry_run": self._dry_run,
            "sent": sent,
            "skipped_prefs_off": skipped_prefs,
            "skipped_dedup": skipped_dedup,
            "errors": errors,
        }
        logger.info("Reminder run complete: %s", summary)
        return summary

    async def _resolve_clerk_email(self, clerk_user_id: str) -> str | None:
        """
        Fetches the primary verified email for a Clerk user via the Backend API.
        Returns None on failure.
        """
        if not self._clerk_secret:
            logger.warning("CLERK_SECRET_KEY not set — cannot resolve user email")
            return None

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{CLERK_API_BASE}/users/{clerk_user_id}",
                    headers={"Authorization": f"Bearer {self._clerk_secret}"},
                )
            if not resp.is_success:
                logger.warning(
                    "Clerk user lookup failed for %s: %s", clerk_user_id, resp.status_code
                )
                return None

            data = resp.json()
            primary_id = data.get("primary_email_address_id")
            for ea in data.get("email_addresses", []):
                if ea.get("id") == primary_id and ea.get("verification", {}).get("status") == "verified":
                    return ea["email_address"]
            # Fallback: first verified email
            for ea in data.get("email_addresses", []):
                if ea.get("verification", {}).get("status") == "verified":
                    return ea["email_address"]
            return None
        except Exception as exc:
            logger.error("Clerk email resolution error for %s: %s", clerk_user_id, exc)
            return None
