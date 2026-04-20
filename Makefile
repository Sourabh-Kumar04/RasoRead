.PHONY: help dev dev-api dev-web dev-worker build test lint clean docker-up docker-down db-migrate db-reset

# ── Default ───────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  RasoRead — development commands"
	@echo ""
	@echo "  make dev            Start everything locally (api + web + worker)"
	@echo "  make dev-api        Start FastAPI server only"
	@echo "  make dev-web        Start Next.js dev server only"
	@echo "  make dev-worker     Start Celery worker only"
	@echo ""
	@echo "  make docker-up      Start all services via Docker Compose"
	@echo "  make docker-down    Stop Docker services"
	@echo ""
	@echo "  make db-migrate     Run Alembic migrations"
	@echo "  make db-reset       Drop and recreate database"
	@echo ""
	@echo "  make test           Run backend test suite"
	@echo "  make lint           Lint frontend and backend"
	@echo "  make build          Build frontend for production"
	@echo "  make clean          Remove build artifacts and caches"
	@echo ""

# ── Local dev ─────────────────────────────────────────────────────────────────
dev:
	@echo "Starting API, Celery worker, and Next.js in parallel..."
	@trap 'kill %1 %2 %3 2>/dev/null; exit' INT; \
	  (cd apps/api && uvicorn main:app --reload --port 8000) & \
	  (cd apps/api && celery -A core.celery_app worker --loglevel=info) & \
	  (cd apps/web && npm run dev) & \
	  wait

dev-api:
	cd apps/api && uvicorn main:app --reload --port 8000

dev-web:
	cd apps/web && npm run dev

dev-worker:
	cd apps/api && celery -A core.celery_app worker --loglevel=info --concurrency=2

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api worker

# ── Database ──────────────────────────────────────────────────────────────────
db-migrate:
	cd apps/api && alembic upgrade head

db-rollback:
	cd apps/api && alembic downgrade -1

db-reset:
	@echo "WARNING: This will DROP all tables. Press Ctrl+C to cancel."
	@sleep 3
	cd apps/api && alembic downgrade base && alembic upgrade head

db-shell:
	psql $$DATABASE_URL

# ── Install ───────────────────────────────────────────────────────────────────
install:
	@echo "Installing backend dependencies..."
	cd apps/api && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd apps/web && npm install
	@echo "Done! Copy .env.example to .env and fill in your keys."

install-test:
	cd apps/api && pip install -r tests/requirements-test.txt

# ── Quality ───────────────────────────────────────────────────────────────────
test:
	cd apps/api && pytest tests/ -v --tb=short

test-watch:
	cd apps/api && ptw tests/ -- -v

lint:
	cd apps/web && npm run lint
	cd apps/api && python -m py_compile main.py routers/*.py services/*.py core/*.py models/*.py

build:
	cd apps/web && npm run build

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	rm -rf apps/web/.next apps/web/node_modules/.cache
	find apps/api -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find apps/api -name "*.pyc" -delete 2>/dev/null || true
	rm -f apps/api/test.db

# ── Setup check ───────────────────────────────────────────────────────────────
check-env:
	@test -f .env || (echo "ERROR: .env file missing. Run: cp .env.example .env" && exit 1)
	@grep -q "OPENAI_API_KEY=sk-" .env || echo "WARNING: OPENAI_API_KEY not set — TTS will use Web Speech API fallback"
	@echo "Environment OK"
