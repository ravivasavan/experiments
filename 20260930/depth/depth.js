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
  var D_W = 42;

  /* The same contour at any thickness and any ascender: the bowl stays
     42 × 24, the rules move inward, the slit keeps half a rule, and the
     ascender grows up from the bowl. At 6 and 9 it is the wordmark's own d. */
  var BOWL = 24;
  function dHeight(a) { return Math.max(3, Math.min(45, a)) + BOWL; }
  function dShape(w, a) {
    w = Math.max(1, Math.min(9, w));
    a = Math.max(3, Math.min(45, a));
    var sl = w / 2, h = a + BOWL;
    var X = { 0: 0, 6: w, 36: D_W - w, 42: D_W };
    var Y = { 0: 0, 9: a, 15: a + w, 18: a + w + sl, 27: h - w, 33: h };
    return D.map(function (p) { return [X[p[0]], Y[p[1]]]; });
  }

  /* The mark, measured. The frame is 402 wide with a 12-unit rule. */
  var FRAME_W = 402;
  /* The house composition, set by Ravi on 2026-09-30: the logomark's lean
     with a longer ascender, heavier rules and a strong camera, frameless,
     running off the canvas. The page opens on it and Reset returns to it. */
  var DEFAULTS = {
    dWeight: 8, ascender: 30, z: -2.3, rx: -52.7, ry: -31.5, rz: -19.6, depth: 100, gimbal: true, tool: 'rotate',
    size: 84, x: 9.7, y: 24.8,
    frameOn: false, weight: 11.4, frameMargin: 46.2, frameRatio: 'fill', frameW: 100, frameH: 100,
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

  /* Position Z moves the d along the camera's axis, in d-units; with no
     perspective it changes nothing. The camera never lets a point reach it. */
  function perspectiveW(z) {
    var f = focal(state.depth);
    return f > 0 ? f / Math.max(f * 0.15, f - z) : 1;
  }

  function project(p, pose, k, cx, cy) {
    // The pivot is the middle of the whole d, ascender and all.
    var v = rotate([p[0] - D_W / 2, -(p[1] - dHeight(pose.ascender) / 2), 0], pose);
    var w = perspectiveW(v[2] + (pose.z || 0));
    return [cx + k * v[0] * w, cy - k * v[1] * w];
  }

  /* ------------------------------------------------------------- matrices -- */
  /* The rotation as a matrix, R = Rz · Ry · Rx, and back to XYZ Euler. The
     gizmos turn the d about its own axes, which is a matrix product; the
     panel shows the angles that product comes to. */
  function eulerMatrix(a) {
    var x = a.rx * R, y = a.ry * R, z = a.rz * R;
    var cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    return [
      [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
      [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
      [-sy, cy * sx, cy * cx]
    ];
  }
  function matrixEuler(m) {
    var y = Math.asin(Math.max(-1, Math.min(1, -m[2][0]))), x, z;
    if (Math.abs(m[2][0]) < 0.99999) { x = Math.atan2(m[2][1], m[2][2]); z = Math.atan2(m[1][0], m[0][0]); }
    else { x = Math.atan2(-m[1][2], m[1][1]); z = 0; }
    return { rx: x / R, ry: y / R, rz: z / R };
  }
  function mul(a, b) {
    var o = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) o[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    return o;
  }
  function axisMatrix(i, t) {
    var c = Math.cos(t), s = Math.sin(t);
    if (i === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]];
    if (i === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  }
  function column(m, i) { return [m[0][i], m[1][i], m[2][i]]; }
  function setRotation(m) {
    var e = matrixEuler(m);
    state.rx = round1(e.rx); state.ry = round1(e.ry); state.rz = round1(e.rz);
  }

  /* The frame's own shape, inside the canvas less its margin (its own
     number, in the same canvas units as the weight): Fill takes all of that
     room, a ratio is the largest box of that shape that fits, and Freeform is
     a width and height as shares of the room. */
  var RATIOS = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '3:2': 3 / 2, '16:9': 16 / 9, '9:16': 9 / 16, 'mark': 402 / 138 };
  function frameBox(W, H, t) {
    var m = Math.max(0, Math.min(state.frameMargin, Math.min(W, H) / 2 - 2 * t - 1));
    var aw = W - 2 * m, ah = H - 2 * m, w = aw, h = ah;
    if (state.frameRatio === 'free') {
      w = aw * Math.max(5, Math.min(100, state.frameW)) / 100;
      h = ah * Math.max(5, Math.min(100, state.frameH)) / 100;
    } else if (RATIOS[state.frameRatio]) {
      var r = RATIOS[state.frameRatio];
      w = Math.min(aw, ah * r); h = w / r;
    }
    return { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
  }

  /* The canvas is fixed: 402 wide (the mark's own width, so the rule is still
     12), square or at its ratio. The d is sized against the canvas width —
     half of it at least, and as much more as you like, running off the edges.
     The canvas is the export's viewBox and the square every icon is cut from. */
  function composition() {
    var W = FRAME_W, H = state.square ? W : W / Math.max(0.5, state.proportion);
    // Keep a frame whose inset would swallow it at least a tenth of the canvas.
    var t = state.frameOn ? Math.max(0, Math.min(state.weight, Math.min(W, H) / 4)) : 0;
    var fr = frameBox(W, H, t);
    var k = (Math.max(50, state.size) / 100) * W / D_W;
    var cx = W / 2 + (state.x / 100) * W;
    var cy = H / 2 - (state.y / 100) * H;   // Y up, like the rotation
    var pts = dShape(state.dWeight, state.ascender).map(function (p) { return project(p, state, k, cx, cy); });
    return { frame: fr, t: t, pts: pts, box: { x: 0, y: 0, w: W, h: H }, cx: cx, cy: cy, k: k };
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
    if (f === 'json') return save_(new Blob([toJSON()], { type: 'application/json' }), 'depthcore-d.json');
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

  /* ------------------------------------------------------------ the gizmos -- */
  /* Drawn the way a 3D package draws them: on the d's own axes (Local
     orientation), through the same camera as the d, X red, Y green, Z blue.
     Rotate is a ring about each local axis plus a view ring around the lot;
     Move is a cone-tipped arrow down each local axis, a plane handle for each
     pair, and a free handle at the centre. Whatever faces away from you is
     faint and drawn first. The gizmo is the page's, never the export's. */

  var COLOURS = ['#ff3352', '#8bdc00', '#2890ff'];
  var gimbalEl = $('gimbal');
  var gizmo = null;

  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

  // A point in d-units about the d's centre, to canvas units and view depth.
  function toView(v) {
    var c = gizmo.c, z = v[2] + (state.z || 0), w = perspectiveW(z);
    return [c.cx + c.k * v[0] * w, c.cy - c.k * v[1] * w, v[2]];
  }
  function pathOf(pts, close) {
    return 'M' + pts.map(function (p) { return n(p[0]) + ' ' + n(p[1]); }).join('L') + (close ? 'Z' : '');
  }
  function hull(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var turn = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    var lo = [], hi = [];
    p.forEach(function (q) { while (lo.length > 1 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    p.slice().reverse().forEach(function (q) { while (hi.length > 1 && turn(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); });
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  function pxToCanvas() {
    var vb = svg.viewBox.baseVal;
    return vb && svg.clientWidth ? vb.width / svg.clientWidth : 1;
  }

  function paintGimbal(c) {
    gimbalEl.style.display = state.gimbal ? '' : 'none';
    if (!state.gimbal) { gizmo = null; return; }
    var M = eulerMatrix(state);
    var r = Math.min(D_W * 0.62, 0.34 * Math.min(c.box.w, c.box.h) / c.k);
    gizmo = { c: c, M: M, axes: [column(M, 0), column(M, 1), column(M, 2)], r: r };
    gimbalEl.innerHTML = state.tool === 'move' ? moveGizmo() : rotateGizmo();
  }

  function ringPoint(i, t) {
    var u = gizmo.axes[(i + 1) % 3], v = gizmo.axes[(i + 2) % 3], r = gizmo.r;
    return add(scale(u, r * Math.cos(t)), scale(v, r * Math.sin(t)));
  }

  function rotateGizmo() {
    var back = '', fronts = '', N = 96;
    for (var i = 0; i < 3; i++) {
      var f = '', all = [], wasOn = false;
      for (var j = 0; j < N; j++) {
        var p0 = ringPoint(i, j / N * 2 * Math.PI), p1 = ringPoint(i, (j + 1) / N * 2 * Math.PI);
        var s0 = toView(p0), s1 = toView(p1);
        var on = p0[2] + p1[2] >= 0;
        if (on) f += (wasOn ? '' : 'M' + n(s0[0]) + ' ' + n(s0[1])) + 'L' + n(s1[0]) + ' ' + n(s1[1]);
        wasOn = on;
        all.push(s0);
      }
      // The whole ring, softly, underneath; the half facing you, bold, on
      // top of it — so the ring never looks cut where one becomes the other.
      var loop = pathOf(all, true);
      back += '<g style="--axis:' + COLOURS[i] + '"><path class="gimbal__underhalo" d="' + loop + '"/>' +
        '<path class="gimbal__back" d="' + loop + '"/></g>';
      fronts += '<g data-axis="' + i + '" style="--axis:' + COLOURS[i] + '">' +
        '<path class="gimbal__halo gimbal__halo--butt" d="' + f + '"/><path class="gimbal__ring gimbal__ring--butt" d="' + f + '"/>' +
        '<path class="gimbal__hit" d="' + loop + '"/></g>';
    }
    var c = gizmo.c, rv = gizmo.r * c.k * perspectiveW(state.z || 0) * 1.14;
    var view = '<g data-axis="view"><circle class="gimbal__view" cx="' + n(c.cx) + '" cy="' + n(c.cy) + '" r="' + n(rv) + '"/>' +
      '<circle class="gimbal__hit" cx="' + n(c.cx) + '" cy="' + n(c.cy) + '" r="' + n(rv) + '"/></g>';
    return back + view + fronts;
  }

  function moveGizmo() {
    var L = gizmo.r, head = L * 0.22, rc = L * 0.075, parts = [];
    for (var i = 0; i < 3; i++) {
      var a = gizmo.axes[i], u = gizmo.axes[(i + 1) % 3], v = gizmo.axes[(i + 2) % 3];
      var base = scale(a, L - head), tip = toView(scale(a, L)), ring = [];
      for (var j = 0; j < 16; j++) {
        var t = j / 16 * 2 * Math.PI;
        ring.push(toView(add(base, add(scale(u, rc * Math.cos(t)), scale(v, rc * Math.sin(t))))));
      }
      var cone = hull(ring.concat([tip]));
      var shaft = pathOf([toView([0, 0, 0]), toView(base)]);
      parts.push({
        z: a[2] * L * 0.6,
        svg: '<g data-handle="axis" data-i="' + i + '" style="--axis:' + COLOURS[i] + '"' + (a[2] < -0.2 ? ' class="is-far"' : '') + '>' +
          '<path class="gimbal__halo" d="' + shaft + '"/><path class="gimbal__ring" d="' + shaft + '"/>' +
          '<path class="gimbal__tip" d="' + pathOf(cone, true) + '"/>' +
          '<path class="gimbal__hit" d="' + shaft + pathOf(cone, true) + '"/>' +
          '<path class="gimbal__hit gimbal__hit--fill" d="' + pathOf(cone, true) + '"/></g>'
      });
    }
    // Plane handles, coloured by the axis they are square to.
    [[0, 1, 2], [1, 2, 0], [0, 2, 1]].forEach(function (pl) {
      var a = gizmo.axes[pl[0]], b = gizmo.axes[pl[1]], q0 = L * 0.3, q1 = L * 0.48;
      var quad = [[q0, q0], [q1, q0], [q1, q1], [q0, q1]].map(function (q) { return add(scale(a, q[0]), scale(b, q[1])); });
      var zAvg = quad.reduce(function (s, p) { return s + p[2]; }, 0) / 4;
      var d = pathOf(quad.map(toView), true);
      parts.push({
        z: zAvg,
        svg: '<g data-handle="plane" data-i="' + pl[0] + '" data-j="' + pl[1] + '" style="--axis:' + COLOURS[pl[2]] + '">' +
          '<path class="gimbal__plane" d="' + d + '"/><path class="gimbal__hit gimbal__hit--fill" d="' + d + '"/></g>'
      });
    });
    parts.sort(function (p, q) { return p.z - q.z; });
    var c = toView([0, 0, 0]), rr = 6 * pxToCanvas();
    return parts.map(function (p) { return p.svg; }).join('') +
      '<g data-handle="free"><circle class="gimbal__free" cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="' + n(rr) + '"/>' +
      '<circle class="gimbal__hit gimbal__hit--fill" cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="' + n(rr * 1.6) + '"/></g>';
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

  var NUM = ['rx', 'ry', 'rz', 'depth', 'size', 'dWeight', 'ascender', 'z', 'x', 'y', 'proportion', 'weight', 'frameMargin', 'frameW', 'frameH', 'corner'];
  var CHECK = { background: 'background', square: 'square', frameOn: 'frame-on' };
  var INPUT_ID = { x: 'pos-x', y: 'pos-y', z: 'pos-z', depth: 'perspective', frameMargin: 'frame-margin', frameW: 'frame-w', frameH: 'frame-h', dWeight: 'd-weight', ascender: 'ascender' };
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
    var text = state.format === 'json' ? toJSON() : /^(zip|ico|favicon-svg)$/.test(state.format) ? faviconSVG() : markSVG().svg;
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

  /* Reset puts every parameter back to the house composition. The export
     format, the tool in hand and whether its gizmo shows are how you are
     working, not the artwork, so they stay. */
  $('reset').addEventListener('click', function () {
    var keep = { format: state.format, tool: state.tool, gimbal: state.gimbal };
    state = JSON.parse(JSON.stringify(DEFAULTS));
    Object.assign(state, keep);
    changed(false);
  });

  /* ------------------------------------------------------------------ json -- */
  /* The artwork as plain data: the panel's own groups and names, nothing of
     DialKit's and nothing about how you were looking at it. Import reads
     that shape, and DialKit's flat copy ("position.x": 9.7) too, so a copy
     out of the panel goes straight back in. Anything missing takes the
     house default; anything out of range is brought back into it. */

  var FIELDS = [
    ['position.x', 'x', -100, 100], ['position.y', 'y', -100, 100], ['position.z', 'z', -150, 40],
    ['rotation.x', 'rx', -180, 180], ['rotation.y', 'ry', -180, 180], ['rotation.z', 'rz', -180, 180],
    ['rotation.perspective', 'depth', 0, 100],
    ['lettermark.size', 'size', 50, 400], ['lettermark.thickness', 'dWeight', 1, 9], ['lettermark.ascender', 'ascender', 3, 45],
    ['frame.visible', 'frameOn', 'bool'], ['frame.ratio', 'frameRatio', 'ratio'],
    ['frame.width', 'frameW', 5, 100], ['frame.height', 'frameH', 5, 100],
    ['frame.weight', 'weight', 1, 40], ['frame.margin', 'frameMargin', 0, 160],
    ['artboard.square', 'square', 'bool'], ['artboard.proportion', 'proportion', 1, 4],
    ['colour.field', 'field', 'colour'], ['colour.ink', 'ink', 'colour'], ['colour.background', 'background', 'bool'],
    ['icon.corner', 'corner', 0, 50]
  ];
  var FRAME_RATIOS = ['fill', '1:1', '4:3', '3:4', '3:2', '16:9', '9:16', 'mark', 'free'];

  function toJSON() {
    var out = {};
    FIELDS.forEach(function (f) {
      var parts = f[0].split('.');
      out[parts[0]] = out[parts[0]] || {};
      out[parts[0]][parts[1]] = state[f[1]];
    });
    return JSON.stringify(out, null, 2) + '\n';
  }

  function fromJSON(text) {
    var data = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('not an object');
    var next = JSON.parse(JSON.stringify(DEFAULTS)), hits = 0;
    FIELDS.forEach(function (f) {
      var parts = f[0].split('.'), v = f[0] in data ? data[f[0]] : (data[parts[0]] || {})[parts[1]];
      if (v === undefined) return;
      if (f[2] === 'bool') { if (typeof v !== 'boolean') return; }
      else if (f[2] === 'colour') { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) return; v = v.toLowerCase(); }
      else if (f[2] === 'ratio') { if (FRAME_RATIOS.indexOf(v) < 0) return; }
      else { v = Number(v); if (!isFinite(v)) return; v = Math.max(f[2], Math.min(f[3], v)); }
      next[f[1]] = v;
      hits++;
    });
    if (!hits) throw new Error('no Depth parameters in it');
    next.format = state.format; next.tool = state.tool; next.gimbal = state.gimbal;
    state = next;
    changed(false);
  }

  var importInput = $('import-file'), importLabel = $('import-label'), importTimer = 0;
  $('import').addEventListener('click', function () { importInput.value = ''; importInput.click(); });
  importInput.addEventListener('change', function () {
    var file = importInput.files && importInput.files[0];
    if (!file) return;
    file.text().then(fromJSON).catch(function (e) {
      console.warn('depth: that file is not a Depth composition —', e.message);
      importLabel.textContent = 'Invalid';
      clearTimeout(importTimer);
      importTimer = setTimeout(function () { importLabel.textContent = 'Import'; }, 1600);
    });
  });

  /* -------------------------------------------------- turning it by hand -- */
  /* Two tools, on Cinema 4D's keys: E is Move, R is Rotate.
     Rotate: drag a ring to turn the d about that one local axis, the outer
     ring to roll it about your line of sight, or anywhere else to orbit it
     (sideways about the view's Y, up and down about its X). The arrow keys
     and [ ] step the X, Y and Z angles.
     Move: drag an arrow to slide along that local axis, a plane handle to
     slide in that plane, the centre or the canvas to move in the picture
     plane; the arrow keys nudge. Shift steps by ten. Panning is still
     play.js's, on the middle button or with space held. */

  function wrap(v) { v = ((v + 180) % 360 + 360) % 360 - 180; return v === -180 ? 180 : v; }
  function round1(v) { return Math.round(v * 10) / 10; }
  var Z_MIN = -150, Z_MAX = 40;

  // Screen pixels to canvas units.
  function toCanvas(e) {
    var m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var q = pt.matrixTransform(m);
    return [q.x, q.y];
  }
  function dot2(a, b) { return a[0] * b[0] + a[1] * b[1]; }

  // How far one d-unit along `a` moves on screen, in canvas units.
  function screenStep(a, c, w) { return [c.k * w * a[0], -c.k * w * a[1]]; }

  var drag = null;
  svg.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.defaultPrevented) return;
    var g = e.target.closest && e.target.closest('[data-axis], [data-handle]');
    var c = composition();
    drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY, at: toCanvas(e),
      M: eulerMatrix(state), c: c, w: perspectiveW(state.z || 0),
      px: state.x, py: state.y, pz: state.z || 0,
      axes: gizmo ? gizmo.axes : null, r: gizmo ? gizmo.r : 0
    };
    if (state.tool === 'move') {
      drag.kind = g && g.hasAttribute('data-handle') ? g.getAttribute('data-handle') : 'free';
      if (g && drag.kind !== 'free') {
        drag.i = Number(g.getAttribute('data-i'));
        if (g.hasAttribute('data-j')) drag.j = Number(g.getAttribute('data-j'));
      }
    } else if (g && g.hasAttribute('data-axis') && gizmo) {
      var ax = g.getAttribute('data-axis');
      if (ax === 'view') {
        drag.kind = 'roll';
        drag.a0 = Math.atan2(-(drag.at[1] - c.cy), drag.at[0] - c.cx);
      } else {
        drag.kind = 'ring';
        drag.i = Number(ax);
        // Where on the ring the pointer landed, and which way the ring runs
        // there on screen, per radian.
        var best = null;
        for (var j = 0; j < 96; j++) {
          var t = j / 96 * 2 * Math.PI, p = ringPoint(drag.i, t), sp = toView(p);
          var d = Math.hypot(sp[0] - drag.at[0], sp[1] - drag.at[1]) - (p[2] >= 0 ? 0.5 : 0);
          if (!best || d < best.d) best = { d: d, t: t };
        }
        var s0 = toView(ringPoint(drag.i, best.t)), s1 = toView(ringPoint(drag.i, best.t + 0.01));
        drag.tangent = [(s1[0] - s0[0]) / 0.01, (s1[1] - s0[1]) / 0.01];
      }
    } else {
      drag.kind = 'orbit';
    }
    if (g) g.classList.add('is-active');
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('is-turning');
  });

  svg.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var now = toCanvas(e), d = [now[0] - drag.at[0], now[1] - drag.at[1]];
    var c = drag.c, b = c.box, unitPx = c.k * drag.w, delta = null;
    if (drag.kind === 'free') {
      state.x = round1(drag.px + d[0] / b.w * 100);
      state.y = round1(drag.py - d[1] / b.h * 100);
    } else if (drag.kind === 'axis') {
      var a = drag.axes[drag.i], s = screenStep(a, c, drag.w);
      // An arrow pointing at you has almost no length on screen; floor it so
      // a drag along it still moves at a sane rate.
      var len2 = Math.max(dot2(s, s), 0.09 * unitPx * unitPx);
      delta = scale(a, dot2(d, s) / len2);
    } else if (drag.kind === 'plane') {
      var ai = drag.axes[drag.i], aj = drag.axes[drag.j];
      var si = screenStep(ai, c, drag.w), sj = screenStep(aj, c, drag.w);
      var det = si[0] * sj[1] - si[1] * sj[0], u, v;
      if (Math.abs(det) > 0.05 * unitPx * unitPx) {
        u = (d[0] * sj[1] - d[1] * sj[0]) / det;
        v = (si[0] * d[1] - si[1] * d[0]) / det;
      } else {
        u = dot2(d, si) / Math.max(dot2(si, si), 0.09 * unitPx * unitPx);
        v = dot2(d, sj) / Math.max(dot2(sj, sj), 0.09 * unitPx * unitPx);
      }
      delta = add(scale(ai, u), scale(aj, v));
    } else if (drag.kind === 'ring') {
      var t = drag.tangent, fl = 0.3 * drag.r * unitPx;
      var phi = dot2(d, t) / Math.max(dot2(t, t), fl * fl);
      setRotation(mul(drag.M, axisMatrix(drag.i, phi)));
    } else if (drag.kind === 'roll') {
      var a1 = Math.atan2(-(now[1] - c.cy), now[0] - c.cx);
      setRotation(mul(axisMatrix(2, a1 - drag.a0), drag.M));
    } else {
      var k = 0.4 * R;
      setRotation(mul(mul(axisMatrix(1, (e.clientX - drag.x) * k), axisMatrix(0, (e.clientY - drag.y) * k)), drag.M));
    }
    if (delta) {
      state.x = round1(drag.px + delta[0] * unitPx / b.w * 100);
      state.y = round1(drag.py + delta[1] * unitPx / b.h * 100);
      state.z = round1(Math.max(Z_MIN, Math.min(Z_MAX, drag.pz + delta[2])));
    }
    changed(false);
  });
  ['pointerup', 'pointercancel'].forEach(function (t) {
    svg.addEventListener(t, function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      svg.classList.remove('is-turning');
      gimbalEl.querySelectorAll('.is-active').forEach(function (g) { g.classList.remove('is-active'); });
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

  /* ------------------------------------------------------------ randomise -- */
  /* A throw that lands near something finished, for you to take the last
     mile. The ranges are the logomark's neighbourhood: mostly the d laid back
     like the mark, sometimes nearly face-on, never edge-on (its face keeps at
     least a third of its area toward you). The d is then scaled against the
     frame — free to run past it — or the canvas, and centred, give or take a
     little. Thickness stays near the wordmark's, the frame stays a plain
     rule. Colour, the artboard and the icon corner are yours and are left. */

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randomise() {
    var keep = JSON.parse(JSON.stringify(state)), best = null;
    for (var tries = 0; tries < 60 && !best; tries++) {
      var face = Math.random() < 0.22;
      var c = JSON.parse(JSON.stringify(keep));
      c.rx = face ? rand(-24, 20) : rand(-68, -40);
      c.ry = face ? rand(-30, 30) : rand(-34, 34);
      c.rz = face ? rand(-12, 12) : rand(-32, 32);
      c.depth = rand(45, 85);
      c.z = 0;
      c.dWeight = rand(5, 7.5);
      c.frameOn = Math.random() < 0.85;
      c.weight = rand(8, 16);
      c.frameMargin = rand(24, 52);
      c.frameRatio = keep.square && Math.random() < 0.25 ? (Math.random() < 0.5 ? '4:3' : '3:4') : 'fill';
      var normalZ = eulerMatrix(c)[2][2];
      if (normalZ < 0.33 || (!face && normalZ > 0.85)) continue;
      // Fit: size is linear in the projection, so measure once and scale.
      c.size = 62; c.x = 0; c.y = 0;
      state = c;
      // Fit against the inside of the frame when there is one, and let the
      // lettermark run past it — the mark's tail does — or against the
      // canvas when there is none.
      var comp = composition(), box = comp.box, bx = bounds(comp.pts), fr = comp.frame, t = comp.t;
      var room = c.frameOn ? { w: fr.w - 2 * t, h: fr.h - 2 * t } : box;
      var fill = Math.max(bx.w / room.w, bx.h / room.h);
      var target = !c.frameOn ? rand(0.66, 0.88) : face ? rand(0.7, 1.1) : rand(0.85, 1.2);
      var size = 62 * target / fill;
      if (size < 50 || size > 180) continue;
      c.size = size;
      comp = composition(); bx = bounds(comp.pts);
      c.x = -((bx.x + bx.w / 2) - box.w / 2) / box.w * 100 + rand(-3, 3);
      c.y = ((bx.y + bx.h / 2) - box.h / 2) / box.h * 100 + rand(-3, 3);
      best = c;
    }
    state = best || keep;
    ['rx', 'ry', 'rz', 'depth', 'size', 'x', 'y', 'dWeight', 'weight', 'frameMargin'].forEach(function (k) { state[k] = round1(state[k]); });
    changed(false);
  }
  function bounds(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  $('shuffle').addEventListener('click', randomise);

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
    toJSON: toJSON,
    fromJSON: fromJSON,
    iconGeom: iconGeom
  };
  document.dispatchEvent(new Event('depth:ready'));
})();
