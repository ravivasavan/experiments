# play.ravivasavan.com — the shared chrome

Everything in this file from the rule down is implemented in `/assets/play.css`
and `/assets/play.js`. A page links those two files, uses the markup below
verbatim, and keeps nothing of its own but the experiment.

Level 1 is neither of those files any more: it is the **shared chrome package**
at `https://ravivasavan.com/chrome/v1/`, one stylesheet and one script that every
*.ravivasavan.com surface links. Its contract is `chrome/README.md` in the `ravi`
repo (`~/Projects/Personal/ravi/chrome/README.md`), and §1 and §2 here say what a
play does about it.

The idea, in one line: **level 1 is the site's, level 2 is the tool's, and the
settings float above the content on a pane of glass — they are not a sidebar cut
out of the page.**

- Level 1 — the package: a 64px glass avatar pill at the top left that expands
  to the name and "‹ Back to Play", and a menu pill at the top right (About ·
  Play · theme). Both sit at its `--nav-margin` (40 / 16 / 12 by fold), which is
  play's `--chrome-top`.
- A full-width hairline at `--chrome-rule` (144 / 96 / 88) — ours.
- Level 2 — the experiment's own 44px glass tool pills, split by what they do.
  The **rail** runs down the left from `--chrome-tools` (160 / 112 / 104) and
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

## Tools — the chrome's family (2026-09-18)

Everything a play puts on the canvas — the **rail**, the **dock** and the
**drawer** — is one group, *Tools*, and it reads as an extension of the site
chrome, not a second system:

- **Rail** hangs under the avatar pill in its column: `left: --chrome-top`,
  `top: --chrome-tools` (pill bottom + 8px), 64px glass circles on the chrome's
  own material (`--pill-bg` / `--pill-filter` / `--pill-edge`), 8px apart. The
  icon sits on a 48px disc that fills at 6% on hover and stays filled at 12%
  when the mode is on — the same active state as the menu's chips. No accent.
- **Drawer** hangs under the menu pill: `top: --chrome-tools`, `right:
  --chrome-top`, 360 wide; minimised it is a 64px disc in that corner (56 on a
  phone).
- **Dock** keeps its 44px pills — the one size exception — but wears the
  chrome's material. Position unchanged (bottom, centred).
- **Readout.** A dock may carry one non-button, `<p class="readout">`, for a
  line of status (Chroma's composition and size, Teletext's cell budget): the
  same 44px pill and material as the verbs beside it, in the muted ink. Lives
  in play.css, not in a play's own CSS.
- **Centred, full stop.** The artwork centres on the viewport's own centre — no
  top padding for the chrome, no floor under the pills, no bottom padding for
  the dock. The chrome and the Tools lie over it. No prompts on the canvas
  either (Magnetic's "click anywhere" went); people find the click.
- **There is no drawn rule any more.** `.chrome-rule` is `display: none`;
  drop the element from templates as they are rebuilt.
- **Tone.** A play whose canvas ignores the theme sets
  `html[data-chrome-tone]` (or `rvChrome.setTone()`); the package's pills and
  the Tools keep the theme's colours but go opaque enough (80% of the theme's
  background) to carry their own text over any canvas. Chroma sets it from the
  rendered pixels under the pill row. The theme always decides the colours.

Geometry numbers older sections quote (rule 144, tools 160 / 96, 112) are
superseded: everything derives from `--chrome-top` (40 / 16 / 12).

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

The theme-color meta and the script under it belong to the **shared chrome
package**, and are copied from its README as they stand — they are the only
chrome code a page owns. The package is served from the brand home, CORS on,
ten-minute cache, never fingerprinted:

```
https://ravivasavan.com/chrome/v1/chrome.css
https://ravivasavan.com/chrome/v1/chrome.js
https://ravivasavan.com/chrome/v1/circadian.js   (fetched by chrome.js, on demand)
https://ravivasavan.com/chrome/v1/avatar.svg
```

