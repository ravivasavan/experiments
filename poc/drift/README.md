# Drift

A sparse, repeating grid of Ravi's Cargo studies, with occasional seeded, offset pairs that overlap, and no more than three generated works intersecting a viewport. Generated filename labels and media types sit on the site's glass material. Labels wrap in a measured header so the full filename remains readable. The manifest’s `filename` fields use placeholder dates and names, not historical metadata; original media URLs and project titles are preserved. Native wheel, trackpad, touch and keyboard scrolling take over immediately; drift resumes after three idle seconds. Pause holds the collection still. Drag frames to reposition them, including beyond the viewport; on touch, drag their headers and swipe the media to scroll. Movement is clipped outside the fixed collection bounds and cannot enlarge the scroll area. Frames stop where released, then drift resumes after the idle delay. All repeating copies share the offset; Reset, Randomise or a new seed clears it. Alt + arrow keys move a focused frame (Shift takes larger steps); Escape cancels an active drag. Reduced motion starts with scrolling and preview videos paused.

The classic engine owns the state; React only mounts the standard DialKit panel. Speed is pixels per second, size and spacing change the grid, resume is idle seconds, and seed reproduces a composition. Randomise changes the seed; Reset restores the defaults. Defaults follow Ravi's review: speed 30, size 85, spacing 64 (reduced 20%), resume 3 and seed 1801. Frames belong only to the drifting previews. Opening a work suspends scrolling and shows unframed media (rounded thumbnails, square corners in full view) over an 80% theme-coloured backdrop with 32px blur; the paused collection remains visible underneath. Reduced transparency uses an opaque backdrop. Groups open an overview with one shared thumbnail height across every row, sized to fit the widest row while preserving each image’s aspect ratio, consistent edge-to-edge gaps and a subtle hover/focus fade; a thumbnail enters its single view, and one morphing Grid/Single rail button preserves the selected image. Escape and clicking empty backdrop step back one level: single → gallery → drift; standalone images return directly to drift. Close exits the overlay directly. Exiting restores focus to the originating work. The overlay contains keyboard focus and makes the underlying collection, site navigation and panel inert while open. Previous/next, shared `play.js` zoom controls and separate filename/count/zoom readouts live in the bottom dock, with 24px between functional groups and Close last, by explicit exception to the standard Tools arrangement. The single-image viewer retains arrow-key navigation.

## Develop and verify

```sh
npm install
npm run build
# In the repo root:
npx --yes http-server@14.1.1 . -a 127.0.0.1 -p 8510 -c-1
# In poc/drift:
npm run verify
```

Preview `/20260922/drift/`. `DRIFT_ORIGIN` overrides the test server origin. Install Playwright's Chromium with `npx playwright install chromium` if needed. The committed dated folder is the deployable build.

## Media

`public/media.json` is the editable collection: project title, source page, and an ordered media array. Each image has a 960px preview, a full-dimension WebP, original URL, dimensions and alt text. Videos are silent H.264 MP4 previews with local posters. Grid videos play only while visible; the viewer loads full images on demand. No Cargo or Vimeo requests are made during normal use. Original URLs remain in the manifest; there is no Original action in the UI.

Imported from [Ravi's Cargo Play collection](https://ravivasavan.cargo.site/play), 22 September 2026: 27 images and two motion pieces across 15 studies. Full-size WebPs retain the source pixel dimensions; they are compressed viewing copies, not byte-identical archival originals. Source URLs are retained in the manifest. Falling Figure contains only the LAPhil figure render; the two unrelated plant renders have been removed. Bag Close Ups contains only the three puffy bag renders; the unrelated plant and translucent pot have been removed.

The older Bag, Trunk Growth Motion and S001 Avandre Vimeo embeds returned access errors during import. Their videos are omitted; the available Bag and Trunk Growth stills remain. Circular Sideboard and Koto Faces are included as local motion previews.

For eventual main-site use, the media manifest and engine are independent of the panel. Keep the native scrolling, idle handoff, reduced-motion behavior and grouped media; adopt the main site's chrome at integration time.
