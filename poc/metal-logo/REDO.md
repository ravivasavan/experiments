# METAL — IMPLEMENTATION SPEC v4 ("SPINE")

**Project:** `/home/ravivasavan/Work/GitHub/Personal/play/poc/metal-logo`
**Ships to:** `/home/ravivasavan/Work/GitHub/Personal/play/20260824/metal/` (static Vite build, no server)
**Replaces:** the growth engine in `src/generator.js` + `src/outline.js`. Keeps the renderer.

---

## 0. THE ONE-PARAGRAPH VERSION

Today the engine takes a letterform, scans its raster boundary on an 18px grid, and grows recursive random-walk tendrils from every point it finds. Uniform seed density plus uniform lengths plus recursion equals fur; the composition then auto-fits, so turning growth up *shrinks the letters*. That is a root ball by construction.

The new engine inverts it. **An ornamental silhouette is chosen first; the letters are typeset into it; then at most 28 ornaments are spent, by rank, at licensed anchor points, with their lengths solved against the silhouette's boundary.** Anchors come from the *medial axis* of each glyph — a stroke skeleton — not from its boundary, because a mid-stem point is a degree-2 interior node with no curvature event and is therefore **not enumerable**, and the axis of an `O` is a closed loop with **zero** degree-1 nodes. The failure mode is excluded by the data structure rather than filtered downstream. Everything stays polygonal; the GPU ink pass and the Clipper SVG export both survive, with one change each.

---

## 1. WHAT SURVIVES, WHAT DIES

### Survives untouched
| File | Why |
|---|---|
| `src/art.js` | The lazy Clipper door. Unchanged. |
| `src/vector.js` — `loadFont`, `FONT_NAMES`, `flattenCommands`, `blit`, `svgString`, `exportSvg` | Font loading and the blit are correct. |
| `src/raster.js` | The GPU ink pass (SVG filter: `feGaussianBlur` → `feColorMatrix` alpha threshold), ~4ms. **One function changes** (§9). |
| `src/main.jsx` | DialKit inline mount. Unchanged. |

### Survives, moved
Create **`src/core.js`** holding what everything imports: `LOGICAL_W = 1400`, `LOGICAL_H = 800`, `makeRng` (mulberry32), `rdp`. Copy them out of `generator.js` verbatim. Every existing import of these from `./generator.js` repoints to `./core.js`.

Rename **`generator.js` → `src/svgtrace.js`** and gut it down to the uploaded-SVG path only: `traceLoops`, `chamfer`, `zhangSuen`, `walkDirection`, `stemTangent`, `extractLetterform`. These stay *because a traced bitmap has no font outlines* and the upload feature needs a skeleton from somewhere. Nothing in the text path touches this file.

### Deleted outright
- **All of `src/outline.js`.** `chaikinOpen` (smooths away every hard vertex), the 5-point round start cap, and the `Math.max(0.35, w/2)` half-width floor (tips can never reach zero). This file *is* failure mode F10.
- From `generator.js`: `growTendrils`, `grow`, `mirrorBranches`, `findTips`, `findCounters`, `makeEnvelope`, `vertMuls`, `buildTextMask`, `buildImageMask`.
- From `ink.js`: the three-offset open/close/net stack (`inkVector` lines ~71–73). Rewritten (§10).
- `vector.js` — `rasterizeForAnalysis` and `imageGeometry`'s Chaikin (keep `imageGeometry` itself for the upload path).

### New dependency
**`cdt2d`** (~8KB + `robust-*` helpers, ~20KB total) — constrained Delaunay triangulation. Chosen over `poly2tri` because poly2tri *throws* on duplicate/collinear/self-intersecting input and Metal Mania ships exactly that. `cdt2d(points, edges, {exterior: false})` returns only triangles inside the constraint loops, which is what we want, and it returns an empty array rather than throwing.

**No other new dependency.** Notably: no Clipper on the boot path (see §4.1 — the glyph simplification is done on a raster with code that already exists), and no WebGL, no SDF renderer, no shaders, no p5.

---

## 2. FILE LAYOUT

```
src/
  core.js              LOGICAL_W/H, makeRng, rdp, lerp, clamp        (new, extracted)
  svgtrace.js          uploaded-SVG raster path only                 (was generator.js)

  engine/
    metrics.js         capHeight/xHeight/baseline/unitsPerEm from OS/2
    rings.js           opentype → flattened rings (render set)
    analysis.js        per-glyph: smoothed rings → CDT → chordal axis → prune → anchors
    axis.js            CDT + chordal-axis transform + pruning        (the maths)
    anchors.js         stroke graph → classified anchor list
    envelope.js        4 closed-form 2D SDFs + axis A + band B + raycast
    typeset.js         per-glyph affines that fit the word into E
    motif.js           the per-logo motif set (anti-generated lever)
    compose.js         rank → budget → mirror → synthesise → guards   (the engine)
    primitives.js      primitive → polygon (wedge / sweep / barb / bracket)
    sigil.js           3 hand-authored polygon recipes
    guards.js          band veto, crossing veto, ink-budget raster
    serialize.js       genome ⇄ URL hash; golden-fixture JSON I/O
    fixture.js         hand-authored primitive lists (the day-1 probe, §14)
    acceptance.js      the 11 mechanical tests                        (dev only)

  raster.js            GPU ink — swell→(sigma,threshold) change only
  ink.js               Clipper: union + ONE round-join offset + grit
  art.js               unchanged
  vector.js            font load, blit, svg write; textGeometry trimmed
  App.jsx              rewritten: new DialKit schema + 3-tier render loop
```

`vite.config.js`: add `cdt2d|robust-` to a `geom` chunk. The `clipper` chunk stays lazy (`art.js` dynamic import).

---

## 3. COORDINATE SPACES (get these right or nothing else works)

Three spaces. Name them in code.

