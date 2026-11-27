// Salvarea scorului: doar dacă e mai mare decât recordul jucătorului (sau dacă jucătorul e nou).
// O singură instrucțiune, deci atomică: două ture trimise deodată nu se pot suprascrie greșit.
// rowsAffected === 1 → record salvat; 0 → scorul nu depășește recordul (inclusiv o tură retrimisă din coada offline).
// La un record nou se schimbă scorul, harta și momentul; username rămâne forma din prima salvare.
export function saveBest(client, round) {
  return client.execute({
    sql: `INSERT INTO players (username_key, username, best, best_map)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(username_key) DO UPDATE SET
            best = excluded.best,
            best_map = excluded.best_map,
            best_at = excluded.best_at
          WHERE excluded.best > players.best`,
    args: [round.usernameKey, round.username, round.score, round.map]
  });
}
