"""Add auth tables, collections, and new columns

Revision ID: 0004_auth_collections
Revises: 0003_pgvector
Create Date: 2026-05-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004_auth_collections'
down_revision = '0003_pgvector'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to users table (if not exist)
    op.add_column('users', sa.Column('avatar_url', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), server_default='false'))
    op.add_column('users', sa.Column('role', sa.String(20), server_default='user'))

    # Add audio_url to notes table
    op.add_column('notes', sa.Column('audio_url', sa.Text(), nullable=True))

    # Create verification_tokens table
    op.create_table(
        'verification_tokens',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('token_type', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_verification_tokens_token', 'verification_tokens', ['token'])

    # Create token_denylist table
    op.create_table(
        'token_denylist',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('jti', sa.String(length=255), nullable=False),
        sa.Column('token_type', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_token_denylist_jti', 'token_denylist', ['jti'], unique=True)

    # Create collections table
    op.create_table(
        'collections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_color', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create collection_books table
    op.create_table(
        'collection_books',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('collection_id', sa.String(), nullable=False),
        sa.Column('book_id', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), server_default='0'),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('collection_books')
    op.drop_table('collections')
    op.drop_index('ix_token_denylist_jti')
    op.drop_table('token_denylist')
    op.drop_index('ix_verification_tokens_token')
    op.drop_table('verification_tokens')
    op.drop_column('notes', 'audio_url')
    op.drop_column('users', 'role')
    op.drop_column('users', 'is_verified')
    op.drop_column('users', 'avatar_url')