The contract is `chrome/README.md` in the `ravi` repo —
`~/Projects/Personal/ravi/chrome/README.md`. It wins over this file on anything
level 1; read it before touching this section.

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
    /* Set data-theme before paint to avoid FOUC. Cycles: day → night → system
       → circadian. Circadian colours are computed by circadian.js (loaded on
       demand by chrome.js), so re-apply its last cached tokens here to keep
       first paint correct. Also resolve the theme-color meta (mobile browser
       chrome) to match, same logic chrome.js uses at runtime. */
    (function () {
      var t = null;
      try { t = localStorage.getItem('theme'); } catch (e) {}
      if (t !== 'day' && t !== 'night' && t !== 'system' && t !== 'circadian') t = 'system';
      document.documentElement.dataset.theme = t;
      var DAY = '#fff5f5', NIGHT = '#0d1b1e';
      var color = t === 'night' ? NIGHT : DAY;
      if (t === 'system') {
        try {
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) color = NIGHT;
        } catch (e) {}
      }
      if (t === 'circadian') {
        try {
          var cache = JSON.parse(localStorage.getItem('circadian-cache'));
          for (var k in cache) document.documentElement.style.setProperty(k, cache[k]);
          if (cache && cache['--bg']) color = cache['--bg'];
        } catch (e) {}
      }
      try {
        var meta = document.getElementById('theme-color');
        if (meta) meta.setAttribute('content', color);
      } catch (e) {}
    })();
  </script>
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="preload" href="https://ravivasavan.com/assets/fonts/LabilGrotesk-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="https://ravivasavan.com/chrome/v1/chrome.css">
  <link rel="stylesheet" href="/assets/play.css">
  <style>
    /* Page-specific CSS only. No tokens, no @font-face for Labil Grotesk, no
       chrome, no controls — chrome.css and play.css have all of it. A page that
       needs its own face (teletext's Bedstead) still declares that one here,
       from /assets/fonts/. */
  </style>
</head>
```

The `<meta name="theme-color">` **must** carry `id="theme-color"` — the script
above resolves it before paint, and chrome.js repaints it by id on every theme
change and every minute under circadian.

**The font comes with chrome.css.** It declares the Labil Grotesk `@font-face`
pointing at `https://ravivasavan.com/assets/fonts/LabilGrotesk-Regular.woff2`,
served with `Access-Control-Allow-Origin: *`. A second declaration anywhere —
play.css, a page's `<style>` — is a second download of the same file. The
`preload` above names that same URL, which is worth having.

At the very end of `<body>`, in this order:

```html
  <script src="/assets/play.js" defer></script>
  <script src="https://ravivasavan.com/chrome/v1/chrome.js" defer
          data-surface="play"
          data-back="https://play.ravivasavan.com"
          data-back-label="Back to Play"></script>
  <script src="./whatever-this-page-does.js" defer></script>   <!-- or an inline defer block -->
</body>
```

`data-surface="play"` on every page here — it is which menu chip reads as the
current one. `data-back` is what the avatar pill links to and what turns its
role line into "‹ Back to Play": an experiment sets it, **the landing page
leaves it out entirely** and the pill is the identity again.

There is **no** `<script src="/assets/circadian.js">` anywhere, and no
`/assets/circadian.js` to point at — the file is gone. chrome.js fetches the
package's copy when the theme is, or becomes, circadian.

---

## 2. Level 1 — the site row

Not ours. chrome.js renders the whole row into one mount, which is body's first
child; the rule under it is still ours.

```html
<body>
  <div data-chrome></div>
  <div class="chrome-rule" aria-hidden="true"></div>
```

What it draws: an **avatar pill** at the top left — a 64px glass circle at rest
that expands on hover or keyboard focus to "Ravi Vasavan" and a role line, which
on an experiment reads "‹ Back to Play" and links to `data-back` (on the landing
page it is his titles and links home). Touch never expands it. And a **menu
pill** at the top right — About · Play · theme — whose chip for the current
surface carries `aria-current="page"`. The theme chip owns the cycle day → night
→ system → circadian, persisted to `localStorage['theme']`: the same key on
every *.ravivasavan.com surface, so the choice follows the visitor across them.

