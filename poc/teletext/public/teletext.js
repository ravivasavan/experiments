(() => {
  'use strict';

  // =========================================================================
  // The page is 40 × 25 seven-bit codes and nothing else. Every feature here —
  // rendering, the exports, reveal-codes — reads that one buffer, the same way
  // a receiver would. Layout "generators" only ever poke codes into it, so the
  // constraints can't be cheated: an attribute really does eat a cell, a
  // double-height row really does swallow the row beneath it.
  // Reference: ETS 300 706 (Enhanced Teletext specification), Level 1.
  // =========================================================================

  const COLS = 40, ROWS = 25;
  const CELL_W = 12, CELL_H = 20;          // the SAA5050 cell, doubled from 6 × 10

  // Sixel bands, measured off Bedstead's own U+1FB00 sextants: the cuts land at
  // 0.30 and 0.70 of cell height, i.e. the chip splits its ten rows 3/4/3 and
  // the middle band is the tall one. Halves across are exact.
  const BANDS = [[0, 6], [6, 8], [14, 6]];
  const SEP_GAP = 2;                        // separated mosaics blank the last
                                            // matrix column/row → 2px doubled

  // Level 1's whole palette: three bits, full intensity, no shades.
  const CLUT = ['#000000', '#ff0000', '#00ff00', '#ffff00',
                '#0000ff', '#ff00ff', '#00ffff', '#ffffff'];
  const RGB = CLUT.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const BLACK = 0, RED = 1, GREEN = 2, YELLOW = 3, BLUE = 4, MAGENTA = 5, CYAN = 6, WHITE = 7;

  // Spacing attributes. Alpha colours are 0x00–0x07, mosaic colours 0x10–0x17;
  // both switch character set as well as colour, which is why a coloured
  // mosaic run always starts with one of the 0x1x codes.
  const AC = c => c, GC = c => 0x10 | c;
  const FLASH = 0x08, STEADY = 0x09, NSZ = 0x0C, DBH = 0x0D, CONCEAL = 0x18,
        CONTIG = 0x19, SEPD = 0x1A, BLACK_BG = 0x1C, NEW_BG = 0x1D,
        HOLD = 0x1E, RELEASE = 0x1F;
  const isCode = v => v < 0x20;

  // G0 English national option subset — the positions that aren't ASCII.
  const G0 = { 0x23: '£', 0x5B: '←', 0x5C: '½', 0x5D: '→', 0x5E: '↑', 0x5F: '#',
               0x60: '—', 0x7B: '¼', 0x7C: '‖', 0x7D: '¾', 0x7E: '÷', 0x7F: '█' };
  const G0_IN = Object.fromEntries(Object.entries(G0).map(([k, v]) => [v, +k]));
  const glyphOf = code => G0[code] || String.fromCharCode(code);
  const codeOf = ch => G0_IN[ch] ?? (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) < 0x7F ? ch.charCodeAt(0) : 0x20);

  // In graphics mode 0x40–0x5F still draws capitals — only 0x20–0x3F and
  // 0x60–0x7F are mosaics. Sixel weights: 1 2 / 4 8 / 16 64, the gap at 0x20
  // being the graphics-set selector bit.
  const maskOf = code => (code & 0x1F) | ((code & 0x40) >> 1);
  const codeOfMask = m => 0x20 | (m & 0x1F) | ((m & 0x20) << 1);
  const isMosaic = code => code >= 0x20 && !(code >= 0x40 && code < 0x60);
  const FULL = codeOfMask(0x3F);            // 0x7F — all six sixels lit

  const page = new Uint8Array(COLS * ROWS);
  const poke = (r, c, v) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) page[r * COLS + c] = v; };
  const at = (r, c) => page[r * COLS + c];

  // ---------------------------------------------------------------- renderer
  // Walks each row left to right holding the receiver's state. Codes are
  // "set-at" (they affect their own cell) or "set-after" (from the next cell
  // on) — that distinction is why a foreground colour code shows as a space in
  // the *old* colour, while a background code paints its own cell.
  const SET_AT = new Set([NSZ, CONTIG, SEPD, BLACK_BG, NEW_BG, HOLD, STEADY, CONCEAL]);

  function render(ctx, Z, opts = {}) {
    const { reveal = false, flashOn = true } = opts;
    opts.revealed = opts.revealed ?? false;
    ctx.fillStyle = CLUT[BLACK];
    ctx.fillRect(0, 0, COLS * CELL_W * Z, ROWS * CELL_H * Z);
    ctx.textBaseline = 'alphabetic';

    const swallowed = new Array(ROWS).fill(false);

    for (let r = 0; r < ROWS; r++) {
      // A double-height row is drawn over two rows and the receiver ignores
      // whatever was written on the second one.
      if (swallowed[r]) continue;

      let fg = WHITE, bg = BLACK, gfx = false, sep = false, hold = false,
          held = 0x20, flash = false, dbl = false, conceal = false;

      for (let c = 0; c < COLS; c++) {
        const v = at(r, c);
        let drawFg = fg, drawBg = bg, drawGfx = gfx, drawSep = sep,
            drawDbl = dbl, drawFlash = flash, glyph = v;

        if (isCode(v)) {
          // Set-at codes act on this very cell.
          if (SET_AT.has(v)) {
            if (v === NEW_BG) { bg = fg; drawBg = bg; }
            else if (v === BLACK_BG) { bg = BLACK; drawBg = bg; }
            else if (v === CONTIG) { sep = false; drawSep = false; }
            else if (v === SEPD) { sep = true; drawSep = true; }
            else if (v === HOLD) { hold = true; }
            else if (v === NSZ) { dbl = false; drawDbl = false; }
            else if (v === STEADY) { flash = false; drawFlash = false; }
            else if (v === CONCEAL) { conceal = true; }
          }
          // The code still occupies a cell. Held mosaics repeat the last
          // mosaic here instead of leaving the black notch that gives
          // teletext art its characteristic gaps.
          glyph = hold && gfx ? held : 0x20;
          drawGfx = hold && gfx;

          // Set-after codes take effect from the following cell.
          if (v <= 0x07) { fg = v; gfx = false; }
          else if (v >= 0x10 && v <= 0x17) { fg = v & 0x07; gfx = true; }
          else if (v === FLASH) { flash = true; }
          else if (v === DBH) { dbl = true; if (r + 1 < ROWS) swallowed[r + 1] = true; }
          else if (v === RELEASE) { hold = false; }
        } else if (gfx && isMosaic(v)) {
          held = v;
        }

        const x = c * CELL_W * Z, y = r * CELL_H * Z;
        if (drawBg !== BLACK) {
          ctx.fillStyle = CLUT[drawBg];
          ctx.fillRect(x, y, CELL_W * Z, CELL_H * Z * (drawDbl ? 2 : 1));
        }

        // Concealed cells stay blank until REVEAL, and hold that way to the end
        // of the row like every other attribute.
        const hidden = (drawFlash && !flashOn) || (conceal && !opts.revealed);
        if (!hidden && glyph !== 0x20) {
          ctx.fillStyle = CLUT[drawFg];
          if (drawGfx && isMosaic(glyph)) drawMosaic(ctx, x, y, Z, maskOf(glyph), drawSep, drawDbl);
          else drawGlyph(ctx, x, y, Z, glyph, drawDbl);
        }

        if (reveal && isCode(v)) revealCode(ctx, x, y, Z, v);
      }
    }
  }

  function drawMosaic(ctx, x, y, Z, mask, sep, dbl) {
    const hZ = Z * (dbl ? 2 : 1);
    for (let i = 0; i < 6; i++) {
      if (!(mask & (1 << i))) continue;
      const [top, h] = BANDS[i >> 1];
      const left = (i & 1) ? CELL_W / 2 : 0;
      let w = CELL_W / 2, hh = h;
      if (sep) { w -= SEP_GAP; hh -= SEP_GAP; }
      ctx.fillRect(x + left * Z, y + top * hZ, w * Z, hh * hZ);
    }
  }

  function drawGlyph(ctx, x, y, Z, code, dbl) {
    const size = CELL_H * Z;
    ctx.save();
    ctx.font = size + 'px Bedstead';
    if (dbl) { ctx.translate(x, y); ctx.scale(1, 2); ctx.fillText(glyphOf(code), 0, size * 0.8); }
    else ctx.fillText(glyphOf(code), x, y + size * 0.8);
    ctx.restore();
  }

  // Codes are invisible on air; here they can be shown as a dim wash in the
  // colour they set, so you can see what a layout is spending.
  function revealCode(ctx, x, y, Z, v) {
    let tint = '#4a4a4a';
    if (v <= 0x07) tint = CLUT[v];
    else if (v >= 0x10 && v <= 0x17) tint = CLUT[v & 0x07];
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = tint;
    ctx.fillRect(x + Z, y + Z, (CELL_W - 2) * Z, (CELL_H - 2) * Z);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 3 * Z, y + 8 * Z, 6 * Z, 4 * Z);
    ctx.restore();
  }

  // ------------------------------------------------------------ page writing
  // What colour and character set a cell inherits depends on every code to its
  // left, because colour and mode are set-after and run to the end of the row.
  // A writer that assumed "rows start white and alphanumeric" produced text
  // that came out as mosaics the moment anything — a box border, a leader —
  // had already switched the row into graphics mode.
  function stateAt(row, col) {
    let fg = WHITE, gfx = false;
    for (let c = 0; c < col; c++) {
      const v = at(row, c);
      if (v <= 0x07) { fg = v; gfx = false; }
      else if (v >= 0x10 && v <= 0x17) { fg = v & 0x07; gfx = true; }
    }
    return { fg, gfx };
  }

  // Text costs more than its characters. This spends a colour code only when
  // the colour actually changes, which is exactly the economy a teletext
  // designer works with.
  function writer(row, col) {
    const inherited = stateAt(row, col);
    let c = col, cur = inherited.fg, gfx = inherited.gfx;
    return {
      get col() { return c; },
      code(v) { if (c < COLS) poke(row, c++, v); return this; },
      colour(v) { if (v !== cur || gfx) { this.code(AC(v)); cur = v; gfx = false; } return this; },
      gcolour(v) { if (v !== cur || !gfx) { this.code(GC(v)); cur = v; gfx = true; } return this; },
      text(s, v) {
        if (v !== undefined) this.colour(v);
        for (const ch of s) { if (c >= COLS) break; poke(row, c++, codeOf(ch)); }
        return this;
      },
      blocks(n, v, code = FULL) {
        if (v !== undefined) this.gcolour(v);
        for (let i = 0; i < n && c < COLS; i++) poke(row, c++, code);
        return this;
      },
      at(n) { c = n; return this; }
    };
  }

  const cost = (len, codes) => Math.max(0, Math.floor((COLS - (len + codes)) / 2));

  function wrap(text, width) {
    const out = [];
    for (const para of String(text).split('\n')) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of para.trim().split(/\s+/)) {
        if (!line.length) line = word;
        else if (line.length + 1 + word.length <= width) line += ' ' + word;
        else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }

  // ------------------------------------------------------------------- specs
  // Two services, one standard. Both Ceefax and Austext were 625-line World
  // System Teletext, so the page itself — 40 × 25, eight colours, spacing
  // attributes — is identical. What differed was house convention, and the
  // differences below are the ones that can be checked rather than guessed.
  //
  //   Ceefax  BBC, 23 Sep 1974 → 23 Oct 2012. Content split across eight
  //           "magazines" numbered 100–800, one per category. Subtitles on
  //           888. Fastext, so row 24 carries four coloured links.
  //   Austext Seven Network, run out of Brisbane. Tests 1979, live 4 Feb 1980,
  //           a properly useful service from 1982 in Brisbane and Sydney,
  //           closed 30 Sep 2009. Navigation was numeric — no evidence it ever
  //           carried fastext — so row 24 prompts for a page number instead.
  //           Captions sat on 801 and were branded Supertext when the
  //           Australian Caption Centre produced them.
  //
  // Page numbers below are only the ones that are actually documented: 888,
  // 801, and Ceefax's sport at 300. Austext's sections are named without
  // numbers rather than invent them.
  const SPECS = {
    ceefax: {
      label: 'Ceefax · BBC',
      service: 'CEEFAX 1',
      subtitlePage: 888,
      subtitleLabel: 'SUBTITLES 888',
      fastext: true,
      links: ['INDEX', 'NEWS', 'SPORT', 'A-Z'],
      onAir: '1974 — 2012',
      signOff: 'CEEFAX CLOSED 23 OCT 2012',
      index: 'CEEFAX INDEX\nNEWS HEADLINES 101\nSPORT 300\nWEATHER\nTV GUIDE\nSUBTITLES 888'
    },
    austext: {
      label: 'Austext · Seven',
      service: 'AUSTEXT',
      subtitlePage: 801,
      subtitleLabel: 'SUPERTEXT 801',
      fastext: false,
      prompt: 'SELECT PAGE NUMBER',
      onAir: '1980 — 2009',
      signOff: 'AUSTEXT CLOSED 30 SEP 2009',
      index: 'AUSTEXT INDEX\nNEWS\nRACING AND TAB\nLOTTERIES\nWEATHER\nTV GUIDE\nSUPERTEXT 801'
    }
  };

  // ------------------------------------------------------------------ palette
  // Named after the services whose pages they came off.
  const SCHEMES = [
    { name: 'Ceefax news',  head: YELLOW,  rule: CYAN,    body: WHITE, dim: CYAN,    strap: RED },
    { name: 'Ceefax index', head: CYAN,    rule: BLUE,    body: WHITE, dim: GREEN,   strap: YELLOW },
    { name: 'Oracle',       head: GREEN,   rule: MAGENTA, body: WHITE, dim: CYAN,    strap: RED },
    { name: 'Weather',      head: WHITE,   rule: BLUE,    body: YELLOW, dim: CYAN,   strap: GREEN },
    { name: 'Subtitle',     head: WHITE,   rule: WHITE,   body: WHITE, dim: YELLOW,  strap: CYAN },
    { name: 'Art page',     head: MAGENTA, rule: RED,     body: YELLOW, dim: CYAN,   strap: GREEN }
  ];

  // deterministic per-seed draw, same FNV-1a walk the timeline uses
  function seeded(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  // ----------------------------------------------------------------- content
  const state = {
    number: 100, service: 'PLAY', layout: 'headline', spec: 'ceefax',
    copy: '', links: [], scheme: 0, seed: 'p100',
    double: true, separated: false, hold: true, flash: false, reveal: false,
    scale: 2, autoScale: true, dither: 'ordered', changes: 6, picture: null,
    // revealed = the REVEAL button on the remote, which uncovered text hidden
    // behind a Conceal code. testCard and pagesFrom are the other two hidden
    // modes; none of the three are advertised in the panel.
    revealed: false, testCard: false, pagesFrom: false
  };
  const spec = () => SPECS[state.spec];

  // Seeded starting copy, so the page arrives already composed. Nothing here
  // pretends to be news — it's about this site.
  const SEEDS = [
    { layout: 'headline', scheme: 0, copy: 'EXPERIMENTS, OUT IN THE OPEN\nSmall things built in public, one page at a time. Every experiment keeps its own folder, its own date, and its own reasons.\nNothing here is a product.' },
    { layout: 'index',    scheme: 1, copy: 'PLAY INDEX\nMAGNETIC 101\nBLOCK 102\nTELETEXT 103\nARENA STATS 104\nA-Z OF PAGES 199' },
    { layout: 'newsflash', scheme: 2, copy: 'MOSAIC HELD\nA colour change costs a cell. Hold the mosaic and the cell repeats instead of punching a hole.' },
    { layout: 'art',      scheme: 5, copy: 'SIXELS\nTwo across, three down, sixty-four shapes.' },
    { layout: 'headline', scheme: 3, copy: 'FORTY BY TWENTY-FIVE\nThe grid was never a style. It was the bandwidth: one page, forty columns, twenty-five rows, seven bits a cell.' }
  ];

  // ------------------------------------------------------------- composition
  function compose() {
    page.fill(0x20);
    const rand = seeded(state.seed);
    const S = SCHEMES[state.scheme] || SCHEMES[0];
    headerRow();
    // Tune to the service's subtitle page and you get subtitles, exactly as
    // punching 888 into a UK remote did — or 801 in Australia.
    if (state.number === spec().subtitlePage) { subtitlePage(S); return; }
    if (state.testCard) { testCardPage(S); fastextRow(); return; }
    if (state.picture) picturePage(S);
    else if (state.layout === 'index') indexPage(S, rand);
    else if (state.layout === 'newsflash') newsflashPage(S, rand);
    else if (state.layout === 'art') artPage(S, rand);
    else headlinePage(S, rand);
    fastextRow();
  }

  // Row 0 is the header. The first eight columns carry the page number and
  // control bits in the broadcast stream, so only 8–39 belong to the designer.
  function headerRow() {
    for (let c = 0; c < COLS; c++) poke(0, c, 0x20);   // the clock rewrites this row
    const w = writer(0, 0);
    w.text('P' + state.number, WHITE);
    const now = new Date();
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const p2 = n => String(n).padStart(2, '0');
    const stamp = `${DAYS[now.getDay()]} ${p2(now.getDate())} ${MONTHS[now.getMonth()]}` +
                  ` ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
    w.at(9).text(state.service.toUpperCase().slice(0, 10), WHITE);
    writer(0, COLS - stamp.length).text(stamp, WHITE);
  }

  // Row 24 is the navigation row. Ceefax had fastext, so it carries four links
  // on the four coloured remote buttons. Austext was navigated by typing page
  // numbers, so it gets a prompt instead of links it never had.
  function fastextRow() {
    if (!spec().fastext) {
      const prompt = spec().prompt;
      writer(ROWS - 1, cost(prompt.length, 1)).text(prompt, CYAN);
      return;
    }
    const keys = [RED, GREEN, YELLOW, CYAN];
    const labels = state.links.length ? state.links : spec().links;
    for (let i = 0; i < 4; i++) {
      const w = writer(ROWS - 1, i * 10);
      w.colour(keys[i]).text((labels[i] || '').toUpperCase().slice(0, 9));
    }
  }

  // Subtitles were a nearly-empty page: one boxed band of text near the bottom,
  // keyed over the programme. Everything else stayed black so the picture
  // showed through.
  function subtitlePage(S) {
    const { title, rest } = lines();
    const said = (rest || title || 'and now the news, read by nobody at all').trim();
    const wrapped = wrap(said, 34).filter(Boolean).slice(0, 2);
    let r = ROWS - 4 - wrapped.length;
    for (const line of wrapped) {
      // Start/End Box is what made subtitles legible over video. Level 1 draws
      // them as ordinary cells here, since there's no picture behind them.
      const w = writer(r, cost(line.length, 3));
      w.code(0x0B).colour(WHITE).text(line).code(0x0A);
      r++;
    }
    writer(1, 1).text(spec().subtitleLabel, CYAN);
  }

  // Engineering test page: eight colour bars, exactly five columns each, which
  // is the only way 40 columns divides evenly once every bar has spent a cell
  // on its own colour code. The line at the bottom sits behind a Conceal code —
  // the trick quiz and results pages used, uncovered by REVEAL on the remote.
  function testCardPage(S) {
    for (let r = 2; r <= 13; r++) {
      const w = writer(r, 0);
      for (let i = 0; i < 8; i++) w.blocks(4, (i + 1) % 8, FULL);
    }
    for (let r = 14; r <= 15; r++) {
      const w = writer(r, 0);
      w.code(SEPD);
      for (let i = 0; i < 8; i++) w.blocks(4, 7 - i, FULL);
    }
    writer(17, 1).text(spec().service + ' ENGINEERING TEST', WHITE);
    writer(18, 1).text(spec().onAir, CYAN);
    const w = writer(20, 1);
    w.colour(YELLOW).code(0x18).text(spec().signOff);
    writer(22, 1).text('PRESS REVEAL', WHITE);
  }

  function heading(row, text, colour) {
    // A double-height code is a cell like any other, so centring has to pay
    // for it as well as for the colour.
    const codes = state.double ? 2 : 1;
    const t = text.toUpperCase().slice(0, COLS - codes);
    const w = writer(row, cost(t.length, codes));
    w.colour(colour);
    if (state.double) w.code(DBH);
    w.text(t);
    return row + (state.double ? 2 : 1);
  }

  function rule(row, colour, code) {
    const w = writer(row, 1);
    if (state.separated) w.code(SEPD);
    w.blocks(COLS - 2 - (state.separated ? 1 : 0), colour, code);
  }

  function strap(row, text, colour) {
    const w = writer(row, cost(text.length, state.flash ? 2 : 1));
    w.colour(colour);
    if (state.flash) w.code(FLASH);
    w.text(text.toUpperCase());
  }

  function lines() {
    const all = String(state.copy).split('\n');
    return { title: (all[0] || '').trim(), rest: all.slice(1).join('\n').trim() };
  }

  function headlinePage(S, rand) {
    const { title, rest } = lines();
    let r = heading(2, title || 'HEADLINE', S.head);
    rule(r + 1, S.rule, rand() < 0.5 ? FULL : codeOfMask(0x3F ^ 0x09));
    r += 3;
    for (const line of wrap(rest, 36)) {
      if (r > 21) break;
      if (line) writer(r, 2).text(line, S.body);
      r++;
    }
    strap(22, 'PLAY.RAVIVASAVAN.COM', S.strap);
  }

  function indexPage(S, rand) {
    const { title, rest } = lines();
    let r = heading(2, title || 'INDEX', S.head);
    rule(r + 1, S.rule);
    r += 3;
    for (const raw of rest.split('\n')) {
      if (r > 21 || !raw.trim()) continue;
      const m = raw.trim().match(/^(.*?)\s+(\d{3})$/);
      const name = (m ? m[1] : raw.trim()).toUpperCase().slice(0, 24);
      const num = m ? m[2] : '';
      // name + dots + number, and the three colour changes it takes to get
      // there: 3 of the row's 40 cells before a single character is drawn.
      const w = writer(r, 1);
      w.text(name, S.head);
      if (num) {
        const dots = COLS - 2 - w.col - num.length - 2;
        if (dots > 0) w.colour(S.dim).text('.'.repeat(dots));
        writer(r, COLS - num.length - 2).colour(S.body).text(num);
      }
      r++;
    }
    // Austext's row 24 already says how to navigate, so don't say it twice.
    if (spec().fastext) strap(22, 'CHOOSE A PAGE', S.strap);
  }

  function newsflashPage(S, rand) {
    const { title, rest } = lines();
    const top = 7, bottom = 18, left = 3, right = COLS - 4;
    // Mosaic frame: top and bottom bands are rows of half-height sixels, the
    // sides single cells. Separated mode turns it into a dotted rule.
    for (const row of [top, bottom]) {
      const w = writer(row, left);
      if (state.separated) w.code(SEPD);
      // Bands line up with the side bars at left+1 … right-1. The top band
      // lights its bottom sixels and the bottom band its top ones, so both
      // rules hug the inside of the box.
      w.blocks(right - left - 1 - (state.separated ? 1 : 0), S.rule,
               row === top ? codeOfMask(0x30) : codeOfMask(0x03));
    }
    // Both side borders reserve two columns outright — one for the graphics
    // code, one for the bar. Letting a writer decide whether the code was
    // needed made the right-hand bar wander between two columns from row to
    // row, depending on whether that row happened to carry text.
    for (let row = top + 1; row < bottom; row++) {
      poke(row, left, GC(S.rule));
      poke(row, left + 1, codeOfMask(0x15));
    }
    let r = heading(top + 2, title || 'NEWSFLASH', S.head);
    r += 1;
    for (const line of wrap(rest, 26)) {
      if (r >= bottom - 1) break;
      if (line) writer(r, left + 3).text(line, S.body);
      r++;
    }
    for (let row = top + 1; row < bottom; row++) {
      poke(row, right - 2, GC(S.rule));
      poke(row, right - 1, codeOfMask(0x2A));
    }
    strap(bottom + 2, 'MORE LATER', S.strap);
  }

  // Mosaic-led page, so "art" has something to show before a picture is
  // dropped on it. Overlapping solid blocks, not per-cell randomness: filling
  // each row with random masks produces noise, because what reads as mosaic art
  // is flat shapes with the odd half-cell trimming their edge.
  function artPage(S, rand) {
    const { title, rest } = lines();
    const palette = [S.head, S.rule, S.body, S.dim, S.strap];
    const blocks = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < blocks; i++) {
      const bw = 3 + Math.floor(rand() * 12);
      const bh = 1 + Math.floor(rand() * 5);
      const x = Math.floor(rand() * (COLS - bw - 1));
      const y = 2 + Math.floor(rand() * Math.max(1, 14 - bh));
      const colour = palette[Math.floor(rand() * palette.length)];
      const soften = rand() < 0.5;
      for (let r = y; r < y + bh && r <= 15; r++) {
        const w = writer(r, x);
        // Separated is a set-at mode: one code at the head covers the run.
        if (state.separated) w.code(SEPD);
        // Holding the mosaic makes the colour code that opens this run repeat
        // its neighbour rather than leave the black notch that gives away where
        // a code is sitting — so the toggle means something on every layout.
        if (state.hold && x > 0) w.code(HOLD);
        // Trimming the last row to its top two sixels ends the shape halfway
        // down a cell, which is how mosaic art escapes looking like bricks.
        w.blocks(bw, colour, codeOfMask(soften && r === y + bh - 1 ? 0x03 : 0x3F));
      }
    }
    let r = heading(17, title || 'MOSAIC', S.head);
    r += 1;
    for (const line of wrap(rest, 36)) {
      if (r > 21) break;
      if (line) writer(r, 2).text(line, S.body);
      r++;
    }
    strap(22, 'SIX SIXELS TO A CELL', S.strap);
  }

  // --------------------------------------------------------- picture → sixels
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function nearest(r, g, b) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < 8; i++) {
      const [pr, pg, pb] = RGB[i];
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Sample the image at sixel resolution, then spend the row's cells the way
  // Level 1 forces you to: one foreground colour at a time against black, and
  // a spacing code for every change of colour along the row.
  function picturePage(S) {
    const R0 = 2, R1 = 22, cellsH = R1 - R0 + 1;
    const sw = COLS * 2, sh = cellsH * 3;
    const off = document.createElement('canvas');
    off.width = sw; off.height = sh;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    // Cover-crop, so the picture fills the art area rather than letterboxing.
    const img = state.picture;
    const scale = Math.max(sw / img.width, sh / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    octx.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
    const px = octx.getImageData(0, 0, sw, sh).data;

    const quant = (x, y) => {
      const i = (y * sw + x) * 4;
      let [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      if (state.dither === 'ordered') {
        // Nudge each sixel by its Bayer offset before matching, which buys
        // apparent shading out of eight flat colours.
        const t = (BAYER[y & 3][x & 3] / 16 - 0.5) * 96;
        r = Math.min(255, Math.max(0, r + t));
        g = Math.min(255, Math.max(0, g + t));
        b = Math.min(255, Math.max(0, b + t));
      }
      return nearest(r, g, b);
    };

    for (let cy = 0; cy < cellsH; cy++) {
      const row = R0 + cy;
      // Per cell: which colour it wants, and which of its six sixels light up.
      const want = [], masks = [];
      for (let cx = 0; cx < COLS; cx++) {
        const tally = new Array(8).fill(0), cols = [];
        for (let i = 0; i < 6; i++) {
          const q = quant(cx * 2 + (i & 1), cy * 3 + (i >> 1));
          cols.push(q); tally[q]++;
        }
        let fgc = 0, bestN = 0;
        for (let i = 1; i < 8; i++) if (tally[i] > bestN) { bestN = tally[i]; fgc = i; }
        want.push(fgc || WHITE);
        masks.push(cols.reduce((m, q, i) => q === want[cx] && q !== BLACK ? m | (1 << i) : m, 0));
      }

      // Merge runs until the row can afford its colour changes. Cheapest
      // merge first, measured as distance in the palette.
      let runs = [];
      for (let cx = 0; cx < COLS; cx++) {
        if (runs.length && runs[runs.length - 1].fg === want[cx]) runs[runs.length - 1].end = cx;
        else runs.push({ fg: want[cx], start: cx, end: cx });
      }
      const budget = Math.max(1, Math.min(12, state.changes));
      while (runs.length > budget) {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < runs.length - 1; i++) {
          const [ar, ag, ab] = RGB[runs[i].fg], [br, bg2, bb] = RGB[runs[i + 1].fg];
          const d = ((ar - br) ** 2 + (ag - bg2) ** 2 + (ab - bb) ** 2) /
                    (1 + Math.min(runs[i].end - runs[i].start, runs[i + 1].end - runs[i + 1].start));
          if (d < bd) { bd = d; bi = i; }
        }
        const a = runs[bi], b = runs[bi + 1];
        const keep = (a.end - a.start) >= (b.end - b.start) ? a.fg : b.fg;
        runs.splice(bi, 2, { fg: keep, start: a.start, end: b.end });
      }

      // Write it. Hold mosaic is a code of its own, spent once at the head of
      // the row; then every run opens with a graphics-colour code that eats the
      // cell it sits in. With hold on, that cell repeats the mosaic before it
      // rather than showing the black notch — which is why held art looks
      // continuous and unheld art looks perforated.
      let cx = 0;
      if (state.hold) poke(row, cx++, HOLD);
      for (const run of runs) {
        if (cx > run.end) continue;
        const open = Math.max(cx, run.start);
        poke(row, open, GC(run.fg));
        for (let c2 = open + 1; c2 <= run.end; c2++) {
          // Sixels only survive if they were the cell's own colour; recolouring
          // a merged run means re-testing them against the run's colour.
          let mask = masks[c2];
          if (want[c2] !== run.fg) {
            mask = 0;
            for (let i = 0; i < 6; i++) {
              const q = quant(c2 * 2 + (i & 1), cy * 3 + (i >> 1));
              if (q === run.fg) mask |= 1 << i;
            }
          }
          poke(row, c2, codeOfMask(mask));
        }
        cx = run.end + 1;
      }
    }
    const { title } = lines();
    if (title) strap(ROWS - 2, title.slice(0, 34), S.strap);
  }

  // ----------------------------------------------------------------- exports
  // 25 rows × 40 columns of seven-bit codes, most significant bit first, at
  // bit offset 280r + 7c, as 1167 base64url digits behind a charset digit.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function editTfHash() {
    const bits = new Uint8Array(1167 * 6);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const code = page[r * COLS + c], base = 280 * r + 7 * c;
        for (let b = 0; b < 7; b++) bits[base + b] = (code >> (6 - b)) & 1;
      }
    }
    let out = '';
    for (let i = 0; i < 1167; i++) {
      let v = 0;
      for (let b = 0; b < 6; b++) v = (v << 1) | bits[i * 6 + b];
      out += B64[v];
    }
    return '0:' + out;
  }

  // MRG tti. Control codes travel as ESC followed by the code with bit 6 set,
  // which is how the archive's own tooling stores them.
  function ttiText() {
    const esc = String.fromCharCode(0x1B);
    const out = [
      'DE,' + state.service + ' ' + state.number + ' — generated by play.ravivasavan.com/20260804/teletext/',
      'PN,' + state.number + '00',
      'SC,0000',
      'PS,8000'
    ];
    for (let r = 1; r < ROWS; r++) {
      let line = '';
      for (let c = 0; c < COLS; c++) {
        const v = page[r * COLS + c];
        line += isCode(v) ? esc + String.fromCharCode(v | 0x40) : String.fromCharCode(v);
      }
      out.push('OL,' + r + ',' + line);
    }
    return out.join('\r\n') + '\r\n';
  }

  // Unicode's sextants enumerate the 64 masks minus blank, both half-blocks
  // and full block, which already have code points of their own.
  function sextant(mask) {
    if (mask === 0) return ' ';
    if (mask === 0x15) return '▌';
    if (mask === 0x2A) return '▐';
    if (mask === 0x3F) return '█';
    let n = 0;
    for (let m = 1; m < mask; m++) if (m !== 0x15 && m !== 0x2A) n++;
    return String.fromCodePoint(0x1FB00 + n);
  }

  function unicodeText() {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      let gfx = false, line = '';
      for (let c = 0; c < COLS; c++) {
        const v = page[r * COLS + c];
        if (isCode(v)) {
          if (v <= 0x07) gfx = false;
          else if (v >= 0x10 && v <= 0x17) gfx = true;
          line += ' ';
        } else if (gfx && isMosaic(v)) line += sextant(maskOf(v));
        else line += glyphOf(v);
      }
      rows.push(line.replace(/\s+$/, ''));
    }
    return rows.join('\n');
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // -------------------------------------------------------------------- wire
  const screen = document.getElementById('screen');
  const ctx = screen.getContext('2d');
  const caption = document.getElementById('caption');
  const summary = document.getElementById('sheet-summary');
  const el = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flashOn = true;

  function paint() {
    const Z = state.scale;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = COLS * CELL_W * Z, h = ROWS * CELL_H * Z;
    // A phone is narrower than the 480px raster and integer scales stop at 1×,
    // so the display — not the render — shrinks to fit. The backing store stays
    // at the integer scale, so the source pixels are still exact; only the last
    // step down is fractional, which beats clipping the right of the page off.
    const stage = document.getElementById('stage');
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const fit = availW > 0 ? Math.min(1, availW / w) : 1;
    screen.style.width = (w * fit) + 'px';
    screen.style.height = (h * fit) + 'px';
    if (screen.width !== w * dpr || screen.height !== h * dpr) {
      screen.width = w * dpr; screen.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(ctx, Z, { reveal: state.reveal, flashOn: reduced || flashOn, revealed: state.revealed });

    // How much of the page went on attributes rather than content.
    let codes = 0;
    for (let i = 0; i < page.length; i++) if (isCode(page[i])) codes++;
    const mode = state.number === spec().subtitlePage ? 'subtitles'
               : state.testCard ? 'test card'
               : state.picture ? 'picture' : state.layout;
    caption.textContent = `40 × 25 · ${codes} cell${codes === 1 ? '' : 's'} spent on attributes` +
      ` · ${mode} · ${SCHEMES[state.scheme].name}` +
      (state.revealed ? ' · revealed' : '') + (state.pagesFrom ? ' · pages from' : '');
    // Collapsed on a phone, the sheet's head is all that shows — so it says
    // which page this is rather than repeating the word "settings".
    summary.textContent = `P${state.number} · ${mode[0].toUpperCase() + mode.slice(1)}` +
      ` · ${SCHEMES[state.scheme].name}`;
  }

  function build() { compose(); paint(); }

  // A page is meant to be seen whole, and only integer scales stay crisp — so
  // pick the largest one that fits and leave the choice alone once it's made
  // by hand.
  function fitScale() {
    const stage = document.getElementById('stage');
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 36;
    for (const z of [3, 2, 1]) {
      if (COLS * CELL_W * z <= availW && ROWS * CELL_H * z <= availH) return z;
    }
    return 1;
  }

  // Controls -----------------------------------------------------------------
  const swatches = el('swatches');
  function paintSwatches() {
    const S = SCHEMES[state.scheme];
    swatches.innerHTML = '';
    for (const key of ['head', 'rule', 'body', 'dim', 'strap']) {
      const d = document.createElement('div');
      d.className = 'swatch';
      d.style.background = CLUT[S[key]];
      d.title = key;
      swatches.appendChild(d);
    }
  }

  /* The copy and the fastext line are still real fields in the drawer — a
     multi-line body of text is not a dial, and DialKit has no control for one.
     Everything else is the panel's, and is pushed to it rather than to the
     DOM. */
  let onPanel = null;
  function panelValues() {
    return {
      spec: state.spec, number: state.number, service: state.service,
      layout: state.layout, scheme: state.scheme, seed: state.seed,
      scale: state.scale, dither: state.dither, changes: state.changes,
      double: state.double, separated: state.separated,
      hold: state.hold, flash: state.flash
    };
  }
  function syncFields() {
    el('c-copy').value = state.copy;
    el('c-links').value = state.links.join(', ');
    if (onPanel) onPanel(panelValues());
    // Reveal-codes is a pill on the rail rather than a checkbox.
    el('p-reveal').classList.toggle('is-on', state.reveal);
    el('p-reveal').setAttribute('aria-pressed', String(state.reveal));
    paintSwatches();
  }

  const bind = (id, key, get) => el(id).addEventListener('input', e => {
    state[key] = get(e.target);
    build();
  });

  /* Switching service brings its own branding and index with it, and switching
     layout brings that layout's seeded copy — on the same terms in both cases:
     until you've typed your own, it isn't yours. */
  let serviceMine = false;
  let copyMine = false;
  el('c-copy').addEventListener('input', () => { copyMine = true; });
  bind('c-copy', 'copy', t => t.value);
  bind('c-links', 'links', t => t.value.split(',').map(s => s.trim()).filter(Boolean));

  /* Everything else arrives from the panel as a whole value set, so what
     actually changed has to be worked out here — the side effects differ per
     field, and a scale change repaints where the rest rebuild. */
  function applyPanel(v) {
    if (!v) return;
    let rebuild = false, repaint = false, reseeded = false;

    if (v.spec !== state.spec) {
      state.spec = v.spec;
      if (!serviceMine) state.service = spec().service;
      if (!copyMine && state.layout === 'index') state.copy = spec().index;
      reseeded = true; rebuild = true;
    }
    if (v.layout !== state.layout) {
      state.layout = v.layout;
      if (!copyMine) {
        const pick = SEEDS.find(s => s.layout === state.layout);
        if (pick) { state.copy = pick.copy; state.scheme = pick.scheme; }
        // An index is the one page where the service's own contents list beats
        // anything generic.
        if (state.layout === 'index') state.copy = spec().index;
        reseeded = true;
      }
      rebuild = true;
    }
    if (v.service !== state.service) { serviceMine = true; state.service = v.service; rebuild = true; }
    if (v.number !== state.number) { state.number = Math.max(100, Math.min(899, +v.number || 100)); rebuild = true; }
    if (v.scheme !== state.scheme) { state.scheme = +v.scheme; paintSwatches(); rebuild = true; }
    if (v.seed !== state.seed) { state.seed = v.seed; rebuild = true; }
    if (v.dither !== state.dither) { state.dither = v.dither; rebuild = true; }
    if (v.changes !== state.changes) { state.changes = +v.changes || 6; rebuild = true; }
    for (const k of ['double', 'separated', 'hold', 'flash']) {
      if (v[k] !== state[k]) { state[k] = !!v[k]; rebuild = true; }
    }
    if (+v.scale !== state.scale) {
      state.scale = +v.scale;
      state.autoScale = false;    // a hand-picked scale outranks the fit
      repaint = true;
    }

    if (rebuild) build(); else if (repaint) paint();
    // A reseed rewrites the copy box and the panel's own idea of the page.
    if (reseeded) syncFields();
  }

  // Reveal-codes lives in the tools row: it acts on the page rather than
  // describing it, which is the line between the row and the panel.
  el('p-reveal').addEventListener('click', () => {
    stopCycle();
    state.reveal = !state.reveal;
    el('p-reveal').classList.toggle('is-on', state.reveal);
    el('p-reveal').setAttribute('aria-pressed', String(state.reveal));
    paint();
  });

  // Randomise draws a whole page: seed, layout, scheme and copy together.
  el('p-random').addEventListener('click', () => {
    stopCycle();
    state.testCard = false;
    state.seed = Math.random().toString(36).slice(2, 8);
    const rand = seeded(state.seed);
    const pick = SEEDS[Math.floor(rand() * SEEDS.length)];
    state.layout = pick.layout;
    state.scheme = pick.scheme;
    state.copy = pick.copy;
    state.separated = rand() < 0.3;
    syncFields();
    build();
  });

  // Picture ------------------------------------------------------------------
  const drop = el('drop'), file = el('file');
  function loadImage(f) {
    if (!f || !f.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => { state.picture = img; drop.textContent = f.name.slice(0, 32); build(); };
    img.src = URL.createObjectURL(f);
  }
  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  file.addEventListener('change', e => loadImage(e.target.files[0]));
  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('over'); });
  }
  for (const type of ['dragleave', 'drop']) {
    drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('over'); });
  }
  drop.addEventListener('drop', e => loadImage(e.dataTransfer.files[0]));
  el('c-clearimg').addEventListener('click', () => {
    state.picture = null;
    drop.textContent = 'Drop an image, or click to choose';
    build();
  });

  // Exports ------------------------------------------------------------------
  el('x-png').addEventListener('click', () => {
    // Re-render clean at the display scale: no reveal marks, nothing flashed off.
    const out = document.createElement('canvas');
    out.width = COLS * CELL_W * state.scale;
    out.height = ROWS * CELL_H * state.scale;
    render(out.getContext('2d'), state.scale, { reveal: false, flashOn: true });
    out.toBlob(b => download(`teletext-${state.number}.png`, b), 'image/png');
  });
  el('x-tti').addEventListener('click', () =>
    download(`teletext-${state.number}.tti`, new Blob([ttiText()], { type: 'text/plain' })));
  el('x-edittf').addEventListener('click', () =>
    window.open('https://edit.tf/#' + editTfHash(), '_blank', 'noopener'));
  el('x-unicode').addEventListener('click', async () => {
    const note = el('x-note'), was = note.textContent;
    try {
      await navigator.clipboard.writeText(unicodeText());
      note.textContent = 'Copied — sextants need a font that covers U+1FB00.';
    } catch (e) {
      note.textContent = 'Clipboard refused. ' + was;
    }
    setTimeout(() => { note.textContent = was; }, 2600);
  });

  // Buttons the remote had that the panel doesn't ------------------------------
  // REVEAL uncovered concealed text; the engineering test page was tucked away
  // where viewers wouldn't find it; and Pages From Ceefax turned the whole thing
  // into a slideshow with music between programmes on BBC Two from 1982 until
  // the service closed. None of these are advertised in the panel.
  let cycle = null;
  const CYCLE_LAYOUTS = ['headline', 'index', 'newsflash', 'art'];

  function nextPage() {
    const i = CYCLE_LAYOUTS.indexOf(state.layout);
    state.layout = CYCLE_LAYOUTS[(i + 1) % CYCLE_LAYOUTS.length];
    state.scheme = (state.scheme + 1) % SCHEMES.length;
    if (!copyMine) {
      const pick = SEEDS.find(s => s.layout === state.layout);
      if (pick) state.copy = pick.copy;
      if (state.layout === 'index') state.copy = spec().index;
    }
    syncFields();
    build();
  }

  function stopCycle() {
    if (cycle) { clearInterval(cycle); cycle = null; }
    state.pagesFrom = false;
  }

  addEventListener('keydown', e => {
    // Never steal a key from someone typing their copy.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { state.revealed = !state.revealed; paint(); }
    else if (k === 't') { state.testCard = !state.testCard; stopCycle(); build(); }
    else if (k === 'p') {
      // Reduced motion gets a manual slideshow rather than an automatic one.
      if (reduced) { nextPage(); return; }
      if (state.pagesFrom) stopCycle();
      else { state.pagesFrom = true; state.testCard = false; nextPage(); cycle = setInterval(nextPage, 4000); }
      build();
    } else return;
    e.preventDefault();
  });

  // Touching any control drops out of the slideshow, so it can't fight you.
  document.getElementById('panel').addEventListener('input', () => { if (state.pagesFrom) { stopCycle(); build(); } });

  // Start from a seed, as asked: the page is already composed on arrival.
  (function start() {
    const rand = seeded(state.seed);
    const pick = SEEDS[Math.floor(rand() * SEEDS.length)];
    state.layout = pick.layout;
    state.scheme = pick.scheme;
    state.copy = pick.copy;
    state.links = el('c-links').value.split(',').map(s => s.trim()).filter(Boolean);
    state.scale = fitScale();
    // syncFields pushes the whole set, scale included, to the panel.
    syncFields();
  })();

  addEventListener('resize', () => {
    if (!state.autoScale) return;
    const z = fitScale();
    if (z === state.scale) return;
    state.scale = z;
    // The fit picked this, not the reader — tell the panel so its dial follows.
    if (onPanel) onPanel(panelValues());
    paint();
  });

  // The clock in the header ticks, like a real service, and flash runs at ~1 Hz
  // (the spec leaves the rate to the receiver). Neither redraws the layout:
  // recomposing here would re-quantise a dropped picture twice a second.

  document.fonts.load('20px Bedstead').then(build).catch(build);
  setInterval(() => { flashOn = !flashOn; headerRow(); paint(); }, 500);

  /* What the DialKit panel talks to. The schemes are defined in here, so the
     panel asks for them rather than carrying a second copy that could drift. */
  window.teletext = {
    getSchemes: () => SCHEMES.map((s, i) => ({ value: String(i), label: s.name })),
    getValues: panelValues,
    setValues: applyPanel,
    onChange(fn) { onPanel = fn; }
  };
})();
