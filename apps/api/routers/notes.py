from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from core.database import get_db
from core.security import get_current_user
from models.db import User, Book, Highlight, Note
from schemas.pydantic_schemas import HighlightIn, HighlightOut, NoteIn, NoteOut

router = APIRouter()


# ── Public share endpoint (no auth required) ──────────────────────────────────

@router.get("/highlights/{highlight_id}/share")
async def share_highlight(
    highlight_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — returns just enough data to render a share card.
    No auth required so the link works for anyone.
    """
    result = await db.execute(select(Highlight).where(Highlight.id == highlight_id))
    h = result.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "Highlight not found")

    book_result = await db.execute(select(Book).where(Book.id == h.book_id))
    book = book_result.scalar_one_or_none()

    return {
        "text":       h.text,
        "book_title": book.title if book else "Unknown",
        "author":     book.author if book else None,
        "page":       h.page,
        "color":      h.color,
    }


# ── Highlights ────────────────────────────────────────────────────────────────

@router.get("/highlights", response_model=list[HighlightOut])
async def list_highlights(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Highlight).where(
            Highlight.book_id == book_id,
            Highlight.user_id == current_user.id,
        ).order_by(Highlight.page, Highlight.start_char)
    )
    return result.scalars().all()


@router.post("/highlights", response_model=HighlightOut, status_code=201)
async def create_highlight(
    body: HighlightIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    h = Highlight(
        user_id=current_user.id,
        book_id=body.book_id,
        page=body.page,
        start_char=body.start_char,
        end_char=body.end_char,
        text=body.text,
        color=body.color,
    )
    db.add(h)
    await db.flush()
    return h


@router.delete("/highlights/{highlight_id}", status_code=204)
async def delete_highlight(
    highlight_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Highlight).where(
            Highlight.id == highlight_id,
            Highlight.user_id == current_user.id,
        )
    )
    h = result.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "Highlight not found")
    await db.delete(h)


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.get("/notes", response_model=list[NoteOut])
async def list_notes(
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(
            Note.book_id == book_id,
            Note.user_id == current_user.id,
        ).order_by(Note.created_at.desc())
    )
    return result.scalars().all()


@router.post("/notes", response_model=NoteOut, status_code=201)
async def create_note(
    body: NoteIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = Note(
        user_id=current_user.id,
        book_id=body.book_id,
        highlight_id=body.highlight_id,
        page=body.page,
        start_char=body.start_char,
        content=body.content,
        source=body.source,
    )
    db.add(note)
    await db.flush()
    return note


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(404, "Note not found")
    await db.delete(note)
