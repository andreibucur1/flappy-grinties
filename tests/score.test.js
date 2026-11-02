import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tempDb, round, mockReq, mockRes, count } from './helpers.js';
import { insertRound } from '../lib/rounds.js';
import { validateRound } from '../lib/validate.js';
import { createScoreHandler } from '../api/score.js';

let db;
let handler;
before(async () => {
  db = await tempDb();
  handler = createScoreHandler(() => db.client);
});
after(async () => { await db.close(); });

test('idempotență: același roundId de două ori = un singur rând', async () => {
  const r = validateRound(round('Idem', 7)).round;
  const first = await insertRound(db.client, r);
  const second = await insertRound(db.client, r);
  assert.equal(first.rowsAffected, 1);
  assert.equal(second.rowsAffected, 0);
  assert.equal(await count(db.client, 'round_id = ?', [r.roundId]), 1);
});

test('POST /api/score: salvează, apoi răspunde duplicate la retrimitere', async () => {
  const body = round('Test', 5, 'Grințieșu Mic');
  let res = mockRes();
  await handler(mockReq('POST', body), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  res = mockRes();
  await handler(mockReq('POST', body), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, duplicate: true });
  assert.equal(await count(db.client, 'round_id = ?', [body.roundId]), 1);
});

test('POST /api/score: corpul ca text (fără Content-Type JSON) e acceptat', async () => {
  const res = mockRes();
  await handler(mockReq('POST', JSON.stringify(round('Text', 3))), res);
  assert.deepEqual(res.body, { ok: true });
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
