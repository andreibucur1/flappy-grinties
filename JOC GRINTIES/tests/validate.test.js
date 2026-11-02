import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validateRound, MAPS, MAX_SCORE, USERNAME_RE } from '../lib/validate.js';

const ok = { roundId: '3f2c1a9e-1b2c-4d5e-8f90-123456789abc', username: 'Andrei', score: 12, map: 'Moci' };
const err = (patch) => validateRound({ ...ok, ...patch }).error;

test('validate: acceptă ture valide', () => {
  assert.equal(validateRound(ok).ok, true);
  assert.equal(validateRound({ ...ok, username: 'Ștefănel', map: 'Grințieșu Mic' }).ok, true);
  assert.equal(validateRound({ ...ok, username: 'Ana_Maria-2' }).ok, true);
  assert.equal(validateRound({ ...ok, username: 'abcdefghijkl' }).ok, true); // 12 caractere
  assert.equal(validateRound({ ...ok, score: 0 }).ok, true);
  assert.equal(validateRound({ ...ok, score: MAX_SCORE }).ok, true);
  assert.equal(validateRound({ ...ok, roundId: 'abcd1234' }).ok, true); // 8 caractere
  const v = validateRound({ ...ok, username: '  Test  ' });
  assert.equal(v.round.username, 'Test');
  assert.equal(v.round.usernameKey, 'test');
  assert.equal(validateRound({ ...ok, username: 'ȘTEFĂNEL' }).round.usernameKey, 'ștefănel');
});

test('validate: respinge username invalid', () => {
  assert.equal(err({ username: '=1+1' }), 'username_invalid');
  assert.equal(err({ username: '-abc' }), 'username_invalid');
  assert.equal(err({ username: 'abcdefghijklm' }), 'username_invalid'); // 13 caractere
  assert.equal(err({ username: '   ' }), 'username_invalid');
  assert.equal(err({ username: 42 }), 'username_invalid');
});

test('validate: respinge scor invalid', () => {
  assert.equal(err({ score: -1 }), 'score_invalid');
  assert.equal(err({ score: 1001 }), 'score_invalid');
  assert.equal(err({ score: 3.5 }), 'score_invalid');
  assert.equal(err({ score: '5' }), 'score_invalid');
});

test('validate: respinge hartă și roundId invalide, corp care nu e obiect', () => {
  assert.equal(err({ map: 'Paris' }), 'map_invalid');
  assert.equal(err({ roundId: 'abc1234' }), 'roundId_invalid'); // 7 caractere
  assert.equal(err({ roundId: 'a'.repeat(65) }), 'roundId_invalid');
  assert.equal(err({ roundId: 'abc_12345' }), 'roundId_invalid');
  assert.equal(validateRound(null).error, 'bad_json');
  assert.equal(validateRound([ok]).error, 'bad_json');
});

// Clientul (js/config.js) trebuie să folosească exact aceleași hărți și aceeași limită de username ca serverul
test('validate: js/config.js are aceleași hărți și aceeași regulă de username', async () => {
  const src = await readFile(new URL('../js/config.js', import.meta.url), 'utf8');
  const CONFIG = vm.runInNewContext(src + '\nCONFIG');
  assert.deepEqual(Array.from(CONFIG.maps, (m) => m.name), MAPS); // Array.from: tablou din acest context, nu din cel al vm
  assert.equal(CONFIG.usernameMaxLength, 12);
  assert.equal('[' + CONFIG.usernameChars + ']{1,' + CONFIG.usernameMaxLength + '}', USERNAME_RE.source.slice(1, -1));
});
