import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { tempDb, round, mockReq, mockRes, count } from './helpers.js';
import { saveBest } from '../lib/players.js';
import { validateRound } from '../lib/validate.js';
import { createScoreHandler } from '../api/score.js';

let db;
let handler;
before(async () => {
  db = await tempDb();
  handler = createScoreHandler(() => db.client);
});
beforeEach(async () => { await db.clear(); });
after(async () => { await db.close(); });

async function post(body) {
  const res = mockRes();
  await handler(mockReq('POST', body), res);
  return res;
}

async function player(key) {
  const rs = await db.client.execute({ sql: 'SELECT username, best, best_map FROM players WHERE username_key = ?', args: [key] });
  return rs.rows[0] ? { username: rs.rows[0].username, best: Number(rs.rows[0].best), map: rs.rows[0].best_map } : null;
}

test('se salvează doar un scor mai mare decât recordul', async () => {
  assert.deepEqual((await post(round('Ana', 7, 'Poiana'))).body, { ok: true, saved: true });   // jucător nou
  assert.deepEqual((await post(round('Ana', 5, 'Moci'))).body, { ok: true, saved: false });    // mai mic
  assert.deepEqual((await post(round('Ana', 7, 'Bradu'))).body, { ok: true, saved: false });   // egal: rămâne primul
  assert.deepEqual(await player('ana'), { username: 'Ana', best: 7, map: 'Poiana' });
  assert.deepEqual((await post(round('ANA', 9, 'Moci'))).body, { ok: true, saved: true });     // record nou
  assert.deepEqual(await player('ana'), { username: 'Ana', best: 9, map: 'Moci' });            // numele rămâne prima formă
  assert.equal(await count(db.client), 1);
  assert.equal(await count(db.client, 'rounds'), 0);                                            // turele nu se mai scriu
});

test('idempotență: aceeași tură trimisă de două ori nu schimbă nimic a doua oară', async () => {
  const r = validateRound(round('Idem', 7)).round;
  assert.equal((await saveBest(db.client, r)).rowsAffected, 1);
  assert.equal((await saveBest(db.client, r)).rowsAffected, 0);
  assert.equal(await count(db.client), 1);
});

test('POST /api/score: corpul ca text (fără Content-Type JSON) e acceptat', async () => {
  assert.deepEqual((await post(JSON.stringify(round('Text', 3)))).body, { ok: true, saved: true });
});

test('POST /api/score: date invalide → 400 și niciun rând nou', async () => {
  const before = await count(db.client);
  const cases = [
    [{ ...round('=1+1', 5) }, 'username_invalid'],
    [{ ...round('Bun', 1001) }, 'score_invalid'],
    [{ ...round('Bun', -1) }, 'score_invalid'],
    [{ ...round('Bun', 5), map: 'Paris' }, 'map_invalid'],
    [{ ...round('Bun', 5), roundId: 'abc1234' }, 'roundId_invalid']
  ];
  for (const [body, error] of cases) {
    const res = mockRes();
    await handler(mockReq('POST', body), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { ok: false, error });
  }
  assert.equal(await count(db.client), before);
});

test('POST /api/score: JSON invalid → 400 bad_json', async () => {
  for (const body of ['{"roundId":', undefined, 'null', '[1,2]']) {
    const res = mockRes();
    await handler(mockReq('POST', body), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { ok: false, error: 'bad_json' });
  }
  // Vercel aruncă excepție la citirea lui req.body când JSON-ul e invalid
  const req = { method: 'POST', get body() { throw new Error('Invalid JSON'); } };
  const res = mockRes();
  await handler(req, res);
  assert.deepEqual(res.body, { ok: false, error: 'bad_json' });
});

test('POST /api/score: altă metodă → 405', async () => {
  const res = mockRes();
  await handler(mockReq('GET'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'POST');
});

test('POST /api/score: eroare de bază de date → 500 server_error, fără detalii', async () => {
  const broken = createScoreHandler(() => { throw new Error('secret: conexiune refuzată'); });
  const res = mockRes();
  const origError = console.error;
  console.error = () => {};
  try {
    await broken(mockReq('POST', round('Ana', 4)), res);
  } finally {
    console.error = origError;
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { ok: false, error: 'server_error' });
});
