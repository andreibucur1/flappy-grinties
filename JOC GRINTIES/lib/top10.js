// Top 10: cel mai bun scor per username_key.
// - la egalitate de scor e mai sus cine a atins scorul primul (created_at mai mic; apoi id, pentru inserări în aceeași milisecundă);
// - name = username-ul din primul rând al cheii (id minim);
// - map = harta din primul rând care a atins scorul maxim.
const TOP10_SQL = `
WITH best AS (
  SELECT username_key, MAX(score) AS score
  FROM rounds
  GROUP BY username_key
),
best_row AS (
  SELECT r.id, r.username_key, r.score, r.map, r.created_at,
         ROW_NUMBER() OVER (PARTITION BY r.username_key ORDER BY r.created_at, r.id) AS rn
  FROM rounds r
  JOIN best b ON b.username_key = r.username_key AND b.score = r.score
),
first_name AS (
  SELECT username_key, username,
         ROW_NUMBER() OVER (PARTITION BY username_key ORDER BY id) AS rn
  FROM rounds
)
SELECT f.username AS name, br.score AS score, br.map AS map
FROM best_row br
JOIN first_name f ON f.username_key = br.username_key AND f.rn = 1
WHERE br.rn = 1
ORDER BY br.score DESC, br.created_at ASC, br.id ASC
LIMIT 10`;

export async function getTop10(client) {
  const rs = await client.execute(TOP10_SQL);
  return rs.rows.map((r, i) => ({ rank: i + 1, name: String(r.name), score: Number(r.score), map: String(r.map) }));
}
