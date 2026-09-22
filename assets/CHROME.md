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
  clear, plus the selectors and readout that belong beside them. Labels kept.
- The settings panel is **DialKit's own popover**, exactly as it ships — its
  bubble, its drag, its open/close motion — pinned under the menu pill by one
  rule in `poc/shared/dialkit-skin.css`. A page adds no positioning CSS of its
  own to it at all. It holds only DialKit-native parameter controls (slider,
  toggle, select, colour, text, spring, folder); everything else — verbs, the
  selectors that belong to a verb, free text, file input, readouts — lives in
  the dock. See §4 and §5.

A play keeps its own engine in plain JS and mounts a small React root whose
only job is the panel. What DialKit has no control for at all — a body of
copy, a list that grows as you click the canvas — stays in the dock, behind a
pill that opens it. See §9 for how a play wires its own React root to an
engine that doesn't know DialKit exists.

## Tools — the chrome's family (2026-09-18)

Everything a play puts on the canvas — the **rail**, the **dock** and the
**panel** — is one group, *Tools*, and it reads as an extension of the site
chrome, not a second system:

- **Rail** hangs under the avatar pill in its column: `left: --chrome-top`,
  `top: --chrome-tools` (pill bottom + 8px), 64px glass circles on the chrome's
  own material (`--pill-bg` / `--pill-filter` / `--pill-edge`), 8px apart. The
  icon sits on a 48px disc that fills at 6% on hover and stays filled at 12%
  when the mode is on — the same active state as the menu's chips. No accent.
- **Panel** hangs under the menu pill: DialKit's own popover, pinned there by
  `poc/shared/dialkit-skin.css` (`top: --chrome-tools`, `right: --panel-gap +
  --nav-right-comp`) and bounded to stop 8px above the dock. Bubble, drag,
  open/close motion are all DialKit's own, unstyled by us.
- **Dock** keeps its 44px pills — the one size exception — but wears the
  chrome's material. Position unchanged (bottom, centred).
  Its first and last **visible** children carry the auto margins, so hiding
  verbs when a play changes view preserves viewport centring. Use `hidden`
  on an unavailable pill; the remaining pills still overflow sideways. The
  existing folded layout keeps its start alignment and clears both margins
  on these same visible children.
- **Readout.** A dock may carry one non-button, `<p class="readout">`, for a
  line of status (chroma's composition · palette · zoom, teletext's page ·
  scheme · swatches): the same 44px pill and material as the verbs beside it,
  in the muted ink. Lives in play.css, not in a play's own CSS. §5.
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

## Layout: the content is the whole viewport, the panel overlays it

**No page reserves room for the panel.** The experiment's artwork is centred on
the *viewport's* centre and its canvases and backgrounds run edge to edge; the
glass lies on top and covers a corner of it. That is deliberate, and DialKit's
own bubble is the answer to it — one click and the whole panel collapses to
DialKit's own disc.

So: no `padding-right` for the panel, no shrunken stage, no `--sheet-inset` —
the token, and the sheet it inset for, are both gone. Pages that measure their
own stage measure the full viewport. On a phone there is no bottom sheet to
clear either: DialKit's popover bubbles the same way it does on desktop,
smaller, still under the menu pill's margin.

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
<nav class="rail" aria-label="Your play’s view">
  <button class="tool-pill" id="t-in" type="button" aria-label="Zoom in">
    <span class="tool-pill__icon"><svg viewBox="0 0 24 24" …>…</svg></span>
    <span class="tool-pill__label">In</span>
  </button>
</nav>
```

**The dock** takes the verbs — upload, export, shuffle, clear — plus the
selectors and readout that belong beside them (§5). They fire and they are
done, so they keep their labels and sit where the hand already is. It centres
on **the page**, not on the space beside the panel: the panel is an overlay
and it moves (DialKit drags and bubbles it on its own), and the verbs should
not shuffle sideways every time it does.

```html
<nav class="dock" aria-label="Your play’s actions">
  <button class="tool-pill" id="t-export" type="button" aria-label="Download the list as JSON">
    <span class="tool-pill__icon"><svg viewBox="0 0 24 24" …>…</svg></span>
    <span class="tool-pill__label">Export</span>
  </button>
