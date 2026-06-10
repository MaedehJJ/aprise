import re
import unicodedata
from io import BytesIO

from fastapi import HTTPException, status
from pypdf import PdfReader
from sqlalchemy.orm import Session

from db.models import ChunkType, Memory, Profile
from prompts import memory_extraction_prompt
from prompts.memory_extraction import MemoryCategory, MemoryChunk
from services.ai_service import AIService
from services.injection_defense_service import InjectionDefenseService, InjectionDetectedError

_CATEGORY_TO_CHUNK_TYPE: dict[MemoryCategory, ChunkType] = {
    MemoryCategory.EXPERIENCE: ChunkType.EXPERIENCE,
    MemoryCategory.EDUCATION: ChunkType.EDUCATION,
    MemoryCategory.SKILLS_SUMMARY: ChunkType.SKILLS_SUMMARY,
    MemoryCategory.PROJECTS: ChunkType.PROJECTS,
    MemoryCategory.LANGUAGES: ChunkType.LANGUAGES,
    MemoryCategory.OTHER: ChunkType.OTHER,
}

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_EXTRACTED_CHARS = 50_000
MAX_CHUNKS = 30


class MemoryService:

    def __init__(self, db: Session, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    # ------------------------------------------------------------------
    # Step 1 — File validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_upload(content_type: str, filename: str, size: int) -> None:
        """
        Raises HTTPException if the file fails type or size checks.
        Call this before reading the file bytes.
        """
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

    # ------------------------------------------------------------------
    # Step 2 — PDF text extraction
    # ------------------------------------------------------------------

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """
        Extracts plain text from PDF bytes using pypdf (no filesystem writes).
        Raises HTTPException if the PDF is unreadable or yields no text.
        """
        try:
            reader = PdfReader(BytesIO(file_bytes))
            text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            ).strip()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not read PDF. Make sure the file is not encrypted or corrupted.",
            )

        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract any text from the PDF. The file may be image-only.",
            )

        if len(text) > MAX_EXTRACTED_CHARS:
            text = text[:MAX_EXTRACTED_CHARS]

        return text

    # ------------------------------------------------------------------
    # Step 3 — Sanitization
    # ------------------------------------------------------------------

    @staticmethod
    def sanitize(text: str) -> str:
        """
        - Strips HTML tags
        - Normalizes unicode (NFKC) to catch lookalike characters
        - Removes null bytes and non-printable control characters
        - Collapses excessive whitespace
        """
        # Strip HTML tags
        text = re.sub(r"<[^>]+>", " ", text)

        # Normalize unicode (NFKC catches ligatures, lookalikes, etc.)
        text = unicodedata.normalize("NFKC", text)

        # Remove null bytes and control characters (except \n, \t)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        # Collapse runs of whitespace (but preserve single newlines)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()

    # ------------------------------------------------------------------
    # Step 4 — Injection scan (delegated to InjectionDefenseService)
    # ------------------------------------------------------------------

    @staticmethod
    def scan_for_injection(text: str) -> None:
        """
        Delegates to the centralised InjectionDefenseService.
        Translates InjectionDetectedError into an HTTP 400 at the service boundary.
        """
        try:
            InjectionDefenseService.defend(text)
        except InjectionDetectedError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document content.",
            )

    def process_upload(self, file_bytes: bytes, content_type: str, filename: str) -> str:
        """
        Runs the full pre-LLM pipeline: validate → extract → sanitize → defend.
        Returns the clean text, ready for LLM extraction (step 5).
        """
        self.validate_upload(content_type=content_type, filename=filename, size=len(file_bytes))
        raw_text = self.extract_text_from_pdf(file_bytes)
        clean_text = self.sanitize(raw_text)
        self.scan_for_injection(clean_text)
        return clean_text

    def extract_chunks(self, resume_content: str) -> list[MemoryChunk]:
        result = self._ai.structured(memory_extraction_prompt, cv_text=resume_content)
        return result.chunks

    def embed_and_store(self, clerk_user_id: str, chunks: list[MemoryChunk]) -> list[Memory]:
        profile = self.db.query(Profile).filter_by(clerk_user_id=clerk_user_id).first()
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

        vectors = self._ai.embed_documents([chunk.content for chunk in chunks])

        memories = [
            Memory(
                user_id=profile.id,
                content=chunk.content,
                embedding=vector,
                chunk_type=_CATEGORY_TO_CHUNK_TYPE[chunk.category],
            )
            for chunk, vector in zip(chunks, vectors)
        ]

        self.db.add_all(memories)
        self.db.commit()
        return memories
