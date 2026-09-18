/* play.ravivasavan.com — the shared behaviour.
   Three things every page needs and none of them owns: the rail and the dock's
   sideways drag, and panning
   the stage out from under the glass. Nothing here knows what any experiment
   does.

   The theme is not here. The theme cycle, the theme-color meta and circadian.js
   all belong to the shared chrome package
   (https://ravivasavan.com/chrome/v1/chrome.js, window.rvChrome) — see
   ../../ravi/chrome/README.md. A page carries the FOUC script in its head and
   the chrome script tag at the end of its body; this file touches neither.

   Classic script, loaded with defer, before the page's own scripts. */
(function () {
  'use strict';

  var html = document.documentElement;

  /* ---------------------------------------------------------------- dials -- */
  /* WebKit draws no progress on a range, so .dial paints its filled half with a
     gradient sized by --dial-fill. Keeping that in step is chrome, not content,
     so it lives here rather than in five experiments. */

  function paintDial(el) {
    var min = parseFloat(el.min) || 0;
    var max = el.max === '' ? 100 : parseFloat(el.max);
    var span = max - min;
    var pct = span > 0 ? ((parseFloat(el.value) - min) / span) * 100 : 0;
    el.style.setProperty('--dial-fill', Math.max(0, Math.min(100, pct)) + '%');
  }

  function paintDials(root) {
    var list = (root || document).querySelectorAll('input[type="range"].dial');
    for (var i = 0; i < list.length; i++) paintDial(list[i]);
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[type="range"].dial')) paintDial(t);
  });

  /* --------------------------------------------------------- rail + dock -- */
  /* Too many pills for the space and the bar scrolls rather than dropping its
     labels. Touch pans it natively; this gives a pointer the same, and swallows
     the click that would otherwise fire on whichever pill the drag ended over. */

  function dragRow(row) {
    var down = false, moved = false, sx = 0, sl = 0;
    row.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;             // native panning has it
      if (row.scrollWidth <= row.clientWidth) return;    // nothing to scroll: leave clicks alone
      down = true; moved = false; sx = e.clientX; sl = row.scrollLeft;
    });
    row.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 6) { moved = true; row.classList.add('dragging'); }
      if (moved) { row.scrollLeft = sl - dx; e.preventDefault(); }
    });
    // The row is transparent to the pointer (the pills are not), so a release
    // that lands off a pill would never reach a listener on the row itself.
    ['pointerup', 'pointercancel'].forEach(function (type) {
      window.addEventListener(type, function () { down = false; row.classList.remove('dragging'); });
    });
    row.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  /* -------------------------------------------------------------- panning -- */
  /* The drawer is an overlay, so it can end up lying on the part of the artwork
     you wanted to look at. Minimising it is one answer; moving the artwork out
     from under it is the other.

     A stage whose pointer is free — teletext, chroma — takes data-pan="free"
     and pans on a plain drag. One that uses the pointer for its own work — melt
     places points, magnetic throws windows — takes data-pan on its own and pans
     on the middle button or with space held, which is the idiom every canvas
     tool already uses. Metal has had its own pan since it had a world to move.

     The offset is clamped rather than resettable: you can always drag back, and
     there is no way to throw the artwork somewhere you can't reach. */

  function typingIn(t) {
    if (!t) return false;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
           t.tagName === 'SELECT' || t.isContentEditable;
  }

  var spaceHeld = false;
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !typingIn(e.target)) spaceHeld = true;
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'Space') spaceHeld = false;
  });
  window.addEventListener('blur', function () { spaceHeld = false; });

  /* A stage keeps one view — an offset and a zoom — and everything that moves
     it goes through here, so the buttons, the wheel and the drag can never
     disagree about where it is. */

  var views = new WeakMap();
  var Z_MIN = 0.25, Z_MAX = 6;

  function pannable(el) {
    var free = el.getAttribute('data-pan') === 'free';
    var v = { x: 0, y: 0, z: 1 };
    var sx = 0, sy = 0, id = null, moved = false;

    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

    function apply() {
      var t = '';
      if (v.x || v.y) t += 'translate(' + v.x + 'px, ' + v.y + 'px) ';
      if (v.z !== 1) t += 'scale(' + v.z + ')';
      el.style.transform = t.trim();
      el.classList.toggle('is-zoomed', v.z !== 1 || !!v.x || !!v.y);
      announce();
    }

    // Panning further than this and the artwork is off somewhere you would
    // have to guess your way back from.
    function clampOffset() {
      v.x = clamp(v.x, -innerWidth * 0.6, innerWidth * 0.6);
      v.y = clamp(v.y, -innerHeight * 0.6, innerHeight * 0.6);
    }

    // Zoom about the middle of what is on screen, not the element's own
    // origin, so the thing you are looking at stays roughly where it was.
    function zoomTo(z) {
      var next = clamp(z, Z_MIN, Z_MAX);
      if (next === v.z) return;
      var k = next / v.z;
      v.x *= k;
      v.y *= k;
      v.z = next;
      clampOffset();
      apply();
    }

    /* There is no 1:1 here on purpose. Every one of these stages draws its
       canvas at exactly the size it is displayed — buffer and CSS box are the
       same number — so "actual size" and "fit" would be the same view, and the
       button would do nothing. Chroma is the one place the phrase means
       something, and there it would mean something false: the preview is capped
       at 1920 on its longest edge, so it does not hold the export's pixels to
       show you. Fit is the honest end of the range. */
    var api = {
      in: function () { zoomTo(v.z * 1.25); },
      out: function () { zoomTo(v.z / 1.25); },
      fit: function () { v.x = 0; v.y = 0; v.z = 1; apply(); },
      get: function () { return { x: v.x, y: v.y, z: v.z }; }
    };
    views.set(el, api);

    /* Say where the view is: the level, where a page has somewhere to print it,
       and the Fit pill lights whenever there is something to go back from — so
       "am I zoomed?" is answerable without a readout at all. */
    function announce() {
      var out = document.querySelector('[data-view-level]');
      if (out) out.textContent = Math.round(v.z * 100) + '%';
      var off = v.z !== 1 || !!v.x || !!v.y;
      document.querySelectorAll('[data-view="fit"]').forEach(function (b) {
        b.classList.toggle('is-on', off);
        b.setAttribute('aria-pressed', String(off));
      });
    }

    el.addEventListener('pointerdown', function (e) {
      var wants = e.button === 1 || spaceHeld || (free && e.button === 0);
      if (!wants) return;
      id = e.pointerId;
      sx = e.clientX - v.x;
      sy = e.clientY - v.y;
      moved = false;
      el.setPointerCapture(id);
      el.classList.add('is-panning');
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (id === null || e.pointerId !== id) return;
      v.x = e.clientX - sx;
      v.y = e.clientY - sy;
      clampOffset();
      if (Math.abs(v.x) + Math.abs(v.y) > 4) moved = true;
      apply();
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      el.addEventListener(type, function (e) {
        if (id === null || e.pointerId !== id) return;
        try { el.releasePointerCapture(id); } catch (err) {}
        id = null;
        el.classList.remove('is-panning');
      });
    });
    // A drag that moved is not also a click on whatever it finished over.
    el.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);

    // Ctrl/⌘ + wheel is the zoom every canvas tool uses, and it is also what a
    // trackpad pinch arrives as.
    el.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(v.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, { passive: false });

    apply();
  }

  /* The zoom pills. Each names what it does and the stage it does it to is the
     one [data-pan] on the page — these plays have exactly one. */

  function wireViewButtons() {
    var stage = document.querySelector('[data-pan]');
    if (!stage) return;
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      var action = btn.getAttribute('data-view');
      btn.addEventListener('click', function () {
        var api = views.get(stage);
        if (api && api[action]) api[action]();
      });
    });
  }

  /* ------------------------------------------------------------------ go -- */

  function start() {
    paintDials(document);
    document.querySelectorAll('.rail, .dock').forEach(dragRow);
    document.querySelectorAll('[data-pan]').forEach(pannable);
    wireViewButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // A page that sets a dial's value in code calls play.dials() to repaint it.
  // The sheet API (open/close/minimise) went with the sheet: the panel is
  // DialKit's own popover now and keeps its own open state.
  window.play = { dials: paintDials };
})();
