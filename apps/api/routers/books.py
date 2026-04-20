import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from core.database import get_db
from core.security import get_current_user
from core.config import settings
from models.db import User, Book
from schemas.pydantic_schemas import BookOut, BookDetailOut
from services.storage_service import StorageService
from services.document_processor import process_book_task
from services.cover_service import extract_cover, cover_to_data_url

logger = logging.getLogger(__name__)
router = APIRouter()
storage = StorageService()

FILE_TYPE_MAP = {
    "application/pdf": "pdf",
    "application/epub+zip": "epub",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


@router.get("", response_model=list[BookOut])
async def list_books(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Book)
        .where(Book.user_id == current_user.id)
        .order_by(Book.created_at.desc())
    )
    return result.scalars().all()


@router.post("/upload", response_model=BookOut, status_code=201)
async def upload_book(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()

    # Size check
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    # Detect MIME via magic bytes (don't trust client Content-Type)
    try:
        import magic as _magic
        detected_mime = _magic.from_buffer(content, mime=True)
    except Exception:
        detected_mime = file.content_type or "application/octet-stream"

    if detected_mime not in FILE_TYPE_MAP:
        raise HTTPException(
            415,
            f"Unsupported file type '{detected_mime}'. "
            "Accepted: PDF, EPUB, DOCX, TXT."
        )

    file_type = FILE_TYPE_MAP[detected_mime]

    # Upload to storage
    s3_key = await storage.upload(content, file.filename or "upload", detected_mime)

    # Extract cover synchronously (fast, <1s)
    cover_b64 = None
    try:
        raw_cover = extract_cover(content, file_type)
        if raw_cover:
            cover_b64 = cover_to_data_url(raw_cover)
    except Exception as exc:
        logger.warning("Cover extraction failed: %s", exc)

    # Derive clean title
    raw_name = (file.filename or "Untitled").rsplit(".", 1)[0]
    title = raw_name.replace("_", " ").replace("-", " ").strip().title()

    book = Book(
        user_id=current_user.id,
        title=title,
        file_type=file_type,
        s3_key=s3_key,
        cover_url=cover_b64,
        status="processing",
    )
    db.add(book)
    await db.flush()

    logger.info("Book uploaded: %s (%s) by user %s", book.id, file_type, current_user.id)

    # Kick off async processing task
    process_book_task.delay(book.id, s3_key, file_type)

    return book


@router.get("/{book_id}", response_model=BookDetailOut)
async def get_book(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_book(book_id, current_user.id, db)


@router.get("/{book_id}/status")
async def book_status(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    book = await _get_user_book(book_id, current_user.id, db)
    return {"status": book.status, "error": book.error_message}


@router.patch("/{book_id}")
async def update_book_meta(
    book_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update editable fields: title, author."""
    book = await _get_user_book(book_id, current_user.id, db)
    if "title" in body:
        book.title = body["title"][:500]
    if "author" in body:
        book.author = body["author"][:255]
    db.add(book)
    return {"id": book.id, "title": book.title, "author": book.author}


@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    book = await _get_user_book(book_id, current_user.id, db)
    try:
        await storage.delete(book.s3_key)
    except Exception as exc:
        logger.warning("Storage delete failed for %s: %s", book.s3_key, exc)
    await db.execute(delete(Book).where(Book.id == book_id))


async def _get_user_book(book_id: str, user_id: str, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")
    return book
