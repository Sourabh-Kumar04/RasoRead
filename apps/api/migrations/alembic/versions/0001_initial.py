"""Initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("password", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settings", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "books",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("file_type", sa.String(10), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.Column("cover_url", sa.Text(), nullable=True),
        sa.Column("total_pages", sa.Integer(), nullable=True),
        sa.Column("total_words", sa.Integer(), nullable=True),
        sa.Column("toc", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("extracted_text", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("vector_index_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_books_user_id", "books", ["user_id"])
    op.create_index("ix_books_user_created", "books", ["user_id", "created_at"])

    op.create_table(
        "reading_progress",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("book_id", sa.String(), nullable=False),
        sa.Column("current_page", sa.Integer(), nullable=True),
        sa.Column("char_offset", sa.Integer(), nullable=True),
        sa.Column("completion_pct", sa.Float(), nullable=True),
        sa.Column("tts_speed", sa.Float(), nullable=True),
        sa.Column("voice_id", sa.String(100), nullable=True),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "book_id"),
    )

    op.create_table(
        "highlights",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("book_id", sa.String(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("start_char", sa.Integer(), nullable=False),
        sa.Column("end_char", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("color", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_highlights_book_page", "highlights", ["book_id", "page"])

    op.create_table(
        "notes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("book_id", sa.String(), nullable=False),
        sa.Column("highlight_id", sa.String(), nullable=True),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("start_char", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["highlight_id"], ["highlights.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_book_id", "notes", ["book_id"])

    op.create_table(
        "bookmarks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("book_id", sa.String(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bookmarks_book_id", "bookmarks", ["book_id"])

    op.create_table(
        "analytics_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("book_id", sa.String(), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=True),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_user_time", "analytics_events", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("analytics_events")
    op.drop_table("bookmarks")
    op.drop_table("notes")
    op.drop_table("highlights")
    op.drop_table("reading_progress")
    op.drop_table("books")
    op.drop_table("users")
