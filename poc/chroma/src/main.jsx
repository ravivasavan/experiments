import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* The panel is DialKit as it ships — its popover, its bubble, its motion —
   pinned under the menu pill by one rule in dialkit-skin.css. It holds the
   artwork's parameters and nothing else; the verbs, the export size and the
   readout are the dock's (see the play vault decision
   2026-09-18-dialkit-panel-and-dock-rule).

   app.js is untouched in the way that matters: it still listens to the same
   inputs it always did, now hidden in the page's .bridge. DialKit sets an
   input and fires its event; app.js hears it and does what it always did —
   locks, the horizon's 15-degree snap, the recipe in the hash, Randomise.
   Every drive below is idempotent against the page (it compares before it
   writes), so state coming back from app.js through chroma:sync can be echoed
   into the panel without a guard and without a loop. */

const COMPOSITIONS = [
  { value: '0', label: 'Field' },
  { value: '1', label: 'Aperture' },
  { value: '2', label: 'Horizon' },
]

/* app.js's COLOR_ROLES, as DialKit keys. Deep · Mid · Glow · Light. */
const ROLES = ['deep', 'mid', 'glow', 'light']

const $ = (id) => document.getElementById(id)

/* The composition is a style, not a tool, so it is a dial. app.js owns its
   three [data-mode] buttons; this clicks the one the dial names. */
function driveMode(value) {
  const btn = document.querySelector('[data-mode="' + value + '"]')
  if (btn && btn.getAttribute('aria-pressed') !== 'true') btn.click()
}

const WIRING = {
  diffusion: { id: 'flow', event: 'input' },
  scale: { id: 'scale', event: 'input' },
  angle: { id: 'rotation', event: 'input' },
  radiance: { id: 'glow', event: 'input' },
  grain: { id: 'grain', event: 'input' },
  seed: { id: 'seed', event: 'change' },
}

function drive(key, value) {
  const w = WIRING[key]
  const el = $(w.id)
  if (!el || String(el.value) === String(value)) return
  el.value = String(value)
  el.dispatchEvent(new Event(w.event, { bubbles: true }))
}

/* app.js paints the colour stories as buttons in the hidden #palettes and the
   colours as <input type=color> in the hidden #swatches. Choosing a story is
   clicking its button; editing a colour is setting its picker and firing
   input — exactly what a hand on the old drawer did. */
function driveStory(value) {
  if (value === 'custom') return
  const btn = document.querySelector('#palettes [data-palette="' + value + '"]')
  if (btn && btn.getAttribute('aria-pressed') !== 'true') btn.click()
}

function pickers() {
  return [...document.querySelectorAll('#swatches input[type="color"]')]
}

