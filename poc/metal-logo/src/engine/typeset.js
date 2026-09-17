// Typesetting the word INTO the envelope.
//
// The old engine laid the glyphs out in a straight line at one size and then
// auto-fitted whatever the growth produced. Two consequences, both of which the
// owner saw: the wordmark had no shape of its own, and turning growth up made
// the LETTERS smaller, because the fit was driven by the inked result.
//
// Here the fit is driven by the envelope and nothing else. Ornament can never
// shrink the letters again — it can only reach further.
//
// Space: y DOWN, baseline at y = 0, cap line at y = -capH.

import { flattenCommands } from '../flatten.js'

/* Outer letters bigger, the baseline arced, each glyph nudged off true. The
   three moves a letterer makes before drawing a single spike. */
export function typeset(font, text, size, opts, rand) {
  const { outerBias = 0.35, tracking = -0.02, arc = 0.25, dislocation = 0.25 } = opts
  const chars = [...text].filter((c) => c.trim().length || c === ' ')
  if (!chars.length) return null

  const n = chars.length
  const mid = (n - 1) / 2
  const trackPx = tracking * size

  // pass 1 — per-glyph claim and advance
  const items = []
  let x = 0
  for (let i = 0; i < n; i++) {
    const ch = chars[i]
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid
    const claim = 1 + outerBias * Math.pow(t, 1.3)
    const gs = size * claim
    const w = font.getAdvanceWidth(ch, gs)
    items.push({ ch, i, claim, gs, x, w })
    x += w + trackPx
  }

  // pass 2 — place, arc, dislocate
  const glyphs = []
  for (const it of items) {
    if (it.ch === ' ') continue
    const path = font.getPath(it.ch, it.x, 0, it.gs)
    let polys = flattenCommands(path.commands)
    if (!polys.length) continue

    const u = mid === 0 ? 0 : (it.i - mid) / mid
    // the arc peaks at the centre and is a RISE, so the outer letters sit lower
    const dy = arc * 0.22 * size * (1 - u * u) * -1
    const rot = dislocation * 0.09 * (rand() - 0.5) * 2
    const sc = 1 + dislocation * 0.07 * (rand() - 0.5) * 2
    const gx = it.x + it.w / 2
    const gy = -it.gs * 0.32
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    polys = polys.map((poly) =>
      poly.map(([px, py]) => {
        const ax = (px - gx) * sc
        const ay = (py - gy) * sc
        return [gx + ax * cos - ay * sin, gy + dy + ax * sin + ay * cos]
      }),
    )
    glyphs.push({ ch: it.ch, index: it.i, claim: it.claim, polys, bbox: bboxOf(polys) })
  }
  if (!glyphs.length) return null

  const all = glyphs.flatMap((g) => g.polys)
  return { glyphs, polys: all, bbox: bboxOf(all), capH: size }
}

export function bboxOf(polys) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
  for (const poly of polys) {
    for (const p of poly) {
      if (p[0] < minX) minX = p[0]
      if (p[0] > maxX) maxX = p[0]
      if (p[1] < minY) minY = p[1]
      if (p[1] > maxY) maxY = p[1]
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/* One uniform transform that seats the word in the envelope's box with a
   margin. Driven by E, never by the ink — that is the whole point. */
export function fitToEnvelope(set, env, margin = 0.06) {
  const b = set.bbox
  const boxW = env.halfW * 2 * (1 - margin)
  const boxH = env.H * 1.9 * (1 - margin)
  const s = Math.min(boxW / Math.max(1, b.w), boxH / Math.max(1, b.h), 1.35)
  const tx = env.A - b.cx * s
  const ty = env.mid - b.cy * s
  const map = (poly) => poly.map(([x, y]) => [x * s + tx, y * s + ty])
  const glyphs = set.glyphs.map((g) => {
    const polys = g.polys.map(map)
    return { ...g, polys, bbox: bboxOf(polys) }
  })
  const polys = glyphs.flatMap((g) => g.polys)
  return { ...set, glyphs, polys, bbox: bboxOf(polys), scale: s }
}
