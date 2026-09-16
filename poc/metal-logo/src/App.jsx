import { useEffect, useRef, useState } from 'react'
import { useDialKitController } from 'dialkit'
import {
  extractLetterform,
  growTendrils,
  mirrorBranches,
  makeRng,
  LOGICAL_W,
  LOGICAL_H,
} from './generator.js'
import { branchOutline } from './outline.js'
import { renderInk } from './raster.js'
import { fixturePolys } from './engine/fixture.js'
import {
  loadFont,
  FONT_NAMES,
  textGeometry,
  imageGeometry,
  svgString,
  exportSvg,
  rasterizeForAnalysis,
} from './vector.js'

const FONTS = FONT_NAMES
const ENVELOPES = ['free', 'arch', 'bat-wing', 'crown']
const BASE = import.meta.env.BASE_URL || '/'

// The legibility dial has four named stops, each a whole parameter mix —
// the genre's own spectrum, with its exemplars.
const STOPS = {
  'Readable but cold': { // Darkthrone
    growth: { length: 0.45, wings: 0.3, depth: 2, splitChance: 0.25, chaos: 0.3, flare: 0.4, curl: 0.15, taper: 0.9, sprouts: 0.05, counters: 0.05, crownRoot: 0.5, symBreak: 0.2, envelope: 'free' },
    ink: { bleed: 1.2, threshold: 0.45, grit: 0.2 },
    dislocation: 0.05, symmetry: false,
  },
  'Unstable': { // Mayhem
    growth: { length: 0.8, wings: 0.4, depth: 3, splitChance: 0.45, chaos: 0.8, flare: 0.35, curl: 0.5, taper: 0.8, sprouts: 0.2, counters: 0.2, crownRoot: 0.4, symBreak: 0.5, envelope: 'free' },
    ink: { bleed: 2.0, threshold: 0.4, grit: 0.45 },
    dislocation: 0.8, symmetry: false,
  },
  'Breaking point': { // early Immortal
    growth: { length: 1.1, wings: 0.6, depth: 4, splitChance: 0.55, chaos: 0.55, flare: 0.5, curl: 0.35, taper: 0.85, sprouts: 0.15, counters: 0.3, crownRoot: 0.6, symBreak: 0.35, envelope: 'bat-wing' },
    ink: { bleed: 2.4, threshold: 0.42, grit: 0.3 },
    dislocation: 0.25, symmetry: false,
  },
  'Total sigil': { // Xasthur / Leviathan
    growth: { length: 1.7, wings: 0.8, depth: 5, splitChance: 0.7, chaos: 0.7, flare: 0.6, curl: 0.5, taper: 0.8, sprouts: 0.45, counters: 0.7, crownRoot: 0.7, symBreak: 0.25, envelope: 'arch' },
    ink: { bleed: 3.4, threshold: 0.38, grit: 0.35 },
    dislocation: 0.35, symmetry: true,
  },
}

const RANGES = {
  length: [0.1, 3], wings: [0, 1], depth: [0, 6], splitChance: [0, 1],
  chaos: [0, 1], flare: [0, 1], curl: [0, 1], taper: [0, 1],
  sprouts: [0, 1], counters: [0, 1], crownRoot: [0, 1], symBreak: [0, 1], dislocation: [0, 1],
  bleed: [0, 10], threshold: [0.05, 0.95], grit: [0, 1],
}

let seedCounter = (Math.random() * 1e9) | 0
const nextSeed = () => (seedCounter = (seedCounter + 0x9e3779b9) >>> 0)

function genomeFromStop(stop, seed) {
  const s = STOPS[stop] || STOPS['Breaking point']
  return {
    seed,
    dislocation: s.dislocation,
    symmetry: s.symmetry,
    growth: { ...s.growth },
    ink: { ...s.ink },
  }
}

function mutateNum(v, [min, max], strength, rand) {
  const span = max - min
  const nv = v + (rand() * 2 - 1) * strength * span * 0.35
  return Math.min(max, Math.max(min, nv))
}

