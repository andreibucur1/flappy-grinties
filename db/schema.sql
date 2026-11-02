-- Schema bazei de date (Turso / SQLite). Se aplică cu `npm run db:migrate`; rulată de mai multe ori nu schimbă nimic.
-- username_key = username.trim().toLocaleLowerCase('ro'), calculat în JavaScript (LOWER() din SQLite nu știe diacritice).
CREATE TABLE IF NOT EXISTS rounds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id      TEXT    NOT NULL UNIQUE,
  username      TEXT    NOT NULL,
  username_key  TEXT    NOT NULL,
  score         INTEGER NOT NULL CHECK (score >= 0),
  map           TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_rounds_key_score ON rounds (username_key, score DESC, created_at);
