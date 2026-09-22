# experiments

> **This repository is named `experiments`.**
>
> It was [`ravivasavan/play`](https://github.com/ravivasavan/play) until 22 September 2026. GitHub still redirects that old URL here. The repository to clone and push is:
>
> `git@github.com:ravivasavan/experiments.git`
>
> `https://github.com/ravivasavan/experiments.git`
>
> **The public site is [ravivasavan.com/experiments](https://ravivasavan.com/experiments/).** It is served by the `ravivasavan.com` Cloudflare Worker, on the same connection as the rest of the site. GitHub Pages is the origin the Worker fetches. `play.ravivasavan.com` only redirects.
>
> **Art to share lives at [ravivasavan.com/play](https://ravivasavan.com/play/).** Drift is also its own experiment at [ravivasavan.com/experiments/20260922/drift](https://ravivasavan.com/experiments/20260922/drift/). The two publishes stay separate.

Experiments, out in the open.

Every play wears the same chrome: a header, a rail down the left for what changes the view, a dock along the bottom for the verbs, and a dials drawer on the right that minimises into a disc. `AGENTS.md` at the root is the taste as rules, for any agent or person working here; `assets/CHROME.md` is the contract underneath it. Read both before touching any of it.

The home page is a horizontal timeline built from `assets/timeline/experiments.json` — the rail itself is never hand-maintained. The one exception is the `<noscript>` fallback in `index.html`, a plain list of links for visitors and crawlers without JS: keep it in step with the JSON when you add, remove or hide an entry.

The `experiments/` directory in this tree is a legacy public URL (`/experiments/magnetic/` still redirects to Magnetic). New plays are filed at `<YYYYMMDD>/<slug>/`.

## Teletext has one home

The play is [`20260817/teletext/`](20260817/teletext/), built from [`poc/teletext/`](poc/teletext/). The timeline entry uses that date. The 4 August and 10 August folders were redirects to it, and they are gone.

## Where a push shows up

| Public URL | What it is |
|---|---|
| `ravivasavan.com/experiments/` | This timeline, and every vibecoded play under it |
| `ravivasavan.com/experiments/<YYYYMMDD>/<slug>/` | One play |
| `ravivasavan.com/experiments/20260922/drift/` | Drift, the experiment |
| `ravivasavan.com/play/` | The same collection, published on its own for sharing |

Files in this repo stay at the root (`/assets`, `/<YYYYMMDD>/<slug>`). The Worker prefixes them when it serves an experiment. `/play/` is rewritten on its own and is not the experiment's URL. Drift's Vite base is `/experiments/20260922/drift/`.

## Adding an experiment

1. **The thing itself.** Either host it here at `<YYYYMMDD>/<slug>/index.html`, or host it elsewhere and give the entry a `url`.

   A play that needs no dials can be plain HTML/CSS/JS with no build step. One with dials gets a Vite project at `poc/<slug>/` that builds straight into its dated folder — the engine stays plain JavaScript in `public/`, and React is there only to render the DialKit panel. `assets/CHROME.md` §8 has the shape; copy `poc/chroma/` and change the two paths in `vite.config.js`.
2. **Three shots** at `assets/timeline/<slug>/`, 1280×800, `.webp`. They render as a scattered stack ~210px wide, so favour whole-screen views over detail crops. Mixing light and dark reads well.
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
     "shots": ["overview.webp", "calendar.webp", "rhythm.webp"]
   }
   ```
   - `date` is the filing date, `YYYYMMDD`. It places the entry on the rail. Several experiments can share a date — the rail stretches that day to fit them.
   - `url` is optional; without it the entry links to `/<date>/<slug>/`.
   - `status` is `live`, `tinkering`, or `retired` — it colours the dot.
   - `glyph` names a key in the `GLYPHS` map in `index.html`. Add the Lucide path data there first, or the entry falls back to its initial.
   - `hidden` is optional. Set it to `true` to unlist an entry: the rail skips it, but the folder and shots stay put and the thing itself is still reachable at its own URL. Remove it from the `<noscript>` list too, or it stays visible without JS. Remove the flag to put it back.
4. Commit + push.

The committed bundle in the dated folder is what ships; `poc/` holds the source it was built from, and `node_modules` is ignored. Anything bigger than a play — something with a server, a router or a real app behind it — still gets its own repo and links in by `url`.

## What stays out of git

The root `.gitignore` covers every play, including a new `poc/<slug>/` that has not copied its own ignore file yet.

- `node_modules/`, `dist/`, `.vite/`, and log files
- `.env` and other credential files: keys, pems, `credentials.json`, service-account JSON, `.npmrc`
- `.DS_Store` and editor metadata

Each `poc/<slug>/.gitignore` still ignores `node_modules/` and `dist/` for that project. Secret files were checked across the tree and the history of filenames: none are tracked. Leave them that way.

## Plumbing

- Origin: GitHub Pages from `main`. The Worker on `ravivasavan.com` fetches it and publishes `/experiments/` and `/play/`.
- `play.ravivasavan.com` is a redirect, not a site.
- `.nojekyll` keeps GitHub from running Jekyll over the files