</nav>
```

A play with nothing that changes what you're looking at gets no rail at all —
everything it has is a verb, and lives in the dock.

`.is-on` tints the text and icon `--accent` and swaps the hairline for an accent
one; in the rail that accent is how a mode reads as active with its label
hidden. `[disabled]` and `.tool-pill--danger` are also supported.

**Put nothing in either bar but a `.tool-pill`.** Both boxes are
`pointer-events: none` (the pills are `auto`) because the padding that keeps the
scroller from clipping their shadow makes them bigger than the pills. A hidden
`<input type="file">` does *not* belong in them — it is the dialog a pill opens,
not a control in the bar. Melt keeps `#file` outside both `.rail` and `.dock`
for exactly this reason; an earlier play that put one inside the tools row
threw on load the day the row was rebuilt.

A small always-on readout — chroma's composition, palette and zoom, melt's
point count and file name — rides in the dock as a chip beside the pills,
rather than floating separately at the bottom edge and fighting it at every
width. §5 has the markup.

Folded (≤900) the dock keeps its own bottom edge; it does not lift over
anything, because there is nothing fixed under it any more — DialKit's bubble
sits wherever DialKit puts it, independent of the dock's geometry. The rail
keeps its column. Anything else of yours anchored to the bottom edge has to
clear the dock: 44px of pill on `--panel-gap`, plus a gap.

## 4. The panel — DialKit as shipped

The settings panel on every play is DialKit's own popover, mounted once and
left alone:

```jsx
<DialRoot
  mode="popover"
  position="top-right"
  productionEnabled
  defaultOpen={readOpen()}
  onOpenChange={writeOpen}
/>
```

rendered into `<div id="root"></div>`, the mount's only job. `readOpen` /
`writeOpen` read and write one site-wide preference, the way every other
play's does:

```js
const PANEL_KEY = 'play.panel';               // 'open' | 'min'
function readOpen() {
  try { return localStorage.getItem(PANEL_KEY) !== 'min'; } catch (e) { return true; }
}
function writeOpen(open) {
  try { localStorage.setItem(PANEL_KEY, open ? 'open' : 'min'); } catch (e) {}
}
```

That is the whole contract on the page's side. There is no `.sheet`, no head,
no minimise button, no bottom sheet, no fold behaviour to write — DialKit's
popover ships its own bubble, its own drag, its own open/close motion, and
`defaultOpen`/`onOpenChange` are the only hooks a page needs into any of it.

**Hosts add no positioning CSS of their own.** The one override is
`poc/shared/dialkit-skin.css`'s rule for `.dialkit-panel[data-mode="popover"]`:
`top: var(--chrome-tools)`, `right: calc(var(--panel-gap) +
var(--nav-right-comp, 0px))` — the same margin-plus-scrollbar-compensation term
the menu pill uses, so the two right edges line up — and `z-index:
var(--z-sheet)` (450, under the chrome's 500). The panel's own inner scroll box
is bounded there too, to stop 8px above the dock's 44px pills (16px on ≤900
folds, where the dock keeps an 8px pad inside the margin). A play's own CSS
never touches `.dialkit-panel` or `.dialkit-panel-inner` for position, size or
z-index — only the skin does, in the one file every play links.

The skin also recolours DialKit's `--dial-*` tokens from the site palette (§7,
§11) and hands its two body-portaled dropdowns (the select, the presets menu)
the site's glass, since nothing scoped to the panel can reach something that
portals to `<body>`.

**What may live in the panel: DialKit-native parameter controls only** —
slider, toggle, select, colour, text, spring, folder. DialKit's own *actions*
are reserved for things that act on a parameter: melt's `remove` action per
point, a reset. Everything else — a verb (export, copy, randomise, an
open-in), the selector that belongs to a verb (export size, export format),
free multi-line text, a file input, a readout — is not a DialKit control, so
it does not go in the panel. It goes in the dock. §5 has the full list and the
markup.

