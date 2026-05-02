import base64
import asyncio

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.database import get_db
from core.security import get_current_user
from models.db import User, Book, ReadingProgress, Bookmark, AnalyticsEvent
from schemas.pydantic_schemas import ProgressIn, ProgressOut, BookmarkIn, BookmarkOut
from services.storage_service import StorageService

router = APIRouter()


async def _get_book_bytes(book: Book) -> bytes:
    """Retrieve raw file bytes from DB blob or storage backend."""
    if book.file_data:
        return book.file_data
    if book.s3_key:
        storage = StorageService()
        return await storage.download(book.s3_key, book_id=book.id)
    raise HTTPException(404, "Book file not found in storage")


def _render_page_from_doc(doc, page_num: int, dpi: int) -> dict:
    """Render a single PDF page from an already-open fitz.Document."""
    if page_num < 1 or page_num > len(doc):
        raise HTTPException(404, f"Page {page_num} not found (book has {len(doc)} pages)")
    fitz_page = doc[page_num - 1]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = fitz_page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
    img_b64 = base64.b64encode(pix.tobytes("png")).decode("utf-8")
    return {
        "page":       page_num,
        "image_b64":  img_b64,
        "width":      pix.width,
        "height":     pix.height,
        "pdf_width":  fitz_page.rect.width,
        "pdf_height": fitz_page.rect.height,
    }


def _render_page(file_bytes: bytes, page_num: int, dpi: int) -> dict:
    """Render a single PDF page to base64 PNG. page_num is 1-based."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        return _render_page_from_doc(doc, page_num, dpi)
    finally:
        doc.close()


@router.get("/{book_id}/page-image")
async def get_page_image(
    book_id: str,
    page: int = 1,
    dpi: int = 150,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render a single PDF page and return it as a base64 PNG."""
    book = await _get_book(book_id, current_user.id, db)
    if book.status != "ready":
        raise HTTPException(202, "Book is still processing")
    if book.file_type != "pdf":
        raise HTTPException(400, "Page images are only available for PDF books")
    try:
        file_bytes = await _get_book_bytes(book)
        return _render_page(file_bytes, page, dpi)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error rendering page: {exc}")


@router.get("/{book_id}/pages-buffer")
async def get_pages_buffer(
    book_id: str,
    start: int = Query(1, ge=1, description="First page to render (1-based)"),
    count: int = Query(3, ge=1, le=5, description="Number of pages to render"),
    dpi: int = Query(150, ge=72, le=300),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Render multiple consecutive PDF pages in one request.
    Returns a list of page image objects for buffered pre-loading.
    Used by the frontend to pre-fetch current + next N pages so page
    transitions are instant with no loading flash.
    """
    book = await _get_book(book_id, current_user.id, db)
    if book.status != "ready":
        raise HTTPException(202, "Book is still processing")
    if book.file_type != "pdf":
        raise HTTPException(400, "Page images are only available for PDF books")

    try:
        file_bytes = await _get_book_bytes(book)
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total = len(doc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Could not open book: {exc}")

    pages_to_render = [p for p in range(start, start + count) if 1 <= p <= total]
    results = []
    try:
        for p in pages_to_render:
            try:
                results.append(_render_page_from_doc(doc, p, dpi))
            except Exception:
                pass
    finally:
        doc.close()

    return {"pages": results, "total_pages": total}


@router.get("/{book_id}/text")
async def get_page_text(
    book_id: str,
    page: int = 1,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return structured text for a single page."""
    book = await _get_book(book_id, current_user.id, db)
    if book.status != "ready":
        raise HTTPException(202, "Book is still processing")

    pages = book.extracted_text.get("pages", [])
    page_data = next((p for p in pages if p["page"] == page), None)
    if not page_data:
        raise HTTPException(404, f"Page {page} not found")

    return page_data


@router.get("/{book_id}/progress", response_model=ProgressOut)
async def get_progress(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.user_id == current_user.id,
        )
    )
    progress = result.scalar_one_or_none()
    if not progress:
        # Auto-create a fresh progress record on first open
        progress = ReadingProgress(
            book_id=book_id,
            user_id=current_user.id,
            current_page=1,
            char_offset=0,
            completion_pct=0.0,
        )
        db.add(progress)
        await db.commit()
        await db.refresh(progress)
    return progress


@router.post("/{book_id}/progress", response_model=ProgressOut)
async def save_progress(
    book_id: str,
    body: ProgressIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_book(book_id, current_user.id, db)

    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.user_id == current_user.id,
        )
    )
    progress = result.scalar_one_or_none()

    if progress:
        progress.current_page = body.current_page
        progress.char_offset = body.char_offset
        progress.tts_speed = body.tts_speed or progress.tts_speed
        progress.voice_id = body.voice_id or progress.voice_id
        if body.completion_pct is not None:
            progress.completion_pct = body.completion_pct
    else:
        progress = ReadingProgress(
            user_id=current_user.id,
            book_id=book_id,
            current_page=body.current_page,
            char_offset=body.char_offset,
            completion_pct=body.completion_pct or 0.0,
            tts_speed=body.tts_speed or 1.0,
            voice_id=body.voice_id or "edge-en-US-AriaNeural",
        )
        db.add(progress)

    # Log analytics event
    event = AnalyticsEvent(
        user_id=current_user.id,
        book_id=book_id,
        event_type="progress_save",
        event_metadata={"page": body.current_page, "pct": body.completion_pct},
    )
    db.add(event)
    await db.commit()
    return progress


@router.get("/{book_id}/bookmarks", response_model=list[BookmarkOut])
async def list_bookmarks(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.book_id == book_id,
            Bookmark.user_id == current_user.id,
        ).order_by(Bookmark.page)
    )
    return result.scalars().all()


@router.post("/{book_id}/bookmarks", response_model=BookmarkOut, status_code=201)
async def add_bookmark(
    book_id: str,
    body: BookmarkIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_book(book_id, current_user.id, db)
    bm = Bookmark(
        user_id=current_user.id,
        book_id=book_id,
        page=body.page,
        label=body.label,
    )
    db.add(bm)
    await db.flush()
    await db.commit()
    return bm


@router.delete("/{book_id}/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(
    book_id: str,
    bookmark_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == current_user.id,
        )
    )
    bm = result.scalar_one_or_none()
    if not bm:
        raise HTTPException(404, "Bookmark not found")
    await db.delete(bm)
    await db.commit()


async def _get_book(book_id: str, user_id: str, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")
    return book
