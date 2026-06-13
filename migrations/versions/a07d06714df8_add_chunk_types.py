"""add chunk types

Revision ID: a07d06714df8
Revises: c2d7b1a85fee
Create Date: 2026-06-10 19:06:36.682021

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a07d06714df8'
down_revision: Union[str, Sequence[str], None] = 'c2d7b1a85fee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE chunktype_new AS ENUM (
            'EXPERIENCE', 'WAR_STORY', 'PREFERENCE',
            'EDUCATION', 'SKILLS_SUMMARY', 'PROJECTS', 'LANGUAGES', 'OTHER'
        )
    """)
    op.execute("""
        ALTER TABLE memories
            ALTER COLUMN chunk_type TYPE chunktype_new
            USING chunk_type::text::chunktype_new
    """)
    op.execute("DROP TYPE chunktype")
    op.execute("ALTER TYPE chunktype_new RENAME TO chunktype")


def downgrade() -> None:
    pass  # Postgres does not support removing enum values
