# AGENTS.md — how a play is allowed to look

The GitHub repository is **experiments** (it was `ravivasavan/play`). Vibecoded plays are published at [ravivasavan.com/experiments](https://ravivasavan.com/experiments/). Drift the experiment is [ravivasavan.com/experiments/20260922/drift](https://ravivasavan.com/experiments/20260922/drift/). The art share at [ravivasavan.com/play](https://ravivasavan.com/play/) is the `play/` folder, a graduated copy with its own files. `play.css` and titles of the form `Slug — play` stay as they are.

Instructions for any agent working in this repo: Claude Code, Codex, Cursor, a
sub-agent, a human in a hurry. `CLAUDE.md` imports this file; there is one set
of rules and this is it. Nothing here is a suggestion. Where a rule and your
instinct disagree, the rule wins, and if the rule is wrong the fix is a
decision note in the vault and an edit here — not a quiet exception in one play.

`vault: personal` · project `experiments` (the site is still play) · session state lives at
`~/Projects/Personal/obsidian/journal/play/next.md`, never in this repo.

## Read order, before touching anything

1. This file — the taste, as rules.
2. `assets/CHROME.md` — the contract: markup, tokens, geometry, the per-page
   checklist. It is long because it is complete. Read the sections you touch.
3. `~/Projects/Personal/ravi/chrome/README.md` — the shared level-1 chrome
   package. It wins over everything here on anything level 1.
4. `poc/chroma/` — the reference play. Copy it; do not improvise a new shape.

## The one idea

**Level 1 is the site's. Level 2 is the tool's. Settings float above the
artwork on a pane of glass; they are never a sidebar cut out of the page.**

Everything below is that sentence applied.

## Level 1 — the site chrome is not yours

The avatar pill, the menu pill, the theme cycle, the theme-color meta, the
type, circadian: all of it is the shared package at
`https://ravivasavan.com/chrome/v1/`, mounted into `<div data-chrome>` as
body's first child. A page owns exactly two pieces of it: the
`<meta name="theme-color" id="theme-color">` and the FOUC script copied
verbatim from CHROME.md §1.

Never:

- write nav markup or nav CSS, a theme toggle, a theme-color painter, or a
  copy of circadian.js in a play
- declare `@font-face` for Labil Grotesk anywhere but chrome.css (a
  `<link rel="preload">` of the same URL is fine)
- set `scrollbar-gutter: stable` (chrome.js measures the scrollbar and sets
  `--nav-right-comp`; a gutter fights it)
- name anything of yours `nav-id`, `nav-menu`, `nav-theme`, `nav-chip`,
  `nav-dial`
- put page content at z-index 450 or above. Bands: content < 450 ·
  `--z-sheet` 450 (the panel) · `--z-chrome` 500 (rail, dock, nav)
- draw the `.chrome-rule`. It is `display: none`; drop it from templates as
  they are rebuilt

The theme API, if a play ever needs one, is `window.rvChrome.setTheme()` and
`window.rvChrome.setTone()`. `[data-theme-toggle]` and `window.play.setTheme`
do not exist.

## Level 2 — the Tools are one family

Everything a play puts on the canvas is one group, **Tools**: the **rail**,
the **dock**, the **panel**. They read as an extension of the site chrome, on
the chrome's own material, hung off the chrome's own geometry. Nothing else
floats on the canvas. No prompts, no hints, no "click anywhere", no floating
labels, no second toolbar.

### Where a control goes — decide by what it does, not by what is convenient

| It… | goes in | as |
|---|---|---|
| changes **what you are looking at** (view mode, zoom, step back) | **rail** | `.tool-pill`, icon only, label kept in the a11y tree |
| **does something** and is done (upload, export, shuffle, clear, copy, reset) | **dock** | `.tool-pill`, icon + one-word label |
| is the **selector that belongs to a verb** (export size, format) | **dock** | `.tool-pill--select`, native `<select>` as the pill's face |
| is **free text**, a **file input**, a **body of copy**, a list that grows | **dock**, behind a pill that opens it | ordinary markup; the hidden `<input type="file">` sits outside all three bars |
| is a **line of status** (composition · palette · zoom) | **dock** | exactly one `<p class="readout">`, muted ink, `·` separators |
| is a **parameter of the artwork** (a number, a switch, a choice, a colour) | **panel** | a DialKit-native control and nothing else |

A play with nothing that changes the view has no rail. A play with no verbs
has no dock. Never build a bar to have somewhere to put things.

### Rail

- 64px circles in the avatar pill's column: `left: --chrome-top`,
  `top: --chrome-tools`, 8px apart. The icon sits on a 48px disc.
- Hover fills the disc at 6%; the mode that is **on** stays filled at 12%.
  That is the whole active state. No accent ring, no accent tint, no outline.
- Icon only. A vertical column of words is a menu, not a rail.
- Zoom pills are their own `.rail__group--zoom` and go through the one
  `[data-pan]` stage's view via `data-view="in|out|fit"`. `fit` lights when
  there is anything to go back from. **There is no 1:1 button, on purpose.**

### Dock

- 44px pills — the one size exception in the whole family — on the chrome's
  material. Bottom edge, centred **on the viewport**, not on the space beside
  the panel. The panel moves; the verbs do not shuffle to follow it.
- Labels stay. Verbs are words: Export, Randomise, Clear, Copy, Reveal. One
  word, sentence case, the word a person would say.
- Put nothing in a bar but a `.tool-pill` or the one `.readout`. The bars are
  `pointer-events: none`; anything else in there is a bug waiting for a
  rebuild.
- Overflow scrolls sideways (play.js). It does not shed labels, wrap, or
  shrink.
- Anything else a play anchors to the bottom edge clears the dock: 44px on
  `--panel-gap`, plus a gap.

### Panel — DialKit as shipped

The settings panel is DialKit's own popover. Its bubble, its drag, its
open/close motion, its minimise. Quick and snappy because it is DialKit's,
not because we tuned it. This is the exact mount, and it is the only mount:

```jsx
<DialRoot mode="popover" position="top-right" productionEnabled
          defaultOpen={readOpen()} onOpenChange={writeOpen} />
```

rendered at `<div id="root"></div>` with a plain `createRoot`. `readOpen` /
`writeOpen` read and write the one site-wide key `localStorage['play.panel']`
(`'open' | 'min'`). Wait for the engine's `<slug>:ready` event before
mounting — Vite hoists the module into `<head>` and it will otherwise run
before the engine has published its state.

Never:

- `mode="inline"`, `createPortal`, a mount div of the page's own, a `theme`
  prop, `.sheet`, `#dial-mount`, a minimise button, a bottom sheet, a fold
  animation. None of these exist any more and none come back.
- position, size or z-index the panel from a play's CSS. The **one** file
  allowed to name `.dialkit-panel` for that is `poc/shared/dialkit-skin.css`,
  and it does exactly three things: pins the popover under the menu pill,
  bounds its scroll box above the dock, and recolours DialKit's `--dial-*`
  tokens from the site palette.
- change a size, a shape or a spacing DialKit chose. **Recolour it; do not
  redesign it.** If something in the panel looks wrong, it is DialKit's to
  look like.
- put a verb, a selector, free text, a file input or a readout in the panel —
  not as a DialKit action, not as a custom row. DialKit *actions* are for
  things that act on a parameter (reset, remove a point).
- omit `productionEnabled`. DialKit hides itself in production builds without
  it and the panel silently vanishes.

**One allowed injection:** a per-row adornment that attaches to a parameter
and does not change DialKit's geometry (chroma's padlocks). It lives in a
gutter made by extra `padding-right` on `.dialkit-panel-inner`, never by
reshaping a row. That is the only place a play's own CSS may name
`.dialkit-panel` or `.dialkit-panel-inner` at all.

