# RasoRead — Code Review

## Project Summary

RasoRead is an AI-powered audio reading platform. It's a monorepo with:
- `apps/web` — Next.js 14 frontend
- `apps/api` — FastAPI backend
- `packages/shared-types` — shared TypeScript types

---

## Architecture

```
User → Next.js (React + Zustand) → FastAPI → PostgreSQL
                                          → Redis / Celery (async processing)
                                          → FAISS (RAG vector store)
                                          → AI Providers (Gemini / Groq / OpenAI)
                                          → Storage (DB blob / local / S3)
```

---

## What's Working Well

### Backend
- Clean separation of concerns: routers → services → models
- Multi-provider AI abstraction (`ai_provider.py`) with graceful degradation
- Magic-byte MIME detection instead of trusting client headers — good security
- Async SQLAlchemy throughout — no blocking DB calls
- Alembic migrations in place
- Rate limiting middleware
- JWT access + refresh token pattern with auto-refresh interceptor on frontend
- Celery for async document processing — correct approach for large files
- FAISS RAG with chunking and overlap — solid baseline

### Frontend
- Zustand stores are well-scoped (`readerStore` vs `sessionStore`)
- IndexedDB offline cache with queue-and-flush pattern for highlights
- Debounced progress save (2s) — avoids hammering the API
- TTS sync via `requestAnimationFrame` loop matching `currentTime` to word timestamps
- SSE streaming for TTS audio + timestamps — correct architecture
- Web Speech API fallback when no API key is configured

---

## Issues & Recommendations

### 1. Security — JWT secret default
**File:** `apps/api/core/config.py`
```python
JWT_SECRET: str = "change-me"   # ← dangerous default
```
This will silently work in production if `.env` is misconfigured. Add a startup assertion:
```python
from core.config import settings
assert settings.JWT_SECRET != "change-me", "JWT_SECRET must be set in production"
```

### 2. Missing DB transaction commit
**File:** `apps/api/routers/auth.py`
`db.flush()` is called after adding a user but `await db.commit()` is never called explicitly. This relies on the session middleware auto-committing. Make it explicit:
```python
db.add(user)
await db.commit()
await db.refresh(user)
```

### 3. TTS word timestamps are analytical, not real
**File:** `apps/api/services/tts_service.py`
The character-rate model is a placeholder. For production accuracy, use:
- Google Cloud TTS `timepoints` feature
- ElevenLabs `/with-timestamps` endpoint
- OpenAI TTS does not provide word timestamps natively — consider Whisper alignment

### 4. Highlight `start_char` / `end_char` always 0
**File:** `apps/web/components/reader/DocumentViewer.tsx`
```ts
start_char: 0, end_char: text.length,  // ← not real offsets
```
The actual DOM selection range is available via `_range` but is discarded. This makes highlights non-reproducible across sessions.

### 5. `any` type in UploadDropzone
**File:** `apps/web/components/library/UploadDropzone.tsx`
```ts
onUploadSuccess: (book: any) => void;
```
Should use the `BookOut` type from `packages/shared-types`.

### 6. Offline highlight queue never re-submits
**File:** `apps/web/hooks/useReadingSession.ts`
```ts
const handleOnline = async () => {
  const queue = await offlineCache.flushHighlightQueue();
  // Re-submit queued highlights
  // (import notesApi here if needed)   ← TODO left in code
};
```
The flush logic is incomplete — queued highlights are deleted but never sent to the API.

### 7. RAG skipped silently for Groq-only setups
**File:** `apps/api/services/rag_service.py`
When only `GROQ_API_KEY` is set, RAG indexing is skipped with a log warning. The user gets no feedback in the UI that Q&A won't work. Surface this via the `/ai/providers` endpoint.

### 8. `file_data` stored as raw bytes in PostgreSQL
**File:** `apps/api/models/db.py`
`LargeBinary` on the `Book` model stores the entire file in Postgres when `STORAGE_BACKEND=db`. This will degrade DB performance at scale. The `db` backend is fine for development but should be gated behind an explicit warning in production.

### 9. No pagination on book list
**File:** `apps/api/routers/books.py`
`GET /books` returns all books for a user with no limit. Add `skip`/`limit` query params.

### 10. `confirm()` used for delete confirmation
**File:** `apps/web/components/library/BookCard.tsx`
```ts
if (!confirm(`Delete "${book.title}"?`)) return;
```
`window.confirm` is blocked in some browsers and iframes. Replace with a modal dialog.

---

## Quick Wins (Low Effort, High Value)

| # | File | Fix |
|---|------|-----|
| 1 | `config.py` | Assert `JWT_SECRET != "change-me"` on startup |
| 2 | `auth.py` | Add explicit `await db.commit()` |
| 3 | `UploadDropzone.tsx` | Replace `any` with `BookOut` type |
| 4 | `useReadingSession.ts` | Complete the offline highlight re-submit |
| 5 | `books.py` | Add pagination to `GET /books` |
| 6 | `BookCard.tsx` | Replace `confirm()` with a modal |

---

## Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Zustand, Tailwind, Framer Motion, Radix UI |
| Backend | FastAPI, SQLAlchemy (async), Alembic, Celery |
| Database | PostgreSQL, Redis |
| AI | Gemini (default), Groq, OpenAI |
| TTS | Google Cloud TTS, OpenAI TTS, ElevenLabs, Web Speech API |
| Storage | PostgreSQL blob / local filesystem / AWS S3 |
| Search | FAISS (local), pgvector recommended for production |
| Deployment | Docker Compose (local), Vercel + Railway (production) |