**One allowed injection.** A per-row adornment that attaches to a parameter
and does not change DialKit's own geometry may sit beside a row DialKit drew —
chroma's padlocks are the example. It lives in a gutter made by extra right
padding on the panel's own scroll box, never by reshaping a row:

```css
/* chroma.css */
.dialkit-panel .dialkit-panel-inner { padding-right: calc(12px + 26px); }
.dialkit-panel .has-lock { position: relative; }
.prop-lock { position: absolute; right: -24px; top: 50%; transform: translateY(-50%); /* … */ }
```

That is the only place a play's own CSS is allowed to name `.dialkit-panel` or
`.dialkit-panel-inner` at all.

**Phone consequence:** there is no bottom sheet any more. DialKit's popover
bubbles the same way on a phone as it does on desktop — smaller, still pinned
under the menu pill's margin — rather than swinging to the bottom of the
screen. Nothing in play.css or a play's own CSS handles a phone case for the
panel; there isn't one.

## 5. The dock — verbs, selectors, readout

Everything that is not a DialKit-native parameter control lives here (or in
the rail, for a view tool — §3): verbs, the selectors that belong to a verb,
free multi-line text, file input, and the readout.

**The selector pill** is a 44px pill whose whole face is the native `<select>`
— invisible, laid on top — so the platform's own menu opens and the pill still
reads as a pill. The label is the current choice, kept in step by the play's
own script; the chevron just says it opens.

```html
<label class="tool-pill tool-pill--select" aria-label="Export size">
  <span class="tool-pill__label" id="size-label">7680 × 4320 · 16:9</span>
  <span class="tool-pill__chevron" aria-hidden="true">
    <svg viewBox="0 0 24 24" …><path d="m6 9 6 6 6-6"/></svg>
  </span>
  <select class="tool-pill__select" id="resolution">
    <option value="7680x4320">8K · 7680 × 4320</option>
    <!-- … -->
  </select>
</label>
```

**The readout** is a dock's one non-button: a line of status on the same 44px
pill and material as the verbs beside it, in the muted ink, `<span
class="readout__sep">·</span>` between parts.

```html
<p class="readout" aria-live="polite">
  <span id="composition-label">Aperture · 0042</span>
  <span class="readout__sep">·</span>
  <span id="palette-name">Rose room</span>
  <span class="readout__sep">·</span>
  <span data-view-level>100%</span>
</p>
```

Chroma's reads composition · palette name · zoom; melt's reads point count ·
file name; teletext's reads page/layout/scheme plus five 8px colour dots;
magnetic's reads tile count.

**The bridge.** A play's engine keeps listening to the same inputs it always
did — an app.js written before DialKit existed doesn't change. Those inputs
move into a `<div class="bridge" hidden aria-hidden="true">` at the end of the
body, and the panel drives them instead of a hand:

```html
<div class="bridge" hidden aria-hidden="true">
  <input id="flow" type="range" min="0" max="100" value="60" tabindex="-1">
  <input id="seed" type="number" min="0" max="999999" step="1" value="42" tabindex="-1">
  <!-- … palette buttons, colour pickers, the copy textarea, the file input … -->
</div>
```

**The state round-trip** is two one-way streets, not a binding:

- *Panel → engine.* On a DialKit value changing, set the bridged element's
  `.value` and fire the event the engine already listens to — compare before
  writing, so an echo doesn't turn into a loop:

  ```js
  function drive(id, event, value) {
    const el = document.getElementById(id);
    if (!el || String(el.value) === String(value)) return;
    el.value = String(value);
    el.dispatchEvent(new Event(event, { bubbles: true }));
  }
  ```