// seedOnly: same recipe, different dice — two of the eight children
function mutate(parent, strength, rand, seedOnly = false) {
  const child = {
    seed: nextSeed(),
    dislocation: parent.dislocation,
    symmetry: parent.symmetry,
    growth: { ...parent.growth },
    ink: { ...parent.ink },
  }
  if (seedOnly) return child
  for (const k of Object.keys(child.growth)) {
    if (typeof child.growth[k] !== 'number') continue
    child.growth[k] = mutateNum(child.growth[k], RANGES[k], strength, rand)
  }
  child.growth.depth = Math.round(child.growth.depth)
  if (rand() < strength * 0.3) child.growth.envelope = ENVELOPES[(rand() * ENVELOPES.length) | 0]
  for (const k of Object.keys(child.ink)) {
    child.ink[k] = mutateNum(child.ink[k], RANGES[k], strength, rand)
  }
  child.dislocation = mutateNum(child.dislocation, RANGES.dislocation, strength * 0.7, rand)
  if (rand() < strength * 0.15) child.symmetry = !child.symmetry
  return child
}

// Not a mutation of what is on screen — every growth dial thrown to somewhere
// new in its own range, ink and symmetry left where they are. Mutate walks; this
// jumps. The ranges are the same ones the panel draws, so nothing it produces is
// out of bounds.
function randomGrowth(base) {
  const rand = makeRng(nextSeed())
  const growth = { ...base.growth }
  for (const k of Object.keys(growth)) {
    if (typeof growth[k] !== 'number') continue
    const [min, max] = RANGES[k]
    growth[k] = min + rand() * (max - min)
  }
  growth.depth = Math.round(growth.depth)
  growth.envelope = ENVELOPES[(rand() * ENVELOPES.length) | 0]
  const [dmin, dmax] = RANGES.dislocation
  return {
    seed: nextSeed(),
    dislocation: dmin + rand() * (dmax - dmin),
    symmetry: base.symmetry,
    growth,
    ink: { ...base.ink },
  }
}

