# play.ravivasavan.com — the shared chrome

Everything in this file is already implemented in `/assets/play.css` and
`/assets/play.js`. A page links those two files, uses the markup below verbatim,
and keeps nothing of its own but the experiment.

The idea, in one line: **level 1 is the site's, level 2 is the tool's, and the
settings float above the content on a pane of glass — they are not a sidebar cut
out of the page.**

- Level 1 — 64px glass pills at `--chrome-top` (40 / 16 / 12 by fold): back or
  home at the left, the identity pill dead centre, the theme pill at the right.
- A full-width hairline at `--chrome-rule` (120 / 96 / 88).
- Level 2 — the experiment's own 44px glass tool pills, split by what they do.
  The **rail** runs down the left from `--chrome-tools` (136 / 112 / 104) and
  holds what changes the view: modes, zoom, step back. Icon only. The **dock**
  floats at the bottom edge and holds the verbs: upload, export, shuffle,
  clear. Labels kept.
- The dials drawer — one pane of glass, `--panel-w` wide, inset `--panel-gap`
  from the viewport, floating over the content and starting on the first line
  below the chrome. **It is as tall as its contents and no taller**, and past
  the viewport it stops and scrolls. On a phone it swings down to the bottom of
  the screen and collapses to its head. Either way it minimises into a disc the
  size of a tool pill.

Inside the drawer, the dials themselves are **DialKit**, rendered inline. A
play keeps its own engine in plain JS and mounts a small React root whose only
job is the panel; what DialKit has no control for — a body of copy, a palette
swatch, a list that grows as you click the canvas — stays in the drawer beside
it. See §8.

## Layout: the content is the whole viewport, the sheet overlays it

**No page reserves room for the sheet.** The experiment's artwork is centred on
the *viewport's* centre and its canvases and backgrounds run edge to edge; the
glass lies on top and covers a corner of it. That is deliberate, and minimise is
the answer to it — one click and the whole sheet is a 64px disc.

So: no `padding-right` for the panel, no shrunken stage, no `bottom: 76px` to
clear the phone's bottom sheet, and no `--sheet-inset` — the token is gone.
Pages that measure their own stage measure the full viewport.

---

## 1. The head block

Copy this verbatim. Only `<title>`, the description, the canonical/og URLs, and
the page `<style>` change per page.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>SLUG — play</title>
  <meta name="description" content="ONE SENTENCE, PAGE-SPECIFIC.">
  <link rel="canonical" href="https://play.ravivasavan.com/YYYYMMDD/SLUG/">
  <meta property="og:title" content="SLUG — play">
  <meta property="og:description" content="ONE SENTENCE, PAGE-SPECIFIC.">
  <meta property="og:url" content="https://play.ravivasavan.com/YYYYMMDD/SLUG/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" id="theme-color" content="#fff5f5">
  <script>
    /* Set data-theme and the address-bar colour before paint, to avoid a
       flash. Cycles: day → night → system → circadian. Circadian colours are
       computed by circadian.js, which play.js only loads when it's wanted, so
       its last cached tokens are re-applied here to keep first paint right. */
    (function () {
      var t = null;
      try { t = localStorage.getItem('theme'); } catch (e) {}
      if (t !== 'day' && t !== 'night' && t !== 'system' && t !== 'circadian') t = 'system';
      document.documentElement.dataset.theme = t;
      var c = '#fff5f5';
      if (t === 'night') c = '#0d1b1e';
      else if (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) c = '#0d1b1e';
      else if (t === 'circadian') {
        try {
          var cache = JSON.parse(localStorage.getItem('circadian-cache'));
          for (var k in cache) document.documentElement.style.setProperty(k, cache[k]);
          if (cache && cache['--bg']) c = cache['--bg'];
        } catch (e) {}
      }
      var m = document.getElementById('theme-color');
      if (m) m.setAttribute('content', c);
    })();
  </script>
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="preload" href="/assets/fonts/LabilGrotesk-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/play.css">
  <style>
    /* Page-specific CSS only. No tokens, no @font-face for Labil Grotesk, no
       chrome, no controls — play.css has all of it. A page that needs its own
       face (teletext's Bedstead) still declares that one here. */
  </style>
