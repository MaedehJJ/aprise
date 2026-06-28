"""add missing owner and FK indexes

Revision ID: g7h8i9j0k1l2
Revises: e5f6a7b8c9d0
Create Date: 2026-06-27 00:00:00.000000

Adds B-tree indexes on columns used as WHERE filters in the hot query paths
that were missing from the initial schema and subsequent migrations:

- ix_jds_user_id              — every JD list/get query filters by owner
- ix_memories_user_id         — every memory semantic-search filters by owner
- ix_jd_memories_user_id      — JDSimilarityService filters by owner
- ix_conversations_user_id    — list/get conversation queries
- ix_resumes_jd_id            — list_resumes filters by (jd_id, user_id)

cover_letters already has ix_cover_letters_user_id and ix_cover_letters_jd_id
from migration a1b2c3d4e5f6, so those are not repeated here.

star_stories user_id/jd_id indexes were created inline in a1b2c3d4e5f6.
applications user_id/jd_id/status indexes exist from e5f6a7b8c9d0.
conversations.jd_id has a UNIQUE constraint which Postgres backs with an
implicit B-tree index, so that column is already covered.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_jds_user_id
            ON jds (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_memories_user_id
            ON memories (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_jd_memories_user_id
            ON jd_memories (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_conversations_user_id
            ON conversations (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_resumes_jd_id
            ON resumes (jd_id);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_resumes_jd_id;")
    op.execute("DROP INDEX IF EXISTS ix_conversations_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_jd_memories_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_memories_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_jds_user_id;")
