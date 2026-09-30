/* ---------------------------------------------------------------------------
   Depth — the depthcore d, lifted out of the 2002 wordmark, set in a frame and
   turned in space the way the logomark turns it.

   The d is one closed contour on a 3-unit grid: a 42 × 33 bowl-and-ascender
   with a one-cell slit in its right wall. The logomark is that same flat d
   rotated in 3D and seen through a camera — fitted back out of the mark's own
   vertices, it is an XYZ Euler rotation of X −57.3°, Y −28.9°, Z −15.7° with
   the camera about one and a half d-widths away (under a pixel of error across eleven corners). Those are
   the defaults, so the page opens on the mark as drawn.

   Everything is geometry, so the export is geometry: a polygon of projected
   vertices, not a raster. The icons go the other way — at 16 pixels the d is
   re-drawn on the pixel grid rather than scaled onto it, so the strokes stay
   whole pixels and the slit stays open.

   The panel (src/main.jsx) drives the inputs in the page's .bridge; this file
   listens to them, and says what changed with depth:sync. */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var R = Math.PI / 180;

  /* --------------------------------------------------------------- the d -- */
  /* The wordmark's d, in its own units. y runs down. */
  var D = [[42, 18], [36, 18], [36, 27], [6, 27], [6, 15], [42, 15], [42, 0], [36, 0], [36, 9], [0, 9], [0, 33], [42, 33]];
  var D_W = 42, D_H = 33;

  /* The same contour at any thickness: the outline stays 42 × 33 and the
     ascender 9 tall, the rules move inward, and the slit keeps half a rule.
     At 6 it is the wordmark's own d. */
  function dShape(w) {
    w = Math.max(1, Math.min(9, w));
    var sl = w / 2;
    var X = { 0: 0, 6: w, 36: D_W - w, 42: D_W };
    var Y = { 0: 0, 9: 9, 15: 9 + w, 18: 9 + w + sl, 27: D_H - w, 33: D_H };
    return D.map(function (p) { return [X[p[0]], Y[p[1]]]; });
  }

  /* The mark, measured. The frame is 402 wide with a 12-unit rule. */
  var FRAME_W = 402;
  var DEFAULTS = {
    dWeight: 6, rx: -57.3, ry: -28.9, rz: -15.7, depth: 65, gimbal: true, tool: 'rotate',
    size: 62, x: 0, y: 0,
    frameOn: true, weight: 12, frameRatio: 'fill', frameW: 100, frameH: 100,
    square: true, proportion: 2.91,
    field: '#ff4133', ink: '#0c1115', background: true,
    corner: 22,
    format: 'svg'
  };

  var STORE = 'play.depth.xyz';
  var state = load();

  function load() {
    var s = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var saved = JSON.parse(localStorage.getItem(STORE));
      if (saved && typeof saved === 'object') {
        for (var k in DEFAULTS) if (k in saved) s[k] = saved[k];
        if (typeof s.format !== 'string') s.format = DEFAULTS.format;
      }
    } catch (e) {}
    return s;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }

  /* ------------------------------------------------------------ geometry -- */

  /* The axes are a 3D artist's: X to the right, Y up, Z toward you, right-
     handed. Rotation is Euler XYZ, as Blender and Cinema 4D's default read it:
     X first, then Y, then Z, each about the world axis. The camera sits on +Z
     `f` d-units away; depth 0 is no camera at all — a parallel view. */
  function focal(depth) { return depth > 0 ? 4200 / depth : 0; }

  function rotate(v, a) {
    var x = v[0], y = v[1], z = v[2], c, s, t;
    c = Math.cos(a.rx * R); s = Math.sin(a.rx * R); t = y * c - z * s; z = y * s + z * c; y = t;
    c = Math.cos(a.ry * R); s = Math.sin(a.ry * R); t = x * c + z * s; z = -x * s + z * c; x = t;
    c = Math.cos(a.rz * R); s = Math.sin(a.rz * R); t = x * c - y * s; y = x * s + y * c; x = t;
    return [x, y, z];
  }

  function project(p, pose, k, cx, cy) {
    var v = rotate([p[0] - D_W / 2, -(p[1] - D_H / 2), 0], pose);
    var f = focal(pose.depth);
    var w = f > 0 ? f / (f - v[2]) : 1;
    return [cx + k * v[0] * w, cy - k * v[1] * w];
  }

  /* The canvas is fixed: 402 wide (the mark's own width, so the rule is still
     12), square or at its ratio. The frame always stands off the canvas edge
     by three times its own weight. The d is sized against the canvas width — half of it at
     least, and as much more as you like, running off the edges. The canvas is
     the export's viewBox and the square every icon is cut from. */
  /* The frame's own shape, inside the canvas less three times its weight:
     Fill takes all of that room, a ratio is the largest box of that shape
     that fits, and Freeform is a width and height as shares of the room. */
  var RATIOS = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '3:2': 3 / 2, '16:9': 16 / 9, '9:16': 9 / 16, 'mark': 402 / 138 };
  function frameBox(W, H, t) {
    var aw = W - 6 * t, ah = H - 6 * t, w = aw, h = ah;
    if (state.frameRatio === 'free') {
      w = aw * Math.max(5, Math.min(100, state.frameW)) / 100;
      h = ah * Math.max(5, Math.min(100, state.frameH)) / 100;
    } else if (RATIOS[state.frameRatio]) {
      var r = RATIOS[state.frameRatio];
      w = Math.min(aw, ah * r); h = w / r;
    }
    return { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
  }

  function composition() {
    var W = FRAME_W, H = state.square ? W : W / Math.max(0.5, state.proportion);
    // Keep a frame whose inset would swallow it at least a tenth of the canvas.
    var t = state.frameOn ? Math.max(0, Math.min(state.weight, Math.min(W, H) * 0.9 / 8)) : 0;
    var fr = frameBox(W, H, t);
    var k = (Math.max(50, state.size) / 100) * W / D_W;
    var cx = W / 2 + (state.x / 100) * W;
    var cy = H / 2 - (state.y / 100) * H;   // Y up, like the rotation
    var pts = dShape(state.dWeight).map(function (p) { return project(p, state, k, cx, cy); });
    return { frame: fr, t: t, pts: pts, box: { x: 0, y: 0, w: W, h: H }, cx: cx, cy: cy };
  }

  function n(v) { return String(Math.round(v * 1000) / 1000); }

  function polyPath(pts) {
    return 'M' + pts.map(function (p) { return n(p[0]) + ' ' + n(p[1]); }).join('L') + 'Z';
  }

  /* Outer rect, then the inner one: even-odd leaves the rule. */
  function frameRects(fr, t) {
    if (t <= 0) return [];
    return [[fr.x, fr.y, fr.x + fr.w, fr.y + fr.h], [fr.x + t, fr.y + t, fr.x + fr.w - t, fr.y + fr.h - t]];
  }
  function framePath(fr, t) { return rectsPath(frameRects(fr, t)); }

  /* The export. The frame and the d are separate paths in the one ink — a
     single path would cut the frame wherever the d's counter crossed it. */
  function markSVG(opts) {
    var c = composition(), b = c.box;
    var w = opts && opts.width ? opts.width : Math.round(b.w);
    var h = Math.round(w * b.h / b.w);
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      [n(b.x), n(b.y), n(b.w), n(b.h)].join(' ') + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="depthcore">';
    if (state.background) out += '<rect x="' + n(b.x) + '" y="' + n(b.y) + '" width="' + n(b.w) + '" height="' + n(b.h) + '" fill="' + state.field + '"/>';
    out += '<g fill="' + state.ink + '">';
    if (c.t > 0) out += '<path fill-rule="evenodd" d="' + framePath(c.frame, c.t) + '"/>';
    out += '<path d="' + polyPath(c.pts) + '"/>';
    out += '</g></svg>';
    return { svg: out, w: w, h: h };
  }

  /* ---------------------------------------------------------------- icons -- */
  /* Every icon is the composition itself — frame, pose, size — scaled into
     a square of `size` pixels. When the d lies flat and square to the grid
     (X and Y at 0, Z a multiple of 90°) every edge is snapped to a
     whole pixel: each run between two edges is rounded on its own, with a
     floor of one pixel, so the d's two 6-unit rules come out the same width
     as each other, the slit stays open at 16, and the whole set is then
     re-centred. Turned, there is no grid to sit on, and it is drawn smooth. */

  function axisAligned() {
    var q = ((state.rz % 90) + 90) % 90;
    return state.rx === 0 && state.ry === 0 && (q < 1e-9 || 90 - q < 1e-9);
  }

  function snapAxis(values) {
    var v = values.slice().sort(function (a, b) { return a - b; });
    var stops = [];
    v.forEach(function (x) { if (!stops.length || x - stops[stops.length - 1] > 1e-4) stops.push(x); });
    // Round each run, then give what rounding lost or gained overall to the
    // widest run — the d's counter, usually — so the rules keep their width
    // and the whole still spans what it spanned.
    var runs = [], widest = 0;
    for (var i = 1; i < stops.length; i++) {
      runs.push(Math.max(1, Math.round(stops[i] - stops[i - 1])));
      if (stops[i] - stops[i - 1] > stops[widest + 1] - stops[widest]) widest = i - 1;
    }
    var span = Math.round(stops[stops.length - 1]) - Math.round(stops[0]);
    var sum = runs.reduce(function (a, r) { return a + r; }, 0);
    if (runs.length) runs[widest] = Math.max(1, runs[widest] + span - sum);
    var out = [Math.round(stops[0])];
    runs.forEach(function (r) { out.push(out[out.length - 1] + r); });
    var shift = Math.round((stops[0] + stops[stops.length - 1]) / 2 - (out[0] + out[out.length - 1]) / 2);
    return function (x) {
      var best = 0;
      for (var i = 1; i < stops.length; i++) if (Math.abs(stops[i] - x) < Math.abs(stops[best] - x)) best = i;
      return out[best] + shift;
    };
  }

  function iconGeom(size, inset) {
    var c = composition(), b = c.box, fr = c.frame, t = c.t;
    var k = size * (1 - 2 * (inset || 0)) / Math.max(b.w, b.h);
    var ox = (size - b.w * k) / 2 - b.x * k, oy = (size - b.h * k) / 2 - b.y * k;
    var rects = frameRects(fr, t);
    var pts = c.pts.map(function (p) { return [ox + p[0] * k, oy + p[1] * k]; });
    rects = rects.map(function (r) { return [ox + r[0] * k, oy + r[1] * k, ox + r[2] * k, oy + r[3] * k]; });
    var snapped = axisAligned();
    if (snapped) {
      var xs = [], ys = [];
      pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
      rects.forEach(function (r) { xs.push(r[0], r[2]); ys.push(r[1], r[3]); });
      var sx = snapAxis(xs), sy = snapAxis(ys);
      pts = pts.map(function (p) { return [sx(p[0]), sy(p[1])]; });
      rects = rects.map(function (r) { return [sx(r[0]), sy(r[1]), sx(r[2]), sy(r[3])]; });
    }
    return { pts: pts, rects: rects, snapped: snapped };
  }

  function rectsPath(rects) {
    return rects.map(function (r) {
      return 'M' + n(r[0]) + ' ' + n(r[1]) + 'H' + n(r[2]) + 'V' + n(r[3]) + 'H' + n(r[0]) + 'Z';
    }).join('');
  }

  /* `rounded` is for the favicon; the app icons are full-bleed squares
     because iOS, Android and Discord all cut their own shape. */
  function drawIcon(canvas, size, rounded, inset) {
    canvas.width = size; canvas.height = size;
    var g = canvas.getContext('2d');
    g.clearRect(0, 0, size, size);
    if (state.background) {
      var r = rounded ? size * state.corner / 100 : 0;
      g.fillStyle = state.field;
      g.beginPath();
      if (r > 0 && g.roundRect) g.roundRect(0, 0, size, size, r);
      else g.rect(0, 0, size, size);
      g.fill();
    }
    var d = iconGeom(size, inset);
    g.fillStyle = state.ink;
    if (d.rects.length) g.fill(new Path2D(rectsPath(d.rects)), 'evenodd');
    g.fill(new Path2D(polyPath(d.pts)));
    return canvas;
  }

  /* favicon.svg on a 32 grid: whole pixels at 32, and at 16 on a 2× screen. */
  function faviconSVG() {
    var N = 32, d = iconGeom(N), r = N * state.corner / 100;
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">';
    if (state.background) out += '<rect width="32" height="32" rx="' + n(r) + '" fill="' + state.field + '"/>';
    out += '<g fill="' + state.ink + '">';
    if (d.rects.length) out += '<path fill-rule="evenodd" d="' + rectsPath(d.rects) + '"/>';
    return out + '<path d="' + polyPath(d.pts) + '"/></g></svg>';
  }

  /* ------------------------------------------------------------ packaging -- */

  function toBlob(canvas) {
    return new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
  }
  function bytes(blob) {
    return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function iconPNG(size, rounded, inset) {
    return toBlob(drawIcon(document.createElement('canvas'), size, rounded, inset)).then(bytes);
  }

  /* An .ico is a directory of PNGs; every browser since IE has read it. */
  function ico(pngs) {
    var head = 6 + 16 * pngs.length, total = head;
    pngs.forEach(function (p) { total += p.data.length; });
    var out = new Uint8Array(total), v = new DataView(out.buffer), off = head;
    v.setUint16(2, 1, true); v.setUint16(4, pngs.length, true);
    pngs.forEach(function (p, i) {
      var e = 6 + 16 * i;
      out[e] = p.size >= 256 ? 0 : p.size; out[e + 1] = p.size >= 256 ? 0 : p.size;
      v.setUint16(e + 4, 1, true); v.setUint16(e + 6, 32, true);
      v.setUint32(e + 8, p.data.length, true); v.setUint32(e + 12, off, true);
      out.set(p.data, off); off += p.data.length;
    });
    return out;
  }

  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) { var c = i; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
    return t;
  })();
  function crc32(a) {
    var c = 0xffffffff;
    for (var i = 0; i < a.length; i++) c = CRC[(c ^ a[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* A stored zip — PNGs are already compressed, so there is nothing to gain
     from deflate, and nothing to load for it. */
  function zip(files) {
    var enc = new TextEncoder(), parts = [], dir = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = f.data, crc = crc32(data);
      var h = new Uint8Array(30 + name.length), v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true);
      v.setUint16(10, 0, true); v.setUint16(12, 0x5b21, true);
      v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true); h.set(name, 30);
      var c = new Uint8Array(46 + name.length), w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true);
      w.setUint16(14, 0x5b21, true);
      w.setUint32(16, crc, true); w.setUint32(20, data.length, true); w.setUint32(24, data.length, true);
      w.setUint16(28, name.length, true); w.setUint32(42, off, true); c.set(name, 46);
      parts.push(h, data); dir.push(c); off += h.length + data.length;
    });
    var size = 0; dir.forEach(function (c) { size += c.length; });
    var end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(dir, [end]), { type: 'application/zip' });
  }

  var HEAD = [
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">', ''
  ].join('\n');

  function manifest() {
    return JSON.stringify({
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      theme_color: state.field, background_color: state.field
    }, null, 2) + '\n';
  }

  function iconSet() {
    var enc = new TextEncoder();
    var want = [
      ['favicon-16.png', 16, true], ['favicon-32.png', 32, true], ['favicon-48.png', 48, true],
      ['apple-touch-icon.png', 180, false], ['icon-192.png', 192, false], ['icon-512.png', 512, false],
      // Maskable icons are cut to a circle 80% wide; set the art inside it.
      ['icon-maskable-512.png', 512, false, 0.12]
    ];
    return Promise.all(want.map(function (w) { return iconPNG(w[1], w[2], w[3]); })).then(function (pngs) {
      var files = want.map(function (w, i) { return { name: w[0], data: pngs[i] }; });
      files.unshift({ name: 'favicon.ico', data: ico([{ size: 16, data: pngs[0] }, { size: 32, data: pngs[1] }, { size: 48, data: pngs[2] }]) });
      files.push({ name: 'favicon.svg', data: enc.encode(faviconSVG()) });
      files.push({ name: 'site.webmanifest', data: enc.encode(manifest()) });
      files.push({ name: 'head.html', data: enc.encode(HEAD) });
      return zip(files);
    });
  }

  function markPNG(width) {
    var m = markSVG({ width: width });
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([m.svg], { type: 'image/svg+xml' }));
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = m.w; c.height = m.h;
        c.getContext('2d').drawImage(img, 0, 0, m.w, m.h);
        URL.revokeObjectURL(url);
        c.toBlob(res, 'image/png');
      };
      img.onerror = rej;
      img.src = url;
    });
  }

  function save_(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function exportNow() {
    var f = state.format;
    if (f === 'svg') return save_(new Blob([markSVG().svg], { type: 'image/svg+xml' }), 'depthcore-d.svg');
    if (f === 'png-2048' || f === 'png-4096') {
      var w = f === 'png-4096' ? 4096 : 2048;
      return markPNG(w).then(function (b) { save_(b, 'depthcore-d-' + w + '.png'); });
    }
    if (f === 'favicon-svg') return save_(new Blob([faviconSVG()], { type: 'image/svg+xml' }), 'favicon.svg');
    if (f === 'ico') {
      return Promise.all([iconPNG(16, true), iconPNG(32, true), iconPNG(48, true)]).then(function (p) {
        save_(new Blob([ico([{ size: 16, data: p[0] }, { size: 32, data: p[1] }, { size: 48, data: p[2] }])], { type: 'image/x-icon' }), 'favicon.ico');
      });
    }
    return iconSet().then(function (b) { save_(b, 'depthcore-icons.zip'); });
  }

  /* ---------------------------------------------------------------- paint -- */

  var svg = $('mark'), fieldEl = $('mark-field'), frameEl = $('mark-frame'), dEl = $('mark-d');
  var markBox = $('mark-box');

  function paintMark() {
    var c = composition(), b = c.box;
    svg.setAttribute('viewBox', [n(b.x), n(b.y), n(b.w), n(b.h)].join(' '));
    fieldEl.setAttribute('x', n(b.x)); fieldEl.setAttribute('y', n(b.y));
    fieldEl.setAttribute('width', n(b.w)); fieldEl.setAttribute('height', n(b.h));
    fieldEl.setAttribute('fill', state.field);
    frameEl.setAttribute('d', framePath(c.frame, c.t));
    dEl.setAttribute('d', polyPath(c.pts));
    frameEl.setAttribute('fill', state.ink);
    dEl.setAttribute('fill', state.ink);
    markBox.style.setProperty('--aspect', String(b.w / b.h));
    markBox.classList.toggle('is-bare', !state.background);
    paintGimbal(c);
    return b;
  }

  /* ----------------------------------------------------------- the gimbal -- */
  /* Blender's rotate gizmo in Gimbal orientation: one ring per Euler angle,
     each about the axis that angle actually turns around. For XYZ that is Z
     about the world, Y about Z's result, and X about both — so the X ring
     follows the d and the Z ring never moves. Red, green, blue, as every 3D
     package draws them; the half of each ring behind the d is faint. Grab a
     ring and drag along it to turn that one angle. The gimbal is the page's,
     never the export's. */

  var AXES = [
    { key: 'rx', colour: '#ff3352' },
    { key: 'ry', colour: '#8bdc00' },
    { key: 'rz', colour: '#2890ff' }
  ];
  var gimbalEl = $('gimbal');
  var MOVE = [
    { key: 'x', colour: '#ff3352', dir: [1, 0] },
    { key: 'y', colour: '#8bdc00', dir: [0, -1] }
  ];

  function gimbalAxes() {
    var z = [0, 0, 1];
    var y = rotate([0, 1, 0], { rx: 0, ry: 0, rz: state.rz });
    var x = rotate([1, 0, 0], { rx: 0, ry: state.ry, rz: state.rz });
    return [x, y, z];
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function ringBasis(a) {
    var u = unit(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    return [u, cross(a, u)];
  }

  var gimbalGeom = null;
  function paintGimbal(c) {
    gimbalEl.style.display = state.gimbal ? '' : 'none';
    if (!state.gimbal) return;
    if (state.tool === 'move') return paintMove(c);
    var r = Math.min(c.box.w, c.box.h) * 0.3;
    var axes = gimbalAxes(), out = '';
    gimbalGeom = { cx: c.cx, cy: c.cy, r: r, axes: axes };
    axes.forEach(function (a, i) {
      var uv = ringBasis(a), front = '', back = '';
      for (var j = 0; j < 72; j++) {
        var t0 = j / 72 * 2 * Math.PI, t1 = (j + 1) / 72 * 2 * Math.PI;
        var p0 = ringPoint(uv, r, t0), p1 = ringPoint(uv, r, t1);
        var seg = 'M' + n(c.cx + p0[0]) + ' ' + n(c.cy - p0[1]) + 'L' + n(c.cx + p1[0]) + ' ' + n(c.cy - p1[1]);
        if (p0[2] + p1[2] >= 0) front += seg; else back += seg;
      }
      var all = front + back;
      out += '<g data-axis="' + i + '" style="--axis:' + AXES[i].colour + '">' +
        '<path class="gimbal__back" d="' + back + '"/>' +
        '<path class="gimbal__halo" d="' + front + '"/>' +
        '<path class="gimbal__ring" d="' + front + '"/>' +
        '<path class="gimbal__hit" d="' + all + '"/></g>';
    });
    gimbalEl.innerHTML = out;
  }
  /* Cinema 4D's move gizmo, seen from the front: an X arrow, a Y arrow and
     the XY plane handle between them. Z would point straight at you — there
     is nothing to grab — so the d's distance is Perspective and Size. */
  function paintMove(c) {
    var L = Math.min(c.box.w, c.box.h) * 0.26, out = '';
    var head = L * 0.16, wing = L * 0.07, q = L * 0.3;
    gimbalGeom = { cx: c.cx, cy: c.cy, r: L };
    out += '<g data-handle="xy" style="--axis:#2890ff">' +
      '<path class="gimbal__plane" d="M' + n(c.cx) + ' ' + n(c.cy) + 'h' + n(q) + 'v' + n(-q) + 'h' + n(-q) + 'Z"/>' +
      '<path class="gimbal__hit gimbal__hit--fill" d="M' + n(c.cx) + ' ' + n(c.cy) + 'h' + n(q) + 'v' + n(-q) + 'h' + n(-q) + 'Z"/></g>';
    MOVE.forEach(function (m) {
      var ex = c.cx + m.dir[0] * L, ey = c.cy + m.dir[1] * L;
      var bx = c.cx + m.dir[0] * (L - head), by = c.cy + m.dir[1] * (L - head);
      var px = -m.dir[1] * wing, py = m.dir[0] * wing;
      var shaft = 'M' + n(c.cx) + ' ' + n(c.cy) + 'L' + n(bx) + ' ' + n(by);
      var tip = 'M' + n(ex) + ' ' + n(ey) + 'L' + n(bx + px) + ' ' + n(by + py) + 'L' + n(bx - px) + ' ' + n(by - py) + 'Z';
      out += '<g data-handle="' + m.key + '" style="--axis:' + m.colour + '">' +
        '<path class="gimbal__halo" d="' + shaft + '"/>' +
        '<path class="gimbal__ring" d="' + shaft + '"/>' +
        '<path class="gimbal__tip" d="' + tip + '"/>' +
        '<path class="gimbal__hit" d="' + shaft + tip + '"/></g>';
    });
    gimbalEl.innerHTML = out;
  }

  function ringPoint(uv, r, t) {
    var u = uv[0], v = uv[1], c = Math.cos(t) * r, s = Math.sin(t) * r;
    return [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
  }

  /* Where on ring `i` the pointer landed, and which way that angle moves the
     ring there, in canvas units on screen. */
  function ringTangent(i, px, py) {
    var g = gimbalGeom, a = g.axes[i], uv = ringBasis(a), best = null;
    for (var j = 0; j < 72; j++) {
      var p = ringPoint(uv, g.r, j / 72 * 2 * Math.PI);
      var d = Math.hypot(g.cx + p[0] - px, g.cy - p[1] - py) - (p[2] >= 0 ? 0.01 : 0);
      if (!best || d < best.d) best = { d: d, p: p };
    }
    var t = cross(a, best.p);
    return [t[0], -t[1]];
  }

  /* The icons are drawn at the pixels a screen will actually show them at:
     a 16px favicon on a 2× display is the 32px image, so that is what is drawn,
     and the magnified tiles show the 16 and 32 pixel grids themselves. */
  function paintIcons() {
    var dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    document.querySelectorAll('canvas[data-icon]').forEach(function (cv) {
      if (!cv.offsetParent) return;
      var css = Number(cv.getAttribute('data-icon'));
      var px = cv.hasAttribute('data-px') ? Number(cv.getAttribute('data-px')) : css * dpr;
      drawIcon(cv, px, cv.getAttribute('data-shape') === 'favicon');
    });
  }

  var readout = $('readout-main');

  function paint() {
    var m = markSVG();
    readout.textContent = m.w + ' × ' + m.h + ' · ' + (axisAligned() ? 'pixel-snapped' : 'smooth');
    paintMark();
    paintIcons();
    fmt.value = state.format;
    var opt = fmt.options[fmt.selectedIndex];
    fmtLabel.textContent = opt ? opt.textContent : 'SVG';
  }

  /* The export selector belongs to the verb beside it. */
  var fmt = $('format'), fmtLabel = $('format-label');

  /* --------------------------------------------------------------- inputs -- */

  var NUM = ['rx', 'ry', 'rz', 'depth', 'size', 'dWeight', 'x', 'y', 'proportion', 'weight', 'frameW', 'frameH', 'corner'];
  var CHECK = { background: 'background', square: 'square', frameOn: 'frame-on' };
  var INPUT_ID = { x: 'pos-x', y: 'pos-y', depth: 'perspective', frameW: 'frame-w', frameH: 'frame-h', dWeight: 'd-weight' };
  function inputFor(k) { return $(INPUT_ID[k] || k); }

  function sync() {
    document.dispatchEvent(new CustomEvent('depth:sync', { detail: snapshot() }));
  }
  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function writeInputs() {
    NUM.forEach(function (k) { var el = inputFor(k); if (el) el.value = String(state[k]); });
    $('field').value = state.field;
    $('ink').value = state.ink;
    for (var k in CHECK) $(CHECK[k]).checked = !!state[k];
    $('frame-ratio').value = state.frameRatio;
    var gb = $('show-gimbal');
    gb.classList.toggle('is-on', !!state.gimbal);
    gb.setAttribute('aria-pressed', String(!!state.gimbal));
    document.querySelectorAll('.rail [data-tool]').forEach(function (b) {
      var on = b.getAttribute('data-tool') === state.tool;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    svg.dataset.tool = state.tool;
  }

  function changed(fromPanel) {
    save();
    paint();
    if (!fromPanel) { writeInputs(); sync(); }
  }

  NUM.forEach(function (k) {
    var el = inputFor(k);
    el.addEventListener('input', function () {
      var v = Number(el.value);
      if (!isFinite(v) || v === state[k]) return;
      state[k] = v;
      changed(true);
    });
  });
  ['field', 'ink'].forEach(function (k) {
    $(k).addEventListener('input', function () {
      var v = $(k).value.toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(v) || v === state[k]) return;
      state[k] = v;
      changed(true);
    });
  });
  $('frame-ratio').addEventListener('change', function () {
    var v = $('frame-ratio').value;
    if (v === state.frameRatio) return;
    state.frameRatio = v;
    changed(true);
  });
  Object.keys(CHECK).forEach(function (k) {
    var el = $(CHECK[k]);
    el.addEventListener('change', function () {
      if (state[k] === el.checked) return;
      state[k] = el.checked;
      changed(true);
    });
  });

  fmt.addEventListener('change', function () {
    state.format = fmt.value;
    changed(false);
  });

  $('export').addEventListener('click', function () {
    var r = exportNow();
    if (r && r.catch) r.catch(function (e) { console.warn('depth: export failed', e); });
  });

  var copyLabel = $('copy-label'), copyTimer = 0;
  $('copy').addEventListener('click', function () {
    var text = /^(zip|ico|favicon-svg)$/.test(state.format) ? faviconSVG() : markSVG().svg;
    var done = function () {
      copyLabel.textContent = 'Copied';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { copyLabel.textContent = 'Copy'; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  });

  $('show-gimbal').addEventListener('click', function () {
    state.gimbal = !state.gimbal;
    changed(false);
  });

  function setTool(t) {
    if (state.tool === t && state.gimbal) return;
    state.tool = t;
    state.gimbal = true;
    changed(false);
  }
  document.querySelectorAll('.rail [data-tool]').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
  });
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    var k = e.key.toLowerCase();
    if (k === 'e') setTool('move');
    else if (k === 'r') setTool('rotate');
  });

  /* Reset puts every parameter back — position, lettermark, frame, artboard,
     colour, icon — and lays the d flat: the wordmark's own d, square to you.
     The export format, the tool in hand and whether its gizmo shows are how
     you are working, not the artwork, so they stay. */
  $('reset').addEventListener('click', function () {
    var keep = { format: state.format, tool: state.tool, gimbal: state.gimbal };
    state = JSON.parse(JSON.stringify(DEFAULTS));
    state.rx = 0; state.ry = 0; state.rz = 0;
    Object.assign(state, keep);
    changed(false);
  });

  /* -------------------------------------------------- turning it by hand -- */
  /* Two tools, on Cinema 4D's keys: E is Move, R is Rotate. Rotate: drag a
     gimbal ring to turn that one angle, or anywhere else to orbit — sideways
     is Y, up and down is X; the arrow keys do X and Y a degree at a time and
     [ ] do Z. Move: drag an arrow to move along it, the plane handle or the
     canvas to move freely; the arrow keys nudge. Shift steps by ten. Panning is still
     play.js's, on the middle button or with space held. */

  function wrap(v) { v = ((v + 180) % 360 + 360) % 360 - 180; return v === -180 ? 180 : v; }
  function round1(v) { return Math.round(v * 10) / 10; }

  // Screen pixels to canvas units.
  function toCanvas(e) {
    var m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var q = pt.matrixTransform(m);
    return [q.x, q.y];
  }

  var drag = null;
  svg.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.defaultPrevented) return;
    var ring = e.target.closest && e.target.closest('[data-axis]');
    var handle = e.target.closest && e.target.closest('[data-handle]');
    var at = toCanvas(e);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, at: at, rx: state.rx, ry: state.ry, rz: state.rz, px: state.x, py: state.y };
    if (state.tool === 'move') {
      // Off the gizmo, a drag on the canvas moves freely in XY.
      drag.handle = handle ? handle.getAttribute('data-handle') : 'xy';
      if (handle) handle.classList.add('is-active');
    } else if (ring && gimbalGeom) {
      drag.axis = Number(ring.getAttribute('data-axis'));
      drag.tangent = ringTangent(drag.axis, at[0], at[1]);
      ring.classList.add('is-active');
    }
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('is-turning');
  });
  svg.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.handle) {
      var b = composition().box, cur = toCanvas(e);
      var mx = (cur[0] - drag.at[0]) / b.w * 100, my = -(cur[1] - drag.at[1]) / b.h * 100;
      if (drag.handle !== 'y') state.x = round1(drag.px + mx);
      if (drag.handle !== 'x') state.y = round1(drag.py + my);
    } else if (drag.axis != null) {
      var now = toCanvas(e), t = drag.tangent, r = gimbalGeom.r;
      var d = [now[0] - drag.at[0], now[1] - drag.at[1]];
      // Along the ring's own direction at the grab point; a ring seen edge-on
      // has almost none, so it is floored rather than left to run away.
      var len2 = Math.max(t[0] * t[0] + t[1] * t[1], 0.09 * r * r);
      var k = AXES[drag.axis].key;
      state[k] = round1(wrap(drag[k] + (d[0] * t[0] + d[1] * t[1]) / len2 / R));
    } else {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, s = 0.4;
      state.ry = round1(wrap(drag.ry + dx * s));
      state.rx = round1(wrap(drag.rx + dy * s));
    }
    changed(false);
  });
  ['pointerup', 'pointercancel'].forEach(function (t) {
    svg.addEventListener(t, function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      svg.classList.remove('is-turning');
    });
  });
  svg.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 10 : 1, hit = true;
    if (state.tool === 'move') {
      if (e.key === 'ArrowLeft') state.x = round1(state.x - step);
      else if (e.key === 'ArrowRight') state.x = round1(state.x + step);
      else if (e.key === 'ArrowUp') state.y = round1(state.y + step);
      else if (e.key === 'ArrowDown') state.y = round1(state.y - step);
      else hit = false;
    } else if (e.key === 'ArrowLeft') state.ry = wrap(state.ry - step);
    else if (e.key === 'ArrowRight') state.ry = wrap(state.ry + step);
    else if (e.key === 'ArrowUp') state.rx = wrap(state.rx - step);
    else if (e.key === 'ArrowDown') state.rx = wrap(state.rx + step);
    else if (e.key === '[') state.rz = wrap(state.rz - step);
    else if (e.key === ']') state.rz = wrap(state.rz + step);
    else hit = false;
    if (!hit) return;
    e.preventDefault();
    changed(false);
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(paintIcons, 100);
  });

  /* ------------------------------------------------------------------ go -- */

  writeInputs();
  paint();

  window.depth = {
    state: snapshot,
    defaults: DEFAULTS,
    markSVG: function () { return markSVG().svg; },
    faviconSVG: faviconSVG,
    iconGeom: iconGeom
  };
  document.dispatchEvent(new Event('depth:ready'));
})();