- *Engine → panel.* When the engine moves a value itself — Randomise, Reset, a
  recipe in the URL hash, a 15° snap — it dispatches one `CustomEvent` on the
  document (chroma's is `chroma:sync`) carrying everything that changed, and
  the panel's `useEffect` echoes it straight into DialKit with
  `controller.setValues({ … })`. Because the drive functions above already
  compare before writing, the panel doesn't need a re-entrancy flag to keep
  that echo from bouncing back out to the engine.

---

## 6. What play.js hooks

play.js has nothing left to say about the panel — DialKit keeps its own open
state, its own focus handling, its own `inert`ing of what's behind it when it
bubbles. What is left is the rail, the dock, and panning:

| Hook | What it does |
|---|---|
| `.dock` | sideways drag-to-scroll when the verbs outgrow the space (touch pans natively); swallows the click a drag would otherwise finish on |
| `.rail` | the same, vertically, when the modes outgrow the height |
| `input[type="range"].dial` | `--dial-fill` kept in step with the value, so the filled half of the track paints in WebKit. None of the four adopted plays' bridged inputs carry this class any more — DialKit drives them directly — but it still fires on any page that keeps a real, visible `.dial` |
| `window.play.dials(root?)` | call after setting a `.dial`'s value **in code** — an `input` event from the user is handled already |
| `[data-pan]`, `[data-pan="free"]` | the panning and zoom behaviour, §10 |

play.js hooks nothing to do with the theme. The cycle, the `theme-color` meta
and circadian.js are the chrome package's — `window.rvChrome.setTheme(t)` and
`window.rvChrome.refresh()` are its whole API, and `[data-theme-toggle]` means
nothing to anything any more.

**The panel API is gone.** `window.play.openSheet` / `closeSheet` /
`minimiseSheet` / `isSheetMinimised` do not exist; there is no sheet to drive.
A page that wants to know or set whether the panel is open reads or writes
`localStorage['play.panel']` itself (§4) — DialKit reads that on mount through
`defaultOpen` and reports every change back through `onOpenChange`.

play.js is a classic script with `defer`, loaded **before** the page's own
scripts and before chrome.js.

---

## 7. Tokens you may use

Colour: `--night --orange --olive --white`, `--bg --fg --ink --muted --field
--separator`, `--accent` (= `--orange`).
`--fg` and `--ink` are the same colour under two names — `--ink` is now defined
as `var(--fg)` — so use whichever your page already says.

`--bg`, `--fg`, `--separator` and the `--pill-*` trio come from chrome.css;
play.css keeps a fallback copy of the first three on `html`, and derives
`--ink`, `--muted` and `--field` from them at `:root`. Either way you just name
them. (§2, *The palette, if chrome.css never arrives*.)

**One glyph size, one hover.**

| | container | glyph | what it is |
|---|---|---|---|
| `.tool-pill` | 44 | 16 | level 2 — rail and dock |

There is no shared `.panel-icon` size any more: the popover's own chrome
(minimise, close, folder toggles) is DialKit's to draw, at whatever size it
draws it. A per-row adornment injected into the panel (§4) is sized by the
play that adds it — chroma's `.prop-lock` is 22px, defined in `chroma.css`,
not in play.css.

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
| `.btn` | filled form control | tints, like `.select` and `.input` |

The popover's own hover states — a row, a folder header, its own icon buttons
— are DialKit's, recoloured by the skin's `--dial-*` tokens (§11) and not
touched here.

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

DialKit's own text sits directly on the panel's glass rather than under a
second, denser tint the way the old sheet raised its own `--muted`: the skin
writes `--dial-text-label` and friends at a flat 82% of `--fg` (not derived
from `--muted`'s 55%, which measures 1.4–2.4:1 over a saturated canvas) because
its two portaled dropdowns hang off `<body>`, outside any element that could
redefine `--muted` for them. Nothing here needs restating in a page's own CSS
— the skin is the one place that value lives.

Geometry: `--chrome-top --chrome-rule --chrome-tools --chrome-pad --panel-gap`.
**`--panel-w`, `--sheet-min` and `--sheet-top` are gone** along with the sheet
they measured — the panel is DialKit's own popover and sizes itself.
**`--sheet-inset` is gone** too — nothing reserves room for the panel, so
there is nothing to inset.

Stacking: `--z-sheet` 450 < `--z-rule` 499 < `--z-chrome` 500. The name is the
old drawer's, kept because `dialkit-skin.css` still reads it as the popover's
own floor. Keep your page's own content below 450.

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

## 8. Checklist per page

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
- [ ] The panel is `<DialRoot mode="popover" position="top-right"
      productionEnabled defaultOpen={readOpen()} onOpenChange={writeOpen} />`
      mounted at `<div id="root"></div>`, reading/writing
      `localStorage['play.panel']` (§4). No `.sheet`, no `#dial-mount`, no
      `mode="inline"`, no `createPortal` anywhere.
- [ ] The panel holds DialKit-native parameter controls only. A verb, a
      selector that belongs to a verb, free multi-line text, a file input or a
      readout is in the dock instead (§5) — never forced into the panel as a
      DialKit action or a custom row.
- [ ] The page's own CSS never names `.dialkit-panel` or `.dialkit-panel-inner`
      except for the one allowed injection (a per-row adornment gutter, §4).
      No positioning, sizing or z-index rule of the page's own touches either.
- [ ] The experiment's buttons are split between `.rail` (what changes the
      view), `.dock` (the verbs, selectors and readout) and the panel
      (parameters) — the rail and dock hold nothing that is not a `.tool-pill`
      (or the one `.readout`) — a hidden file input goes outside all three.
- [ ] Anything of the page's own anchored to the bottom edge clears the dock.
- [ ] Nothing reserves room for the panel: no `--sheet-inset`, `--panel-w`,
      `--sheet-min` or `--sheet-top` anywhere in the CSS or the script — they
      don't exist any more. The stage is the full viewport and its artwork is
      centred on the viewport's centre.
- [ ] Every parameter that used to be a checkbox is a DialKit toggle now; a
      checkbox that isn't a parameter (rare) still uses `.switch`.
- [ ] Every parameter that used to be a range input is a DialKit-native
      control; the bridged `<input type="range">` behind it (§5) carries no
      `class="dial"` and is driven only by the panel, never by hand.
- [ ] **Every id, name and data-attribute the page's own script reads is
      unchanged.** Rewrap the markup, put it in the `.bridge` (§5), never
      rename the hooks.
- [ ] `assets/img/favicon.svg` and `assets/img/apple-touch-icon.png` referenced.
- [ ] Checked at 1440 and 390, day and night, with no console errors.

---

## 9. The dials are DialKit

Every play's panel is DialKit's own popover, mounted at `<div id="root"></div>`
with a plain `createRoot(...).render(...)` — no portal, no `mode="inline"`, no
mount div of the page's own. The engine stays plain JavaScript — canvas,
WebGL, whatever it already was — and a small React root does nothing but own
the controls and drive the engine's existing inputs (§5):

```jsx
function mount() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Controls />
      <DialRoot mode="popover" position="top-right"
                defaultOpen={readOpen()} onOpenChange={writeOpen} productionEnabled />
    </React.StrictMode>
  )
}
```

There is no `theme` prop set. `poc/shared/dialkit-skin.css` repaints
`--dial-*` from the site's tokens (§11) — colour is the skin's job, not a
DialKit theme name's.

Each play is its own Vite project under `poc/<slug>/`, building straight into
its dated folder, and takes its Geist-Mono dropper and chunk split from
`poc/shared/vite-dialkit.js`. The engine ships as a plain file in `public/` and
loads as a classic `defer` script.

**Mounting order is the thing that bites.** Vite hoists the module into
`<head>`, so in document order it runs *before* the engine's defer script
further down the body. Both finish before `DOMContentLoaded`, so that is when to
mount — unless the engine is itself a `DOMContentLoaded` handler (melt), in
which case its listener is registered *second* and the panel has to wait for a
custom event the engine dispatches once it's actually ready (melt's is
`melt:ready`).

