# RasoRead

> AI-powered audio reading platform — your books, now in motion.

---

## Architecture

```
rasoread/
├── apps/
│   ├── web/          # Next.js 14 frontend (React, Tailwind, Framer Motion)
│   └── api/          # FastAPI backend (Python, SQLAlchemy, Celery)
├── packages/
│   └── shared-types/ # Shared TypeScript types
└── docker-compose.yml
```

---

## Quick Start (Docker)

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY (and optionally ELEVENLABS_API_KEY)

docker compose up --build
```

- Frontend: http://localhost:3000

### Backend
- API docs: http://localhost:8000/docs
- pgAdmin / DB: postgresql://rasoread:rasoread@localhost:5432/rasoread

---

## Local Development

```bash
cd apps/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install tesseract-ocr libmagic1

# Run API server
uvicorn main:app --reload --port 8000

# Run Celery worker (separate terminal)
celery -A core.celery_app worker --loglevel=info
```

### Frontend

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL async URL |
| `REDIS_URL` | Yes | Redis URL for Celery |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `OPENAI_API_KEY` | Recommended | Powers TTS + AI features |
| `ELEVENLABS_API_KEY` | Optional | Premium voice quality |
| `STORAGE_BACKEND` | Yes | `local` or `s3` |
| `AWS_S3_BUCKET` | If s3 | S3 bucket name |
| `TTS_PROVIDER` | Yes | `openai`, `elevenlabs`, or `webspeech` |

---

## Features

### Core
- Upload PDF, EPUB, DOCX, TXT (up to 100MB)
- OCR fallback for scanned PDFs (Tesseract)
- Human-like TTS with word-level sync highlighting (OpenAI TTS-1-HD / ElevenLabs)
- Web Speech API fallback (no API key required)
- Auto-scroll and zoom to active paragraph
- Session-based progress with resume
- Offline reading via IndexedDB cache

### AI
- Chapter summarization (GPT-4o-mini)
- Key point extraction
- RAG-based Q&A (FAISS vector store)
- Image accessibility descriptions (GPT-4o vision)

### Reader UX
- Focus mode (hides all chrome)
- Dark / Sepia / Light themes
- Dyslexia-friendly font mode
- Adjustable font size and TTS speed
- Table of contents with jump-to navigation
- Bookmarks, highlights (4 colors), voice notes

### Voice Commands
Say these while reading:
- "Add note here" — opens notes panel
- "Bookmark this page" — saves current page
- "Next page" / "Previous page"
- "Increase speed" / "Decrease speed"
- "Pause" / "Resume"
- "Focus mode"

### Analytics
- Daily activity chart
- Completion percentage per book
- Most highlighted sections
- Average reading speed trends

---

## API Reference

Full OpenAPI docs at `/docs` when the server is running.

Key endpoints:

```
POST /auth/register        Register user
POST /auth/login           Login → JWT tokens
POST /books/upload         Upload book (multipart)
GET  /books/{id}/status    Poll processing status
GET  /reader/{id}/text     Get page text chunks
POST /reader/{id}/progress Save reading position
POST /tts/stream           Stream TTS audio + timestamps (SSE)
POST /ai/{id}/ask          Ask question about book (RAG)
POST /ai/{id}/summarize    Summarize chapter text
POST /notes/highlights     Create text highlight
POST /notes/notes          Create note
GET  /analytics/summary    Reading analytics
```

---

## TTS Sync Architecture

```
User clicks paragraph
     ↓
Frontend calls POST /tts/stream (SSE)
     ↓
Backend streams:
  1. { type: "timestamps", data: [{word, start, end}] }
  2. { type: "audio", chunk: "<base64 mp3>" }  (repeated)
  3. { type: "done" }
     ↓
Frontend reconstructs MP3, plays via HTMLAudioElement
requestAnimationFrame loop matches currentTime → word index
     ↓
Active word gets .word-token.active class → highlight
```

If no API key is set, backend sends `{ type: "use_webspeech" }` and frontend uses the browser's built-in SpeechSynthesis API with `onboundary` events for word-level sync.

---

## Deployment

### Vercel + Railway

```bash
# Frontend → Vercel
cd apps/web
vercel deploy

# Backend → Railway
railway up --service api
railway up --service worker
```

### Environment on Vercel
Set `NEXT_PUBLIC_API_URL` to your Railway API URL.

### Scaling
- Add more Celery workers for parallel document processing
- Use pgvector instead of FAISS for production RAG (scales with Postgres)
- Enable CloudFront CDN for TTS audio caching
- Add Redis rate limiting on `/tts/stream` per user

---

## Edge Cases Handled

| Scenario | Handling |
|---|---|
| Large PDF (500+ pages) | Async Celery task, page-by-page processing |
| Scanned PDF (no text) | OCR via Tesseract per page |
| Corrupted file | Magic byte validation + try/except per page |
| Network offline | IndexedDB cache serves last loaded page |
| No API key | Web Speech API TTS fallback |
| File too large | 100MB limit enforced before upload |
| Wrong MIME type | Magic byte detection (not client header) |
| Auth expired | Auto-refresh via interceptor |

---

## Future Improvements

- React Native mobile app (reuses hooks + API)
- AI Tutor mode — pause + explain any concept on demand
- Collaborative highlights — share annotations with reading groups
- Custom voice cloning — read in the user's own voice
- Multi-language TTS with auto-translation
- Readwise / Notion / Obsidian export for highlights
- Epub cover art extraction for rich library thumbnails
- Speed reading mode (RSVP — one word at a time)
