"""add jd company_research column

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-17 00:00:01.000000

Adds:
- jds.company_research TEXT — stores the Tavily-sourced company research summary
  populated asynchronously after JD creation.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE jds
        ADD COLUMN IF NOT EXISTS company_research TEXT;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE jds DROP COLUMN IF EXISTS company_research;")
