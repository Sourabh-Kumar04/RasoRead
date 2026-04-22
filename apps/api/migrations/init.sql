-- RasoRead database initialization
-- Run automatically via docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Tables are created by SQLAlchemy on first API startup.
-- Indexes below are created only when the tables already exist
-- (safe to run at DB init time and after migrations).

DO $$
BEGIN
  -- Full-text search index on book titles
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'books'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_books_title_fts
      ON books USING gin(to_tsvector('english', title));

    CREATE INDEX IF NOT EXISTS idx_books_user_created
      ON books(user_id, created_at DESC);
  END IF;

  -- Analytics time-series index
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'analytics_events'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_user_time
      ON analytics_events(user_id, created_at DESC);
  END IF;
END
$$;
