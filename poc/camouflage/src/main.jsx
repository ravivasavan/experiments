import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import '../../shared/dialkit-skin.css'

/* camo.js parses the hash and settles the state; the dials have to open on
   whatever it decided, which is what makes a shared link repaint the pattern
   it promised.

   Vite hoists this module into <head>, so in document order it runs *before*
   the engine's own defer script further down the body — mounting on the
   module's own turn would read a window.camo that isn't there yet. Both
   kinds of script finish before DOMContentLoaded, so that is the first moment
   the engine is guaranteed to have spoken. */
const engine = () => window.camo

const COLOURWAYS = [
  { value: 'woodland', label: 'Woodland' },
  { value: 'desert', label: 'Desert' },
  { value: 'urban', label: 'Urban' },
  { value: 'snow', label: 'Snow' },
  { value: 'tropic', label: 'Tropic' },
  { value: 'flecktarn', label: 'Flecktarn' },
]

const PATTERNS = [
  { value: 'blotch', label: 'Blotch' },
  { value: 'fleck', label: 'Fleck' },
]

function Controls() {
  const opening = engine()?.getValues() ?? {}

  const controller = useDialKitController('Camouflage', {
    palette: { type: 'select', options: COLOURWAYS, default: opening.palette ?? 'woodland' },
    pattern: { type: 'select', options: PATTERNS, default: opening.pattern ?? 'blotch' },
    blur: [opening.blur ?? 1, 0, 2],
    layers: [opening.layers ?? 4, 2, 6, 1],
  })

  const { palette, pattern, blur, layers } = controller.values

  /* The first run would only hand the engine back the values it just gave us,
     and cost a full repaint to do it. */
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    engine()?.setValues({ palette, pattern, blur, layers })
  }, [palette, pattern, blur, layers])

  return null
}

/* DialKit renders inline, inside the drawer index.html already put on the page,
   so the panel is the drawer's content rather than a second floating window.
   Popover mode would fight it for the corner and bring its own drag, collapse
   bubble and shadow.

   theme="dark" pins DialKit to one of its own palettes: the skin repaints
   nearly all of it from the site's tokens, but not quite all, and the default
   ("system") makes whatever is left follow the OS — so the panel would go
   light while the page stayed in night. Pinned, it follows the site and
   nothing else. */
function Settings() {
  const mount = document.getElementById('dial-mount')
  if (!mount) return null
  return createPortal(<DialRoot mode="inline" theme="dark" productionEnabled />, mount)
}

function mount() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Controls />
      <Settings />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
