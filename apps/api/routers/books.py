import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from typing import Optional

from core.database import get_db
from core.security import get_current_user
from core.config import settings
from models.db import User, Book, Highlight, Note, ReadingProgress
from schemas.pydantic_schemas import BookOut, BookDetailOut, BookMetaUpdate
from services.storage_service import StorageService, upload_file
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
    skip: int = 0,
    limit: int = 50,
    sort: Optional[str] = None,
):
    """List books with optional sorting: title, author, created_at, last_read."""
    query = select(Book).where(Book.user_id == current_user.id)

    # Apply sorting
    if sort == "title":
        query = query.order_by(Book.title.asc())
    elif sort == "author":
        query = query.order_by(Book.author.asc().nullslast())
    elif sort == "last_read":
        # Join with ReadingProgress to sort by last_read_at
        query = query.outerjoin(ReadingProgress).order_by(ReadingProgress.last_read_at.desc().nullslast())
    else:
        query = query.order_by(Book.created_at.desc())

    result = await db.execute(query.offset(skip).limit(limit))
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

    # Upload to storage (returns key; for 'db' backend, bytes go into file_data below)
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
        # Store raw bytes directly in DB when using db backend
        file_data=content if settings.STORAGE_BACKEND == "db" else None,
    )
    db.add(book)
    await db.flush()
    await db.commit()

    logger.info("Book uploaded: %s (%s) by user %s", book.id, file_type, current_user.id)

    # Kick off async processing task — pass book_id so worker can fetch bytes from DB
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


@router.patch("/{book_id}", response_model=dict)
async def update_book_meta(
    book_id: str,
    body: BookMetaUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update editable fields: title, author."""
    book = await _get_user_book(book_id, current_user.id, db)
    if body.title is not None:
        book.title = body.title
    if body.author is not None:
        book.author = body.author
    db.add(book)
    await db.commit()
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
    await db.commit()


async def _get_user_book(book_id: str, user_id: str, db: AsyncSession) -> Book:
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")
    return book


@router.post("/{book_id}/reprocess")
async def reprocess_book(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-trigger processing for a book that failed or needs re-indexing."""
    book = await _get_user_book(book_id, current_user.id, db)

    # Reset status to processing
    book.status = "processing"
    book.error_message = None
    db.add(book)
    await db.commit()

    # Re-queue processing task
    process_book_task.delay(book.id, book.s3_key, book.file_type)

    return {"message": "Book re-processing started", "status": "processing"}


@router.patch("/{book_id}/cover")
async def upload_cover(
    book_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a custom cover image for a book."""
    book = await _get_user_book(book_id, current_user.id, db)

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Invalid file type. Allowed: JPEG, PNG, WebP")

    file_data = await file.read()
    if len(file_data) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(400, "File too large. Maximum 5MB")

    cover_url = await upload_file(file_data, f"covers/{book.id}/{file.filename}", file.content_type)

    book.cover_url = cover_url
    db.add(book)
    await db.commit()

    return {"cover_url": cover_url}


@router.get("/{book_id}/export")
async def export_book(
    book_id: str,
    format: str = "md",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export highlights and notes for a book in various formats."""
    book = await _get_user_book(book_id, current_user.id, db)

    # Get all highlights and notes
    highlights_result = await db.execute(
        select(Highlight).where(Highlight.book_id == book_id, Highlight.user_id == current_user.id)
    )
    highlights = highlights_result.scalars().all()

    notes_result = await db.execute(
        select(Note).where(Note.book_id == book_id, Note.user_id == current_user.id)
    )
    notes = notes_result.scalars().all()

    # Format based on requested type
    if format == "json":
        return {
            "book": {"title": book.title, "author": book.author},
            "highlights": [
                {"text": h.text, "page": h.page, "color": h.color, "created_at": h.created_at.isoformat()}
                for h in highlights
            ],
            "notes": [
                {"content": n.content, "page": n.page, "source": n.source, "created_at": n.created_at.isoformat()}
                for n in notes
            ],
        }
    elif format == "csv":
        lines = ["Type,Page,Content,Created At"]
        for h in highlights:
            lines.append(f"highlight,{h.page},\"{h.text.replace('\"', '\"\"')}\",{h.created_at.isoformat()}")
        for n in notes:
            lines.append(f"note,{n.page or ''},\"{n.content.replace('\"', '\"\"')}\",{n.created_at.isoformat()}")
        return "\n".join(lines)
    else:  # markdown
        md = f"# {book.title}\n"
        if book.author:
            md += f"**Author:** {book.author}\n\n"
        md += "## Highlights\n\n"
        for h in highlights:
            md += f"> {h.text} (p. {h.page})\n\n"
        md += "## Notes\n\n"
        for n in notes:
            page_info = f" (p. {n.page})" if n.page else ""
            md += f"- {n.content}{page_info}\n"
        return md
