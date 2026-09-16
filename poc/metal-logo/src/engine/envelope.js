// The envelope — the silhouette the whole mark is designed INTO.
//
// This is the inversion the redo turns on. The old engine had no envelope: it
// grew ornament outward from the letters and then auto-fitted whatever came
// out, so turning growth up made the letters SMALLER and the result had no
// shape of its own. Here the silhouette is chosen first, the letters are
// typeset into it, and an ornament's length is SOLVED against its boundary.
//
// It is a region, not a clip. Nothing is cut off at the edge; things are grown
// to it, which is why the outline reads as designed rather than trimmed.
//
// Space: y is DOWN. The baseline is y = 0, the cap line is y = -H.

const sdBox = (px, py, bx, by) => {
  const dx = Math.abs(px) - bx
  const dy = Math.abs(py) - by
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0)
}
const sdCircle = (px, py, r) => Math.hypot(px, py) - r

function sdRhombus(px, py, bx, by) {
  const qx = Math.abs(px)
  const qy = Math.abs(py)
  const ndot = (ax, ay, cx, cy) => ax * cx - ay * cy
  const h = Math.min(1, Math.max(-1, ndot(bx - 2 * qx, by - 2 * qy, bx, by) / (bx * bx + by * by)))
  const d = Math.hypot(qx - 0.5 * bx * (1 - h), qy - 0.5 * by * (1 + h))
  return d * Math.sign(qx * by + qy * bx - bx * by)
}

const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/* Built once per composition. `A` is the word's centre x and the ONLY symmetry
   axis in the design; the field is evaluated in the mirrored domain, so the
   silhouette is bilaterally exact rather than approximately so. */
export function makeEnvelope(opts, geom) {
  const { shape = 'wing', aspect = 3.5, crown = 0.5, sag = 0.3 } = opts
  const { A, H } = geom
  const halfW = (aspect * H) / 2
  const baseline = 0
  const top = -H
  const mid = -H / 2

  let field
  if (shape === 'arch') {
    field = (x, y) =>
      smin(
        sdBox(x, y - (baseline - 0.5 * H), halfW, 0.5 * H + sag * 0.35 * H),
        sdCircle(x, y - (top - crown * 0.5 * H), crown * 0.9 * H + 0.2 * H),
        0.25 * H,
      )
  } else if (shape === 'lozenge') {
    field = (x, y) => sdRhombus(x, y - mid, halfW, (1 + crown) * H)
  } else if (shape === 'block') {
    field = (x, y) => sdBox(x, y - mid, halfW, 0.5 * H * (1 + 0.2 * crown) + sag * 0.2 * H)
  } else {
    // wing — the extremities are both the highest and the longest points, which
    // is the shape most of these logos actually have.
    const a = Math.atan(crown * 0.9)
    const rot = (x, y, s) => {
      const c = Math.cos(s * a)
      const sn = Math.sin(s * a)
      return [x * c - y * sn, x * sn + y * c]
    }
    field = (x, y) => {
      const yy = y - mid
      const [lx, ly] = rot(x, yy, 1)
      const [rx, ry] = rot(x, yy, -1)
      const h = 0.45 * H * (1 + sag * 0.5)
      return Math.min(sdBox(lx, ly, halfW, h), sdBox(rx, ry, halfW, h))
    }
  }

  // The mirrored domain: |x - A|. Symmetry for free, and exact.
  const sd = (x, y) => field(Math.abs(x - A) * Math.sign(1), y)
  const sdMirrored = (x, y) => field(Math.abs(x - A), y)

  return {
    sd: sdMirrored,
    A, H, halfW, baseline, top, mid, shape,
    /* Sphere marching out to ∂E. This is what makes a major ornament reach the
       silhouette instead of being some arbitrary multiple of the cap height. */
    raycast(px, py, dx, dy, max) {
      const limit = max || halfW * 2
      let t = 0
      for (let i = 0; i < 24; i++) {
        const s = -sdMirrored(px + t * dx, py + t * dy)
        if (s < 0.5) break
        t += Math.max(s, 0.5)
        if (t > limit) break
      }
      return Math.min(t, limit)
    },
  }
}

/* A faint outline of ∂E, for designing against. Marching squares on a coarse
   grid — it is a guide, not geometry, so it is drawn and never inked. */
export function envelopeGuide(env, steps = 90) {
  const { A, halfW, H } = env
  const x0 = A - halfW * 1.5
  const x1 = A + halfW * 1.5
  const y0 = -H * 2.2
  const y1 = H * 1.2
  const segs = []
  const dx = (x1 - x0) / steps
  const dy = (y1 - y0) / steps
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const x = x0 + i * dx
      const y = y0 + j * dy
      const a = env.sd(x, y) < 0
      if (a !== (env.sd(x + dx, y) < 0)) segs.push([[x + dx / 2, y], [x + dx / 2, y + dy]])
      if (a !== (env.sd(x, y + dy) < 0)) segs.push([[x, y + dy / 2], [x + dx, y + dy / 2]])
    }
  }
  return segs
}
