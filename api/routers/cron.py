"""
Cron routes — protected by CRON_SECRET, not Clerk JWT.

Vercel invokes these automatically on schedule (see vercel.json "crons").
They can also be triggered manually for testing:

  curl -H "Authorization: Bearer $CRON_SECRET" \
       https://your-deployment.vercel.app/api/cron/stale-applications?dry_run=1
"""
import logging
import os

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import JSONResponse

from db.neon import get_db
from services.reminder_service import ReminderService

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_cron_secret(request: Request) -> None:
    secret = os.environ.get("CRON_SECRET", "")
    if not secret:
        logger.error("CRON_SECRET is not set — rejecting cron request to prevent unauthenticated access")
        raise _unauthorized()
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {secret}":
        raise _unauthorized()


def _unauthorized():
    from fastapi import HTTPException, status
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.get("/api/cron/stale-applications")
async def cron_stale_applications(
    request: Request,
    dry_run: bool = Query(False, description="Log would-send rows without actually sending"),
    db: AsyncSession = Depends(get_db),
):
    _verify_cron_secret(request)

    service = ReminderService(db=db, dry_run=dry_run)
    summary = await service.run()
    return JSONResponse(content=summary)
