"""
Rate limiter + daily usage quotas for RasoRead.

Two layers:
  1. Burst rate limits  — short windows (per minute/hour), in-memory sliding window
  2. Daily quotas       — per-user daily caps stored in-memory (reset at midnight UTC)
     These prevent cost explosions from a single user hammering TTS/AI.

In production: replace _counters and _daily_usage with Redis for multi-instance support.
"""
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

# ── Burst rate limits ─────────────────────────────────────────────────────────
# path_prefix: (max_requests, window_seconds)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/tts/stream":   (30, 60),     # 30 TTS calls per minute
    "/ai/":          (20, 60),     # 20 AI calls per minute
    "/books/upload": (10, 3600),   # 10 uploads per hour
}

# ── Daily quotas (free tier) ──────────────────────────────────────────────────
# path_prefix: max_per_day
DAILY_QUOTAS: dict[str, int] = {
    "/tts/stream":   200,   # 200 TTS streams per day (~3h of audio)
    "/ai/":          50,    # 50 AI queries per day
    "/books/upload": 20,    # 20 book uploads per day
}

# In-memory stores (replace with Redis in production)
_counters:    dict[str, list[float]] = defaultdict(list)
_daily_usage: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
_daily_date:  dict[str, str] = {}   # user_key → last reset date (YYYY-MM-DD)


def _get_user_key(request: Request) -> str:
    """Extract user identifier from JWT token prefix or IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return f"token:{auth[7:23]}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def _reset_daily_if_needed(user_key: str) -> None:
    """Reset daily counters if the date has changed."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _daily_date.get(user_key) != today:
        _daily_usage[user_key] = defaultdict(int)
        _daily_date[user_key] = today


def check_rate_limit(key: str, path: str) -> None:
    """
    Check both burst rate limit and daily quota.
    Raises HTTP 429 if either is exceeded.
    """
    for prefix in RATE_LIMITS:
        if not path.startswith(prefix):
            continue

        max_req, window = RATE_LIMITS[prefix]
        bucket_key = f"{key}:{prefix}"
        now = time.time()

        # ── Burst check ───────────────────────────────────────────────────────
        _counters[bucket_key] = [
            ts for ts in _counters[bucket_key] if now - ts < window
        ]
        if len(_counters[bucket_key]) >= max_req:
            reset_in = int(window - (now - _counters[bucket_key][0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Retry in {reset_in}s.",
                headers={"Retry-After": str(reset_in)},
            )
        _counters[bucket_key].append(now)

        # ── Daily quota check ─────────────────────────────────────────────────
        if prefix in DAILY_QUOTAS:
            _reset_daily_if_needed(key)
            used  = _daily_usage[key][prefix]
            limit = DAILY_QUOTAS[prefix]
            if used >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Daily limit of {limit} requests reached for this feature. "
                        "Resets at midnight UTC."
                    ),
                    headers={"Retry-After": "86400", "X-Daily-Limit": str(limit)},
                )
            _daily_usage[key][prefix] += 1

        break


def get_daily_usage(key: str) -> dict[str, dict]:
    """Return current daily usage stats for a user key (for /me endpoint)."""
    _reset_daily_if_needed(key)
    result = {}
    for prefix, limit in DAILY_QUOTAS.items():
        used = _daily_usage[key].get(prefix, 0)
        result[prefix] = {"used": used, "limit": limit, "remaining": max(0, limit - used)}
    return result


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
