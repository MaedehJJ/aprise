from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from db.neon import get_db
from routers.auth import get_current_user
from services.ai_service import AIService
from services.memory_service import MemoryService

router = APIRouter()


@router.post("/api/memories/ingest")
async def ingest_cv(
    file: UploadFile = File(...),
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    service = MemoryService(db=db, ai=AIService())
    clean_text = service.process_upload(
        file_bytes=file_bytes,
        content_type=file.content_type or "",
        filename=file.filename or "",
    )
    chunks = service.extract_chunks(clean_text)
    memories = service.embed_and_store(clerk_user_id, chunks)
    return {"memories_created": len(memories)}
