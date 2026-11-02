// GET /api/top10  → { ok, top: [{ rank, name, score, map }], generatedAt }
import { getDb } from '../lib/db.js';
import { sendJson } from '../lib/http.js';
import { getTop10 } from '../lib/top10.js';

const NO_STORE = { 'Cache-Control': 'no-store' }; // clasamentul nu trebuie să rămână vechi în vreun cache

export function createTop10Handler(getClient) {
  return async function handler(req, res) {
    if (req.method !== 'GET') {
      return sendJson(res, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET', ...NO_STORE });
    }
    try {
      const top = await getTop10(getClient());
      return sendJson(res, 200, { ok: true, top, generatedAt: new Date().toISOString() }, NO_STORE);
    } catch (err) {
      console.error('GET /api/top10:', err);
      return sendJson(res, 500, { ok: false, error: 'server_error' }, NO_STORE);
    }
  };
}

export default createTop10Handler(getDb);
