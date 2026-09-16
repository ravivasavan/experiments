// Ink, on the GPU.
//
// The ink pipeline is three morphological operations — an open, a close and a
// net thicken — followed by a grit subtraction. Done as polygon booleans
// (a union, three round-join Clipper offsets, then up to 1200 grit polygons
// differenced out) one logo cost about 1.7 seconds. That is what made a dial
// drag feel broken: every frame of the drag queued another 1.7s of clipping.
//
// All four are raster operations at heart, and the compositor already does
// them. A Gaussian blur followed by a hard threshold on alpha IS a
// morphological close when the threshold is low and an open when it is high —
// which is exactly what `bleed` and `threshold` meant before the vector engine
// reinterpreted them as offsets. The grit is a destination-out fill. One SVG
// filter and three canvas passes, on the GPU.
//
// Clipper has not gone anywhere: Export still needs it, because a PNG can come
// off this canvas but an SVG needs real polygons. It is just no longer on the
// path between moving a dial and seeing the result.

import { LOGICAL_W, LOGICAL_H, makeRng } from './generator.js'

const FILTER_ID = 'metal-ink'

// How hard the threshold is. The colour matrix maps alpha a → K·(a − t), so K
// is the steepness of the edge: high enough to read as a hard cut, low enough
// to leave a pixel of antialiasing behind.
const EDGE = 70

let blurNode = null
let matrixNode = null

function ensureFilter() {
  if (matrixNode) return true
  if (typeof document === 'undefined') return false
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  const filter = document.createElementNS(NS, 'filter')
  filter.setAttribute('id', FILTER_ID)
  // sRGB, or the blur happens in linear light and the threshold lands somewhere
  // other than where the number says.
  filter.setAttribute('color-interpolation-filters', 'sRGB')
  blurNode = document.createElementNS(NS, 'feGaussianBlur')
  blurNode.setAttribute('stdDeviation', '0')
  matrixNode = document.createElementNS(NS, 'feColorMatrix')
  matrixNode.setAttribute('type', 'matrix')
  filter.append(blurNode, matrixNode)
  svg.append(filter)
  document.body.append(svg)
  return true
}

// alpha' = EDGE·alpha − EDGE·t, clamped. Below t it floors at 0, above it
// saturates at 1, and the couple of percent either side is the antialiasing.
function setInk(bleed, threshold) {
  blurNode.setAttribute('stdDeviation', String(bleed))
  const t = Math.min(0.95, Math.max(0.05, threshold))
  matrixNode.setAttribute(
    'values',
    `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${EDGE} ${-EDGE * t}`,
  )
}

let filterOk = null
function canFilter(ctx) {
  if (filterOk !== null) return filterOk
  // ctx.filter is unsupported in some Safari builds; a page that cannot run it
  // still gets the artwork, just without the ink swelling.
  filterOk = typeof ctx.filter === 'string' && ensureFilter()
  return filterOk
}

export function pathFromPolys(polys) {
  let d = ''
  for (const poly of polys) {
    if (!poly || poly.length < 3) continue
    d += `M${poly[0][0]} ${poly[0][1]}`
    for (let i = 1; i < poly.length; i++) d += `L${poly[i][0]} ${poly[i][1]}`
    d += 'Z'
  }
  return new Path2D(d)
}

// The same speckle the vector engine subtracted, in logical units and drawn
// rather than differenced.
function gritPath(grit, seed) {
  const rand = makeRng(seed)
  const n = Math.round(grit * 1200)
  let d = ''
  for (let i = 0; i < n; i++) {
    const cx = rand() * LOGICAL_W
    const cy = rand() * LOGICAL_H
    const r = 0.6 + rand() * grit * 2.4
    const sides = 3 + ((rand() * 3) | 0)
    const rot = rand() * Math.PI
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      d += (k ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)
    }
    d += 'Z'
  }
  return new Path2D(d)
}

/* Paint the ink onto a transparent layer at `ratio` device pixels per logical
   unit, tinted `fg`. The caller composites it over whatever background it
   wants, which is what lets the grow-out clip the ink without clipping the
   page behind it. */
/* The same fit artGeometry applies before it hands a path to the page: centre
   the artwork in the logical frame with a margin, scaling up to 1.6× if it is
   small. Without it the ink is drawn wherever the letterform happens to sit,
   at whatever size the font gave it. */
export function fitTransform(polys) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
  for (const poly of polys) {
    for (const pt of poly) {
      if (pt[0] < minX) minX = pt[0]
      if (pt[0] > maxX) maxX = pt[0]
      if (pt[1] < minY) minY = pt[1]
      if (pt[1] > maxY) maxY = pt[1]
    }
  }
  if (minX > maxX) return null
  const margin = 30
  const bw = Math.max(1, maxX - minX)
  const bh = Math.max(1, maxY - minY)
  const fit = Math.min((LOGICAL_W - margin * 2) / bw, (LOGICAL_H - margin * 2) / bh, 1.6)
  return {
    fit,
    ox: (LOGICAL_W - bw * fit) / 2 - minX * fit,
    oy: (LOGICAL_H - bh * fit) / 2 - minY * fit,
  }
}

export function renderInk(polys, ink, seed, ratio, fg) {
  const w = Math.max(1, Math.round(LOGICAL_W * ratio))
  const h = Math.max(1, Math.round(LOGICAL_H * ratio))
  const t = fitTransform(polys)
  if (!t) return null
  const layer =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = layer.getContext('2d')
  // logical → fitted → device, in one transform
  ctx.setTransform(t.fit * ratio, 0, 0, t.fit * ratio, t.ox * ratio, t.oy * ratio)

  const path = pathFromPolys(polys)

  if (ink.bleed > 0.05 && canFilter(ctx)) {
    // ctx.filter rasterises in device pixels and ignores the transform, so the
    // radius has to be carried through both scales by hand — otherwise the ink
    // swells by a different amount at every zoom level.
    setInk(ink.bleed * t.fit * ratio, ink.threshold)
    ctx.filter = `url(#${FILTER_ID})`
  }
  ctx.fillStyle = '#000'
  ctx.fill(path, 'nonzero')
  ctx.filter = 'none'

  if (ink.grit > 0.01) {
    // The speckle is subtracted in the same pre-fit space the vector engine
    // used, so it rides the same transform.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill(gritPath(ink.grit, seed), 'nonzero')
  }

  // Recolour what survived: the alpha is the artwork, the colour is the theme's.
  ctx.globalCompositeOperation = 'source-in'
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = fg
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  return layer
}
