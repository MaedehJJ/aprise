import re
import unicodedata
from io import BytesIO

from fastapi import HTTPException, status
from pypdf import PdfReader

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_EXTRACTED_CHARS = 50_000
MAX_CHUNKS = 30

# Prompt injection patterns — case-insensitive
_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|previous\s+|prior\s+)?(instructions?|prompts?|rules?|directives?)",
    r"you\s+are\s+now",
    r"act\s+as\s+",
    r"disregard\s+(all\s+|previous\s+|prior\s+)?(instructions?|prompts?|rules?)?",
    r"new\s+persona",
    r"system\s+prompt",
    r"forget\s+(all\s+|previous\s+|prior\s+)?(instructions?|prompts?|context)?",
    r"do\s+not\s+follow",
    r"override\s+(previous\s+|prior\s+)?(instructions?|rules?)",
    r"jailbreak",
]

_INJECTION_REGEX = re.compile(
    "|".join(_INJECTION_PATTERNS),
    re.IGNORECASE,
)


class MemoryService:

    # ------------------------------------------------------------------
    # Step 1 — File validation (called in the router before reading bytes)
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
    # Step 4 — Injection scan
    # ------------------------------------------------------------------

    @staticmethod
    def scan_for_injection(text: str) -> None:
        """
        Raises HTTPException if the text contains known prompt injection patterns.
        """
        if _INJECTION_REGEX.search(text):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document content.",
            )
