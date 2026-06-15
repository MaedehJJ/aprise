"""add jd_notes and conversation_messages

Revision ID: f1a2b3c4d5e6
Revises: c2d7b1a85fee
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "a07d06714df8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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

    bind = op.get_bind()
    existing = sa.inspect(bind).get_table_names()

    if "jd_notes" not in existing:
        op.create_table(
            "jd_notes",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("profiles.id"),
                nullable=False,
            ),
            sa.Column(
                "jd_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("jds.id"),
                nullable=False,
            ),
            sa.Column(
                "note_type",
                sa.Enum("NOTE", "WAR_STORY", "WORRY", name="jdnotetype", create_type=False),
                nullable=False,
            ),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index("ix_jd_notes_jd_id", "jd_notes", ["jd_id"])

    if "conversation_messages" not in existing:
        op.create_table(
            "conversation_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "conversation_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("conversations.id"),
                nullable=False,
            ),
            sa.Column(
                "role",
                sa.Enum("user", "assistant", name="messagerole", create_type=False),
                nullable=False,
            ),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index(
            "ix_conversation_messages_conversation_id",
            "conversation_messages",
            ["conversation_id"],
        )


def downgrade() -> None:
    op.drop_index("ix_conversation_messages_conversation_id", "conversation_messages")
    op.drop_index("ix_jd_notes_jd_id", "jd_notes")
    op.drop_table("conversation_messages")
    op.drop_table("jd_notes")
    op.execute("DROP TYPE messagerole")
    op.execute("DROP TYPE jdnotetype")
