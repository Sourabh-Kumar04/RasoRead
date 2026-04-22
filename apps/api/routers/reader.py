import base64

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.database import get_db
from core.security import get_current_user
from models.db import User, Book, ReadingProgress, Bookmark, AnalyticsEvent
from schemas.pydantic_schemas import ProgressIn, ProgressOut, BookmarkIn, BookmarkOut
from services.storage_service import StorageService

router = APIRouter()


@router.get("/{book_id}/page-image")
async def get_page_image(
    book_id: str,
    page: int = 1,
    dpi: int = 150,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render a PDF page with PyMuPDF and return it as a base64 PNG."""
    book = await _get_book(book_id, current_user.id, db)
    if book.status != "ready":
        raise HTTPException(202, "Book is still processing")
    if book.file_type != "pdf":
        raise HTTPException(400, "Page images are only available for PDF books")

    # Retrieve the raw file bytes (DB blob or storage backend)
    try:
        if book.file_data:
            file_bytes = book.file_data
        elif book.s3_key:
            storage = StorageService()
            file_bytes = await storage.download(book.s3_key, book_id=book_id)
        else:
            raise HTTPException(404, "Book file not found in storage")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Could not retrieve book file: {exc}")

    # Render with PyMuPDF
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        if page < 1 or page > len(doc):
            raise HTTPException(404, f"Page {page} not found (book has {len(doc)} pages)")

        fitz_page = doc[page - 1]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = fitz_page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)

        img_b64 = base64.b64encode(pix.tobytes("png")).decode("utf-8")
        pdf_width  = fitz_page.rect.width
        pdf_height = fitz_page.rect.height
        doc.close()

        return {
            "page":       page,
            "image_b64":  img_b64,
            "width":      pix.width,
            "height":     pix.height,
            "pdf_width":  pdf_width,
            "pdf_height": pdf_height,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error rendering page: {exc}")


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
        raise HTTPException(404, "No progress found — start reading first")
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
            voice_id=body.voice_id or "nova",
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


async def _get_book(book_id: str, user_id: str, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")
    return book
