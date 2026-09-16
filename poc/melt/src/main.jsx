import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

const engine = () => window.melt

function Controls() {
  const opening = engine()?.getGlobals() ?? {}

  const controller = useDialKitController('Melt', {
    passes: [opening.passes ?? 3, 1, 6, 1],
    threshold: [opening.threshold ?? 0.5, 0.05, 0.95],
    /* DialKit titles a dial from its key, and this one is called Everywhere
       in the play's own language — a floor of melt applied to the whole
       glyph rather than around a point. The engine still calls it base. */
    everywhere: [opening.base ?? 0, 0, 40, 1],
  })

  const { passes, threshold, everywhere } = controller.values

  /* The engine moves these itself when a file loads or last session is
     restored. Echo them back into the panel rather than letting the two drift,
     and mark the echo so it is not sent straight back as a user edit. */
  const echoing = useRef(false)
  useEffect(() => {
    engine()?.onGlobalsChange((v) => {
      echoing.current = true
      controller.setValues({ passes: v.passes, threshold: v.threshold, everywhere: v.base })
    })
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (echoing.current) { echoing.current = false; return }
    engine()?.setGlobals({ passes, threshold, base: everywhere })
  }, [passes, threshold, everywhere])

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

/* melt-ui.js is itself a DOMContentLoaded handler and this module's listener
   would be registered first, so wait for the engine to say it is up. */
if (window.melt) mount()
else document.addEventListener('melt:ready', mount, { once: true })
