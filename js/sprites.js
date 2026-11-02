// Toate sprite-urile sunt definite în cod, ca matrice de caractere. Fiecare caracter e o culoare din PALETTE, „." = transparent.
// La pornire fiecare sprite se pre-randează o singură dată (plus varianta oglindită vertical); în joc se folosește doar drawImage.
const SPRITES = (function () {
  'use strict';

  // Caracterele comune (un sprite poate suprascrie cu propriul `map`)
  const CMAP = {
    k: 'black', a: 'navy', u: 'plum', g: 'dgreen', n: 'brown', d: 'dgray', l: 'lgray', w: 'white',
    r: 'red', o: 'orange', y: 'yellow', G: 'green', b: 'blue', v: 'lav', i: 'pink', p: 'peach'
  };

  // ---------------------------------------------------------------- unelte de desen
  // Grilă de celule; o celulă e „." (transparent) sau un nume de culoare din PALETTE
  function Grid(w, h) {
    const cells = [];
    for (let y = 0; y < h; y++) cells.push(new Array(w).fill('.'));
    return {
      w: w, h: h, cells: cells,
      set: function (x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) cells[y][x] = c; },
      get: function (x, y) { return (x >= 0 && x < w && y >= 0 && y < h) ? cells[y][x] : '.'; },
      fill: function (x, y, fw, fh, c) {
        for (let j = y; j < y + fh; j++) for (let i = x; i < x + fw; i++) this.set(i, j, c);
      }
    };
  }

  // Contur: orice celulă goală, vecină (sus/jos/stânga/dreapta) cu una plină, devine `c`
  function outline(g, c) {
    const add = [];
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.get(x, y) !== '.') continue;
        if (g.get(x - 1, y) !== '.' || g.get(x + 1, y) !== '.' || g.get(x, y - 1) !== '.' || g.get(x, y + 1) !== '.') add.push([x, y]);
      }
    }
    add.forEach(function (p) { g.set(p[0], p[1], c); });
  }

  // Umbrire automată, lumina din stânga-sus: pixelii de culoarea `base` de pe marginea stângă / de sus devin `lit`,
  // cei de pe marginea dreaptă / de jos devin `shade` (marginea = vecin de altă culoare sau transparent)
  function autoShade(g, base, lit, shade) {
    const out = [];
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.get(x, y) !== base) continue;
        if (g.get(x + 1, y) !== base || g.get(x, y + 1) !== base) out.push([x, y, shade]);
        else if (g.get(x - 1, y) !== base || g.get(x, y - 1) !== base) out.push([x, y, lit]);
      }
    }
    out.forEach(function (p) { g.set(p[0], p[1], p[2]); });
  }

  // Grila cu nume de culori -> definiție de sprite (rânduri de caractere + map generat automat)
  function toDef(g) {
    const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const map = {}, inv = {};
    let next = 0;
    const rows = g.cells.map(function (r) {
      return r.map(function (c) {
        if (c === '.') return '.';
        if (!inv[c]) {
          if (!PALETTE[c]) throw new Error('Culoare inexistentă în paletă: ' + c);
          inv[c] = POOL[next++];
          map[inv[c]] = c;
        }
        return inv[c];
      }).join('');
    });
    return { map: map, rows: rows };
  }

  function checker(x, y) { return (x + y) & 1; } // amestec 50% între două nuanțe

  // ---------------------------------------------------------------- personajele-rezervă (12x12, 2 cadre)
  // Se văd doar dacă poza unui membru nu se încarcă.
  // m = culoarea principală, w = aripa, o = cioc/picioare, e = ochi, p = pupilă, A..D = celule de marcaj (2 pixeli diferiți per personaj)
  const CHAR_UP = [
    '...kkkkkk...',
    '..kmmmmmmk..',
    '.kwwmmmepmk.',
    '.kwwwmmmmmkk',
    'kmmwwmmmmmoo',
    'kmmmmmmmmmoo',
    'kmmmABmmmk..',
    '.kmmCDmmmk..',
    '.kmmmmmmmk..',
    '..kkmmmmkk..',
    '....kkkk....',
    '...oo..oo...'
  ];
  const CHAR_DOWN = [
    '...kkkkkk...',
    '..kmmmmmmk..',
    '.kmmmmmepmk.',
    '.kmmmmmmmmkk',
    'kmmmmmmmmmoo',
    'kmmmmmmmmmoo',
    'kwwmABmmmmk.',
    '.kwwCDmmmk..',
    '.kmmmmmmmk..',
    '..kkmmmmkk..',
    '....kkkk....',
    '...oo..oo...'
  ];
  // Culoare principală distinctă + 2 pixeli de marcaj pe burtă
  const CHAR_STYLE = {
    bucur:    { main: 'red',    marks: 'AD' },
    bianca:   { main: 'pink',   marks: 'BC' },
    madalina: { main: 'lav',    marks: 'AB' },
    costi:    { main: 'blue',   marks: 'CD' },
    andrei:   { main: 'yellow', marks: 'BD' },
    ovidiu:   { main: 'green',  marks: 'AC' }
  };

  function charRows(tpl, marks) {
    return tpl.map(function (row) {
      return row.replace(/[ABCD]/g, function (ch) { return marks.indexOf(ch) >= 0 ? 'k' : 'm'; })
                .replace(/e/g, 'w').replace(/p/g, 'k');
    });
  }

  // ---------------------------------------------------------------- obstacole
  // Orientare „jos": rândul 0 al capătului e spre gap. Lumina vine din stânga, ca în peisaje.
  // Corpurile au 16 pixeli lățime; capetele între 12 și 22.

  // --- Ciuperci (Grințieșu Mic)
  function mushroomBody() {
    const g = Grid(16, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        let c;
        if (x === 0 || x === 15) c = 'creamDeep';
        else if (x <= 3) c = x === 3 && checker(x, y) ? 'cream' : 'creamLit';
        else if (x <= 9) c = 'cream';
        else if (x <= 12) c = x === 10 && checker(x, y) ? 'cream' : 'creamShade';
        else c = 'creamDeep';
        if ((x * 7 + y * 3) % 13 === 0 && x > 1 && x < 14) c = c === 'creamLit' ? 'cream' : 'creamShade'; // fibre
        g.set(x, y, c);
      }
    }
    return toDef(g);
  }

  function mushroomCap() {
    const W = 22, H = 11, g = Grid(W, H);
    for (let y = 0; y < H; y++) {
      const t = (H - 1 - y) / H;
      const half = (W / 2) * Math.sqrt(1 - t * t);
      for (let x = 0; x < W; x++) {
        const dx = x - (W - 1) / 2;
        if (Math.abs(dx) > half - 0.5) continue;
        let c;
        if (y === H - 1) c = x % 2 ? 'creamShade' : 'creamDeep';          // lamelele de sub pălărie
        else if (y === 0 || Math.abs(dx) > half - 1.5) c = 'capDeep';      // margine
        else {
          const s = (dx / half) * 0.75 + (y / (H - 1)) * 0.9;              // 0 = sus-stânga (lumină), mare = jos-dreapta
          if (s < 0.05) c = 'capLit';
          else if (s < 0.2) c = checker(x, y) ? 'capLit' : 'capRed';
          else if (s < 0.85) c = 'capRed';
          else if (s < 1.05) c = checker(x, y) ? 'capRed' : 'capShade';
          else c = 'capShade';
        }
        g.set(x, y, c);
      }
    }
    // buline, fiecare cu lumină sus-stânga și umbră jos-dreapta
    [[5, 5], [14, 3], [9, 7], [16, 7], [9, 2]].forEach(function (s) {
      const px = [[0, 0, 'creamLit'], [1, 0, 'cream'], [0, 1, 'cream'], [1, 1, 'creamShade']];
      px.forEach(function (p) {
        const c = g.get(s[0] + p[0], s[1] + p[1]);
        if (c !== '.' && c !== 'capDeep') g.set(s[0] + p[0], s[1] + p[1], p[2]);
      });
    });
    return toDef(g);
  }

  // --- Blocuri de locuințe (Poiana)
  function concreteAt(x) {
    if (x === 0 || x === 15) return 'stoneShade';
    if (x <= 3) return 'stoneLit';
    if (x <= 11) return 'lgray';
    return 'stone';
  }

  function blockBody() {
    const g = Grid(16, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) g.set(x, y, concreteAt(x));
    for (let x = 1; x < 15; x++) { g.set(x, 11, x <= 3 ? 'lgray' : 'stone'); g.set(x, 10, 'stoneShade'); } // placa dintre etaje
    // fereastră rece (cer reflectat) și fereastră luminată cald
    for (let y = 3; y <= 7; y++) {
      for (let x = 3; x <= 5; x++) g.set(x, y, y === 3 && x === 3 ? 'skyD' : y <= 4 ? 'skyB' : 'skyA');
      for (let x = 10; x <= 12; x++) g.set(x, y, y >= 6 ? 'duskD' : 'duskE');
    }
    for (let x = 2; x <= 6; x++) g.set(x, 8, 'stoneLit');   // pervaz
    for (let x = 9; x <= 13; x++) g.set(x, 8, 'lgray');
    for (let y = 3; y <= 7; y++) { g.set(6, y, 'stone'); g.set(13, y, 'stoneShade'); } // umbra din ambrazură
    return toDef(g);
  }

  function blockRoof() {
    const g = Grid(20, 5);
    for (let x = 0; x < 20; x++) {
      g.set(x, 0, 'stoneShade');
      g.set(x, 1, x <= 4 ? 'stoneLit' : x <= 14 ? 'lgray' : 'stone');
      g.set(x, 2, x <= 4 ? 'lgray' : 'stone');
      g.set(x, 3, 'stoneShade');
      g.set(x, 4, x <= 5 ? 'stoneLit' : x <= 15 ? 'lgray' : 'stone');
    }
    for (let y = 0; y < 5; y++) { g.set(0, y, 'stoneShade'); g.set(19, y, 'stoneShade'); }
    return toDef(g);
  }

  function blockGround() {
    const g = Grid(16, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) g.set(x, y, concreteAt(x));
    for (let x = 4; x <= 11; x++) { g.set(x, 1, 'capRed'); g.set(x, 2, x % 2 ? 'capShade' : 'capRed'); } // copertină
    for (let y = 3; y <= 11; y++) {
      for (let x = 6; x <= 9; x++) g.set(x, y, x === 6 ? 'dirt' : x === 9 ? 'dirtDark' : 'trunk');   // ușă
    }
    g.set(8, 7, 'gold');
    for (let y = 4; y <= 6; y++) { g.set(2, y, 'skyB'); g.set(3, y, y === 4 ? 'skyD' : 'skyA'); g.set(12, y, 'skyB'); g.set(13, y, 'skyA'); }
    return toDef(g);
  }

  // --- Brazi (Bradu)
  function pineColor(rel) { // rel: poziția relativă pe lățimea etajului, de la -1 (stânga, lumină) la 1 (dreapta, umbră)
    if (rel < -0.45) return 'pineLit';
    if (rel < 0.25) return 'pine';
    if (rel < 0.7) return 'pineShade';
    return 'pineDeep';
  }

  function firBody() {
    const g = Grid(16, 8);
    for (let y = 0; y < 8; y++) {
      const half = 2 + Math.round(y * 6 / 7);
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5;
        if (Math.abs(dx) >= half) continue;
        let c = pineColor(dx / half);
        if (y === 0) c = x < 8 ? 'trunk' : 'dirtDark';            // trunchiul se vede între etaje
        else if (y === 7 && dx > -half * 0.5) c = 'pineShade';     // umbra de sub etaj
        g.set(x, y, c);
      }
    }
    return toDef(g);
  }

  function firTip() {
    const W = 16, H = 16, g = Grid(W, H);
    for (let y = 0; y < H; y++) {
      const half = 1 + y * 7 / (H - 1) + (y % 5 === 4 ? 0.8 : 0);   // mici zimți de crengi
      for (let x = 0; x < W; x++) {
        const dx = x - 7.5;
        if (Math.abs(dx) >= half) continue;
        let c = pineColor(dx / half);
        if (y % 5 === 0 && y > 0 && dx > -half * 0.4) c = 'pineShade';
        if (y === 0) c = 'pineLit';
        g.set(x, y, c);
      }
    }
    return toDef(g);
  }

  // --- Cai (Moci): stâlp de gard (corp) + cap de cal orientat spre gap. Totemul de cai nu e lizibil la 16 pixeli lățime.
  function fencePost() {
    const g = Grid(16, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        let c;
        if (x === 0 || x === 15 || x === 7 || x === 8) c = 'dirtDark';           // marginile scândurilor
        else {
          const lx = x < 7 ? x - 1 : x - 9;                                      // poziția pe scândură (0..5)
          c = lx <= 1 ? 'brown' : lx <= 3 ? 'dirt' : 'trunk';
          if ((x * 5 + Math.floor(y / 3) * 7) % 11 === 0) c = 'trunk';            // fibra lemnului
        }
        g.set(x, y, c);
      }
    }
    [[3, 1], [12, 1], [3, 5], [12, 5]].forEach(function (p) { g.set(p[0], p[1], 'stoneLit'); g.set(p[0], p[1] + 1, 'stoneShade'); }); // cuie
    return toDef(g);
  }

  // Cap de cal în profil, privind spre dreapta: ureche, coamă pe ceafă, ochi, bot lung cu vârf deschis și nară, gât dedesubt
  const HORSE = [
    '.......nn...........',
    '.......nnn..........',
    '...k..nnnnn.........',
    '..kk.nnnnnnn........',
    '..kk.nnnnnnnnn......',
    '..kk.nnnnwknnnnn....',
    '.kkk.nnnnnnnnnnnn...',
    '.kkk.nnnnnnnnnnnnnn.',
    '.kkk.nnnnnnnnnnnppp.',
    '.kkk.nnnnnnnnnnnpkp.',
    '.kkk.nnnnnnnnnnnnnn.',
    '.kkk.nnnnnnnnnnnn...',
    '.kkk.nnnnnnnnn......',
    'kkkk.nnnnnnnnn......',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....',
    'kkkk.nnnnnnnnnn.....'
  ];

  function horseHead() {
    const NAMES = { n: 'horse', k: 'horseMane', p: 'peach', w: 'cloud' };
    const g = Grid(22, 24);
    HORSE.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') g.set(x + 1, y + 1, NAMES[row[x]]);
    });
    autoShade(g, 'horse', 'horseLit', 'horseShade');
    autoShade(g, 'horseMane', 'dirtDark', 'horseMane');
    autoShade(g, 'peach', 'mornD', 'creamShade');
    // lumină pe frunte și pe bot, ca volum
    [[8, 4], [9, 4], [8, 5], [14, 8], [15, 8]].forEach(function (p) { if (g.get(p[0], p[1]) === 'horse') g.set(p[0], p[1], 'horseLit'); });
    outline(g, 'horseMane');
    return toDef(g);
  }

  // --- Săbii (Grințieșu Mare): lama (corp) + vârful (capăt, se îngustează spre gap) + mâner și gardă la capătul dinspre sol
  function bladeColumn(x) {
    if (x === 0 || x === 15) return 'rockDeep';
    if (x === 1) return 'snow';            // tăișul luminat
    if (x <= 3) return 'stoneLit';
    if (x <= 6) return 'lgray';
    if (x === 7) return 'stoneShade';      // șanțul lamei
    if (x === 8) return 'stoneLit';
    if (x <= 11) return 'stone';
    return 'stoneShade';
  }

  function swordBody() {
    const g = Grid(16, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        let c = bladeColumn(x);
        if (x >= 2 && x <= 6 && (x + y) % 8 === 0) c = 'snow';    // reflexe pe metal
        g.set(x, y, c);
      }
    }
    return toDef(g);
  }

  function swordTip() {
    const W = 16, H = 16, g = Grid(W, H);
    for (let y = 0; y < H; y++) {
      const half = 1 + y * 7 / (H - 1);
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x - 7.5);
        if (dx >= half) continue;
        g.set(x, y, (y === 0 || dx >= half - 1) ? 'rockDeep' : bladeColumn(x));
      }
    }
    return toDef(g);
  }

  function swordHilt() {
    const g = Grid(22, 16);
    for (let x = 1; x <= 20; x++) {                       // garda
      g.set(x, 1, x <= 6 ? 'goldLit' : 'gold');
      g.set(x, 2, x <= 3 ? 'goldLit' : 'gold');
      g.set(x, 3, 'goldShade');
    }
    for (let y = 4; y <= 12; y++) {                       // mânerul, înfășurat în piele
      for (let x = 8; x <= 13; x++) {
        let c = x <= 9 ? 'dirt' : x <= 11 ? 'trunk' : 'dirtDark';
        if ((x + y) % 3 === 0) c = 'dirtDark';
        g.set(x, y, c);
      }
    }
    for (let x = 7; x <= 14; x++) { g.set(x, 13, x <= 9 ? 'goldLit' : 'gold'); g.set(x, 14, 'goldShade'); } // măciulia
    g.set(10, 13, 'red'); g.set(11, 13, 'capShade');      // piatra din măciulie
    outline(g, 'dirtDark');
    return toDef(g);
  }

  // ---------------------------------------------------------------- registru
  const defs = {};

  Object.keys(CHAR_STYLE).forEach(function (id) {
    const st = CHAR_STYLE[id];
    defs['char_' + id + '_up'] = { map: { m: st.main }, rows: charRows(CHAR_UP, st.marks) };
    defs['char_' + id + '_down'] = { map: { m: st.main }, rows: charRows(CHAR_DOWN, st.marks) };
  });

  defs.mushroomBody = mushroomBody();
  defs.mushroomCap = mushroomCap();
  defs.blockBody = blockBody();
  defs.blockRoof = blockRoof();
  defs.blockGround = blockGround();
  defs.firBody = firBody();
  defs.firTip = firTip();
  defs.fencePost = fencePost();
  defs.horseHead = horseHead();
  defs.swordBody = swordBody();
  defs.swordTip = swordTip();
  defs.swordHilt = swordHilt();

  // Pre-randare: o singură dată, la pornire
  const built = {};

  function colorOf(def, ch) {
    const name = (def.map && def.map[ch]) || CMAP[ch];
    return name ? PALETTE[name] : null;
  }

  function build(name) {
    const def = defs[name];
    const h = def.rows.length, w = def.rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (let r = 0; r < h; r++) {
      for (let col = 0; col < w; col++) {
        const ch = def.rows[r][col];
        if (ch === '.') continue;
        const color = colorOf(def, ch);
        if (!color) throw new Error('Sprite ' + name + ': caracter necunoscut "' + ch + '"');
        x.fillStyle = color;
        x.fillRect(col, r, 1, 1);
      }
    }
    const f = document.createElement('canvas');
    f.width = w; f.height = h;
    const fx = f.getContext('2d');
    fx.translate(0, h);
    fx.scale(1, -1);
    fx.drawImage(c, 0, 0);
    // întinderea pixelilor opaci pe fiecare rând: [minX, maxX] sau null
    const ext = def.rows.map(function (row) {
      let lo = -1, hi = -1;
      for (let i = 0; i < row.length; i++) if (row[i] !== '.') { if (lo < 0) lo = i; hi = i; }
      return lo < 0 ? null : [lo, hi];
    });
    return { c: c, f: f, w: w, h: h, ext: ext };
  }

  function get(name) {
    if (!built[name]) {
      if (!defs[name]) throw new Error('Sprite inexistent: ' + name);
      built[name] = build(name);
    }
    return built[name];
  }

  Object.keys(defs).forEach(get); // pre-randează tot acum, nu în bucla de joc

  return { get: get, names: Object.keys(defs) };
})();