function genomesMatch(g, variant, ink, symmetry) {
  for (const k of Object.keys(g.growth)) {
    if (typeof g.growth[k] === 'string') {
      if (g.growth[k] !== variant[k]) return false
    } else if (Math.abs(g.growth[k] - variant[k]) > 1e-6) return false
  }
  if (Math.abs(g.dislocation - variant.dislocation) > 1e-6) return false
  for (const k of Object.keys(g.ink)) {
    if (Math.abs(g.ink[k] - ink[k]) > 1e-6) return false
  }
  return g.symmetry === symmetry
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
  const squintRef = useRef(null)
  const fileRef = useRef(null)
  const polysRef = useRef(null)  // letterform + tendrils, before any ink
  const layerRef = useRef(null)  // the painted ink, tinted, at the current ratio
  const artRef = useRef(null)    // what the grow-out animation is animating
  const growRaf = useRef(0)
  const layerRatio = useRef(0)
  const maskCache = useRef(new Map())
  const lfCache = useRef(new WeakMap())
  const historyRef = useRef([])
  const colorsRef = useRef({ bg: '#0d1b1e', fg: '#fff5f5' })

  const [genome, setGenome] = useState(() => genomeFromStop(DEFAULT_STOP, nextSeed()))
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
      variant: {
        length: [1.1, 0.1, 3],
        wings: [0.6, 0, 1],
        depth: [4, 0, 6, 1],
        splitChance: [0.55, 0, 1],
        chaos: [0.55, 0, 1],
        flare: [0.5, 0, 1],
        curl: [0.35, 0, 1],
        taper: [0.85, 0, 1],
        sprouts: [0.15, 0, 1],
        counters: [0.3, 0, 1],
        crownRoot: [0.6, 0, 1],
        symBreak: [0.35, 0, 1],
        envelope: { type: 'select', options: ENVELOPES, default: 'bat-wing' },
        dislocation: [0.25, 0, 1],
      },
      ink: {
        bleed: [2.4, 0, 10],
        threshold: [0.42, 0.05, 0.95],
        grit: [0.3, 0, 1],
      },
      symmetry: false,
      transparentBg: true,
      // Grow the logo out of its middle when it changes, rather than cutting to
      // it. Off is the old behaviour, and what reduced-motion gets.
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
    paintLayer(squintRef.current, layerRef.current, 1)
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
    const started = performance.now()
    growRaf.current = requestAnimationFrame(function step(now) {
      if (artRef.current !== layer) return
      const t = Math.min(1, (now - started) / GROW_MS)
      paintLayer(canvas, layer, easeOut(t))
      if (t < 1) growRaf.current = requestAnimationFrame(step)
    })
  }

  // The world is full-bleed and pans under the glass, and it centres on the
  // viewport's own centre: the sheet is an overlay, not a column cut out of
  // the page, and minimising it uncovers whatever it was lying on.
  function centerView() {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const contentH = SINGLE_H
    view.current = {
      x: (rect.width - WORLD_W) / 2,
      y: Math.max(200, (rect.height - contentH) / 2 + 60),
      z: 1,
    }
    applyView()
  }

  function pushHistory(g) {
    historyRef.current.push(g)
    if (historyRef.current.length > 50) historyRef.current.shift()
  }

  function syncPanel(genome) {
    pendingSync.current = true
    controller.setValues({
      variant: { ...genome.growth, dislocation: genome.dislocation },
      ink: { ...genome.ink },
      symmetry: genome.symmetry,
    })
  }

  // Mutate walks from where you are, at the strength the panel is set to.
  function mutateOne() {
    pushHistory(genomeRef.current)
    const next = mutate(genomeRef.current, pRef.current.mutation, makeRng(nextSeed()))
    setGenome(next)
    syncPanel(next)
  }

  // Grow jumps: every growth dial re-rolled, ink and symmetry left alone.
  function growRandom() {
    pushHistory(genomeRef.current)
    const next = randomGrowth(genomeRef.current)
    setGenome(next)
    syncPanel(next)
  }

  function freshOne(stop = pRef.current.legibility) {
    pushHistory(genomeRef.current)
    const next = genomeFromStop(stop, nextSeed())
    setGenome(next)
    syncPanel(next)
  }

  function goBack() {
    const last = historyRef.current.pop()
    if (!last) return
    setGenome(last)
    syncPanel(last)
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

  // one logo, so the world only ever needs centring once the viewport settles
  useEffect(() => {
    centerView()
    const raf = requestAnimationFrame(reblitAll)
    return () => cancelAnimationFrame(raf)
  }, [])

  // legibility stop change → a new logo at that stop (skip first mount)
  const firstStop = useRef(true)
  useEffect(() => {
    if (firstStop.current) { firstStop.current = false; return }
    freshOne(p.legibility)
  }, [p.legibility])

  // dial edits write into the genome. A syncPanel call echoes back through this
  // effect exactly once — the pendingSync flag swallows it.
  const variantKey = JSON.stringify({ v: p.variant, ink: p.ink, sym: p.symmetry })
  useEffect(() => {
    if (pendingSync.current) {
      pendingSync.current = false
      return
    }
    setGenome((g) => {
      if (!g || genomesMatch(g, p.variant, p.ink, p.symmetry)) return g
      const { dislocation, ...growth } = p.variant
      return { ...g, dislocation, symmetry: p.symmetry, growth: { ...growth }, ink: { ...p.ink } }
    })
  }, [variantKey])

  function getGeometry(genome) {
    const src = svgRef.current
    const pv = pRef.current
    const key = src
      ? `svg|${src.stamp}`
      : `t|${pv.text}|${pv.font}|${pv.size}|${genome.dislocation.toFixed(3)}|${genome.dislocation > 0.01 ? genome.seed : 0}`
    const cached = maskCache.current.get(key)
    if (cached) return cached
    const polys = src
      ? imageGeometry(src.img)
      : textGeometry(pv.text || 'METAL', pv.font, pv.size, genome.dislocation, makeRng(genome.seed ^ 0x51ab))
    if (!polys || !polys.length) return null
    const geom = { polys, mask: rasterizeForAnalysis(polys) }
    maskCache.current.set(key, geom)
    if (maskCache.current.size > 30) {
      maskCache.current.delete(maskCache.current.keys().next().value)
    }
    return geom
  }

  function getLetterform(mask) {
    let lf = lfCache.current.get(mask)
    if (!lf) {
      lf = extractLetterform(mask)
      lfCache.current.set(mask, lf)
    }
    return lf
  }

  // Async because Clipper arrives with it: every cell on screen is built in a
  // worker, so the main thread only ever needs art.js for Export, the
  // no-worker fallback and #svgdump — three things nobody is waiting on at
  // load. import() is cached, so only the first call pays for the fetch.
  async function buildArt(genome) {
    const geom = getGeometry(genome)
    if (!geom || !geom.mask.coverage) return null
    const lf = getLetterform(geom.mask)
    const { branchOutline, inkVector, makeArt } = await import('./art.js')
    const rand = makeRng(genome.seed * 2654435761)
    let branches = growTendrils(lf, geom.mask, { ...genome.growth }, rand)
    if (genome.symmetry) {
      const cx = (geom.mask.bbox.minX + geom.mask.bbox.maxX) / 2
      branches = branches.concat(mirrorBranches(branches, cx, genome.growth.symBreak || 0, rand))
    }
    const outlines = branches.map(branchOutline).filter(Boolean)
    const polys = inkVector(
      [...geom.polys, ...outlines],
      { ...genome.ink, gritSeed: genome.seed * 31 + 7 }
    )
    return makeArt(polys)
  }

  /* The render, which is now a handful of canvas ops rather than a job queue.
     renderInk does the whole ink pipeline on the GPU, so there is nothing left
     worth moving off the main thread — and nothing left that could block it.
     The worker pool, the job tokens and the stale-cell bookkeeping all existed
     to hide 1.7 seconds of clipping that no longer happens. */

  function inkPolys(genome) {
    const geom = getGeometry(genome)
    if (!geom || !geom.mask.coverage) return null
    /* #fixture — the aesthetic probe. Letterform plus sixteen hand-placed
       ornaments and nothing else: no growth, no recursion, no seeds on the
       boundary. It exists to answer one question before the engine that would
       place these automatically gets built. */
    if (location.hash.includes('fixture')) {
      return [...geom.polys, ...fixturePolys(geom.polys)]
    }
    const lf = getLetterform(geom.mask)
    const rand = makeRng(genome.seed * 2654435761)
    let branches = growTendrils(lf, geom.mask, { ...genome.growth }, rand)
    if (genome.symmetry) {
      const cx = (geom.mask.bbox.minX + geom.mask.bbox.maxX) / 2
      branches = branches.concat(mirrorBranches(branches, cx, genome.growth.symBreak || 0, rand))
    }
    const outlines = branches.map(branchOutline).filter(Boolean)
    return [...geom.polys, ...outlines]
  }

  // The ink layer is rendered at whatever the view currently needs; zooming in
  // re-renders rather than scaling a layer up, because re-rendering is cheap now.
  function makeLayer(genome, ratio) {
    const polys = polysRef.current
    if (!polys) return null
    return renderInk(
      polys,
      genome.ink,
      genome.seed * 31 + 7,
      Math.min(2.5, Math.max(1, ratio)),
      colorsRef.current.fg,
    )
  }

  function paintLayer(canvas, layer, reveal) {
    if (!canvas || !layer) return
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
        w * (0.2 + 0.62 * reveal),
        h * 0.78 * reveal,
        0, 0, Math.PI * 2,
      )
      ctx.clip()
    }
    ctx.drawImage(layer, ox, oy, w, h)
    if (reveal < 1) ctx.restore()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  const globalKey = JSON.stringify({
    text: p.text, font: p.font, size: p.size,
    svg: svg ? svg.stamp : null, fontsReady,
  })

  // Geometry only changes with the letterform or the growth; the ink dials
  // repaint from the same polygons, which is why dragging bleed is free.
  useEffect(() => {
    if (!fontsReady) return
    polysRef.current = inkPolys(genome)
    layerRef.current = makeLayer(genome, blitRatio())
    artRef.current = layerRef.current
    if (squintRef.current && layerRef.current) paintLayer(squintRef.current, layerRef.current, 1)
    growOut(layerRef.current)
  }, [genome, globalKey])

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
  }, [genome, globalKey, fontsReady])

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
      <span className="metal-hint">
        drag pans · pinch / ⌘+wheel zooms · double-click mutates
      </span>
      <div className="metal-squint">
        <span className="metal-squint__label">patch test</span>
        <canvas ref={squintRef} className="metal-squint__canvas" />
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
