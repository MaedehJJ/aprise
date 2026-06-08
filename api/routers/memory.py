from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from db.neon import get_db
from routers.auth import get_current_user
from services.memory_service import MemoryService

router = APIRouter()


@router.post("/api/memories/ingest")
async def ingest_cv(
    file: UploadFile = File(...),
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Step 1 — validate file type and size before reading bytes
    file_bytes = await file.read()
    MemoryService.validate_upload(
        content_type=file.content_type,
        filename=file.filename or "",
        size=len(file_bytes),
    )

    # Step 2 — extract text from PDF
    raw_text = MemoryService.extract_text_from_pdf(file_bytes)

    # Step 3 — sanitize
    clean_text = MemoryService.sanitize(raw_text)

    # Step 4 — injection scan
    MemoryService.scan_for_injection(clean_text)

    # Step 5 — your task: LLM extraction → embedding → storage
    # service = MemoryService(db)
    # chunks = service.extract_chunks(clean_text)
    # memories = service.embed_and_store(profile_id, chunks)
    # return {"memories_created": len(memories)}

    # Placeholder until step 5 is implemented
    return {"status": "sanitized", "char_count": len(clean_text)}
