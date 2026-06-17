import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger(__name__)

_engine = None
_SessionLocal = None


def _get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(
            os.environ["DATABASE_URL"],
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=0,
            # Neon's pgbouncer recycles idle connections server-side (~5 min).
            # Recycle proactively at 4 min so SQLAlchemy never hands out a stale
            # connection, avoiding the round-trip cost of pool_pre_ping alone.
            pool_recycle=240,
        )
        _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
    return _engine


def get_db() -> Session:
    _get_engine()
    db = _SessionLocal()
    try:
        yield db
    except Exception:
        # Roll back any uncommitted state so the connection goes back to the
        # pool in a clean state. The exception is re-raised for FastAPI to handle.
        db.rollback()
        raise
    finally:
        db.close()
