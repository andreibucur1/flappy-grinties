// Ecrane, input și desenarea întregii scene pe canvas, în stil 8-bit.
// Canvasul are rezoluția „de artă" (800x600 logic / pixelSize = 200x150); CSS îl mărește fără netezire.
// Toate coordonatele de aici sunt în pixeli de artă. Logica de stări stă în main.js; aici se transmit evenimente prin `handlers`.
const UI = (function () {
  'use strict';

  const C = CONFIG;
  const PS = C.pixelSize;
  const W = C.canvas.width / PS;                 // 200
  const H = C.canvas.height / PS;                // 150
  const GROUND_Y = C.canvas.height - C.groundHeight; // px logici

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const facesCanvas = document.getElementById('faces'); // strat transparent 800x600 pentru pozele personajelor
  const fctx = facesCanvas.getContext('2d');
  const photos = {};                                    // id personaj -> imagine (ok = încărcată)
  const input = document.getElementById('name-input'); // invizibil: primește tastarea (diacritice, tastatură românească); textul se desenează pe canvas

  let handlers = null;
  let debug = false;               // Ctrl+Shift+H; nu se salvează nicăieri
  let nameError = '';
  let resultsScroll = 0;
  const mouse = { x: -1, y: -1 };          // poziția mouse-ului, în pixeli de artă
  let dragScroll = false;                  // se trage de bara de derulare
  let resultsLayout = null;                // { trackY, trackH, visible, maxScroll }, calculat la desenare
  const BTN_BACK = { x: 150, y: 5, w: 42, h: 16 };        // ecranul de rezultate (mai înalt: „Î" are accent deasupra)
  const BTN_START = { x: 75, y: 99, w: 50, h: 13 };       // ecranul de nume, sub personaje (Space / Enter fac același lucru)
  let pressState = null;                                  // starea în care a început ultimul click / ultima atingere
  const NAME_FIELD = { x: 23, y: 28, w: 154, h: 30 };     // câmpul de pergament; peste el stă <input>-ul real, transparent
  const CHAR_ROW = { x: 30, y: 71, size: 20, gap: 4 };    // ecranul de nume: rândul cu personajele de ales (pătrate de 20 px de artă)
  let charIndex = 0;                                      // personajul selectat pe ecranul de nume (index în CONFIG.characters)
  // top10: rows = null cât timp nu există nici răspuns, nici cache; stale = afișăm cache-ul („neactualizat")
  const data = { top10: { rows: Api.cachedTop10(), stale: false, loading: true }, over: null, saveStatus: null, readyName: '', readyMap: '', results: [] };
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false }; // telefon / tabletă: „Atinge ecranul" în loc de „Apasă Space"

  // ---------------------------------------------------------------- unelte
  function box(x, y, w, h, color) {
    ctx.fillStyle = PALETTE[color];
    ctx.fillRect(x, y, w, h);
  }

  // Degrade cu dither ordonat (aceeași matrice Bayer ca la tranzițiile de fundal), doar cu culori din paletă
  function gradPick(colors, t, x, y) {
    const f = Math.max(0, Math.min(1, t)) * (colors.length - 1);
    const i = Math.min(colors.length - 2, Math.floor(f));
    return (f - i) * 16 > BAYER[y & 3][x & 3] ? colors[i + 1] : colors[i];
  }

  // Panourile și butoanele se desenează o singură dată per mărime (și stare), apoi doar se copiază.
  const uiCache = {};

  function cached(key, w, h, paint) {
    if (!uiCache[key]) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      paint(function (px, py, pw, ph, col) { x.fillStyle = PALETTE[col]; x.fillRect(px, py, pw, ph); });
      uiCache[key] = c;
    }
    return uiCache[key];
  }

  // Panou: ramă de lemn (lumină sus-stânga, umbră jos-dreapta, colțuri rotunjite, ținte aurii),
  // interior albastru în degrade și umbră în dither în dreapta-jos. Conținutul începe la 4 pixeli de margine.
  function panel(x, y, w, h) {
    ctx.drawImage(cached('p' + w + 'x' + h, w + 2, h + 2, function (b) {
      for (let j = 2; j < h + 2; j++) for (let i = 2; i < w + 2; i++) if ((i >= w || j >= h) && ((i + j) & 1)) b(i, j, 1, 1, 'black');
      b(1, 0, w - 2, h, 'dirtDark'); b(0, 1, w, h - 2, 'dirtDark');
      b(1, 1, w - 2, h - 2, 'dirt');
      b(1, 1, w - 2, 1, 'horseLit'); b(1, 1, 1, h - 2, 'horseLit');
      b(2, h - 2, w - 3, 1, 'trunk'); b(w - 2, 2, 1, h - 3, 'trunk');
      b(3, 3, w - 6, h - 6, 'dirtDark');
      for (let j = 4; j < h - 4; j++) for (let i = 4; i < w - 4; i++) b(i, j, 1, 1, gradPick(['mtnNight', 'nightB'], (j - 4) / Math.max(1, h - 9), i, j));
      [[1, 1], [w - 3, 1], [1, h - 3], [w - 3, h - 3]].forEach(function (p) { b(p[0], p[1], 2, 2, 'goldShade'); b(p[0], p[1], 1, 1, 'goldLit'); });
    }), x, y);
  }

  // outline / shadow: true = negru, sau numele unei culori din paletă
  function text(s, x, y, color, scale, align, shadow, outline) {
    Font.draw(ctx, s, x, y, { color: color || 'creamLit', scale: scale || 1, align: align || 'left', shadow: shadow, outline: outline });
  }

  function blink(period) {
    return Math.floor(performance.now() / period) % 2 === 0;
  }

  // ---------------------------------------------------------------- scalare
  // Factor întreg când se poate, ca pixelii să fie la fel de mari peste tot. Raportul 4:3 rămâne, cu benzi negre (letterbox),
  // în portrait și în landscape; zona sigură a telefonului (notch) e scoasă din spațiul disponibil prin padding-ul din style.css.
  function resize() {
    const cs = getComputedStyle(document.body);
    const availW = window.innerWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = window.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = Math.min(availW / W, availH / H);
    // Pe telefon (ecran mic, densitate mare) factorul întreg ar pierde mult spațiu (375 px lățime → 1x), deci se umple tot
    const s = fit >= 1 && !coarse.matches ? Math.floor(fit) : fit;
    const w = Math.round(W * s) + 'px', h = Math.round(H * s) + 'px';
    canvas.style.width = w; canvas.style.height = h;
    stage.style.width = w; stage.style.height = h;
    stage.style.setProperty('--px', s + 'px'); // un pixel de artă, pentru butonul de muzică (style.css)
    placeInput();
  }

  // <input>-ul real stă exact peste câmpul desenat, ca pe telefon o atingere pe câmp să deschidă tastatura.
  // E transparent: textul se desenează pe canvas cu fontul bitmap.
  function placeInput() {
    const r = canvas.getBoundingClientRect();
    const k = r.width / W;
    input.style.left = (r.left + NAME_FIELD.x * k) + 'px';
    input.style.top = (r.top + NAME_FIELD.y * k) + 'px';
    input.style.width = (NAME_FIELD.w * k) + 'px';
    input.style.height = (NAME_FIELD.h * k) + 'px';
  }

  function loadPhotos() {
    C.characters.forEach(function (ch) {
      const img = new Image();
      img.ok = false;
      img.onload = function () { img.ok = true; };
      img.src = ch.photo;
      photos[ch.id] = img;
    });
  }

  // ---------------------------------------------------------------- scena
  // Rezervă: placeholderul pixel art, doar dacă poza personajului nu s-a încărcat
  function drawBirdSprite(b, ch) {
    const sp = SPRITES.get(ch.sprite + (b.vy < 0 ? '_up' : '_down'));
    ctx.drawImage(sp.c, Math.round(b.x / PS - sp.w / 2), Math.round(b.y / PS - sp.h / 2));
  }

  // Personajul = poza membrului, pe stratul transparent, ușor înclinată după viteza verticală
  function drawFaces(game, state, debugOn) {
    fctx.clearRect(0, 0, C.canvas.width, C.canvas.height);
    if (state === 'NAME_ENTRY') { drawCharacterChoices(); return; }
    if (state !== 'READY' && state !== 'PLAYING') return;
    const ch = game.character;
    if (!ch) return;
    const b = game.bird;
    const img = photos[ch.id];
    if (img && img.ok) {
      const s = C.bird.size;
      const r = Math.min(s / img.naturalWidth, s / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      const tilt = Math.max(-0.3, Math.min(0.6, b.vy / 900 * 1.0));
      fctx.save();
      fctx.translate(b.x, b.y);
      fctx.rotate(tilt);
      fctx.drawImage(img, -w / 2, -h / 2, w, h);
      fctx.restore();
    }
    if (debugOn) {
      const h = C.bird.size * C.bird.hitboxScale / 2;
      fctx.strokeStyle = PALETTE.red;
      fctx.lineWidth = PS;
      fctx.strokeRect(b.x - h, b.y - h, 2 * h, 2 * h);
    }
  }

  // Pozele din rândul de personaje de pe ecranul de nume; cele neselectate apar estompate
  function drawCharacterChoices() {
    C.characters.forEach(function (ch, i) {
      const img = photos[ch.id];
      if (!img || !img.ok) return;
      const s = charSlot(i);
      const inner = (s.w - 2) * PS;                     // 1 pixel de artă margine în interiorul chenarului
      const r = Math.min(inner / img.naturalWidth, inner / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      fctx.globalAlpha = i === charIndex ? 1 : 0.5;
      fctx.drawImage(img, (s.x + s.w / 2) * PS - w / 2, (s.y + s.h / 2) * PS - h / 2, w, h);
    });
    fctx.globalAlpha = 1;
  }

  function photoReady(ch) {
    const img = photos[ch.id];
    return !!(img && img.ok);
  }

  // Tranziția dintre fundaluri: dither ordonat (matrice Bayer 4x4). Fundalul nou apare pixel cu pixel peste cel vechi,
  // deci pe ecran rămân doar culori din paletă (un crossfade ar amesteca culorile).
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const ditherMasks = [];
  let tmpCanvas = null;

  function ditherMask(level) { // pixeli opaci acolo unde valoarea Bayer < level (1..15)
    if (!ditherMasks[level]) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = PALETTE.white;
      for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) if (BAYER[y & 3][px & 3] < level) x.fillRect(px, y, 1, 1);
      ditherMasks[level] = c;
    }
    return ditherMasks[level];
  }

  function drawBackdrop(game, layer) { // layer: 'far' (cer, dealuri) sau 'ground' (sol)
    const paint = function (cx, key) { // fiecare strat își calculează singur deplasarea (parallax) din scrollX
      if (layer === 'far') Backgrounds.drawFar(cx, key, game.scrollX);
      else Backgrounds.drawGround(cx, key, game.scrollX);
    };
    const cur = game.currentMap().bg;
    if (game.bgPrev === null) { paint(ctx, cur); return; }
    paint(ctx, C.maps[game.bgPrev].bg);
    const level = Math.min(16, Math.floor(game.bgFade / C.bgTransitionMs * 17));
    if (level <= 0) return;
    if (level >= 16) { paint(ctx, cur); return; }
    if (!tmpCanvas) { tmpCanvas = document.createElement('canvas'); tmpCanvas.width = W; tmpCanvas.height = H; }
    const tx = tmpCanvas.getContext('2d');
    tx.globalCompositeOperation = 'source-over';
    tx.clearRect(0, 0, W, H);
    paint(tx, cur);
    tx.globalCompositeOperation = 'destination-in';
    tx.drawImage(ditherMask(level), 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0);
  }

  function drawWorld(game, state) {
    drawBackdrop(game, 'far');
    const showObstacles = state === 'PLAYING' || state === 'GAME_OVER' || state === 'READY';
    if (showObstacles) {
      for (let i = 0; i < game.pillars.length; i++) {
        const p = game.pillars[i];
        Obstacles.draw(ctx, p.theme, Math.round(p.x / PS), p.gapTop, p.gap, GROUND_Y);
      }
    }
    drawBackdrop(game, 'ground');
    if (showObstacles && state !== 'GAME_OVER' && game.character && !photoReady(game.character)) drawBirdSprite(game.bird, game.character);
  }

  // Overlay Ctrl+Shift+H: conturul de 1 pixel de artă al reuniunii hitbox-urilor + linia plafonului
  let maskCanvas = null;

  function drawDebug(game, state) {
    const showObstacles = state === 'PLAYING' || state === 'GAME_OVER' || state === 'READY';
    if (showObstacles) {
      if (!maskCanvas) { maskCanvas = document.createElement('canvas'); maskCanvas.width = W; maskCanvas.height = H; }
      const mx = maskCanvas.getContext('2d', { willReadFrequently: true });
      mx.clearRect(0, 0, W, H);
      mx.fillStyle = PALETTE.white;
      game.pillars.forEach(function (p) {
        p.rects.forEach(function (r) {
          const x0 = Math.round((p.x + r[0]) / PS), x1 = Math.round((p.x + r[1]) / PS);
          mx.fillRect(x0, Math.round(r[2] / PS), x1 - x0, Math.round(r[3] / PS) - Math.round(r[2] / PS));
        });
      });
      const a = mx.getImageData(0, 0, W, H).data;
      const on = function (x, y) { return x >= 0 && x < W && y >= 0 && y < H && a[(y * W + x) * 4 + 3] > 0; };
      ctx.fillStyle = PALETTE.red;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    box(0, Math.round(C.ceilingY / PS), W, 1, 'red');
  }

  // ---------------------------------------------------------------- clasament
  const RANK_COLORS = ['goldLit', 'stoneLit', 'horseLit']; // aur, argint, bronz

  // Top 10 comun: o singură coloană pe toată lățimea, ca numele de 12 caractere să încapă întregi.
  // Pe ecran încap 5 rânduri, deci locurile 1-5 și 6-10 alternează (CONFIG.top10PageMs).
  // Pe game over se începe cu pagina pe care e jucătorul curent (highlightKey); rândul lui e evidențiat.
  const PAGE = 5;
  let boardStart = 0;   // de când se numără paginile (intrarea pe ecran)

  // { rows, page, pages } pentru momentul curent; rows = null / [] când nu e nimic de afișat
  function boardPage(highlightKey) {
    const rows = data.top10.rows ? data.top10.rows.slice(0, 10) : data.top10.rows;
    const pages = rows ? Math.max(1, Math.ceil(rows.length / PAGE)) : 1;
    let first = 0;
    if (highlightKey && rows) {
      const i = rows.findIndex(function (p) { return p.key === highlightKey; });
      if (i >= 0) first = Math.floor(i / PAGE);
    }
    const page = (first + Math.floor((performance.now() - boardStart) / C.top10PageMs)) % pages;
    return { rows: rows, page: page, pages: pages };
  }

  // Ce se scrie lângă titlul „Top 10": pagina („1-5" / „6-10", '' dacă e o singură pagină) și „neactualizat" dacă e cache-ul
  function boardLabels(highlightKey) {
    const b = boardPage(highlightKey);
    return { page: b.pages > 1 ? (b.page === 0 ? '1-5' : '6-10') : '', stale: data.top10.stale ? 'neactualizat' : '' };
  }

  // x = marginea stângă; w = lățimea tabelului
  function drawBoard(x, y, w, pitch, highlightKey) {
    const t = data.top10;
    const b = boardPage(highlightKey);
    const midY = y + 2 * pitch;
    if (!b.rows) {
      text(t.loading ? 'Se încarcă…' : 'Clasament indisponibil', x + w / 2, midY, 'creamLit', 1, 'center');
      return;
    }
    if (!b.rows.length) {
      text('Niciun scor încă. Fii primul!', x + w / 2, midY, 'creamLit', 1, 'center');
      return;
    }
    b.rows.slice(b.page * PAGE, b.page * PAGE + PAGE).forEach(function (p, i) {
      const ry = y + i * pitch;
      const rank = p.rank || b.page * PAGE + i + 1;
      const score = String(p.score);
      if (highlightKey && p.key === highlightKey) box(x - 2, ry - 2, w + 4, 11, 'mtnNightLit');
      text(String(rank), x + 11, ry, RANK_COLORS[rank - 1] || 'creamLit', 1, 'right');
      text(score, x + w, ry, 'goldLit', 1, 'right');
      const avail = w - 16 - Font.measure(score, 1) - 4; // 12 caractere încap mereu; clip doar ca plasă de siguranță
      text(Font.clip(p.name, avail, 1), x + 16, ry, 'creamLit', 1);
    });
  }

  // Textele de instrucțiuni: tastatură pe desktop, atingere pe telefon
  function hint(desktop, touch) {
    return coarse.matches ? touch : desktop;
  }

  // ---------------------------------------------------------------- ecrane
  function inside(b, p) { return p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h; }

  // Interiorul butonului (fără cele 2 rânduri de contur) are h - 4 rânduri. Textul (7 rânduri) se centrează vertical în el;
  // dy = decalajul rândului 0 al textului față de partea de sus a butonului (implicit: centrat).
  // Buton: scândură de lemn cu muchie luminată sus și umbră jos; la trecerea mouse-ului se luminează
  function button(b, label, dy) {
    const hover = inside(b, mouse);
    const w = b.w, h = b.h;
    ctx.drawImage(cached('b' + w + 'x' + h + (hover ? 'h' : ''), w, h, function (f) {
      f(1, 0, w - 2, h, 'dirtDark'); f(0, 1, w, h - 2, 'dirtDark');
      for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
        f(i, j, 1, 1, gradPick(hover ? ['horseLit', 'horse'] : ['horse', 'horseShade'], (j - 1) / Math.max(1, h - 3), i, j));
      }
      f(1, 1, w - 2, 1, hover ? 'goldLit' : 'horseLit');
      f(1, h - 2, w - 2, 1, 'horseShade');
    }), b.x, b.y);
    text(label, b.x + b.w / 2, b.y + (dy === undefined ? Math.floor((b.h - 7) / 2) : dy), hover ? 'creamLit' : 'goldLit', 1, 'center', 'dirtDark');
  }

  function drawAttract() {
    const title = C.title;
    const ts = Font.fit(title, W - 10, 2);
    text(title, W / 2, 9, 'goldLit', ts, 'center', 'dirtDark', 'dirtDark');
    panel(10, 31, 180, 87);
    // Titlul în stânga, pagina și „neactualizat" în dreapta (sub titlu nu e loc: coada lui „p" coboară până la rândul 55)
    text('Top 10', 22, 37, 'creamLit', 2);
    const lb = boardLabels(null);
    if (lb.page) text(lb.page, 178, 39, 'stoneLit', 1, 'right');
    if (lb.stale) text(lb.stale, 178, 48, 'stoneLit', 1, 'right');
    // pitch 11: coada literelor g j p q y și virgula de la ș/ț coboară 2 pixeli de artă sub linie și nu trebuie să atingă rândul următor
    drawBoard(22, 60, 156, 11, null);
    if (blink(600)) text(hint('Apasă Space sau click ca să joci', 'Atinge ecranul ca să joci'), W / 2, 122, 'creamLit', 1, 'center', false, 'nightA');
  }

  // Pătratul personajului i pe ecranul de nume, în pixeli de artă
  function charSlot(i) {
    return { x: CHAR_ROW.x + i * (CHAR_ROW.size + CHAR_ROW.gap), y: CHAR_ROW.y, w: CHAR_ROW.size, h: CHAR_ROW.size };
  }

  // Indexul personajului de sub punctul p, sau -1
  function charAt(p) {
    for (let i = 0; i < C.characters.length; i++) if (inside(charSlot(i), p)) return i;
    return -1;
  }

  function drawNameEntry() {
    panel(8, 3, 184, 117);
    text('Cum te cheamă?', W / 2, 10, 'creamLit', 2, 'center');
    // Câmp de pergament, înalt cât să încapă accentele (deasupra) și cozile literelor g j p q y (dedesubt) la scara 2
    const F = NAME_FIELD;
    box(F.x, F.y, F.w, F.h, 'horseMane');
    box(F.x + 1, F.y + 1, F.w - 2, F.h - 2, 'creamLit');
    box(F.x + 1, F.y + 1, F.w - 2, 1, 'creamShade'); box(F.x + 1, F.y + 1, 1, F.h - 2, 'creamShade');   // umbră interioară
    box(F.x + 2, F.y + F.h - 3, F.w - 3, 1, 'cream');
    const v = input.value;
    if (v) text(v, F.x + 5, F.y + 8, 'horseMane', 2);
    else text('username', F.x + 5, F.y + 8, 'creamShade', 2);
    if (document.activeElement === input && blink(500)) box(F.x + 5 + (v ? Font.measure(v, 2) + 2 : 0), F.y + 8, 2, 14, 'horseMane'); // cursor doar cât se scrie
    if (nameError) text(nameError, W / 2, 61, 'capLit', 1, 'center');

    // Personajele: chenar auriu dublu = cel ales; pozele se desenează peste, pe stratul de fețe (drawFaces)
    C.characters.forEach(function (ch, i) {
      const s = charSlot(i);
      const sel = i === charIndex;
      if (sel) box(s.x - 2, s.y - 2, s.w + 4, s.h + 4, 'gold');
      box(s.x - 1, s.y - 1, s.w + 2, s.h + 2, sel ? 'goldLit' : inside(s, mouse) ? 'horseLit' : 'dirtDark');
      box(s.x, s.y, s.w, s.h, 'nightA');
      if (!photoReady(ch)) { // rezerva pixel art, dacă poza nu s-a încărcat
        const sp = SPRITES.get(ch.sprite + '_down');
        ctx.drawImage(sp.c, Math.round(s.x + (s.w - sp.w) / 2), Math.round(s.y + (s.h - sp.h) / 2));
      }
    });

    button(BTN_START, 'Start');
  }

  function drawReady(info) {
    // Numele are accente deasupra (3 rânduri) și cozi dedesubt (2 rânduri, x scara): harta se scrie sub ele, nu peste
    panel(30, 6, 140, 46);
    const s = Font.fit(info.playerName, 128, 2);
    text(info.playerName, W / 2, 16 + (s === 2 ? 0 : 3), 'goldLit', s, 'center', 'dirtDark');
    text('Harta: ' + data.readyMap, W / 2, 38, 'creamLit', 1, 'center');
    if (blink(600)) text(hint('Space sau click ca să începi', 'Atinge ecranul ca să începi'), W / 2, 116, 'creamLit', 1, 'center', false, 'nightA');
  }

  function drawPlaying(game, info) {
    text(String(game.score), W / 2, 8, 'creamLit', 4, 'center', 'nightA', 'nightA');
    text(game.currentMap().name, 3, 3, 'creamLit', 1, 'left', false, 'nightA');
    text(info.playerName, W - 3, 3, 'creamLit', 1, 'right', false, 'nightA');
    if (game.banner) { // fără fundal, ca să nu acopere obstacolele
      text(game.banner.text, W / 2, 59, 'goldLit', Font.fit(game.banner.text, W - 8, 2), 'center', false, 'dirtDark');
    }
  }

  function drawGameOver() {
    const r = data.over;
    if (!r) return;
    panel(6, 1, 188, 147);
    text('Game over', W / 2, 6, 'capLit', 2, 'center', 'capDeep');
    text('Scor ' + r.score, W / 2, 22, 'goldLit', 2, 'center', 'dirtDark');
    text('Hartă atinsă: ' + r.mapName, W / 2, 38, 'creamLit', 1, 'center');
    // Recordul personal vine din datele locale (Store)
    if (r.res.isRecord) {
      if (blink(400)) text('Record nou!', W / 2, 48, 'grassLit', 1, 'center');
    } else {
      // Numele nu se taie: dacă nu încape întreg pe rând, rândul rămâne fără el
      const withName = 'Recordul tău (' + r.res.displayName + '): ' + r.res.best;
      text(Font.measure(withName, 1) <= 176 ? withName : 'Recordul tău: ' + r.res.best, W / 2, 48, 'creamLit', 1, 'center');
    }
    const st = SAVE_STATUS[data.saveStatus];
    if (st) Font.wrap(st.text, 29).forEach(function (l, i) { text(l, W / 2, 57 + i * 10, st.color, 1, 'center'); });
    const lb = boardLabels(r.res.key);
    const label = [lb.page, lb.stale].filter(Boolean).join(', ');
    text('Top 10' + (label ? ' (' + label + ')' : ''), W / 2, 77, 'stoneLit', 1, 'center');
    drawBoard(20, 87, 160, 10, r.res.key);
    text(hint('Space sau click pentru start', 'Atinge ecranul pentru start'), W / 2, 137, 'stoneLit', 1, 'center');
  }

  const SAVE_STATUS = {
    saving: { text: 'Se salvează…', color: 'creamLit' },
    saved: { text: 'Scor salvat', color: 'grassLit' },
    offline: { text: 'Fără conexiune — scorul se trimite automat mai târziu', color: 'capLit' },
    rejected: { text: 'Scor respins', color: 'capLit' }
  };

  function wrapped(messages) {
    const lines = [];
    messages.forEach(function (m) { Font.wrap(m, 31).forEach(function (l) { lines.push(l); }); });
    return lines;
  }

  // Ecranul de rezultate e un panou mare peste peisaj; conținutul stă în interiorul ramei (x 4..194, y 4..144)
  const RES_BAR_X = 186;

  function drawResults() {
    panel(0, 0, 198, 148);
    text('Rezultate', W / 2 - 10, 6, 'goldLit', 2, 'center', 'dirtDark');
    const warn = wrapped(Store.warnings());
    let y = 25;
    wrapped(['Date locale — clasamentul complet e în baza de date']).forEach(function (l) { text(l, 8, y, 'stoneLit', 1); y += 9; });
    warn.forEach(function (l) { text(l, 8, y, 'capLit', 1); y += 9; });
    text('#', 8, y, 'stoneLit', 1);
    text('Jucător', 22, y, 'stoneLit', 1);
    text('Rec', 124, y, 'stoneLit', 1, 'right');
    text('Hartă', 128, y, 'stoneLit', 1);
    text('Ture', 182, y, 'stoneLit', 1, 'right');
    y += 10;
    box(6, y - 2, 184, 1, 'goldShade');
    const PITCH = 11; // 11 și nu 10: virgula de la Ș/Ț coboară 2 rânduri sub linie și nu trebuie să atingă rândul următor
    const visible = Math.max(1, Math.floor((126 - y) / PITCH));
    const maxScroll = Math.max(0, data.results.length - visible);
    resultsScroll = Math.max(0, Math.min(maxScroll, resultsScroll));
    resultsLayout = { trackY: y - 1, trackH: visible * PITCH, visible: visible, maxScroll: maxScroll };
    if (maxScroll > 0) { // bară de derulare: se poate trage cu mouse-ul sau se dă click pe ea
      const th = Math.max(8, Math.floor(resultsLayout.trackH * visible / data.results.length));
      const ty = resultsLayout.trackY + Math.round((resultsLayout.trackH - th) * resultsScroll / maxScroll);
      box(RES_BAR_X, resultsLayout.trackY, 4, resultsLayout.trackH, 'nightA');
      box(RES_BAR_X, ty, 4, th, 'gold');
      box(RES_BAR_X, ty, 1, th, 'goldLit');
    }
    for (let i = 0; i < visible; i++) {
      const row = data.results[resultsScroll + i];
      if (!row) break;
      const ry = y + i * PITCH;
      text(String(row.rank), 8, ry, RANK_COLORS[row.rank - 1] || 'creamLit', 1);
      text(Font.clip(row.name, 82, 1), 22, ry, 'creamLit', 1);
      text(String(row.best), 124, ry, 'goldLit', 1, 'right');
      text(row.short, 128, ry, 'creamLit', 1);
      text(String(row.attempts), 182, ry, 'creamLit', 1, 'right');
    }
    const range = data.results.length ? (resultsScroll + 1) + '-' + Math.min(data.results.length, resultsScroll + visible) : '0';
    text(data.results.length + ' jucători, ' + Store.totalRounds() + ' ture (' + range + ')', 8, 127, 'creamLit', 1);
    text('Ctrl+Shift: E=CSV  J=JSON', 8, 136, 'stoneLit', 1);
    button(BTN_BACK, 'Înapoi', 6);
  }

  // state: starea curentă din main.js; info: { playerName }
  function draw(game, state, info) {
    ctx.imageSmoothingEnabled = false; // se pierde dacă cineva redimensionează canvas-ul; fără ea textul mărit iese neclar
    drawFaces(game, state, debug);
    drawWorld(game, state);
    if (state === 'RESULTS') { drawResults(); return; }
    switch (state) {
      case 'ATTRACT': drawAttract(); break;
      case 'NAME_ENTRY': drawNameEntry(); break;
      case 'READY': drawReady(info); break;
      case 'PLAYING': drawPlaying(game, info); break;
      case 'GAME_OVER': drawGameOver(); break;
    }
    if (debug) drawDebug(game, state);
  }

  // ---------------------------------------------------------------- date pentru ecrane (apelate din main.js la schimbarea stării)
  function renderAttract() { data.saveStatus = null; boardStart = performance.now(); }

  function renderReady(playerName, mapName) { data.readyName = playerName; data.readyMap = mapName; }

  function renderGameOver(res, score, mapName) {
    data.over = { res: res, score: score, mapName: mapName };
    boardStart = performance.now();
  }

  // 'saving' | 'saved' | 'offline' | 'rejected'
  function setSaveStatus(s) { data.saveStatus = s; }

  // Cât timp se încarcă, rămân afișate rândurile de dinainte (sau cache-ul)
  function setTop10Loading() { data.top10.loading = true; }

  // rows: [{ rank, name, score, map }] de la server sau din cache; null = nimic de afișat
  function setTop10(rows, stale) {
    data.top10 = {
      rows: rows ? rows.filter(function (p) { return p && typeof p.name === 'string'; }).map(function (p) {
        return { rank: Number(p.rank) || 0, name: p.name, score: Number(p.score) || 0, key: Store.keyOf(p.name) };
      }) : null,
      stale: !!stale,
      loading: false
    };
  }

  function renderResults() {
    resultsScroll = 0;
    data.results = Store.getSorted().map(function (p, i) {
      const m = C.maps.filter(function (x) { return x.name === p.bestMap; })[0];
      return { rank: i + 1, name: p.displayName, best: p.best, attempts: p.attempts, short: m ? m.short : '' };
    });
  }

  // Câmpul de nume NU se focusează singur: cu numele precompletat, Space pornește direct.
  // Se focusează la click / atingere pe el sau la prima tastă de scris (onKeyDown).
  function show(state) {
    document.body.classList.toggle('attract', state === 'ATTRACT'); // butonul de muzică e doar pe ecranul cu Top 10 (style.css)
    if (state !== 'ATTRACT' && typeof Music !== 'undefined') Music.closePanel();
    if (state === 'NAME_ENTRY') {
      input.value = Store.lastName();   // numele de data trecută, gata de modificat
      nameError = '';
      const last = C.characters.findIndex(function (ch) { return ch.id === Store.lastCharacter(); });
      charIndex = last >= 0 ? last : Math.floor(Math.random() * C.characters.length); // prima dată: unul la întâmplare
      input.style.display = 'block';
      placeInput();
      input.blur();
    } else {
      input.blur();
      input.style.display = 'none';
    }
  }

  // Numele nu e bun: mesaj + focus pe câmp, ca jucătorul să-l poată corecta
  function setNameError(msg) {
    nameError = msg;
    focusName();
  }

  function focusName() {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length); // cursorul la final, unde e desenat
  }

  // ---------------------------------------------------------------- input
  function onKeyDown(e) {
    const st = handlers.getState();

    // Scurtături de organizator
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      if (e.code === 'KeyR') { e.preventDefault(); if (!e.repeat) handlers.onToggleResults(); return; }
      if (e.code === 'KeyE') { e.preventDefault(); if (!e.repeat) handlers.onExport(); return; }
      if (e.code === 'KeyJ') { e.preventDefault(); if (!e.repeat) handlers.onExportJson(); return; }
      if (e.code === 'Delete') { e.preventDefault(); if (!e.repeat) handlers.onReset(); return; }
      if (e.code === 'KeyH') { e.preventDefault(); if (!e.repeat) debug = !debug; return; }
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const typing = st === 'NAME_ENTRY' && document.activeElement === input;
    if (e.code === 'Space') {
      if (typing) {
        // Space e caracter normal în username, dar un Space ținut apăsat din ecranul anterior nu trebuie să scrie spații
        if (e.repeat) e.preventDefault();
        return;
      }
      if (st === 'NAME_ENTRY') { // câmpul nu e activ: Space = Start, cu numele și personajul afișate
        e.preventDefault();
        if (!e.repeat) handlers.onNameSubmit(input.value);
        return;
      }
      e.preventDefault(); // fără scroll
      if (!e.repeat) handlers.onSpace();
      return;
    }
    if (e.key === 'Escape') {
      if (!e.repeat) handlers.onEscape();
      return;
    }
    if (st === 'RESULTS') {
      const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -8, PageDown: 8, Home: -1e6, End: 1e6 }[e.key];
      if (step) { e.preventDefault(); resultsScroll += step; }
      return;
    }
    // Săgețile stânga / dreapta schimbă personajul (cursorul din câmp nu se mută: textul se desenează mereu cu cursorul la final)
    if (st === 'NAME_ENTRY' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const n = C.characters.length;
      charIndex = (charIndex + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
      return;
    }
    if (e.key === 'Enter' && st === 'NAME_ENTRY') {
      e.preventDefault();
      if (!e.repeat) handlers.onNameSubmit(input.value);
      return;
    }
    // Câmpul nu e activ și se apasă o literă / Backspace: se activează, iar tasta ajunge în el
    if (st === 'NAME_ENTRY' && !typing && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')) focusName();
  }

  // Poziția unui eveniment de pointer, în pixeli de artă
  function toArt(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  function init(h) {
    handlers = h;
    ctx.imageSmoothingEnabled = false;
    fctx.imageSmoothingEnabled = true;       // pozele se scalează cu netezire, spre deosebire de restul scenei
    fctx.imageSmoothingQuality = 'high';
    loadPhotos();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);

    // Doar caracterele permise intră în câmpul de username (aceleași ca pe server)
    const notAllowed = new RegExp('[^' + C.usernameChars + ']', 'g');
    input.addEventListener('input', function () {
      const v = input.value.normalize('NFC').replace(notAllowed, '');
      if (v !== input.value) input.value = v;
      nameError = '';
    });

    // O atingere sau un click stânga pe canvas = Space (săritură, start, ecranul următor). Butoanele merg prin click.
    canvas.addEventListener('pointerdown', function (e) {
      const touch = e.pointerType === 'touch';
      const st = handlers.getState();
      pressState = st;
      if (!touch && e.button !== 0) return;                            // doar butonul stâng al mouse-ului
      const p = toArt(e);
      if (st === 'RESULTS') return;                                   // derularea și „Înapoi" merg prin click
      if (st === 'NAME_ENTRY') {
        // Pe câmp ajunge doar <input>-ul de deasupra; un click în rest îl dezactivează, ca Space să pornească din nou.
        // „Start" și personajele merg prin click.
        if (touch) e.preventDefault();
        input.blur();
        return;
      }
      e.preventDefault();                                              // fără zoom / selecție
      handlers.onSpace();
    });

    // Mouse: butonul „Rezultate", „Înapoi", „Start", roata și bara de derulare
    const scrollFromY = function (y) {
      if (!resultsLayout || !resultsLayout.maxScroll) return;
      const f = Math.max(0, Math.min(1, (y - resultsLayout.trackY) / resultsLayout.trackH));
      resultsScroll = Math.round(f * resultsLayout.maxScroll);
    };
    const overButton = function () {
      const st = handlers.getState();
      return (st === 'RESULTS' && inside(BTN_BACK, mouse)) ||
             (st === 'NAME_ENTRY' && (inside(BTN_START, mouse) || charAt(mouse) >= 0));
    };
    canvas.addEventListener('mousemove', function (e) {
      const p = toArt(e);
      mouse.x = p.x; mouse.y = p.y;
      if (dragScroll) scrollFromY(p.y);
      canvas.style.cursor = overButton() ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', function () { mouse.x = mouse.y = -1; canvas.style.cursor = 'default'; });
    canvas.addEventListener('mousedown', function (e) {
      const p = toArt(e);
      if (handlers.getState() === 'RESULTS' && resultsLayout && p.x >= RES_BAR_X - 2 && p.x <= RES_BAR_X + 6 && p.y >= resultsLayout.trackY - 2 && p.y <= resultsLayout.trackY + resultsLayout.trackH + 2) {
        dragScroll = true;
        scrollFromY(p.y);
      }
    });
    window.addEventListener('mouseup', function () { dragScroll = false; });
    canvas.addEventListener('click', function (e) {
      const p = toArt(e);
      const st = handlers.getState();
      // Un click care tocmai a schimbat ecranul (pointerdown = Space) nu apasă și un buton de pe ecranul nou
      if (st !== pressState) return;
      if (st === 'RESULTS' && inside(BTN_BACK, p)) handlers.onEscape();
      else if (st === 'NAME_ENTRY' && inside(BTN_START, p)) handlers.onNameSubmit(input.value);
      else if (st === 'NAME_ENTRY' && charAt(p) >= 0) charIndex = charAt(p);
    });
    window.addEventListener('wheel', function (e) {
      if (handlers.getState() !== 'RESULTS') return;
      e.preventDefault();
      const rows = Math.min(3, Math.max(1, Math.round(Math.abs(e.deltaY) / 100)));
      resultsScroll += e.deltaY > 0 ? rows : -rows;
    }, { passive: false });
  }

  return {
    init: init, draw: draw, show: show, setNameError: setNameError,
    renderAttract: renderAttract, renderReady: renderReady,
    renderGameOver: renderGameOver, renderResults: renderResults,
    setSaveStatus: setSaveStatus, setTop10Loading: setTop10Loading, setTop10: setTop10,
    selectedCharacter: function () { return C.characters[charIndex]; }
  };
})();
