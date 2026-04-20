-- RasoRead database initialization
-- Run automatically via docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Tables are created by SQLAlchemy on startup.
-- This file handles extensions and indexes only.

-- Full-text search index on book titles
CREATE INDEX IF NOT EXISTS idx_books_title_fts
  ON books USING gin(to_tsvector('english', title));

-- Composite index for fast user library queries
CREATE INDEX IF NOT EXISTS idx_books_user_created
  ON books(user_id, created_at DESC);

-- Analytics time-series index
CREATE INDEX IF NOT EXISTS idx_analytics_user_time
  ON analytics_events(user_id, created_at DESC);