DialKit titles a control from its key. Name keys what the play calls the
thing (`radiance`, not `glow_amt`) and map to the engine's name on the way
through.

### Engine and panel — two one-way streets

- The **engine** is plain JavaScript in `public/`, loaded as a classic
  `defer` script. It keeps the state. It listens to the same inputs it always
  did; those inputs move into `<div class="bridge" hidden aria-hidden="true">`
  at the end of body. **Never rename an id, name or data-attribute the
  engine's script reads.** Rewrap the markup; never rename the hooks.
- The **React root** does one thing: own the panel and drive the bridged
  inputs. Panel → engine: set `.value`, fire the event the engine listens to,
  **compare before writing**. Engine → panel: one `CustomEvent` on the
  document (`chroma:sync`) carrying everything that changed, echoed into
  `controller.setValues()`. Because the drives compare first, there is no
  re-entrancy flag.
- The engine publishes `window.<slug>` and dispatches `<slug>:ready`. The
  panel mounts on that.

## Material — glass, and flat

An overlay is **a tint, a blur and a hairline. That is the whole material.**
Use the `.glass` class; do not compose it by hand.

- The Tools wear the chrome's material: `--pill-bg`, `--pill-filter`,
  `--pill-edge`. Not a denser glass, not a solid, not a card.