1. **GLYPH space.** One glyph, origin at its own left sidebearing on the baseline, y **up**, scaled so `capHeight = 1000`. All cached analysis lives here. Independent of font size, of the word, and of position.
2. **WORLD space.** The logical 1400×800 canvas, y **down** (matching opentype's `getPath` output and everything downstream). `capH` in world units = `size` from the dial.
3. **DEVICE space.** Handled entirely by `raster.js`/`blit`. Do not think about it.

The typesetter (§6) produces one affine per glyph, GLYPH → WORLD, including the y-flip. Anchors, axis samples and radii all transform through it (radii scale by the affine's uniform scale factor).

---

## 4. PIPELINE — TIER 1: ANALYSIS

**Cache key: `font|char`.** Not the word, not the size. "RAVENMOOR" is 6 distinct glyphs; typing a new letter costs one glyph's analysis. This is the single biggest liveness decision in the design.

### 4.1 Smoothed analysis rings (the load-bearing step)

Measured fact about the shipped faces, using the existing `vector.js` flattener and a ±4-sample 35° corner test:

```
MetalMania  A: 733 pts, 113 corners   M: 155   O: 99   T: 151
PirataOne   A: 744 pts,  80 corners   M:  71   O: 17   T:  53
Unifraktur  A: 875 pts,  72 corners   M:  91   O: 46   T:  59
```

Those 99–155 corners are **ornamental raggedness the type designer put there**. No classifier will ever separate it from stroke structure, and an `O` with 99 corners will happily produce fifty phantom "terminals". So:

> **Analyse a simplified glyph; draw the ragged one.**

Procedure, per `(font, char)`:

1. `font.getPath(char, 0, 0, 1000 / capHeightEm)` → flatten with the existing scheme → rings, tagged outer/inner by signed area. **This is the RENDER ring set.** Keep it.
2. Rasterise those rings alone into a canvas sized to the glyph bbox + 32px pad, at cap height ≈ 360px. (Reuse the body of the old `rasterizeForAnalysis`, scoped to one glyph.)
3. Morphological **open then close** at radius δ, using the existing `chamfer()` distance transform:
   - `d⁺ = chamfer(bin)` → `erode = d⁺ ≥ δ`
   - `d⁻ = chamfer(¬erode)` → `open = d⁻ < 2δ` … (dilate by δ, then by δ again for the close)
   - `d⁺ = chamfer(open)` → `close = d⁺ ≥ δ`
   In practice: erode(δ) → dilate(2δ) → erode(δ). δ = **0.035 × capHeight** in analysis pixels (≈ 12px at capH 360). Expose δ as a per-font constant in `metrics.js`; Metal Mania will want more, UnifrakturCook less.
4. `traceLoops()` (existing) on the result → `rdp(loop, 0.8)` → one pass of closed Chaikin to take the pixel staircase off. **This is the ANALYSIS ring set.**
5. Scale both ring sets into GLYPH space (capHeight = 1000).

This costs ~2–4ms per glyph, once, and it drops Metal Mania's corner count by roughly an order of magnitude. It also hands CDT clean, closed, non-self-intersecting input with no duplicate points — which is the other half of why `poly2tri` was rejected.

*Deviation noted:* the judge's verdict proposed doing this with Clipper offsets. Raster is used instead because it reuses `chamfer` + `traceLoops`, which already exist and are already correct, and it keeps the 99KB of `clipper-lib` off the boot path — which the codebase has deliberately arranged. Cost: tangents are accurate to about ±3°, which is inside tolerance. If tangent noise proves visible, swap step 3–4 for `ClipperOffset(−δ) → (+2δ) → (−δ)` and accept clipper on boot.

### 4.2 Triangulate

Resample every analysis ring to near-uniform spacing **capHeight/40 = 25 GLYPH units** (CDT quality is spacing-sensitive). Build the constraint edge list: consecutive pairs within each ring, rings closed. Counters are included as constraint loops.

```js
const tris = cdt2d(points, edges, { exterior: false, interior: true })
```

`exterior: false` drops everything outside the outer ring; because the counter loops are constrained and wound opposite, cdt2d leaves the counter interiors out too. **Verify this per font at build time** — if counters come back filled, mark them by point-in-polygon against the inner rings and discard.

If `tris.length === 0`, fall back to the raster skeleton path from `svgtrace.js` for that glyph and log it.

### 4.3 Chordal axis transform (`axis.js`)

Classify each triangle by how many of its three edges are *internal* (shared with another surviving triangle) vs *constrained* (on a ring):

| internal edges | name | axis contribution |
|---|---|---|
| 3 | **junction** | one Node at the triangle's **incenter**; three Edges out to the midpoints of its three internal edges. Degree 3. |
| 2 | **sleeve** | connect the midpoints of its two internal edges. Chains into an Edge. |
| 1 | **terminal** | one Node at the **vertex opposite the internal edge** — the actual sharp point of the stroke, sub-pixel exact. Degree 1. One Edge to the midpoint of the internal edge. |
| 0 | degenerate | skip (glyph is one triangle). |

Chain consecutive sleeves into polylines. Result per glyph:

```js
{ nodes: [{ p:[x,y], r, deg, kind }],
  edges: [{ a, b, poly: [{ p, r, s }], len }] }
```

**Radius.** For each axis sample, `r = min distance from the sample point to every constrained edge of the triangle(s) it came from`. `r` **is the local stroke half-width** — this is the number a barb's base must equal exactly, and it comes out for free. Store the glyph's **median r over all sleeve samples** as `wMedian` (used for the bolder-not-bigger graft, §6.3).

Typical output: **6–25 nodes per glyph**, versus today's hundreds of seeds.

### 4.4 Prune (the one heuristic, and it is a dial)

```
repeat until fixpoint:
  for each degree-1 node n:
    walk along the graph to the first node of degree ≥ 3 (call it J)
    let L = arclength of that walk
    if L < prune * r(J):  delete the walked branch
  merge any two junctions closer than max(r_a, r_b)
```

`prune ∈ [0.8, 3.0]`, default **1.6**. This is the standard medial-axis significance criterion. It converts a blackletter face's forest of serif spurs into 4–12 real stroke ends.

**Its failure is bounded, deliberately.** The ornament *budget* downstream is a hard cap. A bad `prune` therefore produces a *wrong selection of anchors*, never *too many ornaments* — the degradation is "boring", never "root ball".

### 4.5 Classify anchors (`anchors.js`)

Walk the pruned graph. For each degree-1 node, `t` = unit vector from the second axis sample to the node — **the stroke's own outgoing tangent**. Emit anchors:

| Class | Test | Weight `W` |
|---|---|---|
| **A1 outerFlank** | degree-1 node with the min-x on glyph 0, or max-x on glyph n−1. Exactly 2 per word, assigned at compose time. | 10 |
| **A2 extremum** | degree-1 node with `y > 1.05·xHeight` (ascender) or `y < −0.12·capHeight` (descender), in GLYPH space | 6 |
| **A4 apex** | interior axis sample where the tangent turns > 55° over a 2r window **and** r is a local minimum (an `A` apex, an `M` vertex, a `V` bottom); plus degree ≥ 3 junctions | 3 |
| **A3 terminal** | any other degree-1 node | 2 |
| **A5 serifSlot** | degree-1 node whose edge tangent is within 25° of vertical over its last 0.3·capHeight | 1 |
| **A6 counter** | inner ring: centroid + inscribed radius. **Used only by the sigil placer, never grown from.** | — |

Each anchor also carries:
- **`base`** — the point on the spine at arclength `r_node` back from the node, and **`w0 = 2 × r at that point`**. This is where a primitive's polygon starts, *submerged inside the glyph's ink*, so the join needs **no cap geometry at all**. This single choice is what kills F10 and the "glued-on" read simultaneously.
- **`id`** — stable string `${char}:${nodeIndex}`, used to seed per-primitive randomness deterministically.

**Not enumerable, therefore never excluded by a rule:** mid-stem (degree-2, no curvature event), bowl exteriors (an `O`'s axis is a closed loop with no degree-1 node), counter rims.

Cost: **~2–4ms per distinct glyph, once, cached forever.**

---

## 5. PIPELINE — TIER 2a: THE ENVELOPE (`envelope.js`)

The envelope is **prior** and it is a **region**, not a boolean clip. Four closed-form signed distance functions, evaluated in the **mirrored domain** `q = (|x − A|, y)`, so bilateral symmetry of the silhouette is exact and free.

Let `H` = cap height in world units, `A` = word centre x, `halfW = aspect·H/2`.

```js
// iq's primitives, in plain JS
const sdBox = (px, py, bx, by) => {
  const dx = Math.abs(px) - bx, dy = Math.abs(py) - by
  return Math.hypot(Math.max(dx,0), Math.max(dy,0)) + Math.min(Math.max(dx,dy), 0)
}
const sdCircle = (px, py, r) => Math.hypot(px, py) - r
const sdRhombus = (px, py, bx, by) => { /* iq sdRhombus */ }
const opUnion  = (a, b) => Math.min(a, b)
const opSmooth = (a, b, k) => { const h = Math.max(k - Math.abs(a-b), 0)/k
                                return Math.min(a,b) - h*h*k*0.25 }
```

| `silhouette` | `sdEnv(q)` |
|---|---|
| **arch** | `opSmooth( sdBox(q.x, q.y − baseline + 0.5H, halfW, 0.5H + sag·0.35H), sdCircle(q.x, q.y − (top − crown·1.2H), crown·1.2H + 0.2H), 0.25H )` — box + raised central cap |
| **wing** | `opUnion` of two shear-rotated boxes rising outward: rotate by `±atan(crown·0.9)` about `(A, baseline)`, each `halfW × (0.45H)` — extremities highest **and** longest |
| **lozenge** | `sdRhombus(q.x, q.y − mid, halfW, (1 + crown)·H)`, `aspect` forced to ≈1.2 |
| **block** | `sdBox(q.x, q.y − mid, halfW, 0.5H·(1 + 0.2crown) + sag·0.2H)` |

Also emitted:
- **`A`** — the vertical centreline. The *only* symmetry axis in the design.
- **`B`** — the legibility band, `[baseline − 0.75·xHeight, baseline]` in world y.
- **`gaps[]`** — per adjacent glyph pair, the x-interval between their bboxes (filled in after typesetting).

**Length solving** (this is the difference between a silhouette and a clipped blob):

```js
function raycastToBoundary(p, d, sdEnv) {     // sphere marching
  let t = 0
  for (let i = 0; i < 12; i++) {
    const s = -sdEnv(p.x + t*d.x, p.y + t*d.y)   // negative inside
    if (s < 0.5) break
    t += Math.max(s, 0.5)
  }
  return t
}
```

`showEnvelope` toggle draws `∂E` as a faint 1px guide by marching a coarse grid — a genuine design aid, ~20 lines.

---

## 6. PIPELINE — TIER 2b: TYPESET (`typeset.js`)

Microseconds. Outlines only, no raster.

### 6.1 Per-glyph affine
```
mid   = (n − 1) / 2
claim = 1 + outerBias · (|i − mid| / mid)^1.3          // outer letters BIGGER
dy    = arc · 0.22·H · (1 − ((i − mid)/mid)²)          // baseline arc, peaks at centre
rot   = dislocation · 0.09 · (rand_i − 0.5) · 2
sc    = 1 + dislocation · 0.07 · (rand_i − 0.5) · 2
```
Advances from `font.getAdvanceWidth`, plus `tracking ∈ [−0.08, +0.02] em`. **Never positive beyond +0.02.**

### 6.2 Fit into E, not around the ink
One global uniform scale + translate that puts the *glyph* bbox inside E's box with a 4% margin. **The fit is driven by `E`, never by the inked result.** This one line kills F11 and the `growth is unbounded; the composition scales to fit` behaviour. `reach` now lengthens the ornament; it can never shrink the letters.

### 6.3 Bolder-vs-bigger (anti-generated lever #2)
`claim > 1` applied to a font glyph scales its stem width too, so first and last letters come out *heavier*, not just bigger. Szpajdel draws them bigger at the same weight. Correction: after scaling glyph `i` by `claim`, **erode its render rings by `(claim − 1) · wMedian / 2`** (`wMedian` came free from the axis, §4.3).

Implementation note: erosion needs Clipper or a raster pass, neither of which belongs on the composition tier. **Quantise `outerBias` to 8 steps** and cache the eroded render rings per `(font, char, claimStep)`, built lazily on first use. If that proves fussy, ship v1 without it and put it on the list — it is a refinement, not a requirement.

---

## 7. PIPELINE — TIER 2c: COMPOSE (`compose.js`)

Everything here operates on **≤ 28 primitives**. That is what makes it sub-millisecond.

### 7.1 Motif set — draw this FIRST (anti-generated lever #1)

Before any primitive is synthesised, draw **one motif set per logo** from the seed:

```js
const motif = {
  angles:     [3 draws from ±25°·angleDial],       // fixed for the whole logo
  curvatures: [2 draws from ±curvatureDial/H],
  ratios:     [2 draws from 0.72…1.0],             // length multipliers
}
```

Every primitive then **chooses** an index from each set by `hash(anchor.id, seed) % 3`, rather than drawing its own independent uniform. Twenty-four independent uniform draws look like noise; a letterer reuses the same hook four times. The research says "symmetry, balance and **repetition of motifs**" and every prior proposal dropped the third word. This is one line and it is the highest-value anti-generated lever available.

### 7.2 Rank and budget
```
score(a) = W[a.class]
         · (1 + outwardness · |a.x − A| / halfW)          // outwardness = 1.2 fixed
         · vWeight(a.y)                                    // crown vs root
         · (1 + 0.15 · hash(a.id, seed))                   // stable tiebreak
vWeight = a.y < baseline ? 1 + crownRoot : 1 − 0.5·crownRoot
```
Sort descending; take `N = ornaments ∈ [4, 28]`, with a **per-glyph cap of `ceil(N / glyphCount) + 1`** so one dense letter cannot eat the whole budget.

### 7.3 Symmetry — mirror the SELECTION, never the geometry

`mirrorBranches` reflects *finished polylines* across `cx`, which lands spikes on top of other letters and roots them inside solid ink with no anchor. **It is deleted, not tuned.**

Instead, for each chosen anchor `a` at signed offset `d = a.x − A`, search the **unchosen** anchor pool for the `b` minimising

```
cost(b) = |(−d) − (b.x − A)| / halfW
        + 0.5 · |a.y − b.y| / H
        + kindPenalty(a.class, b.class)          // 0 same class, 0.6 adjacent, 2.0 else
```

Accept iff `cost(b) < (1 − symmetry) · 1.2 + 0.05`. On accept, `b` inherits:
- the same **rank**,
- the same **motif indices**,
- length `L_b = L_a · (1 ± 0.15·(1 − symmetry) · jitter)`,
- angle mirrored, `± 10°·(1 − symmetry) · jitter`.

On reject, the ornament stays **unpaired**. That is Szpajdel's *"imperfect but balanced symmetry"* arrived at from the data rather than jittered in afterwards.

**Do not drop the ±15% / ±10% jitter as "noise we removed."** Exact ±d matching with exactly equal lengths reads as clip-art, not heraldry. At `symmetry = 1.0` the jitter goes to zero and you get the heraldic Gorgoroth/Abruptum extreme; that is the intended top of the dial, not the default.

So `symmetry` is **mirror tolerance**, a continuous scalar, and it replaces both the old `symmetry: bool` and `symBreak`.

### 7.4 Synthesise — one primitive per anchor, zero recursion, bimodal by construction

**Resolving the spec contradiction.** §2 of the grammar forbids lengths in `[0.35, 0.7]·H`; §8's table gives WEDGE a length of `0.4–1.0·H`. Resolution adopted here: **"wedge" is a SHAPE, not a length band.** There are exactly two length modes:

- **MAJOR**, ranks `0 … majors−1`: `L = raycastToBoundary(base, dir, sdEnv) · reach`, clamped to `[0.8, 2.5]·H`.
- **MINOR**, ranks `majors … N−1`: `L = barbs · H · ratio`, clamped to `[0.05, 0.30]·H`.

Nothing can be assigned into `[0.35, 0.7]·H` — the two ranges are disjoint by construction, not by sampling. The length histogram is bimodal because the *assignment* is bimodal.

Three primitive kinds:

| Kind | Used for | Geometry |
|---|---|---|
| **BARB** | all MINORs | Straight. Polygon = `[base + n·w0/2, node + d·L, base − n·w0/2]` — **a triangle.** Base width `w0` is the measured stroke width exactly; tip width is exactly 0 and is a hard vertex. |
| **WEDGE** | MAJORs with `curvature ≈ 0` | Same triangle, longer. |
| **SWEEP** | MAJORs with `curvature > 0` | Circular-arc centreline of **one constant signed curvature κ** for the whole primitive. Half-width `r → r/contrast` over the first 0.15L, then linear to exactly 0. Sampled at 16 points, both sides offset, joins mitred, single tip vertex. |

Direction: `dir = rotate(anchor.t, σ · motif.angles[k])`, where `σ = sign(anchor.x − A)` so the turn is **away from the axis**. Drawn **once**, not per step — a curvature sign change is therefore not representable, and F4 cannot occur.

**FORK**: at most one, only when the `fork` toggle is on, only on the top-ranked A2 ascender, depth 1, two children at ±18–30°, each 0.55·L. That is the entire recursion budget of the engine.

### 7.5 The bracket (the fuse, as geometry)

At each of the ≤28 joints both tangents are known — the axis gives them for free. Emit, per side of the primitive:

- `B` = the primitive's flank point at the base,
- `C` = the point on the glyph's render ring nearest `B`, walked along the ring **away from the primitive** by arclength `R = fuse · w0`,
- `D` = the point on the primitive's flank at arclength `R` from `B`,
- polygon `[B, C, D]` — **a triangle.**

This is a **chamfer, not a round fillet**, and that is deliberate: the genre is "frozen tree branches", rigid and brittle, and a round fillet reads as cast wax. It melts a spike into its stem the way a pen does, it is exact under Clipper, and because it is authored per-joint it **cannot touch a tip**.

Cap `fuse` at `0.06·H`.

### 7.6 Interlock
`interlock` select, four regimes. Per adjacent glyph pair, take the pair of anchors (one from each glyph, A2 or A3) with the smallest horizontal gap:

| Regime | Action |
|---|---|
| **separate** | nothing; tracking floor at 0 em |
| **touching** | extend one primitive so its centreline grazes the neighbour's spine (solve endpoint distance = `w0/2 + r_neighbour`) |
| **interlocked** | cross and continue past the neighbour's spine by `overlap · 2r` |
| **fused** | interlocked, **plus** drive `tracking` to −0.08 em so glyph spines overlap and the union welds them |

Regime 3 is an approximation and the dial should be labelled for what it does. True fusing is a spine-weld and is deferred.

### 7.7 Sigil — exactly 0 or 1, on the axis
Four hand-authored polygon recipes in `sigil.js`: `none`, `inverted cross` (two boxes), `pentagram` (10-point star polygon), `horns` (two mirrored arcs). Placed on `A`, inside the largest central counter if its A6 inscribed radius ≥ 0.18·H, else centred above the mark at `top − 0.25·H`. Scaled to the available gap.

~40 lines of coordinates, and it is the highest impact-per-line in the design: 4 of Decibel's top-5 black metal logos carry one, and the current engine has none.

### 7.8 Guards (`guards.js`)

**(i) Legibility band veto — the hard invariant.**
> All interlocking and all major ornament happens ABOVE the x-height line or BELOW the baseline. The x-height band between letters stays clear.

Sample each primitive's centreline at 12 points. Reject if any sample lies inside `B` **and** inside an inter-glyph gap interval **and** outside its own glyph's footprint. (Ornament inside a glyph's own footprint in `B` is a serif and is fine.) On reject, promote the next-ranked anchor. This is why Xasthur still reads as a *word*.

**(ii) Crossing.** O(N²) segment intersection, ≈400 checks at N=28. Where two primitives cross, shorten the lower-ranked one to the intersection rather than letting strokes pile up.

**(iii) Ink budget.** Rasterise the whole polygon set once at 140×80 (1/10 logical) with Canvas2D, `getImageData`, count alpha > 128 inside E's bbox. ~0.3ms. While `ink / area(E) > inkBudget`, drop the lowest-ranked primitive and re-measure, bounded to 6 iterations.

Do **not** sum polygon areas analytically — it over-counts overlaps. Take the cheap raster. That same 140×80 buffer serves three purposes at once: the F11 guard, the squint/acceptance metric, and the existing "patch test" canvas in `App.jsx`.

---

## 8. RENDER

`compose()` returns `{ polys, primitives, envelope, metrics }` where `polys` is a flat array of:
- the glyph render rings (fine outlines, outer + counters, `fill-rule: nonzero` keeps counters as holes),
- one polygon per primitive,
- one triangle per bracket side,
- the sigil polygons.

Typically **~40 polygons, ~900 points**, against today's hundreds of branches × tens of segments. Hand straight to `renderInk(polys, ink, seed, ratio, fg)` in `raster.js` — unchanged apart from §9.

---

## 9. THE INK CONTRACT (the change to `raster.js`)

Today `bleed` + `threshold` are two dials that together approximate one morphological operation, and the Clipper export approximates it a *third* way with an open/close/net offset stack. They drift. Replace both with **one signed dial**:

> **`swell` — a pure signed dilate, in logical units.** Positive fattens, negative thins.

For a straight edge blurred with a Gaussian of σ, alpha at signed distance `x` into the ink is `Φ(x/σ)`. The level set `alpha = t` therefore sits at `x = σ·Φ⁻¹(t)`. To place the boundary exactly `r` units **outside** the true edge:

```js
const SIGMA_CAP = 1.55                     // keeps t inside raster.js's [0.05,0.95] clamp
function inkParams(swell) {
  const sigma = Math.max(0.7, Math.abs(swell) / SIGMA_CAP)
  const z     = -swell / sigma             // in [-1.55, +1.55]
  return { sigma, threshold: normalCdf(z) }   // Φ via Abramowitz–Stegun 7.1.26
}
```

Check: `swell = 0` → σ = 0.7, t = 0.5, edge unmoved. `swell = 3` → σ = 1.935, t = Φ(−1.55) = 0.061, edge moves out by 3.0. The existing `ink.bleed * t.fit * ratio` device-pixel correction stays, applied to `sigma`.

**Why this matters:** a Clipper round-join `ClipperOffset` by `+r` and a signed-field offset by `−r` are *the same Minkowski sum with a disk*. So the export is no longer a second back-end tuned to agree with the first; it is the same operation. Screen-vs-SVG stops being a calibration constant.

**Honest limit:** blur+threshold is an exact dilate for a locally-straight edge. Where two strokes are closer than ~2σ it also *fuses* them, which Clipper's dilate does too but at a slightly different gap (Clipper fuses at gap < 2r; the filter at roughly gap < 2r ± σ). With ≤28 sparse primitives the disagreement is confined to a handful of places and is bounded by σ ≤ 1.9 logical units, i.e. sub-pixel at 1× zoom. That is a real, stated, bounded discrepancy — not a hidden one.

`threshold` disappears from the panel. `grit` is unchanged (`destination-out` speckle on screen).

---

## 10. EXPORT PATH (`ink.js`)

The **primitive list is the artwork format**, not the pixels. Both screen and export read the same list.

### Mode A — "Export SVG" (default, instant, no Clipper)
Write the ~40 polygons directly as one `<path>` with `fill-rule="nonzero"`, and express the swell as a stroke — which every SVG renderer implements as an exact round-join dilate:

```xml
<path d="…" fill="#0a0a0a" fill-rule="nonzero"
      stroke="#0a0a0a" stroke-width="{2*swell}"
      stroke-linejoin="round" stroke-linecap="round"/>
```

Zero boolean work. Pixel-identical to screen by construction. **Only offered when `swell ≥ 0`** — a negative swell has no stroke form; grey the action out and say why. Caveat to surface in the drawer: the path has internal overlaps, which annoys a plotter or a cutting machine.

### Mode B — "Export SVG (merged)"
Dynamic-import `art.js` → Clipper. `union(all polygons)` → **one** `ClipperOffset(swell·SCALE, jtRound, etClosedPolygon)` → grit `difference` → `rdp(0.3)` → one path string. That is it: **no open/close/net stack.**

Input is now ~40 convex, non-self-intersecting polygons instead of variable-width offsets of smoothed random walks, so the old ~1.7s collapses to well under 100ms on plain `clipper-lib`. The `clipper2-wasm` upgrade becomes optional rather than load-bearing.

### PNG
Unchanged path: draw the polygon list at 8× to an offscreen canvas through `renderInk`.

### Serialisation
`serialize.js` writes `{genome, seed, text, font}` to the URL hash as a few hundred bytes of base64url. A logo is then a link. It also reads/writes the **golden-fixture JSON** format used by §14.

---

## 11. DIALKIT SCHEMA

DialKit titles a dial from its key (`outerBias` → "Outer Bias"), so the keys below **are** the labels. Range shorthand is `[default, min, max]` or `[default, min, max, step]`.

```js
useDialKitController('Metal Logo', {

  text:        { type: 'text',   default: 'RAVENMOOR', placeholder: 'Logo text…' },
  font:        { type: 'select', options: FONT_NAMES, default: 'Metal Mania' },
  size:        [260, 80, 420],
  uploadSvg:   { type: 'action', label: '…' },
  clearSvg:    { type: 'action', label: 'Back to text' },
  legibility:  { type: 'select', options: Object.keys(STOPS), default: 'Breaking point' },
  mutation:    [0.35, 0.05, 1],

  silhouette: {                                    // FOLDER — the envelope, chosen first
    shape:     { type: 'select', options: ['arch','wing','lozenge','block'], default: 'wing' },
    aspect:    [3.5, 1, 6],
    crown:     [0.5, 0, 1],
    sag:       [0.3, 0, 1],
    showGuide: false,
  },

  letters: {                                       // FOLDER — typesetting
    outerBias:   [0.35, 0, 1],
    tracking:    [-0.02, -0.08, 0.02],
    arc:         [0.25, 0, 1],
    dislocation: [0.25, 0, 1],
    prune:       [1.6, 0.8, 3.0],
  },

  ornament: {                                      // FOLDER — the budget
    ornaments: [14, 4, 28, 1],
    majors:    [4, 0, 8, 1],
    reach:     [1.4, 0.3, 2.5],
    barbs:     [0.18, 0.05, 0.30],
    angle:     [0.4, 0, 1],
    curvature: [0.3, 0, 1],
    contrast:  [8, 3, 14],
    fuse:      [0.35, 0, 1],
    fork:      false,
  },

  composition: {                                   // FOLDER
    symmetry:  [0.8, 0, 1],
    crownRoot: [0.6, 0, 1],
    interlock: { type: 'select', options: ['separate','touching','interlocked','fused'], default: 'interlocked' },
    overlap:   [0.5, 0, 1],
    sigil:     { type: 'select', options: ['none','inverted cross','pentagram','horns'], default: 'inverted cross' },
    inkBudget: [0.35, 0.20, 0.55],
  },

  ink: {
    swell: [1.2, -3, 6],
    grit:  [0.3, 0, 1],
  },

  transparentBg: true,
  growOut:       true,
})
```

### What every dial does

| Dial | Range / default | Effect |
|---|---|---|
| `shape` | arch / wing / **lozenge** / block | Picks the envelope SDF. Arch = crown-like peak (Emperor, Dimmu). Wing = extremities highest and longest (Marduk, Mayhem). Lozenge = near-square emblem (Abruptum, Xasthur). Block = tight rectangle (Burzum, Craft). |
| `aspect` | 1–6, **3.5** | W:H of the envelope including ornament. Lozenge forces ≈1.2. |
| `crown` | 0–1, **0.5** | Height of the envelope's peak above cap line. |
| `sag` | 0–1, **0.3** | Depth of the envelope's underside below baseline. |
| `showGuide` | **off** | Draws `∂E` as a faint outline. Design aid. |
| `outerBias` | 0–1, **0.35** | First and last letters bigger (Szpajdel's rule), with a weight correction so they are bigger, not bolder. |
| `tracking` | −0.08…+0.02 em, **−0.02** | Letter spacing. Never meaningfully positive. |
| `arc` | 0–1, **0.25** | Baseline curve; the word arcs up in the middle. |
| `dislocation` | 0–1, **0.25** | Per-glyph rotate/scale/shift jitter. Post-analysis affine, so it no longer invalidates the cache. |
| `prune` | 0.8–3.0, **1.6** | Medial-axis significance. Low = every serif spur is a stroke end; high = only the four big stems survive. Reads to a user as detail ↔ simplicity. |
| `ornaments` | 4–28, **14** | **The master dial.** Total primitive count for the entire logo. |
| `majors` | 0–8, **4** | How many of those are long sweeps that reach the envelope. The rest are barbs. |
| `reach` | 0.3–2.5, **1.4** | Major length in cap heights, solved against `∂E`. Lengthens ornament; never shrinks letters. |
| `barbs` | 0.05–0.30, **0.18** | Minor length in cap heights. Range ends below the forbidden 0.35H band. |
| `angle` | 0–1, **0.4** | Scales the ±25° rotation budget. Drawn once per primitive from the motif set, never per step. |
| `curvature` | 0–1, **0.3** | Arc magnitude on sweeps. Single constant sign per primitive. |
| `contrast` | 3–14, **8** | Thick:thin ratio. Stems stay constant width; only ornament tapers. |
| `fuse` | 0–1, **0.35** | Bracket (chamfer) size where a spike meets its stem, in stroke widths. Capped at 0.06·H. |
| `fork` | **off** | Allows exactly one depth-1 Y, on the top-ranked ascender. |
| `symmetry` | 0–1, **0.8** | **Mirror tolerance.** How insistently anchor pairing searches, and how much jitter survives. 1.0 = exact heraldic. Replaces the old bool *and* `symBreak`. |
| `crownRoot` | 0–1, **0.6** | Mass above vs below the band. 0.6 ≈ 2:1 crown:root, which is the canon. |
| `interlock` | separate / touching / **interlocked** / fused | Letter-to-letter regime. |
| `overlap` | 0–1, **0.5** | How far a bridge crosses the neighbour's stem. |
| `sigil` | none / **inverted cross** / pentagram / horns | 0 or 1 symbol, on the axis. |
| `inkBudget` | 0.20–0.55, **0.35** | Hard guard. Drops lowest-ranked primitives until `ink/area(E)` is under it. |
| `swell` | −3…6, **1.2** | Signed pure dilate in logical units. Replaces `bleed` + `threshold`. |
| `grit` | 0–1, **0.3** | Speckle. Unchanged. |

### Dials that must die
`length`, `wings`, `depth`, `splitChance`, `chaos`, `sprouts`, `counters`, `taper`, `symBreak`, `symmetry: bool`, `threshold`, and the `'free'` envelope. Each encodes a named failure mode directly: `depth`/`splitChance` = the crazy tree; `chaos` = the random walk; `sprouts`/`counters` = ornament in the legibility band; `taper` = everything tapers; `'free'` = unbounded ink.

### STOPS presets (re-authored)
```js
'Readable but cold': block   / ornaments 8  / majors 2 / symmetry 0.40 / interlock separate    / sigil none / swell 0.8 / grit 0.20
'Unstable':          wing    / ornaments 16 / majors 4 / symmetry 0.55 / interlock touching    / sigil horns / swell 1.4 / dislocation 0.8
'Breaking point':    arch    / ornaments 20 / majors 5 / symmetry 0.70 / interlock interlocked / sigil inverted cross / swell 2.0
'Total sigil':       lozenge / ornaments 26 / majors 6 / symmetry 0.95 / interlock fused       / sigil pentagram / swell 3.0 / inkBudget 0.48
```
These are starting points. Re-tune by eye once the engine is real.

---

## 12. LIVENESS — THREE TIERS

Driven off a **rAF dirty flag on refs**, not a React effect per genome change. Today `App.jsx` re-runs `growTendrils` **and** full polygonisation for *any* change because both effects key on `[genome, globalKey]`; that is why it feels heavy.

| Tier | Invalidated by | Work | Cost |
|---|---|---|---|
| **T1 ANALYSIS** | `text`, `font` (per *distinct glyph*, cached on `font\|char`) | raster open+close, trace, resample, CDT, chordal axis, prune, classify | **2–4ms per NEW glyph.** A word of 6 distinct letters, first time: ~15ms. Every subsequent word reusing those letters: **0ms.** |
| **T2 COMPOSITION** | every structural dial, plus `size`, `dislocation` | envelope solve, per-glyph affines, score, budget, mirror pairing, motif draw, synthesise, guards, outline, 140×80 guard raster | **~0.5–1.2ms.** ≤28 primitives × 16 samples ≈ 450 offset points + ~400 crossing tests + one tiny raster. |
| **T3 INK** | `swell`, `grit`, colour, zoom, theme | `renderInk` only, touching no geometry | **~4ms**, the existing GPU pass, unchanged. |

Worst case for any dial drag is T2 + T3 ≈ **5ms**, inside a 16ms frame with room for React. No debounce, no worker, no render button, no progressive preview. Still coalesce repaints onto a rAF dirty flag, because React state churn during a drag would otherwise fire T2 several times per frame for nothing.

**Be honest about the direction of this claim:** the speed comes from the ornament budget being ≤28, not from any clever rendering. If the budget were unbounded this design would be no faster than what exists.

---

## 13. ACCEPTANCE TESTS (`acceptance.js`, dev only)

Because the primitive list *is* the artwork format, most of these are plain assertions over an array.

| # | Test | Catches |
|---|---|---|
| 1 | `primitives.length ∈ [4, 28]` | F1 fur |
| 2 | Length histogram bimodal; **zero** entries in `[0.35H, 0.7H]` | F2 no hierarchy |
| 3 | Max depth ≤ 1, forks ≤ 1 | F3 the crazy tree |
| 4 | Curvature sign changes per stroke = 0 | F4 random walk |
| 5 | Zero ornament samples in `B` within any inter-glyph gap | F5 illegible |
| 6 | Every primitive has a non-null `anchorId` resolving to a real graph node | F6 phantom mirrors |
| 7 | Squint: 140×80 buffer downsampled to 40px, thresholded — convex-hull deficiency > 8% | F7 no silhouette |
| 8 | Width-variance histogram bimodal (constant stems + tapered ornament) | F8 carrots |
| 9 | `sigilCount ∈ {0,1}`, centroid within 3% of `A` | F9 no semantic anchor |
| 10 | `min(tipWidth) === 0` for every primitive | F10 round caps |
| 11 | `ink / area(E) ∈ [0.25, 0.45]` | F11 blot |

Tests 1, 2, 3, 5 and 11 alone would have caught the current output before the owner ever saw it. Run them on every generate in dev, behind `#tests` in the hash; print failures to the console with the primitive index.

---

## 14. BUILD THIS FIRST — THE HALF-DAY PROBE

**Do not start with anchor extraction.** It is the part most likely to disappoint and the part *least* connected to the owner's verdict. Test the aesthetic hypothesis before committing to medial axes at all.

### Probe 1 — the golden fixture (half a day)

1. Write `src/engine/fixture.js` exporting a **hand-authored** JSON primitive list: RAVENMOOR, Metal Mania, wing envelope, **14 primitives, 4 majors**, placed by eye.
   ```js
   { text:'RAVENMOOR', font:'Metal Mania', size:260, envelope:{shape:'wing',aspect:4.2,crown:0.55,sag:0.3},
     primitives:[ {kind:'sweep', base:[212,380], dir:[-0.42,-0.91], L:520, w0:26, kappa:0.0009, rank:0}, … ] }
   ```
2. Write `src/engine/primitives.js` — the polygon emitters (triangle for wedge/barb, 16-sample offset strip for sweep, triangle for bracket). ~120 lines.
3. Add a `#fixture` hash branch to `App.jsx`: `textGeometry(...)` for the glyph polys + `primitives.map(toPolygon)` → `renderInk(...)`. Nothing else.
4. **Look at it.**

This tests the actual hypothesis — *envelope-first + 14 ornaments + bimodal lengths + zero recursion = a logo* — in a few hours, with zero commitment to medial axes, CDT, SDFs or alphabets. Hand-author three: one arch, one wing, one block.

**If it does not read as a logo, stop.** None of the rest was going to help, and you have spent half a day instead of three weeks.

If it does, the fixture becomes the **golden reference** that the automatic anchor ranker is later measured against: "does `compose()` on RAVENMOOR place primitives within 8% of where I placed them by hand?" That is a far better target than an abstract rule set.

### Probe 2 — letters only, no ornament (one more day)
Build `envelope.js` + `typeset.js` and render the wordmark **with zero primitives**: outer letters bigger, baseline arc, tracking, fitted into E. Does *that alone* already look more like a logo than today's output? It should. If it does, you have confirmed the central inversion independently of any anchor work.

### Then, in order
3. `analysis.js` + `axis.js` + `anchors.js`, with a **class-coloured anchor debug overlay on day one** — not as a nicety, this is undebuggable without it.
4. `compose.js`, measured against the golden fixture.
5. `guards.js`, `motif.js`, `sigil.js`.
6. The ink contract change in `raster.js` and the export rewrite in `ink.js`.
7. The new DialKit schema and the 3-tier render loop in `App.jsx`.
8. `acceptance.js`.

---

## 15. HONEST OPEN QUESTIONS

1. **Does the δ-opened medial axis actually yield 4–12 usable terminals per glyph on Metal Mania?** This is the load-bearing empirical claim and it is **unmeasured**. The raw corner counts (99–155) are measured; the post-opening spur count is not. Measure it on day one of Probe 3 with a throwaway script over all three fonts × the full A–Z. If Metal Mania still produces 40 spurs per glyph at δ = 0.035·capH, raise δ per-font until it does not, and accept that Metal Mania is then being analysed as a much blunter shape than it is drawn as.

2. **Bowl-only words.** `O` has a closed axis loop with zero degree-1 nodes. OSSO, BLOOD, DOOM offer the engine almost no anchors and therefore no silhouette. The fallback — license the point on a closed axis loop farthest from the word centre as a synthetic outer-flank anchor with tangent = outward normal — is well-defined but is a fallback, and those logos will always be the weakest output. This is the nameable worst case of a skeleton-first design and it has no clean fix.

3. **How much swell does the owner actually want?** The σ cap (§9) means `swell` stays a pure dilate up to roughly ±6 logical units before the filter's threshold saturates. If the desired look needs a real morphological *close* — strokes melting together — that is a different operator and the exact screen↔export equivalence goes away. Find this out early by scrubbing `swell` on Probe 1's fixture.

4. **Does the chamfer bracket read right, or does it want to be concave?** Real blackletter serif brackets are slightly concave. A triangle is convex. It is exact, fast, and exportable; it may also look subtly mechanical at 8× export. Needs the owner's eye, and it is the one place the geometry imposes a look.

5. **Is the wedge-length reading correct?** The grammar's §2 and §8 contradict each other. This spec resolves it by making "wedge" a shape and pushing all lengths into two disjoint modes (§7.4). Somebody should confirm that is the intent rather than my reading of it.

6. **Motif set size.** Three angles / two curvatures / two ratios is a guess. Too few and the mark reads as a stencil; too many and the lever does nothing. Make the set sizes constants, not dials, and tune once.

7. **Class weights may need to be per-font.** Weights tuned on Metal Mania are not guaranteed to rank correctly on Pirata One. Normalise scores per glyph and accept some tuning; a per-font weight table would correctly feel like "the engine is a font-specific hack".

8. **The uploaded-SVG path is now second-class.** An arbitrary traced bitmap has no font outlines, so it keeps the Zhang–Suen skeleton from `svgtrace.js` and gets a cruder anchor set with no class information. The codebase therefore keeps **two analysers** forever. The alternative is to drop the upload feature — that is the owner's call, not mine, and it is worth asking, because that feature is what dragged raster analysis into this codebase in the first place.

9. **`interlock: fused` is the weakest of the four regimes.** True fusing is a spine-weld; what ships is tracking driven to −0.08 em plus the ink swell doing the welding. Cheap, crude, and honestly close to what fused logos look like after ink — but it is the regime the "Total sigil" preset wants most.

10. **Grit does not round-trip perfectly.** Screen grit is a `destination-out` speckle; export grit is a polygon `difference` with the same seed and the same shapes in the same pre-fit space, so they agree in placement but not in antialiasing. Already true today; not made worse; worth one line in the drawer rather than pretending they match.

11. **Bolder-vs-bigger may not be worth its cache.** §6.3 needs per-`(font, char, claimStep)` eroded rings. If the 8-step quantisation is visible as stepping when dragging `outerBias`, ship v1 without the correction and accept that the outer letters are slightly heavier as well as bigger.

12. **≤28 primitives puts all the weight on each one.** One bad wedge is 4% of the mark and unmissable, where today's hundreds of branches hide individual errors in the mass. That is the right trade, and it is also a genuinely higher bar on tangent quality and primitive geometry than the current engine ever had to clear.