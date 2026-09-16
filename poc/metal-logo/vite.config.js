import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dropGeistMonoImport } from '../shared/vite-dialkit.js'

export default defineConfig({
  base: '/20260824/metal/',
  plugins: [react(), dropGeistMonoImport()],
  build: {
    outDir: '../../20260824/metal',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        /* Four vendors that move at four speeds: React never changes, the
           geometry libraries change when the engine does, and DialKit changes
           when the panel does. Split, an edit to App.jsx re-downloads only
           App.jsx. */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('node_modules/clipper-lib')) return 'clipper'
          if (id.includes('node_modules/opentype.js')) return 'opentype'
          if (/node_modules\/(dialkit|motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'dialkit'
        },
      },
    },
  },
})