function driveColor(i, value) {
  const el = pickers()[i]
  if (!el || !/^#[a-f\d]{6}$/i.test(value) || el.value.toLowerCase() === value.toLowerCase()) return false
  el.value = value.toLowerCase()
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

function readStories() {
  return [...document.querySelectorAll('#palettes [data-palette]')]
    .map((b) => ({ value: b.dataset.palette, label: b.getAttribute('aria-label') || b.title }))
}

function readStory() {
  const on = document.querySelector('#palettes [data-palette][aria-pressed="true"]')
  return on ? on.dataset.palette : 'custom'
}

function readColors() {
  const found = pickers().map((el) => el.value)
  return found.length === 4 ? found : ['#101019', '#89b4fa', '#f5c2e7', '#f9e2af']
}

function Controls() {
  const read = (id, fallback) => {
    const el = $(id)
    return el ? Number(el.value) : fallback
  }
  const readMode = () => {
    const on = document.querySelector('[data-mode][aria-pressed="true"]')
    return on ? on.getAttribute('data-mode') : '1'
  }

  /* The name of the palette when it is nobody's — "Custom", or the file a
     TOML import came from. app.js tells us through chroma:sync. */
  const [customName, setCustomName] = useState(() => ($('palette-name') || {}).textContent || 'Custom')
  const stories = useRef(readStories())
  const initialColors = useRef(readColors())

  const controller = useDialKitController('Chroma', {
    composition: { type: 'select', options: COMPOSITIONS, default: readMode() },
    diffusion: [read('flow', 60), 0, 100, 1],
    scale: [read('scale', 55), 0, 100, 1],
    angle: [read('rotation', 0), -180, 180, 1],
    radiance: [read('glow', 65), 0, 100, 1],
    grain: [read('grain', 8), 0, 100, 1],
    seed: [read('seed', 42), 0, 999999, 1],
    palette: {
      story: {
        type: 'select',
        options: [...stories.current, { value: 'custom', label: customName }],
        default: readStory(),
      },
      deep: { type: 'color', default: initialColors.current[0] },
      mid: { type: 'color', default: initialColors.current[1] },
      glow: { type: 'color', default: initialColors.current[2] },
      light: { type: 'color', default: initialColors.current[3] },
    },
  })

  const v = controller.values

  /* Randomise, Reset, a pasted recipe, a TOML import and the horizon snap all
     move state from inside app.js. Follow them into the panel. */
  useEffect(() => {
    const onSync = (e) => {
      const s = e.detail
      if (s.paletteName) setCustomName(s.palette < 0 ? s.paletteName : 'Custom')
      const palette = { story: s.palette >= 0 ? String(s.palette) : 'custom' }
      if (Array.isArray(s.colors) && s.colors.length === 4) ROLES.forEach((k, i) => { palette[k] = s.colors[i] })
      controller.setValues({
        composition: String(s.mode),
        diffusion: s.flow, scale: s.scale, angle: s.rotation,
        radiance: s.glow, grain: s.grain, seed: s.seed,
        palette,
      })
    }
    document.addEventListener('chroma:sync', onSync)
    return () => document.removeEventListener('chroma:sync', onSync)
  }, [])

  const mounted = useRef(false)
  const prevStory = useRef(v.palette.story)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    driveMode(v.composition)
    for (const key of Object.keys(WIRING)) drive(key, v[key])
    /* Choosing a story repaints the swatches on app.js's side in the same
       tick, and the colours this run was rendered with are the OLD story's —
       driving them now would write the old palette straight back over the new
       one. So on the run where the story moved, the story is all that is
       driven; chroma:sync brings the new colours into the panel a moment
       later, and that run finds nothing to change. */
    const storyChanged = v.palette.story !== prevStory.current
    prevStory.current = v.palette.story
    driveStory(v.palette.story)
    if (storyChanged) return
    let edited = false
    ROLES.forEach((k, i) => { if (driveColor(i, v.palette[k])) edited = true })
    /* A colour edited by hand makes the palette nobody's — app.js has already
       said so on its side (palette -1, "Custom" in the readout); say so here. */
    if (edited && v.palette.story !== 'custom') {
      setCustomName('Custom')
      controller.setValues({ palette: { story: 'custom' } })
    }
  }, [v.composition, v.diffusion, v.scale, v.angle, v.radiance, v.grain, v.seed,
      v.palette.story, v.palette.deep, v.palette.mid, v.palette.glow, v.palette.light])

  return null
}

/* The padlock belongs beside the dial it locks. The dials are DialKit's and
   its schema has no notion of a lock, so the buttons are put onto its rendered
   rows — sliders and colours alike — matched by the label DialKit prints.
   They carry data-lock, which is all app.js has ever needed: its click handler
   is delegated at the document, and markLocks paints whatever it finds. The
   rows live in DialKit's popover, which portals to <body>, so that is what is
   watched; DialKit re-renders rows (folder toggles, presets) and takes the
   buttons with it, hence an observer rather than a one-shot. */
const LOCK_FOR = {
  Diffusion: 'flow',
  Scale: 'scale',
  Angle: 'rotation',
  Radiance: 'glow',
  Grain: 'grain',
  Seed: 'seed',
  Deep: 'color0',
  Mid: 'color1',
  Glow: 'color2',
  Light: 'color3',
}

function useDialLocks() {
  useEffect(() => {
    const api = window.chroma
    if (!api) return

    function place() {
      let added = false
      document.querySelectorAll('.dialkit-root .dialkit-slider-wrapper, .dialkit-root .dialkit-color-control').forEach((row) => {
        if (row.querySelector('.prop-lock')) return
        const label = row.querySelector('.dialkit-slider-label, .dialkit-color-label')
        const key = LOCK_FOR[label && label.textContent.trim()]
        if (!key) return
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'prop-lock'
        b.dataset.lock = key
        b.innerHTML = api.lockIcon
        row.classList.add('has-lock')
        row.appendChild(b)
        added = true
      })
      if (added) api.markLocks()
    }

    place()
    const mo = new MutationObserver(place)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
}

function DialLocks() {
  useDialLocks()
  return null
}

/* Open or bubbled is a preference, one key for the whole site, the way the
   old sheet's was. */
const PANEL_KEY = 'play.panel'
function readOpen() {
  try { return localStorage.getItem(PANEL_KEY) !== 'min' } catch (e) { return true }
}
function writeOpen(open) {
  try { localStorage.setItem(PANEL_KEY, open ? 'open' : 'min') } catch (e) {}
}

function mount() {
  createRoot($('root')).render(
    <React.StrictMode>
      <Controls />
      <DialLocks />
      <DialRoot mode="popover" position="top-right" defaultOpen={readOpen()} onOpenChange={writeOpen} productionEnabled />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