The mount is `display: contents` and contributes no box. `.chrome-rule` is a
full-width hairline at `--chrome-rule`, and still means what it always meant —
everything above the line is the site's, everything below it belongs to the
experiment. The landing page has no rule.

### What a page must not do

- **No `@font-face` for Labil Grotesk.** chrome.css declares it. (§1.)
- **No level-1 markup or CSS.** `.chrome`, `.chrome__back` / `.chrome__id` /
  `.chrome__theme`, `.header-pills`, `.header-pill*` and `.icon-pill*` are gone
  from play.css, and so are the `data-tstate` theme glyph rules. A page that
  still carries any of that markup is drawing a second, dead header.
- **No theme handling.** No toggle, no `<meta id="theme-color">` painting, no
  circadian script. `[data-theme-toggle]` is not a hook any more and neither is
  `window.play.setTheme`; the way in, if a page ever needs one, is
  `window.rvChrome.setTheme('day'|'night'|'system'|'circadian')`.
- **No `scrollbar-gutter: stable`.** No page reserves a gutter: chrome.js
  measures the platform scrollbar and sets `--nav-right-comp` so the right-hand
  chrome lands on the same window x whether the page scrolls or not. Reserving
  a gutter fights it.
- **Nothing of yours prefixed `nav-id`, `nav-menu` or `nav-chip`**, and nothing
  of yours at z-index ≥ 500 — that is the chrome's (`--nav-z`). Play's own rail
  and dock sit at `--z-chrome` 500 with it; page content stays below 450.

### Geometry — why nothing under the line had to move

The package's `--nav-margin` steps 40 → 16 (≤900) → 12 (≤640) and its pills are
64px, which is exactly the fold play already had: `--chrome-top` 40/16/12,
`--chrome-rule` 144/96/88 (`margin + 64 + margin`) and `--chrome-tools`
160/112/104 line up underneath at every width. `--chrome-top` is now only the
package's margin restated — play.css positions nothing with it.

### The palette, if chrome.css never arrives

chrome.css ships `--bg --fg --separator --pill-*` and the theme blocks at
`:root`. play.css keeps a last-resort copy of the colours anchored to **`html`**
(0,0,1) rather than `:root`, so it sits below chrome.css whichever stylesheet
the page links first and can never shadow it: a chrome.css that fails to load
costs the page its nav, not its legibility. Everything the package does not
ship — `--ink`, `--muted`, `--field` — is derived from `--bg` / `--fg` at
`:root`, which matters under circadian: the package's circadian.js publishes
only `--bg`, `--fg`, `--separator` and `--pill-bg` inline, where play's old copy
also published `--ink`, `--muted` and `--field`.

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
| `.dock` | sideways scrolling when the verbs outgrow the space (touch pans natively) |
| `.rail` | vertical scrolling when the modes outgrow the height |
| `.sheet__body` | made `inert` while the sheet is folded and shut — and, with `.sheet__head`, while it is minimised — so the clipped controls leave the tab order and the a11y tree |
| `.sheet`, `.sheet__head`, `.sheet__grab`, `.is-open` | the bottom-sheet behaviour above |
| `.sheet__min`, `.sheet__icon` | injected if absent; the two halves of minimise |
| `<html data-play-sheet>` | `min` \| `open`, stamped before first paint from `localStorage['play.sheet']` |
| `input[type="range"].dial` | `--dial-fill` kept in step with the value, so the filled half of the track paints in WebKit |
| `window.play.dials(root?)` | call after setting a dial's value **in code** — an `input` event from the user is handled already |
| `window.play.openSheet(el)`, `window.play.closeSheet(el)`, `window.play.minimiseSheet(bool)`, `window.play.isSheetMinimised()` | if a page ever needs them |

play.js hooks nothing to do with the theme. The cycle, the `theme-color` meta
and circadian.js are the chrome package's — `window.rvChrome.setTheme(t)` and
`window.rvChrome.refresh()` are its whole API, and `[data-theme-toggle]` means
nothing to anything any more.

