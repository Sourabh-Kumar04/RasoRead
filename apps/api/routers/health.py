from fastapi import APIRouter
from core.database import async_session_maker
from sqlalchemy import text
from core.celery_app import celery_app

router = APIRouter()

@router.get("/")
async def health_check():
    """Basic health check for the API."""
    db_ok = False
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass

    worker_ok = False
    try:
        # Ping celery workers. This returns a dict of worker names to ping responses
        i = celery_app.control.ping(timeout=1.0)
        worker_ok = bool(i)
    except Exception:
        pass

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "worker": "connected" if worker_ok else "disconnected"
    }
