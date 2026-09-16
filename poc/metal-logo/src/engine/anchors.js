// Where ornament is allowed to start.
//
// This is the fix. The old engine seeded the ENTIRE raster boundary on an 18px
// grid — every edge of every stroke of every letter — and grew a branching walk
// from each seed. Uniform seeds plus recursion is fur.
//
// An anchor here is a CONVEX EXTREMITY of the simplified silhouette: a place
// where the outline turns sharply and faces away from the word. A mid-stem
// point is not one, because a straight edge has no turn. So "sprouts from
// everywhere" is excluded by what an anchor IS, not filtered out afterwards.
//
// The simplification is load-bearing and it is why this works on these faces.
// Metal Mania's 'A' has 113 corners in its outline; they are ornamental
// raggedness the type designer drew, and no classifier can tell them from
// structure. So: find anchors on a SMOOTHED outline, and draw the ragged one.

import { bboxOf } from './typeset.js'

/* Ramer–Douglas–Peucker, which is the cheap way to throw away the drawn
   raggedness and keep the shape.

   A closed ring cannot be fed to RDP directly: its first and last point are the
   same, so the seed chord has zero length, every perpendicular distance from it
   computes as zero, and the whole ring collapses to two points. Split it at the
   vertex farthest from the start and simplify the two open chains. */
function rdpOpen(pts, eps) {
  const n = pts.length
  if (n < 3) return pts.slice()
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    if (b - a < 2) continue
    const ax = pts[a][0]
    const ay = pts[a][1]
    const dx = pts[b][0] - ax
    const dy = pts[b][1] - ay
    const len = Math.hypot(dx, dy)
    let far = -1
    let best = eps
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] - ax
      const py = pts[i][1] - ay
      // a degenerate chord falls back to straight-line distance from the start
      const d = len > 1e-9 ? Math.abs(px * dy - py * dx) / len : Math.hypot(px, py)
      if (d > best) { best = d; far = i }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]) }
  }
  const out = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out
}

function simplify(ring, eps) {
  const n = ring.length
  if (n < 6) return ring
  let far = 1
  let best = -1
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
    if (d > best) { best = d; far = i }
  }
  const a = rdpOpen(ring.slice(0, far + 1), eps)
  const b = rdpOpen(ring.slice(far), eps)
  return a.slice(0, -1).concat(b.slice(0, -1))
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l] }

/* Signed area: positive means the ring winds one way, and we use that to know
   which side is OUT. A counter (the hole in an O) winds the other way, and its
   corners point inward — those are not anchors and are dropped. */
function area(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

/* An anchor per sharp convex vertex, with the outward normal that a spike
   would leave along. */
function ringAnchors(ring, outerSign, glyphIndex, minTurn) {
  const out = []
  const n = ring.length
  if (n < 5) return out
  for (let i = 0; i < n; i++) {
    const p = ring[i]
    const a = ring[(i - 1 + n) % n]
    const b = ring[(i + 1) % n]
    const t0 = norm(sub(p, a))
    const t1 = norm(sub(b, p))
    const cross = t0[0] * t1[1] - t0[1] * t1[0]
    const dot = t0[0] * t1[0] + t0[1] * t1[1]
    const turn = Math.atan2(cross, dot)
    // convex on the OUTSIDE of this ring, and sharp enough to be a feature
    if (Math.sign(turn) !== Math.sign(outerSign)) continue
    if (Math.abs(turn) < minTurn) continue
    // the bisector, pointing away from the shape
    const bis = norm([t0[0] - t1[0], t0[1] - t1[1]])
    const nx = -bis[1] * outerSign
    const ny = bis[0] * outerSign
    const seg = (Math.hypot(...sub(p, a)) + Math.hypot(...sub(b, p))) / 2
    out.push({
      x: p[0], y: p[1],
      nx, ny,
      turn: Math.abs(turn),
      width: seg,
      glyph: glyphIndex,
      id: glyphIndex * 1000 + i,
    })
  }
  return out
}

/* class: where on the word this anchor sits. It decides both the weight it
   carries and whether it is allowed a major at all. */
function classify(a, set) {
  const b = set.bbox
  const upper = b.minY + b.h * 0.34
  const lower = b.maxY - b.h * 0.30
  if (a.y <= upper && a.ny < -0.25) return 'crown'      // pointing up off the top
  if (a.y >= lower && a.ny > 0.25) return 'root'        // pointing down off the bottom
  if (Math.abs(a.nx) > 0.62) return 'flank'             // pointing out to the side
  return 'edge'
}

export function findAnchors(set, opts) {
  const prune = opts.prune ?? 1.6
  const minTurn = opts.minTurn ?? 0.5
  const anchors = []

  set.glyphs.forEach((g) => {
    /* The tolerance is relative to THIS glyph, not to the nominal cap height:
       the envelope fit rescales everything, and an absolute epsilon computed
       before that fit simplifies every ring away to nothing. */
    const scale = Math.max(g.bbox.w, g.bbox.h) || 1
    // the outer ring is the one with the largest area, which is not reliably
    // the first one the font hands back
    let outer = g.polys[0]
    let outerA = Math.abs(area(g.polys[0] || []))
    for (const r of g.polys) {
      const a = Math.abs(area(r))
      if (a > outerA) { outerA = a; outer = r }
    }
    const outerSign = Math.sign(area(outer)) || 1

    for (const ring of g.polys) {
      if (Math.sign(area(ring)) !== outerSign) continue   // a counter, not an edge
      let simple = simplify(ring, scale * 0.035 * prune)
      if (simple.length < 5) simple = simplify(ring, scale * 0.012 * prune)
      if (simple.length < 5) continue
      anchors.push(...ringAnchors(simple, outerSign, g.index, minTurn))
    }
  })

  for (const a of anchors) a.cls = classify(a, set)
  return anchors
}
