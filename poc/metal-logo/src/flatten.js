/* Flattening a font's drawing commands to polygons. Its own module because the
   engine — typeset, envelope, anchors, compose — must not need a browser: this
   is the one thing it borrowed from vector.js, which reads import.meta.env at
   load and pulls in a canvas. Split out, the whole composition runs in Node and
   can be tested there. */

export function flattenCommands(commands) {
  const polys = []
  let poly = null
  let sx = 0, sy = 0, cx = 0, cy = 0
  for (const c of commands) {
    if (c.type === 'M') {
      if (poly && poly.length > 2) polys.push(poly)
      poly = [[c.x, c.y]]
      sx = cx = c.x
      sy = cy = c.y
    } else if (c.type === 'L') {
      poly.push([c.x, c.y])
      cx = c.x
      cy = c.y
    } else if (c.type === 'Q') {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8
        const u = 1 - t
        poly.push([
          u * u * cx + 2 * u * t * c.x1 + t * t * c.x,
          u * u * cy + 2 * u * t * c.y1 + t * t * c.y,
        ])
      }
      cx = c.x
      cy = c.y
    } else if (c.type === 'C') {
      for (let i = 1; i <= 12; i++) {
        const t = i / 12
        const u = 1 - t
        poly.push([
          u * u * u * cx + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * cy + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ])
      }
      cx = c.x
      cy = c.y
    } else if (c.type === 'Z') {
      if (poly && poly.length > 2) polys.push(poly)
      poly = null
      cx = sx
      cy = sy
    }
  }
  if (poly && poly.length > 2) polys.push(poly)
  return polys
}
