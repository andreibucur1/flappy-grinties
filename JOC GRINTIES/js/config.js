// Toți parametrii jocului sunt aici. Valorile numerice sunt VALORI DE PORNIRE, de calibrat prin testare.
const CONFIG = {
  title: "Flappy Grințieș",                  // PLACEHOLDER: titlul final îl dă grupul
  canvas: { width: 800, height: 600 },       // rezoluție logică (fizică, coliziuni); desenarea se face la 1/pixelSize din ea
  pixelSize: 4,                              // un „pixel de artă" = 4x4 px logici (rezoluție virtuală 200x150)
  groundHeight: 60,                          // înălțimea solului (zona de joc = height - groundHeight)
  ceilingY: 0,                               // plafonul: cea mai de sus poziție a marginii de sus a hitbox-ului personajului
  physics: { gravity: 1800, jumpVelocity: -520, maxFallSpeed: 900 }, // px/s, px/s²
  bird: { x: 200, size: 56, hitboxScale: 0.8 }, // poza personajului încape în 56x56 px logici; hitbox 80% = 44,8 px
  pillarWidth: 64,                           // lățimea corpului obstacolului (16 px de artă)
  pillarsPerMap: 11,                         // schimbarea hărții: la 11, 22, 33, 44; după 44 rămâne Grințieșu Mare (infinită)
  maps: [
    { name: "Grințieșu Mic",  short: "Mic", obstacle: "mushroom", bg: "grintiesuMic",  gap: 260, speed: 180, spacing: 340 },
    { name: "Poiana",         short: "Poi", obstacle: "block",    bg: "poiana",        gap: 230, speed: 180, spacing: 330 },
    { name: "Bradu",          short: "Bra", obstacle: "fir",      bg: "bradu",         gap: 205, speed: 190, spacing: 320 },
    { name: "Moci",           short: "Moc", obstacle: "horse",    bg: "moci",          gap: 180, speed: 205, spacing: 310 },
    { name: "Grințieșu Mare", short: "Mar", obstacle: "sword",    bg: "grintiesuMare", gap: 160, speed: 220, spacing: 300 }
  ],
  // gap = spațiul de trecere vertical (px). Mai mic = obstacole mai înalte = mai greu.
  // spacing = distanța orizontală dintre centrele obstacolelor (px). speed = viteza de deplasare (px/s).
  gapCenterMargin: 80,     // centrul spațiului nu se generează mai aproape de 80 px de margini
  usernameMaxLength: 12,
  gameOverToAttractMs: 8000,
  storageKey: "grinties_flappy_v1",

  // --- Adăugate la implementare (nu sunt în specificație) ---
  minGapShift: 80,         // diferența minimă (px) între centrele a două spații consecutive (poziția e aleatorie, dar nu aproape de cea anterioară)
  maxGapShift: 220,        // diferența maximă (px) între centrele a două spații consecutive, ca să nu apară treceri imposibile
  bgTransitionMs: 1500,    // durata tranziției (dither) de la un fundal la următorul
  endless: { speedStep: 2, speedMax: 300 }, // pe Grințieșu Mare: +2 px/s la fiecare obstacol depășit după scorul 40, până la 300 px/s
  speedEase: 60,          // px/s² cu care viteza se apropie de viteza noii hărți (fără salt brusc)
  firstPillarOffset: 140,  // cât de departe în dreapta ecranului apare primul obstacol
  gameOverInputLockMs: 700,// Space e ignorat atât după game over, ca să nu sară peste ecran un spam de Space
  bannerMs: 1500,          // durata bannerului cu numele hărții
  music: { src: "music/fundal.mp3", volume: 0.4 }, // melodia de fundal, în buclă; volume între 0 și 1

  // Personajul = poza membrului (PNG decupat, fundal transparent, din characters/). Numele NU se afișează jucătorilor;
  // servesc doar la distingere (jurnalul turelor). `sprite` = placeholder pixel art din js/sprites.js, folosit doar dacă poza nu se încarcă.
  characters: [
    { id: "andrei",   name: "Andrei",   photo: "characters/andrei.png",   sprite: "char_andrei" },
    { id: "bianca",   name: "Bianca",   photo: "characters/bianca.png",   sprite: "char_bianca" },
    { id: "madalina", name: "Mădălina", photo: "characters/madalina.png", sprite: "char_madalina" },
    { id: "costi",    name: "Costi",    photo: "characters/costi.png",    sprite: "char_costi" },
    { id: "ovidiu",   name: "Ovidiu",   photo: "characters/ovidiu.png",   sprite: "char_ovidiu" },
    { id: "sfarghi",  name: "Sfarghi",  photo: "characters/sfarghi.png",  sprite: "char_sfarghi" }
  ]
};
