// Engine probe. Runs the whole composition in Node and writes an SVG, so the
// ornament can be looked at and counted instead of guessed at.
//   node probe.mjs [out.svg] [key=value ...]
import fs from 'node:fs'
import opentype from 'opentype.js'
import { typeset, fitToEnvelope, bboxOf } from './src/engine/typeset.js'
import { makeEnvelope } from './src/engine/envelope.js'
import { findAnchors } from './src/engine/anchors.js'
import { compose, toPolygons } from './src/engine/compose.js'
import { sigilPolys } from './src/engine/sigil.js'
import { orient } from './src/engine/primitives.js'

const args = Object.fromEntries(process.argv.slice(3).map(s => {
  const [k, v] = s.split('='); return [k, isNaN(+v) ? v : +v]
}))
const out = process.argv[2] || 'probe.svg'

const P = {
  text: 'RAVENMOOR', size: 260, seed: 12345,
  outerBias: 0.25, tracking: -0.02, arc: 0.12, dislocation: 0.25, prune: 1.6,
  shape: 'wing', aspect: 3.5, crown: 0.55, sag: 0.3,
  ornaments: 12, majors: 4, reach: 1.0, barbs: 0.18, angle: 0.35, curvature: 0.25, contrast: 8,
  symmetry: 0.8, crownRoot: 0.6,
  ...args,
}

function makeRng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

const font = opentype.parse(fs.readFileSync('./public/fonts/MetalMania-Regular.ttf').buffer)
const rand = makeRng(P.seed ^ 0x51ab)
const set = typeset(font, P.text, P.size, P, rand)
const env = makeEnvelope({ shape: P.shape, aspect: P.aspect, crown: P.crown, sag: P.sag }, { A: 0, H: P.size })
const fitted = fitToEnvelope(set, env)
const anchors = findAnchors(fitted, P)
const { prims } = compose(anchors, env, P, P.seed, fitted.polys)
const wind = anchors.length ? anchors[0].outerSign : 1
const orn = [...toPolygons(prims), ...sigilPolys(P.sigil || 'inverted cross', env, fitted).map(p => orient(p, wind))]

const byCls = {}
for (const a of anchors) byCls[a.cls] = (byCls[a.cls] || 0) + 1
const kinds = {}
for (const p of prims) kinds[p.kind] = (kinds[p.kind] || 0) + 1
console.log('anchors', anchors.length, JSON.stringify(byCls))
console.log('prims  ', prims.length, JSON.stringify(kinds))
console.log('lengths', prims.map(p => Math.round(p.L)).join(' '))
console.log('w0     ', prims.map(p => Math.round(p.w0)).join(' '))
console.log('cls    ', prims.map(p => p.cls).join(' '))
console.log('role   ', prims.map(p => p.role).join(' '))

// How much of each ornament's ROOT actually lands inside the letterform. This
// is the number that says whether a spike is welded on or floating.
function inside(polys, x, y) {
  let c = false
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
  }
  return c
}
const detached = prims.filter(p => {
  // sample the spine a little way along; if none of it is in the letterform
  // the ornament is a free-floating splinter
  const [bx, by] = p.base
  const dl = Math.hypot(p.dir[0], p.dir[1]) || 1
  // how much of the root actually stands in ink, not whether any single point does
  const s = p.sink || 0
  let hit = 0
  const N = 24
  for (let i = 0; i <= N; i++) {
    const t = -s + (s * i) / N
    if (inside(fitted.polys, bx + (p.dir[0] / dl) * t, by + (p.dir[1] / dl) * t)) hit++
  }
  return hit / (N + 1) < 0.25
})
console.log('sink   ', prims.map(p => Math.round(p.sink)).join(' '))
console.log('DETACHED', detached.length, '/', prims.length, detached.map(p => `${p.role}/${p.kind}/L${Math.round(p.L)}/sink${Math.round(p.sink)}`).join(' '))
const u = a => (((a.x ?? a.base[0]) - env.A) / env.halfW).toFixed(2)
console.log('prim u ', prims.map(u).join(' '))
const far = anchors.filter(a => Math.abs((a.x - env.A) / env.halfW) > 0.75)
console.log('anchors beyond u 0.75:', far.map(a => `${u(a)}/${a.cls}/ny${a.ny.toFixed(2)}`).join(' '))
console.log('root anchors:', anchors.filter(a => a.ny > 0.12).length, 'crown-facing:', anchors.filter(a => a.ny < -0.12).length)

const all = [...fitted.polys.map(p => ({ p, c: '#15202b' })), ...orn.map(p => ({ p, c: '#c0392b' }))]
const b = bboxOf([...fitted.polys, ...orn])
const pad = 40
const d = ({ p }) => 'M' + p.map(q => q.map(Math.round).join(' ')).join('L') + 'Z'
fs.writeFileSync(out,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${Math.round(b.minX - pad)} ${Math.round(b.minY - pad)} ${Math.round(b.w + pad * 2)} ${Math.round(b.h + pad * 2)}">` +
  `<rect x="${Math.round(b.minX - pad)}" y="${Math.round(b.minY - pad)}" width="${Math.round(b.w + pad * 2)}" height="${Math.round(b.h + pad * 2)}" fill="#faf5f2"/>` +
  all.map(o => `<path d="${d(o)}" fill="${o.c}"/>`).join('') + '</svg>')
console.log('wrote', out)

// how long a rebuild costs — this is what a dial drag pays
{
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < 20; i++) {
    const s2 = typeset(font, P.text, P.size, P, makeRng(P.seed ^ 0x51ab))
    const f2 = fitToEnvelope(s2, env)
    compose(findAnchors(f2, P), env, P, P.seed + i, f2.polys)
  }
  console.log('rebuild', Number(process.hrtime.bigint() - t0) / 20e6, 'ms')
}
