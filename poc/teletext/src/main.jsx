import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* The panel is DialKit as it ships — its popover, its bubble, its motion —
   pinned under the menu pill by one rule in dialkit-skin.css. It holds the
   page's parameters and nothing else: the verbs (Randomise, Text, Picture,
   Clear, Export), the format that belongs to Export, the file chooser, the
   body copy and the readout are the dock's (see the play vault decision
   2026-09-18-dialkit-panel-and-dock-rule).

   teletext.js is untouched in the way that matters. The parameters still move
   through window.teletext.setValues/onChange, exactly as they did inside the
   drawer, and the verbs still work by clicking the buttons the script already
   binds — now hidden in the page's .bridge. */

const engine = () => window.teletext

const SPECS = [
  { value: 'ceefax', label: 'Ceefax · BBC' },
  { value: 'austext', label: 'Austext · Seven' },
]
const LAYOUTS = [
  { value: 'headline', label: 'Headline' },
  { value: 'index', label: 'Index' },
  { value: 'newsflash', label: 'Newsflash' },
  { value: 'art', label: 'Art' },
]
const DITHERS = [
  { value: 'ordered', label: 'Ordered 4×4' },
  { value: 'none', label: 'None' },
]
const SCALES = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '3', label: '3×' },
]

function Controls() {
  const o = engine()?.getValues() ?? {}
  /* The schemes are defined inside the engine, so they are asked for rather
     than copied here — a second list would drift the first time one is added. */
  const schemes = engine()?.getSchemes() ?? []

  const controller = useDialKitController('Teletext', {
    page: {
      spec: { type: 'select', options: SPECS, default: o.spec ?? 'ceefax' },
      /* A page number really is a dial on a service that only has 800 of them. */
      number: [o.number ?? 100, 100, 899, 1],
      service: { type: 'text', default: o.service ?? 'PLAY', placeholder: 'Service name' },
      layout: { type: 'select', options: LAYOUTS, default: o.layout ?? 'headline' },
    },
    scheme: { type: 'select', options: schemes, default: String(o.scheme ?? 0) },
    attributes: {
      double: o.double ?? true,
      separated: o.separated ?? false,
      hold: o.hold ?? true,
      flash: o.flash ?? false,
    },
    picture: {
      dither: { type: 'select', options: DITHERS, default: o.dither ?? 'ordered' },
      changes: [o.changes ?? 6, 1, 12, 1],
    },
    generate: {
      seed: { type: 'text', default: o.seed ?? 'ceefax', placeholder: 'Seed' },
      scale: { type: 'select', options: SCALES, default: String(o.scale ?? 2) },
    },
    fastext: { type: 'text', default: o.links ?? 'INDEX, MAGNETIC, BLOCK, A-Z', placeholder: 'Fastext links' },
  })

  const v = controller.values
  const flat = {
    links: v.fastext,
    spec: v.page.spec, number: v.page.number, service: v.page.service,
    layout: v.page.layout, scheme: Number(v.scheme), seed: v.generate.seed,
    scale: Number(v.generate.scale), dither: v.picture.dither,
    changes: v.picture.changes, double: v.attributes.double,
    separated: v.attributes.separated, hold: v.attributes.hold,
    flash: v.attributes.flash,
  }

  /* The engine moves these itself — Randomise draws a whole new page, switching
     layout reseeds the palette, and the window's own fit picks the scale. Echo
     those back rather than letting the two drift, and mark the echo so it is
     not posted straight back as if the reader had done it. */
  const echoing = useRef(false)
  useEffect(() => {
    engine()?.onChange((s) => {
      echoing.current = true
      controller.setValues({
        page: { spec: s.spec, number: s.number, service: s.service, layout: s.layout },
        scheme: String(s.scheme),
        attributes: { double: s.double, separated: s.separated, hold: s.hold, flash: s.flash },
        picture: { dither: s.dither, changes: s.changes },
        generate: { seed: s.seed, scale: String(s.scale) },
        fastext: Array.isArray(s.links) ? s.links.join(', ') : s.links,
      })
    })
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (echoing.current) { echoing.current = false; return }
    engine()?.setValues(flat)
  }, Object.values(flat))

  return null
}

/* --------------------------------------------------------------- the dock -- */
/* The verbs the drawer used to hold. Every one of them works through the
   .bridge, so teletext.js keeps the wiring it has always had — the dock only
   decides when to fire it and what the pills say. */

const $ = (id) => document.getElementById(id)

/* What the script writes into #drop when there is no picture; the file's name
   when there is. It is the one signal that covers both the chooser and a drop,
   which is why the Clear pill follows it. */
const NO_PICTURE = 'Drop an image, or click to choose'

function wireDock() {
  /* Text — a multi-line body of copy is not a dial, so DialKit has no row for
     it and the pill opens a bar on the dock's own material instead. */
  const bar = $('text-bar')
  const textPill = $('p-text')
  const copy = $('c-copy')
  const showBar = (open) => {
    bar.hidden = !open
    textPill.classList.toggle('is-on', open)
    textPill.setAttribute('aria-expanded', String(open))
    if (open) copy.focus()
  }
  textPill.addEventListener('click', () => showBar(bar.hidden))
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || bar.hidden) return
    showBar(false)
    textPill.focus()
  })

  /* Picture — the pill opens the hidden chooser, and Clear is only there once
     there is something to clear. */
  const drop = $('drop')
  const clearPill = $('p-clearpic')
  $('p-picture').addEventListener('click', () => $('file').click())
  clearPill.addEventListener('click', () => $('c-clearimg').click())
  const followPicture = () => { clearPill.hidden = drop.textContent.trim() === NO_PICTURE }
  followPicture()
  new MutationObserver(followPicture).observe(drop, { childList: true, characterData: true, subtree: true })

  /* A picture can be dropped anywhere on the page now that the well has gone.
     The script's own drop handler is on #drop, so the event is forwarded there
     rather than the dock learning to read a file — and forwarded without
     bubbling, or it would arrive straight back at this listener. */
  for (const type of ['dragenter', 'dragover']) {
    document.addEventListener(type, (e) => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault()
    })
  }
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return
    e.preventDefault()
    drop.dispatchEvent(new DragEvent('drop', { dataTransfer: e.dataTransfer, bubbles: false, cancelable: true }))
  })

  /* Export and the format beside it: one verb, one selector that belongs to
     it. The option values are the ids of the buttons the script already binds,
     so Export is a click on whichever one is chosen. The choice is remembered —
     it is a habit, not a property of the page. */
  const FORMAT_KEY = 'play.teletext.format'
  const format = $('x-format')
  const formatLabel = $('x-format-label')
  try {
    const saved = localStorage.getItem(FORMAT_KEY)
    if (saved && [...format.options].some((opt) => opt.value === saved)) format.value = saved
  } catch (e) {}
  const paintFormat = () => { formatLabel.textContent = format.options[format.selectedIndex].textContent }
  paintFormat()
  format.addEventListener('change', () => {
    paintFormat()
    try { localStorage.setItem(FORMAT_KEY, format.value) } catch (e) {}
  })
  $('p-export').addEventListener('click', () => $(format.value)?.click())
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
  wireDock()
  createRoot($('root')).render(
    <React.StrictMode>
      <Controls />
      <DialRoot mode="popover" position="top-right" defaultOpen={readOpen()} onOpenChange={writeOpen} productionEnabled />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
