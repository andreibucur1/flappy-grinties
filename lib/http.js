// Răspuns JSON prin API-ul Node simplu (statusCode, setHeader, end), ca handler-ele să meargă identic în Vercel și în teste.
export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// Corpul cererii ca obiect. Vercel parsează singur JSON-ul (după Content-Type) și aruncă excepție dacă e invalid;
// fără Content-Type corect corpul vine ca text sau Buffer și îl parsăm aici. Orice JSON invalid aruncă.
export function readJsonBody(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') body = JSON.parse(body);
  return body;
}
