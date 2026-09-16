// Everything the page needs — play.js, melt.js, trace.js — is deferred, so the
// wiring waits for the parse to finish rather than racing it.
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const $ = id => document.getElementById(id);
  // play.js paints a .dial's filled track; it only needs telling when a value
  // is set in code rather than by a hand on the slider.
  const dials = root => { if (window.play) window.play.dials(root); };
  const stage = $('stage'), canvas = $('ink'), empty = $('empty'), dump = $('dump');
  const ctx = canvas.getContext('2d');
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

  // Surface anything that throws where a screenshot can see it.
  let fatalShown = false;
  // With artwork on the stage, a complaint belongs on the status line, not
  // behind an overlay covering the work.
  function say(msg) {
    if (mask) { $('status').textContent = msg; return; }
    const p = $('fatal');
    p.textContent = msg;
    p.hidden = false;
    empty.hidden = false;
  }
  function stamp(msg) {
    if (!fatalShown) { document.title = 'melt — ERROR: ' + msg; fatalShown = true; }
  }
  // A stray throw with artwork already on the stage is not worth binning the
  // work over: stamp the title (so a headless run still sees it), put it on the
  // status line, carry on.
  function oops(msg) { stamp(msg); say(msg); }
  // Unrecoverable: nothing to melt with, so retire the empty state's buttons.
  function fatal(msg) {
    stamp(msg);
    mask = null;
    say(msg);
    $('e-upload').hidden = true;
    $('e-sample').hidden = true;
  }
  addEventListener('error', e => oops((e.message || 'script error') + (e.filename ? ' (' + e.filename.split('/').pop() + ')' : '')));

  const MELT = window.MELT, TRACE = window.TRACE;

  // ---------- state ----------
  const KEY = 'melt.state';
  const WORK = 1024;            // longest artwork side, in mask px
  const HIT = 12, RING = 8;     // pointer slop, in screen px
  let src = null;               // { text, width, height }
  let name = '';                // file name
  let mask = null;              // { w, h, scale, ox, oy, alpha }
  let points = [];              // { x, y, r, heat } in mask px
  let sel = -1;
  const opts = { passes: 3, threshold: 0.5, base: 0 };
  let binary = null;
  let before = false, holding = false, gone = false;
  let off = null, offCtx = null, offImg = null;
  let saving = true, booted = false;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  if (!MELT || !TRACE) {
    const missing = [!MELT && 'melt.js', !TRACE && 'trace.js'].filter(Boolean).join(' and ');
    fatal(missing + ' did not load, so there is nothing to melt with.');
    return;
  }

  function save() {
    if (!saving) return;
    try {
      const s = { version: 1, name, points, passes: opts.passes, threshold: opts.threshold, base: opts.base };
      if (src && src.text.length < 1e6) s.svg = src.text;
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }

  // ---------- history ----------
  const hist = [];
  function push() {
    hist.push(JSON.stringify(points));
    if (hist.length > 50) hist.shift();
  }
  function undo() {
    const s = hist.pop();
    if (s == null) return;
    points = JSON.parse(s);
    if (sel >= points.length) sel = points.length - 1;
    buildList(); syncCount(); queue(); save();
  }

  // ---------- loading ----------
  async function load(text, fileName, keep) {
    let parsed;
    try { parsed = MELT.parseSvg(text); }
    catch (e) { say(e && e.message ? e.message : 'That file is not an SVG.'); return false; }
    src = parsed;
    name = fileName || 'artwork.svg';
    try { mask = await MELT.rasterise(src, WORK); }
    catch (e) { say('Could not rasterise that SVG: ' + (e && e.message ? e.message : e)); return false; }
    off = document.createElement('canvas');
    off.width = mask.w; off.height = mask.h;
    offCtx = off.getContext('2d');
    offImg = offCtx.createImageData(mask.w, mask.h);
    if (!keep) { points = []; sel = -1; hist.length = 0; }
    empty.hidden = true;
    $('fatal').hidden = true;
    setDisabled(false);
    buildList(); syncCount(); fit(); renderNow();
    // On the boot path the caller seeds points first and dumps after, so one
    // 2× export is enough.
    if (booted && H.has('svgdump')) showDump();
    return true;
  }

  function defaultPoint(x, y) {
    const r = 0.22 * Math.min(mask.w, mask.h);
    return { x, y, r, heat: 0.1 * r };
  }

  // ---------- view ----------
  let cw = 0, ch = 0, dpr = 1, vs = 1, vtx = 0, vty = 0;
  const PAD = 24;
  function fit() {
    const r = stage.getBoundingClientRect();
    cw = r.width; ch = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    if (!mask) { paint(); return; }
    const top = matchMedia('(max-width: 900px)').matches ? 180 : 200;
    vs = Math.min((cw - PAD * 2) / mask.w, (ch - top - PAD) / mask.h);
    if (!(vs > 0)) vs = 0.0001;
    vtx = (cw - mask.w * vs) / 2;
    vty = top + (ch - top - mask.h * vs) / 2;
    placeDump();
    paint();
  }
  const toScreenX = mx => mx * vs + vtx;
  const toScreenY = my => my * vs + vty;
  const toMaskX = px => (px - vtx) / vs;
  const toMaskY = py => (py - vty) / vs;

  // ---------- render ----------
  let pending = 0;
  function queue() {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; renderNow(); });
  }
  function renderNow() {
    if (!mask) { paint(); return; }
    binary = MELT.render(mask.alpha, mask.w, mask.h, points, {
      passes: opts.passes, threshold: opts.threshold, base: opts.base
    });
    // Enough heat for the sigma to dwarf the stroke width erases the artwork
    // outright — physically right, but a blank stage needs saying out loud.
    let any = false;
    for (let i = 0; i < binary.length; i++) if (binary[i]) { any = true; break; }
    const g = !any && (points.length > 0 || opts.base > 0);
    if (g !== gone) { gone = g; syncCount(); }
    paint();
  }

  function rgbOf(css, fallback) {
    probe.fillStyle = fallback;
    try { probe.fillStyle = css; } catch (e) {}
    probe.clearRect(0, 0, 1, 1);
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  function paint() {
    const v = getComputedStyle(document.documentElement);
    const inkCss = v.getPropertyValue('--ink').trim() || '#0d1b1e';
    const mutedCss = v.getPropertyValue('--muted').trim() || '#7a8385';
    const orangeCss = v.getPropertyValue('--orange').trim() || '#ff795c';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!mask) return;

    // The ink layer: coverage straight into the alpha channel, tinted with --ink.
    const arr = (before || holding) ? mask.alpha : (binary || mask.alpha);
    const rgb = rgbOf(inkCss, '#0d1b1e');
    const d = offImg.data;
    for (let i = 0, j = 0; i < arr.length; i++, j += 4) {
      d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = arr[i];
    }
    offCtx.putImageData(offImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, vtx, vty, mask.w * vs, mask.h * vs);

    // Points, in screen space so they stay the same size at every fit.
    ctx.lineWidth = 1;
    points.forEach((p, i) => {
      const sx = toScreenX(p.x), sy = toScreenY(p.y), sr = Math.max(3, p.r * vs);
      const on = i === sel;
      ctx.strokeStyle = on ? orangeCss : mutedCss;
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = on ? orangeCss : mutedCss;
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
      if (on) {
        // Label sits above the ring, on the page rather than on the ink.
        ctx.font = '12px "Labil Grotesk", system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        const t = 'heat ' + Math.round(p.heat) + ' · reach ' + Math.round(p.r);
        const half = ctx.measureText(t).width / 2;
        const ly = sy - sr - 8 < 16 ? Math.min(ch - 8, sy + sr + 20) : sy - sr - 8;
        ctx.fillText(t, clamp(sx, half + 8, cw - half - 8), ly);
        ctx.textAlign = 'left';
      }
    });
  }

  // ---------- panel ----------
  function syncCount() {
    $('n').textContent = points.length;
    $('nlabel').textContent = points.length === 1 ? 'melt point' : 'melt points';
    $('status').textContent = gone
      ? 'melted clean away · less heat, or a lower threshold'
      : src
        ? name + ' · ' + Math.round(src.width) + '×' + Math.round(src.height) + ' units'
        : 'Drop an SVG to start';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const X = '<svg viewBox="4 4 16 16" fill="none" stroke="currentColor" stroke-width="1.6667" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function buildList() {
    const box = $('ptlist');
    if (!points.length) {
      box.innerHTML = '<p class="empty">' + (mask ? 'Click the artwork to place a melt point.' : 'Load an SVG first.') + '</p>';
      return;
    }
    box.innerHTML = points.map((p, i) => `<div class="pt${i === sel ? ' sel' : ''}" data-i="${i}">
      <span class="pt__n">${i + 1}</span>
      <div class="pt__dials">
        <label class="field">
          <span class="field__top"><span class="field__label">Heat</span><b class="field__value" data-v="heat">${Math.round(p.heat)}</b></span>
          <input class="dial" type="range" data-k="heat" min="0" max="120" step="1" value="${Math.round(p.heat)}" aria-label="Heat of point ${i + 1}">
        </label>
        <label class="field">
          <span class="field__top"><span class="field__label">Reach</span><b class="field__value" data-v="r">${Math.round(p.r)}</b></span>
          <input class="dial" type="range" data-k="r" min="20" max="600" step="1" value="${Math.round(p.r)}" aria-label="Reach of point ${i + 1}">
        </label>
      </div>
      <button class="pt__x" type="button" data-x="${i}" aria-label="Remove point ${i + 1}">${X}</button>
    </div>`).join('');
    dials(box);
  }

  // Update values in place so dragging a slider never rebuilds it underfoot.
  function syncList() {
    const rows = $('ptlist').querySelectorAll('.pt');
    rows.forEach(row => {
      const i = +row.dataset.i, p = points[i];
      if (!p) return;
      row.classList.toggle('sel', i === sel);
      row.querySelectorAll('input[data-k]').forEach(inp => {
        const val = String(Math.round(p[inp.dataset.k]));
        if (inp.value !== val && document.activeElement !== inp) inp.value = val;
      });
      row.querySelectorAll('b[data-v]').forEach(b => { b.textContent = Math.round(p[b.dataset.v]); });
    });
    dials($('ptlist'));
  }

  $('ptlist').addEventListener('input', e => {
    const inp = e.target.closest('input[data-k]'); if (!inp) return;
    const row = inp.closest('.pt'), i = +row.dataset.i, p = points[i];
    if (!p) return;
    if (!inp.dataset.dirty) { push(); inp.dataset.dirty = '1'; }
    p[inp.dataset.k] = +inp.value;
    sel = i;
    syncList(); queue(); save();
  });
  $('ptlist').addEventListener('change', e => {
    const inp = e.target.closest('input[data-k]'); if (inp) delete inp.dataset.dirty;
  });
  $('ptlist').addEventListener('click', e => {
    const x = e.target.closest('button[data-x]');
    if (x) { removePoint(+x.dataset.x); return; }
    const row = e.target.closest('.pt');
    if (row) { sel = +row.dataset.i; syncList(); paint(); }
  });

  function removePoint(i) {
    if (!points[i]) return;
    push();
    points.splice(i, 1);
    if (sel === i) sel = -1; else if (sel > i) sel--;
    buildList(); syncCount(); queue(); save();
  }

  /* The three global dials live in the DialKit panel now. opts stays the one
     source of truth; the panel is told whenever something other than the panel
     moves it — loading a file, or restoring last session from local storage. */
  let onGlobals = null;
  function syncGlobal() {
    if (onGlobals) onGlobals({ passes: opts.passes, threshold: opts.threshold, base: opts.base });
  }

  function setDisabled(d) {
    for (const id of ['t-before', 't-clear', 't-export']) $(id).disabled = d;
    /* The dials are the panel's, and it has no disabled state — harmless
       before a file is loaded, since queue() has nothing to redraw. */
  }

  // ---------- pointer ----------
  let drag = null;   // { mode:'move'|'reach', i, dx, dy }
  let moved = false;

  function hitTest(px, py) {
    // Selected point first, so its handles win when points overlap.
    const order = [];
    if (points[sel]) order.push(sel);
    for (let i = points.length - 1; i >= 0; i--) if (i !== sel) order.push(i);
    for (const i of order) {
      const p = points[i], sx = toScreenX(p.x), sy = toScreenY(p.y), dist = Math.hypot(px - sx, py - sy);
      if (dist <= HIT) return { i, mode: 'move' };
      if (Math.abs(dist - p.r * vs) <= RING) return { i, mode: 'reach' };
    }
    return null;
  }

  stage.addEventListener('pointerdown', e => {
    if (!mask || e.button !== 0) return;
    const r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const h = hitTest(px, py);
    moved = false;
    if (h) {
      sel = h.i;
      push();
      drag = h.mode === 'move'
        ? { mode: 'move', i: h.i, dx: points[h.i].x - toMaskX(px), dy: points[h.i].y - toMaskY(py) }
        : { mode: 'reach', i: h.i };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}  // optional nicety; never worth a throw
      syncList(); paint();
    } else {
      drag = { mode: 'pending', px, py };
    }
  });

  stage.addEventListener('pointermove', e => {
    if (!mask) return;
    const r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (!drag) {
      const h = hitTest(px, py);
      canvas.style.cursor = h ? (h.mode === 'move' ? 'move' : 'ew-resize') : 'crosshair';
      return;
    }
    if (drag.mode === 'pending') {
      if (Math.hypot(px - drag.px, py - drag.py) > 4) moved = true;
      return;
    }
    moved = true;
    const p = points[drag.i];
    if (!p) return;
    if (drag.mode === 'move') {
      p.x = clamp(toMaskX(px) + drag.dx, 0, mask.w);
      p.y = clamp(toMaskY(py) + drag.dy, 0, mask.h);
    } else {
      const d = Math.hypot(px - toScreenX(p.x), py - toScreenY(p.y));
      p.r = clamp(d / vs, 20, 600);
    }
    syncList(); queue();
  });

  function endDrag(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'pending') {
      if (!moved && e.type === 'pointerup' && mask) {
        push();
        points.push(defaultPoint(clamp(toMaskX(d.px), 0, mask.w), clamp(toMaskY(d.py), 0, mask.h)));
        sel = points.length - 1;
        buildList(); syncCount(); queue(); save();
      }
      return;
    }
    save();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', () => { canvas.style.cursor = ''; });

  stage.addEventListener('wheel', e => {
    const p = points[sel];
    if (!mask || !p) return;
    // Only over the selected point, so the fold can still scroll the page.
    const r = stage.getBoundingClientRect();
    const d = Math.hypot(e.clientX - r.left - toScreenX(p.x), e.clientY - r.top - toScreenY(p.y));
    if (d > p.r * vs + RING) return;
    e.preventDefault();
    p.heat = clamp(p.heat - e.deltaY * 0.08, 0, 120);
    syncList(); queue(); save();
  }, { passive: false });

  // ---------- keys ----------
  addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (tag === 'input' || tag === 'textarea') return;
    const p = points[sel];
    if (e.key === '[' || e.key === ']') {
      if (!p) return;
      push();
      p.heat = clamp(p.heat + (e.key === ']' ? 4 : -4), 0, 120);
      syncList(); queue(); save();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (sel < 0) return;
      removePoint(sel);
    } else if (e.key === 'Escape') {
      sel = -1; syncList(); paint();
    } else if (e.key === 'b' || e.key === 'B') {
      if (holding || !mask) return;
      holding = true; $('t-before').classList.add('is-on'); paint();
    } else return;
    e.preventDefault();
  });
  addEventListener('keyup', e => {
    if (e.key === 'b' || e.key === 'B') {
      holding = false;
      $('t-before').classList.toggle('is-on', before);
      paint();
    }
  });

  // ---------- tools ----------
  $('t-upload').addEventListener('click', () => $('file').click());
  $('e-upload').addEventListener('click', () => $('file').click());
  $('e-sample').addEventListener('click', () => loadSample(true));
  $('file').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await loadFile(f);
  });
  $('t-before').addEventListener('click', () => {
    before = !before;
    $('t-before').classList.toggle('is-on', before);
    $('t-before').setAttribute('aria-pressed', String(before));
    paint();
  });
  $('t-clear').addEventListener('click', () => {
    if (!points.length) return;
    if (points.length >= 3 && !confirm('Remove all ' + points.length + ' melt points?')) return;
    push();
    points = []; sel = -1;
    buildList(); syncCount(); queue(); save();
  });
  $('t-export').addEventListener('click', async () => {
    if (!mask) return;
    const btn = $('t-export');
    btn.disabled = true;
    try {
      const out = await buildExport();
      const blob = new Blob([out.svg], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = out.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      say('Export failed: ' + (err && err.message ? err.message : err));
    }
    btn.disabled = false;
  });

  async function loadFile(f) {
    if (!/svg/i.test(f.type) && !/\.svg$/i.test(f.name)) { say('That file is not an SVG.'); return; }
    const ok = await load(await f.text(), f.name, false);
    if (ok) save();
  }
  async function loadSample(persist) {
    try {
      const text = await (await fetch('sample.svg', { cache: 'no-store' })).text();
      const ok = await load(text, 'sample.svg', false);
      if (ok && persist) save();
      return ok;
    } catch (e) { say('Could not fetch sample.svg'); }
    return false;
  }

  // Drop anywhere on the stage.
  let overDepth = 0;
  const hasSvg = dt => !!dt && Array.from(dt.items || []).some(i => i.kind === 'file');
  stage.addEventListener('dragenter', e => { e.preventDefault(); if (hasSvg(e.dataTransfer)) { overDepth++; stage.classList.add('over'); } });
  stage.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  stage.addEventListener('dragleave', e => { e.preventDefault(); if (--overDepth <= 0) { overDepth = 0; stage.classList.remove('over'); } });
  stage.addEventListener('drop', async e => {
    e.preventDefault(); overDepth = 0; stage.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await loadFile(f);
  });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => e.preventDefault());

  // ---------- export ----------
  const baseName = () => (name || 'melt').replace(/\.svg$/i, '') || 'melt';
  async function buildExport() {
    const m2 = await MELT.rasterise(src, WORK * 2);
    const p2 = points.map(p => ({ x: p.x * 2, y: p.y * 2, r: p.r * 2, heat: p.heat * 2 }));
    const bin = MELT.render(m2.alpha, m2.w, m2.h, p2, {
      passes: opts.passes, threshold: opts.threshold, base: opts.base * 2
    });
    let loops = TRACE.loops(bin, m2.w, m2.h);
    loops = TRACE.simplify(loops, 0.75);
    // Pixels → the ORIGINAL document's units: u = (px − offset)/scale + viewBox min,
    // folded into TRACE's (p + d) * s so one transform does all of it.
    const mnx = src.minX || 0, mny = src.minY || 0;
    const s = 1 / m2.scale, dx = -m2.ox + mnx * m2.scale, dy = -m2.oy + mny * m2.scale;
    let x0 = mnx, y0 = mny, x1 = mnx + src.width, y1 = mny + src.height;
    for (const L of loops) for (const pt of L) {
      const ux = (pt[0] + dx) * s, uy = (pt[1] + dy) * s;
      if (ux < x0) x0 = ux; if (uy < y0) y0 = uy;
      if (ux > x1) x1 = ux; if (uy > y1) y1 = uy;
    }
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    const vb = [x0, y0, Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))];
    const svg = TRACE.svg({
      loops, transform: { scale: s, dx, dy }, viewBox: vb, fill: '#0a0a0a', background: null
    });
    return { svg, name: baseName() + '-melt.svg', viewBox: vb };
  }

  let dumpUrl = null, dumpVB = null;
  async function showDump() {
    try {
      const out = await buildExport();
      if (dumpUrl) URL.revokeObjectURL(dumpUrl);
      dumpUrl = URL.createObjectURL(new Blob([out.svg], { type: 'image/svg+xml' }));
      dumpVB = out.viewBox;
      dump.src = dumpUrl;
      dump.hidden = false;
      placeDump();
    } catch (e) { oops('svgdump failed: ' + (e && e.message ? e.message : e)); }
  }
  // Sit the dump exactly where its own viewBox says it belongs, in mask px →
  // screen px. The exported viewBox grows when the melt swells past the
  // artwork, so it can't be assumed to be the source viewBox.
  function placeDump() {
    if (dump.hidden || !mask || !dumpVB) return;
    const k = mask.scale * vs;                 // screen px per SVG unit
    const mnx = src.minX || 0, mny = src.minY || 0;
    dump.style.left = (vtx + mask.ox * vs + (dumpVB[0] - mnx) * k) + 'px';
    dump.style.top = (vty + mask.oy * vs + (dumpVB[1] - mny) * k) + 'px';
    dump.style.width = (dumpVB[2] * k) + 'px';
    dump.style.height = (dumpVB[3] * k) + 'px';
  }

  // ---------- theme ----------
  // play.js cycles the pill and writes the token; the ink is drawn into a
  // canvas from --ink, so it has to be repainted once the fade has settled.
  new MutationObserver(() => setTimeout(paint, 260)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(paint, 260));


  // ---------- boot ----------
  // Dev hooks: #sample loads the sample without touching saved state;
  // &theme= forces a theme; &points=x,y,r,h;… seeds points as fractions;
  // &passes= &threshold= &base= set the globals; &before shows the source; #svgdump overlays the traced export.
  const H = new URLSearchParams(location.hash.slice(1));
  if (H.has('theme')) document.documentElement.dataset.theme = H.get('theme');
  const seeded = ['sample', 'points', 'passes', 'threshold', 'base'].some(k => H.has(k));
  if (seeded) saving = false;
  if (H.has('passes')) opts.passes = clamp(Math.round(+H.get('passes')), 1, 6);
  if (H.has('threshold')) opts.threshold = clamp(+H.get('threshold'), 0.05, 0.95);
  if (H.has('base')) opts.base = clamp(+H.get('base'), 0, 40);
  syncGlobal();

  function seedPoints() {
    if (!H.has('points') || !mask) return;
    const min = Math.min(mask.w, mask.h);
    points = H.get('points').split(';').map(s => s.split(',').map(Number)).filter(a => a.length >= 4 && a.every(n => isFinite(n)))
      .map(([x, y, r, h]) => ({ x: x * mask.w, y: y * mask.h, r: Math.max(20, r * min), heat: h * min }));
    sel = points.length ? 0 : -1;
  }

  setDisabled(true);
  buildList(); syncCount();
  new ResizeObserver(fit).observe(stage);
  fit();

  (async () => {
    try {
      if (H.has('sample') || H.has('points')) {
        if (!await loadSample(false)) return;
        seedPoints();
        if (H.has('before')) { before = true; $('t-before').classList.add('is-on'); $('t-before').setAttribute('aria-pressed', 'true'); }
        buildList(); syncCount(); renderNow();
        return;
      }
      // Restore whatever was here last time.
      let s = null;
      try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
      if (s && s.version === 1 && typeof s.svg === 'string') {
        if (typeof s.passes === 'number') opts.passes = clamp(Math.round(s.passes), 1, 6);
        if (typeof s.threshold === 'number') opts.threshold = clamp(s.threshold, 0.05, 0.95);
        if (typeof s.base === 'number') opts.base = clamp(s.base, 0, 40);
        syncGlobal();
        const ok = await load(s.svg, s.name || 'artwork.svg', false);
        if (ok && Array.isArray(s.points)) {
          points = s.points.filter(p => p && isFinite(p.x) && isFinite(p.y) && isFinite(p.r) && isFinite(p.heat))
            .map(p => ({ x: p.x, y: p.y, r: p.r, heat: p.heat }));
          buildList(); syncCount(); renderNow();
        }
      }
    } finally {
      booted = true;
      if (H.has('svgdump') && mask) showDump();
    }
  })();

  /* What the DialKit panel talks to. Announced rather than just assigned: this
     file is a DOMContentLoaded handler and so is the panel's mount, and the
     module registers its listener first, so the panel cannot simply look. */
  window.melt = {
    getGlobals: () => ({ passes: opts.passes, threshold: opts.threshold, base: opts.base }),
    setGlobals(v) {
      if (!v) return;
      if (v.passes != null) opts.passes = Number(v.passes);
      if (v.threshold != null) opts.threshold = Number(v.threshold);
      if (v.base != null) opts.base = Number(v.base);
      queue(); save();
    },
    onGlobalsChange(fn) { onGlobals = fn; }
  };
  document.dispatchEvent(new Event('melt:ready'));
});
