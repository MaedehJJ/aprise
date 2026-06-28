import io
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.neon import get_db
from routers._limiter import limiter
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.cover_letter_service import CoverLetterService

logger = logging.getLogger(__name__)
router = APIRouter()


class CoverLetterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    jd_id: uuid.UUID
    content: dict | None = None
    labels: dict | None = None
    is_generated: bool
    created_at: datetime


@router.post("/api/jds/{jd_id}/cover-letter", response_model=CoverLetterResponse, status_code=201)
@limiter.limit("10/hour")
async def generate_cover_letter(
    request: Request,
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    """
    Generates a tailored cover letter for the given JD.
    Requires a coaching conversation to exist (same pre-condition as resume generation).
    """
    service = CoverLetterService(db=db, ai=ai)
    return await service.generate(jd_id=jd_id, clerk_user_id=clerk_user_id)


@router.get("/api/jds/{jd_id}/cover-letters", response_model=list[CoverLetterResponse])
async def list_cover_letters(
    jd_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = CoverLetterService(db=db, ai=ai)
    return await service.list_cover_letters(jd_id=jd_id, clerk_user_id=clerk_user_id)


@router.get("/api/cover-letters/{cover_letter_id}", response_model=CoverLetterResponse)
async def get_cover_letter(
    cover_letter_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = CoverLetterService(db=db, ai=ai)
    return await service.get(cover_letter_id=cover_letter_id, clerk_user_id=clerk_user_id)


@router.get("/api/cover-letters/{cover_letter_id}/pdf")
async def download_cover_letter_pdf(
    cover_letter_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    """Generate and stream a formatted PDF for the given cover letter."""
    from db.models import CoverLetter as CoverLetterModel
    from services.utils import get_profile_or_404

    profile = await get_profile_or_404(db, clerk_user_id)
    cl = (
        await db.execute(
            select(CoverLetterModel)
            .options(selectinload(CoverLetterModel.jd))
            .filter_by(id=cover_letter_id, user_id=profile.id)
        )
    ).scalars().unique().one_or_none()
    if not cl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover letter not found.")
    if not cl.content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cover letter has no generated content yet.",
        )

    pdf_bytes = _build_cover_letter_pdf(cl)
    filename = f"cover-letter-{cover_letter_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_cover_letter_pdf(cl) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=inch,
        rightMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )

    styles = getSampleStyleSheet()
    heading = ParagraphStyle("H", parent=styles["Heading1"], fontSize=16, leading=20,
                              textColor=colors.HexColor("#1a1a2e"), spaceAfter=4)
    sub = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, leading=13,
                          textColor=colors.HexColor("#6b7280"), spaceAfter=12)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10.5, leading=16,
                           textColor=colors.HexColor("#374151"), spaceAfter=10)

    jd = getattr(cl, "jd", None)
    company = (jd.company_name if jd else None) or "the Company"
    role = (jd.role_title if jd else None) or "the Role"

    content = cl.content or {}
    opening = content.get("opening_paragraph", "")
    body_paragraphs: list[str] = content.get("body_paragraphs", [])
    closing = content.get("closing_paragraph", "")

    story = []
    story.append(Paragraph("Cover Letter", heading))
    story.append(Paragraph(f"For: {role} at {company}", sub))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb")))
    story.append(Spacer(1, 8))

    if opening:
        story.append(Paragraph(opening, body))
    for para in body_paragraphs:
        story.append(Paragraph(para, body))
    if closing:
        story.append(Paragraph(closing, body))
    story.append(Spacer(1, 16))
    story.append(Paragraph("Sincerely,", body))

    doc.build(story)
    return buf.getvalue()
