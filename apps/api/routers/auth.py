from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from typing import Optional

from core.database import get_db
from core.config import settings
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user,
)
from models.db import User
from schemas.pydantic_schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email, name=body.name, password=hash_password(body.password))
    db.add(user)
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    refresh_token: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    exc = HTTPException(status_code=401, detail="Invalid or expired refresh token")
    try:
        payload = jwt.decode(refresh_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if not user_id or payload.get("type") != "refresh":
            raise exc
    except JWTError:
        raise exc
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise exc
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user), request: Request = None):
    return current_user


@router.get("/me/usage")
async def me_usage(request: Request, current_user: User = Depends(get_current_user)):
    """Return daily quota usage for the current user."""
    from core.rate_limit import get_daily_usage, _get_user_key
    key = _get_user_key(request)
    return get_daily_usage(key)


@router.delete("/me", status_code=204)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete account and all associated data (GDPR compliance)."""
    from sqlalchemy import delete as sql_delete
    from models.db import Book, ReadingProgress, Highlight, Note, Bookmark, AnalyticsEvent
    # Cascade deletes handle books/highlights/notes via FK, but be explicit
    await db.execute(sql_delete(AnalyticsEvent).where(AnalyticsEvent.user_id == current_user.id))
    await db.execute(sql_delete(ReadingProgress).where(ReadingProgress.user_id == current_user.id))
    await db.delete(current_user)
    await db.commit()


@router.patch("/settings")
async def update_settings(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only allow safe preference keys — never let users write arbitrary data
    ALLOWED_KEYS = {"theme", "font_size", "tts_speed", "voice_id", "dyslexia_mode", "focus_mode"}
    safe = {k: v for k, v in body.items() if k in ALLOWED_KEYS}
    if not safe:
        raise HTTPException(400, "No valid settings keys provided")
    current_user.settings = {**current_user.settings, **safe}
    db.add(current_user)
    await db.commit()
    return {"settings": current_user.settings}
