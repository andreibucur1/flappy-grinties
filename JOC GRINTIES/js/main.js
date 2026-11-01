// Mașina de stări și bucla principală.
(function () {
  'use strict';

  const STEP = Game.STEP;
  const game = new Game();

  let state = 'ATTRACT';
  let playerName = '';
  let overAt = 0;
  let bag = [];

  Store.init();

  // Personajul se alege dintr-un „săculeț" amestecat: aleatoriu, dar toți cei 6 apar înainte să se repete cineva
  function nextCharacter() {
    if (!bag.length) {
      bag = CONFIG.characters.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
    }
    return bag.pop();
  }

  function setState(s) {
    state = s;
    UI.show(s);
  }

  function goAttract() {
    game.reset(null);
    UI.renderAttract();
    setState('ATTRACT');
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
  }

  UI.init({
    getState: function () { return state; },

    onSpace: function () {
      switch (state) {
        case 'ATTRACT':
          setState('NAME_ENTRY');
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
      playerName = v.name;
      game.reset(nextCharacter());
      UI.renderReady(playerName, game.currentMap().name);
      setState('READY');
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
