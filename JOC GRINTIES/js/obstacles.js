// Obstacole tematice: aranjarea pieselor (capăt, corp care se repetă, opțional sfârșit), hitbox pe formă și desenare.
// Se lucrează în pixeli de artă (1 px de artă = CONFIG.pixelSize px logici). Distanța `d` se măsoară de la marginea gap-ului spre exterior.
const Obstacles = (function () {
  'use strict';

  const PS = CONFIG.pixelSize;
  const BODY_W = CONFIG.pillarWidth / PS; // 16

  // cap = capătul dinspre gap, body = dala care se repetă, end = sfârșit dinspre sol / marginea ecranului (opțional)
  const THEMES = {
    mushroom: { body: 'mushroomBody', cap: 'mushroomCap' },
    block:    { body: 'blockBody',    cap: 'blockRoof',  end: 'blockGround' },
    fir:      { body: 'firBody',      cap: 'firTip' },
    horse:    { body: 'fencePost',    cap: 'horseHead' },
    sword:    { body: 'swordBody',    cap: 'swordTip',   end: 'swordHilt' }
  };

  const parts = {};

  function theme(key) {
    if (!parts[key]) {
      const t = THEMES[key];
      if (!t) throw new Error('Temă de obstacol necunoscută: ' + key);
      const o = { body: SPRITES.get(t.body), cap: SPRITES.get(t.cap), end: t.end ? SPRITES.get(t.end) : null };
      o.capOff = (BODY_W - o.cap.w) / 2;
      if (o.end) o.endOff = (BODY_W - o.end.w) / 2;
      parts[key] = o;
    }
    return parts[key];
  }

  // Dreptunghiuri [x0, x1, r0, r1) care acoperă pixelii opaci ai unui sprite; rândurile consecutive cu aceeași întindere se unesc
  function rowRects(sprite, xOff, rowOff, rowLimit, out) {
    let cur = null;
    for (let r = 0; r < sprite.h; r++) {
      const d = rowOff + r;
      if (d >= rowLimit) break;
      const e = sprite.ext[r];
      if (!e) { cur = null; continue; }
      const x0 = e[0] + xOff, x1 = e[1] + 1 + xOff;
      if (cur && cur[0] === x0 && cur[1] === x1 && cur[3] === d) cur[3] = d + 1;
      else { cur = [x0, x1, d, d + 1]; out.push(cur); }
    }
  }

  // Dreptunghiurile obstacolului pentru lungimea L (pixeli de artă) disponibilă dinspre gap până la sol / marginea ecranului
  function layoutRects(key, L) {
    const t = theme(key);
    const out = [];
    if (L <= 0) return out;
    rowRects(t.cap, t.capOff, 0, L, out);
    for (let d = t.cap.h; d < L; d += t.body.h) rowRects(t.body, 0, d, L, out);
    if (t.end && L >= t.cap.h + t.end.h) rowRects(t.end, t.endOff, L - t.end.h, L, out);
    // unește dreptunghiurile identice și consecutive (corpuri drepte)
    out.sort(function (a, b) { return a[2] - b[2]; });
    const merged = [];
    out.forEach(function (r) {
      const p = merged[merged.length - 1];
      if (p && p[0] === r[0] && p[1] === r[1] && p[3] === r[2]) p[3] = r[3];
      else merged.push(r.slice());
    });
    return merged;
  }

  // Hitbox-ul unei perechi, în px logici: x relativ la marginea stângă a corpului, y absolut.
  // gapTop / gap / groundY sunt în px logici și multipli de pixelSize.
  function build(key, gapTop, gap, groundY) {
    const gt = gapTop / PS, gb = (gapTop + gap) / PS, g = groundY / PS;
    const rects = [];
    layoutRects(key, gt).forEach(function (r) {      // sus: d crește în sus, de la gt
      rects.push([r[0] * PS, r[1] * PS, (gt - r[3]) * PS, (gt - r[2]) * PS]);
    });
    layoutRects(key, g - gb).forEach(function (r) { // jos: d crește în jos, de la gb
      rects.push([r[0] * PS, r[1] * PS, (gb + r[2]) * PS, (gb + r[3]) * PS]);
    });
    let xMin = Infinity, xMax = -Infinity;
    rects.forEach(function (r) { if (r[0] < xMin) xMin = r[0]; if (r[1] > xMax) xMax = r[1]; });
    if (!rects.length) { xMin = 0; xMax = BODY_W * PS; }
    return { rects: rects, xMin: xMin, xMax: xMax };
  }

  // Desenează jumătate de obstacol. xa = x (px de artă) al marginii stângi a corpului, edge = y (px de artă) al marginii gap-ului,
  // L = lungimea disponibilă, dir = +1 (obstacol de jos) sau -1 (obstacol de sus, oglindit vertical)
  function drawHalf(ctx, key, xa, edge, L, dir) {
    if (L <= 0) return;
    const t = theme(key);
    const bottom = dir > 0;
    // capăt
    const ch = Math.min(t.cap.h, L);
    if (bottom) ctx.drawImage(t.cap.c, 0, 0, t.cap.w, ch, xa + t.capOff, edge, t.cap.w, ch);
    else ctx.drawImage(t.cap.f, 0, t.cap.h - ch, t.cap.w, ch, xa + t.capOff, edge - ch, t.cap.w, ch);
    // corp: dala se repetă, cea incompletă e tăiată la capătul dinspre sol / margine
    for (let d = t.cap.h; d < L; d += t.body.h) {
      const h = Math.min(t.body.h, L - d);
      if (bottom) ctx.drawImage(t.body.c, 0, 0, BODY_W, h, xa, edge + d, BODY_W, h);
      else ctx.drawImage(t.body.f, 0, t.body.h - h, BODY_W, h, xa, edge - d - h, BODY_W, h);
    }
    // sfârșit (mâner, parter)
    if (t.end && L >= t.cap.h + t.end.h) {
      if (bottom) ctx.drawImage(t.end.c, xa + t.endOff, edge + L - t.end.h);
      else ctx.drawImage(t.end.f, xa + t.endOff, edge - L);
    }
  }

  function draw(ctx, key, xa, gapTop, gap, groundY) {
    const gt = gapTop / PS, gb = (gapTop + gap) / PS, g = groundY / PS;
    drawHalf(ctx, key, xa, gt, gt, -1);
    drawHalf(ctx, key, xa, gb, g - gb, 1);
  }

  return { build: build, draw: draw, bodyWidth: BODY_W };
})();
