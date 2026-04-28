from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RasoRead"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rasoread:rasoread@localhost:5432/rasoread"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Storage
    STORAGE_BACKEND: str = "local"   # local | s3  (never use 'db' — stores raw bytes in Postgres)
    LOCAL_STORAGE_PATH: str = "./uploads"
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # ── AI Provider (for RAG / summarisation / Q&A) ───────────────────────────
    # Options: gemini | groq | openai
    # Gemini is the default — set GEMINI_API_KEY to activate it.
    AI_PROVIDER: str = "gemini"

    # Google Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"          # fast & free-tier friendly
    GEMINI_PRO_MODEL: str = "gemini-1.5-pro"         # used for image description

    # Groq (ultra-fast inference — Llama, Mixtral, etc.)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-70b-versatile"     # top open-source option

    # OpenAI (fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── TTS Provider ──────────────────────────────────────────────────────────
    # Options: gemini | openai | elevenlabs | webspeech
    # Gemini TTS uses Google Cloud Text-to-Speech (requires GEMINI_API_KEY or
    # GOOGLE_APPLICATION_CREDENTIALS). Falls back to OpenAI if unavailable.
    TTS_PROVIDER: str = "gemini"

    # ElevenLabs (premium quality TTS)
    ELEVENLABS_API_KEY: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # ── File limits ───────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 100
    ALLOWED_MIME_TYPES: List[str] = [
        "application/pdf",
        "application/epub+zip",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Guard against insecure defaults in production
if settings.ENVIRONMENT == "production":
    assert settings.JWT_SECRET != "change-me", (
        "JWT_SECRET must be changed from the default value in production. "
        "Set a strong random secret in your .env file."
    )
    assert settings.STORAGE_BACKEND != "db", (
        "STORAGE_BACKEND=db is not recommended for production. "
        "Use 'local' or 's3' instead to avoid storing large files in PostgreSQL."
    )
