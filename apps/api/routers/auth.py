from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete
from jose import JWTError, jwt
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid

from core.database import get_db
from core.config import settings
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user, verify_signed_token,
)
from models.db import User, VerificationToken, TokenDenylist
from schemas.pydantic_schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from services.email_service import send_verification_email, send_password_reset_email
from services.storage_service import upload_file

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email, name=body.name, password=hash_password(body.password), is_verified=False)
    db.add(user)
    await db.flush()

    # Create verification token
    token = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    verification = VerificationToken(user_id=user.id, token=token, token_type="verification", expires_at=expires)
    db.add(verification)
    await db.commit()
    await db.refresh(user)

    # Send verification email (will fail silently if SMTP not configured)
    send_verification_email(user.email, token, settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else "http://localhost:3000")

    return TokenResponse(
        access_token=create_access_token(user.id)[0],
        refresh_token=create_refresh_token(user.id)[0],
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token, _ = create_access_token(user.id)
    refresh_token, _ = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
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
        jti: Optional[str] = payload.get("jti")
        if not user_id or payload.get("type") != "refresh":
            raise exc

        # Check if refresh token is denylisted
        if jti:
            result_denylist = await db.execute(
                select(TokenDenylist).where(TokenDenylist.jti == jti)
            )
            if result_denylist.scalar_one_or_none():
                raise exc
    except JWTError:
        raise exc
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise exc

    # Rotate tokens - create new ones
    access_token, _ = create_access_token(user.id)
    refresh_token_new, _ = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_new,
    )


@router.post("/logout")
async def logout(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the current access and refresh tokens by adding to denylist."""
    access_jti = body.get("access_jti")
    refresh_jti = body.get("refresh_jti")

    # Add access token to denylist if provided
    if access_jti:
        access_exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_denylist = TokenDenylist(jti=access_jti, token_type="access", expires_at=access_exp)
        db.add(access_denylist)

    # Add refresh token to denylist if provided
    if refresh_jti:
        refresh_exp = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        refresh_denylist = TokenDenylist(jti=refresh_jti, token_type="refresh", expires_at=refresh_exp)
        db.add(refresh_denylist)

    await db.commit()
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Send password reset email to the user."""
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # Create password reset token
        token = str(uuid.uuid4())
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        reset_token = VerificationToken(user_id=user.id, token=token, token_type="password_reset", expires_at=expires)
        db.add(reset_token)
        await db.commit()

        # Send password reset email
        base_url = settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else "http://localhost:3000"
        send_password_reset_email(user.email, token, base_url)

    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using the token."""
    token = body.get("token")
    new_password = body.get("new_password")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")

    # Find the token
    result = await db.execute(
        select(VerificationToken).where(
            VerificationToken.token == token,
            VerificationToken.token_type == "password_reset",
            VerificationToken.used == False,
        )
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    # Get the user and update password
    user_result = await db.execute(select(User).where(User.id == reset_token.user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(new_password)
    reset_token.used = True
    await db.commit()

    return {"message": "Password reset successfully"}


@router.get("/verify")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Verify user's email address."""
    result = await db.execute(
        select(VerificationToken).where(
            VerificationToken.token == token,
            VerificationToken.token_type == "verification",
            VerificationToken.used == False,
        )
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token has expired")

    # Get the user and mark as verified
    user_result = await db.execute(select(User).where(User.id == verification.user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    verification.used = True
    await db.commit()

    return {"message": "Email verified successfully"}


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload user avatar."""
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")

    # Upload to storage
    file_data = await file.read()
    if len(file_data) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB")

    avatar_url = await upload_file(file_data, f"avatars/{current_user.id}/{file.filename}", file.content_type)

    # Update user avatar
    current_user.avatar_url = avatar_url
    db.add(current_user)
    await db.commit()

    return {"avatar_url": avatar_url}


@router.patch("/me/public")
async def update_public_profile(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update public profile settings."""
    is_public = body.get("is_public", False)
    current_user.settings = {**current_user.settings, "is_public": is_public}
    db.add(current_user)
    await db.commit()
    return {"is_public": is_public}


@router.get("/{user_id}/public")
async def get_public_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get public profile of a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(404, "User not found")

    # Check if profile is public
    is_public = user.settings.get("is_public", False) if user.settings else False
    if not is_public:
        raise HTTPException(404, "Profile not public")

    # Get public stats
    from sqlalchemy import func
    from models.db import Book, ReadingProgress

    # Count books
    books_result = await db.execute(
        select(func.count(Book.id)).where(Book.user_id == user_id)
    )
    total_books = books_result.scalar() or 0

    # Count completed books
    completed_result = await db.execute(
        select(func.count(ReadingProgress.id))
        .where(
            ReadingProgress.user_id == user_id,
            ReadingProgress.completion_pct >= 95
        )
    )
    books_completed = completed_result.scalar() or 0

    # Get streak
    now = datetime.now(timezone.utc)
    last = user.streak_last_date
    alive = last and (now.date() - last.date()).days <= 1

    return {
        "id": user.id,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "bio": user.settings.get("bio") if user.settings else None,
        "stats": {
            "books_count": total_books,
            "books_completed": books_completed,
            "streak_days": user.streak_days if alive else 0,
            "total_listening_minutes": user.total_listening_minutes or 0,
        },
    }


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
