// Choosing the ornament: which anchors, how many, how long, and mirrored how.
//
// Everything here runs on at most 28 primitives, which is why it is instant and
// also why it reads as designed. The old engine had no budget at all — it grew
// until it ran out of recursion depth.
//
// Three ideas do the work:
//   1. A MOTIF SET drawn once per logo. Every ornament picks its angle and
//      curvature from the same small set, so the same hook recurs — repetition
//      is the third leg of the grammar and twenty-four independent random draws
//      look like noise, not lettering.
//   2. RANK AND BUDGET. Anchors are scored and the best N are spent.
//   3. MIRROR THE SELECTION, not the geometry. Reflecting finished polylines
//      lands spikes on top of other letters, rooted in solid ink with nothing
//      underneath. Instead, a chosen anchor looks for its opposite number among
//      the anchors that exist, and takes it only if one is close enough.

import { toPolygon } from './primitives.js'

const CLASS_W = { crown: 1.0, flank: 0.86, root: 0.66, edge: 0.3 }

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

/* One set per logo, and every ornament chooses from it rather than drawing its
   own. This is the single highest-value move against looking generated. */
export function makeMotif(seed, opts) {
  const angle = opts.angle ?? 0.4
  const curv = opts.curvature ?? 0.3
  return {
    angles: [0, 1, 2].map((i) => (hash(seed, 11 + i) - 0.5) * 2 * 0.44 * angle),
    curves: [0, 1].map((i) => (hash(seed, 31 + i) - 0.5) * 2 * curv),
    ratios: [0, 1].map((i) => 0.72 + hash(seed, 51 + i) * 0.28),
  }
}

function score(a, env, seed, crownRoot) {
  const w = CLASS_W[a.cls] ?? 0.3
  const outward = 1 + 1.2 * Math.min(1, Math.abs(a.x - env.A) / env.halfW)
  const vertical = a.y < env.baseline ? 1 + crownRoot : 1 - 0.5 * crownRoot
  return w * outward * vertical * (1 + 0.15 * hash(a.id, seed))
}

/* The opposite number: same distance out on the other side, same sort of place.
   `symmetry` is a TOLERANCE, not a switch — at 1 it demands a near-exact match
   and you get the heraldic extreme, at 0 it accepts almost nothing and the mark
   goes asymmetric. */
function findMirror(a, pool, env, symmetry) {
  const d = a.x - env.A
  let best = null
  let bestCost = Infinity
  for (const b of pool) {
    if (b.taken) continue
    if (Math.sign(b.x - env.A) === Math.sign(d)) continue
    const cost =
      Math.abs(-d - (b.x - env.A)) / env.halfW +
      0.5 * Math.abs(a.y - b.y) / env.H +
      (a.cls === b.cls ? 0 : 0.6)
    if (cost < bestCost) { bestCost = cost; best = b }
  }
  return bestCost < (1 - symmetry) * 1.2 + 0.28 ? best : null
}

export function compose(anchors, env, opts, seed) {
  const N = Math.round(opts.ornaments ?? 14)
  const majors = Math.min(Math.round(opts.majors ?? 4), N)
  const reach = opts.reach ?? 1.4
  const barbs = opts.barbs ?? 0.18
  const contrast = opts.contrast ?? 8
  const symmetry = opts.symmetry ?? 0.8
  const crownRoot = opts.crownRoot ?? 0.6
  const motif = makeMotif(seed, opts)
  const H = env.H

  const pool = anchors.map((a) => ({ ...a, taken: false }))
  for (const a of pool) a.score = score(a, env, seed, crownRoot)
  pool.sort((x, y) => y.score - x.score)

  // no single letter may eat the budget
  const glyphCount = new Set(pool.map((a) => a.glyph)).size || 1
  const perGlyph = Math.ceil(N / glyphCount) + 1
  const used = new Map()

  const chosen = []
  for (const a of pool) {
    if (chosen.length >= N) break
    if (a.taken) continue
    const c = used.get(a.glyph) || 0
    if (c >= perGlyph) continue
    a.taken = true
    used.set(a.glyph, c + 1)
    chosen.push({ a, rank: chosen.length, partner: null })

    if (chosen.length >= N) break
    const m = findMirror(a, pool, env, symmetry)
    if (m) {
      m.taken = true
      used.set(m.glyph, (used.get(m.glyph) || 0) + 1)
      chosen.push({ a: m, rank: chosen.length - 1, partner: a })
    }
  }

  // ---- synthesise. Two length modes and nothing between them, so the
  //      histogram is bimodal by construction rather than by sampling.
  const prims = []
  chosen.forEach((pick, idx) => {
    const a = pick.a
    const sigma = a.x < env.A ? -1 : 1
    const k = Math.floor(hash(a.id, seed + 7) * 3) % 3
    const ang = motif.angles[k] * sigma
    const ratio = motif.ratios[Math.floor(hash(a.id, seed + 17) * 2) % 2]

    // turn the outward normal away from the axis, once, for the whole primitive
    const cos = Math.cos(ang)
    const sin = Math.sin(ang)
    const dx = a.nx * cos - a.ny * sin
    const dy = a.nx * sin + a.ny * cos

    // A major is a statement and it is only made from an extremity. In the
    // middle of the word it is what reads as a root.
    const isMajor = pick.rank < majors && (a.cls === 'crown' || a.cls === 'flank')
    const w0 = Math.max(H * 0.022, Math.min(a.width * 1.15, H * 0.12))

    if (isMajor) {
      const hit = env.raycast(a.x, a.y, dx, dy, H * 3)
      let L = Math.max(hit, H * 0.35) * reach
      // A blade reaches the silhouette; it does not leave the page. The old
      // engine's tendrils had no upper bound at all.
      L = Math.min(Math.max(L, 0.45 * H), 1.5 * H)
      if (pick.partner) L *= 1 + (hash(a.id, seed + 23) - 0.5) * 0.3 * (1 - symmetry)
      const kap = motif.curves[Math.floor(hash(a.id, seed + 29) * 2) % 2] * sigma / H
      prims.push({
        kind: Math.abs(kap) * H < 0.06 ? 'wedge' : 'sweep',
        base: [a.x, a.y], dir: [dx, dy], L, w0, kappa: kap,
        taper: 1.35, rank: pick.rank, cls: a.cls,
      })
    } else {
      let L = barbs * H * ratio
      L = Math.min(Math.max(L, 0.05 * H), 0.30 * H)
      prims.push({
        kind: a.cls === 'edge' ? 'bracket' : 'wedge',
        base: [a.x, a.y], dir: [dx, dy], L, w0: w0 * (1 + 1 / contrast),
        rank: pick.rank, cls: a.cls,
      })
    }
  })

  return { prims, motif, chosenCount: chosen.length, anchorCount: anchors.length }
}

export function toPolygons(prims) {
  return prims.map(toPolygon).filter((p) => p && p.length >= 3)
}
