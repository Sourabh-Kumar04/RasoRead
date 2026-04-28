from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str]
    created_at: datetime
    settings: dict

    class Config:
        from_attributes = True


# ── Books ─────────────────────────────────────────────────────────────────────

class BookOut(BaseModel):
    id: str
    title: str
    author: Optional[str]
    file_type: str
    cover_url: Optional[str]
    total_pages: int
    total_words: int
    toc: list
    status: str
    created_at: datetime

    @property
    def reading_time_minutes(self) -> int:
        """Estimated listening time at 150 wpm average TTS speed."""
        return max(1, round(self.total_words / 150))

    class Config:
        from_attributes = True

class BookDetailOut(BookOut):
    # NOTE: extracted_text is intentionally excluded — it can be MBs of OCR data.
    # Page text is served via GET /reader/{book_id}/text?page=N instead.
    pass


class BookMetaUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    author: Optional[str] = Field(None, max_length=255)


# ── Progress ──────────────────────────────────────────────────────────────────

class ProgressIn(BaseModel):
    current_page: int
    char_offset: int
    completion_pct: Optional[float] = None
    tts_speed: Optional[float] = 1.0
    voice_id: Optional[str] = None

class ProgressOut(BaseModel):
    current_page: int
    char_offset: int
    completion_pct: float
    tts_speed: float
    voice_id: str
    last_read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Highlights ────────────────────────────────────────────────────────────────

class HighlightIn(BaseModel):
    book_id: str
    page: int
    start_char: int
    end_char: int
    text: str
    color: str = "primary"

class HighlightOut(BaseModel):
    id: str
    book_id: str
    page: int
    start_char: int
    end_char: int
    text: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Notes ─────────────────────────────────────────────────────────────────────

class NoteIn(BaseModel):
    book_id: str
    highlight_id: Optional[str] = None
    page: Optional[int] = None
    start_char: Optional[int] = None
    content: str
    source: str = "typed"

class NoteOut(BaseModel):
    id: str
    book_id: str
    highlight_id: Optional[str]
    page: Optional[int]
    content: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Bookmarks ─────────────────────────────────────────────────────────────────

class BookmarkIn(BaseModel):
    book_id: str
    page: int
    label: Optional[str] = None

class BookmarkOut(BaseModel):
    id: str
    book_id: str
    page: int
    label: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── TTS ───────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str = Field(max_length=5000)
    voice_id: str = "edge-en-US-AriaNeural"
    speed: float = Field(default=1.0, ge=0.25, le=4.0)
    book_id: Optional[str] = None

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float


# ── AI ────────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str = Field(max_length=1000)

class SummarizeRequest(BaseModel):
    chapter_text: str = Field(max_length=20000)

class AIResponse(BaseModel):
    content: str
    type: str  # summary | keypoints | answer | description


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_reading_time_minutes: int
    total_listening_time_minutes: int
    books_completed: int
    avg_speed: float
    daily_stats: List[dict]
    most_highlighted_books: List[dict]
