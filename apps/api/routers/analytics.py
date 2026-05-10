from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, Integer

from core.database import get_db
from core.security import get_current_user
from models.db import User, AnalyticsEvent, ReadingProgress, Highlight

router = APIRouter()


@router.post("/streak/ping")
async def ping_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Call this once per reading session (e.g. when TTS starts playing).
    Updates the user's streak: increments if last ping was yesterday,
    resets if more than 1 day has passed, keeps if already pinged today.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    user = await db.get(User, current_user.id)
    if not user:
        return {"streak": 0}

    last = user.streak_last_date
    last_date = last.date() if last else None

    if last_date is None or (today - last_date).days > 1:
        # Streak broken or first time
        user.streak_days = 1
    elif (today - last_date).days == 1:
        # Consecutive day
        user.streak_days = (user.streak_days or 0) + 1
    # else: same day, no change

    user.streak_last_date = now
    user.longest_streak = max(user.longest_streak or 0, user.streak_days)
    # Increment listening time (approximate: 1 ping ≈ 1 minute of active reading)
    user.total_listening_minutes = (user.total_listening_minutes or 0) + 1
    db.add(user)
    await db.commit()

    return {
        "streak": user.streak_days,
        "longest": user.longest_streak,
        "is_new_day": last_date != today,
    }


@router.get("/streak")
async def get_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, current_user.id)
    if not user:
        return {"streak": 0, "longest": 0}

    # Check if streak is still alive (last ping was today or yesterday)
    now = datetime.now(timezone.utc)
    last = user.streak_last_date
    alive = last and (now.date() - last.date()).days <= 1

    return {
        "streak": user.streak_days if alive else 0,
        "longest": user.longest_streak or 0,
        "last_read": last.isoformat() if last else None,
        "total_listening_minutes": user.total_listening_minutes or 0,
    }


@router.get("/summary")
async def analytics_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 7,
):
    """Get analytics summary. Use ?days=90 for heatmap data."""
    user_id = current_user.id

    # Clamp days to reasonable range
    days = min(max(days, 1), 365)

    # Total events count by type
    result = await db.execute(
        select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.user_id == user_id)
        .group_by(AnalyticsEvent.event_type)
    )
    event_counts = {row[0]: row[1] for row in result.all()}

    # Completion stats
    prog_result = await db.execute(
        select(
            func.count(ReadingProgress.id).label("total"),
            func.sum(
                func.cast(ReadingProgress.completion_pct >= 95, Integer)
            ).label("completed"),
            func.avg(ReadingProgress.tts_speed).label("avg_speed"),
        ).where(ReadingProgress.user_id == user_id)
    )
    prog_row = prog_result.one()
    books_completed = int(prog_row.completed or 0)
    avg_speed = round(float(prog_row.avg_speed or 1.0), 2)

    # Daily stats for requested range
    days_ago = datetime.now(timezone.utc) - timedelta(days=days)
    daily_result = await db.execute(
        select(
            func.date_trunc("day", AnalyticsEvent.created_at).label("day"),
            func.count(AnalyticsEvent.id).label("events"),
        )
        .where(
            and_(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.created_at >= days_ago,
            )
        )
        .group_by("day")
        .order_by("day")
    )
    daily_stats = [
        {"date": str(row.day)[:10], "events": row.events}
        for row in daily_result.all()
    ]

    # Most highlighted books
    highlight_result = await db.execute(
        select(Highlight.book_id, func.count(Highlight.id).label("count"))
        .where(Highlight.user_id == user_id)
        .group_by(Highlight.book_id)
        .order_by(func.count(Highlight.id).desc())
        .limit(5)
    )
    most_highlighted = [
        {"book_id": row.book_id, "highlight_count": row.count}
        for row in highlight_result.all()
    ]

    return {
        "event_counts": event_counts,
        "books_completed": books_completed,
        "total_books": int(prog_row.total or 0),
        "avg_speed": round(avg_speed, 2),
        "daily_stats": daily_stats,
        "most_highlighted_books": most_highlighted,
    }


@router.get("/books/{book_id}/stats")
async def book_stats(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get per-book analytics: time spent, sessions, completion."""
    from sqlalchemy import select
    from models.db import Book

    # Verify book belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == current_user.id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        return {"error": "Book not found"}, 404

    # Get reading progress
    progress_result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.user_id == current_user.id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    # Count analytics events for this book
    events_result = await db.execute(
        select(AnalyticsEvent).where(
            AnalyticsEvent.book_id == book_id,
            AnalyticsEvent.user_id == current_user.id,
        )
    )
    events = events_result.scalars().all()

    # Calculate time spent (estimate from events)
    tts_starts = [e for e in events if e.event_type == "tts_start"]
    sessions = len(tts_starts)

    # Estimate time from progress (completion percentage)
    estimated_minutes = 0
    if progress and book.total_words > 0:
        # Assuming 150 wpm average
        words_read = int((progress.completion_pct / 100) * book.total_words)
        estimated_minutes = round(words_read / 150)

    # Calculate WPM if we have speed data
    wpm = None
    if progress and progress.tts_speed:
        # WPM = base_wpm * speed_multiplier
        wpm = round(150 * progress.tts_speed)

    return {
        "book_id": book_id,
        "title": book.title,
        "completion_pct": progress.completion_pct if progress else 0,
        "estimated_minutes": estimated_minutes,
        "sessions": sessions,
        "wpm": wpm,
        "last_read": progress.last_read_at.isoformat() if progress and progress.last_read_at else None,
    }


@router.post("/event")
async def log_event(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Allowlist event types — prevent arbitrary strings polluting analytics
    ALLOWED_EVENTS = {
        "page_view", "tts_start", "tts_pause", "tts_stop",
        "highlight_create", "note_create", "bookmark_create",
        "search", "ai_ask", "ai_summarize", "progress_save",
        "book_open", "book_complete",
    }
    event_type = body.get("event_type", "unknown")
    if event_type not in ALLOWED_EVENTS:
        event_type = "unknown"

    event = AnalyticsEvent(
        user_id=current_user.id,
        book_id=body.get("book_id"),
        event_type=event_type,
        event_metadata=body.get("metadata", {}),
    )
    db.add(event)
    await db.commit()
    return {"ok": True}
