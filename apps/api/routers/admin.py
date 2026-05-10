from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from core.database import get_db
from core.security import get_current_user
from models.db import User, Book, AnalyticsEvent

router = APIRouter()


@router.get("/stats")
async def admin_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get platform-wide statistics. Requires admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar()

    # Verified users
    verified_result = await db.execute(
        select(func.count(User.id)).where(User.is_verified == True)
    )
    verified_users = verified_result.scalar()

    # Total books
    books_result = await db.execute(select(func.count(Book.id)))
    total_books = books_result.scalar()

    # Books by status
    ready_result = await db.execute(
        select(func.count(Book.id)).where(Book.status == "ready")
    )
    ready_books = ready_result.scalar()

    processing_result = await db.execute(
        select(func.count(Book.id)).where(Book.status == "processing")
    )
    processing_books = processing_result.scalar()

    error_result = await db.execute(
        select(func.count(Book.id)).where(Book.status == "error")
    )
    error_books = error_result.scalar()

    # Total storage used (estimate from file_data)
    # This is approximate since we're not tracking actual storage

    # Recent activity (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    events_result = await db.execute(
        select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.created_at >= seven_days_ago)
        .group_by(AnalyticsEvent.event_type)
    )
    recent_events = {row[0]: row[1] for row in events_result.all()}

    # User signups in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_users_result = await db.execute(
        select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
    )
    new_users = new_users_result.scalar()

    return {
        "users": {
            "total": total_users,
            "verified": verified_users,
            "new_last_30_days": new_users,
        },
        "books": {
            "total": total_books,
            "ready": ready_books,
            "processing": processing_books,
            "error": error_books,
        },
        "activity_last_7_days": recent_events,
    }


@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    offset = (page - 1) * limit
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    users = result.scalars().all()

    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "is_verified": u.is_verified,
                "role": u.role,
                "created_at": u.created_at.isoformat(),
                "total_listening_minutes": u.total_listening_minutes or 0,
            }
            for u in users
        ],
        "page": page,
        "limit": limit,
    }