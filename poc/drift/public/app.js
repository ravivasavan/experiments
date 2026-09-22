(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const field = $('field'), collection = $('collection'), viewer = $('viewer');
  const dialog = $('gallery-dialog'), dock = $('drift-dock');
  const dockHome = document.createComment('Drift dock'); dock.before(dockHome);
  let modalBackground = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = { speed: 30, size: 85, spacing: 64, resume: 3, seed: 1801 };
  const state = { ...defaults };
  let projects = [], tiles = [], period = 0, playing = !reduced.matches;
  let idleUntil = 0, held = false, lastFrame = 0, scrollPosition = 0;
  let selected = null, galleryMode = 'single', slide = 0, returnFocus = null, detailVersion = 0;
  let layoutFrame = 0, layoutWidth = 0, layoutHeight = 0, lastStatus = '', loaded = false, manual = false, keyboardMode = false;
  const offsets = new Map();
  let drag = null, suppressClick = null;
  const asset = (path) => new URL(path, new URL(window.driftBase, location.href)).href;
  const mod = (n, d) => ((n % d) + d) % d;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function random(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function sync() {
    for (const key of Object.keys(defaults)) $(key).value = state[key];
    document.dispatchEvent(new CustomEvent('drift:sync', { detail: { ...state } }));
  }
  function takeover() {
    idleUntil = performance.now() + state.resume * 1000;
    manual = true;
    scrollPosition = field.scrollTop;
  }
  function focused() {
    const el = document.activeElement;
    return el && ((keyboardMode && el.matches('.drift-tile')) || el.closest('#root'));
  }
  function isMoving(now) {
    return loaded && playing && !selected && !held && !document.hidden &&
      !focused() && now >= idleUntil;
  }
  function status(now = performance.now()) {
    const text = selected ? selected.title : !loaded ? 'Loading' : `${projects.length} studies · ${!playing ? 'Still' : isMoving(now) ? 'Drifting' : 'Browsing'}`;
    if (text !== lastStatus) { $('readout').textContent = text; lastStatus = text; }
    if (selected) {
      const filename = selected.media[slide].filename || selected.media[slide].src.split('/').at(-1);
      if ($('work-name').textContent !== filename) {
        $('work-name').textContent = filename; $('work-name').title = filename;
      }
      const count = galleryMode === 'grid' ? `${selected.media.length} images` : `${slide + 1}/${selected.media.length}`;
      if ($('work-count').textContent !== count) {
        $('work-count').textContent = count;
        $('work-count').setAttribute('aria-label', galleryMode === 'grid' ? count : `Image ${slide + 1} of ${selected.media.length}`);
      }
    }
  }
  function playbackFace() {
    const video = selected && galleryMode === 'single' && selected.media[slide].type === 'video';
    const paused = selected ? !video || $('detail-media').querySelector('video')?.paused : !playing;
    $('playback').hidden = !!selected && !video;
    const label = paused ? 'Play' : 'Pause';
    $('playback').setAttribute('aria-label', label);
    $('playback').querySelector('.tool-pill__label').textContent = label;
    $('playback').querySelector('svg').innerHTML = paused
      ? '<path d="m6 3 14 9-14 9V3Z"/>' : '<path d="M8 5v14M16 5v14"/>';
    groupDock(); normaliseGlyphs();
  }
  function groupDock() {
    let previous;
    for (const chip of dock.children) {
      chip.removeAttribute('data-dock-group-start');
      if (chip.hidden) continue;
      const group = selected ? chip.dataset.dockGroup : undefined;
      if (previous !== undefined && group !== previous) chip.setAttribute('data-dock-group-start', '');
      previous = group;
    }
  }
  function normaliseGlyphs() {
    document.querySelectorAll('.tool-pill svg').forEach((svg) => {
      if (!svg.getClientRects().length || svg.classList.contains('drift-mode-glyph')) return;
      const box = svg.getBBox(), span = Math.max(box.width, box.height);
      if (!span) return;
      const width = span * 24 / 18;
      svg.setAttribute('viewBox', `${12 - width / 2} ${12 - width / 2} ${width} ${width}`);
      svg.setAttribute('stroke-width', width / 12);
    });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      target.dataset.visible = String(isIntersecting);
      const video = target.querySelector('video');
      if (!video) return;
      if (isIntersecting && playing && !selected && !document.hidden && !reduced.matches) {
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      } else video.pause();
    });
  }, { root: field });

  function updateVideos() {
    tiles.forEach((tile) => {
      const video = tile.querySelector('video');
      if (!video) return;
      const run = tile.dataset.visible === 'true' && playing && !selected && !document.hidden && !reduced.matches;
      if (run) {
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      } else video.pause();
    });
  }

  // Sparse, seeded stations on an invisible grid. A viewport cannot intersect
  // both a card and the third card after it: no more than three at once,
  // including across the repeating seam. Irregular advances leave real air.
  function layout() {
    if (!projects.length) return;
    finishDrag(true);
    const oldProgress = period ? mod(field.scrollTop, period) / period : 0;
    const rng = random(state.seed), mobile = innerWidth <= 640;
    layoutWidth = field.clientWidth; layoutHeight = field.clientHeight;
    const cell = field.clientWidth / 24, row = 24;
    const gap = 24 + state.spacing * 0.65;
    const order = [...projects];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const placements = [];
    order.forEach((project, i) => {
      const index = Math.floor(rng() * project.media.length), media = project.media[index];
      const ratio = media.width / media.height;
      const span = Math.round((mobile ? 17 + rng() * 5 : 7 + rng() * 5) * state.size / 100);
      const width = Math.min(clamp(span * cell, mobile ? 220 : 250, field.clientWidth - 24), layoutHeight * 0.58 * ratio + 24);
      // Match the media box to its inset width so rounding clips the pixels,
      // not invisible letterboxing around an oversized contain box.
      const label = media.filename || project.title;
      const type = project.media.length > 1 ? `${project.media.length} images` : mediaType(media);
      const probe = document.createElement('div'); probe.className = 'drift-card drift-measure';
      probe.style.width = `${width}px`; probe.append(cardHeading(label, type)); collection.append(probe);
      const headingHeight = Math.ceil(probe.firstElementChild.getBoundingClientRect().height); probe.remove();
      const mediaHeight = (width - 24) / ratio;
      const height = mediaHeight + headingHeight + 12;
      const previous = placements.at(-1);
      let xs = Array.from({ length: Math.max(1, Math.floor((field.clientWidth - width - 24) / cell) + 1) }, (_, col) => col * cell + 12);
      if (previous && !mobile) {
        const separated = xs.filter(x => Math.abs(x + width / 2 - previous.x - previous.width / 2) >= field.clientWidth * 0.28);
        if (separated.length) xs = separated;
      }
      let x = xs[Math.floor(rng() * xs.length)];
      const paired = i % 4 === 1;
      if (paired) {
        const direction = previous.x + previous.width / 2 < field.clientWidth / 2 ? 1 : -1;
        x = clamp(previous.x + direction * Math.min(previous.width, width) * 0.45, 12, field.clientWidth - width - 12);
      }
      let y = previous ? previous.y + layoutHeight * (0.28 + rng() * 0.34 + state.spacing / 400) : 0;
      if (paired) y = previous.y + previous.height * 0.62;
      // Deliberate pairs overlap; unrelated neighbours still keep their space.
      for (const p of placements.slice(-3)) {
        if (paired && p === previous) continue;
        if (x < p.x + p.width + gap && x + width + gap > p.x) y = Math.max(y, p.y + p.height + gap);
      }
      if (i >= 3) y = Math.max(y, placements[i - 3].y + placements[i - 3].height + layoutHeight + 1);
      y = Math.ceil(y / row) * row;
      placements.push({ paired, project, index, media, label, type, mediaHeight, x, y, width, height });
    });
    const last = placements.at(-1);
    period = Math.ceil((last.y + last.height + gap) / row) * row;
    for (let i = 0; i < 3; i++) {
      const p = placements[placements.length - 3 + i];
      period = Math.max(period, p.y + p.height + layoutHeight + 1 - placements[i].y);
    }
    observer.disconnect();
    tiles.forEach((t) => t.querySelector('video')?.pause());
    const fragment = document.createDocumentFragment(); tiles = [];
    for (let copy = 0; copy < 3; copy++) placements.forEach((p) => {
      const tile = document.createElement('button');
      tile.className = 'drift-tile drift-card glass'; tile.type = 'button'; tile.tabIndex = copy === 1 ? 0 : -1;
      if (copy !== 1) tile.setAttribute('aria-hidden', 'true');
      tile.dataset.project = p.project.id;
      if (p.paired) tile.dataset.paired = 'true';
      tile.setAttribute('aria-label', `Open ${p.label}${p.project.media.length > 1 ? `, ${p.project.media.length} works` : ''}`);
      Object.assign(tile.style, { left: `${p.x}px`, top: `${p.y + copy * period}px`, width: `${p.width}px`, height: `${p.height}px` });
      const media = preview(p.media); media.style.height = `${p.mediaHeight}px`;
      tile.append(cardHeading(p.label, p.type), media);
      const offset = offsets.get(p.project.id);
      if (offset) tile.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      tile.addEventListener('pointerdown', startDrag);
      tile.addEventListener('lostpointercapture', () => { if (drag?.tile === tile) finishDrag(true); });
      tile.addEventListener('click', (event) => {
        if (suppressClick === tile && event.detail !== 0) { suppressClick = null; event.preventDefault(); return; }
        open(p.project, p.index, tile);
      });
      fragment.append(tile); tiles.push(tile);
    });
    collection.replaceChildren(fragment); collection.style.height = `${period * 3}px`;
    field.scrollTop = period + oldProgress * period; scrollPosition = field.scrollTop;
    tiles.forEach((tile) => observer.observe(tile));
  }
  function queueLayout() {
    cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layout);
  }
  function wrap() {
    if (!period || selected || drag) return;
    if (field.scrollTop < period) { field.scrollTop += period; scrollPosition = field.scrollTop; }
    else if (field.scrollTop >= period * 2) { field.scrollTop -= period; scrollPosition = field.scrollTop; }
    else if (manual) scrollPosition = field.scrollTop;
  }

  function moveFrame(id, offset) {
    offsets.set(id, offset);
    // Move every copy identically, so the repeating scroll retains the placement.
    for (const tile of tiles) if (tile.dataset.project === id) {
      tile.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }
  }
  function startDrag(event) {
    if (selected || drag || event.button !== 0 || !event.isPrimary) return;
    suppressClick = null;
    // Touch keeps native scrolling on the media; its header is the drag handle.
    if (event.pointerType !== 'mouse' && !event.target.closest('.drift-card-heading')) return;
    const tile = event.currentTarget, id = tile.dataset.project;
    drag = { tile, id, pointer: event.pointerId, x: event.clientX, y: event.clientY,
      scroll: field.scrollTop, offset: offsets.get(id) || { x: 0, y: 0 }, moved: false };
    tile.setPointerCapture(event.pointerId);
    event.preventDefault(); tile.focus({ preventScroll: true });
  }
  function finishDrag(cancel = false) {
    if (!drag) return;
    const previous = drag; drag = null;
    if (cancel) moveFrame(previous.id, previous.offset);
    if (previous.moved) suppressClick = previous.tile;
    previous.tile.classList.remove('is-dragging');
    if (previous.tile.hasPointerCapture(previous.pointer)) previous.tile.releasePointerCapture(previous.pointer);
    held = false; takeover();
  }
  field.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; drag.tile.classList.add('is-dragging');
    moveFrame(drag.id, { x: drag.offset.x + dx, y: drag.offset.y + dy + field.scrollTop - drag.scroll });
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => { if (drag?.pointer === event.pointerId) finishDrag(); });
  window.addEventListener('pointercancel', (event) => { if (drag?.pointer === event.pointerId) finishDrag(true); });

  function mediaType(media) { return media.type === 'video' ? 'Video' : 'Image'; }
  function cardHeading(title, type) {
    const header = document.createElement('span'); header.className = 'drift-card-heading';
    const name = document.createElement('span'); name.className = 'drift-card-title'; name.textContent = title; name.title = title;
    const badge = document.createElement('span'); badge.className = 'drift-card-type'; badge.textContent = type;
    header.append(name, badge); return header;
  }
  function preview(media, posterOnly = false) {
    const el = document.createElement(media.type === 'video' && !posterOnly ? 'video' : 'img');
    el.className = 'drift-card-media'; el.draggable = false;
    if (el.tagName === 'VIDEO') {
      el.poster = asset(media.poster); el.dataset.src = asset(media.src);
      el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.src = asset(media.type === 'video' ? media.poster : media.src);
      el.alt = ''; el.loading = 'lazy'; el.decoding = 'async';
    }
    return el;
  }
  function viewControls() {
    const grouped = selected.media.length > 1, grid = galleryMode === 'grid';
    $('detail-rail').hidden = $('gallery-mode').hidden = !grouped;
    $('gallery-mode').querySelector('svg').dataset.mode = galleryMode;
    const label = grid ? 'Switch to single view' : 'Switch to grid view';
    $('gallery-mode').setAttribute('aria-label', label); $('gallery-mode').title = label;
    $('gallery-mode').querySelector('.tool-pill__label').textContent = grid ? 'Single' : 'Grid';
    $('previous').hidden = $('next').hidden = grid || !grouped;
    document.querySelectorAll('[data-view]').forEach(button => { button.hidden = grid; });
    $('zoom-readout').hidden = grid;
    status(); playbackFace(); normaliseGlyphs();
  }
  function sizeDetail() {
    const frame = $('detail-media').firstElementChild;
    if (!frame || !selected) return;
    const m = selected.media[slide], ratio = m.width / m.height;
    const width = Math.min(innerWidth * 0.9, innerHeight * 0.86 * ratio);
    frame.style.width = `${width}px`;
    frame.querySelector('img, video').style.height = `${width / ratio}px`;
  }
  function sizeGrid() {
    if (!selected || galleryMode !== 'grid') return;
    const grid = $('group-grid'), cards = [...grid.querySelectorAll('.drift-group-card')];
    const columns = innerWidth <= 900 ? 2 : 3;
    const gap = parseFloat(getComputedStyle(grid).getPropertyValue('--drift-gallery-gap'));
    let height = clamp(innerHeight * 0.28, 140, 300);
    for (let start = 0; start < cards.length; start += columns) {
      const media = selected.media.slice(start, start + columns);
      const ratio = media.reduce((sum, m) => sum + m.width / m.height, 0);
      height = Math.min(height, (grid.clientWidth - gap * (media.length - 1)) / ratio);
    }
    const rows = [];
    for (let start = 0; start < cards.length; start += columns) {
      const row = document.createElement('div'); row.className = 'drift-group-row';
      const group = cards.slice(start, start + columns);
      const ratios = selected.media.slice(start, start + columns).map(m => m.width / m.height);
      // One height across the whole gallery; shorter rows stay centred without
      // enlarging their images. Widths still follow each source aspect ratio.
      row.style.width = `${ratios.reduce((sum, r) => sum + r, 0) * height + gap * (group.length - 1)}px`;
      row.style.height = `${height}px`;
      group.forEach((card, index) => {
        card.style.flex = `${ratios[index]} 1 0`;
        card.style.aspectRatio = ratios[index];
        row.append(card);
      });
      rows.push(row);
    }
    grid.replaceChildren(...rows);
  }
  function showGrid(focus = false) {
    detailVersion++; galleryMode = 'grid';
    $('detail-media').querySelector('video')?.pause(); $('detail-media').replaceChildren();
    document.querySelector('[data-view="fit"]').click();
    $('detail-stage').hidden = true; $('group-view').hidden = false;
    const cards = selected.media.map((media, index) => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'drift-group-card';
      card.setAttribute('aria-label', `Open ${selected.title}, ${index + 1} of ${selected.media.length}`);
      const image = preview(media, true); image.className = 'drift-expanded-media';
      card.append(image);
      card.addEventListener('click', () => { slide = index; showSlide(card.getBoundingClientRect()); $('gallery-mode').focus({ preventScroll: true }); });
      return card;
    });
    $('group-grid').replaceChildren(...cards); sizeGrid();
    viewer.setAttribute('aria-label', `${selected.title} gallery`);
    viewControls();
    if (focus) cards[slide].focus({ preventScroll: true });
  }
  function showSlide(from) {
    galleryMode = 'single';
    $('group-view').hidden = true; $('detail-stage').hidden = false;
    const media = selected.media[slide], version = ++detailVersion;
    $('detail-media').querySelector('video')?.pause();
    document.querySelector('[data-view="fit"]').click();
    const frame = document.createElement('div'); frame.className = 'drift-detail-card';
    const el = preview(media); el.loading = 'eager'; el.className = 'drift-expanded-media';
    if (media.type === 'video') {
      el.src = asset(media.full);
      el.addEventListener('play', playbackFace); el.addEventListener('pause', playbackFace);
      if (!reduced.matches) el.play().catch(() => playbackFace());
    } else {
      el.alt = media.alt || selected.title;
      const full = new Image(); full.src = asset(media.full);
      full.onload = () => { if (version === detailVersion) el.src = full.src; };
      full.onerror = () => { if (version === detailVersion) $('work-name').title = `${media.filename} (preview)`; };
    }
    frame.append(el);
    $('detail-media').replaceChildren(frame); sizeDetail();
    if (from && !reduced.matches) {
      const to = frame.getBoundingClientRect();
      frame.animate([
        { transform: `translate(${from.x + from.width / 2 - to.x - to.width / 2}px, ${from.y + from.height / 2 - to.y - to.height / 2}px) scale(${from.width / to.width})` },
        { transform: 'none' },
      ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    viewer.setAttribute('aria-label', selected.title); viewControls();
  }
  function open(project, index, tile) {
    const from = tile.getBoundingClientRect();
    selected = project; slide = index; returnFocus = tile;
    field.inert = true; viewer.hidden = false; dialog.hidden = false;
    dialog.append(dock); dialog.setAttribute('aria-label', `${project.title} gallery`);
    dock.setAttribute('aria-label', 'Gallery controls'); dock.scrollLeft = 0;
    modalBackground = [...document.body.children].filter(el => el !== dialog && el.matches('main, [data-chrome], #root')).map(el => [el, el.inert]);
    modalBackground.forEach(([el]) => { el.inert = true; });
    $('drift-readout').hidden = true;
    $('close').hidden = $('work-name').hidden = $('work-count').hidden = false;
    $('detail-rail').hidden = false;
    $('shuffle').hidden = $('reset').hidden = true;
    if (project.media.length > 1) showGrid(); else showSlide(from);
    updateVideos(); (project.media.length > 1 ? $('gallery-mode') : $('work-name')).focus({ preventScroll: true });
  }
  function close() {
    if (!selected) return;
    detailVersion++; $('detail-media').querySelector('video')?.pause();
    $('detail-media').replaceChildren(); $('group-grid').replaceChildren(); selected = null;
    viewer.hidden = true;
    modalBackground.forEach(([el, inert]) => { el.inert = inert; }); modalBackground = [];
    field.inert = false;
    dockHome.after(dock); dialog.hidden = true;
    dock.setAttribute('aria-label', 'Drift actions');
    $('detail-rail').hidden = true;
    for (const id of ['close', 'work-name', 'work-count', 'previous', 'next', 'zoom-readout']) $(id).hidden = true;
    document.querySelectorAll('[data-view]').forEach(button => { button.hidden = true; });
    $('drift-readout').hidden = false; dock.scrollLeft = 0;
    $('shuffle').hidden = $('reset').hidden = false;
    if (returnFocus?.isConnected && !returnFocus.hasAttribute('aria-hidden')) returnFocus.focus({ preventScroll: true });
    else field.focus({ preventScroll: true });
    // Return focus for keyboard users; pointer use of the collection will resume.
    takeover(); playbackFace(); status(); updateVideos();
    if (layoutWidth !== field.clientWidth || layoutHeight !== field.clientHeight) queueLayout();
  }
  function next(delta) { if (selected) { slide = mod(slide + delta, selected.media.length); showSlide(); } }

  function back() {
    if (selected?.media.length > 1 && galleryMode === 'single') showGrid(true); else close();
  }
  $('group-view').addEventListener('click', (event) => {
    if (selected && galleryMode === 'grid' && !event.target.closest('.drift-group-card')) close();
  });
  viewer.addEventListener('click', (event) => {
    if (!selected || galleryMode !== 'single' || event.target.closest('#group-view')) return;
    const bounds = $('detail-media').firstElementChild?.getBoundingClientRect();
    if (bounds && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) back();
  });
  $('close').addEventListener('click', close);
  $('gallery-mode').addEventListener('click', () => { if (galleryMode === 'grid') showSlide(); else showGrid(); });
  $('previous').addEventListener('click', () => next(-1));
  $('next').addEventListener('click', () => next(1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    const index = controls.indexOf(document.activeElement);
    if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
    }
  });
  $('playback').addEventListener('click', () => {
    if (selected) {
      const video = $('detail-media').querySelector('video');
      if (video) { if (video.paused) video.play().catch(() => {}); else video.pause(); }
    } else {
      playing = !playing; idleUntil = 0; manual = false;
      scrollPosition = field.scrollTop;
      playbackFace(); status(); updateVideos();
    }
  });
  $('shuffle').addEventListener('click', () => {
    finishDrag(true); offsets.clear();
    state.seed = 1 + crypto.getRandomValues(new Uint32Array(1))[0] % 9999;
    sync(); layout();
  });
  $('reset').addEventListener('click', () => {
    finishDrag(true); offsets.clear();
    Object.assign(state, defaults); playing = !reduced.matches; idleUntil = 0;
    sync(); layout(); playbackFace(); status(); updateVideos();
  });
  for (const key of Object.keys(defaults)) $(key).addEventListener('input', () => {
    if (key === 'seed') { finishDrag(true); offsets.clear(); }
    state[key] = Number($(key).value);
    if (['size', 'spacing', 'seed'].includes(key)) queueLayout();
  });
  field.addEventListener('wheel', () => {
    if (document.activeElement?.matches('.drift-tile')) document.activeElement.blur();
    takeover();
  }, { passive: true });
  field.addEventListener('pointerdown', () => { held = true; takeover(); });
  window.addEventListener('pointerup', () => { if (held) { held = false; takeover(); } });
  window.addEventListener('pointercancel', () => { held = false; takeover(); });
  field.addEventListener('scroll', () => {
    if (manual && performance.now() < idleUntil) idleUntil = performance.now() + state.resume * 1000;
    wrap();
  }, { passive: true });
  field.addEventListener('focusin', takeover);
  document.addEventListener('pointerdown', () => { keyboardMode = false; }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') keyboardMode = true;
    if (drag && event.key === 'Escape') { event.preventDefault(); finishDrag(true); return; }
    const tile = event.target.closest('.drift-tile');
    if (!selected && tile && event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const offset = offsets.get(tile.dataset.project) || { x: 0, y: 0 }, step = event.shiftKey ? 96 : 24;
      moveFrame(tile.dataset.project, { x: offset.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: offset.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
      takeover(); return;
    }
    if (event.target.closest('input, select, textarea, [contenteditable="true"], #root')) return;
    if (selected) {
      if (event.key === 'Escape') { event.preventDefault(); back(); }
      if (galleryMode === 'single' && event.key === 'ArrowLeft') { event.preventDefault(); next(-1); }
      if (galleryMode === 'single' && event.key === 'ArrowRight') { event.preventDefault(); next(1); }
    } else if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      if (event.target.closest('button, a')) return;
      takeover();
      if (document.activeElement !== field) {
        event.preventDefault();
        const direction = ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || event.shiftKey ? -1 : 1;
        field.scrollTop += direction * (event.key.startsWith('Arrow') ? 80 : field.clientHeight * 0.8);
      }
    }
  });
  window.addEventListener('resize', () => { if (!selected) queueLayout(); else if (galleryMode === 'single') sizeDetail(); else sizeGrid(); });
  window.addEventListener('blur', () => { finishDrag(true); held = false; });
  document.addEventListener('visibilitychange', () => { lastFrame = 0; takeover(); updateVideos(); });
  reduced.addEventListener('change', () => { if (reduced.matches) playing = false; playbackFace(); updateVideos(); });

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now;
    if (isMoving(now)) {
      manual = false;
      scrollPosition += state.speed * dt;
      field.scrollTop = scrollPosition;
      // Preserve subpixel progress on browsers with integer scroll positions.
      if (field.scrollTop >= period * 2) { field.scrollTop -= period; scrollPosition -= period; }
    }
    status(now); requestAnimationFrame(frame);
  }
  async function boot() {
    // Opaque artwork passes beneath the Tools; the shared tone mode keeps
    // the theme's glass self-sufficient without changing any palette.
    document.documentElement.dataset.chromeTone = 'mixed';
    window.drift = { state, get view() { return { period, playing, selected: selected?.id, galleryMode, slide, idleUntil }; } };
    document.dispatchEvent(new Event('drift:ready'));
    playbackFace();
    try {
      const response = await fetch(asset('media.json'));
      if (!response.ok) throw new Error('Collection unavailable');
      projects = (await response.json()).projects;
      loaded = true; layout(); requestAnimationFrame(frame);
      document.fonts.ready.then(queueLayout);
    } catch {
      $('readout').textContent = 'Collection unavailable';
      $('playback').disabled = $('shuffle').disabled = $('reset').disabled = true;
    }
  }
  if (window.driftBase) boot();
  else document.addEventListener('drift:config', boot, { once: true });
})();