- **Nothing casts a shadow.** `--glass-shadow` and `--glass-shadow-sm` are
  transparent and stay so. No drop shadow, no specular highlight, no
  scroll-hint inset, no glow. If a shadow is ever wanted it would be the
  pane's own background colour fading out — and on a pane tinted from the
  canvas that is a glow, so: none.
- **Hover works the fill it already has.** `.tool-pill` hover is
  `inset 0 0 0 999px var(--wash)` over the glass. There is no `::before` grow
  anywhere in play.css; if you add one, it is wrong. The growing inner
  surface belongs to the level-1 chrome and nowhere else.
- `:focus-visible` is the hover state **plus** `--focus-ring`. Never a
  `box-shadow` that silently replaces a base hairline; restate it.
- Two wash steps, `--wash` and `--wash-strong`. One ring. No third.
- `prefers-reduced-transparency: reduce` turns every glass surface opaque.
  Anything new that is glass goes in that list.
- Well rounded: `--glass-radius`. Corners are never sharp on an overlay.

## Colour — the theme decides everything

- **The theme always decides the colours.** Day, night, system, circadian: one
  cycle, owned by the chrome, persisted to `localStorage['theme']` across
  every `*.ravivasavan.com` surface.
- A canvas that ignores the theme does **not** flip the pills to the
  opposite tone. It sets `html[data-chrome-tone]` (or `rvChrome.setTone()`),
  which only makes the glass self-sufficient — 80% of the theme's `--bg` and a
  firmer hairline — on every Tools container at once. Chroma decides it from
  the **rendered pixels** under the pill row, not from palette heuristics.
- Tokens you may use: `--night --orange --olive --white`, `--bg --fg --ink
  --muted --field --separator`, `--accent`, the `--pill-*` trio, the
  `--glass-*` set, `--wash --wash-strong --focus-ring`. `--fg` and `--ink` are
  the same colour. Anything a play derives, it derives from `--bg` / `--fg` at
  `:root`, so circadian reaches it — circadian publishes only `--bg`, `--fg`,
  `--separator`, `--pill-bg`.
- **Write theme selectors as `:root[data-theme="night"]`, never bare
  `[data-theme="night"]`.** DialKit stamps `data-theme` on its own root and a
  bare selector repaints the panel from the inside.
- `--accent` (orange) is for state that means something — a selected option,
  a live status — never for hover, never for the rail's active mode.
- A page-specific palette (teletext's eight, chroma's stories) lives in the
  page's own CSS or engine, scoped to the artwork, and never redefines a site
  token.

## Layout — the content is the whole viewport

- The artwork centres on **the viewport's own centre**. No top padding for
  the chrome, no floor under the rail, no bottom padding for the dock, no
  `padding-right` for the panel. The Tools lie over it.
- Canvases and backgrounds run edge to edge. A stage that measures itself
  measures the full viewport.
- `--sheet-inset`, `--panel-w`, `--sheet-min`, `--sheet-top` do not exist.
  Nothing reserves room for the panel; the answer to "the panel is on my
  artwork" is DialKit's bubble or panning.
- **Panning is play.js's.** `data-pan="free"` when the pointer is otherwise
  idle (chroma, teletext); `data-pan` alone when the stage uses the pointer
  (melt, magnetic) — then it pans on middle button or space. A full-bleed
  pattern that does nothing with the pointer takes neither. Offset clamps to
  60% of the viewport; there is no reset button.
- Breakpoints are the chrome's: ≤900 and ≤640. Every position derives from
  `--chrome-top` (40 / 16 / 12). Do not introduce a third fold.
- Grid columns that hold a canvas are `minmax(0, 1fr)`, never bare `1fr`.

## Type and glyphs

