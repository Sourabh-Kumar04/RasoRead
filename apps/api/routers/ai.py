"""
AI router — Q&A, summarisation, key points, image description, provider info.
All LLM work is routed through services/ai_provider.py.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import get_current_user
from models.db import User, Book
from schemas.pydantic_schemas import AskRequest, SummarizeRequest, AIResponse
from services.rag_service import ask_book, summarize_text
from services.ai_provider import (
    describe_image,
    get_provider_name,
    ACTIVE_PROVIDER,
    is_ai_available,
    HAS_GEMINI,
    HAS_GROQ,
    HAS_OPENAI,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Provider info (public-ish) ─────────────────────────────────────────────────

@router.get("/providers")
async def list_providers(current_user: User = Depends(get_current_user)):
    """
    Return which AI providers are configured and which is active.
    Used by the frontend to show the provider selector.
    """
    return {
        "active": ACTIVE_PROVIDER,
        "active_name": get_provider_name(),
        "available": is_ai_available(),
        "providers": [
            {
                "id": "gemini",
                "name": "Google Gemini",
                "model": "gemini-1.5-flash",
                "configured": HAS_GEMINI,
                "features": ["chat", "embeddings", "tts", "vision"],
            },
            {
                "id": "groq",
                "name": "Groq (Llama 3)",
                "model": "llama-3.1-70b-versatile",
                "configured": HAS_GROQ,
                "features": ["chat"],
                "note": "Embeddings use Gemini or OpenAI as a backend",
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "model": "gpt-4o-mini",
                "configured": HAS_OPENAI,
                "features": ["chat", "embeddings", "tts", "vision"],
            },
        ],
    }


# ── Book-scoped AI endpoints ──────────────────────────────────────────────────

@router.post("/{book_id}/ask", response_model=AIResponse)
async def ask(
    book_id: str,
    body: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a question about the book (RAG-based semantic search + LLM answer)."""
    await _check_book(book_id, current_user.id, db)
    answer = await ask_book(book_id, body.question)
    logger.info("Q&A: book=%s provider=%s", book_id, ACTIVE_PROVIDER)
    return AIResponse(content=answer, type="answer")


@router.post("/{book_id}/summarize", response_model=AIResponse)
async def summarize(
    book_id: str,
    body: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Summarize a chapter or passage."""
    await _check_book(book_id, current_user.id, db)
    result = summarize_text(body.chapter_text)
    return AIResponse(content=json.dumps(result), type="summary")


@router.post("/{book_id}/keypoints", response_model=AIResponse)
async def keypoints(
    book_id: str,
    body: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract key points from a chapter or passage."""
    await _check_book(book_id, current_user.id, db)
    result = summarize_text(body.chapter_text)
    return AIResponse(
        content=json.dumps({"key_points": result.get("key_points", [])}),
        type="keypoints",
    )


@router.post("/{book_id}/describe-image", response_model=AIResponse)
async def describe_image_endpoint(
    book_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an accessibility description for an embedded image."""
    await _check_book(book_id, current_user.id, db)
    image_b64 = body.get("image_b64", "")
    if not image_b64:
        raise HTTPException(400, "image_b64 required")
    description = await describe_image(image_b64)
    return AIResponse(content=description, type="description")


# ── Cross-library search ──────────────────────────────────────────────────────

@router.get("/search")
async def search_library(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search across all of the user's books.
    Uses PostgreSQL websearch_to_tsquery.
    """
    q = q.strip()
    if not q:
        return {"results": [], "query": q}
    if len(q) > 500:
        q = q[:500]  # Clamp to prevent abuse

    from sqlalchemy import func
    from models.db import DocumentChunk

    # Search DocumentChunk joined with Book where user_id == current_user.id
    stmt = (
        select(DocumentChunk, Book.title, Book.author)
        .join(Book, DocumentChunk.book_id == Book.id)
        .where(
            Book.user_id == current_user.id,
            func.to_tsvector('english', DocumentChunk.text_content).op('@@')(func.websearch_to_tsquery('english', q))
        )
        .limit(10)
    )
    result = await db.execute(stmt)
    rows = result.all()

    hits = []
    for row in rows:
        chunk, title, author = row
        hits.append({
            "book_id": chunk.book_id,
            "book_title": title,
            "author": author,
            "excerpt": chunk.text_content[:300],
            "score": 1.0, # Full-text match
        })

    return {
        "results": hits,
        "query": q,
        "ai_available": is_ai_available(),
    }


# ── Helper ────────────────────────────────────────────────────────────────────

async def _check_book(book_id: str, user_id: str, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")
    if book.status == "processing":
        raise HTTPException(202, "Book is still being indexed — try again shortly")
    return book
