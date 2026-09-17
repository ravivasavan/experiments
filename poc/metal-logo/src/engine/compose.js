// Choosing the ornament: which anchors, what role, how long, and mirrored how.
//
// The first version of this file ranked every anchor by a score and spent the
// budget on the best N. That is how you get a pile: score rewarded being far
// from the axis, so every blade clustered at the two ends of the word, three on
// one side and two on the other, none of them answering each other. The minors
// came out as squat triangles half on and half off a letter — chips flying off,
// not serifs.
//
// A letterer does not rank. They have a CAST, and they fill it:
//
//     a pair of long blades off the ends of the word, sweeping up and out
//     a pair falling from the outer feet
//     a shorter pair off the crown, further in
//     a scatter of short barbs along the top and bottom
//
// So that is what this file is now. `castOf` writes the cast, every role
// arrives as a ± PAIR sharing one motif, and each role goes looking for the
// anchor nearest the place it wants to be. Symmetry is by construction — the
// thing the hand-placed fixture proved — and `symmetry` is how far a pair is
// allowed to drift apart, not a search tolerance that mostly failed to match.
//
// Three things carried over, because they were right:
//   1. A MOTIF SET drawn once per logo. Every ornament takes its angle and
//      curvature from the same small set, so the same hook recurs.
//   2. A BUDGET. At most `ornaments` primitives, and they are countable.
//   3. Bimodal lengths. A major or a barb, and nothing in between.

import { toPolygon } from './primitives.js'
import { indexRings, depthAlong } from './anchors.js'

/* The mixes have to be Math.imul and the shifts unsigned. Written with plain
   `*` the second multiply leaves 32-bit range and finishes in floating point,
   and the bits that come back are not the bits the avalanche needs: for the
   small integers this file actually feeds it — a role index, a pair number —
   every draw landed in the bottom half of the range. Which is why no barb was
   ever a long one, no ornament ever fell to the root side, and the motif
   angles were always shallow. It looked like a tuning problem for a week. */
function hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

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

/* The cast, in priority order. `u` is how far out along the word the role wants
   to sit, 0 at the axis and 1 at the end. `bias` is the direction the role
   leaves in before the anchor's own normal gets a say — it is what makes a wing
   a wing rather than a spike that happens to be at the end. */
function castOf(opts, seed) {
  const majors = clamp(Math.round(opts.majors ?? 4), 0, 8)
  const total = clamp(Math.round(opts.ornaments ?? 14), 2, 28)
  const crownRoot = opts.crownRoot ?? 0.6
  const roles = []

  /* Three postures, one per logo. With a single cast every seed produced the
     same four-cornered X — correct, symmetric, and the same drawing every
     time. The posture is what the word is DOING, and it is the coarsest
     difference between two of these logos. */
  const POSTURES = [
    // the wing: up and out at the ends, down and out beneath them
    [
      { u: 0.98, want: 'crown', bias: [0.42, -0.91], len: 1.15 },
      { u: 0.92, want: 'root', bias: [0.46, 0.89], len: 0.5 + crownRoot * 0.45 },
      { u: 0.56, want: 'crown', bias: [0.18, -0.98], len: 0.86 },
      { u: 0.3, want: 'crown', bias: [-0.1, -0.99], len: 0.68 },
    ],
    // the crown: everything reaches up and the word stands on its feet
    [
      { u: 0.98, want: 'crown', bias: [0.3, -0.95], len: 1.3 },
      { u: 0.64, want: 'crown', bias: [0.1, -0.99], len: 0.98 },
      { u: 0.95, want: 'root', bias: [0.58, 0.81], len: 0.42 },
      { u: 0.36, want: 'crown', bias: [-0.06, -1], len: 0.72 },
    ],
    // the fall: it hangs. Long descenders off the feet and nothing above.
    [
      { u: 0.95, want: 'root', bias: [0.38, 0.92], len: 1.25 },
      { u: 0.6, want: 'root', bias: [0.14, 0.99], len: 0.9 },
      { u: 0.98, want: 'crown', bias: [0.52, -0.85], len: 0.72 },
      { u: 0.4, want: 'crown', bias: [0.04, -1], len: 0.58 },
    ],
  ]
  const majorRoles = POSTURES[Math.floor(hash(seed, 5) * POSTURES.length) % POSTURES.length]

  for (let i = 0; i < majors; i++) {
    const pair = Math.floor(i / 2)
    const r = majorRoles[pair % majorRoles.length]
    roles.push({
      ...r,
      u: clamp(r.u + (hash(seed, 61 + pair) - 0.5) * 0.12, 0.2, 1),
      major: true,
      side: i % 2 ? -1 : 1,
      pair,
    })
  }

  // The barbs. Spread along the word rather than piled at the ends, because a
  // gap in the middle of the top edge is what made the old output read as two
  // clumps with a word between them.
  const minors = Math.max(0, total - majors)
  for (let i = 0; i < minors; i++) {
    const j = Math.floor(i / 2)
    const n = Math.ceil(minors / 2)
    // Evenly spread, then knocked off true. Dead-even spacing along the top
    // reads as a comb, which is the one thing worse than a clump.
    const even = n <= 1 ? 0.6 : 0.2 + (0.74 * j) / (n - 1)
    const u = clamp(even + (hash(j, 41) - 0.5) * 0.13, 0.12, 0.99)
    const down = hash(i, 97) > crownRoot
    roles.push({
      u,
      want: down ? 'root' : 'crown',
      bias: down ? [0.12, 0.99] : [0.12, -0.99],
      // every barb its own length, or eight identical spikes along the top
      len: 0.62 + hash(i, 137) * 0.68,
      major: false,
      side: i % 2 ? -1 : 1,
      pair: 100 + j,
    })
  }
  return roles
}

