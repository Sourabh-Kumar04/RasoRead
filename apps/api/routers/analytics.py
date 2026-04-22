from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from core.database import get_db
from core.security import get_current_user
from models.db import User, AnalyticsEvent, ReadingProgress, Highlight

router = APIRouter()


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
