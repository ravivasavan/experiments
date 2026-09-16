/* What every play's Vite config needs to build a DialKit panel, in one place.

   Each play is its own Vite project — same bargain metal already made, and the
   reason the built bundle can be committed straight to its dated folder — so
   what they share is this module rather than a workspace. */

/* DialKit's stylesheet opens with a Google Fonts @import for Geist Mono, used
   for the numbers on its sliders. The skin puts those back in Labil Grotesk,
   so the import is a render-blocking request for a face nothing draws. */
export function dropGeistMonoImport() {
  return {
    name: 'drop-geist-mono-import',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('dialkit') || !id.endsWith('.css')) return null
      return code.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^)]*\);?/g, '')
    },
  }
}

/* Two vendors moving at two speeds: React never changes and DialKit changes
   when the panel does. Split, an edit to a play re-downloads only the play. */
export function dialkitChunks(id) {
  if (!id.includes('node_modules')) return
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
  if (/node_modules\/(dialkit|motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'dialkit'
}
