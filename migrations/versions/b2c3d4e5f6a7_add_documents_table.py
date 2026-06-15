"""add documents table

Revision ID: b2c3d4e5f6a7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-15 00:00:01.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL throughout to avoid SQLAlchemy's automatic enum type creation,
    # which fires even when create_type=False in some SQLAlchemy versions.
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'documentkind') THEN
                CREATE TYPE documentkind AS ENUM ('resume', 'linkedin', 'other');
            END IF;
        END $$
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID        NOT NULL REFERENCES profiles(id),
            filename    TEXT        NOT NULL,
            kind        documentkind NOT NULL,
            memories_extracted INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_documents_user_id ON documents (user_id)
    """)


def downgrade() -> None:
    op.drop_index("ix_documents_user_id", "documents")
    op.drop_table("documents")
    op.execute("DROP TYPE documentkind")
