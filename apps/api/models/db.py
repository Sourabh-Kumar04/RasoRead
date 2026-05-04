import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime, LargeBinary,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from core.database import Base


def now_utc():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    password: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    # ── Streak tracking ───────────────────────────────────────────────────────
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    streak_last_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    total_listening_minutes: Mapped[int] = mapped_column(Integer, default=0)

    books: Mapped[list["Book"]] = relationship("Book", back_populates="user", cascade="all, delete-orphan")
    progress: Mapped[list["ReadingProgress"]] = relationship("ReadingProgress", back_populates="user", cascade="all, delete-orphan")
    book_settings: Mapped[list["UserBookSettings"]] = relationship("UserBookSettings", back_populates="user", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=True)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    s3_key: Mapped[str] = mapped_column(Text, nullable=True)
    # WARNING: file_data stores raw bytes in Postgres — only used when STORAGE_BACKEND=db.
    # Never use db backend in production. Use local or s3 instead.
    file_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)
    cover_url: Mapped[str] = mapped_column(Text, nullable=True)
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    total_words: Mapped[int] = mapped_column(Integer, default=0)
    toc: Mapped[list] = mapped_column(JSON, default=list)
    extracted_text: Mapped[dict] = mapped_column(JSON, default=dict)
    vector_index_id: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="processing")  # processing | ready | error
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship("User", back_populates="books")
    progress: Mapped[list["ReadingProgress"]] = relationship("ReadingProgress", back_populates="book")
    highlights: Mapped[list["Highlight"]] = relationship("Highlight", back_populates="book", cascade="all, delete-orphan")
    notes: Mapped[list["Note"]] = relationship("Note", back_populates="book", cascade="all, delete-orphan")
    bookmarks: Mapped[list["Bookmark"]] = relationship("Bookmark", back_populates="book", cascade="all, delete-orphan")
    chunks: Mapped[list["DocumentChunk"]] = relationship("DocumentChunk", back_populates="book", cascade="all, delete-orphan")
    user_settings: Mapped[list["UserBookSettings"]] = relationship("UserBookSettings", back_populates="book", cascade="all, delete-orphan")


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"))
    current_page: Mapped[int] = mapped_column(Integer, default=1)
    char_offset: Mapped[int] = mapped_column(Integer, default=0)
    completion_pct: Mapped[float] = mapped_column(Float, default=0.0)
    tts_speed: Mapped[float] = mapped_column(Float, default=1.0)
    voice_id: Mapped[str] = mapped_column(String(100), default="nova")
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship("User", back_populates="progress")
    book: Mapped["Book"] = relationship("Book", back_populates="progress")


class Highlight(Base):
    __tablename__ = "highlights"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"), index=True)
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    start_char: Mapped[int] = mapped_column(Integer, nullable=False)
    end_char: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(30), default="primary")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    book: Mapped["Book"] = relationship("Book", back_populates="highlights")
    notes: Mapped[list["Note"]] = relationship("Note", back_populates="highlight")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"), index=True)
    highlight_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("highlights.id"), nullable=True)
    page: Mapped[int] = mapped_column(Integer, nullable=True)
    start_char: Mapped[int] = mapped_column(Integer, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="typed")  # typed | voice
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    book: Mapped["Book"] = relationship("Book", back_populates="notes")
    highlight: Mapped["Highlight"] = relationship("Highlight", back_populates="notes")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"), index=True)
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    book: Mapped["Book"] = relationship("Book", back_populates="bookmarks")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(50))
    event_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)


class UserBookSettings(Base):
    __tablename__ = "user_book_settings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"), index=True)
    tts_provider: Mapped[str] = mapped_column(String(20), default="gemini")
    
    user: Mapped["User"] = relationship("User", back_populates="book_settings")
    book: Mapped["Book"] = relationship("Book", back_populates="user_settings")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    book_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("books.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=True)

    book: Mapped["Book"] = relationship("Book", back_populates="chunks")