</head>
```

The `<meta name="theme-color">` **must** carry `id="theme-color"` — play.js
repaints it by id when the theme changes and every minute under circadian.

At the very end of `<body>`, in this order:

```html
  <script src="/assets/play.js" defer></script>
  <script src="./whatever-this-page-does.js" defer></script>   <!-- or an inline defer block -->
</body>
```

There is **no** `<script src="/assets/circadian.js">` anywhere any more.
play.js injects it (`id="circadian-script"`) only when the theme is, or becomes,
circadian.

---

## 2. Level 1 — the site row

### (a) Experiment pages

`.chrome__back` / `.chrome__id` / `.chrome__theme` place the three pills on a
`1fr auto 1fr` grid, so the identity pill is dead centre whatever the sides
weigh. `.header-pill__role` carries the experiment's name (it hides at ≤900 on
an experiment page; on the landing page it is the tagline and holds to ≤640).

```html
<!-- Top row, site level: back left, identity centred, theme hard right. -->
<div class="chrome">
  <a class="icon-pill chrome__back" href="/" aria-label="Back to play index">
    <span class="icon-pill__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    </span>
  </a>
  <header class="header-pill chrome__id">
    <div class="header-pill__inner">
      <div class="header-pill__avatar">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect width="2.00001" height="2.00001" transform="matrix(-1 0 0 1 32 13)" fill="currentColor"/> <rect width="4.00001" height="2.00001" transform="matrix(-1 0 0 1 20 13)" fill="currentColor"/> <path d="M34.0098 34.9766V48H36V34.9766H34.0098ZM13.9902 34.9766H12V48H13.9902V35.0293H15.9805V32.9814H13.9902V34.9766ZM32 13H16V9H14V17H16V15H32V25H30V27H18V31H16V33H18V35H30V33H32V35H34V33H32V31H34V15H40V13H34V9H32V13ZM12 22H14V17H12V22ZM28 21H30V19H28V21ZM20 21H22V19H20V21ZM30 9H32V7H30V9ZM16 9H18V7H16V9ZM18 7H30V5H18V7Z" fill="currentColor"/> <rect width="4" height="6" transform="matrix(-1 0 0 1 18 27)" fill="currentColor"/> <rect width="2.00001" height="4.00001" transform="matrix(-1 0 0 1 16 21)" fill="currentColor"/> <path d="M16 25H18V21H16V25Z" fill="currentColor"/> <rect width="16.0001" height="2.00001" transform="matrix(-1 0 0 1 30 25)" fill="currentColor"/> <rect width="4.00001" height="2.00001" transform="matrix(-1 0 0 1 32 23)" fill="currentColor"/> <rect width="4.00001" height="2.00001" transform="matrix(-1 0 0 1 24 23)" fill="currentColor"/> <rect width="4.00001" height="2.00001" transform="matrix(-1 0 0 1 28 21)" fill="currentColor"/> </svg>
      </div>
      <div class="header-pill__label">
        <span class="header-pill__name">Ravi Vasavan</span>
        <span class="header-pill__role">Teletext</span><!-- the experiment's name -->
      </div>
    </div>
  </header>
  <button class="icon-pill icon-pill--theme chrome__theme" type="button" aria-label="Toggle theme" data-theme-toggle>
    <span class="icon-pill__icon">
      <svg data-tstate="day" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
      </svg>
      <svg data-tstate="night" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
      <svg data-tstate="system" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
      </svg>
      <svg data-tstate="circadian" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    </span>
  </button>
</div>

<!-- The rule marks where the site's chrome ends and this experiment's begins. -->
<div class="chrome-rule" aria-hidden="true"></div>
```

### (b) The landing page

Same pills, different container: `.header-pills` tucks the two icon pills in
against the identity pill instead of pushing them to the edges, and there is no
`.header-pill__role` and no `.chrome-rule`.

```html
<div class="header-pills">
  <a class="icon-pill icon-pill--home" href="https://ravivasavan.com" aria-label="Home"> … </a>
  <header class="header-pill"> … (as above, without .header-pill__role) … </header>
  <button class="icon-pill icon-pill--theme" type="button" aria-label="Toggle theme" data-theme-toggle> … </button>
