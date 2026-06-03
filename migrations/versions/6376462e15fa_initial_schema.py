"""initial schema

Revision ID: 6376462e15fa
Revises: 
Create Date: 2026-06-03 14:40:44.404271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6376462e15fa'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table('profiles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('clerk_user_id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('target_roles', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('preferred_company_size', sa.Enum('STARTUP', 'SCALEUP', 'ENTERPRISE', name='companysize'), nullable=True),
    sa.Column('years_experience', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_profiles_clerk_user_id'), 'profiles', ['clerk_user_id'], unique=True)
    op.create_table('jds',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('raw_text', sa.Text(), nullable=False),
    sa.Column('company_name', sa.String(), nullable=True),
    sa.Column('role_title', sa.String(), nullable=True),
    sa.Column('parsed_requirements', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('labels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('memories',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('embedding', Vector(1536), nullable=False),
    sa.Column('chunk_type', sa.Enum('EXPERIENCE', 'WAR_STORY', 'PREFERENCE', name='chunktype'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('conversations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('jd_id', sa.UUID(), nullable=False),
    sa.Column('state', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('current_step', sa.Enum('JD_PARSING', 'GAP_DETECTION', 'GAP_CONVERSATION', 'RESUME_GENERATION', 'DONE', name='conversationstep'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['jd_id'], ['jds.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('jd_id')
    )
    op.create_table('jd_memories',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('jd_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('embedding', Vector(1536), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['jd_id'], ['jds.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('resumes',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('jd_id', sa.UUID(), nullable=False),
    sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('labels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('docx_content', sa.LargeBinary(), nullable=True),
    sa.Column('is_generated', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['jd_id'], ['jds.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        "ix_memories_embedding",
        "memories",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_index(
        "ix_jd_memories_embedding",
        "jd_memories",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_table('applications',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('jd_id', sa.UUID(), nullable=False),
    sa.Column('resume_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.Enum('APPLIED', 'SCREENING', 'TECHNICAL', 'BEHAVIORAL', 'OFFER', 'REJECTED', name='applicationstatus'), nullable=False),
    sa.Column('company_name', sa.String(), nullable=True),
    sa.Column('role_title', sa.String(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['jd_id'], ['jds.id'], ),
    sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index("ix_memories_embedding", table_name="memories")
    op.drop_index("ix_jd_memories_embedding", table_name="jd_memories")
    op.drop_table('applications')
    op.drop_table('resumes')
    op.drop_table('jd_memories')
    op.drop_table('conversations')
    op.drop_table('memories')
    op.drop_table('jds')
    op.drop_index(op.f('ix_profiles_clerk_user_id'), table_name='profiles')
    op.drop_table('profiles')
    op.execute("DROP EXTENSION IF EXISTS vector")
    # ### end Alembic commands ###
