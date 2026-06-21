import logging
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

if os.getenv("VERCEL") is None:
    load_dotenv(Path(__file__).parent.parent / ".env.local")

# ── Structured logging ────────────────────────────────────────────────────────
# Configure before any module-level loggers are created.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ── Startup env-var validation ────────────────────────────────────────────────
_REQUIRED_VARS = [
    "DATABASE_URL",
    "CLERK_JWKS_URL",
    "OPENAI_API_KEY",
    "AI_FALLBACK_MODEL",
]
_OBSERVABILITY_VARS = [
    ("LANGCHAIN_TRACING_V2", "LangSmith tracing"),
    ("LANGCHAIN_API_KEY", "LangSmith API key"),
    ("SENTRY_DSN", "Sentry error tracking"),
]

_missing = [v for v in _REQUIRED_VARS if not os.environ.get(v)]
if _missing:
    # Log but don't crash — Vercel preview deployments may omit some vars.
    logger.error(
        "Missing required environment variables: %s — the app will fail on affected paths.",
        ", ".join(_missing),
    )

for _var, _label in _OBSERVABILITY_VARS:
    if not os.environ.get(_var):
        logger.warning("Observability var %s (%s) is not set.", _var, _label)

# ── Sentry ────────────────────────────────────────────────────────────────────
# Backend uses its own project so Python errors stay separate from JS errors.
_sentry_dsn = os.environ.get("SENTRY_BACKEND_DSN")
if _sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=_sentry_dsn,
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            environment=os.environ.get("VERCEL_ENV", "development"),
            release=os.environ.get("VERCEL_GIT_COMMIT_SHA"),
        )
        logger.info("Sentry initialised (env=%s)", os.environ.get("VERCEL_ENV", "development"))
    except ImportError:
        logger.warning("sentry-sdk not installed — run `pip install sentry-sdk[fastapi]`.")
else:
    logger.info("SENTRY_DSN not set — Sentry disabled.")

# ── App ───────────────────────────────────────────────────────────────────────
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from routers._limiter import limiter
from routers.auth import get_current_user, prewarm_jwks
from routers.profile import router as profile_router
from routers.memory import router as memory_router
from routers.jd import router as jd_router
from routers.conversation import router as conversation_router
from routers.document import router as document_router
from routers.resume import router as resume_router
from routers.application import router as application_router
from routers.tags import router as tags_router
from services.ai_service import AIServiceError, AIInferenceError, AIOutputParsingError

app = FastAPI(title="Aprise API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
async def _startup() -> None:
    """Pre-warm expensive singletons so the first request doesn't pay cold-start costs."""
    prewarm_jwks()

app.include_router(profile_router)
app.include_router(memory_router)
app.include_router(jd_router)
app.include_router(conversation_router)
app.include_router(document_router)
app.include_router(resume_router)
app.include_router(application_router)
app.include_router(tags_router)


# ── Request-ID middleware ─────────────────────────────────────────────────────

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Stamps every request with a UUID and logs method + path + status + duration."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        import time
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "request %s %s %s %s %.1fms",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(RequestIDMiddleware)


# ── Global exception handlers ─────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Override FastAPI's default HTTPException handler to include request_id."""
    request_id = getattr(request.state, "request_id", "-")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": request_id},
        headers=getattr(exc, "headers", None) or {},
    )


@app.exception_handler(AIInferenceError)
async def ai_inference_error_handler(request: Request, exc: AIInferenceError):
    request_id = getattr(request.state, "request_id", "-")
    logger.error(
        "AIInferenceError [%s] %s %s: %s",
        request_id, request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=502,
        content={"detail": "The AI provider returned an error. Please try again.", "request_id": request_id},
    )


@app.exception_handler(AIOutputParsingError)
async def ai_parsing_error_handler(request: Request, exc: AIOutputParsingError):
    request_id = getattr(request.state, "request_id", "-")
    logger.error(
        "AIOutputParsingError [%s] %s %s: %s",
        request_id, request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=502,
        content={"detail": "The AI returned an unexpected response. Please try again.", "request_id": request_id},
    )


@app.exception_handler(AIServiceError)
async def ai_service_error_handler(request: Request, exc: AIServiceError):
    request_id = getattr(request.state, "request_id", "-")
    logger.error(
        "AIServiceError [%s] %s %s: %s",
        request_id, request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=502,
        content={"detail": "AI service error. Please try again.", "request_id": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # HTTPException is handled by FastAPI's built-in handler; don't double-log it.
    if isinstance(exc, HTTPException):
        raise exc

    request_id = getattr(request.state, "request_id", "-")
    logger.critical(
        "Unhandled exception [%s] %s %s",
        request_id, request.method, request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred.", "request_id": request_id},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/me")
async def me(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}
