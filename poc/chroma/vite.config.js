import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dropGeistMonoImport, dialkitChunks } from '../shared/vite-dialkit.js'

export default defineConfig({
  base: '/20260916/chroma/',
  plugins: [react(), dropGeistMonoImport()],
  build: {
    outDir: '../../20260916/chroma',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: dialkitChunks } },
  },
})
