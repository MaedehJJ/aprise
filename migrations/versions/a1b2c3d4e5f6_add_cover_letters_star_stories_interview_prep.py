"""add cover_letters, star_stories, interview_prep step

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-06-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend conversationstep enum ───────────────────────────────────────────
    # Must be done outside a transaction on Postgres.
    op.execute("ALTER TYPE conversationstep ADD VALUE IF NOT EXISTS 'interview_prep'")

    # ── cover_letters ──────────────────────────────────────────────────────────
    op.create_table(
        "cover_letters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("jd_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jds.id"), nullable=False),
        sa.Column("content", postgresql.JSONB, nullable=True),
        sa.Column("labels", postgresql.JSONB, nullable=True),
        sa.Column("is_generated", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_cover_letters_user_id", "cover_letters", ["user_id"])
    op.create_index("ix_cover_letters_jd_id", "cover_letters", ["jd_id"])

    # ── star_stories ───────────────────────────────────────────────────────────
    op.create_table(
        "star_stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False, index=True),
        sa.Column("jd_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jds.id"), nullable=True, index=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("situation", sa.Text, nullable=False),
        sa.Column("task_action", sa.Text, nullable=False),
        sa.Column("result", sa.Text, nullable=False),
        sa.Column("skills", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("embedding", sa.Text, nullable=True),  # placeholder; vector added below
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Replace the placeholder TEXT column with a proper vector column.
    op.execute("ALTER TABLE star_stories DROP COLUMN embedding")
    op.execute("ALTER TABLE star_stories ADD COLUMN embedding vector(1536) NOT NULL DEFAULT array_fill(0, ARRAY[1536])::vector")
    # Remove the DEFAULT after creation so new rows must supply their own embedding.
    op.execute("ALTER TABLE star_stories ALTER COLUMN embedding DROP DEFAULT")

    # HNSW index for semantic search on star stories.
    op.execute(
        "CREATE INDEX ix_star_stories_embedding_hnsw "
        "ON star_stories USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_star_stories_embedding_hnsw")
    op.drop_table("star_stories")
    op.drop_table("cover_letters")
    # Postgres does not support removing enum values — downgrade leaves the enum extended.
