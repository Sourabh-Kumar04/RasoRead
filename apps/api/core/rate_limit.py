"""
Rate limiter + daily usage quotas for RasoRead.
Redis-backed when available, in-memory fallback for local dev.
"""
import time
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

RATE_LIMITS = {"/tts/stream": (30, 60), "/ai/": (20, 60), "/books/upload": (10, 3600)}
DAILY_QUOTAS = {"/tts/stream": 200, "/ai/": 50, "/books/upload": 20}

_redis = None

def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis as r
        from core.config import settings
        c = r.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        c.ping()
        _redis = c
        return _redis
    except Exception:
        return None

_mem_counters = defaultdict(list)
_mem_daily = defaultdict(lambda: defaultdict(int))
_mem_daily_date = {}

def _get_user_key(request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return "token:" + auth[7:23]
    host = request.client.host if request.client else "unknown"
    return "ip:" + host

def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _burst_redis(r, key, prefix, max_req, window):
    b = "rl:burst:" + key + ":" + prefix
    now = time.time()
    p = r.pipeline()
    p.zremrangebyscore(b, 0, now - window)
    p.zcard(b)
    p.zadd(b, {str(now): now})
    p.expire(b, window + 1)
    res = p.execute()
    if res[1] >= max_req:
        raise HTTPException(429, "Rate limit exceeded. Try again in " + str(window) + "s.", headers={"Retry-After": str(window)})

def _daily_redis(r, key, prefix, limit):
    b = "rl:daily:" + key + ":" + prefix + ":" + _today()
    used = r.incr(b)
    if used == 1:
        r.expire(b, 90000)
    if used > limit:
        raise HTTPException(429, "Daily limit of " + str(limit) + " reached. Resets midnight UTC.", headers={"Retry-After": "86400"})

def _burst_mem(key, prefix, max_req, window):
    b = key + ":" + prefix
    now = time.time()
    _mem_counters[b] = [t for t in _mem_counters[b] if now - t < window]
    if len(_mem_counters[b]) >= max_req:
        raise HTTPException(429, "Rate limit exceeded.", headers={"Retry-After": str(window)})
    _mem_counters[b].append(now)

def _daily_mem(key, prefix, limit):
    today = _today()
    if _mem_daily_date.get(key) != today:
        _mem_daily[key] = defaultdict(int)
        _mem_daily_date[key] = today
    if _mem_daily[key][prefix] >= limit:
        raise HTTPException(429, "Daily limit of " + str(limit) + " reached. Resets midnight UTC.", headers={"Retry-After": "86400"})
    _mem_daily[key][prefix] += 1

def check_rate_limit(key, path):
    for prefix in RATE_LIMITS:
        if not path.startswith(prefix):
            continue
        max_req, window = RATE_LIMITS[prefix]
        r = _get_redis()
        if r:
            _burst_redis(r, key, prefix, max_req, window)
            if prefix in DAILY_QUOTAS:
                _daily_redis(r, key, prefix, DAILY_QUOTAS[prefix])
        else:
            _burst_mem(key, prefix, max_req, window)
            if prefix in DAILY_QUOTAS:
                _daily_mem(key, prefix, DAILY_QUOTAS[prefix])
        break

def get_daily_usage(key):
    today = _today()
    result = {}
    r = _get_redis()
    for prefix, limit in DAILY_QUOTAS.items():
        if r:
            used = int(r.get("rl:daily:" + key + ":" + prefix + ":" + today) or 0)
        else:
            used = 0 if _mem_daily_date.get(key) != today else _mem_daily[key].get(prefix, 0)
        result[prefix] = {"used": used, "limit": limit, "remaining": max(0, limit - used)}
    return result

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        key = _get_user_key(request)
        try:
            check_rate_limit(key, request.url.path)
        except HTTPException as exc:
            from fastapi.responses import JSONResponse
            return JSONResponse(exc.status_code, {"detail": exc.detail}, headers=exc.headers or {})
        return await call_next(request)
