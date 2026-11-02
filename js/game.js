// Fizică, piloni, coliziuni, hărți. Fără desenare și fără DOM.
// Simularea merge cu pas fix (Game.STEP), deci rezultatul nu depinde de rata de refresh a ecranului.
const Game = (function () {
  'use strict';

  const C = CONFIG;
  const W = C.canvas.width;
  const PLAY_H = C.canvas.height - C.groundHeight; // zona de joc: de la 0 până la sol
  const snap = function (v) { return Math.round(v / C.pixelSize) * C.pixelSize; };

  function Game() {
    this.reset(null);
  }

  Game.STEP = 1 / 120;
  Game.PLAY_H = PLAY_H;

  Game.mapIndexForScore = function (score) {
    return Math.min(Math.floor(score / C.pillarsPerMap), C.maps.length - 1);
  };

  Game.prototype.reset = function (character) {
    this.character = character;
    this.score = 0;
    this.mapIndex = 0;
    this.speed = C.maps[0].speed;
    this.pillars = [];
    this.over = false;
    this.overReason = null;
    this.time = 0;
    this.scrollX = 0;
    this.banner = null;           // { text, t } (t în ms)
    this.bgPrev = null;           // indexul hărții al cărei fundal se estompează încă (null = fără tranziție)
    this.bgFade = 0;              // ms de la începutul tranziției
    this.lastCenter = PLAY_H / 2;
    this.bird = { x: C.bird.x, y: PLAY_H / 2, vy: 0 };
  };

  Game.prototype.currentMap = function () {
    return C.maps[this.mapIndex];
  };

  // Personajul plutește pe loc cât timp se așteaptă startul
  Game.prototype.hover = function (dt) {
    this.time += dt;
    this.bird.y = PLAY_H / 2 + Math.sin(this.time * 4) * 8;
    this.bird.vy = 0;
  };

  Game.prototype.start = function () {
    this.bird.y = PLAY_H / 2;
    this.spawnPillar(W + C.firstPillarOffset);
    this.jump();
  };

  Game.prototype.jump = function () {
    if (!this.over) this.bird.vy = C.physics.jumpVelocity;
  };

  // Un obstacol își ia parametrii (gap, temă) din harta curentă la momentul generării și îi păstrează la tranziția de hartă.
  // gap și gapTop se aliniază la grila de pixeli de artă, ca hitbox-ul să coincidă cu ce se vede.
  Game.prototype.spawnPillar = function (x) {
    const m = this.currentMap();
    const gap = snap(m.gap);
    // Centrul spațiului e aleatoriu, dar față de cel anterior diferă cu cel puțin minGapShift și cel mult maxGapShift.
    // Există două intervale posibile (mai sus / mai jos); se alege unul proporțional cu lungimea lui.
    const minC = C.gapCenterMargin, maxC = PLAY_H - C.gapCenterMargin;
    const prev = this.lastCenter;
    const upLo = Math.max(minC, prev - C.maxGapShift), upHi = prev - C.minGapShift;
    const dnLo = prev + C.minGapShift, dnHi = Math.min(maxC, prev + C.maxGapShift);
    const upLen = Math.max(0, upHi - upLo), dnLen = Math.max(0, dnHi - dnLo);
    let center;
    if (upLen + dnLen > 0) {
      const r = Math.random() * (upLen + dnLen);
      center = r < upLen ? upLo + r : dnLo + (r - upLen);
    } else {
      center = minC + Math.random() * (maxC - minC); // intervalul permis e gol (parametri extremi): cădere pe tot domeniul
    }
    this.lastCenter = center;
    const gapTop = snap(center - gap / 2);
    const o = Obstacles.build(m.obstacle, gapTop, gap, PLAY_H);
    this.pillars.push({
      x: x, gap: gap, gapTop: gapTop, mapIndex: this.mapIndex, theme: m.obstacle,
      rects: o.rects, xMin: o.xMin, xMax: o.xMax, scored: false
    });
  };

  Game.prototype.step = function (dt) {
    if (this.over) return;
    const b = this.bird;
    const p = C.physics;
    const m = this.currentMap();

    this.time += dt;
    if (this.banner) {
      this.banner.t += dt * 1000;
      if (this.banner.t >= C.bannerMs) this.banner = null;
    }
    if (this.bgPrev !== null) {
      this.bgFade += dt * 1000;
      if (this.bgFade >= C.bgTransitionMs) this.bgPrev = null;
    }

    // Viteza se apropie treptat de cea a hărții curente
    let targetSpeed = m.speed;
    if (this.mapIndex === C.maps.length - 1) {
      // Pe ultima hartă (infinită) viteza crește puțin la fiecare obstacol depășit, până la o limită
      const extra = this.score - (C.maps.length - 1) * C.pillarsPerMap;
      targetSpeed = Math.min(C.endless.speedMax, m.speed + extra * C.endless.speedStep);
    }
    const maxDelta = C.speedEase * dt;
    this.speed += Math.max(-maxDelta, Math.min(maxDelta, targetSpeed - this.speed));
    this.scrollX += this.speed * dt;

    // Personajul
    b.vy = Math.min(b.vy + p.gravity * dt, p.maxFallSpeed);
    b.y += b.vy * dt;

    // Pilonii
    const dx = this.speed * dt;
    for (let i = 0; i < this.pillars.length; i++) this.pillars[i].x -= dx;
    if (this.pillars.length && this.pillars[0].x + this.pillars[0].xMax < -10) this.pillars.shift();
    const last = this.pillars[this.pillars.length - 1];
    if (last && last.x + m.spacing <= W + 20) this.spawnPillar(last.x + m.spacing);

    // Hitbox ~80% din sprite
    const h = (C.bird.size * C.bird.hitboxScale) / 2;
    // Plafon: limită fizică, nu cauză de moarte. Personajul nu urcă mai sus, iar viteza ascendentă se anulează.
    if (b.y - h < C.ceilingY) {
      b.y = C.ceilingY + h;
      if (b.vy < 0) b.vy = 0;
    }
    const left = b.x - h, right = b.x + h, top = b.y - h, bottom = b.y + h;
    if (bottom > PLAY_H) return this.die('sol');
    for (let i = 0; i < this.pillars.length; i++) {
      const pl = this.pillars[i];
      // hitbox = reuniune de dreptunghiuri care urmărește forma obstacolului
      if (right > pl.x + pl.xMin && left < pl.x + pl.xMax) {
        for (let k = 0; k < pl.rects.length; k++) {
          const r = pl.rects[k];
          if (right > pl.x + r[0] && left < pl.x + r[1] && bottom > r[2] && top < r[3]) return this.die('obstacol');
        }
      }
      // Scor: obstacolul a fost depășit complet
      if (!pl.scored && pl.x + pl.xMax < left) {
        pl.scored = true;
        this.score += 1;
        const idx = Game.mapIndexForScore(this.score);
        if (idx !== this.mapIndex) {
          this.bgPrev = this.mapIndex; // fundalul vechi dispare treptat (vezi ui.js)
          this.bgFade = 0;
          this.mapIndex = idx;
          this.banner = { text: C.maps[idx].name, t: 0 };
        }
      }
    }
  };

  Game.prototype.die = function (reason) {
    this.over = true;
    this.overReason = reason;
  };

  return Game;
})();
