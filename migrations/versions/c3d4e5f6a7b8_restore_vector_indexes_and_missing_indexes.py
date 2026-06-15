"""restore vector indexes and add missing indexes

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-15 00:00:02.000000

Restores the HNSW cosine indexes on memories.embedding and jd_memories.embedding
that were dropped in migration c2d7b1a85fee.

Also adds:
  - Composite (conversation_id, created_at) index on conversation_messages
    for sorted message fetches without a sort step.
  - Composite (user_id, jd_id) index on jd_notes for ownership queries.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Ensure f1a2b3c4d5e6 tables exist (guard against alembic stamp drift) ──
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'jdnotetype') THEN
                CREATE TYPE jdnotetype AS ENUM ('NOTE', 'WAR_STORY', 'WORRY');
            END IF;
        END $$
    """)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'messagerole') THEN
                CREATE TYPE messagerole AS ENUM ('user', 'assistant');
            END IF;
        END $$
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS jd_notes (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID        NOT NULL REFERENCES profiles(id),
            jd_id       UUID        NOT NULL REFERENCES jds(id),
            note_type   jdnotetype  NOT NULL,
            content     TEXT        NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS conversation_messages (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID        NOT NULL REFERENCES conversations(id),
            role            messagerole NOT NULL,
            content         TEXT        NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_jd_notes_jd_id ON jd_notes (jd_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_conversation_messages_conversation_id ON conversation_messages (conversation_id)")

    # ── HNSW cosine indexes (restored after c2d7b1a85fee dropped them) ────────
    op.execute("""
        CREATE INDEX IF NOT EXISTS hnsw_memories_embedding_cosine
        ON memories USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS hnsw_jd_memories_embedding_cosine
        ON jd_memories USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # ── Composite indexes for performance ─────────────────────────────────────
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_conversation_messages_conv_id_created_at
        ON conversation_messages (conversation_id, created_at)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_jd_notes_user_id_jd_id
        ON jd_notes (user_id, jd_id)
    """)


def downgrade() -> None:
    op.drop_index("ix_jd_notes_user_id_jd_id", "jd_notes")
    op.drop_index("ix_conversation_messages_conv_id_created_at", "conversation_messages")
    op.drop_index("hnsw_jd_memories_embedding_cosine", "jd_memories")
    op.drop_index("hnsw_memories_embedding_cosine", "memories")
