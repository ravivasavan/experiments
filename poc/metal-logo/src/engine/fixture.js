// The half-day probe.
//
// Fourteen ornaments, placed by hand, to test one hypothesis before any of the
// machinery that would place them automatically gets built: that
//
//     an envelope + a countable number of ornaments + bimodal lengths
//     + bilateral symmetry + zero recursion  =  a logo
//
// and that the old engine's problem was never the renderer or the letterform,
// but that it GREW ornament uniformly from the whole boundary.
//
// If this does not read as a logo, none of the medial-axis work was going to
// help and we have spent an afternoon instead of three weeks. If it does, this
// becomes the golden reference the automatic ranker is measured against.
//
// Positions are proportional to the letterform's own bounding box, so the probe
// survives a change of word, font or size without being re-authored by eye.

import { toPolygon, mirrorAbout } from './primitives.js'

function bbox(polys) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
  for (const poly of polys) {
    for (const [x, y] of poly) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/* Half the ornament. The other half is this reflected — which is the point:
   bilateral symmetry about the word's centre is the most consistent trait of
   the whole form, and mirroring is how you get it exactly rather than
   approximately. */
function leftHalf(b) {
  const { minX, minY, maxX, maxY, w, h } = b
  const x = (f) => minX + f * w
  const y = (f) => minY + f * h

  return [
    // --- the four majors: long blades off the outer extremities, and only
    //     the extremities. This is the shape of the logo.
    { kind: 'sweep', base: [x(0.04), y(0.30)], dir: [-0.40, -0.92], L: h * 1.30, w0: h * 0.115, kappa: 0.0022, rank: 0 },
    { kind: 'sweep', base: [x(0.02), y(0.72)], dir: [-0.46, 0.89], L: h * 1.10, w0: h * 0.100, kappa: -0.0024, rank: 0 },

    // --- two seconds, shorter, further in, angled harder
    { kind: 'sweep', base: [x(0.20), y(0.14)], dir: [-0.20, -0.98], L: h * 0.70, w0: h * 0.075, kappa: 0.0016, rank: 1 },
    { kind: 'sweep', base: [x(0.15), y(0.88)], dir: [-0.14, 0.99], L: h * 0.58, w0: h * 0.068, kappa: -0.0018, rank: 1 },

    // --- minors: straight barbs, short, along the top and bottom. They read as
    //     serifs on the letters rather than as growth, because they stop.
    { kind: 'wedge', base: [x(0.33), y(0.10)], dir: [0.10, -1], L: h * 0.26, w0: h * 0.052, rank: 2 },
    { kind: 'wedge', base: [x(0.45), y(0.09)], dir: [-0.06, -1], L: h * 0.19, w0: h * 0.044, rank: 2 },
    { kind: 'wedge', base: [x(0.28), y(0.93)], dir: [0.06, 1], L: h * 0.22, w0: h * 0.048, rank: 2 },
    { kind: 'bracket', base: [x(0.40), y(0.95)], dir: [-0.30, 1], L: h * 0.15, w0: h * 0.040, rank: 3 },
  ]
}

export function fixturePolys(glyphPolys) {
  const b = bbox(glyphPolys)
  if (!isFinite(b.w) || b.w <= 0) return []
  const cx = (b.minX + b.maxX) / 2
  const half = leftHalf(b)
  const all = [...half, ...half.map((p) => mirrorAbout(cx, p))]
  return all.map(toPolygon)
}

export const FIXTURE_COUNT = 16
