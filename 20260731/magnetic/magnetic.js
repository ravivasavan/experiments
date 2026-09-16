(() => {
  const stage = document.getElementById('stage');
  const hint = document.getElementById('hint');
  const fileInput = document.getElementById('file');
  const btnUpload = document.getElementById('btn-upload');
  const btnCamera = document.getElementById('btn-camera');
  const btnSnap = document.getElementById('btn-snap');
  const btnShuffle = document.getElementById('btn-shuffle');

  const RATIO = 3 / 4;           // portrait w:h

  /* The dials. These were constants — the numbers the feel was tuned to — and
     they still open on exactly those values; the panel just lets you push them
     off the tuning and watch what breaks.

     tiles     how many are generated before the outer ones are pruned
     gap       uniform gap between assembled windows, chrome included
     stiffness spring k. Higher snaps harder
     damping   zeta, under 1 so the springs overshoot. 1 is a dead stop
     spread    how far scatter flings them in rotation and scale */
  const cfg = { tiles: 16, gap: 12, stiffness: 170, damping: 0.78, spread: 1 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- state ----------
  let wins = [];                 // {el, screen, media, nr, rect, bez, spr, ...}
  let portrait = { w: 0, h: 0 };
  let assembled = false;
  let anchor = { x: 0, y: 0 };
  let stream = null;             // live webcam stream
  let imageURL = null;           // current image (object URL or data URL)
  let zTop = 100;

  // ---------- springs ----------
  // Underdamped springs: organic overshoot, exact convergence — the magnetise feel.
  function spring(value, stiffness, zeta) {
    const damping = 2 * zeta * Math.sqrt(stiffness);
    return { p: value, v: 0, t: value, k: stiffness, c: damping };
  }
  function step(s, dt) {
    const a = s.k * (s.t - s.p) - s.c * s.v;
    s.v += a * dt;
    s.p += s.v * dt;
  }
  const settled = s => Math.abs(s.v) < 0.01 && Math.abs(s.t - s.p) < 0.01;

  // ---------- assembled layout ----------
  // Recursive split of a portrait rect, normalized 0-1 so tiles rescale
  // with the viewport.
  function makeRects(n, W, H) {
    let rects = [{ x: 0, y: 0, w: W, h: H }];
    while (rects.length < n) {
      rects.sort((a, b) => b.w * b.h - a.w * a.h);
      const r = rects.shift();
      const f = rand(0.38, 0.62);
      if (r.w > r.h) {
        rects.push({ x: r.x, y: r.y, w: r.w * f, h: r.h },
                   { x: r.x + r.w * f, y: r.y, w: r.w * (1 - f), h: r.h });
      } else {
        rects.push({ x: r.x, y: r.y, w: r.w, h: r.h * f },
                   { x: r.x, y: r.y + r.h * f, w: r.w, h: r.h * (1 - f) });
      }
    }
    return rects.map(r => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H }));
  }

  // Drop some edge tiles so the silhouette is ragged, not a perfect
  // rectangle — corner tiles are likeliest to go, the center always stays.
  function pruneOuter(nrects) {
    const keep = nrects.filter(r => {
      const edge = r.x < 0.01 || r.y < 0.01 ||
                   r.x + r.w > 0.99 || r.y + r.h > 0.99;
      if (!edge) return true;
      const corner = Math.hypot(r.x + r.w / 2 - 0.5, r.y + r.h / 2 - 0.5);
      return Math.random() > corner * 0.95;
    });
    return keep.length >= 9 ? keep : nrects;
  }

  // outer window rect (chrome included) in composition coordinates —
  // each tile inset by GAP/2 so neighbours sit exactly GAP apart
  function px(nr) {
    return {
      x: nr.x * portrait.w + cfg.gap / 2,
      y: nr.y * portrait.h + cfg.gap / 2,
      w: nr.w * portrait.w - cfg.gap,
      h: nr.h * portrait.h - cfg.gap
    };
  }

  function portraitSize() {
    const vw = innerWidth, vh = innerHeight;
    const h = Math.min(vh * 0.72, (vw * 0.9) / RATIO);
    return { w: h * RATIO, h };
  }

  // ---------- placeholder pattern (visible alignment before any image) ----------
  function placeholder(W, H) {
    const c = document.createElement('canvas');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#10181a';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3d4e52';
    g.lineWidth = 1;
    const cx = W / 2, cy = H / 2;
    for (let r = W * 0.06; r < Math.max(W, H) * 0.75; r += W * 0.075) {
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    }
    g.beginPath();
    g.moveTo(cx, 0); g.lineTo(cx, H);
    g.moveTo(0, cy); g.lineTo(W, cy);
    g.stroke();
    return c.toDataURL('image/png');
  }

  // ---------- windows ----------
  const winW = w => w.outer.w;
  const winH = w => w.outer.h;

  function scatterPose(w) {
    const m = 24;
    return {
      x: rand(m, Math.max(m + 1, innerWidth - winW(w) - m)),
      y: rand(m + 104, Math.max(m + 105, innerHeight - winH(w) - m)),
      r: rand(-22, 22) * cfg.spread,
      s: 1 - (1 - rand(0.55, 1.0)) * cfg.spread
    };
  }

  // Per-window chrome: seamless OS-window style — borderless, just a flat
  // title bar with a close dot. Bar height is shared by the whole group;
  // radius and tone still vary per window.
  function makeChrome(barH) {
    return {
      bez: { t: barH, r: 0, b: 0, l: 0 },
      radius: pick([6, 8, 10, 12]),
      tone: pick(['', 'c1', 'c2', 'c3'])
    };
  }

  function sizeWindow(w) {
    w.outer = px(w.nr);
    // screen rect in composition coordinates: outer minus chrome
    w.scr = {
      x: w.outer.x + w.bez.l,
      y: w.outer.y + w.bez.t,
      w: w.outer.w - w.bez.l - w.bez.r,
      h: w.outer.h - w.bez.t - w.bez.b
    };
    w.el.style.width = w.outer.w + 'px';
    w.el.style.height = w.outer.h + 'px';
    const sc = w.screen.style;
    sc.left = w.bez.l + 'px';
    sc.top = w.bez.t + 'px';
    sc.width = w.scr.w + 'px';
    sc.height = w.scr.h + 'px';
    w.bar.style.height = w.bez.t + 'px';
  }

  function build() {
    wins.forEach(w => w.el.remove());
    wins = [];
    portrait = portraitSize();
    const n = Math.round(rand(cfg.tiles - 2, cfg.tiles + 2));
    const nrects = pruneOuter(makeRects(n, portrait.w, portrait.h));
    const barH = rand(17, 24); // one chrome height for the whole group
    for (const nr of nrects) {
      const chrome = makeChrome(barH);
      const el = document.createElement('div');
      el.className = 'win ' + chrome.tone;
      el.style.borderRadius = chrome.radius + 'px';
      el.style.zIndex = Math.floor(rand(1, 99));
      const screen = document.createElement('div');
      screen.className = 'screen';
      const media = document.createElement('div');
      media.className = 'media';
      screen.appendChild(media);
      const bar = document.createElement('div');
      bar.className = 'bar';
      const x = document.createElement('button');
      x.className = 'x';
      x.type = 'button';
      x.ariaLabel = 'close window';
      bar.append(x);
      el.append(screen, bar);
      stage.appendChild(el);
      const w = {
        el, screen, media, bar, nr, chrome, bez: chrome.bez,
        delayUntil: 0, forceDraw: true
      };
      x.addEventListener('pointerdown', e => e.stopPropagation());
      x.addEventListener('click', () => closeWin(w));
      sizeWindow(w);
      const p = scatterPose(w);
      /* Each window still gets its own k and zeta so the group arrives raggedly
         rather than as one block — the dial moves the centre, the jitter rides
         on top of it. */
      const k = cfg.stiffness * rand(0.82, 1.18);
      const z = Math.min(1.2, cfg.damping * rand(0.94, 1.06));
      w.spr = { x: spring(p.x, k, z), y: spring(p.y, k, z),
                r: spring(p.r, k * 1.2, 0.9), s: spring(p.s, k * 1.2, 0.9) };
      attachDrag(w);
      wins.push(w);
    }
    applyMedia();
  }

  // recompute pixel geometry after a viewport change, keeping the same tiling
  function relayout() {
    portrait = portraitSize();
    for (const w of wins) {
      w.rect = px(w.nr);
      sizeWindow(w);
    }
    applyMedia();
  }

  // size + offset each window's media so all windows sample one shared frame
  function applyMedia() {
    for (const w of wins) {
      const m = w.media;
      m.style.width = portrait.w + 'px';
      m.style.height = portrait.h + 'px';
      m.style.left = -w.scr.x + 'px';
      m.style.top = -w.scr.y + 'px';
      const v = w.screen.querySelector('video');
      if (stream) {
        let vid = v;
        if (!vid) {
          vid = document.createElement('video');
          vid.muted = true; vid.playsInline = true; vid.autoplay = true;
          vid.srcObject = stream;
          w.screen.appendChild(vid);
        }
        vid.style.width = portrait.w + 'px';
        vid.style.height = portrait.h + 'px';
        vid.style.left = -w.scr.x + 'px';
        vid.style.top = -w.scr.y + 'px';
        m.style.display = 'none';
      } else {
        if (v) v.remove();
        m.style.display = '';
        m.style.backgroundImage =
          `url("${imageURL || placeholder(portrait.w, portrait.h)}")`;
      }
    }
  }

  // ---------- magnetise / scatter ----------
  function magnetise() {
    anchor.x = (innerWidth - portrait.w) / 2;
    anchor.y = Math.max((innerHeight - portrait.h) / 2, 112);
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const now = performance.now();
    for (const w of wins) {
      const dx = (w.spr.x.p + winW(w) / 2) - cx;
      const dy = (w.spr.y.p + winH(w) / 2) - cy;
      w.delayUntil = now + Math.min(Math.hypot(dx, dy) * 0.22, 180);
      w.pending = { x: anchor.x + w.outer.x, y: anchor.y + w.outer.y, r: 0, s: 1 };
    }
    assembled = true;
  }

  function scatter() {
    const now = performance.now();
    for (const w of wins) {
      w.delayUntil = now + rand(0, 120);
      w.pending = scatterPose(w);
    }
    assembled = false;
  }

  function closeWin(w) {
    w.closing = true;
    w.pending = null;
    w.el.style.pointerEvents = 'none';
    const k = 320;
    w.spr.s.k = k;
    w.spr.s.c = 2 * 0.95 * Math.sqrt(k);
    w.spr.s.t = 0;
  }

  // ---------- render loop (fixed timestep for stable springs) ----------
  let last = performance.now(), acc = 0;
  const H_STEP = 1 / 120;
  function render() {
    const now = performance.now();
    acc += Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const w of wins) {
      if (w.pending && now >= w.delayUntil) {
        w.spr.x.t = w.pending.x; w.spr.y.t = w.pending.y;
        w.spr.r.t = w.pending.r; w.spr.s.t = w.pending.s;
        w.pending = null;
      }
    }
    while (acc >= H_STEP) {
      for (const w of wins)
        for (const key in w.spr) step(w.spr[key], H_STEP);
      acc -= H_STEP;
    }
    let removed = false;
    for (const w of wins) {
      const { x, y, r, s } = w.spr;
      if (w.closing && s.p < 0.04) {
        w.el.remove();
        w.dead = true;
        removed = true;
        continue;
      }
      // skip the style write once fully settled — keeps idle frames near-free
      if (!(settled(x) && settled(y) && settled(r) && settled(s)) || w.forceDraw) {
        w.forceDraw = false;
        if (w.closing) w.el.style.opacity = Math.max(0, s.p);
        w.el.style.transform =
          `translate3d(${x.p}px, ${y.p}px, 0) rotate(${r.p}deg) scale(${s.p})`;
      }
    }
    if (removed) {
      wins = wins.filter(w => !w.dead);
      if (!wins.length) {
        hint.textContent = 'all closed — shuffle to start over';
        hint.classList.remove('gone');
      }
    }
    requestAnimationFrame(render);
  }

  // ---------- interaction ----------
  function attachDrag(w) {
    let sx, sy, ox, oy, dragging = false, id = null;
    w.el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      id = e.pointerId;
      sx = e.clientX; sy = e.clientY;
      ox = w.spr.x.p; oy = w.spr.y.p;
      w.el.setPointerCapture(id);
      const move = e2 => {
        if (e2.pointerId !== id) return;
        const dx = e2.clientX - sx, dy = e2.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) > 6) {
          dragging = true;
          w.el.classList.add('dragging');
          w.el.style.zIndex = ++zTop;
          w.pending = null;
          w.spr.s.t = Math.min(w.spr.s.t * 1.04, 1.06);
        }
        if (dragging) {
          w.spr.x.t = ox + dx;
          w.spr.y.t = oy + dy;
        }
      };
      const up = e2 => {
        if (e2.pointerId !== id) return;
        w.el.removeEventListener('pointermove', move);
        w.el.removeEventListener('pointerup', up);
        w.el.removeEventListener('pointercancel', up);
        w.el.classList.remove('dragging');
        if (dragging) {
          // a flick keeps its momentum; the spring catches it
          w.spr.s.t = assembled ? 1 : w.spr.s.t / 1.04;
        } else {
          toggle();
        }
        dragging = false;
      };
      w.el.addEventListener('pointermove', move);
      w.el.addEventListener('pointerup', up);
      w.el.addEventListener('pointercancel', up);
    });
  }

  function toggle() {
    hint.classList.add('gone');
    assembled ? scatter() : magnetise();
  }

  stage.addEventListener('pointerup', e => {
    if (e.target === stage) toggle();
  });

  // ---------- image upload ----------
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    stopCamera();
    if (imageURL && imageURL.startsWith('blob:')) URL.revokeObjectURL(imageURL);
    imageURL = URL.createObjectURL(f);
    applyMedia();
  });

  // ---------- webcam ----------
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false
      });
      btnSnap.hidden = false;
      btnCamera.classList.add('is-on');
      btnCamera.ariaLabel = 'Stop camera';
      applyMedia();
    } catch (err) {
      hint.textContent = 'camera unavailable — ' + (err.name || err);
      hint.classList.remove('gone');
    }
  }
  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    btnSnap.hidden = true;
    btnCamera.classList.remove('is-on');
    btnCamera.ariaLabel = 'Use camera';
    applyMedia();
  }
  btnCamera.addEventListener('click', () => stream ? stopCamera() : startCamera());

  btnSnap.addEventListener('click', () => {
    const vid = stage.querySelector('video');
    if (!vid || !vid.videoWidth) return;
    // cover-crop the frame to the portrait ratio, mirrored like the preview
    const vw = vid.videoWidth, vh = vid.videoHeight;
    const outH = Math.min(vh, 1600), outW = outH * RATIO;
    const scale = Math.max(outW / vw, outH / vh);
    const c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    const g = c.getContext('2d');
    g.translate(outW, 0); g.scale(-1, 1);
    g.drawImage(vid,
      (outW - vw * scale) / 2, (outH - vh * scale) / 2,
      vw * scale, vh * scale);
    imageURL = c.toDataURL('image/jpeg', 0.92);
    stopCamera();
  });

  // ---------- shuffle / resize ----------
  btnShuffle.addEventListener('click', () => {
    hint.textContent = 'click anywhere to magnetise';
    hint.classList.add('gone');
    build();
    if (assembled) magnetise();
  });

  let resizeT;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      relayout();
      if (assembled) magnetise();
    }, 150);
  });

  build();
  requestAnimationFrame(render);

  /* What the DialKit panel talks to. A change to the tiling has to rebuild;
     gap and the spring numbers only need the geometry recomputing, and the
     springs pick the new values up on the next scatter. */
  window.magnetic = {
    getValues: () => ({ ...cfg }),
    setValues(v) {
      if (!v) return;
      const rebuild = v.tiles != null && v.tiles !== cfg.tiles;
      for (const k of ['tiles', 'gap', 'stiffness', 'damping', 'spread']) {
        if (v[k] != null) cfg[k] = v[k];
      }
      if (rebuild) build();
      else relayout();
    }
  };
})();