/* The anchor nearest to where a role wants to be. A hard filter on which way it
   faces — a crown blade may not start on an anchor whose normal points down,
   however conveniently placed it is — then nearest by position. */
function fill(role, pool, env, minSep, want) {
  let best = null
  let bestCost = Infinity
  // A major is defined by being at the END of the word, so where it sits
  // outweighs how nicely the corner is classified. Weighted evenly, the right
  // wing rooted a third of the way in on a tidier anchor while the left wing
  // took the extremity — which is the asymmetry that was showing.
  const wu = role.major ? 2.4 : 1
  for (const a of pool) {
    if (a.taken) continue
    const du = (a.x - env.A) / env.halfW
    if (Math.sign(du) !== role.side && Math.abs(du) > 0.06) continue
    if (role.want === 'crown' && a.ny > -0.12) continue
    if (role.want === 'root' && a.ny < 0.12) continue
    if (a.near != null && a.near < minSep) continue
    const cost =
      wu * Math.abs(Math.abs(du) - want) +
      (a.cls === role.want ? 0 : role.major ? 0.16 : 0.3) +
      (a.cls === 'edge' ? 0.4 : 0) +
      0.35 * (1 - Math.min(1, a.turn / 1.6))
    if (cost < bestCost) { bestCost = cost; best = a }
  }
  return best
}

