from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

from core.config import settings
from core.database import engine, Base
from core.logging import setup_logging
from core.rate_limit import RateLimitMiddleware
from core.exceptions import register_exception_handlers
from routers import auth, books, reader, tts, ai, analytics, notes

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    # Ensure local upload directory exists
    Path(settings.LOCAL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
    # FAISS index dir — use env var so it can be a named Docker volume
    faiss_dir = os.environ.get("FAISS_INDEX_DIR", "./faiss_indexes")
    Path(faiss_dir).mkdir(parents=True, exist_ok=True)

    # Create DB tables (Alembic handles migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield


app = FastAPI(
    title="RasoRead API",
    version="1.0.0",
    description="Backend for RasoRead — AI-powered audio reading platform",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Middleware ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

# ── Exception handlers ─────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── Static files (local storage) ───────────────────────────────────────────────
if settings.STORAGE_BACKEND == "local":
    upload_path = Path(settings.LOCAL_STORAGE_PATH)
    upload_path.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(upload_path)), name="static")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(books.router,     prefix="/books",     tags=["books"])
app.include_router(reader.router,    prefix="/reader",    tags=["reader"])
app.include_router(tts.router,       prefix="/tts",       tags=["tts"])
app.include_router(ai.router,        prefix="/ai",        tags=["ai"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(notes.router,     prefix="/notes",     tags=["notes"])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "rasoread-api", "version": "1.0.0"}
