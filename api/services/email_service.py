"""
Thin Resend wrapper for transactional email.

Requires:
  RESEND_API_KEY   — Resend secret key
  RESEND_FROM_EMAIL — verified sender, e.g. "APRise <noreply@yourdomain.com>"
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class EmailServiceError(Exception):
    pass


class EmailService:
    def __init__(self) -> None:
        self._api_key = os.environ.get("RESEND_API_KEY", "")
        self._from_email = os.environ.get("RESEND_FROM_EMAIL", "APRise <noreply@aprise.app>")

    def _available(self) -> bool:
        return bool(self._api_key)

    async def send(self, *, to: str, subject: str, text: str) -> None:
        """
        Sends a plain-text transactional email via Resend.
        Raises EmailServiceError on failure.
        """
        if not self._available():
            raise EmailServiceError("RESEND_API_KEY is not configured.")

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": self._from_email,
                    "to": [to],
                    "subject": subject,
                    "text": text,
                },
            )

        if not response.is_success:
            logger.error(
                "Resend API error %s: %s", response.status_code, response.text
            )
            raise EmailServiceError(
                f"Resend returned {response.status_code}: {response.text}"
            )

        logger.info("Email sent to %s — %r", to, subject)
