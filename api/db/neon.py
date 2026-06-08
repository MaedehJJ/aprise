import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

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
    finally:
        db.close()