- Labil Grotesk, from chrome.css, everywhere the site speaks. A play with a
  face of its own (teletext's Bedstead) declares only that one, self-hosted
  from `/assets/fonts/`. **No Google Fonts, no runtime font CDN.** The Vite
  helper strips DialKit's Geist Mono import for exactly this reason.
- **One glyph size: 16px on the 24 grid**, in a 44px pill (rail and dock).
  Nothing else is a size. 28, 24 and 14 were in here and are not any more.
- Lucide glyphs are **normalised so the drawn content spans 18 of the 24
  grid**, on the `<svg>`'s `viewBox` and `stroke-width`, never by editing path
  data. CHROME.md §7 has the formula. Measure with `getBBox()`.
- DialKit's icons are exempt. It is a plugin and brings its own set.
- Tabular numbers for anything that ticks.

## Motion

- DialKit's motion is DialKit's. Do not slow it, ease it, or re-time it.
- The experiment's own motion respects `prefers-reduced-motion`. The chrome's
  is handled for you.
- Quick and snappy over choreographed. A control answers on the frame it is
  touched.

## Copy

- Verbs are one word. Modes are one word. Readouts are fragments separated by
  `·`, never sentences.
- No onboarding text on the canvas. People find the click.
- `<title>` is `Slug — play`. The description is one page-specific sentence.
- Names in the timeline are what the thing is called, not what it does.

## Build and ship

- A play with dials is its own Vite project at `poc/<slug>/`, building
  straight into its dated folder `/<YYYYMMDD>/<slug>/`. Copy `poc/chroma/`,
  change the two paths in `vite.config.js`, keep `../shared/vite-dialkit.js`
  for the chunk split and the Geist-Mono dropper.
- A play with no dials is plain HTML/CSS/JS in its dated folder, no build.
- `dialkit` is pinned at `1.4.3`, React at 18. Do not bump one play alone.
- The committed bundle in the dated folder is what ships. `poc/` is the
  source. `node_modules` is ignored. Rebuild is `npm run build` in the poc.
- Anything bigger than a play — a server, a router, a real app — gets its own
  repo and links in by `url`.
- Every play gets an entry in `assets/timeline/experiments.json`, three shots
  at `assets/timeline/<slug>/` (1280×800, whole-screen views, mix day and
  night), a glyph in `GLYPHS`, and a line in the `<noscript>` list in
  `index.html`. README has the entry shape.
- Fonts and samples a play needs ship via `public/`; fetches use
  `import.meta.env.BASE_URL`, never an absolute `/`.

## Verify before you say it is done

- 1440 and 390. Day and night. Zero console errors. Panel open and bubbled.
- Both drive directions across the bridge (panel → engine, engine → panel).
- The mount race: delay the engine script ~1.5s and confirm the panel still
  opens on the engine's state.
- A deploy is confirmed by grepping the served page for a string unique to the
  new build (`curl -sS "https://ravivasavan.com/experiments/…?cb=$RANDOM"`), not by
  polling the Pages builds API — it lies.
- Run CHROME.md §8, the per-page checklist, and mean it.

## What goes where, in the repo

- **play.css / play.js** hold what every play shares: tokens, rail, dock,
  selector pill, readout, glass, panning. A pattern two plays need goes here,
  not in both plays.
- **poc/shared/dialkit-skin.css** holds the only CSS in the world that may
  position the panel or recolour DialKit.
- **A play's own CSS** names only the play's own things: its canvas, its
  bridge, its one allowed panel gutter. Never `.rail`, `.dock`, `.tool-pill`,
  `.readout`, `.dialkit-*` (bar the gutter), never a site token block.
- **CHROME.md** is the contract. If you change the chrome, change CHROME.md
  in the same commit. If you find CHROME.md and this file disagree, this file
  is the taste and CHROME.md is the mechanism; fix the one that is stale and
  say so in the commit.

## When to stop and ask Ravi

Do not proceed on your own judgement for any of these. Propose, with a
screenshot, and wait:

- a new control type, a new material, a new size, a new position, a new fold
- a shadow, a glow, a gradient, a border heavier than a hairline
- a third bar, a second panel, a control on the canvas outside the Tools
- anything that would touch level 1
- a play that "needs" a framework, a router, a server
- restyling DialKit beyond colour

Ravi's own words, for calibration: *"use dialkit default, quick and snappy,
and the minimise/etc should be dialkit as is out of box"*; *"if it is not
dialkit native, move that tool/selector into the bottom dock"*; on flipping
the pills' tone against the canvas: rejected — *the theme decides every
colour*; on a bespoke drawer that folded slowly: rejected.

## Commits

- Subject is a plain sentence about what changed, sentence case, no prefix,
  no ticket, no `feat:` (see `git log`). Body says why.
- GitHub Pages deploys from `main` on push and checks nothing about authors,
  so AI agents add their attribution trailer. Author and committer are
  always Ravi.
- One change, one commit. CHROME.md and the code it describes land together.

## Drift gallery exception — requested 2026-09-22

Drift's overlay has one morphing Grid/Single toggle in the rail. Its previous,
next and zoom actions live in the dock as 44px icon-only `.tool-pill--icon`
controls, alongside a Close verb and separate name, image-count and zoom
`.readout` chips. No Back or Original action. This is an explicit exception
to the rail/dock placement, persistent dock labels and single-readout rules
above, limited to Drift's gallery. Gallery thumbnails keep their rounded
corners; only full-view media has square corners. Shared chrome is unchanged.
