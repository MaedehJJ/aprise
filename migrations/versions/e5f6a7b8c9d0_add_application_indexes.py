"""add application indexes

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-17 00:00:00.000000

Adds:
- ix_applications_user_id  — filters by owner (list queries)
- ix_applications_jd_id    — joins to JD (already FK but explicit index speeds lookups)
- ix_applications_status   — filters by pipeline stage (Kanban column queries)

Also ensures the applicationstatus ENUM exists with correct lowercase values.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure enum exists with correct lowercase values (idempotent).
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'applicationstatus') THEN
                CREATE TYPE applicationstatus AS ENUM (
                    'applied', 'screening', 'technical', 'behavioral', 'offer', 'rejected'
                );
            END IF;
        END $$;
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_applications_user_id
            ON applications (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_applications_jd_id
            ON applications (jd_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_applications_status
            ON applications (status);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_applications_status;")
    op.execute("DROP INDEX IF EXISTS ix_applications_jd_id;")
    op.execute("DROP INDEX IF EXISTS ix_applications_user_id;")
