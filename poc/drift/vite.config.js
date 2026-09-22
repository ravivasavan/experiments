import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dropGeistMonoImport, dialkitChunks } from '../shared/vite-dialkit.js'

export default defineConfig({
  base: '/experiments/20260922/drift/',
  plugins: [react(), dropGeistMonoImport()],
  build: {
    outDir: '../../20260922/drift',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: dialkitChunks } },
  },
})
