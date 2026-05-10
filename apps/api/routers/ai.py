"""
AI router — Q&A, summarisation, key points, image description, provider info.
All LLM work is routed through services/ai_provider.py.
"""
import json
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
    chat_completion,
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


async def _stream_response(text_generator):
    """Helper to stream text response as SSE."""
    for text in text_generator:
        await asyncio.sleep(0.01)  # Small delay for streaming effect
        yield f"data: {json.dumps({'chunk': text})}\n\n"
    yield "data: [DONE]\n\n"


@router.get("/{book_id}/ask/stream")
async def ask_stream(
    book_id: str,
    question: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Streaming version of ask - returns token-by-token response."""
    book = await _check_book(book_id, current_user.id, db)

    # Get context from RAG
    from services.rag_service import get_relevant_chunks
    chunks = await get_relevant_chunks(book_id, question)

    # Build prompt with context
    context = "\n\n".join([c["text_content"][:500] for c in chunks[:3]])
    prompt = f"""Based on the following context from the book, answer the question.

Context:
{context}

Question: {body.question}

Answer:"""

    async def generate():
        try:
            # Get streaming response from provider
            from services.ai_provider import chat_completion_stream
            async for chunk in chat_completion_stream(prompt):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/{book_id}/summarize/stream")
async def summarize_stream(
    book_id: str,
    chapter_text: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Streaming version of summarize."""
    await _check_book(book_id, current_user.id, db)

    prompt = f"""Summarize the following text concisely:

{chapter_text}

Summary:"""

    async def generate():
        try:
            from services.ai_provider import chat_completion_stream
            async for chunk in chat_completion_stream(prompt):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


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


@router.post("/{book_id}/explain", response_model=AIResponse)
async def explain_text(
    book_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Explain selected text in simple terms."""
    await _check_book(book_id, current_user.id, db)
    text = body.get("text", "")
    if not text:
        raise HTTPException(400, "text required")

    from services.ai_provider import chat_completion
    prompt = f"""Explain the following text in simple, clear terms that a general reader can understand:

"{text}"

Provide a brief, easy-to-understand explanation:"""
    result = await chat_completion(prompt)
    return AIResponse(content=result, type="explanation")


@router.post("/{book_id}/translate", response_model=AIResponse)
async def translate_text(
    book_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Translate selected text to a target language."""
    await _check_book(book_id, current_user.id, db)
    text = body.get("text", "")
    target_lang = body.get("target_lang", "English")

    if not text:
        raise HTTPException(400, "text required")

    from services.ai_provider import chat_completion
    prompt = f"""Translate the following text to {target_lang}. Preserve the original meaning and nuance:

"{text}"

Translation:"""
    result = await chat_completion(prompt)
    return AIResponse(content=result, type="translation")


@router.post("/{book_id}/quiz", response_model=AIResponse)
async def generate_quiz(
    book_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate comprehension questions from book content."""
    book = await _check_book(book_id, current_user.id, db)

    # Get some text from the book to generate questions from
    from models.db import DocumentChunk
    result = await db.execute(
        select(DocumentChunk.text_content)
        .where(DocumentChunk.book_id == book_id)
        .limit(5)
    )
    chunks = result.scalars().all()
    sample_text = "\n\n".join(chunks[:3]) if chunks else ""

    if not sample_text:
        raise HTTPException(400, "No text available to generate quiz from")

    from services.ai_provider import chat_completion
    prompt = f"""Based on the following passage, generate 5 comprehension questions that test understanding of the main ideas and key details. Provide both questions and answers.

Passage:
{sample_text[:3000]}

Format your response as a JSON array of objects with 'question' and 'answer' fields:"""
    result = await chat_completion(prompt)
    return AIResponse(content=result, type="quiz")


@router.post("/{book_id}/generate-toc", response_model=AIResponse)
async def generate_toc(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate table of contents for books without one."""
    book = await _check_book(book_id, current_user.id, db)

    if book.toc and len(book.toc) > 0:
        return AIResponse(content=json.dumps({"toc": book.toc, "note": "Book already has a table of contents"}), type="toc")

    # Get text chunks to analyze
    from models.db import DocumentChunk
    result = await db.execute(
        select(DocumentChunk.text_content)
        .where(DocumentChunk.book_id == book_id)
        .limit(20)
    )
    chunks = result.scalars().all()
    sample_text = "\n\n".join(chunks[:10]) if chunks else ""

    if not sample_text:
        raise HTTPException(400, "No text available to generate TOC from")

    from services.ai_provider import chat_completion
    prompt = f"""Analyze the following text and identify the main chapters or sections. Create a hierarchical table of contents with chapter titles and brief descriptions.

Text:
{sample_text[:5000]}

Format your response as a JSON array of objects with 'title' and 'page_hint' (estimated page number) fields:"""
    result = await chat_completion(prompt)

    # Try to parse the JSON and update the book
    try:
        import re
        json_match = re.search(r'\[[\s\S]*\]', result)
        if json_match:
            new_toc = json.loads(json_match.group())
            book.toc = new_toc
            db.add(book)
            await db.commit()
    except Exception:
        pass  # Keep original response if parsing fails

    return AIResponse(content=result, type="toc")


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