play.js is a classic script with `defer`, loaded **before** the page's own
scripts and before chrome.js. Anything of yours that reads `.sheet` geometry
should also be `defer`.

---

## 6. Tokens you may use

Colour: `--night --orange --olive --white`, `--bg --fg --ink --muted --field
--separator`, `--accent` (= `--orange`).
`--fg` and `--ink` are the same colour under two names — `--ink` is now defined
as `var(--fg)` — so use whichever your page already says.

`--bg`, `--fg`, `--separator` and the `--pill-*` trio come from chrome.css;
play.css keeps a fallback copy of the first three on `html`, and derives
`--ink`, `--muted` and `--field` from them at `:root`. Either way you just name
them. (§2, *The palette, if chrome.css never arrives*.)

**One glyph size, three container sizes, one hover.**

| | container | glyph | what it is |
|---|---|---|---|
| `.tool-pill` | 44 | 16 | level 2 — rail and dock, and the minimised drawer disc (`--sheet-min`) |
| `.panel-icon` | 32 | 16 | inside a panel — the drawer's minimise, melt's remove-point, chroma's padlocks |

Every glyph is 16px on the 24 grid — the chrome package's pills are drawn to the
same rule, at 64 (48 inner). Nothing else is a size: 28, 24 and 14 were all in
here and are not any more.

**And the artwork inside the glyph box is normalised too.** A 16px box is not
the same as a 16px icon: Lucide draws an eye 20 wide, a chevron 16, a download
18, and side by side on a rail the difference is the first thing you see. Every
glyph in a rail or a dock is scaled so its content spans **18 of the 24 grid**,
which draws at 12.0px, with the stroke compensated so it stays 1.33px whatever
the scale. That is done on the `<svg>` itself rather than by touching path data:

```html
<!-- content spans 20 → widen the viewBox by 20/18 and thicken the stroke to match -->
<svg viewBox="-1.3333 -1.3333 26.6667 26.6667" stroke-width="2.2222" …>
<!-- content spans 16 → narrow it -->
<svg viewBox="1.3333 1.3333 21.3333 21.3333" stroke-width="1.7778" …>
```

For a span S the box is `(12 − w/2) (12 − w/2) w w` where `w = S × 24 ÷ 18`, and
the stroke is `w ÷ 12`. A glyph already spanning 18 keeps `0 0 24 24` and
`stroke-width="2"`. Measure with `getBBox()`, but remember it answers in viewBox
units — multiply by `clientWidth / viewBox.width` to get what is drawn.

DialKit's own icons are exempt. It is a plugin and it brings its own set.

**The growing inner surface is level-1 chrome and nothing else**, which means it
is chrome.css's and not in this repo at all. That move needs empty ground to
arrive on, and the header is the only place there is any.

**Everywhere else the control already has a fill, so the hover works that fill.**
A play-space button is glass or a tinted chip before you touch it; growing a
second surface underneath reads as a second object arriving. Instead:

| | rest | hover |
|---|---|---|
| `.tool-pill` | glass | `inset 0 0 0 999px var(--wash)` over the glass, shadow lifts |
| `.sheet__icon` | transparent on glass | `background: var(--wash)` |
| `.panel-icon`, `.sheet__min` | 6% chip | `var(--wash-strong)` + a 22% hairline |
| `.btn` | filled form control | tints, like `.select` and `.input` |

`--wash` and `--wash-strong` are the two steps; `--focus-ring` is the one ring.
`:focus-visible` is the hover state **plus** the ring — not a second idiom, and
never a `box-shadow` that silently replaces a base hairline (restate it).

There is no `::before` grow left in `play.css` at all. If you add one, it is
wrong.

Glass: `--glass-bg --glass-blur --glass-edge --glass-specular --glass-radius`.

**Play's overlays are flat.** `--glass-shadow` and `--glass-shadow-sm` still
exist so nothing that names them breaks, but both are transparent and nothing
casts. An overlay is a tint, a blur and a hairline — that is the whole material.

