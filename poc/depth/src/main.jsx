import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* The panel is DialKit as it ships. It holds the d's pose, the frame, the
   colours and the icon's parameters; the verbs, the export format and the
   readout are the dock's. depth.js listens to the inputs in the page's
   .bridge; every drive below compares before it writes, so what comes back
   through depth:sync (a drag on the mark or the gimbal, Flatten, Reset) echoes into the panel without
   a loop. */

const $ = (id) => document.getElementById(id)

const WIRING = {
  'rotation.x': 'rx',
  'rotation.y': 'ry',
  'rotation.z': 'rz',
  'rotation.perspective': 'perspective',
  'position.x': 'pos-x',
  'position.y': 'pos-y',
  'lettermark.size': 'size',
  'lettermark.thickness': 'd-weight',
  'artboard.proportion': 'proportion',
  'frame.weight': 'weight',
  'frame.width': 'frame-w',
  'frame.height': 'frame-h',
  'icon.corner': 'corner',
}

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

function driveNumber(id, value) {
  const el = $(id)
  if (!el || Number(el.value) === value) return
  el.value = String(value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function driveColor(id, value) {
  const el = $(id)
  if (!el || !/^#[0-9a-f]{6}$/i.test(value) || el.value.toLowerCase() === value.toLowerCase()) return
  el.value = value.toLowerCase()
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function driveCheck(id, value) {
  const el = $(id)
  if (!el || el.checked === value) return
  el.checked = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function driveSelect(id, value) {
  const el = $(id)
  if (!el || el.value === value) return
  el.value = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function shape(s) {
  return {
    rotation: { x: s.rx, y: s.ry, z: s.rz, perspective: s.depth },
    position: { x: s.x, y: s.y },
    lettermark: { size: s.size, thickness: s.dWeight },
    frame: { visible: s.frameOn, ratio: s.frameRatio, width: s.frameW, height: s.frameH, weight: s.weight },
    artboard: { square: s.square, proportion: s.proportion },
    colour: { field: s.field, ink: s.ink, background: s.background },
    icon: { corner: s.corner },
  }
}

function Controls() {
  const s = useRef(window.depth.state()).current

  const controller = useDialKitController('Depth', {
    position: {
      x: [s.x, -100, 100, 0.1],
      y: [s.y, -100, 100, 0.1],
    },
    rotation: {
      x: [s.rx, -180, 180, 0.1],
      y: [s.ry, -180, 180, 0.1],
      z: [s.rz, -180, 180, 0.1],
      perspective: [s.depth, 0, 100, 1],
    },
    lettermark: {
      size: [s.size, 50, 400, 0.5],
      thickness: [s.dWeight, 1, 9, 0.1],
    },
    frame: {
      visible: s.frameOn,
      ratio: {
        type: 'select',
        options: [
          { value: 'fill', label: 'Fill' },
          { value: '1:1', label: '1:1' },
          { value: '4:3', label: '4:3' },
          { value: '3:4', label: '3:4' },
          { value: '3:2', label: '3:2' },
          { value: '16:9', label: '16:9' },
          { value: '9:16', label: '9:16' },
          { value: 'mark', label: 'Logomark · 2.91:1' },
          { value: 'free', label: 'Freeform' },
        ],
        default: s.frameRatio,
      },
      width: [s.frameW, 5, 100, 0.5],
      height: [s.frameH, 5, 100, 0.5],
      weight: [s.weight, 1, 40, 0.5],
    },
    artboard: {
      square: s.square,
      proportion: [s.proportion, 1, 4, 0.01],
    },
    colour: {
      field: { type: 'color', default: s.field },
      ink: { type: 'color', default: s.ink },
      background: s.background,
    },
    icon: {
      corner: [s.corner, 0, 50, 1],
    },
  })

  const v = controller.values

  useEffect(() => {
    const onSync = (e) => controller.setValues(shape(e.detail))
    document.addEventListener('depth:sync', onSync)
    return () => document.removeEventListener('depth:sync', onSync)
  }, [])

  const deps = [
    ...Object.keys(WIRING).map((k) => get(v, k)),
    v.colour.field, v.colour.ink, v.colour.background, v.frame.visible, v.frame.ratio, v.artboard.square,
  ]
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    for (const [key, id] of Object.entries(WIRING)) driveNumber(id, get(v, key))
    driveColor('field', v.colour.field)
    driveColor('ink', v.colour.ink)
    driveCheck('background', v.colour.background)
    driveCheck('frame-on', v.frame.visible)
    driveSelect('frame-ratio', v.frame.ratio)
    driveCheck('square', v.artboard.square)
  }, deps)

  return null
}

/* Open or bubbled is a preference, one key for the whole site. */
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
      <DialRoot mode="popover" position="top-right" defaultOpen={readOpen()} onOpenChange={writeOpen} productionEnabled />
    </React.StrictMode>
  )
}

/* Vite hoists this module into <head>; wait for depth.js to publish. */
if (window.depth && window.depth.state) mount()
else document.addEventListener('depth:ready', mount, { once: true })
