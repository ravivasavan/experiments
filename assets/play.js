/* play.ravivasavan.com — the shared behaviour.
   Three things every page needs and none of them owns: the rail and the dock's
   sideways drag, the sheet folding into a bottom sheet on a phone, and panning
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

  /* ------------------------------------------------------------ the sheet -- */
  /* Above 900 the sheet is a floating pane and always open. Folded it drops to
     the bottom of the screen showing only its head, and the head or the grabber
     opens it to the height of its content, capped at 72vh. */

  var folded = matchMedia('(max-width: 900px)');

  /* --- minimised, and remembered --- */
  /* Minimise is a preference, not a page state: it is one key for the whole
     site, and it is stamped on <html> rather than on the sheet. Both halves
     matter for the flash. The attribute is written here, at script-execution
     time — play.js is deferred, so the document is parsed but nothing has
     painted — and because CSS keys off the root rather than the element, a
     page that builds its sheet in script (metal's DialKit panel) gets the
     minimised geometry on that sheet's first frame too. */

  var SHEET_KEY = 'play.sheet';

  function minimised() { return html.getAttribute('data-play-sheet') === 'min'; }

  function stampMin(min) { html.setAttribute('data-play-sheet', min ? 'min' : 'open'); }

  try { stampMin(localStorage.getItem(SHEET_KEY) === 'min'); } catch (e) { stampMin(false); }

  function fullHeight(sheet) {
    var prevH = sheet.style.height;
    var prevT = sheet.style.transition;
    sheet.style.transition = 'none';
    sheet.style.height = 'auto';
    var h = sheet.scrollHeight;
    sheet.style.height = prevH;
    void sheet.offsetHeight;               // flush, or the reopen won't animate
    sheet.style.transition = prevT;
    return h;
  }

  // Folded and shut, the sheet is 60px of glass clipping a full panel of
  // controls; minimised it is a 64px disc clipping the head as well. They are
  // still in the DOM either way, so without this a keyboard or a screen reader
  // walks straight into thirty invisible fields — and the clip is
  // overflow:hidden, so the browser cannot even scroll them into view. inert
  // takes them out of the tab order and off the a11y tree together.
  function gateBody(sheet) {
    var body = sheet.querySelector('.sheet__body');
    var head = sheet.querySelector('.sheet__head');
    var min = minimised();
    var shut = min || (folded.matches && !sheet.classList.contains('is-open'));
    // Read who has focus before inert takes it away: the browser drops it on
    // <body>, and Escape out of a field would lose the user's place.
    var had = (shut && body && body.contains(document.activeElement)) ||
              (min && head && head.contains(document.activeElement));
    if (body) {
      body.inert = shut;
      // Belt and braces for the engines that ship inert without the a11y half.
      if (shut) body.setAttribute('aria-hidden', 'true');
      else body.removeAttribute('aria-hidden');
    }
    if (head) {
      head.inert = min;
      if (min) head.setAttribute('aria-hidden', 'true');
      else head.removeAttribute('aria-hidden');
    }
    var icon = sheet.querySelector('.sheet__icon');
    if (icon) icon.setAttribute('aria-expanded', min ? 'false' : 'true');
    if (had) {
      var to = min ? icon : head;
      if (to && to.focus) to.focus();
    }
  }

  function openSheet(sheet) {
    sheet.style.setProperty('--sheet-full', fullHeight(sheet) + 'px');
    sheet.classList.add('is-open');
    var head = sheet.querySelector('.sheet__head');
    if (head) head.setAttribute('aria-expanded', 'true');
    gateBody(sheet);
  }

  function closeSheet(sheet) {
    sheet.classList.remove('is-open');
    var head = sheet.querySelector('.sheet__head');
    if (head) head.setAttribute('aria-expanded', 'false');
    gateBody(sheet);
  }

  function toggleSheet(sheet) {
    if (sheet.classList.contains('is-open')) closeSheet(sheet);
    else openSheet(sheet);
  }

  // Lucide, drawn at 24 and scaled by the CSS: minimize-2 for the control in
  // the head, sliders-horizontal for the disc it leaves behind.
  var GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var MINIMISE = GLYPH + '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/></svg>';
  var SLIDERS = GLYPH + '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12H12"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/></svg>';

  function prepareSheet(sheet) {
    if (!sheet.querySelector('.sheet__grab')) {
      var grab = document.createElement('div');
      grab.className = 'sheet__grab';
      grab.setAttribute('aria-hidden', 'true');
      sheet.insertBefore(grab, sheet.firstChild);
    }
    var head = sheet.querySelector('.sheet__head');
    if (head && !head.hasAttribute('role')) {
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', 'false');
    }
    // The minimise control goes last in the head, so it is the hard-right item
    // whatever else the experiment put there.
    if (head && !head.querySelector('.sheet__min')) {
      var min = document.createElement('button');
      min.type = 'button';
      min.className = 'sheet__min';
      min.setAttribute('aria-label', 'Minimise settings');
      min.innerHTML = MINIMISE;
      head.appendChild(min);
    }
    // And the disc's face, which is all that is left of the sheet once it is.
    if (!sheet.querySelector('.sheet__icon')) {
      var icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'sheet__icon';
      icon.setAttribute('aria-label', 'Show settings');
      icon.setAttribute('aria-expanded', 'false');
      icon.innerHTML = SLIDERS;
      sheet.appendChild(icon);
    }
    gateBody(sheet);
  }

  // One preference for every sheet on the page and every play on the site.
  function setMin(min, from) {
    stampMin(min);
    try { localStorage.setItem(SHEET_KEY, min ? 'min' : 'open'); } catch (e) {}
    document.querySelectorAll('.sheet').forEach(gateBody);
    if (!from) return;
    // Minimising, gateBody has already moved focus from the head to the disc.
    // Restoring, the disc it was on is gone, so hand focus back to the head —
    // to the minimise button in it, which is where the journey started.
    if (!min) {
      var back = from.querySelector('.sheet__min') || from.querySelector('.sheet__head');
      if (back && back.focus) back.focus();
    }
  }

  document.addEventListener('click', function (e) {
    var hit = e.target.closest && e.target.closest('.sheet__min, .sheet__icon');
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    setMin(hit.classList.contains('sheet__min'), hit.closest('.sheet'));
  });

  // Delegated, so a sheet built after load still works.
  document.addEventListener('click', function (e) {
    if (!folded.matches) return;
    var hit = e.target.closest && e.target.closest('.sheet__head, .sheet__grab');
    if (!hit) return;
    // A control that happens to live in the head row keeps its own click.
    var ctl = e.target.closest('button, a, input, select, textarea, label');
    if (ctl && hit.contains(ctl)) return;
    var sheet = hit.closest('.sheet');
    if (sheet) toggleSheet(sheet);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = document.querySelectorAll('.sheet.is-open');
      for (var i = 0; i < open.length; i++) {
        closeSheet(open[i]);
        // gateBody catches the usual case. A page with an Escape handler of
        // its own can have dropped focus on <body> before this runs, and a
        // keyboard user should not land back at the top of the document
        // because they shut a sheet.
        var head = open[i].querySelector('.sheet__head');
        if (folded.matches && !minimised() && head &&
            (!document.activeElement || document.activeElement === document.body)) head.focus();
      }
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var head = e.target.closest && e.target.closest('.sheet__head');
    if (!head || !folded.matches) return;
    // The minimise button lives in the head and is a real button: swallowing
    // the key here would stop the browser turning it into a click.
    if (e.target.closest('.sheet__min')) return;
    e.preventDefault();
    toggleSheet(head.closest('.sheet'));
  });

  // Dragging the grabber: up opens, down closes, past a 24px commitment.
  function dragGrab(sheet) {
    var grab = sheet.querySelector('.sheet__grab');
    if (!grab) return;
    var y0 = null;
    grab.addEventListener('pointerdown', function (e) { y0 = e.clientY; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointerup', function (e) {
      if (y0 === null) return;
      var dy = e.clientY - y0;
      y0 = null;
      if (dy < -24) openSheet(sheet);
      else if (dy > 24) closeSheet(sheet);
    });
    grab.addEventListener('pointercancel', function () { y0 = null; });
  }

  // Unfolding while a bottom sheet is open would leave a stale height on the
  // floating pane; drop it at the boundary.
  folded.addEventListener('change', function () {
    document.querySelectorAll('.sheet').forEach(function (sheet) {
      closeSheet(sheet);
      sheet.style.removeProperty('--sheet-full');
    });
  });

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
    document.querySelectorAll('.sheet').forEach(function (sheet) {
      prepareSheet(sheet);
      dragGrab(sheet);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // A page that sets a dial's value in code calls play.dials() to repaint it.
  window.play = {
    dials: paintDials,
    openSheet: openSheet,
    closeSheet: closeSheet,
    minimiseSheet: function (min) { setMin(min !== false); },
    isSheetMinimised: minimised
  };
})();
