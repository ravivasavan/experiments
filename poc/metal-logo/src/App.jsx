import { useEffect, useRef, useState } from 'react'
import { useDialKitController } from 'dialkit'
import { makeRng, LOGICAL_W, LOGICAL_H } from './generator.js'
import { renderInk } from './raster.js'
import { makeEnvelope } from './engine/envelope.js'
import { typeset, fitToEnvelope, bboxOf } from './engine/typeset.js'
import { findAnchors } from './engine/anchors.js'
import { compose, toPolygons } from './engine/compose.js'
import { orient } from './engine/primitives.js'
import { sigilPolys } from './engine/sigil.js'
import {
  loadFont,
  FONT_NAMES,
  getFont,
  imageGeometry,
  svgString,
  exportSvg,
} from './vector.js'

const FONTS = FONT_NAMES
const ENVELOPES = ['free', 'arch', 'bat-wing', 'crown']
const BASE = import.meta.env.BASE_URL || '/'

// The legibility dial has four named stops, each a whole parameter mix —
// the genre's own spectrum, with its exemplars.
/* Four named points on the legibility spectrum, each a whole composition
   rather than a growth setting. They set the silhouette first, because that is
   the order the design happens in. */
const STOPS = {
  'Readable but cold': { // Darkthrone
    silhouette: { shape: 'block', aspect: 4.4, crown: 0.15, sag: 0.1 },
    letters: { outerBias: 0.12, tracking: -0.01, arc: 0.08, dislocation: 0.05, prune: 2.2 },
    ornament: { ornaments: 8, majors: 2, reach: 0.8, barbs: 0.11, angle: 0.2, curvature: 0.08, contrast: 6 },
    composition: { symmetry: 0.9, crownRoot: 0.5, sigil: 'none' },
    ink: { swell: 1.0, grit: 0.18 },
  },
  'Unstable': { // Mayhem
    silhouette: { shape: 'arch', aspect: 3.8, crown: 0.45, sag: 0.3 },
    letters: { outerBias: 0.3, tracking: -0.03, arc: 0.22, dislocation: 0.55, prune: 1.6 },
    ornament: { ornaments: 14, majors: 4, reach: 1.25, barbs: 0.17, angle: 0.5, curvature: 0.3, contrast: 8 },
    composition: { symmetry: 0.55, crownRoot: 0.45, sigil: 'none' },
    ink: { swell: 1.6, grit: 0.4 },
  },
  'Breaking point': { // early Immortal
    silhouette: { shape: 'wing', aspect: 3.5, crown: 0.55, sag: 0.3 },
    letters: { outerBias: 0.35, tracking: -0.02, arc: 0.25, dislocation: 0.25, prune: 1.6 },
    ornament: { ornaments: 18, majors: 5, reach: 1.45, barbs: 0.18, angle: 0.45, curvature: 0.32, contrast: 8 },
    composition: { symmetry: 0.8, crownRoot: 0.6, sigil: 'inverted cross' },
    ink: { swell: 2.0, grit: 0.3 },
  },
  'Total sigil': { // Xasthur / Leviathan
    silhouette: { shape: 'lozenge', aspect: 2.4, crown: 0.8, sag: 0.4 },
    letters: { outerBias: 0.5, tracking: -0.06, arc: 0.45, dislocation: 0.4, prune: 1.2 },
    ornament: { ornaments: 26, majors: 7, reach: 2.0, barbs: 0.24, angle: 0.75, curvature: 0.6, contrast: 11 },
    composition: { symmetry: 0.95, crownRoot: 0.7, sigil: 'pentagram' },
    ink: { swell: 2.8, grit: 0.35 },
  },
}

/* What Mutate is allowed to nudge, and how far. The seed is the dice; these are
   the design, and a mutation walks them rather than re-rolling them. */
const WALK = {
  'letters.outerBias': [0, 1], 'letters.arc': [0, 1], 'letters.dislocation': [0, 1],
  'letters.tracking': [-0.08, 0.02],
  'ornament.ornaments': [4, 28], 'ornament.majors': [0, 8], 'ornament.reach': [0.3, 2.5],
  'ornament.barbs': [0.05, 0.3], 'ornament.angle': [0, 1], 'ornament.curvature': [0, 1],
  'composition.symmetry': [0, 1], 'composition.crownRoot': [0, 1],
  'silhouette.crown': [0, 1], 'silhouette.sag': [0, 1], 'silhouette.aspect': [1, 6],
}

