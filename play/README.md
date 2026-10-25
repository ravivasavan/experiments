# Play

The art share at [ravivasavan.com/play](https://ravivasavan.com/play/). Graduated from Drift on 22 September 2026 so it can change on its own.

The experiment, with Dialkit and the Pause / Randomise / Reset dock, stays at [ravivasavan.com/experiments/20260922/drift](https://ravivasavan.com/experiments/20260922/drift/) and is built from `poc/drift/`. This folder is plain HTML, CSS and JS. There is no build step.

The collection still drifts at the reviewed defaults (speed 30, size 85, spacing 64, resume 3, seed 1801). Opening a work keeps the gallery rail and dock: grid or single, previous and next, zoom, and play or pause on a motion piece. The resting view has no parameter panel and no experiment bar.

`app.js` resolves media from this directory. `media.json` and `media/` are the collection.

A work can be linked to directly: `/play/?work=<id>` here, or `?play=<id>` on any ravivasavan.com page, which opens Play as a cover on that work (the chrome passes it through as `?work=`). The id is the project's `id` in `media.json`. The address bar follows the work that is open. `/play/?layout=masonry` opens in the Masonry layout, the Masonry button keeps that param in the address bar (alongside `work`), and the two combine. On any other page the same link is `?play=1&play-layout=masonry` (or `?play=<id>&play-layout=masonry`). The chrome passes it through as `?layout=`, and Play reports layout changes back with an `rv-play-layout` message.

Cards load lighter copies of the collection: 480 and 640px images picked by the card's width, and a small preview loop for each video (the opened view still shows the full files). After adding a work to `media.json`, run `python3 play/tools/card-media.py` (needs ImageMagick and ffmpeg) to cut them and record them as `srcset` and `preview`.
