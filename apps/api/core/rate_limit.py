"""
Simple in-memory + Redis rate limiter for FastAPI.
Protects expensive endpoints like /tts/stream and /ai/*.
"""
import time
from collections import defaultdict
from typing import Optional

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

# Per-user limits (requests per window)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    # path_prefix: (max_requests, window_seconds)
    "/tts/stream": (30, 60),    # 30 TTS calls per minute
    "/ai/":        (20, 60),    # 20 AI calls per minute
    "/books/upload": (10, 3600), # 10 uploads per hour
}

# In-memory fallback (use Redis in production)
_counters: dict[str, list[float]] = defaultdict(list)


def _get_user_key(request: Request) -> str:
    """Extract user identifier from JWT or IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        # Use first 16 chars of token as key (no need to decode)
        return f"token:{auth[7:23]}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def check_rate_limit(key: str, path: str) -> None:
    """Raise 429 if the user has exceeded the rate limit for this path."""
    for prefix, (max_req, window) in RATE_LIMITS.items():
        if not path.startswith(prefix):
            continue

        bucket_key = f"{key}:{prefix}"
        now = time.time()

        # Remove expired timestamps
        _counters[bucket_key] = [
            ts for ts in _counters[bucket_key]
            if now - ts < window
        ]

        if len(_counters[bucket_key]) >= max_req:
            reset_in = int(window - (now - _counters[bucket_key][0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {reset_in}s.",
                headers={"Retry-After": str(reset_in)},
            )

        _counters[bucket_key].append(now)
        break


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_key = _get_user_key(request)
        try:
            check_rate_limit(user_key, request.url.path)
        except HTTPException as exc:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=exc.headers or {},
            )
        return await call_next(request)
