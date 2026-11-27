// Aplică db/schema.sql pe baza din TURSO_DATABASE_URL (cu TURSO_AUTH_TOKEN). Se poate rula oricât de des.
// Dacă există .env.local (din `vercel env pull`), variabilele se iau de acolo; cele deja setate în terminal au prioritate.
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

try {
  process.loadEnvFile('.env.local');
} catch {
  // fără .env.local: variabilele trebuie să fie deja în mediu
}

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('Lipsește TURSO_DATABASE_URL (vezi README, pasul „vercel env pull .env.local").');
  process.exit(1);
}

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await client.executeMultiple(schema);
  const rs = await client.execute('SELECT (SELECT COUNT(*) FROM players) AS p, (SELECT COUNT(*) FROM rounds) AS r');
  console.log(`Schema aplicată. players: ${rs.rows[0].p} jucători; rounds (arhivă): ${rs.rows[0].r} ture.`);
} finally {
  client.close();
}