let seedCounter = (Math.random() * 1e9) | 0
const nextSeed = () => (seedCounter = (seedCounter + 0x9e3779b9) >>> 0)

/* The genome is the seed. Everything else about the logo is on the panel, which
   is where the design lives now — so Mutate walks the dials and Grow re-rolls
   them, rather than there being a second hidden copy of the design to keep in
   step with the one you can see. */
const nudge = (v, [lo, hi], strength, rand) =>
  Math.min(hi, Math.max(lo, v + (rand() * 2 - 1) * strength * (hi - lo) * 0.3))

function walkValues(values, strength, rand) {
  const out = {}
  for (const path of Object.keys(WALK)) {
    const [folder, key] = path.split('.')
    const cur = values[folder] && values[folder][key]
    if (typeof cur !== 'number') continue
    out[folder] = out[folder] || {}
    let v = nudge(cur, WALK[path], strength, rand)
    if (key === 'ornaments' || key === 'majors') v = Math.round(v)
    out[folder][key] = v
  }
  return out
}

function rollOrnament(rand) {
  const r = (lo, hi) => lo + rand() * (hi - lo)
  return {
    ornament: {
      ornaments: Math.round(r(6, 26)),
      majors: Math.round(r(1, 7)),
      reach: r(0.6, 2.2),
      barbs: r(0.08, 0.28),
      angle: r(0.1, 0.9),
      curvature: r(0, 0.8),
      contrast: r(4, 13),
    },
    composition: { symmetry: r(0.4, 1), crownRoot: r(0.2, 0.9) },
  }
}

function loadSvgFile(file, done) {
  if (!file) return
  if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name)) return
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => done({ img, name: file.name.replace(/\.svg$/i, ''), stamp: Date.now() })
  img.src = url
}

function readThemeColors() {
  const cs = getComputedStyle(document.body)
  return { bg: cs.backgroundColor, fg: cs.color }
}

const DEFAULT_STOP = 'Breaking point'
const WORLD_W = 1180
const SINGLE_H = WORLD_W * (800 / 1400)
// How long the art takes to grow out of its middle, and the curve it grows on.
const GROW_MS = 900
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

