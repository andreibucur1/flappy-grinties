// Comunicarea cu serverul (Vercel Functions, același domeniu) și coada de ture netrimise.
// Nicio funcție de aici nu aruncă excepții: erorile de rețea devin { ok: false, error: "network" }.
const Api = (function () {
  'use strict';

  const QUEUE_KEY = 'grinties_flappy_pending_v1';   // turele netrimise, în ordine; se golesc când revine conexiunea
  const TOP_KEY = 'grinties_flappy_top10_cache_v1'; // ultimul Top 10 primit, afișat „neactualizat" dacă serverul nu răspunde

  let memQueue = [];                    // rezervă dacă localStorage nu merge
  const outcome = Object.create(null);  // roundId -> 'saved' | 'rejected' (în sesiunea curentă)
  let flushing = Promise.resolve(0);

  // { ok, error?, status, ...corpul JSON }. status 0 = fără răspuns (rețea, timeout, pagină deschisă din fișier)
  function request(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, CONFIG.api.timeoutMs);
    const opt = { method: method, cache: 'no-store', signal: ctrl.signal, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    return fetch(CONFIG.api.base + path, opt)
      .then(function (res) {
        return res.json().then(null, function () { return null; }).then(function (d) {
          if (d && typeof d === 'object' && typeof d.ok === 'boolean') {
            d.ok = d.ok && res.ok;
            d.status = res.status;
            return d;
          }
          return { ok: false, error: res.status >= 500 ? 'server_error' : 'bad_response', status: res.status };
        });
      })
      .catch(function () { return { ok: false, error: 'network', status: 0 }; })
      .then(function (r) { clearTimeout(timer); return r; });
  }

  function submitScore(round) {
    return request('POST', '/score', round);
  }

  function fetchTop10() {
    return request('GET', '/top10');
  }

  // UUID v4; crypto.randomUUID există doar pe https/localhost, deci pe http (ex. telefon în rețeaua locală) îl construim
  function newRoundId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // ---------------------------------------------------------------- coada
  function readQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw === null) return memQueue.slice();
      const q = JSON.parse(raw);
      return Array.isArray(q) ? q : [];
    } catch (e) {
      return memQueue.slice();
    }
  }

  function writeQueue(q) {
    memQueue = q.slice();
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* rămâne coada din memorie */ }
  }

  // Tura intră în coadă ÎNAINTE de trimitere, ca să nu se piardă dacă pagina se închide între timp
  function queueRound(round) {
    const q = readQueue();
    q.push(round);
    writeQueue(q);
  }

  function removeFromQueue(roundId) {
    writeQueue(readQueue().filter(function (r) { return !r || r.roundId !== roundId; }));
  }

  // Trimite turele în ordine. ok (și duplicate) sau 400 = tura iese din coadă; rețea / 5xx / altceva = ne oprim, restul rămâne.
  // Rezultat: câte ture s-au salvat în această trecere.
  function runFlush() {
    let saved = 0;
    function next() {
      const q = readQueue();
      if (!q.length) return Promise.resolve(saved);
      const round = q[0];
      if (!round || typeof round.roundId !== 'string') { // intrare stricată: nu are cum să treacă vreodată
        writeQueue(q.slice(1));
        return next();
      }
      return submitScore(round).then(function (r) {
        if (r.ok) { outcome[round.roundId] = 'saved'; saved += 1; }
        else if (r.status === 400) outcome[round.roundId] = 'rejected';
        else return saved;
        removeFromQueue(round.roundId);
        return next();
      });
    }
    return next();
  }

  // O singură golire odată; un apel în timpul alteia se pune după ea
  function flushQueue() {
    flushing = flushing.then(runFlush, runFlush);
    return flushing;
  }

  // 'saved' | 'rejected' | 'pending' (încă în coadă) | 'unknown'
  function roundStatus(roundId) {
    if (outcome[roundId]) return outcome[roundId];
    return readQueue().some(function (r) { return r && r.roundId === roundId; }) ? 'pending' : 'unknown';
  }

  // ---------------------------------------------------------------- Top 10
  function cachedTop10() {
    try {
      const d = JSON.parse(localStorage.getItem(TOP_KEY));
      return d && Array.isArray(d.top) ? d.top : null;
    } catch (e) {
      return null;
    }
  }

  // { rows, stale }: rows = null dacă nu există nici răspuns, nici cache; stale = s-a folosit cache-ul
  function loadTop10() {
    return fetchTop10().then(function (r) {
      if (r.ok && Array.isArray(r.top)) {
        try { localStorage.setItem(TOP_KEY, JSON.stringify({ top: r.top, generatedAt: r.generatedAt })); } catch (e) { /* fără cache */ }
        return { rows: r.top, stale: false };
      }
      const c = cachedTop10();
      return { rows: c, stale: !!c };
    });
  }

  return {
    submitScore: submitScore, fetchTop10: fetchTop10, newRoundId: newRoundId,
    queueRound: queueRound, flushQueue: flushQueue, roundStatus: roundStatus,
    cachedTop10: cachedTop10, loadTop10: loadTop10
  };
})();
