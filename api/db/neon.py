import logging
import os
import ssl
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logger = logging.getLogger(__name__)

_engine = None
_AsyncSessionLocal = None

# asyncpg does not accept psycopg2-style query parameters (sslmode, channel_binding).
# These are stripped from the URL and translated into connect_args instead.
_ASYNCPG_UNSUPPORTED_PARAMS = {"sslmode", "channel_binding", "options"}


def _build_asyncpg_url(raw_url: str) -> tuple[str, dict]:
    """
    Convert a standard postgresql:// URL to postgresql+asyncpg:// and extract
    any SSL-related query parameters that asyncpg handles via connect_args.

    Returns (cleaned_url, connect_args).
    """
    parsed = urlparse(raw_url)
    scheme = parsed.scheme
    if scheme in ("postgresql", "postgres"):
        scheme = "postgresql+asyncpg"
    elif scheme in ("postgresql+psycopg2", "postgresql+psycopg"):
        scheme = "postgresql+asyncpg"

    qs = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = qs.pop("sslmode", [None])[0]
    for param in _ASYNCPG_UNSUPPORTED_PARAMS:
        qs.pop(param, None)

    cleaned = urlunparse((scheme, parsed.netloc, parsed.path, parsed.params, urlencode(qs, doseq=True), parsed.fragment))

    connect_args: dict = {}
    if sslmode in ("require", "verify-ca", "verify-full"):
        ctx = ssl.create_default_context()
        if sslmode == "require":
            # Trust the server cert (Neon uses a well-known CA).
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx
    elif sslmode == "disable":
        connect_args["ssl"] = False

    return cleaned, connect_args


def _get_engine():
    global _engine, _AsyncSessionLocal
    if _engine is None:
        url, connect_args = _build_asyncpg_url(os.environ["DATABASE_URL"])
        _engine = create_async_engine(
            url,
            connect_args=connect_args,
            pool_pre_ping=True,
            pool_size=5,
            # Allow up to 10 overflow connections for concurrent request bursts.
            # Total max connections = pool_size + max_overflow = 15, well within
            # Neon's pgbouncer limits.
            max_overflow=10,
            # Neon's pgbouncer recycles idle connections server-side (~5 min).
            # Recycle proactively at 4 min so SQLAlchemy never hands out a stale
            # connection, avoiding the round-trip cost of pool_pre_ping alone.
            pool_recycle=240,
        )
        _AsyncSessionLocal = async_sessionmaker(
            _engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            # Prevent objects from expiring after commit so relationships
            # accessed after commit don't trigger an implicit lazy-load.
            expire_on_commit=False,
        )
    return _engine


async def get_db() -> AsyncSession:
    _get_engine()
    async with _AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # Roll back any uncommitted state so the connection goes back to the
            # pool in a clean state. The exception is re-raised for FastAPI to handle.
            await session.rollback()
            raise
