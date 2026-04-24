from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

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
    }


@router.get("/summary")
async def analytics_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id

    # Total events count by type
    result = await db.execute(
        select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.user_id == user_id)
        .group_by(AnalyticsEvent.event_type)
    )
    event_counts = {row[0]: row[1] for row in result.all()}

    # Completion stats
    prog_result = await db.execute(
        select(ReadingProgress).where(ReadingProgress.user_id == user_id)
    )
    progress_rows = prog_result.scalars().all()
    books_completed = sum(1 for p in progress_rows if p.completion_pct >= 95)
    avg_speed = (
        sum(p.tts_speed for p in progress_rows) / len(progress_rows)
        if progress_rows else 1.0
    )

    # Daily stats last 7 days
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily_result = await db.execute(
        select(
            func.date_trunc("day", AnalyticsEvent.created_at).label("day"),
            func.count(AnalyticsEvent.id).label("events"),
        )
        .where(
            and_(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.created_at >= seven_days_ago,
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
        "total_books": len(progress_rows),
        "avg_speed": round(avg_speed, 2),
        "daily_stats": daily_stats,
        "most_highlighted_books": most_highlighted,
    }


@router.post("/event")
async def log_event(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = AnalyticsEvent(
        user_id=current_user.id,
        book_id=body.get("book_id"),
        event_type=body.get("event_type", "unknown"),
        event_metadata=body.get("metadata", {}),
    )
    db.add(event)
    return {"ok": True}
