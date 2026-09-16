import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* app.js is untouched in the way that matters: it still listens to the same
   <input type="range"> it always did. DialKit sets that input and fires the
   event, so every lock, the horizon's 15-degree snap, the recipe in the hash
   and Randomise all go on working without knowing the panel changed. */
const COMPOSITIONS = [
  { value: '0', label: 'Field' },
  { value: '1', label: 'Aperture' },
  { value: '2', label: 'Horizon' },
]

/* The composition is a style, not a tool, so it is a dial rather than a pill on
   the rail. app.js still owns it: its three [data-mode] buttons are on the page
   the way the range inputs are, just never looked at, and this clicks the one
   the dial names. Everything that follows from a mode change — the angle chips
   appearing, the horizon's 15-degree snap — is already wired to that click. */
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
  const el = document.getElementById(w.id)
  if (!el || String(el.value) === String(value)) return
  el.value = String(value)
  el.dispatchEvent(new Event(w.event, { bubbles: true }))
}

function Controls() {
  const read = (id, fallback) => {
    const el = document.getElementById(id)
    return el ? Number(el.value) : fallback
  }

  const readMode = () => {
    const on = document.querySelector('[data-mode][aria-pressed="true"]')
    return on ? on.getAttribute('data-mode') : '1'
  }

  const controller = useDialKitController('Chroma', {
    composition: { type: 'select', options: COMPOSITIONS, default: readMode() },
    diffusion: [read('flow', 60), 0, 100, 1],
    scale: [read('scale', 55), 0, 100, 1],
    angle: [read('rotation', 0), -180, 180, 1],
    radiance: [read('glow', 65), 0, 100, 1],
    grain: [read('grain', 8), 0, 100, 1],
    seed: [read('seed', 42), 0, 999999, 1],
  })

  const v = controller.values

  /* Randomise, Reset, a pasted recipe and the horizon snap all move the
     sliders from inside app.js. Follow them, and mark the echo so it is not
     driven straight back as if the reader had done it. */
  const echoing = useRef(false)
  useEffect(() => {
    const onSync = (e) => {
      const s = e.detail
      echoing.current = true
      controller.setValues({
        composition: String(s.mode),
        diffusion: s.flow, scale: s.scale, angle: s.rotation,
        radiance: s.glow, grain: s.grain, seed: s.seed,
      })
    }
    document.addEventListener('chroma:sync', onSync)
    return () => document.removeEventListener('chroma:sync', onSync)
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (echoing.current) { echoing.current = false; return }
    driveMode(v.composition)
    for (const key of Object.keys(WIRING)) drive(key, v[key])
  }, [v.composition, v.diffusion, v.scale, v.angle, v.radiance, v.grain, v.seed])

  return null
}

/* The padlock belongs beside the dial it locks, which is where Chroma always
   had it — but the dials are DialKit's now and its schema has no notion of a
   lock. So the buttons are put onto its rendered rows instead, matched by the
   label DialKit prints. They carry data-lock, which is the only thing app.js
   has ever needed: its click handler is delegated at the document, and
   markLocks paints whatever it finds.

   A MutationObserver rather than a one-shot, because DialKit re-renders its
   rows — collapsing a folder, loading a preset — and takes the buttons with it
   when it does. */
const LOCK_FOR = {
  Diffusion: 'flow',
  Scale: 'scale',
  Angle: 'rotation',
  Radiance: 'glow',
  Grain: 'grain',
  Seed: 'seed',
}

function useDialLocks() {
  useEffect(() => {
    const mount = document.getElementById('dial-mount')
    const api = window.chroma
    if (!mount || !api) return

    function place() {
      let added = false
      mount.querySelectorAll('.dialkit-slider-wrapper').forEach((row) => {
        if (row.querySelector('.prop-lock')) return
        const label = row.querySelector('.dialkit-slider-label')
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
    mo.observe(mount, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
}

function Settings() {
  const mount = document.getElementById('dial-mount')
  if (!mount) return null
  return createPortal(<DialRoot mode="inline" theme="dark" productionEnabled />, mount)
}

function DialLocks() {
  useDialLocks()
  return null
}

function mount() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Controls />
      <Settings />
      <DialLocks />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
