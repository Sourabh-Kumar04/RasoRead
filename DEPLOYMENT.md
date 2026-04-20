# RasoRead — Deployment Guide

## Option A: Docker Compose (self-hosted, recommended for getting started)

```bash
# 1. Clone and configure
git clone <your-repo>
cd rasoread
cp .env.example .env
# Edit .env — fill in OPENAI_API_KEY, JWT_SECRET, etc.

# 2. Build and start
docker compose up --build -d

# 3. Run migrations (first time only)
docker compose exec api alembic upgrade head

# 4. Check health
curl http://localhost:8000/health

# 5. Open the app
open http://localhost:3000
```

---

## Option B: Vercel + Railway (managed, zero-ops)

### Frontend → Vercel

```bash
cd apps/web
npx vercel --prod
```

Set these environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = your Railway API URL (e.g. `https://rasoread-api.railway.app`)

### Backend + Worker → Railway

1. Create a Railway project
2. Add a PostgreSQL database (pgvector plugin)
3. Add a Redis database
4. Deploy the `apps/api` directory as a service
5. Add a second service with command: `celery -A core.celery_app worker --loglevel=info`

Environment variables to set in Railway:
```
DATABASE_URL        = (auto-set by Railway Postgres plugin)
REDIS_URL           = (auto-set by Railway Redis plugin)
JWT_SECRET          = (generate: openssl rand -hex 32)
OPENAI_API_KEY      = sk-...
ELEVENLABS_API_KEY  = (optional)
STORAGE_BACKEND     = s3
AWS_S3_BUCKET       = your-bucket-name
AWS_REGION          = us-east-1
AWS_ACCESS_KEY_ID   = ...
AWS_SECRET_ACCESS_KEY = ...
TTS_PROVIDER        = openai
ALLOWED_ORIGINS     = https://your-vercel-app.vercel.app
```

### Run migrations on Railway

```bash
railway run alembic upgrade head
```

---

## Option C: AWS (production-scale)

| Component | Service |
|---|---|
| Frontend | CloudFront + S3 static export OR ECS Fargate |
| API | ECS Fargate (auto-scaling) |
| Worker | ECS Fargate (separate task definition) |
| Database | RDS PostgreSQL + pgvector extension |
| Cache/Queue | ElastiCache Redis |
| File Storage | S3 |
| TTS Audio Cache | CloudFront in front of S3 |

### ECS task definition (api)

```json
{
  "family": "rasoread-api",
  "cpu": "512",
  "memory": "1024",
  "networkMode": "awsvpc",
  "containerDefinitions": [{
    "name": "api",
    "image": "your-ecr-repo/rasoread-api:latest",
    "portMappings": [{"containerPort": 8000}],
    "environment": [...],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
    }
  }]
}
```

---

## Scaling tips

### TTS bottleneck
- TTS streaming is CPU/network bound. Run multiple API instances behind an ALB.
- Cache frequently requested chapter audio in S3 (keyed by `book_id:page:voice:speed` hash).

### Document processing
- Celery workers scale independently. Add more worker containers as upload volume grows.
- For very large PDFs (>200 pages), increase `task_time_limit` in Celery config to 600s.

### Vector search (RAG)
- In production, replace FAISS files on disk with pgvector in PostgreSQL.
- This enables multi-instance APIs to share the same index.
- Migration: `CREATE EXTENSION vector;` then store embeddings in a `book_chunks` table.

### Database
- Add a read replica for analytics queries.
- Partition `analytics_events` by month for better query performance.

---

## Monitoring

| What | Tool |
|---|---|
| API errors + latency | Sentry (add `sentry-sdk[fastapi]` to requirements) |
| Celery task monitoring | Flower (`celery -A core.celery_app flower`) |
| Infrastructure metrics | Grafana + Prometheus |
| Uptime | Better Uptime or Freshping (monitor `/health`) |

### Add Sentry (optional)

```python
# In main.py after imports:
import sentry_sdk
sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)
```

---

## Backup

```bash
# Database backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# S3 books backup (versioning recommended)
aws s3 sync s3://your-bucket/books/ ./books-backup/

# FAISS indexes backup
tar -czf faiss_backup_$(date +%Y%m%d).tar.gz faiss_indexes/
```

Set up automated daily backups via cron or AWS Backup.
