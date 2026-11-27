-- Schema bazei de date (Turso / SQLite). Se aplică cu `npm run db:migrate`; rulată de mai multe ori nu schimbă nimic.
-- username_key = username.trim().toLocaleLowerCase('ro'), calculat în JavaScript (LOWER() din SQLite nu știe diacritice).

-- Recordul fiecărui jucător: un rând per username_key. Aici scrie POST /api/score, și doar când scorul e mai mare
-- decât recordul (la egalitate rămâne cel care l-a atins primul). Top 10 citește doar primele rânduri din idx_players_best.
-- username = forma din prima salvare a jucătorului (nu se schimbă la recorduri noi).
CREATE TABLE IF NOT EXISTS players (
  username_key  TEXT    PRIMARY KEY,
  username      TEXT    NOT NULL,
  best          INTEGER NOT NULL CHECK (best >= 0),
  best_map      TEXT    NOT NULL,
  best_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_players_best ON players (best DESC, best_at);

-- Turele jucate până la trecerea pe tabelul players (noiembrie 2026). Nu se mai scrie în el; rămâne ca arhivă
-- și ca sursă pentru completarea de mai jos.
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

-- Completare din rounds: recordul fiecărui jucător intră în players, după regulile vechiului Top 10
-- (cel mai bun scor, harta și momentul primei ture care l-a atins, numele din prima tură a jucătorului).
-- OR IGNORE: jucătorii deja existenți în players nu se ating, deci rularea repetată nu schimbă nimic.
WITH best AS (
  SELECT username_key, MAX(score) AS score FROM rounds GROUP BY username_key
),
best_row AS (
  SELECT r.username_key, r.score, r.map, r.created_at,
         ROW_NUMBER() OVER (PARTITION BY r.username_key ORDER BY r.created_at, r.id) AS rn
  FROM rounds r JOIN best b ON b.username_key = r.username_key AND b.score = r.score
),
first_name AS (
  SELECT username_key, username, ROW_NUMBER() OVER (PARTITION BY username_key ORDER BY id) AS rn FROM rounds
)
INSERT OR IGNORE INTO players (username_key, username, best, best_map, best_at)
SELECT br.username_key, f.username, br.score, br.map, br.created_at
FROM best_row br JOIN first_name f ON f.username_key = br.username_key AND f.rn = 1
WHERE br.rn = 1
ORDER BY br.created_at;
