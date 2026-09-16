import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

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
    /* The buttons are DialKit's actions now. Each one clicks the button the
       script already binds, so nothing about teletext's own wiring changes. */
    clearPicture: { type: 'action', label: 'Clear picture' },
    exportPng: { type: 'action', label: 'PNG' },
    exportTti: { type: 'action', label: 'TTI' },
    openEditTf: { type: 'action', label: 'Open in edit.tf' },
    copyUnicode: { type: 'action', label: 'Copy as Unicode' },
  }, {
    onAction: (action) => {
      const id = {
        clearPicture: 'c-clearimg',
        exportPng: 'x-png',
        exportTti: 'x-tti',
        openEditTf: 'x-edittf',
        copyUnicode: 'x-unicode',
      }[String(action)]
      if (id) document.getElementById(id)?.click()
    },
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

function Settings() {
  const mount = document.getElementById('dial-mount')
  if (!mount) return null
  return createPortal(<DialRoot mode="inline" theme="dark" productionEnabled />, mount)
}

function mount() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Controls />
      <Settings />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
