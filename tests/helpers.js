// Unelte comune pentru teste: bază SQLite locală temporară (fără Turso, fără rețea) și req/res simulate.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

// { client, clear, close } — baza e creată din db/schema.sql, într-un director temporar.
// O bază per fișier de test; clear() golește tabelul între teste.
export async function tempDb() {
  const dir = await mkdtemp(join(tmpdir(), 'grinties-test-'));
  const client = createClient({ url: pathToFileURL(join(dir, 'test.db')).href });
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await client.executeMultiple(schema);
  return {
    client,
    clear() {
      return client.executeMultiple('DELETE FROM players; DELETE FROM rounds;');
    },
    // Reaplică schema (ca `npm run db:migrate` rulat din nou)
    migrate() {
      return client.executeMultiple(schema);
    },
    async close() {
      client.close();
      // Pe Windows fișierul poate rămâne blocat puțin după close(); directorul temporar e doar curățenie
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  };
}

let seq = 0;
export function round(username, score, map = 'Moci') {
  seq += 1;
  return { roundId: 'test-' + String(seq).padStart(4, '0') + '-' + Date.now(), username, score, map };
}

// Răspuns simulat: reține status, headere și corpul JSON
export function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(s) { this.body = s === undefined ? undefined : JSON.parse(s); }
  };
  return res;
}

export function mockReq(method, body) {
  return { method, body };
}

export async function count(client, table = 'players', where = '1', args = []) {
  const rs = await client.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, args });
  return Number(rs.rows[0].n);
}
