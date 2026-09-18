import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

const engine = () => window.melt

/* The panel is rebuilt whenever a point is added or removed — DialKit's schema
   is fixed at registration, so a changing shape means a new registration. The
   count is the key, which remounts Controls and re-registers with the new set
   of folders; within a count the config is stable and the dials stay live. */
function Controls({ points }) {
  const opening = engine()?.getGlobals() ?? {}

  const config = {
    passes: [opening.passes ?? 3, 1, 6, 1],
    threshold: [opening.threshold ?? 0.5, 0.05, 0.95],
    /* DialKit titles a dial from its key, and this one is called Everywhere in
       the play's own language — a floor of melt over the whole glyph rather
       than around a point. The engine still calls it base. */
    everywhere: [opening.base ?? 0, 0, 40, 1],
    before: opening.before ?? false,
  }
  points.forEach((p, i) => {
    config['Point ' + (i + 1)] = {
      heat: [p.heat, 0, 120, 1],
      reach: [p.r, 20, 600, 1],
      remove: { type: 'action', label: 'Remove point ' + (i + 1) },
    }
  })

  const controller = useDialKitController('Melt', config, {
    onAction: (action) => {
      // the action arrives path-qualified, e.g. "Point 2.remove"
      const n = /(\d+)/.exec(String(action))
      if (n) engine()?.removePoint(Number(n[1]) - 1)
    },
  })

  const v = controller.values
  const flat = [v.passes, v.threshold, v.everywhere, v.before]

  const echoing = useRef(false)
  useEffect(() => {
    engine()?.onGlobalsChange((g) => {
      echoing.current = true
      controller.setValues({
        passes: g.passes, threshold: g.threshold,
        everywhere: g.base, before: !!g.before,
      })
    })
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (echoing.current) { echoing.current = false; return }
    engine()?.setGlobals({
      passes: v.passes, threshold: v.threshold, base: v.everywhere, before: v.before,
    })
  }, flat)

  // Each point's two dials, straight through to the engine.
  const pointVals = points.map((_, i) => {
    const f = v['Point ' + (i + 1)] || {}
    return [f.heat, f.reach]
  })
  useEffect(() => {
    if (!mounted.current) return
    pointVals.forEach(([heat, reach], i) => {
      if (heat != null) engine()?.setPoint(i, 'heat', heat)
      if (reach != null) engine()?.setPoint(i, 'r', reach)
    })
    engine()?.endEdit()
  }, [JSON.stringify(pointVals)])

  return null
}

/* The count is what changes the panel's shape; the values inside it do not. */
function ControlsHost() {
  const [points, setPoints] = useState(() => engine()?.getPoints() ?? [])
  useEffect(() => {
    engine()?.onPointsChange((pts, sel, structural) => {
      if (structural) setPoints(pts)
    })
  }, [])
  return <Controls key={points.length} points={points} />
}

/* Open or bubbled is a preference, one key for the whole site — the panel-
   and-dock rule (play vault, 2026-09-18-dialkit-panel-and-dock-rule). */
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
      <ControlsHost />
      <DialRoot mode="popover" position="top-right" defaultOpen={readOpen()} onOpenChange={writeOpen} productionEnabled />
    </React.StrictMode>
  )
}

/* melt-ui.js is itself a DOMContentLoaded handler and this module's listener
   would be registered first, so wait for the engine to say it is up. */
if (window.melt) mount()
else document.addEventListener('melt:ready', mount, { once: true })
