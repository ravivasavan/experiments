// Art — the Clipper half of the engine, kept behind one dynamic import.
//
// Nothing on the boot path needs it. What the visitor looks at is inked on the
// GPU by raster.js, so the 99KB of clipper-lib is only reached by Export and
// the #svgdump probe — both of which can afford it, because neither is on the
// path between moving a dial and seeing the result.

import { artGeometry } from './ink.js'

export { branchOutline, inkVector, artGeometry } from './ink.js'

export function makeArt(rawPolys) {
  const art = artGeometry(rawPolys)
  return art && { ...art, path2d: new Path2D(art.pathString) }
}
