// Clientul libsql, creat o singură dată per instanță a funcției, din variabilele de mediu.
// Secretele (URL, token) există doar pe server: în Vercel ca variabile de mediu, local în .env.local.
import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('TURSO_DATABASE_URL nu e setat');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}