</div>
```

**The theme glyphs use `data-tstate`, not `data-state`.** The landing page
currently says `data-state` on its four theme SVGs — rename them.
(`data-state="on" | "off"` is still the right attribute for a *two-face toggle
glyph* on an `.icon-pill` or `.tool-pill`, e.g. camera on/off. That is a
different thing and play.css supports both.)

---

## 3. Level 2 — the rail and the dock

The experiment's own buttons, split by what they do rather than piled into one
row above the artwork. Both are `.tool-pill`s — same 44px glass, same icon and
word — and both are glass over the artwork that reserves no room.

**The rail** takes what changes *what you are looking at*: view modes, zoom, the
step back through history. It is icon only; a vertical column of words is a
menu, not a rail. The label stays in the markup and stays in the a11y tree.

```html
<nav class="rail" aria-label="Atlas view">
  <button class="tool-pill" id="t-in" type="button" aria-label="Zoom in">
    <span class="tool-pill__icon"><svg viewBox="0 0 24 24" …>…</svg></span>
    <span class="tool-pill__label">In</span>
  </button>
</nav>
```

**The dock** takes the verbs — upload, export, shuffle, clear. They fire and
they are done, so they keep their labels and sit where the hand already is. It
centres on **the page**, not on the space beside the drawer: the drawer is an
overlay and it moves, and the verbs should not shuffle sideways every time it
folds.

```html
<nav class="dock" aria-label="Atlas actions">
  <button class="tool-pill" id="t-export" type="button" aria-label="Download the list as JSON">
    <span class="tool-pill__icon"><svg viewBox="0 0 24 24" …>…</svg></span>
    <span class="tool-pill__label">Export</span>
  </button>
</nav>
```

A play with only verbs gets no rail at all — camouflage has one pill and it is
in the dock.

`.is-on` tints the text and icon `--accent` and swaps the hairline for an accent
one; in the rail that accent is how a mode reads as active with its label
hidden. `[disabled]` and `.tool-pill--danger` are also supported.

**Put nothing in either bar but a `.tool-pill`.** Both boxes are
`pointer-events: none` (the pills are `auto`) because the padding that keeps the
scroller from clipping their shadow makes them bigger than the pills. A hidden
`<input type="file">` does *not* belong in them — it is the dialog a pill opens,
not a control in the bar. Atlas and melt both kept one inside the old tools row,
and both threw on load the day the row was rebuilt.

A small always-on readout — camouflage's seed, chroma's composition and size —
rides in the dock as a chip beside the pills, rather than floating separately at
the bottom edge and fighting it at every width.

Folded (≤900) the dock lifts to sit on top of the collapsed drawer, and drops
back beside the disc when the drawer is minimised. The rail keeps its column.
Anything else of yours anchored to the bottom edge has to clear the dock: 44px
of pill on `--panel-gap`, plus a gap.

## 4. The sheet

A `.sheet` is the whole settings surface. It is `position: fixed` — it is **not**
a grid column, and it is **not** something your layout makes room for. Nothing
else needs to change about your layout at all.

```html
<aside class="sheet" aria-label="Settings">
  <div class="sheet__head">
    <span class="sheet__title">Settings</span>
    <span class="sheet__summary">480 × 500</span><!-- optional; tabular figures -->
  </div>
  <div class="sheet__body">

    <h2 class="sheet__section">Geometry</h2>

    <!-- range -->
    <label class="field">
      <span class="field__top">
        <span class="field__label">Columns</span>
        <span class="field__value" id="v-cols">40</span>
      </span>
      <input class="dial" type="range" id="c-cols" min="10" max="80" value="40">
    </label>

    <!-- select -->
    <label class="field">
      <span class="field__top"><span class="field__label">Service spec</span></span>
      <select class="select" id="c-spec">
        <option value="ceefax">Ceefax · BBC</option>
      </select>
    </label>

    <!-- text / number; .field__row puts two side by side -->
    <div class="field__row">
      <label class="field">
        <span class="field__top"><span class="field__label">Page</span></span>
        <input class="input" type="number" id="c-page" value="100">
      </label>
      <label class="field">
        <span class="field__top"><span class="field__label">Seed</span></span>
        <input class="input" type="number" id="c-seed" value="7">
      </label>
    </div>

    <!-- textarea -->
    <label class="field">
      <span class="field__top"><span class="field__label">Copy</span></span>
      <textarea class="textarea" id="c-copy"></textarea>
    </label>

    <h2 class="sheet__section">Display</h2>

    <!-- switch: the checkbox is still the control, the pill is just what you see -->
    <label class="switch">Reveal codes<input type="checkbox" id="c-reveal" checked><span class="switch__track"></span></label>
    <label class="switch">Test card<input type="checkbox" id="c-test"><span class="switch__track"></span></label>

    <!-- buttons -->
    <div class="field__row">
      <button class="btn" type="button" id="c-reset">Reset</button>
      <button class="btn btn--primary" type="button" id="c-export">Export</button>
    </div>

    <!-- swatches, chips and anything else of yours keep their own look -->
    <div class="swatches">
      <span class="swatch" style="background:#ff795c"></span>
    </div>

    <p class="sheet__note">A line of explanation, 13px.</p>
  </div>
