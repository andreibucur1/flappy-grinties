// Fundaluri procedurale, pixel art „realist": cer în degrade (dither), munți cu zăpadă și versanți luminați / umbriți,
// vârf stâncos, siluete de pădure, brazi, dealuri cu iarbă și pietre, sol texturat.
// Fiecare hartă are mai multe straturi cu parallax (viteză diferită); solul merge cu 1.0 x viteza, exact cu obstacolele.
// Totul se pre-randează o singură dată, din culorile din PALETTE. Straturile se repetă fără cusătură (perioadă = lățimea ecranului).
const Backgrounds = (function () {
  'use strict';

  const PS = CONFIG.pixelSize;
  const W = CONFIG.canvas.width / PS;                                   // 200
  const SKY_H = (CONFIG.canvas.height - CONFIG.groundHeight) / PS;      // 135 (marginea de sus a solului)
  const GROUND_H = CONFIG.groundHeight / PS;                            // 15
  const GROUND_W = 64;                                                  // perioada solului
  const BLADES = 2;                                                     // fire de iarbă deasupra liniei solului
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  const RGB = {};
  Object.keys(PALETTE).forEach(function (k) {
    const h = PALETTE[k];
    RGB[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  });

  // ---------------------------------------------------------------- unelte
  function rng(seed) { // pseudo-aleator determinist: același peisaj la fiecare pornire
    let s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function hash(n) { // zgomot fix per poziție, în [0, 1)
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // Diferența pe orizontală, ținând cont că stratul se închide circular
  function wrapDx(d) { return ((d % W) + W * 1.5) % W - W / 2; }

  // Strat de pixeli; x se închide circular (fără cusătură la repetare), y din afara stratului se ignoră
  function Layer(w, h) {
    const img = new ImageData(w, h);
    const d = img.data;
    return {
      w: w, h: h, img: img,
      set: function (x, y, c) {
        y = Math.round(y);
        if (y < 0 || y >= h) return;
        x = ((Math.round(x) % w) + w) % w;
        const i = (y * w + x) * 4, v = RGB[c];
        d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255;
      }
    };
  }

  function toCanvas(L) {
    const c = document.createElement('canvas');
    c.width = L.w; c.height = L.h;
    c.getContext('2d').putImageData(L.img, 0, 0);
    return c;
  }

  // Alege o culoare dintr-un degrade (listă de culori) la poziția t în [0, 1], cu dither ordonat între trepte
  function grad(colors, t, x, y) {
    const f = Math.max(0, Math.min(1, t)) * (colors.length - 1);
    const i = Math.min(colors.length - 2, Math.floor(f));
    return (f - i) * 16 > BAYER[y & 3][x & 3] ? colors[i + 1] : colors[i];
  }

  // ---------------------------------------------------------------- elemente de peisaj
  function sky(L, colors, height) {
    const h = height || L.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < L.w; x++) L.set(x, y, grad(colors, y / (h - 1), x, y));
  }

  function stars(L, r, count, maxY, colors) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * maxY);
      L.set(x, y, colors[i % colors.length]);
      if (r() < 0.15) { L.set(x - 1, y, colors[0]); L.set(x + 1, y, colors[0]); L.set(x, y - 1, colors[0]); L.set(x, y + 1, colors[0]); }
    }
  }

  function moon(L, cx, cy, rad, color, shade) {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y > rad * rad) continue;
      const c = ((x - 2) * (x - 2) + (y - 1) * (y - 1) < 3) || ((x + 2) * (x + 2) + (y + 2) * (y + 2) < 2) ? shade : color;
      L.set(cx + x, cy + y, c);
    }
  }

  // Nor pufos din cercuri; partea de jos e în umbră
  function cloud(L, r, cx, cy, size, lit, shade) {
    const blobs = [];
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) blobs.push([lerp(-size, size, i / (n - 1)), (r() - 0.6) * size * 0.4, size * lerp(0.35, 0.6, r())]);
    for (let y = -size; y <= size; y++) {
      for (let x = -size * 2; x <= size * 2; x++) {
        let inside = false;
        for (let k = 0; k < blobs.length && !inside; k++) {
          const b = blobs[k], dx = x - b[0], dy = y - b[1];
          inside = dx * dx + dy * dy * 2.2 <= b[2] * b[2];
        }
        if (inside && y < size * 0.35) L.set(cx + x, cy + y, y > size * 0.08 ? shade : lit);
      }
    }
  }

  // Lanț de munți ascuțiți: reuniune de vârfuri triunghiulare, cu muchie zimțată, versant stâng luminat și drept umbrit,
  // dungi verticale de stâncă și, opțional, zăpadă pe vârfuri.
  function mountains(L, r, o) {
    const peaks = [];
    for (let i = 0; i < o.count; i++) {
      peaks.push({ cx: (i + r() * 0.8) * W / o.count, h: lerp(o.minH, o.maxH, r()), w: lerp(o.minW, o.maxW, r()) });
    }
    const seed = Math.floor(r() * 1e6);
    for (let x = 0; x < W; x++) {
      let best = null, bh = 0, bdx = 0;
      peaks.forEach(function (p) {
        const dx = wrapDx(x - p.cx);
        const hgt = p.h * (1 - Math.abs(dx) / p.w);
        if (hgt > bh) { bh = hgt; best = p; bdx = dx; }
      });
      if (!best) continue;
      bh += (hash(x * 13 + seed) - 0.5) * o.rough + Math.sin(x * 0.7 + seed) * o.rough * 0.3;
      const top = Math.round(o.base - bh);
      const peakTop = o.base - best.h;
      const snowY = peakTop + best.h * (o.snowFrac || 0) + (hash(x * 7 + seed) - 0.5) * 5;
      const lit = bdx < 0;
      const streak = hash(x * 31 + seed) < o.streak;
      for (let y = top; y < L.h; y++) {
        let c;
        if (o.snow && y < snowY) c = lit ? o.snow : o.snowShade;
        else if (lit) c = streak ? o.mid : grad([o.lit, o.mid], (y - top) / 26, x, y);
        else c = streak && o.deep ? o.deep : grad([o.shade, o.deep || o.shade], (y - top) / 40, x, y);
        if (o.fade && y > o.base - o.fade) c = grad([c, o.fadeTo], (y - (o.base - o.fade)) / o.fade, x, y);
        L.set(x, y, c);
      }
    }
  }

  // Siluetă de pădure: brazi în triunghiuri zimțate, plus pământ plin sub ei
  function forest(L, r, o) {
    for (let y = o.base; y < L.h; y++) for (let x = 0; x < W; x++) L.set(x, y, o.color);
    const n = Math.floor(W / o.spacing);
    for (let i = 0; i < n; i++) {
      const cx = i * o.spacing + r() * o.spacing, h = lerp(o.minH, o.maxH, r());
      for (let j = 0; j < h; j++) {
        const half = Math.floor(j * 0.32 + (j % 4) * 0.4);
        for (let dx = -half; dx <= half; dx++) L.set(cx + dx, o.base - h + j, dx > half * 0.4 && o.dark ? o.dark : o.color);
      }
    }
  }

  // Brad detaliat: trunchi, crengi în etaje zimțate, lumină din stânga, umbră în dreapta și sub fiecare etaj
  function pine(L, cx, baseY, h, c) {
    const trunkH = Math.max(2, Math.round(h * 0.12));
    for (let y = baseY - trunkH; y <= baseY; y++) { L.set(cx, y, c.trunk); L.set(cx + 1, y, c.deep); }
    const crown = h - trunkH, top = baseY - h;
    for (let j = 0; j < crown; j++) {
      const tier = j % 6;
      const half = Math.round(j * 0.27 + tier * 0.5);
      for (let dx = -half; dx <= half + 1; dx++) {
        let col = dx < -half * 0.25 ? c.lit : dx > half * 0.35 ? c.shade : c.mid;
        if (tier >= 5 && dx > -half * 0.6) col = c.shade;   // umbra de sub etaj
        if (dx >= half) col = c.deep;                        // marginea umbrită
        if (j === 0) col = c.mid;
        L.set(cx + dx, top + j, col);
      }
    }
  }

  // Piatră: elipsă luminată sus-stânga, umbrită jos-dreapta
  function stone(L, cx, cy, w, h, c) {
    for (let y = -h; y <= 0; y++) for (let x = -w; x <= w; x++) {
      if ((x * x) / (w * w) + (y * y) / (h * h) > 1) continue;
      const s = x / w - y / h;
      L.set(cx + x, cy + y, y === 0 ? c.shade : s < -0.2 ? c.lit : s > 0.6 ? c.shade : c.mid);
    }
  }

  // Dealuri ondulate; întoarce înălțimea de suprafață pe fiecare coloană (ca să se poată așeza brazi, pietre, garduri pe ele)
  function hills(L, r, o) {
    const ph1 = r() * 6.28, ph2 = r() * 6.28;
    const tops = [];
    for (let x = 0; x < W; x++) {
      const top = Math.round(o.base - o.amp1 * Math.sin(2 * Math.PI * o.n1 * x / W + ph1) - o.amp2 * Math.sin(2 * Math.PI * o.n2 * x / W + ph2));
      tops.push(top);
      for (let y = top; y < L.h; y++) L.set(x, y, grad(o.colors, (y - top) / o.depth, x, y));
      if (hash(x * 17 + o.base) < 0.35) L.set(x, top - 1, o.colors[0]); // fire de iarbă pe creastă
    }
    return tops;
  }

  function scatterPines(L, r, tops, count, minH, maxH, c) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor((i + r() * 0.7) * W / count);
      pine(L, x, tops[x] + 1, Math.round(lerp(minH, maxH, r())), c);
    }
  }

  function scatterStones(L, r, tops, count, c) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(r() * W);
      stone(L, x, tops[x] + 2 + Math.floor(r() * 4), 2 + Math.floor(r() * 4), 2 + Math.floor(r() * 2), c);
    }
  }

  function flowers(L, r, tops, count, colors) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(r() * W);
      L.set(x, tops[x] + 2 + Math.floor(r() * 12), colors[i % colors.length]);
    }
  }

  // Gard de lemn care urmează creasta dealului
  function fence(L, tops, c) {
    for (let x = 0; x < W; x++) {
      const t = tops[x];
      L.set(x, t - 5, c.rail); L.set(x, t - 2, c.rail);
      if (x % 14 === 0) for (let y = t - 7; y <= t; y++) { L.set(x, y, c.post); L.set(x + 1, y, c.postShade); }
    }
  }

  // Blocuri în ceața depărtării (Poiana)
  function village(L, r, tops, c) {
    let x = 10;
    while (x < W - 30) {
      const w = 7 + Math.floor(r() * 5), h = 12 + Math.floor(r() * 12);
      const base = tops[x + Math.floor(w / 2)] + 2;
      for (let y = base - h; y < base; y++) {
        for (let i = 0; i < w; i++) {
          let col = i >= w - 2 ? c.dark : c.wall;
          if (y === base - h) col = c.dark;
          if (i % 3 === 1 && (y - (base - h)) % 4 === 2 && i < w - 2) col = hash(x * 7 + i * 13 + y) < 0.5 ? c.window : c.dark;
          L.set(x + i, y, col);
        }
      }
      x += w + 6 + Math.floor(r() * 14);
    }
  }

  // ---------------------------------------------------------------- hărțile
  const PINE_DAY = { lit: 'pineLit', mid: 'pine', shade: 'pineShade', deep: 'pineDeep', trunk: 'trunk' };
  const PINE_NIGHT = { lit: 'grassNightLit', mid: 'grassNight', shade: 'grassNightShade', deep: 'forestNight', trunk: 'dirtDark' };
  const STONE_DAY = { lit: 'stoneLit', mid: 'stone', shade: 'stoneShade' };
  const STONE_NIGHT = { lit: 'mtnNightLit', mid: 'mtnNight', shade: 'mtnNightShade' };
  const GRASS_DAY = ['grassLit', 'grass', 'grassShade', 'grassDeep'];
  const GRASS_NIGHT = ['grassNightLit', 'grassNight', 'grassNightShade', 'forestNight'];

  // Fiecare strat: speed = fracțiune din viteza obstacolelor (0 = fix), build(L, r) desenează stratul
  const SCENES = {
    grintiesuMic: {
      ground: { lit: 'grassLit', mid: 'grass', shade: 'grassShade', dirt: 'dirt', dirtDark: 'dirtDark', pebble: STONE_DAY },
      layers: [
        { speed: 0, build: function (L) { sky(L, ['skyA', 'skyB', 'skyC', 'skyD']); } },
        { speed: 0.04, build: function (L, r) { cloud(L, r, 30, 18, 9, 'cloud', 'cloudShade'); cloud(L, r, 120, 30, 7, 'cloud', 'cloudShade'); cloud(L, r, 175, 12, 6, 'cloud', 'cloudShade'); } },
        { speed: 0.1, build: function (L, r) { mountains(L, r, { count: 4, base: 100, minH: 38, maxH: 62, minW: 34, maxW: 52, lit: 'mtnFarLit', mid: 'mtnFar', shade: 'mtnFarShade', snow: 'snow', snowShade: 'snowShade', snowFrac: 0.22, streak: 0.08, rough: 2 }); } },
        { speed: 0.18, build: function (L, r) { mountains(L, r, { count: 1, base: 118, minH: 92, maxH: 98, minW: 52, maxW: 56, lit: 'rockLit', mid: 'rock', shade: 'rockShade', deep: 'rockDeep', streak: 0.35, rough: 4, fade: 20, fadeTo: 'forestFar' }); } },
        { speed: 0.3, build: function (L, r) { forest(L, r, { base: 114, spacing: 4, minH: 8, maxH: 18, color: 'forestFar', dark: 'forestFarDark' }); } },
        { speed: 0.55, build: function (L, r) {
          const t = hills(L, r, { base: 124, amp1: 6, n1: 1, amp2: 3, n2: 3, colors: GRASS_DAY, depth: 16 });
          scatterPines(L, r, t, 4, 28, 46, PINE_DAY);
          scatterStones(L, r, t, 6, STONE_DAY);
        } }
      ]
    },
    poiana: {
      ground: { lit: 'grassLit', mid: 'grass', shade: 'grassShade', dirt: 'dirt', dirtDark: 'dirtDark', pebble: STONE_DAY },
      layers: [
        { speed: 0, build: function (L) { sky(L, ['skyB', 'skyC', 'skyD', 'mornB']); } },
        { speed: 0.04, build: function (L, r) { cloud(L, r, 50, 22, 8, 'cloud', 'cloudShade'); cloud(L, r, 150, 34, 9, 'cloud', 'cloudShade'); } },
        { speed: 0.1, build: function (L, r) { mountains(L, r, { count: 5, base: 108, minH: 22, maxH: 38, minW: 30, maxW: 44, lit: 'mtnFarLit', mid: 'mtnFar', shade: 'mtnFarShade', snow: 'snow', snowShade: 'snowShade', snowFrac: 0.18, streak: 0.06, rough: 1.5 }); } },
        { speed: 0.2, build: function (L, r) {
          const t = hills(L, r, { base: 112, amp1: 3, n1: 2, amp2: 2, n2: 5, colors: ['haze', 'hazeDark'], depth: 20 });
          village(L, r, t, { wall: 'haze', dark: 'hazeDark', window: 'star' });
        } },
        { speed: 0.55, build: function (L, r) {
          const t = hills(L, r, { base: 125, amp1: 4, n1: 1, amp2: 2, n2: 4, colors: GRASS_DAY, depth: 18 });
          flowers(L, r, t, 70, ['yellow', 'white', 'pink']);
          scatterPines(L, r, t, 2, 26, 38, PINE_DAY);
          scatterStones(L, r, t, 3, STONE_DAY);
        } }
      ]
    },
    bradu: {
      ground: { lit: 'mtnDuskLit', mid: 'mtnDusk', shade: 'mtnDuskShade', dirt: 'dirtDark', dirtDark: 'forestDuskDark', pebble: { lit: 'mtnDuskLit', mid: 'mtnDusk', shade: 'mtnDuskShade' } },
      layers: [
        { speed: 0, build: function (L) { sky(L, ['duskA', 'duskB', 'duskC', 'duskD', 'duskE']); } },
        { speed: 0.1, build: function (L, r) { mountains(L, r, { count: 4, base: 104, minH: 40, maxH: 66, minW: 32, maxW: 48, lit: 'mtnDuskLit', mid: 'mtnDusk', shade: 'mtnDuskShade', streak: 0.06, rough: 2 }); } },
        { speed: 0.22, build: function (L, r) { forest(L, r, { base: 106, spacing: 4, minH: 10, maxH: 22, color: 'forestDusk', dark: 'forestDuskDark' }); } },
        { speed: 0.35, build: function (L, r) { forest(L, r, { base: 118, spacing: 5, minH: 14, maxH: 28, color: 'forestDuskDark' }); } },
        // Fără brazi în prim-plan și fără verdele lor: obstacolele de pe Bradu sunt brazi și trebuie să se distingă de fundal
        { speed: 0.55, build: function (L, r) {
          const t = hills(L, r, { base: 126, amp1: 4, n1: 2, amp2: 2, n2: 5, colors: ['mtnDusk', 'mtnDuskShade', 'forestDusk', 'forestDuskDark'], depth: 14 });
          scatterStones(L, r, t, 5, { lit: 'mtnDuskLit', mid: 'mtnDusk', shade: 'mtnDuskShade' });
        } }
      ]
    },
    moci: {
      ground: { lit: 'grassLit', mid: 'grass', shade: 'grassShade', dirt: 'dirt', dirtDark: 'dirtDark', pebble: STONE_DAY },
      layers: [
        { speed: 0, build: function (L) { sky(L, ['mornA', 'mornB', 'mornC', 'mornD']); } },
        { speed: 0.04, build: function (L, r) { cloud(L, r, 70, 26, 8, 'cloud', 'mornC'); cloud(L, r, 160, 16, 6, 'cloud', 'mornC'); } },
        { speed: 0.1, build: function (L, r) { mountains(L, r, { count: 4, base: 104, minH: 30, maxH: 52, minW: 34, maxW: 50, lit: 'mtnMornLit', mid: 'mtnMorn', shade: 'mtnMornShade', snow: 'snow', snowShade: 'mtnMornLit', snowFrac: 0.2, streak: 0.06, rough: 1.5 }); } },
        { speed: 0.25, build: function (L, r) { hills(L, r, { base: 112, amp1: 6, n1: 1, amp2: 2, n2: 3, colors: ['grass', 'grassShade', 'grassDeep'], depth: 22 }); } },
        { speed: 0.55, build: function (L, r) {
          const t = hills(L, r, { base: 126, amp1: 3, n1: 2, amp2: 2, n2: 5, colors: GRASS_DAY, depth: 16 });
          fence(L, t, { rail: 'trunk', post: 'brown', postShade: 'trunk' });
          scatterPines(L, r, t, 2, 24, 34, PINE_DAY);
          scatterStones(L, r, t, 4, STONE_DAY);
        } }
      ]
    },
    grintiesuMare: {
      ground: { lit: 'grassNightLit', mid: 'grassNight', shade: 'grassNightShade', dirt: 'forestNight', dirtDark: 'nightA', pebble: STONE_NIGHT },
      layers: [
        { speed: 0, build: function (L, r) { sky(L, ['nightA', 'nightB', 'nightC', 'nightD']); stars(L, r, 60, 80, ['star', 'cloud', 'snowNight']); } },
        { speed: 0.02, build: function (L) { moon(L, 160, 22, 7, 'moon', 'snowNightShade'); } },
        { speed: 0.1, build: function (L, r) { mountains(L, r, { count: 4, base: 104, minH: 50, maxH: 76, minW: 34, maxW: 50, lit: 'mtnNightLit', mid: 'mtnNight', shade: 'mtnNightShade', snow: 'snowNight', snowShade: 'snowNightShade', snowFrac: 0.38, streak: 0.08, rough: 2.5 }); } },
        { speed: 0.18, build: function (L, r) { mountains(L, r, { count: 1, base: 120, minH: 90, maxH: 96, minW: 50, maxW: 54, lit: 'rockShade', mid: 'rockDeep', shade: 'mtnNightShade', deep: 'forestNight', streak: 0.3, rough: 4, fade: 22, fadeTo: 'forestNight' }); } },
        { speed: 0.3, build: function (L, r) { forest(L, r, { base: 116, spacing: 4, minH: 8, maxH: 18, color: 'forestNight' }); } },
        { speed: 0.55, build: function (L, r) {
          const t = hills(L, r, { base: 126, amp1: 4, n1: 1, amp2: 2, n2: 4, colors: GRASS_NIGHT, depth: 14 });
          scatterPines(L, r, t, 4, 28, 44, PINE_NIGHT);
          scatterStones(L, r, t, 4, STONE_NIGHT);
        } }
      ]
    }
  };

  // Solul (strat apropiat, 1.0 x viteza): fire de iarbă deasupra liniei, iarbă, apoi pământ cu pietricele
  function buildGround(g, seed) {
    const L = Layer(GROUND_W, GROUND_H + BLADES);
    for (let x = 0; x < GROUND_W; x++) {
      const hb = hash(x * 5 + seed);
      if (hb < 0.45) L.set(x, 1, g.lit);
      if (hb < 0.15) L.set(x, 0, g.lit);
      for (let y = BLADES; y < L.h; y++) {
        const d = y - BLADES;
        let c;
        if (d === 0) c = g.lit;
        else if (d < 4) c = grad([g.lit, g.mid, g.shade], d / 4, x, y);
        else c = grad([g.dirt, g.dirtDark], (d - 4) / 12, x, y);
        L.set(x, y, c);
      }
    }
    const r = rng(seed);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(r() * GROUND_W), y = BLADES + 7 + Math.floor(r() * 6);
      stone(L, x, y, 1 + Math.floor(r() * 2), 1, g.pebble);
    }
    return toCanvas(L);
  }

  const built = {};

  function make(key) {
    const sc = SCENES[key];
    let seed = 1;
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const layers = sc.layers.map(function (spec, i) {
      const L = Layer(W, SKY_H);
      spec.build(L, rng(seed + i * 101));
      return { speed: spec.speed, c: toCanvas(L) };
    });
    return { layers: layers, ground: buildGround(sc.ground, seed) };
  }

  function get(key) {
    if (!built[key]) {
      if (!SCENES[key]) throw new Error('Fundal necunoscut: ' + key);
      built[key] = make(key);
    }
    return built[key];
  }

  Object.keys(SCENES).forEach(get); // pre-randare la pornire

  // scrollX = deplasarea în px logici; fiecare strat se mișcă cu propria fracțiune din ea
  function drawFar(ctx, key, scrollX) {
    get(key).layers.forEach(function (l) {
      const o = ((Math.round(scrollX * l.speed / PS) % W) + W) % W;
      ctx.drawImage(l.c, -o, 0);
      if (o) ctx.drawImage(l.c, W - o, 0);
    });
  }

  function drawGround(ctx, key, scrollX) {
    const g = get(key).ground;
    const o = ((Math.round(scrollX / PS) % GROUND_W) + GROUND_W) % GROUND_W;
    for (let x = -o; x < W; x += GROUND_W) ctx.drawImage(g, x, SKY_H - BLADES);
  }

  return { drawFar: drawFar, drawGround: drawGround, SKY_H: SKY_H };
})();
