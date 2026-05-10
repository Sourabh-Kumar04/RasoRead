from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from core.database import get_db
from core.security import get_current_user
from models.db import User, Book, Collection, CollectionBook
from pydantic import BaseModel

router = APIRouter()


class CollectionIn(BaseModel):
    name: str
    description: Optional[str] = None
    cover_color: Optional[str] = None


class CollectionOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    cover_color: Optional[str]
    book_count: int = 0
    created_at: str

    class Config:
        from_attributes = True


class AddBookToCollection(BaseModel):
    book_id: str


@router.get("", response_model=list[CollectionOut])
async def list_collections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all collections for the current user."""
    result = await db.execute(
        select(Collection)
        .where(Collection.user_id == current_user.id)
        .order_by(Collection.created_at.desc())
    )
    collections = result.scalars().all()

    output = []
    for c in collections:
        # Count books in collection
        books_result = await db.execute(
            select(CollectionBook).where(CollectionBook.collection_id == c.id)
        )
        book_count = len(books_result.scalars().all())

        output.append(CollectionOut(
            id=c.id,
            name=c.name,
            description=c.description,
            cover_color=c.cover_color,
            book_count=book_count,
            created_at=c.created_at.isoformat(),
        ))
    return output


@router.post("", response_model=CollectionOut, status_code=201)
async def create_collection(
    body: CollectionIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new collection."""
    collection = Collection(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        cover_color=body.cover_color,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        cover_color=collection.cover_color,
        book_count=0,
        created_at=collection.created_at.isoformat(),
    )


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific collection with its books."""
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(404, "Collection not found")

    # Get books in collection
    books_result = await db.execute(
        select(CollectionBook, Book)
        .join(Book, CollectionBook.book_id == Book.id)
        .where(CollectionBook.collection_id == collection_id)
        .order_by(CollectionBook.position)
    )
    books = []
    for cb, book in books_result.all():
        books.append({
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "cover_url": book.cover_url,
            "total_pages": book.total_pages,
            "position": cb.position,
        })

    result_out = CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        cover_color=collection.cover_color,
        book_count=len(books),
        created_at=collection.created_at.isoformat(),
    )
    # Attach books for the detail response
    result_out.books = books  # type: ignore
    return result_out


@router.patch("/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: str,
    body: CollectionIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a collection."""
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(404, "Collection not found")

    collection.name = body.name
    if body.description is not None:
        collection.description = body.description
    if body.cover_color is not None:
        collection.cover_color = body.cover_color

    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    # Count books
    books_result = await db.execute(
        select(CollectionBook).where(CollectionBook.collection_id == collection_id)
    )
    book_count = len(books_result.scalars().all())

    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        cover_color=collection.cover_color,
        book_count=book_count,
        created_at=collection.created_at.isoformat(),
    )


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a collection."""
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(404, "Collection not found")

    await db.delete(collection)
    await db.commit()


@router.post("/{collection_id}/books")
async def add_book_to_collection(
    collection_id: str,
    body: AddBookToCollection,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a book to a collection."""
    # Verify collection belongs to user
    coll_result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = coll_result.scalar_one_or_none()
    if not collection:
        raise HTTPException(404, "Collection not found")

    # Verify book belongs to user
    book_result = await db.execute(
        select(Book).where(
            Book.id == body.book_id,
            Book.user_id == current_user.id,
        )
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")

    # Check if already in collection
    existing = await db.execute(
        select(CollectionBook).where(
            CollectionBook.collection_id == collection_id,
            CollectionBook.book_id == body.book_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Book already in collection")

    # Get max position
    max_pos_result = await db.execute(
        select(CollectionBook.position).where(
            CollectionBook.collection_id == collection_id
        ).order_by(CollectionBook.position.desc())
    )
    max_pos = max_pos_result.scalar() or 0

    # Add to collection
    cb = CollectionBook(
        collection_id=collection_id,
        book_id=body.book_id,
        position=max_pos + 1,
    )
    db.add(cb)
    await db.commit()

    return {"message": "Book added to collection"}


@router.delete("/{collection_id}/books/{book_id}", status_code=204)
async def remove_book_from_collection(
    collection_id: str,
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a book from a collection."""
    # Verify collection belongs to user
    coll_result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    if not coll_result.scalar_one_or_none():
        raise HTTPException(404, "Collection not found")

    # Find and remove
    result = await db.execute(
        select(CollectionBook).where(
            CollectionBook.collection_id == collection_id,
            CollectionBook.book_id == book_id,
        )
    )
    cb = result.scalar_one_or_none()
    if not cb:
        raise HTTPException(404, "Book not in collection")

    await db.delete(cb)
    await db.commit()