</aside>
```

Order matters: `.switch` needs `<input type="checkbox">` immediately followed by
`<span class="switch__track">`, both inside the `<label class="switch">`.

**Reserving room: don't.** A stage is the whole viewport —
`position: fixed; inset: 0`, or `100%` of both — and whatever it draws is
centred on the viewport's centre. Delete every `padding-right:
var(--sheet-inset)`, every `right: var(--sheet-inset)`, every `bottom: 76px`,
and any measurement in your script that subtracts the panel before it centres
something. Delete the old `#panel::before` divider too — the sheet floats, so
there is no edge to draw.

### Minimise

The sheet folds into a single round glass button and stays folded until it is
asked back — across reloads, and across plays.

- play.js appends a **`.sheet__min`** button (32px glass-inset disc, Lucide
  `minimize-2` at 16px) to `.sheet__head` if the markup has none, and a
  **`.sheet__icon`** button (Lucide `sliders-horizontal` at 20px) as the
  sheet's last child. Neither belongs in your markup; write your head as
  though they weren't there and they will land in the right places (the
  minimise button is the head's hard-right item, and `.sheet__summary` keeps
  its own right edge by taking the slack to its left).
- Minimised, the sheet *is* the button: 64px round, same material, anchored
  where its top-right corner was — `top` the sheet's own top, `right
  var(--panel-gap)`. Folded (≤900) it is 56px at the bottom-right, above the
  safe area. 240ms `cubic-bezier(0.4, 0, 0.2, 1)` on width, height and
  border-radius; nothing under `prefers-reduced-motion`.
- The state is one preference for the whole site:
  `localStorage['play.sheet']` = `'min'` | `'open'`.
- **It is stamped on `<html>`, not on the sheet**: `data-play-sheet="min"`,
  written by play.js at script-execution time — deferred, so the document is
  parsed and nothing has painted yet — and every rule keys off the root. That
  is what stops the flash, and it is also why a page that builds its sheet in
  script (metal's DialKit panel) gets the minimised geometry on that sheet's
  first frame. Pages need no head script of their own for it.
- Keyboard and focus: both controls are real buttons, so Enter and Space work.
  Minimising moves focus to the disc; restoring puts it back on the minimise
  button in the head. Escape keeps the meaning it always had — it closes an
  open bottom sheet, and does nothing to a minimised one.
- While minimised the head and the body are both `inert` and `aria-hidden`;
  the disc carries `aria-label="Show settings"` and `aria-expanded`.

### Mobile behaviour (≤900px)

play.css swings the sheet to `left/right/bottom: var(--panel-gap)` and collapses
it to 60px showing the grabber and `.sheet__head`. play.js:

- **injects `.sheet__grab`** (36 × 4) as the sheet's first child if the markup
  has none, so you do not have to write it;
- makes `.sheet__head` a `role="button" tabindex="0"` with `aria-expanded`, unless
  it already has a `role`;
- toggles `.is-open` on a click on `.sheet__head` or `.sheet__grab` (a `button`,
  `a`, `input`, `select`, `textarea` or `label` inside the head keeps its own
  click), on Enter/Space on the head, and on a >24px drag of the grabber;
- measures the content and writes `--sheet-full` so `.is-open` grows to
  `min(72vh, content)` over 320ms;
- closes every open sheet on Escape, and on crossing the 900px boundary.

Minimise works here too, and is independent of open/collapsed: restoring the
disc gives you back whichever of the two the sheet was in.

Nothing pads the body any more — the collapsed glass lies over the artwork
like the pane does.

---

## 5. What play.js hooks

| Hook | What it does |
|---|---|
| `[data-theme-toggle]` (any element, delegated click) | cycles day → night → system → circadian, writes `localStorage.theme` |
| `<meta id="theme-color">` | repainted on every theme change, on OS scheme change, and each time circadian updates `--bg` |
| `/assets/circadian.js` | injected once as `id="circadian-script"` when the theme is or becomes circadian |
| `.dock` | sideways scrolling when the verbs outgrow the space (touch pans natively) |
| `.rail` | vertical scrolling when the modes outgrow the height |
| `.sheet__body` | made `inert` while the sheet is folded and shut — and, with `.sheet__head`, while it is minimised — so the clipped controls leave the tab order and the a11y tree |
| `.sheet`, `.sheet__head`, `.sheet__grab`, `.is-open` | the bottom-sheet behaviour above |
| `.sheet__min`, `.sheet__icon` | injected if absent; the two halves of minimise |
| `<html data-play-sheet>` | `min` \| `open`, stamped before first paint from `localStorage['play.sheet']` |
| `input[type="range"].dial` | `--dial-fill` kept in step with the value, so the filled half of the track paints in WebKit |
| `window.play.dials(root?)` | call after setting a dial's value **in code** — an `input` event from the user is handled already |
| `window.play.setTheme(t)`, `window.play.openSheet(el)`, `window.play.closeSheet(el)`, `window.play.minimiseSheet(bool)`, `window.play.isSheetMinimised()` | if a page ever needs them |

play.js is a classic script with `defer`, loaded **before** the page's own
scripts. Anything of yours that reads `.sheet` geometry should also be `defer`.

---

## 6. Tokens you may use

Colour: `--night --orange --olive --white`, `--bg --fg --ink --muted --field
--separator`, `--accent` (= `--orange`).
`--fg` and `--ink` are the same colour under two names; circadian.js publishes
both, so use whichever your page already says.

Pills: `--pill-bg --pill-filter --pill-edge`.

**One icon size, one container size.** Level 2 is 44px of glass around a 16px
glyph, everywhere: a rail pill, a dock pill, and the minimised drawer disc
(`--sheet-min`) are all the same object. Level 1's identity row is 64px around
16px, and is the only thing that differs.

Glass: `--glass-bg --glass-blur --glass-edge --glass-specular --glass-shadow
--glass-shadow-sm --glass-radius`. Apply them with the `.glass` class rather
than by hand; the only two that move between day and night are `--glass-mix`
(62% / 52%) and `--glass-spec` (45% / 12%), and everything else derives.

The `.sheet` is the exception, in two places. It lies over the experiment's own
artwork at every width now that the content runs the full viewport beneath it,
so it swaps the shared tint for `--sheet-mix` / `--sheet-spec` (86% / 34% day,
80% / 10% night) and `--sheet-blur` (`blur(24px) saturate(120%)` — the same
blur, less of the canvas's colour pulled up into the type).

And it redefines `--muted` for everything inside it: `color-mix(in srgb,
var(--fg) 82%, transparent)`, because :root's 55% measures 1.4–2.4:1 over a
saturated canvas. So `.field__label`, `.sheet__summary`, `.sheet__section` and
`.sheet__note` all just say `var(--muted)` and get the readable one — as does
any label of your own, and DialKit's, without restating anything. Don't put a
second `opacity` on top of it; that is what dropped `.sheet__section` to
1.4:1.

Geometry: `--chrome-top --chrome-rule --chrome-tools --chrome-pad`,
`--panel-w --panel-gap --sheet-min` (64 / 56, the minimised disc) and
`--sheet-top` (the drawer's own top edge — the first line below the chrome, and
where the rail starts too). **`--sheet-inset` is gone** — nothing reserves room
for the drawer, so there is nothing to inset.

Stacking: `--z-sheet` 450 < `--z-rule` 499 < `--z-chrome` 500. Keep your page's
own content below 450.

`@media (prefers-reduced-transparency: reduce)` already turns every glass
surface opaque. Reduced-motion is handled for the chrome; your experiment's own
motion is still yours to handle.

**Write theme selectors as `:root[data-theme="night"]`, never as a bare
`[data-theme="night"]`.** The bare form matches *any* element carrying the
attribute, and third-party widgets stamp their own — DialKit writes
`data-theme="system"` on its root — so a whole panel can end up repainting
itself in the wrong palette from the inside. play.css is anchored to `:root`
throughout; any page-local token block must be too.

---

## 7. Checklist per page

- [ ] Head block replaced with §1 verbatim (title, description, canonical, og,
      twitter, theme-color **with the id**, FOUC script, icons, font preload,
      `play.css`).
- [ ] `<link rel="stylesheet" href="/assets/play.css">` added; the page's own
      `<style>` reduced to page-specific rules only.
- [ ] Deleted from the page's CSS: the Labil Grotesk `@font-face`, the `:root`
      / `:root[data-theme="night"]` / `prefers-color-scheme` token blocks, the
      reset, `.chrome*`, `.header-pill*`, `.icon-pill*`, `.rail`, `.dock`,
      `.tool-pill*`, and the generic control styles now covered by `.field`,
      `.dial`, `.input`, `.select`, `.textarea`, `.switch`, `.btn`, `.swatch`.
- [ ] No reference to `LabilGrotesk-Regular.woff` remains — the file is gone,
      only the `.woff2` ships.
- [ ] `<script src="/assets/circadian.js">` removed; `<script
      src="/assets/play.js" defer>` added before the page's own scripts, which
      are `defer` too.
- [ ] The page's local theme-toggle listener and `dragRow` IIFE deleted —
      play.js owns both. (The button keeps `data-theme-toggle`.)
- [ ] Theme glyphs use `data-tstate`, one for each of day/night/system/circadian.
- [ ] Any theme block the page keeps for its own tokens is written
      `:root[data-theme="…"]`, not bare.
- [ ] `#panel` converted to `.sheet` + `.sheet__head` + `.sheet__body`; the
      `#panel::before` divider and the `grid-template-columns: … var(--panel-w)`
      body grid removed.
