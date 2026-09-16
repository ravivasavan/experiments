// Tendril outlines — the half of the ink engine with no Clipper in it.
//
// It lives apart from ink.js so the interactive path can turn branches into
// polygons without pulling clipper-lib (99KB, and 1.7 seconds of work) onto
// the page. ink.js re-exports it, so the export path is unchanged.

// growth polyline {x,y,w} → Chaikin-smoothed → offset both sides by w/2
// → closed polygon with a round start cap and a pointed tip

function chaikinOpen(pts, iters) {
  let cur = pts
  for (let k = 0; k < iters; k++) {
    if (cur.length < 3) return cur
    const out = [cur[0]]
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i]
      const b = cur[i + 1]
      out.push({
        x: 0.75 * a.x + 0.25 * b.x,
        y: 0.75 * a.y + 0.25 * b.y,
        w: 0.75 * a.w + 0.25 * b.w,
      })
      out.push({
        x: 0.25 * a.x + 0.75 * b.x,
        y: 0.25 * a.y + 0.75 * b.y,
        w: 0.25 * a.w + 0.75 * b.w,
      })
    }
    out.push(cur[cur.length - 1])
    cur = out
  }
  return cur
}

export function branchOutline(branch) {
  const pts = chaikinOpen(branch.pts, 2)
  if (pts.length < 2) return null
  const left = []
  const right = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const hw = Math.max(0.35, pts[i].w / 2)
    left.push([pts[i].x - ty * hw, pts[i].y + tx * hw])
    right.push([pts[i].x + ty * hw, pts[i].y - tx * hw])
  }
  // round start cap: arc from right[0] to left[0] behind the first point
  const p0 = pts[0]
  const hw0 = Math.max(0.15, p0.w / 2)
  let bx = pts[0].x - (pts[1].x - pts[0].x)
  let by = pts[0].y - (pts[1].y - pts[0].y)
  const bl = Math.hypot(bx - p0.x, by - p0.y) || 1
  const ux = (bx - p0.x) / bl
  const uy = (by - p0.y) / bl
  const cap = []
  for (let k = 1; k <= 5; k++) {
    const a = (k / 6 - 0.5) * Math.PI
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    // rotate the backward unit vector to sweep the semicircle
    cap.push([p0.x + (ux * ca - uy * sa) * hw0, p0.y + (ux * sa + uy * ca) * hw0])
  }
  const tip = pts[pts.length - 1]
  return [...right.slice().reverse(), ...cap, ...left, [tip.x, tip.y]]
}
