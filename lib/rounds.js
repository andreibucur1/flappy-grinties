// Inserarea unei ture. Idempotentă: același round_id a doua oară nu adaugă nimic (rowsAffected === 0),
// pentru că clientul retrimite turele din coada offline.
export function insertRound(client, round) {
  return client.execute({
    sql: `INSERT INTO rounds (round_id, username, username_key, score, map)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(round_id) DO NOTHING`,
    args: [round.roundId, round.username, round.usernameKey, round.score, round.map]
  });
}