- [ ] The experiment's buttons are split between `.rail` (what changes the
      view) and `.dock` (the verbs), and neither holds anything that is not a
      `.tool-pill` — a hidden file input goes outside both.
- [ ] Anything of the page's own anchored to the bottom edge clears the dock.
- [ ] Nothing reserves room for the drawer: no `--sheet-inset` anywhere in the
      CSS or the script, no `bottom: 76px` at ≤900, no `tools--sheet` class.
      The stage is the full viewport and its artwork is centred on the
      viewport's centre.
- [ ] Every checkbox converted to `.switch` (checkbox kept, visually hidden).
- [ ] Every slider given `class="dial"`; any code that sets a dial's value calls
      `play.dials()` after.
- [ ] **Every id, name and data-attribute the page's JS reads is unchanged.**
      Rewrap the markup, never rename the hooks.
- [ ] `assets/img/favicon.svg` and `assets/img/apple-touch-icon.png` referenced.
- [ ] Checked at 1440 and 390, day and night, with no console errors.

---

## 8. The dials are DialKit

Every play's drawer is a DialKit panel, rendered `mode="inline"` into a
`#dial-mount` the page's own markup provides. The engine stays plain JavaScript
— canvas, WebGL, whatever it already was — and a small React root does nothing
but own the controls.

