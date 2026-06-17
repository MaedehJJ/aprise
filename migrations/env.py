from logging.config import fileConfig
import os
import sys
from pathlib import Path

# Make the api/ package importable regardless of the working directory.
_api_dir = Path(__file__).parent.parent / "api"
if str(_api_dir) not in sys.path:
    sys.path.insert(0, str(_api_dir))

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from db.models import Base

# Try .env.local first (local dev), then fall back to .env.
_root = Path(__file__).parent.parent
load_dotenv(dotenv_path=_root / ".env.local")
load_dotenv(dotenv_path=_root / ".env")

config = context.config

# Prefer the direct (non-pooled) URL for migrations — pgbouncer can't handle
# DDL statements that span multiple connections.
url = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("DATABASE_URL")
if not url:
    raise RuntimeError(
        "Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set. "
        "Add one to your .env.local file."
    )
config.set_main_option("sqlalchemy.url", url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = url
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
