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

  const controller = useDialKitController('Chroma', {
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
    for (const key of Object.keys(WIRING)) drive(key, v[key])
  }, [v.diffusion, v.scale, v.angle, v.radiance, v.grain, v.seed])

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
