// Font bitmap 5x7 (pixeli de artă). Glifele se desenează pe un canvas de rezoluție „artă" (1 pixel = 1 pixel de artă).
// Rândurile 0..6 sunt corpul literei; accentele merg deasupra (rânduri negative), virgula de la ș/ț și cozile
// literelor g j p q y dedesubt (rânduri 7..8).
const Font = (function () {
  'use strict';

  const RAW = {
    'A': '.###./#...#/#...#/#####/#...#/#...#/#...#',
    'B': '####./#...#/#...#/####./#...#/#...#/####.',
    'C': '.###./#...#/#..../#..../#..../#...#/.###.',
    'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
    'E': '#####/#..../#..../####./#..../#..../#####',
    'F': '#####/#..../#..../####./#..../#..../#....',
    'G': '.###./#...#/#..../#.###/#...#/#...#/.###.',
    'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    'I': '.###./..#../..#../..#../..#../..#../.###.',
    'J': '..###/...#./...#./...#./...#./#..#./.##..',
    'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    'L': '#..../#..../#..../#..../#..../#..../#####',
    'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
    'N': '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    'P': '####./#...#/#...#/####./#..../#..../#....',
    'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    'R': '####./#...#/#...#/####./#.#../#..#./#...#',
    'S': '.####/#..../#..../.###./....#/....#/####.',
    'T': '#####/..#../..#../..#../..#../..#../..#..',
    'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    'V': '#...#/#...#/#...#/#...#/.#.#./.#.#./..#..',
    'W': '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
    'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..',
    'Z': '#####/....#/...#./..#../.#.../#..../#####',
    '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
    '1': '..#../.##../..#../..#../..#../..#../.###.',
    '2': '.###./#...#/....#/...#./..#../.#.../#####',
    '3': '.###./#...#/....#/..##./....#/#...#/.###.',
    '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
    '5': '#####/#..../####./....#/....#/#...#/.###.',
    '6': '.###./#..../#..../####./#...#/#...#/.###.',
    '7': '#####/....#/...#./..#../.#.../.#.../.#...',
    '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
    '9': '.###./#...#/#...#/.####/....#/....#/.###.',
    'a': '...../...../.###./....#/.####/#...#/.####',
    'b': '#..../#..../####./#...#/#...#/#...#/####.',
    'c': '...../...../.###./#...#/#..../#...#/.###.',
    'd': '....#/....#/.####/#...#/#...#/#...#/.####',
    'e': '...../...../.###./#...#/#####/#..../.###.',
    'f': '..##./.#..#/.#.../###../.#.../.#.../.#...',
    'g': '...../...../.####/#...#/#...#/#...#/.####/....#/.###.',
    'h': '#..../#..../####./#...#/#...#/#...#/#...#',
    'i': '..#../...../.##../..#../..#../..#../.###.',
    'j': '...#./...../..##./...#./...#./...#./...#./#..#./.##..',
    'k': '#..../#..../#..#./#.#../##.../#.#../#..#.',
    'l': '.##../..#../..#../..#../..#../..#../.###.',
    'm': '...../...../##.#./#.#.#/#.#.#/#...#/#...#',
    'n': '...../...../####./#...#/#...#/#...#/#...#',
    'o': '...../...../.###./#...#/#...#/#...#/.###.',
    'p': '...../...../####./#...#/#...#/#...#/####./#..../#....',
    'q': '...../...../.####/#...#/#...#/#...#/.####/....#/....#',
    'r': '...../...../#.##./##..#/#..../#..../#....',
    's': '...../...../.####/#..../.###./....#/####.',
    't': '.#.../.#.../###../.#.../.#.../.#..#/..##.',
    'u': '...../...../#...#/#...#/#...#/#...#/.####',
    'v': '...../...../#...#/#...#/#...#/.#.#./..#..',
    'w': '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
    'x': '...../...../#...#/.#.#./..#../.#.#./#...#',
    'y': '...../...../#...#/#...#/#...#/.####/....#/#...#/.###.',
    'z': '...../...../#####/...#./..#../.#.../#####',
    'ı': '...../...../.##../..#../..#../..#../.###.', // i fără punct (baza lui î)
    ' ': '...../...../...../...../...../...../.....',
    '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../...../.##../.##../..#../.#...',
    ':': '...../.##../.##../...../...../.##../.##..',
    '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/..##./..#../...../..#..',
    '-': '...../...../...../#####/...../...../.....',
    '—': '...../...../...../#####/...../...../.....', // linie de pauză (în mesajele de salvare)
    '…': '...../...../...../...../...../...../#.#.#',
    '_': '...../...../...../...../...../...../...../#####',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    '(': '..#../.#.../#..../#..../#..../.#.../..#..',
    ')': '..#../...#./....#/....#/....#/...#./..#..',
    '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
    '+': '...../..#../..#../#####/..#../..#../.....',
    "'": '..#../..#../...../...../...../...../.....',
    '=': '...../...../#####/...../#####/...../.....',
    '%': '#...#/#..#./...#./..#../.#.../.#..#/#...#',
    '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
    ']': '.###./...#./...#./...#./...#./...#./.###.'
  };

  const BREVE = { top: 0, rows: ['.#.#.', '..#..'] };
  const CIRC = { top: 0, rows: ['..#..', '.#.#.'] };
  const COMMA = { top: 7, rows: ['..#..', '.#...'] };

  const glyphs = {};

  function parse(s) {
    return { top: 0, rows: s.split('/') };
  }

  // Suprapune un semn diacritic peste o literă de bază
  function compose(base, mark, markTop) {
    const top = Math.min(base.top, markTop);
    const bottom = Math.max(base.top + base.rows.length, markTop + mark.rows.length);
    const rows = [];
    for (let r = top; r < bottom; r++) {
      let line = '';
      for (let c = 0; c < 5; c++) {
        const b = base.rows[r - base.top];
        const m = mark.rows[r - markTop];
        line += ((b && b[c] === '#') || (m && m[c] === '#')) ? '#' : '.';
      }
      rows.push(line);
    }
    return { top: top, rows: rows };
  }

  Object.keys(RAW).forEach(function (ch) { glyphs[ch] = parse(RAW[ch]); });

  // Diacritice românești. Litere mici: semnul la rândurile -1..0; majuscule: -3..-2 (cu un rând liber sub semn)
  glyphs['ă'] = compose(glyphs['a'], BREVE, -1);
  glyphs['â'] = compose(glyphs['a'], CIRC, -1);
  glyphs['î'] = compose(glyphs['ı'], CIRC, -1);
  glyphs['ș'] = compose(glyphs['s'], COMMA, 7);
  glyphs['ț'] = compose(glyphs['t'], COMMA, 7);
  glyphs['Ă'] = compose(glyphs['A'], BREVE, -3);
  glyphs['Â'] = compose(glyphs['A'], CIRC, -3);
  glyphs['Î'] = compose(glyphs['I'], CIRC, -3);
  glyphs['Ș'] = compose(glyphs['S'], COMMA, 7);
  glyphs['Ț'] = compose(glyphs['T'], COMMA, 7);
  // Variantele cu sedilă (U+015F, U+0163, U+015E, U+0162) folosesc aceleași glife ca virgula
  glyphs['ş'] = glyphs['ș'];
  glyphs['ţ'] = glyphs['ț'];
  glyphs['Ş'] = glyphs['Ș'];
  glyphs['Ţ'] = glyphs['Ț'];

  function glyphFor(ch) {
    if (glyphs[ch]) return glyphs[ch];
    // alte litere accentuate: litera de bază, fără accent
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base !== ch && glyphs[base]) return glyphs[base];
    return glyphs['?'];
  }

  const cache = {};

  function glyphCanvas(ch, colorName) {
    const key = ch + '|' + colorName;
    if (cache[key]) return cache[key];
    const g = glyphFor(ch);
    const c = document.createElement('canvas');
    c.width = 5;
    c.height = g.rows.length;
    const x = c.getContext('2d');
    x.fillStyle = PALETTE[colorName];
    for (let r = 0; r < g.rows.length; r++) {
      for (let col = 0; col < 5; col++) {
        if (g.rows[r][col] === '#') x.fillRect(col, r, 1, 1);
      }
    }
    return (cache[key] = { c: c, top: g.top, h: g.rows.length });
  }

  function advance(ch) {
    return ch === ' ' ? 4 : 6;
  }

  // Lățimea în pixeli de artă (fără spațiul final)
  function measure(text, scale) {
    let w = 0;
    for (const ch of text) w += advance(ch);
    return Math.max(0, (w - 1) * (scale || 1));
  }

  // Cea mai mare scară (<= maxScale) la care textul încape în maxW
  function fit(text, maxW, maxScale) {
    let s = maxScale;
    while (s > 1 && measure(text, s) > maxW) s--;
    return s;
  }

  // Taie textul și adaugă „..." dacă nu încape
  function clip(text, maxW, scale) {
    if (measure(text, scale) <= maxW) return text;
    let t = text;
    while (t.length > 1 && measure(t + '...', scale) > maxW) t = t.slice(0, -1);
    return t + '...';
  }

  // x, y = colțul stânga-sus al rândului 0 (în pixeli de artă). align: 'left' | 'center' | 'right'
  function draw(ctx, text, x, y, opt) {
    const o = opt || {};
    const scale = o.scale || 1;
    const color = o.color || 'white';
    const w = measure(text, scale);
    let cx = o.align === 'center' ? Math.round(x - w / 2) : o.align === 'right' ? Math.round(x - w) : Math.round(x);
    // outline / shadow: true = negru, sau numele unei culori din paletă
    if (o.outline) { // contur de 1 pixel de artă pe toate părțile (text lizibil pe orice fundal)
      const oc = o.outline === true ? 'black' : o.outline;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx || dy) draw(ctx, text, cx + dx, y + dy, { scale: scale, color: oc, align: 'left' });
        }
      }
    }
    if (o.shadow) {
      const off = scale >= 4 ? 2 : 1;
      draw(ctx, text, cx + off, y + off, { scale: scale, color: o.shadow === true ? 'black' : o.shadow, align: 'left' });
    }
    for (const ch of text) {
      if (ch !== ' ') {
        const g = glyphCanvas(ch, color);
        ctx.drawImage(g.c, cx, y + g.top * scale, 5 * scale, g.h * scale);
      }
      cx += advance(ch) * scale;
    }
  }

  // Împarte textul pe rânduri de cel mult maxChars caractere
  function wrap(text, maxChars) {
    const lines = [];
    let line = '';
    text.split(' ').forEach(function (word) {
      if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; }
      else line = line ? line + ' ' + word : word;
    });
    if (line) lines.push(line);
    return lines;
  }

  return { draw: draw, measure: measure, fit: fit, clip: clip, wrap: wrap, glyphFor: glyphFor };
})();
