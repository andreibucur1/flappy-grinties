// Coada de ture din js/api.js (client), rulată în vm cu fetch și localStorage simulate
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../js/api.js', import.meta.url), 'utf8');

// responses: funcție (round) -> { status, body } sau 'network'
function loadApi(responses) {
  const store = new Map();
  const sent = [];
  const ctx = {
    CONFIG: { api: { base: '/api', timeoutMs: 1000 } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); }
    },
    AbortController, setTimeout, clearTimeout,
    crypto: { getRandomValues: (a) => globalThis.crypto.getRandomValues(a) }, // fără randomUUID, ca pe http
    window: {},
    fetch: async (url, opt) => {
      const round = opt.body ? JSON.parse(opt.body) : null;
      sent.push(round && round.roundId);
      const r = responses(round, url);
      if (r === 'network') throw new TypeError('Failed to fetch');
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    }
  };
  const Api = vm.runInNewContext(src + '\nApi', ctx);
  const queue = () => JSON.parse(store.get('grinties_flappy_pending_v1') || '[]').map((r) => r.roundId);
  return { Api, sent, queue, store };
}

const R = (id) => ({ roundId: id, username: 'Ana', score: 3, map: 'Moci' });

test('coada: ok (record sau nu) scoate tura; 400 o scoate ca respinsă', async () => {
  const { Api, queue } = loadApi((r) =>
    r.roundId === 'round-bad' ? { status: 400, body: { ok: false, error: 'score_invalid' } }
      : r.roundId === 'round-dup' ? { status: 200, body: { ok: true, saved: false } }
        : { status: 200, body: { ok: true, saved: true } });
  Api.queueRound(R('round-001'));
  Api.queueRound(R('round-bad'));
  Api.queueRound(R('round-dup'));
  const saved = await Api.flushQueue();
  assert.equal(saved, 1); // doar recordurile se numără: ele schimbă Top 10
  assert.deepEqual(queue(), []);
  assert.equal(Api.roundStatus('round-001'), 'saved');
  assert.equal(Api.roundStatus('round-dup'), 'notbest');
  assert.equal(Api.roundStatus('round-bad'), 'rejected');
});

test('coada: rețea căzută sau 5xx oprește golirea și păstrează restul, în ordine', async () => {
  let mode = 'network';
  const { Api, queue, sent } = loadApi(() =>
    mode === 'network' ? 'network' : mode === '500' ? { status: 500, body: { ok: false, error: 'server_error' } } : { status: 200, body: { ok: true } });
  Api.queueRound(R('round-001'));
  Api.queueRound(R('round-002'));
  assert.equal(await Api.flushQueue(), 0);
  assert.deepEqual(queue(), ['round-001', 'round-002']);
  assert.equal(Api.roundStatus('round-002'), 'pending');
  assert.deepEqual(sent, ['round-001']); // după prima eroare nu mai încearcă

  mode = '500';
  assert.equal(await Api.flushQueue(), 0);
  assert.deepEqual(queue(), ['round-001', 'round-002']);

  mode = 'ok';
  assert.equal(await Api.flushQueue(), 2);
  assert.deepEqual(queue(), []);
});

test('coada: două goliri simultane nu trimit aceeași tură de două ori', async () => {
  const { Api, sent } = loadApi(() => ({ status: 200, body: { ok: true } }));
  Api.queueRound(R('round-001'));
  await Promise.all([Api.flushQueue(), Api.flushQueue()]);
  assert.deepEqual(sent, ['round-001']);
});

test('Top 10: la eșec se folosește cache-ul, marcat neactualizat; fără cache → null', async () => {
  let up = true;
  const top = [{ rank: 1, name: 'Ștefănel', score: 9, map: 'Moci' }];
  const { Api } = loadApi(() => (up ? { status: 200, body: { ok: true, top, generatedAt: 'x' } } : 'network'));
  const fresh = await Api.loadTop10();
  assert.equal(fresh.stale, false);
  assert.equal(fresh.rows[0].name, 'Ștefănel');
  up = false;
  const old = await Api.loadTop10();
  assert.equal(old.stale, true);
  assert.equal(old.rows[0].score, 9);

  const empty = loadApi(() => 'network').Api;
  assert.deepEqual({ ...(await empty.loadTop10()) }, { rows: null, stale: false });
});

// Pe http (nu https/localhost) crypto.randomUUID lipsește; id-ul construit trebuie să treacă validarea serverului
test('newRoundId: UUID v4 valid și fără crypto.randomUUID', () => {
  const { Api } = loadApi(() => 'network');
  const id = Api.newRoundId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(Api.newRoundId(), id);
});
