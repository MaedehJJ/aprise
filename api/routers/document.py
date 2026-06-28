import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Document, DocumentKind
from db.neon import get_db
from routers.auth import get_current_user
from services.utils import get_profile_or_404

router = APIRouter()


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    kind: DocumentKind
    memories_extracted: int
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/documents", response_model=list[DocumentResponse])
async def list_documents(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(db, clerk_user_id)
    docs = (
        await db.execute(
            select(Document)
            .filter_by(user_id=profile.id)
            .order_by(Document.created_at.desc())
        )
    ).scalars().all()
    return [DocumentResponse.model_validate(d) for d in docs]
