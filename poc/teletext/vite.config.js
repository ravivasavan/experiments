import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dropGeistMonoImport, dialkitChunks } from '../shared/vite-dialkit.js'

export default defineConfig({
  base: '/20260817/teletext/',
  plugins: [react(), dropGeistMonoImport()],
  build: {
    outDir: '../../20260817/teletext',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: dialkitChunks } },
  },
})
