"""add score caches, preferences, and company research cache

Revision ID: h8i9j0k1l2m3
Revises: a1b2c3d4e5f6, g7h8i9j0k1l2
Create Date: 2026-06-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, Sequence[str], None] = ("a1b2c3d4e5f6", "g7h8i9j0k1l2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE jds
            ADD COLUMN IF NOT EXISTS fit_score_cache JSONB NULL;
    """)
    op.execute("""
        ALTER TABLE resumes
            ADD COLUMN IF NOT EXISTS ats_score_cache JSONB NULL;
    """)
    op.execute("""
        ALTER TABLE resumes
            ADD COLUMN IF NOT EXISTS pdf_content BYTEA NULL;
    """)
    op.execute("""
        ALTER TABLE profiles
            ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
    """)
    op.execute("""
        ALTER TABLE memories
            ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64) NULL;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS company_research_cache (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            normalized_company_name VARCHAR(255) NOT NULL,
            summary TEXT NOT NULL,
            fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_company_research_cache_name
            ON company_research_cache (normalized_company_name);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_company_research_cache_name;")
    op.execute("DROP TABLE IF EXISTS company_research_cache;")
    op.execute("ALTER TABLE memories DROP COLUMN IF EXISTS content_hash;")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS preferences;")
    op.execute("ALTER TABLE resumes DROP COLUMN IF EXISTS pdf_content;")
    op.execute("ALTER TABLE resumes DROP COLUMN IF EXISTS ats_score_cache;")
    op.execute("ALTER TABLE jds DROP COLUMN IF EXISTS fit_score_cache;")
