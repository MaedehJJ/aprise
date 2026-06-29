import logging
import re
import unicodedata
import uuid
from io import BytesIO

from fastapi import HTTPException, status
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChunkType, Document, DocumentKind, Memory, Profile
from prompts import memory_extraction_prompt
from prompts.memory_extraction import MemoryCategory, MemoryChunk
from services.ai_service import AIService
from services.injection_defense_service import InjectionDefenseService, InjectionDetectedError
from services.score_cache_utils import content_hash as hash_content
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)

_CATEGORY_TO_CHUNK_TYPE: dict[MemoryCategory, ChunkType] = {
    MemoryCategory.EXPERIENCE: ChunkType.EXPERIENCE,
    MemoryCategory.EDUCATION: ChunkType.EDUCATION,
    MemoryCategory.SKILLS_SUMMARY: ChunkType.SKILLS_SUMMARY,
    MemoryCategory.PROJECTS: ChunkType.PROJECTS,
    MemoryCategory.LANGUAGES: ChunkType.LANGUAGES,
    MemoryCategory.OTHER: ChunkType.OTHER,
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_EXTRACTED_CHARS = 50_000
MAX_CHUNKS = 30


class MemoryService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    # ------------------------------------------------------------------
    # CV ingestion pipeline
    # ------------------------------------------------------------------

    @staticmethod
    def validate_upload(content_type: str, filename: str, size: int) -> None:
        if content_type != "application/pdf" or not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are accepted.",
            )
        if size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
            )

    @staticmethod
    def validate_pdf_magic_bytes(file_bytes: bytes, filename: str) -> None:
        """
        Checks the first 5 bytes of the file for the PDF magic signature (%PDF-).
        Both content-type and file extension are user-controlled, so a malicious
        actor can rename any file to .pdf and set the content-type header.
        The magic bytes check verifies the actual file format.
        """
        if not file_bytes[:5] == b"%PDF-":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{filename}' does not appear to be a valid PDF file.",
            )

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes, filename: str = "unknown.pdf") -> str:
        try:
            reader = PdfReader(BytesIO(file_bytes))
            text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            ).strip()
        except Exception as exc:
            logger.warning(
                "PDF extraction failed for '%s' (%d bytes): %s",
                filename, len(file_bytes), exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not read PDF. Make sure the file is not encrypted or corrupted.",
            )

        if not text:
            logger.warning("PDF '%s' yielded no text — possibly image-only.", filename)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract any text from the PDF. The file may be image-only.",
            )

        return text[:MAX_EXTRACTED_CHARS]

    @staticmethod
    def sanitize(text: str) -> str:
        text = re.sub(r"<[^>]+>", " ", text)
        text = unicodedata.normalize("NFKC", text)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def scan_for_injection(text: str) -> None:
        try:
            InjectionDefenseService.defend(text)
        except InjectionDetectedError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document content.",
            )

    def process_upload(self, file_bytes: bytes, content_type: str, filename: str) -> str:
        self.validate_upload(content_type=content_type, filename=filename, size=len(file_bytes))
        self.validate_pdf_magic_bytes(file_bytes, filename=filename)
        raw_text = self.extract_text_from_pdf(file_bytes, filename=filename)
        clean_text = self.sanitize(raw_text)
        self.scan_for_injection(clean_text)
        return clean_text

    def extract_chunks(self, resume_content: str) -> list[MemoryChunk]:
        result = self._ai.structured(memory_extraction_prompt, cv_text=resume_content)
        return result.chunks

    async def embed_and_store(
        self,
        clerk_user_id: str,
        chunks: list[MemoryChunk],
        filename: str,
        document_kind: DocumentKind,
    ) -> list[Memory]:
        """
        Embeds chunks and persists both Memory rows AND the Document record
        in a single transaction — either everything commits or nothing does.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)

        logger.info(
            "Embedding %d chunks from '%s' for user %s",
            len(chunks), filename, profile.id,
        )
        vectors = self._ai.embed_documents([chunk.content for chunk in chunks])

        memories = [
            Memory(
                user_id=profile.id,
                content=chunk.content,
                embedding=vector,
                chunk_type=_CATEGORY_TO_CHUNK_TYPE[chunk.category],
                content_hash=hash_content(chunk.content),
            )
            for chunk, vector in zip(chunks, vectors)
        ]

        document = Document(
            user_id=profile.id,
            filename=filename,
            kind=document_kind,
            memories_extracted=len(memories),
        )

        self.db.add_all(memories)
        self.db.add(document)
        await self.db.commit()

        logger.info(
            "Ingested %d memories from '%s' (doc_id=%s) for user %s",
            len(memories), filename, document.id, profile.id,
        )
        return memories

    # ------------------------------------------------------------------
    # Memory retrieval & management
    # ------------------------------------------------------------------

    async def list_memories(
        self,
        clerk_user_id: str,
        chunk_type: ChunkType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Memory]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        q = select(Memory).filter(Memory.user_id == profile.id)
        if chunk_type:
            q = q.filter(Memory.chunk_type == chunk_type)
        return (
            await self.db.execute(q.order_by(Memory.created_at.desc()).limit(limit).offset(offset))
        ).scalars().all()

    async def search_memories(
        self,
        clerk_user_id: str,
        query: str,
        limit: int = 8,
        chunk_type: ChunkType | None = None,
    ) -> list[Memory]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        query_vector = self._ai.embed(query)
        q = select(Memory).filter(Memory.user_id == profile.id)
        if chunk_type:
            q = q.filter(Memory.chunk_type == chunk_type)
        return (
            await self.db.execute(
                q.order_by(Memory.embedding.op("<=>")(query_vector)).limit(limit)
            )
        ).scalars().all()

    async def add_memory(
        self,
        clerk_user_id: str,
        content: str,
        chunk_type: ChunkType,
    ) -> Memory:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        vector = self._ai.embed(content)
        memory = Memory(
            user_id=profile.id,
            content=content,
            embedding=vector,
            chunk_type=chunk_type,
            content_hash=hash_content(content),
        )
        self.db.add(memory)
        await self.db.commit()
        await self.db.refresh(memory)
        return memory

    async def update_memory(
        self,
        memory_id: uuid.UUID,
        clerk_user_id: str,
        content: str,
    ) -> Memory:
        memory = await self._require_owned_memory(memory_id, clerk_user_id)
        new_hash = hash_content(content)
        if memory.content_hash != new_hash:
            memory.content = content
            memory.content_hash = new_hash
            memory.embedding = self._ai.embed(content)
        else:
            memory.content = content
        await self.db.commit()
        await self.db.refresh(memory)
        return memory

    async def delete_memory(self, memory_id: uuid.UUID, clerk_user_id: str) -> None:
        memory = await self._require_owned_memory(memory_id, clerk_user_id)
        await self.db.delete(memory)
        await self.db.commit()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    DUPLICATE_DISTANCE_THRESHOLD = 0.05

    # ------------------------------------------------------------------
    # LinkedIn / text ingest
    # ------------------------------------------------------------------

    MIN_TEXT_LENGTH = 200

    def process_text(self, raw_text: str) -> str:
        """Validate, sanitize, and injection-scan plain text for ingest."""
        if len(raw_text.strip()) < self.MIN_TEXT_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Text is too short. Please paste at least {self.MIN_TEXT_LENGTH} characters.",
            )
        clean = self.sanitize(raw_text[:MAX_EXTRACTED_CHARS])
        self.scan_for_injection(clean)
        return clean

    async def ingest_text(
        self,
        clerk_user_id: str,
        raw_text: str,
        source: DocumentKind,
    ) -> list[Memory]:
        """Ingest plain text (LinkedIn paste, etc.) through the same pipeline as PDF."""
        clean = self.process_text(raw_text)
        chunks = self.extract_chunks(clean)
        filename = (
            "linkedin-paste.txt" if source == DocumentKind.LINKEDIN else "text-paste.txt"
        )
        return await self.embed_and_store(
            clerk_user_id, chunks, filename=filename, document_kind=source
        )

    async def find_duplicate_pairs(
        self,
        clerk_user_id: str,
        cap: int = 500,
    ) -> list[dict]:
        """
        Returns near-duplicate memory pairs for the user (cosine distance < threshold).
        Pairs are deduplicated so (A,B) and (B,A) appear only once (min_id, max_id).
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)

        memories: list[Memory] = (
            await self.db.execute(
                select(Memory)
                .filter(Memory.user_id == profile.id)
                .order_by(Memory.created_at.desc())
                .limit(cap)
            )
        ).scalars().all()

        if len(memories) < 2:
            return []

        seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
        pairs = []

        for mem in memories:
            if mem.embedding is None:
                continue
            # Find nearest neighbour (different id, same user)
            row = (
                await self.db.execute(
                    select(
                        Memory,
                        Memory.embedding.op("<=>")(mem.embedding).label("distance"),
                    )
                    .filter(Memory.user_id == profile.id, Memory.id != mem.id)
                    .order_by(Memory.embedding.op("<=>")(mem.embedding))
                    .limit(1)
                )
            ).first()

            if row is None:
                continue
            neighbour, distance = row
            if float(distance) >= self.DUPLICATE_DISTANCE_THRESHOLD:
                continue

            pair_key = (min(mem.id, neighbour.id), max(mem.id, neighbour.id))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            pairs.append(
                {
                    "memory_a": mem,
                    "memory_b": neighbour,
                    "distance": float(distance),
                }
            )

        return pairs

    async def _require_owned_memory(self, memory_id: uuid.UUID, clerk_user_id: str) -> Memory:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        memory = (
            await self.db.execute(
                select(Memory).filter_by(id=memory_id, user_id=profile.id)
            )
        ).scalar_one_or_none()
        if not memory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found."
            )
        return memory
