// Top 10: primele 10 recorduri din players, prin indexul idx_players_best (se citesc ~10 rânduri, oricâți jucători ar fi).
// La egalitate de scor e mai sus cine a atins scorul primul (best_at mai mic; apoi rowid, pentru salvări în aceeași milisecundă).
const TOP10_SQL = `
SELECT username AS name, best AS score, best_map AS map
FROM players
ORDER BY best DESC, best_at ASC, rowid ASC
LIMIT 10`;

export async function getTop10(client) {
  const rs = await client.execute(TOP10_SQL);
  return rs.rows.map((r, i) => ({ rank: i + 1, name: String(r.name), score: Number(r.score), map: String(r.map) }));
}
