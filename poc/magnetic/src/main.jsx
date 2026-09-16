import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* Vite hoists this module into <head>, so it runs before the engine's own
   defer script further down the body. Both finish before DOMContentLoaded,
   which is the first moment window.magnetic is guaranteed to exist. */
const engine = () => window.magnetic

function Controls() {
  const opening = engine()?.getValues() ?? {}

  const controller = useDialKitController('Magnetic', {
    tiles: [opening.tiles ?? 16, 8, 24, 1],
    gap: [opening.gap ?? 12, 0, 32, 1],
    spring: {
      stiffness: [opening.stiffness ?? 170, 60, 320, 1],
      damping: [opening.damping ?? 0.78, 0.3, 1.2],
    },
    spread: [opening.spread ?? 1, 0, 1.6],
  })

  const { tiles, gap, spread } = controller.values
  const { stiffness, damping } = controller.values.spring

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    engine()?.setValues({ tiles, gap, stiffness, damping, spread })
    /* Folded, the head is all you see of the drawer. */
    const s = document.getElementById('m-summary')
    if (s) s.textContent = `${tiles} tiles`
  }, [tiles, gap, stiffness, damping, spread])

  return null
}

/* Inline, inside the drawer index.html already put on the page, and pinned to
   one DialKit palette so the panel follows the site's theme rather than the
   OS's. Both for the same reasons metal does it. */
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
