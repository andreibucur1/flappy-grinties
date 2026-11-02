// Validarea unei ture trimise de client. Fără rețea și fără bază de date, ca să se poată testa direct.
// MAPS și limita de username trebuie să fie identice cu cele din js/config.js (le verifică tests/validate.test.js).
export const MAX_SCORE = 1000;   // limită de plauzibilitate, ajustabilă
export const USERNAME_RE = /^[A-Za-z0-9ĂÂÎȘȚăâîșțŞŢşţ _-]{1,12}$/;
export const MAPS = ['Grințieșu Mic', 'Poiana', 'Bradu', 'Moci', 'Grințieșu Mare'];

const ROUND_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export function usernameKey(username) {
  return username.trim().toLocaleLowerCase('ro');
}

// { ok: true, round: { roundId, username, usernameKey, score, map } } sau { ok: false, error }
export function validateRound(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_json' };
  const { roundId, username, score, map } = body;

  if (typeof roundId !== 'string' || !ROUND_ID_RE.test(roundId)) return { ok: false, error: 'roundId_invalid' };

  // NFC: „ă" scris ca „a" + semn combinat devine un singur caracter, ca regex-ul să-l recunoască
  const name = typeof username === 'string' ? username.normalize('NFC').trim() : '';
  if (!USERNAME_RE.test(name) || name.startsWith('-')) return { ok: false, error: 'username_invalid' };

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return { ok: false, error: 'score_invalid' };

  if (typeof map !== 'string' || !MAPS.includes(map)) return { ok: false, error: 'map_invalid' };

  return { ok: true, round: { roundId, username: name, usernameKey: usernameKey(name), score, map } };
}
