import hashlib
import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from core.database import get_db
from models.db import User, TokenDenylist, VerificationToken

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def _prehash(password: str) -> str:
    """SHA-256 pre-hash so bcrypt always receives ≤44 ASCII bytes.

    bcrypt silently truncates inputs > 72 bytes (or raises ValueError in
    some passlib builds). By pre-hashing we preserve full entropy regardless
    of password length.
    """
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")  # always 44 chars


def hash_password(password: str) -> str:
    return pwd_context.hash(_prehash(password))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_prehash(plain), hashed)


def create_access_token(user_id: str) -> tuple[str, str]:
    """Create access token, returns (token, jti)."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return (
        jwt.encode(
            {"sub": user_id, "exp": expire, "type": "access", "jti": jti},
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        ),
        jti,
    )


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Create refresh token, returns (token, jti)."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return (
        jwt.encode(
            {"sub": user_id, "exp": expire, "type": "refresh", "jti": jti},
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        ),
        jti,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: Optional[str] = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
        if user_id is None or payload.get("type") != "access":
            raise credentials_exception

        # Check if token is denylisted
        if jti:
            result = await db.execute(
                select(TokenDenylist).where(TokenDenylist.jti == jti)
            )
            if result.scalar_one_or_none():
                raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


def create_verification_token(user_id: str, token_type: str = "verification") -> tuple[str, datetime]:
    """Create a verification or password reset token."""
    token = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(hours=24 if token_type == "verification" else 1)
    return token, expires


def create_signed_token(user_id: str, token_type: str, expires_delta: timedelta) -> str:
    """Create a signed JWT token for verification/reset."""
    expire = datetime.now(timezone.utc) + expires_delta
    jti = str(uuid.uuid4())
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": token_type, "jti": jti},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


async def add_to_denylist(jti: str, token_type: str, expires_at: datetime, db: AsyncSession):
    """Add a token JTI to the denylist."""
    entry = TokenDenylist(jti=jti, token_type=token_type, expires_at=expires_at)
    db.add(entry)
    await db.commit()


def verify_signed_token(token: str, token_type: str) -> Optional[str]:
    """Verify a signed token and return user_id if valid."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != token_type:
            return None
        return payload.get("sub")
    except JWTError:
        return None