```jsx
createPortal(<DialRoot mode="inline" theme="dark" productionEnabled />, mount)
```

`theme="dark"` pins DialKit to one of its own palettes: the skin in
`poc/shared/dialkit-skin.css` repaints nearly all of it from the site's tokens,
but not quite all, and the default ("system") would make whatever is left follow
the OS — so the panel could go light while the page stayed in night.

Each play is its own Vite project under `poc/<slug>/`, building straight into
its dated folder, and takes its Geist-Mono dropper and chunk split from
`poc/shared/vite-dialkit.js`. The engine ships as a plain file in `public/` and
loads as a classic `defer` script.

**Mounting order is the thing that bites.** Vite hoists the module into
`<head>`, so in document order it runs *before* the engine's defer script
further down the body. Both finish before `DOMContentLoaded`, so that is when to
mount — unless the engine is itself a `DOMContentLoaded` handler (melt), in
which case its listener is registered *second* and the panel has to wait for an
event the engine dispatches.

**The engine keeps the state.** The panel reads it once, to open on it, and
writes back on change; when the engine moves a value itself — a randomise, a
reset, a recipe in the hash, a snap to 15° — it tells the panel, and the panel
echoes that into its dials behind a flag so the echo is not posted straight back
as if the reader had done it.

**What DialKit has no control for stays in the drawer beside it.** There is no
multi-line text, no custom control and no per-dial lock, so teletext's copy,
melt's per-point list, chroma's palette swatches and chroma's padlocks are
ordinary markup under a `.sheet__section`, below the panel. That is the expected
shape, not a workaround — the panel is for the dials.

