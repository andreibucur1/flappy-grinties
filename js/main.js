// Mașina de stări și bucla principală.
(function () {
  'use strict';

  const STEP = Game.STEP;
  const game = new Game();

  let state = 'ATTRACT';
  let playerName = '';
  let overAt = 0;
  let lastRoundId = null;  // tura afișată pe GAME_OVER (pentru starea salvării)
  let topSeq = 0;          // doar ultimul răspuns de Top 10 cerut contează

  Store.init();

  function setState(s) {
    state = s;
    UI.show(s);
  }

  function goAttract() {
    game.reset(null);
    UI.renderAttract();
    setState('ATTRACT');
    loadTop10();
  }

  // Top 10 comun, de pe server; dacă cererea eșuează, UI-ul arată cache-ul („neactualizat")
  function loadTop10() {
    const seq = ++topSeq;
    UI.setTop10Loading();
    Api.loadTop10().then(function (r) {
      if (seq === topSeq) UI.setTop10(r.rows, r.stale);
    });
  }

  // Golește coada de ture; actualizează starea salvării de pe GAME_OVER și Top 10-ul dacă s-a salvat ceva
  function syncScores() {
    Api.flushQueue().then(function (saved) {
      if (state === 'GAME_OVER' && lastRoundId) {
        const st = Api.roundStatus(lastRoundId);
        UI.setSaveStatus(st === 'saved' || st === 'notbest' || st === 'rejected' ? st : 'offline');
      }
      if (saved > 0) loadTop10();
    });
  }

  // character = personajul ales de jucător pe ecranul de nume
  function goReady(name, character) {
    playerName = name;
    game.reset(character);
    UI.renderReady(playerName, game.currentMap().name);
    setState('READY');
  }

  function showResults() {
    UI.renderResults();
    setState('RESULTS');
  }

  function onGameOver() {
    const mapName = game.currentMap().name;
    const res = Store.recordRound({ name: playerName, score: game.score, map: mapName, character: game.character.id });
    UI.renderGameOver(res, game.score, mapName);
    overAt = performance.now();
    setState('GAME_OVER');

    // Tura intră în coadă înainte de trimitere; local rămâne și în Store (record personal, export)
    const round = { roundId: Api.newRoundId(), username: playerName, score: game.score, map: mapName };
    Api.queueRound(round);
    lastRoundId = round.roundId;
    UI.setSaveStatus('saving');
    syncScores();
  }

  UI.init({
    getState: function () { return state; },

    onSpace: function () {
      switch (state) {
        case 'ATTRACT':
          setState('NAME_ENTRY'); // câmpul vine precompletat cu numele de data trecută
          break;
        case 'READY':
          game.start();
          setState('PLAYING');
          break;
        case 'PLAYING':
          game.jump();
          break;
        case 'GAME_OVER':
          if (performance.now() - overAt >= CONFIG.gameOverInputLockMs) goAttract();
          break;
      }
    },

    onEscape: function () {
      if (state === 'RESULTS' || state === 'NAME_ENTRY' || state === 'READY') goAttract();
    },

    onNameSubmit: function (raw) {
      const v = Store.validateName(raw);
      if (!v.ok) { UI.setNameError(v.error); return; }
      const ch = UI.selectedCharacter();
      Store.rememberName(v.name);
      Store.rememberCharacter(ch.id);
      goReady(v.name, ch);
    },

    onToggleResults: function () {
      if (state === 'ATTRACT' || state === 'GAME_OVER') showResults();
      else if (state === 'RESULTS') goAttract();
    },

    onExport: function () {
      Store.exportCsv();
    },

    onExportJson: function () {
      Store.exportJson();
    },

    onReset: function () {
      if (state !== 'ATTRACT' && state !== 'GAME_OVER' && state !== 'RESULTS') return;
      if (!window.confirm('Sigur vrei să ștergi TOATE scorurile? Acțiunea nu se poate anula.\n(Folosește Ctrl+Shift+E ca să faci întâi un export.)')) return;
      Store.reset();
      if (state === 'RESULTS') UI.renderResults();
      else goAttract();
    }
  });

  goAttract();
  syncScores();                                   // ture rămase netrimise de data trecută
  window.addEventListener('online', syncScores);  // revine conexiunea: se trimite coada

  // Pas fix de simulare: același rezultat la 60, 120 sau 144 Hz
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); // după o pauză (tab ascuns) nu „sărim" înainte
    last = now;

    if (state === 'PLAYING') {
      acc += dt;
      while (acc >= STEP && !game.over) {
        game.step(STEP);
        acc -= STEP;
      }
      if (game.over) { acc = 0; onGameOver(); }
    } else {
      acc = 0;
      if (state === 'READY') game.hover(dt);
      if (state !== 'GAME_OVER') game.scrollX += 60 * dt; // fundal animat în afara jocului
      if (state === 'GAME_OVER' && now - overAt >= CONFIG.gameOverToAttractMs) goAttract();
    }

    UI.draw(game, state, { playerName: playerName });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