export function compose(anchors, env, opts, seed, ink) {
  const reach = opts.reach ?? 1.4
  const barbs = opts.barbs ?? 0.18
  const contrast = opts.contrast ?? 8
  const symmetry = opts.symmetry ?? 0.8
  const motif = makeMotif(seed, opts)
  const H = env.H
  const pool = anchors.map((a) => ({ ...a, taken: false, near: null }))
  /* The anchor already knows how deep the ink is along its OWN normal. A major
     does not leave along its own normal — the role turns it — so the depth is
     measured again along the direction the blade actually takes. Sunk along one
     vector by a depth measured along another is how a root ends up in the gap
     beside the stroke rather than in it. */
  const rings = indexRings(ink)
  /* Seat the ornament: how deep to start, and — if there is nothing behind the
     heading the role chose — which way to leave instead. An ornament with no
     stroke behind it is not a placement problem to be sunk harder, it is a
     heading pointing along the edge of a letter rather than out of it, so the
     heading rotates back toward the corner's own normal until it finds ink. */
  const seat = (a, dx, dy, w0) => {
    const tries = [[dx, dy]]
    if (rings.length) for (const m of [0.6, 0.3, 0]) {
      tries.push(norm(dx * m + a.nx * (1 - m), dy * m + a.ny * (1 - m)))
    }
    for (const [ex, ey] of tries) {
      const d = rings.length ? depthAlong(rings, a.x, a.y, ex, ey, H) : null
      if (d != null) return { dx: ex, dy: ey, sink: clamp(d + w0 * 0.7, w0, H * 0.2) }
    }
    return { dx, dy, sink: clamp((a.depth ?? 0) + w0 * 0.7, w0, H * 0.2) }
  }

  // No two ornaments closer together than this, or a cluster of barbs reads as
  // a single ragged blob however well each one is placed.
  const minSep = H * 0.16

  const prims = []
  // A pair shares one length. Computing each side's independently is how the
  // last version ended up with a full blade on the right and a stub on the
  // left: the raycast answers a slightly different question on each side.
  const pairL = new Map()
  // ...and one place. The second of a pair aims at the mirror of where the
  // first actually landed, not at the nominal target — so the two wings answer
  // each other even when the word is not symmetric about its own middle.
  const pairU = new Map()
  for (const role of castOf(opts, seed)) {
    const want = pairU.get(role.pair) ?? role.u
    const a = fill(role, pool, env, minSep, want)
    if (!a) continue
    if (!pairU.has(role.pair)) pairU.set(role.pair, Math.abs((a.x - env.A) / env.halfW))
    a.taken = true
    for (const b of pool) {
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (b.near == null || d < b.near) b.near = d
    }

    const sigma = role.side
    // The role says where it wants to go; the anchor says where the letter is
    // actually pointing. Blended, a blade leaves along the stroke it grows from
    // AND arrives where the silhouette needs it.
    const [bx0, by0] = norm(role.bias[0] * sigma, role.bias[1])
    // The role leads. Weighted evenly the corner's own normal won, and at the
    // corner of a word that normal is a diagonal — so every wing came out
    // flat, shot sideways and doubled the width of the mark.
    const wn = role.major ? 0.3 : 0.45
    let [dx, dy] = norm(a.nx * wn + bx0 * (1 - wn), a.ny * wn + by0 * (1 - wn))

    // one turn off that heading, from the motif, away from the axis
    const k = Math.floor(hash(a.id, seed + 7) * 3) % 3
    const drift = role.pair >= 100 ? 1 : 1 - symmetry
    const ang = motif.angles[k] * sigma + (hash(a.id, seed + 3) - 0.5) * 0.7 * drift
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    ;[dx, dy] = [dx * ca - dy * sa, dx * sa + dy * ca]

    const ratio = motif.ratios[Math.floor(hash(role.pair, seed + 17) * 2) % 2]

    if (role.major) {
      // A blade reaches the silhouette. That is what the envelope is FOR — an
      // arbitrary multiple of the cap height is how the old engine got blades
      // that left the page.
      /* The silhouette SHAPES the blade; it does not set its length. Driven by
         the raycast alone, a blade off a letter that already stands near the
         top of the envelope had almost no distance left to run and came out a
         stub — which is what happened to every crown major. A cap height is the
         floor. */
      let L = pairL.get(role.pair)
      if (L == null) {
        const hit = env.raycast(a.x, a.y, dx, dy, H * 3)
        L = clamp(Math.max(hit, H) * reach * role.len, 0.45 * H, 1.75 * H)
        pairL.set(role.pair, L)
      }
      L *= 1 + (hash(role.pair * 7 + (sigma > 0 ? 1 : 2), seed + 23) - 0.5) * 0.8 * (1 - symmetry)
      // Slim, and in proportion to its own length — tied to the anchor's local
      // segment instead, a blade off a long straight edge came out with a root
      // wider than the stem it was supposed to be growing from.
      const w0 = clamp(L / 9, H * 0.042, H * 0.1)
      const kap = motif.curves[Math.floor(hash(role.pair, seed + 29) * 2) % 2] * sigma / H
      const st = seat(a, dx, dy, w0)
      prims.push({
        kind: Math.abs(kap) * H < 0.06 ? 'wedge' : 'sweep',
        base: [a.x, a.y], dir: [st.dx, st.dy], L, w0, kappa: kap,
        taper: 1.35, sink: st.sink, wind: a.outerSign,
        rank: role.pair, cls: a.cls, role: role.want,
      })
    } else {
      const L = clamp(barbs * H * ratio * role.len, 0.05 * H, 0.34 * H)
      // Lean, not squat. The barbs used to come out as wide as they were long,
      // which is a chip flying off a letter rather than a serif on one.
      const w0 = clamp(L / (1.6 + contrast * 0.35), H * 0.012, H * 0.05)
      const st = seat(a, dx, dy, w0)
      prims.push({
        kind: a.cls === 'flank' ? 'bracket' : 'wedge',
        base: [a.x, a.y], dir: [st.dx, st.dy], L, w0,
        sink: st.sink, wind: a.outerSign,
        rank: role.pair, cls: a.cls, role: role.want,
      })
    }
  }

  return { prims, motif, chosenCount: prims.length, anchorCount: anchors.length }
}

export function toPolygons(prims) {
  return prims.map(toPolygon).filter((p) => p && p.length >= 3)
}
