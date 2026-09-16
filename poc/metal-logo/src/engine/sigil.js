// The sigil — exactly zero or one, always on the axis.
//
// Four of Decibel's top five black metal logos carry one and the old engine had
// none, which is a large part of why its output read as a texture rather than a
// device. It is hand-authored polygon coordinates, because this is the one part
// of the mark that should not be generated.

function scalePoly(poly, s, cx, cy) {
  return poly.map(([x, y]) => [cx + x * s, cy + y * s])
}

const RECIPES = {
  'inverted cross': () => [
    [[-0.09, -1], [0.09, -1], [0.09, 1], [-0.09, 1]],
    [[-0.42, 0.18], [0.42, 0.18], [0.42, 0.36], [-0.42, 0.36]],
  ],
  pentagram: () => {
    const pts = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 0.42 : 1
      pts.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    return [pts]
  },
  horns: () => {
    const arc = (dir) => {
      const out = []
      for (let i = 0; i <= 14; i++) {
        const t = i / 14
        const a = Math.PI * (0.15 + t * 0.7)
        out.push([dir * Math.cos(a) * 0.9, -Math.sin(a) * 0.8 + 0.3])
      }
      for (let i = 14; i >= 0; i--) {
        const t = i / 14
        const a = Math.PI * (0.15 + t * 0.7)
        const w = 0.16 * (1 - t)
        out.push([dir * (Math.cos(a) * 0.9 - dir * w), -Math.sin(a) * 0.8 + 0.3 + w])
      }
      return out
    }
    return [arc(1), arc(-1)]
  },
}

export function sigilPolys(kind, env, set) {
  if (!kind || kind === 'none') return []
  const make = RECIPES[kind]
  if (!make) return []
  // above the mark, on the axis, scaled to the crown it has to sit in
  const s = env.H * 0.26
  const cx = env.A
  const cy = set.bbox.minY - env.H * 0.30
  return make().map((poly) => scalePoly(poly, s, cx, cy))
}
