// A primitive is a polygon. Four kinds, and not one of them recurses.
//
// That is the whole thesis. The old engine GREW ornament: it seeded points all
// over the glyph's boundary and let each one branch, split and sprout until it
// ran out of depth. Uniform seeds plus recursion is fur, and fur around letters
// is a root ball — which is exactly what it looked like.
//
// A black metal logo does not grow its spikes. A letterer PLACES them: a few
// long blades off the outer extremities, a handful of short barbs along the
// way, mirrored about the vertical axis. Placed, ranked, and countable.

const TAU = Math.PI * 2

/* A blade. The spine starts at `base` heading `dir`, turns at a constant rate
   (`kappa` radians per unit length — the scimitar curve every one of these
   logos uses), and the width tapers to nothing at the tip. */
function sweep({ base, dir, L, w0, kappa = 0, taper = 1.6, samples = 22 }) {
  const [bx, by] = base
  let [dx, dy] = dir
  const dl = Math.hypot(dx, dy) || 1
  dx /= dl; dy /= dl
  let theta = Math.atan2(dy, dx)

  const spine = []
  const widths = []
  let x = bx
  let y = by
  const step = L / samples
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    spine.push([x, y])
    widths.push((w0 / 2) * Math.pow(1 - t, taper))
    x += Math.cos(theta) * step
    y += Math.sin(theta) * step
    theta += kappa * step
  }

  const left = []
  const right = []
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)]
    const b = spine[Math.min(spine.length - 1, i + 1)]
    let tx = b[0] - a[0]
    let ty = b[1] - a[1]
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl; ty /= tl
    const w = widths[i]
    left.push([spine[i][0] - ty * w, spine[i][1] + tx * w])
    right.push([spine[i][0] + ty * w, spine[i][1] - tx * w])
  }
  // A real point at the tip, not a rounded cap — the cap is what made the old
  // tendrils read as roots rather than blades.
  return [...right, ...left.reverse()]
}

/* A straight barb: the degenerate sweep, kept separate because most ornament in
   these logos is dead straight and a triangle is cheaper and sharper. */
function wedge({ base, dir, L, w0 }) {
  const [bx, by] = base
  let [dx, dy] = dir
  const dl = Math.hypot(dx, dy) || 1
  dx /= dl; dy /= dl
  const nx = -dy
  const ny = dx
  const h = w0 / 2
  return [
    [bx + nx * h, by + ny * h],
    [bx + dx * L, by + dy * L],
    [bx - nx * h, by - ny * h],
  ]
}

/* A bracket: the short spur that sits at a right angle to a stem, the thing
   that reads as a serif rather than a spike. */
function bracket({ base, dir, L, w0 }) {
  return wedge({ base, dir, L, w0: w0 * 1.35 })
}

/* Sink the root into the letter before drawing it.

   An anchor is a convex EXTREMITY — the sharpest point of the outline, with a
   normal pointing away from the ink. So a primitive whose base sits exactly on
   it has almost nothing behind it: the base chord is perpendicular to the way
   out, and at an extremity everything on that chord is already outside the
   letter. That is why the first pass came out as splinters hovering a hair off
   the strokes they were supposed to be growing from.

   Push the base back down its own direction by a base-width or so and lengthen
   to match, and the root is buried in solid ink. The union welds it. */
function sunk(p) {
  const s = p.sink || 0
  if (!s) return p
  const dl = Math.hypot(p.dir[0], p.dir[1]) || 1
  return {
    ...p,
    base: [p.base[0] - (p.dir[0] / dl) * s, p.base[1] - (p.dir[1] / dl) * s],
    L: p.L + s,
  }
}

/* Wind it the way the letters are wound.

   The whole composition is filled as ONE path with the nonzero rule, which is
   what lets a counter punch a hole in an O. An ornament wound the other way
   from the letter it crosses cancels against it and punches a hole too — those
   were the white diamonds appearing in the strokes wherever a blade passed
   over one. Orientation is not cosmetic here; it is the difference between
   union and subtraction. */
export function orient(poly, wind) {
  if (!wind) return poly
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.sign(a) === Math.sign(wind) ? poly : poly.slice().reverse()
}

export function toPolygon(prim) {
  const p = sunk(prim)
  const poly = p.kind === 'sweep' ? sweep(p) : p.kind === 'bracket' ? bracket(p) : wedge(p)
  return orient(poly, prim.wind)
}

/* Mirror a primitive about a vertical axis. Bilateral symmetry about the
   word's centre is the single most consistent trait of the form, and it is
   free: place half the ornament, reflect it. */
export function mirrorAbout(cx, p) {
  return {
    ...p,
    base: [2 * cx - p.base[0], p.base[1]],
    dir: [-p.dir[0], p.dir[1]],
    kappa: -(p.kappa || 0),
  }
}

export { TAU }