This is not only taste. A drop shadow on a bar that has to scroll gets clipped
by the scroller at its padding edge, and what you see is a straight cut across
the glow; the fix was 32px of padding and a matching negative margin on every
side of every bar, and it had to be got right again at every fold. Flat has no
such failure mode, and the 64px of compensation came out of `.rail` and `.dock`
with it. Apply them with the `.glass` class rather
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
      twitter, theme-color **with the id**, the package's FOUC script, icons,
      the font preload pointing at ravivasavan.com, `chrome.css`, `play.css`).
- [ ] `<div data-chrome></div>` is body's **first** child, with `.chrome-rule`
      after it on an experiment page and no rule on the landing page.
- [ ] `<script src="https://ravivasavan.com/chrome/v1/chrome.js" defer>` at the
      end of body with `data-surface="play"` — plus `data-back` and
      `data-back-label` on an experiment, neither on the landing page.
- [ ] Deleted from the page: every level-1 pill — `.chrome`, `.chrome__*`,
      `.header-pills`, `.header-pill*`, `.icon-pill*`, the four `data-tstate`
      theme glyphs — in markup and in CSS.
- [ ] Deleted from the page's CSS: the Labil Grotesk `@font-face`, the `:root`
      / `:root[data-theme="night"]` / `prefers-color-scheme` token blocks, the
      reset, `scrollbar-gutter: stable`, `.rail`, `.dock`, `.tool-pill*`, and
      the generic control styles now covered by `.field`, `.dial`, `.input`,
      `.select`, `.textarea`, `.switch`, `.btn`, `.swatch`.
- [ ] No `LabilGrotesk` `@font-face` anywhere but chrome.css; the only
      reference left is the preload of the ravivasavan.com URL.
- [ ] `<script src="/assets/circadian.js">` removed; `<script
      src="/assets/play.js" defer>` added before the page's own scripts, which
      are `defer` too.
- [ ] The page's local theme-toggle listener, its theme-color painter and its
      `dragRow` IIFE deleted — chrome.js owns the first two, play.js the third.
      No `data-theme-toggle` left anywhere.
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

---

## 10. DialKit is a plugin — recolour it, do not redesign it

`poc/shared/dialkit-skin.css` maps DialKit's own `--dial-*` tokens onto the
site's colours and does **nothing else**. The panel is then the site's palette
in DialKit's layout: its row shapes, its slider, its folders, its buttons.

This file used to rebuild all of that — a slider taken apart and reassembled as
`.dial`, a 40px row height forced onto controls that are not rows, folder
headers restyled as section labels. The result read as neither DialKit nor the
site, and it squashed DialKit's own buttons into a shape they were never drawn
for.

**Nothing in that file may change a size, a shape or a spacing DialKit chose.**
The only exceptions are the handful of rules that hosting it *inline* requires —
without them a panel that thinks it is a floating window draws its own window
inside ours — and the two dropdowns, which portal to `<body>` where no token of
ours can reach them.

DialKit's icons are exempt from §6's glyph rule for the same reason. It brings
its own set.

Anything of ours that sits beside a DialKit control — chroma's padlocks — goes
in a gutter we make on our own container (`#dial-mount { padding-right }`), not
by reshaping a row DialKit drew.

---

## 11. The header band

There is no band. Level 1 is two pills of the package's own glass and the space
between them is the page — `play.css` draws `.chrome-rule` as a hairline and
nothing else.

If it ever comes back it belongs on `.chrome-rule::before`, a
`--chrome-rule`-tall band of `--glass-bg` and `--glass-blur` hanging off the
hairline. The rule is the only thing at that level we own: the package's mount
is `display: contents` and its pills are not ours to hang anything off, and
nothing here may reach into `.nav-id` / `.nav-menu` / `.nav-chip` to try.

It would be worth having only where the artwork runs **underneath** it — a glass
band over bare page is just a slightly different shade of page. That is one more
reason a stage should be the whole viewport with no padding reserved for the
chrome: chroma's preview bleeds to all four edges and the band would have
something to blur. It would go in the `prefers-reduced-transparency` list with
every other glass surface.