**The engine keeps the state.** The panel reads it once, through
`useDialKitController`'s defaults, to open on it; every value that changes
after is driven onto the engine's own inputs via the bridge (§5), and when the
engine moves a value itself — a randomise, a reset, a recipe in the hash, a
snap to 15° — it tells the panel through a `CustomEvent`, which the panel
echoes into `controller.setValues({ … })`. The drive functions compare before
writing (§5), so that echo does not need a re-entrancy flag to stay out of a
loop.

**What DialKit has no control for at all stays in the dock, behind a pill.**
There is no multi-line text, no custom control and no per-dial lock as a
DialKit primitive, so teletext's copy bar, melt's file input and chroma's
padlocks are ordinary markup outside the panel (§5), or the one allowed
in-panel injection (§4). That is the expected shape, not a workaround — the
panel is for parameters.

**DialKit titles a dial from its key.** `everywhere: [0, 0, 40, 1]` renders
"Everywhere"; there is no label option on the range shorthand. Name the key what
the play calls the thing, and map it to the engine's own name on the way
through.

---

## 10. Panning

The panel is an overlay, so it will sometimes lie on the part of the artwork
you wanted. Bubbling it (DialKit's own, one click) is one answer; moving the
artwork out from under it is the other, and play.js gives every stage the
second one.

```html
<main id="stage" data-pan="free">   <!-- pointer is free: plain drag pans -->
<main id="stage" data-pan>          <!-- pointer is spoken for: space or middle-drag -->
```

`data-pan="free"` is for a stage that does nothing with the pointer — teletext,
chroma — and it pans on an ordinary drag, with a `grab` cursor to say so.
`data-pan` alone is for a stage that uses the pointer for its own work — melt
places points, magnetic throws windows — and pans only on the middle button or
with space held, which is the idiom every canvas tool already uses.

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
the dock's readout, beside the composition and the palette name.

**There is no 1:1, on purpose.** Every one of these stages draws its canvas at
exactly the size it is displayed — buffer and CSS box are the same number — so
"actual size" and "fit" are the same view and the button would do nothing.
Chroma is the one place the phrase means something and there it would mean
something false: the preview is capped at 1920 on its longest edge, so it does
not hold the export's pixels to show you.

A stage whose canvas is full-bleed and does nothing at all with the pointer
takes neither attribute on purpose — there is nothing behind the glass but
more of the same pattern to pan to.

---

## 11. DialKit is a plugin — recolour it, do not redesign it

`poc/shared/dialkit-skin.css` maps DialKit's own `--dial-*` tokens onto the
site's colours and does **nothing else**. The panel is then the site's palette
in DialKit's layout: its row shapes, its slider, its folders, its buttons.

This file used to rebuild all of that — a slider taken apart and reassembled as
`.dial`, a 40px row height forced onto controls that are not rows, folder
headers restyled as section labels. The result read as neither DialKit nor the
site, and it squashed DialKit's own buttons into a shape they were never drawn
for.

**Nothing in that file may change a size, a shape or a spacing DialKit chose.**
The only exceptions are *where* the popover sits — `top`, `right` and
`z-index` on `.dialkit-panel[data-mode="popover"]`, and the `max-height` bound
on `.dialkit-panel-inner` that stops it under the dock (§4) — and the two
dropdowns, which portal to `<body>` where no token of ours can reach them
without a rule of our own.

DialKit's icons are exempt from §7's glyph rule for the same reason. It brings
its own set.

Anything of ours that sits beside a DialKit control — chroma's padlocks — goes
in a gutter made by extra `padding-right` on `.dialkit-panel-inner` (chroma.css,
§4), not by reshaping a row DialKit drew.

---

## 12. The header band

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

## Drift gallery exception (2026-09-22)

Ravi explicitly requested Drift's previous/next and zoom controls in the dock,
with one Grid/Single morphing toggle in the rail and no Back or Original.
`.tool-pill--icon` is the shared 44px icon-only variant: its accessible label
remains in the DOM. Drift's gallery may have three separate `.readout` chips
(name, image count, zoom), plus Close. Other plays retain the usual rail/dock
placement, visible verb labels and single readout. The overlay traps focus,
steps single → gallery → drift on Escape or backdrop activation, and restores
focus to the source work when closed. The Close verb exits directly.

### Quiet dock hover and spacing between groups

Dock chip hover holds its inset wash at a fixed 999px spread in both resting
and hover states; only the tint fades over 120ms. Do not interpolate between a
missing wash and a large spread. The hairline remains in both states.
`data-dock-group-start` adds a 16px left margin to a non-leading chip, for 24px
between groups including the normal 8px gap. Drift assigns groups to visible
chips: filename, previous/count/next, zoom, playback (when present), then Close.
The name chip always shows the current asset's filename, including in overview.
