import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { tempDb, round, mockReq, mockRes } from './helpers.js';
import { saveBest } from '../lib/players.js';
import { getTop10 } from '../lib/top10.js';
import { validateRound } from '../lib/validate.js';
import { createTop10Handler } from '../api/top10.js';

let db;
before(async () => { db = await tempDb(); });
beforeEach(async () => { await db.clear(); });
after(async () => { await db.close(); });

async function play(username, score, map) {
  const v = validateRound(round(username, score, map));
  assert.equal(v.ok, true, username);
  await saveBest(db.client, v.round);
}

test('top10: „Test" (5) apoi „test" (8) → o singură intrare, name „Test", score 8', async () => {
  await play('Test', 5, 'Poiana');
  await play('test', 8, 'Bradu');
  const top = await getTop10(db.client);
  assert.deepEqual(top, [{ rank: 1, name: 'Test', score: 8, map: 'Bradu' }]);
});

test('top10: la egalitate e mai sus cine a atins scorul primul', async () => {
  await play('Primul', 10);
  await play('Alin', 10);   // același scor, mai târziu (și alfabetic înainte)
  await play('Primul', 3);  // o tură mai slabă nu schimbă nimic
  const top = await getTop10(db.client);
  assert.deepEqual(top.map((r) => r.name), ['Primul', 'Alin']);
});

test('top10: harta e cea din primul rând care a atins scorul maxim', async () => {
  await play('Ion', 12, 'Poiana');
  await play('Ion', 12, 'Moci');
  const top = await getTop10(db.client);
  assert.equal(top[0].map, 'Poiana');
});

test('top10: 12 jucători distincți → exact 10, descrescător', async () => {
  for (let i = 1; i <= 12; i++) await play('Jucator' + i, i * 3);
  const top = await getTop10(db.client);
  assert.equal(top.length, 10);
  assert.deepEqual(top.map((r) => r.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
  assert.equal(top[0].name, 'Jucator12');
  assert.equal(top[9].name, 'Jucator3');
});

test('top10: diacriticele se întorc intacte', async () => {
  await play('Ștefănel', 9, 'Grințieșu Mare');
  await play('ȘTEFĂNEL', 4);
  const top = await getTop10(db.client);
  assert.deepEqual(top, [{ rank: 1, name: 'Ștefănel', score: 9, map: 'Grințieșu Mare' }]);
});

test('GET /api/top10: răspuns complet, cu Cache-Control: no-store', async () => {
  await play('Test', 5, 'Grințieșu Mic');
  const handler = createTop10Handler(() => db.client);
  const res = mockRes();
  await handler(mockReq('GET'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.top, [{ rank: 1, name: 'Test', score: 5, map: 'Grințieșu Mic' }]);
  assert.ok(!Number.isNaN(Date.parse(res.body.generatedAt)));

  const post = mockRes();
  await handler(mockReq('POST', {}), post);
  assert.equal(post.statusCode, 405);
});

// Migrarea completează players din turele vechi (rounds), cu regulile vechiului Top 10, și nu schimbă nimic la a doua rulare
test('migrare: recordurile din rounds intră în players', async () => {
  const old = [
    ['r-0001', 'Ana', 'ana', 5, 'Poiana', '2026-11-02T10:00:00.000Z'],
    ['r-0002', 'ANA', 'ana', 9, 'Bradu', '2026-11-02T10:01:00.000Z'],
    ['r-0003', 'ana', 'ana', 9, 'Moci', '2026-11-02T10:02:00.000Z'],   // egal, mai târziu: nu contează
    ['r-0004', 'Ion', 'ion', 9, 'Moci', '2026-11-02T09:00:00.000Z'],   // același scor, atins mai devreme
    ['r-0005', 'Ștefănel', 'ștefănel', 2, 'Poiana', '2026-11-02T11:00:00.000Z']
  ];
  for (const r of old) {
    await db.client.execute({ sql: 'INSERT INTO rounds (round_id, username, username_key, score, map, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: r });
  }
  await db.migrate();
  const expected = [
    { rank: 1, name: 'Ion', score: 9, map: 'Moci' },
    { rank: 2, name: 'Ana', score: 9, map: 'Bradu' },
    { rank: 3, name: 'Ștefănel', score: 2, map: 'Poiana' }
  ];
  assert.deepEqual(await getTop10(db.client), expected);
  await play('Ana', 4);         // după migrare: scor mai mic, nu schimbă nimic
  await db.migrate();           // a doua rulare
  assert.deepEqual(await getTop10(db.client), expected);
});
