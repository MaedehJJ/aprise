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
