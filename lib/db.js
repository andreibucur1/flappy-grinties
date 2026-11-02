// Clientul libsql, creat o singură dată per instanță a funcției, din variabilele de mediu.
// Secretele (URL, token) există doar pe server: în Vercel ca variabile de mediu, local în .env.local.
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

let client = null;

// `vercel dev` dă funcțiilor doar variabilele din mediul Development al proiectului Vercel, nu și pe cele din .env.local.
// Dacă lipsesc, le citim din .env.local (rădăcina proiectului). În producție variabilele există, deci fișierul nu se citește.
function loadLocalEnv() {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
  } catch {
    // fără .env.local: rămâne eroarea de mai jos
  }
}

export function getDb() {
  if (!client) {
    if (!process.env.TURSO_DATABASE_URL) loadLocalEnv();
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('TURSO_DATABASE_URL nu e setat');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}
