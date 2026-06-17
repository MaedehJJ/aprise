"""add resume indexes

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-16 00:00:00.000000

Adds:
- ix_resumes_user_id   — filters resumes by owner (used in list/get queries)
- ix_resumes_labels    — GIN index on resumes.labels JSONB for tag-overlap queries
                         (used by ResumeService._find_similar_resumes)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_resumes_user_id
            ON resumes (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_resumes_labels
            ON resumes USING gin (labels);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_resumes_labels;")
    op.execute("DROP INDEX IF EXISTS ix_resumes_user_id;")
