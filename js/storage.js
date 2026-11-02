// Toată persistența e aici: o singură cheie în localStorage, fără server.
// Nu se numește „Storage" ca să nu umbrim clasa nativă a browserului.
const Store = (function () {
  'use strict';

  const KEY = CONFIG.storageKey;
  const VERSION = 1;

  let data = fresh();
  let corrupt = false;       // datele existente sunt corupte / de altă versiune: NU se suprascriu
  let corruptRaw = null;
  let unavailable = false;   // localStorage nu poate fi citit
  let writeFailed = false;   // ultima scriere a eșuat

  // players e un obiect fără prototip, ca un username gen „__proto__" să fie o cheie obișnuită
  function fresh() {
    return { version: VERSION, players: Object.create(null), rounds: [] };
  }

  function keyOf(name) {
    return name.trim().toLocaleLowerCase('ro');
  }

  function isValid(d) {
    if (!d || typeof d !== 'object' || d.version !== VERSION) return false;
    if (!d.players || typeof d.players !== 'object' || Array.isArray(d.players)) return false;
    if (!Array.isArray(d.rounds)) return false;
    for (const k of Object.keys(d.players)) {
      const p = d.players[k];
      if (!p || typeof p !== 'object' || !Number.isFinite(p.best) || typeof p.displayName !== 'string') return false;
    }
    return true;
  }

  function init() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      unavailable = true;
      return;
    }
    if (raw === null) return;
    try {
      const d = JSON.parse(raw);
      if (isValid(d)) {
        data = { version: VERSION, players: Object.assign(Object.create(null), d.players), rounds: d.rounds };
        return;
      }
    } catch (e) { /* cade mai jos, ca date corupte */ }
    corrupt = true;
    corruptRaw = raw;
  }

  function persist() {
    if (corrupt) return false; // nu suprascriem date pe care nu le-am înțeles
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      writeFailed = false;
      return true;
    } catch (e) {
      writeFailed = true;
      return false;
    }
  }

  function warnings() {
    const w = [];
    if (corrupt) w.push('Date corupte! Nu se salvează nimic până la resetare (Ctrl+Shift+Delete). Export: Ctrl+Shift+E.'); // în acest caz exportul scoate datele vechi, brute
    if (unavailable) w.push('localStorage indisponibil. Scorurile nu se păstrează.');
    if (writeFailed && !corrupt) w.push('Scrierea în localStorage a eșuat! Fă export: Ctrl+Shift+E.');
    return w;
  }

  // { ok, name, error }. Aceleași reguli ca serverul (lib/validate.js), altfel scorul ar fi respins la salvare
  const NAME_RE = new RegExp('^[' + CONFIG.usernameChars + ']+$');

  function validateName(raw) {
    const name = String(raw).normalize('NFC').trim();
    if (name.length < 1) return { ok: false, error: 'Scrie un username.' };
    if (name.length > CONFIG.usernameMaxLength) return { ok: false, error: 'Maximum ' + CONFIG.usernameMaxLength + ' caractere.' };
    if (!NAME_RE.test(name)) return { ok: false, error: 'Doar litere, cifre, spațiu, - și _.' };
    if (name[0] === '-') return { ok: false, error: 'Nu poate începe cu -.' };
    return { ok: true, name: name };
  }

  // Sortare: record descrescător; la egalitate, cine a atins scorul primul (bestAt mai vechi)
  function getSorted() {
    const list = Object.keys(data.players).map(function (k) {
      return Object.assign({ key: k }, data.players[k]);
    });
    list.sort(function (a, b) {
      if (b.best !== a.best) return b.best - a.best;
      const ta = a.bestAt || '', tb = b.bestAt || '';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.key < b.key ? -1 : 1;
    });
    return list;
  }

  function getTop(n) {
    return getSorted().filter(function (p) { return p.best > 0; }).slice(0, n);
  }

  function getBest(key) {
    const p = data.players[key];
    return p ? p.best : 0;
  }

  function recordRound(r) {
    const display = r.name.trim();
    const key = keyOf(display);
    const ts = new Date().toISOString();
    let p = data.players[key];
    const prevBest = p ? p.best : 0;
    if (!p) {
      p = data.players[key] = { displayName: display, best: 0, bestMap: r.map, bestAt: ts, attempts: 0, lastPlayed: ts };
    }
    p.attempts += 1;
    p.lastPlayed = ts;
    const isRecord = r.score > prevBest;
    if (isRecord) {
      p.best = r.score;
      p.bestMap = r.map;
      p.bestAt = ts;
    }
    data.rounds.push({ key: key, score: r.score, map: r.map, character: r.character, ts: ts });
    persist(); // imediat, nu la închiderea paginii

    const sorted = getSorted();
    const rank = sorted.findIndex(function (x) { return x.key === key; }) + 1;
    return { key: key, displayName: p.displayName, isRecord: isRecord, best: p.best, bestMap: p.bestMap,
             rank: rank, total: sorted.length, attempts: p.attempts };
  }

  // Ultimul username folosit, ca jucătorul să nu-l scrie la fiecare tură. Cheie separată, ca schema de mai sus să rămână neschimbată.
  function lastName() {
    try { return localStorage.getItem(CONFIG.lastNameKey) || ''; } catch (e) { return ''; }
  }

  function rememberName(name) {
    try { localStorage.setItem(CONFIG.lastNameKey, name); } catch (e) { /* doar nu se mai ține minte */ }
  }

  const pad2 = function (n) { return String(n).padStart(2, '0'); };

  function stamp() {
    const d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // Backup complet (toate turele), în JSON
  function exportJson() {
    const payload = corrupt
      ? { exportedAt: new Date().toISOString(), storageKey: KEY, warning: 'Date corupte, exportate ca text brut', raw: corruptRaw }
      : { exportedAt: new Date().toISOString(), storageKey: KEY, version: VERSION, players: data.players, rounds: data.rounds };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'grinties_flappy_' + stamp() + '.json');
  }

  function localDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  // Câmp CSV: ghilimele dacă e nevoie; prefix ' la text care ar putea fi luat de Excel drept formulă (începe cu = + - @)
  function csvField(v) {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Clasamentul complet în CSV: separator „;" și BOM UTF-8, ca Excel în limba română să deschidă fișierul cu diacritice corecte
  function exportCsv() {
    if (corrupt) { exportJson(); return; } // datele nu pot fi interpretate; se exportă textul brut
    const rows = [['Loc', 'Jucător', 'Record', 'Hartă record', 'Ture', 'Ultima tură', 'Record obținut la']];
    getSorted().forEach(function (p, i) {
      rows.push([i + 1, p.displayName, p.best, p.bestMap || '', p.attempts, localDateTime(p.lastPlayed), localDateTime(p.bestAt)]);
    });
    const text = rows.map(function (r) { return r.map(csvField).join(';'); }).join('\r\n') + '\r\n';
    download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), 'rezultate_grinties_' + stamp() + '.csv');
  }

  function reset() {
    data = fresh();
    corrupt = false;
    corruptRaw = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignorat; persist() raportează eșecul */ }
    persist();
  }

  return {
    init: init, keyOf: keyOf, validateName: validateName, recordRound: recordRound,
    getSorted: getSorted, getTop: getTop, getBest: getBest, warnings: warnings,
    exportJson: exportJson, exportCsv: exportCsv, reset: reset,
    lastName: lastName, rememberName: rememberName,
    totalRounds: function () { return data.rounds.length; }
  };
})();
