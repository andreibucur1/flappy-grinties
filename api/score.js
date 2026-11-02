// POST /api/score  { roundId, username, score, map } → { ok: true, saved: true|false }
// Se salvează doar un record (scor mai mare decât cel al jucătorului); altfel saved: false și nu se scrie nimic.
import { getDb } from '../lib/db.js';
import { sendJson, readJsonBody } from '../lib/http.js';
import { saveBest } from '../lib/players.js';
import { validateRound } from '../lib/validate.js';

// getClient se injectează, ca testele să ruleze handler-ul peste o bază locală temporară
export function createScoreHandler(getClient) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
    }

    let body;
    try {
      body = readJsonBody(req);
    } catch {
      return sendJson(res, 400, { ok: false, error: 'bad_json' });
    }

    const v = validateRound(body);
    if (!v.ok) return sendJson(res, 400, { ok: false, error: v.error });

    try {
      const rs = await saveBest(getClient(), v.round);
      return sendJson(res, 200, { ok: true, saved: rs.rowsAffected > 0 });
    } catch (err) {
      console.error('POST /api/score:', err);
      return sendJson(res, 500, { ok: false, error: 'server_error' });
    }
  };
}

export default createScoreHandler(getDb);