export default function App() {
  const singleRef = useRef(null)
  const viewportRef = useRef(null)
  const worldRef = useRef(null)
  const view = useRef({ x: 0, y: 0, z: 1 })
  const suppressClick = useRef(false)
  const zoomBlitTimer = useRef(null)
  const fileRef = useRef(null)
  const polysRef = useRef(null)  // letterform + tendrils, before any ink
  const layerRef = useRef(null)  // the painted ink, tinted, at the current ratio
  const artRef = useRef(null)    // what the grow-out animation is animating
  const growRaf = useRef(0)
  const layerRatio = useRef(0)
  const historyRef = useRef([])
  const colorsRef = useRef({ bg: '#0d1b1e', fg: '#fff5f5' })

  const [genome, setGenome] = useState(() => ({ seed: nextSeed() }))
  const [svg, setSvg] = useState(null)
  const [loadedFont, setLoadedFont] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [svgDump, setSvgDump] = useState(null)

  // refs mirror state so DialKit / chrome callbacks never act on stale closures
  const genomeRef = useRef(genome)
  genomeRef.current = genome
  const svgRef = useRef(svg)
  svgRef.current = svg
  const pendingSync = useRef(false)

  const controller = useDialKitController(
    'Metal Logo',
    {
      text: { type: 'text', default: 'RAVENMOOR', placeholder: 'Logo text…' },
      font: { type: 'select', options: FONTS, default: 'Metal Mania' },
      size: [260, 80, 420],
      uploadSvg: { type: 'action', label: svg ? `SVG: ${svg.name} ↺` : 'Upload SVG (or drop it here)' },
      clearSvg: { type: 'action', label: 'Back to text' },
      legibility: { type: 'select', options: Object.keys(STOPS), default: DEFAULT_STOP },
      mutation: [0.35, 0.05, 1],

      // The silhouette is chosen FIRST. Everything else is designed into it.
      silhouette: {
        shape: { type: 'select', options: ['wing', 'arch', 'lozenge', 'block'], default: 'wing' },
        aspect: [3.5, 1, 6],
        crown: [0.55, 0, 1],
        sag: [0.3, 0, 1],
        showGuide: false,
      },

      letters: {
        outerBias: [0.25, 0, 1],
        tracking: [-0.02, -0.08, 0.02],
        arc: [0.12, 0, 1],
        dislocation: [0.25, 0, 1],
        prune: [1.6, 0.8, 3],
      },

      // A budget, not a growth rate. This is the whole difference.
      ornament: {
        ornaments: [12, 4, 28, 1],
        majors: [4, 0, 8, 1],
        reach: [1.0, 0.3, 2.5],
        barbs: [0.18, 0.05, 0.3],
        angle: [0.35, 0, 1],
        curvature: [0.25, 0, 1],
        contrast: [8, 3, 14],
      },

      composition: {
        symmetry: [0.8, 0, 1],
        crownRoot: [0.6, 0, 1],
        sigil: { type: 'select', options: ['none', 'inverted cross', 'pentagram', 'horns'], default: 'inverted cross' },
      },

      ink: {
        swell: [2.0, 0, 6],
        threshold: [0.42, 0.05, 0.95],
        grit: [0.3, 0, 1],
      },

      transparentBg: true,
      growOut: true,
    },
    {
      onAction: (action) => {
        if (action === 'uploadSvg') fileRef.current?.click()
        if (action === 'clearSvg') setSvg(null)
      },
    }
  )
  const p = controller.values
  const pRef = useRef(p)
  pRef.current = p

  const blitRatio = () =>
    Math.min(3, (window.devicePixelRatio || 1) * Math.max(1, view.current.z))

  function applyView() {
    const { x, y, z } = view.current
    if (worldRef.current) worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${z})`
  }

  /* Re-ink and repaint. Zooming in and changing the theme both land here: the
     layer carries the theme's colour and is rendered for a particular zoom, and
     re-rendering it costs about as much as scaling it would. */
  function reblitAll() {
    if (!polysRef.current) return
    const ratio = blitRatio()
    if (!layerRef.current || Math.abs(ratio - layerRatio.current) > 0.25) {
      layerRef.current = makeLayer(genomeRef.current, ratio)
      layerRatio.current = ratio
    }
    artRef.current = layerRef.current
    paintLayer(singleRef.current, layerRef.current, 1)
  }

  // Grow the art out of its middle over GROW_MS. Any new art cancels the frame
  // in flight, so a fast run of mutations never leaves two animations fighting
  // over the same canvas.
  function growOut(layer) {
    cancelAnimationFrame(growRaf.current)
    const canvas = singleRef.current
    if (!canvas || !layer) return
    const still = !pRef.current.growOut ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still) { paintLayer(canvas, layer, 1); return }
    /* The clock is the FIRST FRAME's own timestamp, not performance.now() taken
       here. Mixing the two is what put `now` behind `started`, and t behind
       zero, and a negative radius into ctx.ellipse. Started from a frame, the
       animation is self-consistent whatever the page's clocks are doing. */
    let started = 0
    growRaf.current = requestAnimationFrame(function step(now) {
      if (artRef.current !== layer) return
      if (!started) started = now
      const t = Math.max(0, Math.min(1, (now - started) / GROW_MS))
      paintLayer(canvas, layer, easeOut(t))
      if (t < 1) growRaf.current = requestAnimationFrame(step)
    })
  }

  // The world is full-bleed and pans under the glass, and it centres on the
  // viewport's own centre: the sheet is an overlay, not a column cut out of
  // the page, and minimising it uncovers whatever it was lying on.
  /* Dead centre, and nothing else. The old version floored y at 200 and then
     added 60 on top, which put the mark low and off the bottom as soon as the
     ornament reached — and left no way of knowing which way to drag back. */
  /* Fit, properly — which means fitting into the space the DRAWER LEAVES.
     Everywhere else in Play the sheet is an overlay and the world centres on
     the window, because everywhere else the world is a field you pan through.
     Here it is one 1180px-wide mark and the drawer is 380 of those pixels, so
     centring on the window parks a quarter of the logo behind glass with no
     way of knowing that is where it went. */
  function freeBox() {
    const vp = viewportRef.current
    if (!vp) return null
    const rect = vp.getBoundingClientRect()
    const sheet = document.querySelector('.sheet')
    const taken = sheet ? Math.max(0, rect.right - sheet.getBoundingClientRect().left) : 0
    // Minimised, the sheet is a disc and takes almost nothing; open, it takes
    // its width. Either way this reads what is actually on screen.
    return { w: Math.max(320, rect.width - taken), h: rect.height }
  }

  function centerView() {
    const box = freeBox()
    if (!box) return
    const pad = 80
    const z = Math.min(1, (box.w - pad) / WORLD_W, (box.h - pad) / SINGLE_H)
    view.current = {
      x: (box.w - WORLD_W * z) / 2,
      y: (box.h - SINGLE_H * z) / 2,
      z: Math.max(0.25, z),
    }
    applyView()
  }

  function zoomBy(k) {
    const box = freeBox()
    if (!box) return
    const z = Math.min(6, Math.max(0.25, view.current.z * k))
    // zoom about the middle of what is VISIBLE, so the mark stays put rather
    // than creeping under the drawer a step at a time
    const cx = box.w / 2
    const cy = box.h / 2
    const f = z / view.current.z
    view.current = {
      x: cx - (cx - view.current.x) * f,
      y: cy - (cy - view.current.y) * f,
      z,
    }
    applyView()
    clearTimeout(zoomBlitTimer.current)
    zoomBlitTimer.current = setTimeout(reblitAll, 120)
  }

  function pushHistory(g) {
    historyRef.current.push(g)
    if (historyRef.current.length > 50) historyRef.current.shift()
  }

  /* Mutate walks the design: a new seed, and every dial in WALK nudged by the
     mutation strength. Grow re-rolls the ornament budget outright. Both go
     through the panel, because the panel is where the design lives. */
  function snapshot() {
    return { seed: genomeRef.current.seed, values: JSON.parse(JSON.stringify(pRef.current)) }
  }

  function mutateOne() {
    historyRef.current.push(snapshot())
    if (historyRef.current.length > 50) historyRef.current.shift()
    const rand = makeRng(nextSeed())
    pendingSync.current = true
    controller.setValues(walkValues(pRef.current, pRef.current.mutation, rand))
    setGenome({ seed: nextSeed() })
  }

  function growRandom() {
    historyRef.current.push(snapshot())
    const rand = makeRng(nextSeed())
    pendingSync.current = true
    controller.setValues(rollOrnament(rand))
    setGenome({ seed: nextSeed() })
  }

  function freshOne(stop = pRef.current.legibility) {
    historyRef.current.push(snapshot())
    const s = STOPS[stop] || STOPS[DEFAULT_STOP]
    pendingSync.current = true
    controller.setValues({
      silhouette: { ...s.silhouette },
      letters: { ...s.letters },
      ornament: { ...s.ornament },
      composition: { ...s.composition },
      ink: { ...s.ink },
    })
    setGenome({ seed: nextSeed() })
  }

  function goBack() {
    const last = historyRef.current.pop()
    if (!last) return
    pendingSync.current = true
    controller.setValues(last.values)
    setGenome({ seed: last.seed })
  }

  /* Export is the one place Clipper still runs: the screen gets the GPU ink,
     but an SVG needs real outlines, so the same composition is unioned,
     offset once and gritted for the file. It costs a second and it happens
     once, on a click. */
  async function buildArt(genome) {
    const polys = inkPolys(genome)
    if (!polys || !polys.length) return null
    const pv = pRef.current
    const { inkVector, makeArt } = await import('./art.js')
    const inked = inkVector(polys, {
      bleed: pv.ink.swell,
      threshold: pv.ink.threshold,
      grit: pv.ink.grit,
      gritSeed: genome.seed * 31 + 7,
    })
    return makeArt(inked)
  }

  async function doExport() {
    const pv = pRef.current
    const art = await buildArt(genomeRef.current)
    if (!art) return
    // transparent export is the deliverable: a solid dark mark on nothing.
    // With a background, export what you see — the current theme's colours.
    const colors = pv.transparentBg
      ? { fg: '#0a0a0a', bg: '#f2f0ec' }
      : colorsRef.current
    exportSvg(art, colors, pv.transparentBg, svgRef.current ? svgRef.current.name : pv.text)
  }

  // Only the face on screen is fetched and parsed; picking another gets it
  // then. This is derived rather than a second piece of state on purpose: the
  // moment p.font changes it reads false in the very same render, so the
  // draw loop below can't slip a pass through in the outgoing face and then
  // mark those cells fresh.
  const fontsReady = loadedFont === p.font
  useEffect(() => {
    let alive = true
    const want = p.font
    loadFont(want)
      .then(() => alive && setLoadedFont(want))
      .catch((e) => console.error('fonts', e))
    return () => { alive = false }
  }, [p.font])

  // dev hooks + drag-and-drop + chrome pills + theme observer
  useEffect(() => {
    let alive = true

    colorsRef.current = readThemeColors()

    // dev-only: #mutatetest walks one step once the first art has landed
    if (location.hash.includes('mutatetest')) {
      setTimeout(() => mutateOne(), 2200)
    }
    if (location.hash.includes('testsvg')) {
      const img = new Image()
      img.onload = () => alive && setSvg({ img, name: 'sample', stamp: 0 })
      img.src = BASE + 'sample.svg'
    }

    const over = (e) => { e.preventDefault(); setDragging(true) }
    const leave = (e) => { if (!e.relatedTarget) setDragging(false) }
    const drop = (e) => {
      e.preventDefault()
      setDragging(false)
      loadSvgFile(e.dataTransfer?.files?.[0], setSvg)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)

    // chrome pills (static site chrome outside the React root)
    const on = (id, fn) => {
      const el = document.getElementById(id)
      if (el) el.addEventListener('click', fn)
      return () => el && el.removeEventListener('click', fn)
    }
    const offs = [
      on('p-in', () => zoomBy(1.25)),
      on('p-out', () => zoomBy(1 / 1.25)),
      on('p-fit', () => { centerView(); reblitAll() }),
      on('p-mutate', () => mutateOne()),
      on('p-grow', () => growRandom()),
      on('p-fresh', () => freshOne()),
      on('p-back', () => goBack()),
      on('p-export', () => doExport()),
    ]

    // theme changes re-colour every canvas once the CSS transition settles
    const onTheme = () => setTimeout(() => {
      colorsRef.current = readThemeColors()
      reblitAll()
    }, 300)
    const mo = new MutationObserver(onTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', onTheme)

    return () => {
      alive = false
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
      offs.forEach((off) => off())
      mo.disconnect()
      mq.removeEventListener('change', onTheme)
    }
  }, [])

  // pan / zoom: drag anywhere pans (clicks survive via a 5px threshold);
  // pinch or ⌘/ctrl+wheel zooms toward the cursor; plain wheel pans
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    centerView()
    // dev-only: #zoomtest starts zoomed into the centre cell
    if (location.hash.includes('zoomtest')) {
      const rect = vp.getBoundingClientRect()
      const z = 2.4
      view.current = {
        x: rect.width / 2 - (WORLD_W / 2) * z,
        y: rect.height / 2 - (SINGLE_H / 2) * z,
        z,
      }
      setTimeout(reblitAll, 3000)
      applyView()
    }

    const onWheel = (e) => {
      e.preventDefault()
      const v = view.current
      if (e.ctrlKey || e.metaKey) {
        const r = vp.getBoundingClientRect()
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        const nz = Math.min(6, Math.max(0.3, v.z * Math.exp(-e.deltaY * 0.01)))
        v.x = px - ((px - v.x) / v.z) * nz
        v.y = py - ((py - v.y) / v.z) * nz
        v.z = nz
        clearTimeout(zoomBlitTimer.current)
        zoomBlitTimer.current = setTimeout(reblitAll, 180)
      } else {
        v.x -= e.deltaX
        v.y -= e.deltaY
      }
      applyView()
    }

    let down = null
    const onDown = (e) => {
      if (e.button !== 0) return
      down = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y, moved: false }
    }
    const onMove = (e) => {
      if (!down) return
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (!down.moved && Math.hypot(dx, dy) > 5) {
        down.moved = true
        suppressClick.current = true
      }
      if (down.moved) {
        view.current.x = down.vx + dx
        view.current.y = down.vy + dy
        applyView()
      }
    }
    const onUp = () => {
      down = null
      setTimeout(() => (suppressClick.current = false), 0)
    }

    vp.addEventListener('wheel', onWheel, { passive: false })
    vp.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      vp.removeEventListener('wheel', onWheel)
      vp.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // The drawer's head reads back the legibility stop and how deep the walk is.
  useEffect(() => {
    const summary = document.getElementById('p-summary')
    if (summary) {
      const n = historyRef.current.length
      summary.textContent = n ? `${p.legibility} · ${n} back` : p.legibility
    }
  }, [genome, p.legibility])

  // One logo, so the world centres once the viewport settles — and again when
  // the window changes size, because a fit computed against the old width is
  // just another way of losing the mark off an edge.
  useEffect(() => {
    centerView()
    const raf = requestAnimationFrame(reblitAll)
    let t = 0
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(() => { centerView(); reblitAll() }, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // legibility stop change → a new logo at that stop (skip first mount)
  const firstStop = useRef(true)
  useEffect(() => {
    if (firstStop.current) { firstStop.current = false; return }
    freshOne(p.legibility)
  }, [p.legibility])

  /* The dials are the design, so there is nothing to write back into — a dial
     change simply repaints, which the render effect already keys on. The flag
     swallows the echo from a Mutate/Grow/Back that set the dials itself. */
  useEffect(() => {
    if (pendingSync.current) pendingSync.current = false
  }, [JSON.stringify([p.silhouette, p.letters, p.ornament, p.composition])])

  /* The composition, start to finish. Envelope, then letters into it, then a
     budget of ornament placed at extremities and solved against the boundary.
     Nothing grows and nothing recurses. */
  function buildComposition(genome) {
    const pv = pRef.current
    const src = svgRef.current
    const rand = makeRng(genome.seed ^ 0x51ab)

    let set
    if (src) {
      const polys = imageGeometry(src.img)
      if (!polys || !polys.length) return null
      set = { glyphs: [{ ch: '*', index: 0, claim: 1, polys, bbox: bboxOf(polys) }], polys, bbox: bboxOf(polys), capH: pv.size }
    } else {
      const font = getFont(pv.font)
      if (!font) return null
      set = typeset(font, pv.text || 'METAL', pv.size, pv.letters, rand)
    }
    if (!set) return null

    const env = makeEnvelope(pv.silhouette, { A: 0, H: pv.size })
    const fitted = fitToEnvelope(set, env)
    const anchors = findAnchors(fitted, pv.letters)
    const { prims } = compose(anchors, env, { ...pv.ornament, ...pv.composition }, genome.seed, fitted.polys)
    const ornament = toPolygons(prims)
    // the sigil is filled into the same nonzero path, so it is wound with
    // everything else or it subtracts wherever it touches
    const wind = anchors.length ? anchors[0].outerSign : 1
    const sig = sigilPolys(pv.composition.sigil, env, fitted).map((p) => orient(p, wind))
    return { env, fitted, anchors, prims, polys: [...fitted.polys, ...ornament, ...sig] }
  }

  function inkPolys(genome) {
    const built = buildComposition(genome)
    return built ? built.polys : null
  }

  // The ink layer is rendered at whatever the view currently needs; zooming in
  // re-renders rather than scaling a layer up, because re-rendering is cheap now.
  function makeLayer(genome, ratio) {
    const polys = polysRef.current
    if (!polys) return null
    const ink = pRef.current.ink
    return renderInk(
      polys,
      // swell is the dial's name for it: how far the ink spreads before it is
      // thresholded back to a hard edge.
      { bleed: ink.swell, threshold: ink.threshold, grit: ink.grit },
      genome.seed * 31 + 7,
      Math.min(2.5, Math.max(1, ratio)),
      colorsRef.current.fg,
    )
  }

  function paintLayer(canvas, layer, r) {
    if (!canvas || !layer) return
    /* Clamped, and not as a nicety. ctx.ellipse THROWS on a negative radius,
       and the throw happened between the background fill and the drawImage —
       so the canvas was left wiped, the rAF chain died with the exception and
       nothing ever repainted it. That is the "logo vanished and I panned
       around looking for it": there was nothing out there to find. */
    const reveal = Math.max(0, Math.min(1, r))
    const cssW = canvas.clientWidth
    if (!cssW) return
    const dpr = blitRatio()
    const cssH = canvas.clientHeight || (cssW * LOGICAL_H) / LOGICAL_W
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = colorsRef.current.bg
    ctx.fillRect(0, 0, cssW, cssH)
    const s = Math.min(cssW / LOGICAL_W, cssH / LOGICAL_H)
    const w = LOGICAL_W * s
    const h = LOGICAL_H * s
    const ox = (cssW - w) / 2
    const oy = (cssH - h) / 2
    if (reveal < 1) {
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(
        ox + w / 2, oy + h / 2,
        Math.max(0, w * (0.2 + 0.62 * reveal)),
        Math.max(0, h * 0.78 * reveal),
        0, 0, Math.PI * 2,
      )
      ctx.clip()
    }
    ctx.drawImage(layer, ox, oy, w, h)
    if (reveal < 1) ctx.restore()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /* Two keys, because they cost different things. Everything that changes the
     POLYGONS is one; the ink dials are the other and repaint the same polygons
     on the GPU, which is why dragging swell is free.

     This used to be one key holding only text, font and size — so every dial in
     the panel below those three did nothing at all. */
  const geomKey = JSON.stringify({
    text: p.text, font: p.font, size: p.size,
    svg: svg ? svg.stamp : null, fontsReady,
    silhouette: p.silhouette, letters: p.letters,
    ornament: p.ornament, composition: p.composition,
  })
  const inkKey = JSON.stringify(p.ink)
  const lastGeom = useRef(null)
  const lastSeed = useRef(null)

  useEffect(() => {
    if (!fontsReady) return
    const geomChanged = lastGeom.current !== geomKey
    if (geomChanged) {
      polysRef.current = inkPolys(genome)
      lastGeom.current = geomKey
    }
    if (!polysRef.current) return
    const ratio = blitRatio()
    layerRef.current = makeLayer(genome, ratio)
    layerRatio.current = ratio
    artRef.current = layerRef.current
    /* The grow-out belongs to a NEW COMPOSITION — Mutate, Grow, Fresh, Back, a
       new word — and the seed is what says so. Keying it on the geometry meant
       every step of a dial drag armed another 900ms reveal, so the mark spent
       the whole drag at a few percent of itself and only came back a second
       after you let go. A dial is a live control: it repaints, whole. */
    const fresh = lastSeed.current !== genome.seed
    lastSeed.current = genome.seed
    if (geomChanged && fresh) growOut(layerRef.current)
    else paintLayer(singleRef.current, layerRef.current, 1)
  }, [genome, geomKey, inkKey])

  // dev-only: #svgdump overlays the traced vector of the selected variant
  useEffect(() => {
    if (!location.hash.includes('svgdump') || !fontsReady) return
    const raf = requestAnimationFrame(async () => {
      const art = await buildArt(genome)
      if (!art) return
      const s = svgString(art, { fg: '#0a0a0a', bg: '#f2f0ec' }, p.transparentBg)
      document.title = `svgdump ${s.length}B ${(s.match(/M/g) || []).length} loops`
      setSvgDump(s.replace('<svg ', '<svg style="width:min(100%,1100px)" '))
    })
    return () => cancelAnimationFrame(raf)
  }, [genome, geomKey, fontsReady])

  function onFile(e) {
    loadSvgFile(e.target.files?.[0], setSvg)
    e.target.value = ''
  }

  return (
    <div style={styles.page}>
      <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={onFile} />
      <div ref={viewportRef} style={styles.viewport}>
        <div ref={worldRef} style={styles.world}>
          <div
            style={{ ...styles.cell, width: WORLD_W }}
            onDoubleClick={() => { if (!suppressClick.current) mutateOne() }}
            title="double-click to mutate"
          >
            <canvas ref={singleRef} style={styles.cellCanvas} />
          </div>
        </div>
      </div>
      {dragging && <div style={styles.dropVeil}>drop .svg</div>}
      {svgDump && <div style={styles.svgDump} dangerouslySetInnerHTML={{ __html: svgDump }} />}
    </div>
  )
}

const styles = {
  page: {
    height: '100vh',
    overflow: 'hidden',
  },
  viewport: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    touchAction: 'none',
    overscrollBehavior: 'none',
    cursor: 'grab',
  },
  world: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: WORLD_W,
    transformOrigin: '0 0',
    willChange: 'transform',
  },
  cell: {
    background: 'var(--field)',
    cursor: 'pointer',
    borderRadius: 2,
  },
  cellCanvas: {
    width: '100%',
    display: 'block',
    aspectRatio: '1400 / 800',
  },
  dropVeil: {
    position: 'fixed',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'color-mix(in srgb, var(--bg) 75%, transparent)',
    border: '1px dashed var(--muted)',
    color: 'var(--ink)',
    fontSize: 18,
    letterSpacing: '0.1em',
    pointerEvents: 'none',
    zIndex: 600,
  },
  svgDump: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg)',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    zIndex: 600,
  },
}
