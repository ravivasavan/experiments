# play.ravivasavan.com

Experiments, out in the open.

Static site served by GitHub Pages from `main` (root). Every push deploys.

Every play wears the same chrome: a header, a rail down the left for what changes the view, a dock along the bottom for the verbs, and a dials drawer on the right that minimises into a disc. `assets/CHROME.md` is the contract, and it is worth reading before touching any of it.

The home page is a horizontal timeline built from `assets/timeline/experiments.json` — the rail itself is never hand-maintained. The one exception is the `<noscript>` fallback in `index.html`, a plain list of links for visitors and crawlers without JS: keep it in step with the JSON when you add, remove or hide an entry.

## Adding an experiment

1. **The thing itself.** Either host it here at `<YYYYMMDD>/<slug>/index.html`, or host it elsewhere and give the entry a `url`.

   A play that needs no dials can be plain HTML/CSS/JS with no build step. One with dials gets a Vite project at `poc/<slug>/` that builds straight into its dated folder — the engine stays plain JavaScript in `public/`, and React is there only to render the DialKit panel. `assets/CHROME.md` §8 has the shape; copy `poc/chroma/` and change the two paths in `vite.config.js`.
2. **Three shots** at `assets/timeline/<slug>/*.png`, 1280×800. They render as a scattered stack ~210px wide, so favour whole-screen views over detail crops. Mixing light and dark reads well.
3. **An entry** in `assets/timeline/experiments.json`:
   ```json
   {
     "slug": "arena-stats",
     "name": "Arena Stats",
     "date": "20260803",
     "description": "Every block you've made on Are.na, counted",
     "status": "live",
     "tech": "React, Are.na v3 API, no backend",
     "glyph": "chart",
     "url": "https://ravivasavan.github.io/arena-stats/",
     "shots": ["overview.png", "calendar.png", "rhythm.png"]
   }
   ```
   - `date` is the filing date, `YYYYMMDD`. It places the entry on the rail. Several experiments can share a date — the rail stretches that day to fit them.
   - `url` is optional; without it the entry links to `/<date>/<slug>/`.
   - `status` is `live`, `tinkering`, or `retired` — it colours the dot.
   - `glyph` names a key in the `GLYPHS` map in `index.html`. Add the Lucide path data there first, or the entry falls back to its initial.
   - `hidden` is optional. Set it to `true` to unlist an entry: the rail skips it, but the folder and shots stay put and the thing itself is still reachable at its own URL. Remove it from the `<noscript>` list too, or it stays visible without JS. Remove the flag to put it back.
4. Commit + push.

The committed bundle in the dated folder is what ships; `poc/` holds the source it was built from, and `node_modules` is ignored. Anything bigger than a play — something with a server, a router or a real app behind it — still gets its own repo and links in by `url`.

## Plumbing

- DNS: Cloudflare, `CNAME play.ravivasavan.com → ravivasavan.github.io` (DNS-only so GitHub can provision TLS)
- Custom domain + HTTPS: repo Settings → Pages
- `.nojekyll` keeps GitHub from running Jekyll over the files
