import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

function Controls() {
  const state = window.drift.state
  const controller = useDialKitController('Drift', {
    speed: [state.speed, 5, 80, 1],
    size: [state.size, 70, 140, 1],
    spacing: [state.spacing, 0, 80, 1],
    resume: [state.resume, 2, 15, 1],
    seed: [state.seed, 1, 9999, 1],
  })
  useEffect(() => {
    const sync = (event) => controller.setValues(event.detail)
    document.addEventListener('drift:sync', sync)
    return () => document.removeEventListener('drift:sync', sync)
  }, [])
  useEffect(() => {
    for (const [key, value] of Object.entries(controller.values)) {
      const input = document.getElementById(key)
      if (input && String(input.value) !== String(value)) {
        input.value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  }, [controller.values])
  return null
}

function readOpen() {
  try { return localStorage.getItem('play.panel') !== 'min' } catch { return true }
}
function writeOpen(open) {
  try { localStorage.setItem('play.panel', open ? 'open' : 'min') } catch {}
}
function mount() {
  createRoot(document.getElementById('root')).render(<>
    <Controls />
    <DialRoot mode="popover" position="top-right" productionEnabled
      defaultOpen={readOpen()} onOpenChange={writeOpen} />
  </>)
}
if (window.drift) mount()
else document.addEventListener('drift:ready', mount, { once: true })

// The classic engine receives Vite's base without hard-coding a deployment path.
window.driftBase = import.meta.env.BASE_URL
document.dispatchEvent(new Event('drift:config'))
