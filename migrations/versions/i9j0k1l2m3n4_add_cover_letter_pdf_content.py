"""add cover_letter pdf_content

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-06-29

"""
from alembic import op
import sqlalchemy as sa

revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cover_letters", sa.Column("pdf_content", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("cover_letters", "pdf_content")
