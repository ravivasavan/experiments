import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* The panel is DialKit as it ships — its popover, its bubble, its motion —
   pinned under the menu pill by the shared skin. The drawer that used to
   host it inline is gone; the five spring parameters are all DialKit-native
   already, so nothing moves to the dock except the tile-count readout the
   drawer's folded head used to show (see the play vault decision
   2026-09-18-dialkit-panel-and-dock-rule).

   Vite hoists this module into <head>, so it runs before the engine's own
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
    /* The dock's readout, where the drawer's folded head used to live. */
    const s = document.getElementById('m-summary')
    if (s) s.textContent = `${tiles} tiles`
  }, [tiles, gap, stiffness, damping, spread])

  return null
}

/* Open or bubbled is a preference, one key for the whole site, the way every
   other play's popover reads it. */
const PANEL_KEY = 'play.panel'
function readOpen() {
  try { return localStorage.getItem(PANEL_KEY) !== 'min' } catch (e) { return true }
}
function writeOpen(open) {
  try { localStorage.setItem(PANEL_KEY, open ? 'open' : 'min') } catch (e) {}
}

function mount() {
  createRoot(document.getElementById('root')).render(
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
