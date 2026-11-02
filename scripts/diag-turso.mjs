// Diagnostic temporar pentru eroarea HTTP 400 de la Turso. Nu afișează URL-ul complet și nici token-ul.
// Rulare: node scripts/diag-turso.mjs   (după ce afli cauza, fișierul se poate șterge)
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

try { process.loadEnvFile('.env.local'); } catch { /* fără .env.local */ }

const rawUrl = process.env.TURSO_DATABASE_URL ?? '';
const rawToken = process.env.TURSO_AUTH_TOKEN ?? '';

const describe = (label, v) => {
  const issues = [];
  if (v !== v.trim()) issues.push('are spații sau linie nouă la capete');
  if (/["'`]/.test(v)) issues.push('conține ghilimele');
  if (/\s/.test(v.trim())) issues.push('conține spații în interior');
  if (/[^\x21-\x7e]/.test(v)) issues.push('conține caractere ne-ASCII sau invizibile');
  console.log(`${label}: lungime ${v.length}${issues.length ? ' — ATENȚIE: ' + issues.join(', ') : ', format curat'}`);
};

console.log('--- 1. Variabile din .env.local (fără valori)');
if (!rawUrl) { console.log('TURSO_DATABASE_URL lipsește'); process.exit(1); }
describe('TURSO_DATABASE_URL', rawUrl);
describe('TURSO_AUTH_TOKEN', rawToken);

let parsed;
try { parsed = new URL(rawUrl.trim()); } catch { console.log('URL-ul nu se poate interpreta ca URL'); process.exit(1); }
console.log(`schema URL: ${parsed.protocol}  host se termină în: ...${parsed.host.slice(-20)}  path: "${parsed.pathname}"  query: "${parsed.search}"`);
const tok = rawToken.trim();
console.log(`token: începe cu "eyJ" (format JWT): ${tok.startsWith('eyJ')}  segmente separate de punct: ${tok.split('.').length}`);

console.log('\n--- 2. Cerere HTTP directă (SELECT 1) — arată mesajul exact al serverului');
const httpUrl = `https://${parsed.host}/v2/pipeline`;
try {
  const r = await fetch(httpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT 1' } }, { type: 'close' }] })
  });
  const body = await r.text();
  console.log(`status: ${r.status}`);
  console.log(`răspuns: ${body.slice(0, 500)}`);
} catch (e) {
  console.log(`eroare de rețea: ${e.message}`);
}

console.log('\n--- 3. Prin @libsql/client');
const client = createClient({ url: rawUrl.trim(), authToken: tok });
const step = async (label, fn) => {
  try { await fn(); console.log(`OK    ${label}`); return true; }
  catch (e) { console.log(`EROARE ${label}: ${e.code ?? ''} ${e.message}`); return false; }
};
try {
  await step('SELECT 1', () => client.execute('SELECT 1'));
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const noComments = schema.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  const stmts = noComments.split(';').map(s => s.trim()).filter(Boolean);
  for (const [i, s] of stmts.entries()) {
    await step(`schema, instrucțiunea ${i + 1} (${s.split(/\s+/).slice(0, 5).join(' ')} ...)`, () => client.execute(s));
  }
  await step('executeMultiple(schema.sql cu comentarii) — ce face migrate.mjs', () => client.executeMultiple(schema));
  await step('executeMultiple(schema.sql fără comentarii)', () => client.executeMultiple(noComments));
} finally {
  client.close();
}
