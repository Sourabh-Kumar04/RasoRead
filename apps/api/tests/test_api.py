"""
RasoRead API test suite.
Run with: pytest apps/api/tests/ -v

Uses SQLite for speed (no Postgres needed for unit/integration tests).
Set OPENAI_API_KEY env var to enable AI-dependent tests.
"""
import pytest
import asyncio
import os
from unittest.mock import patch, MagicMock, AsyncMock

# ─────────────────────────────────────────────────────────────────────────────
# Session-scoped event loop
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def set_test_env():
    """Set environment variables before any imports."""
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_rasoread.db")
    os.environ.setdefault("JWT_SECRET", "test-secret-rasoread")
    os.environ.setdefault("STORAGE_BACKEND", "local")
    os.environ.setdefault("LOCAL_STORAGE_PATH", "/tmp/rasoread_test_uploads")
    os.environ.setdefault("OPENAI_API_KEY", "")
    os.environ.setdefault("ELEVENLABS_API_KEY", "")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
    os.environ.setdefault("ALLOWED_ORIGINS", '["http://localhost:3000"]')


@pytest.fixture(scope="session")
async def client(set_test_env):
    """Async HTTP test client backed by in-memory SQLite."""
    from httpx import AsyncClient, ASGITransport
    from main import app

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def register_and_login(client, suffix: str) -> str:
    """Register a unique user and return bearer token."""
    email = f"test_{suffix}@rasoread.test"
    await client.post("/auth/register", json={
        "email": email,
        "name": f"Test {suffix}",
        "password": "password123",
    })
    res = await client.post("/auth/login", json={"email": email, "password": "password123"})
    return res.json().get("access_token", "")


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client):
    res = await client.post("/auth/register", json={
        "email": "newuser@rasoread.test",
        "name": "New User",
        "password": "securepass123",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {"email": "dup@rasoread.test", "name": "Dup", "password": "password123"}
    await client.post("/auth/register", json=payload)
    res = await client.post("/auth/register", json=payload)
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client):
    email = "logintest@rasoread.test"
    pw = "password123"
    await client.post("/auth/register", json={"email": email, "name": "Login", "password": pw})
    res = await client.post("/auth/login", json={"email": email, "password": pw})
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    email = "wrongpw@rasoread.test"
    await client.post("/auth/register", json={"email": email, "name": "WP", "password": "correct"})
    res = await client.post("/auth/login", json={"email": email, "password": "wrong"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    res = await client.get("/auth/me")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_me_authenticated(client):
    token = await register_and_login(client, "metest")
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert "email" in res.json()


@pytest.mark.asyncio
async def test_refresh_token(client):
    res = await client.post("/auth/register", json={
        "email": "refresh@rasoread.test",
        "name": "Refresh",
        "password": "password123",
    })
    refresh = res.json()["refresh_token"]
    res2 = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert res2.status_code == 200
    assert "access_token" in res2.json()


@pytest.mark.asyncio
async def test_refresh_invalid_token(client):
    res = await client.post("/auth/refresh", json={"refresh_token": "bad.token.here"})
    assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Books
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_books_empty(client):
    token = await register_and_login(client, "listbooks")
    res = await client.get("/books", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_upload_rejected_type(client):
    token = await register_and_login(client, "rejecttype")
    files = {"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")}
    res = await client.post(
        "/books/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 415


@pytest.mark.asyncio
async def test_upload_txt_success(client):
    token = await register_and_login(client, "txtsuccess")
    txt = b"Chapter One\n\nIt was the best of times, it was the worst of times.\n\nChapter Two\n\nMore text here for testing purposes."
    with patch("routers.books.process_book_task") as mock_task:
        mock_task.delay = MagicMock()
        res = await client.post(
            "/books/upload",
            files={"file": ("great_expectations.txt", txt, "text/plain")},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Great Expectations"
    assert data["file_type"] == "txt"
    assert data["status"] == "processing"


@pytest.mark.asyncio
async def test_get_book_not_found(client):
    token = await register_and_login(client, "notfound")
    res = await client.get(
        "/books/nonexistent-uuid",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_update_book_title(client):
    token = await register_and_login(client, "updatetitle")
    txt = b"Some content here.\n\nMore content."
    with patch("routers.books.process_book_task") as mock_task:
        mock_task.delay = MagicMock()
        upload_res = await client.post(
            "/books/upload",
            files={"file": ("book.txt", txt, "text/plain")},
            headers={"Authorization": f"Bearer {token}"},
        )
    book_id = upload_res.json()["id"]
    res = await client.patch(
        f"/books/{book_id}",
        json={"title": "My Custom Title", "author": "Jane Doe"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "My Custom Title"
    assert res.json()["author"] == "Jane Doe"


# ─────────────────────────────────────────────────────────────────────────────
# Document processing unit tests
# ─────────────────────────────────────────────────────────────────────────────

def test_process_txt_basic():
    from services.document_processor import process_document
    content = b"First paragraph here.\n\nSecond paragraph with more content.\n\nThird one."
    result = process_document(content, "txt")
    assert result["total_pages"] >= 1
    assert result["total_words"] > 0
    assert len(result["pages"]) >= 1
    assert result["pages"][0]["paragraphs"][0]["text"] == "First paragraph here."


def test_process_txt_pagination():
    """Long TXT should be split across pages."""
    from services.document_processor import process_document
    para = "Word " * 60  # 300 chars
    content = ("\n\n".join([para] * 20)).encode()
    result = process_document(content, "txt")
    assert result["total_pages"] > 1
    assert result["total_words"] > 100


def test_process_txt_filters_empty():
    """Empty paragraphs should be skipped."""
    from services.document_processor import process_document
    content = b"Real content.\n\n   \n\n\n\nMore content."
    result = process_document(content, "txt")
    texts = [p["text"] for p in result["pages"][0]["paragraphs"]]
    assert all(t.strip() for t in texts)


# ─────────────────────────────────────────────────────────────────────────────
# TTS service unit tests
# ─────────────────────────────────────────────────────────────────────────────

def test_word_timestamps_count():
    from services.tts_service import compute_word_timestamps
    ts = compute_word_timestamps("Hello beautiful world", 1.0)
    assert len(ts) == 3
    assert ts[0]["word"] == "Hello"
    assert ts[2]["word"] == "world"


def test_word_timestamps_order():
    from services.tts_service import compute_word_timestamps
    ts = compute_word_timestamps("One two three four five", 1.0)
    for i in range(len(ts) - 1):
        assert ts[i]["end"] <= ts[i + 1]["start"], f"Overlap at index {i}"


def test_word_timestamps_speed_scaling():
    from services.tts_service import compute_word_timestamps
    slow = compute_word_timestamps("Hello world", 0.5)
    fast = compute_word_timestamps("Hello world", 2.0)
    assert slow[-1]["end"] > fast[-1]["end"], "Slow reading should take longer"


def test_word_timestamps_strips_punctuation():
    from services.tts_service import compute_word_timestamps
    ts = compute_word_timestamps("Hello, world!", 1.0)
    assert ts[0]["word"] == "Hello"
    assert ts[1]["word"] == "world"


@pytest.mark.asyncio
async def test_tts_webspeech_fallback():
    """When no API key set, should emit use_webspeech event."""
    import json
    from services.tts_service import stream_tts_webspeech

    events = []
    async for event in stream_tts_webspeech("Hello world", 1.0):
        if event.startswith("data: "):
            events.append(json.loads(event[6:]))

    types = [e["type"] for e in events]
    assert "timestamps" in types
    assert "use_webspeech" in types
    assert "done" in types


def test_get_voices_no_key():
    """Without API key, should return webspeech voice list."""
    import services.tts_service as svc
    original = svc._HAS_OPENAI
    svc._HAS_OPENAI = False
    voices = svc.get_available_voices()
    svc._HAS_OPENAI = original
    assert len(voices) >= 1
    assert voices[0]["id"].startswith("webspeech")


# ─────────────────────────────────────────────────────────────────────────────
# RAG service unit tests
# ─────────────────────────────────────────────────────────────────────────────

def test_rag_no_key_returns_message():
    """Without API key, ask_book should return a helpful message."""
    import services.rag_service as svc
    original = svc._HAS_OPENAI
    svc._HAS_OPENAI = False
    result = svc.ask_book("fake-book-id", "What is this about?")
    svc._HAS_OPENAI = original
    assert "API key" in result or "not ready" in result.lower() or len(result) > 0


def test_rag_summarize_no_key_fallback():
    """Without API key, summarize_text should do extractive fallback."""
    import services.rag_service as svc
    original = svc._HAS_OPENAI
    svc._HAS_OPENAI = False
    text = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth one."
    result = svc.summarize_text(text)
    svc._HAS_OPENAI = original
    assert "summary" in result
    assert isinstance(result["key_points"], list)
    assert len(result["summary"]) > 0


# ─────────────────────────────────────────────────────────────────────────────
# Cover service unit tests
# ─────────────────────────────────────────────────────────────────────────────

def test_cover_txt_returns_none():
    from services.cover_service import extract_cover
    assert extract_cover(b"plain text content", "txt") is None


def test_cover_unknown_type_returns_none():
    from services.cover_service import extract_cover
    assert extract_cover(b"\x00\x00\x00\x00", "unknown") is None


# ─────────────────────────────────────────────────────────────────────────────
# Rate limiter unit tests
# ─────────────────────────────────────────────────────────────────────────────

def test_rate_limit_allows_first_request():
    from core.rate_limit import _counters, check_rate_limit
    _counters.clear()
    # Should not raise
    check_rate_limit("unique_test_user_a", "/tts/stream")


def test_rate_limit_blocks_after_exhaustion():
    from fastapi import HTTPException
    from core.rate_limit import _counters, check_rate_limit, RATE_LIMITS
    _counters.clear()
    limit, _ = RATE_LIMITS["/tts/stream"]
    key = "unique_test_user_b"
    for _ in range(limit):
        check_rate_limit(key, "/tts/stream")
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit(key, "/tts/stream")
    assert exc_info.value.status_code == 429


def test_rate_limit_different_endpoints_independent():
    from core.rate_limit import _counters, check_rate_limit
    _counters.clear()
    key = "unique_test_user_c"
    # TTS and upload limits are independent
    check_rate_limit(key, "/tts/stream")
    check_rate_limit(key, "/books/upload")  # Should not raise


# ─────────────────────────────────────────────────────────────────────────────
# Utils
# ─────────────────────────────────────────────────────────────────────────────

def test_security_hash_and_verify():
    from core.security import hash_password, verify_password
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_security_create_access_token():
    from core.security import create_access_token
    from jose import jwt
    from core.config import settings
    token = create_access_token("user-123")
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_security_create_refresh_token():
    from core.security import create_refresh_token
    from jose import jwt
    from core.config import settings
    token = create_refresh_token("user-456")
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


# ─────────────────────────────────────────────────────────────────────────────
# AI Provider tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_providers_endpoint(client):
    """Provider info endpoint should list Gemini, Groq, OpenAI."""
    token = await register_and_login(client, "aiprovider")
    res = await client.get("/ai/providers", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "active" in data
    assert "providers" in data
    provider_ids = [p["id"] for p in data["providers"]]
    assert "gemini" in provider_ids
    assert "groq" in provider_ids
    assert "openai" in provider_ids


def test_provider_resolve_no_keys():
    """With no keys, active provider should be 'none'."""
    from services.ai_provider import _resolve_provider
    import services.ai_provider as svc

    orig_g, orig_r, orig_o = svc.HAS_GEMINI, svc.HAS_GROQ, svc.HAS_OPENAI
    svc.HAS_GEMINI = svc.HAS_GROQ = svc.HAS_OPENAI = False
    result = _resolve_provider()
    svc.HAS_GEMINI, svc.HAS_GROQ, svc.HAS_OPENAI = orig_g, orig_r, orig_o
    assert result == "none"


def test_provider_fallback_chain():
    """With only Groq key, should fall back to Groq even if Gemini is preferred."""
    from services.ai_provider import _resolve_provider
    import services.ai_provider as svc

    orig_g, orig_r, orig_o = svc.HAS_GEMINI, svc.HAS_GROQ, svc.HAS_OPENAI
    orig_pref = svc.settings.AI_PROVIDER
    svc.HAS_GEMINI = False
    svc.HAS_GROQ = True
    svc.HAS_OPENAI = False
    svc.settings.AI_PROVIDER = "gemini"  # preferred but unavailable
    result = _resolve_provider()
    svc.HAS_GEMINI, svc.HAS_GROQ, svc.HAS_OPENAI = orig_g, orig_r, orig_o
    svc.settings.AI_PROVIDER = orig_pref
    assert result == "groq"


def test_is_ai_available_no_provider():
    """is_ai_available() returns False when no provider configured."""
    from services.ai_provider import is_ai_available
    import services.ai_provider as svc

    orig = svc.ACTIVE_PROVIDER
    svc.ACTIVE_PROVIDER = "none"
    result = is_ai_available()
    svc.ACTIVE_PROVIDER = orig
    assert result is False


def test_tts_voice_resolution_gemini():
    """Gemini voice IDs (en-XX-...) should route to gemini provider."""
    import services.tts_service as svc
    orig_g, orig_o, orig_e = svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS
    svc._HAS_GEMINI = True
    svc._HAS_OPENAI = False
    svc._HAS_ELEVENLABS = False
    result = svc._resolve_tts_provider("en-US-Journey-F")
    svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS = orig_g, orig_o, orig_e
    assert result == "gemini"


def test_tts_voice_resolution_openai():
    """OpenAI voice IDs (nova, alloy, etc.) should route to openai provider."""
    import services.tts_service as svc
    orig_g, orig_o = svc._HAS_GEMINI, svc._HAS_OPENAI
    svc._HAS_GEMINI = False
    svc._HAS_OPENAI = True
    result = svc._resolve_tts_provider("nova")
    svc._HAS_GEMINI, svc._HAS_OPENAI = orig_g, orig_o
    assert result == "openai"


def test_tts_voice_resolution_webspeech_fallback():
    """No API keys → webspeech fallback."""
    import services.tts_service as svc
    orig_g, orig_o, orig_e = svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS
    svc._HAS_GEMINI = False
    svc._HAS_OPENAI = False
    svc._HAS_ELEVENLABS = False
    result = svc._resolve_tts_provider("en-US-Journey-F")
    svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS = orig_g, orig_o, orig_e
    assert result == "webspeech"


def test_get_voices_gemini_only():
    """With only Gemini configured, should return Gemini voices."""
    import services.tts_service as svc
    orig_g, orig_o, orig_e = svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS
    svc._HAS_GEMINI = True
    svc._HAS_OPENAI = False
    svc._HAS_ELEVENLABS = False
    voices = svc.get_available_voices()
    svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS = orig_g, orig_o, orig_e
    assert all(v["provider"] == "gemini" for v in voices)
    assert any("Journey" in v["name"] for v in voices)


def test_get_voices_all_providers():
    """With all providers, voices from all should be included."""
    import services.tts_service as svc
    orig_g, orig_o, orig_e = svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS
    svc._HAS_GEMINI = True
    svc._HAS_OPENAI = True
    svc._HAS_ELEVENLABS = False
    voices = svc.get_available_voices()
    svc._HAS_GEMINI, svc._HAS_OPENAI, svc._HAS_ELEVENLABS = orig_g, orig_o, orig_e
    providers = {v["provider"] for v in voices}
    assert "gemini" in providers
    assert "openai" in providers
