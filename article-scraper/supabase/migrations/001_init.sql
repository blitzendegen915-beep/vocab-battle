-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id         UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  url        TEXT         NOT NULL,
  title      TEXT,
  summary    TEXT,
  tags       TEXT[]       DEFAULT '{}',
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Index for listing articles by recency
CREATE INDEX IF NOT EXISTS articles_created_at_idx
  ON articles (created_at DESC);

-- Auto-update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- MVP: allow all operations without authentication
-- Replace with user-scoped policies when adding auth
CREATE POLICY "allow_all_mvp" ON articles
  FOR ALL
  USING (true)
  WITH CHECK (true);