**DialKit titles a dial from its key.** `everywhere: [0, 0, 40, 1]` renders
"Everywhere"; there is no label option on the range shorthand. Name the key what
the play calls the thing, and map it to the engine's own name on the way
through.

---

## 9. Panning

The drawer is an overlay, so it will sometimes lie on the part of the artwork
you wanted. Minimising it is one answer; moving the artwork out from under it is
the other, and play.js gives every stage the second one.

```html
<main id="stage" data-pan="free">   <!-- pointer is free: plain drag pans -->
<main id="stage" data-pan>          <!-- pointer is spoken for: space or middle-drag -->
```

`data-pan="free"` is for a stage that does nothing with the pointer — teletext,
chroma — and it pans on an ordinary drag, with a `grab` cursor to say so.
`data-pan` alone is for a stage that uses the pointer for its own work — melt
places points, magnetic throws windows — and pans only on the middle button or
with space held, which is the idiom every canvas tool already uses. Metal has
had a pan of its own since it had a world to move, and takes neither.

The offset is clamped to 60% of the viewport rather than being resettable: you
can always drag back, and there is no way to throw the artwork somewhere you
cannot reach. A drag that moved swallows the click it would otherwise have
finished with.

### Zoom

A stage keeps one view — an offset and a zoom — and the buttons, the wheel and
the drag all go through it, so they cannot disagree about where it is. The pills
go in the rail as their own group:

```html
<div class="rail__group rail__group--zoom">
  <button class="tool-pill" type="button" data-view="in"  …>
  <button class="tool-pill" type="button" data-view="out" …>
  <button class="tool-pill" type="button" data-view="fit" …>
</div>
```

They act on the one `[data-pan]` stage on the page. Ctrl/⌘ + wheel zooms too,
which is also what a trackpad pinch arrives as. Zoom runs 0.25× to 6× and scales
about the middle of what is on screen, so what you are looking at stays roughly
where it was. `data-view="fit"` goes back to 1× and no offset, and **lights up
whenever there is something to go back from** — so "am I zoomed?" is answerable
without a readout. A page with somewhere to print the number can add
`data-view-level` to any element and it will be kept in step; chroma puts it in
the dock beside the composition and the size.

**There is no 1:1, on purpose.** Every one of these stages draws its canvas at
exactly the size it is displayed — buffer and CSS box are the same number — so
"actual size" and "fit" are the same view and the button would do nothing.
Chroma is the one place the phrase means something and there it would mean
something false: the preview is capped at 1920 on its longest edge, so it does
not hold the export's pixels to show you.

Camouflage has neither attribute on purpose — its pattern is full-bleed, so
there is nothing behind the glass but more of the same pattern.
