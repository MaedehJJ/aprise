import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.models import ChunkType, DocumentKind
from db.neon import get_db
from routers._limiter import limiter
from routers.auth import get_current_user
from services.ai_service import AIService, get_ai_service
from services.memory_service import MemoryService

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Response schema ────────────────────────────────────────────────────────

class MemoryResponse(BaseModel):
    id: uuid.UUID
    content: str
    chunk_type: ChunkType
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── CV ingestion ───────────────────────────────────────────────────────────

@router.post("/api/memories/ingest")
@limiter.limit("10/hour")
async def ingest_cv(
    request: Request,
    file: UploadFile = File(...),
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    filename = file.filename or "unknown.pdf"
    logger.info("Ingest request: file='%s' user='%s'", filename, clerk_user_id)

    file_bytes = await file.read()
    service = MemoryService(db=db, ai=ai)

    clean_text = service.process_upload(
        file_bytes=file_bytes,
        content_type=file.content_type or "",
        filename=filename,
    )
    chunks = service.extract_chunks(clean_text)

    kind = (
        DocumentKind.LINKEDIN
        if "linkedin" in filename.lower()
        else DocumentKind.RESUME
    )

    # embed_and_store commits memories AND the Document in one transaction.
    memories = service.embed_and_store(
        clerk_user_id,
        chunks,
        filename=filename,
        document_kind=kind,
    )

    return {"memories_created": len(memories)}


# ── List ───────────────────────────────────────────────────────────────────

@router.get("/api/memories", response_model=list[MemoryResponse])
def list_memories(
    chunk_type: ChunkType | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = MemoryService(db=db, ai=ai)
    memories = service.list_memories(
        clerk_user_id, chunk_type=chunk_type, limit=limit, offset=offset
    )
    return [MemoryResponse.model_validate(m) for m in memories]


# ── Semantic search ────────────────────────────────────────────────────────

@router.get("/api/memories/search", response_model=list[MemoryResponse])
def search_memories(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=8, ge=1, le=20),
    chunk_type: ChunkType | None = Query(default=None),
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = MemoryService(db=db, ai=ai)
    memories = service.search_memories(
        clerk_user_id, query=q, limit=limit, chunk_type=chunk_type
    )
    return [MemoryResponse.model_validate(m) for m in memories]


# ── Manual add ────────────────────────────────────────────────────────────

class AddMemoryRequest(BaseModel):
    content: str
    chunk_type: ChunkType


@router.post("/api/memories", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
def add_memory(
    body: AddMemoryRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = MemoryService(db=db, ai=ai)
    memory = service.add_memory(clerk_user_id, content=body.content, chunk_type=body.chunk_type)
    return MemoryResponse.model_validate(memory)


# ── Update ────────────────────────────────────────────────────────────────

class UpdateMemoryRequest(BaseModel):
    content: str


@router.patch("/api/memories/{memory_id}", response_model=MemoryResponse)
def update_memory(
    memory_id: uuid.UUID,
    body: UpdateMemoryRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = MemoryService(db=db, ai=ai)
    memory = service.update_memory(memory_id, clerk_user_id, content=body.content)
    return MemoryResponse.model_validate(memory)


# ── Delete ────────────────────────────────────────────────────────────────

@router.delete("/api/memories/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memory_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai_service),
):
    service = MemoryService(db=db, ai=ai)
    service.delete_memory(memory_id, clerk_user_id)
