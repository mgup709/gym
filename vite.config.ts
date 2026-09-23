import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// SINGLE_FILE=1 bundles everything into one chunk so scripts/build-single.mjs can inline it into one HTML page.
const single = !!process.env.SINGLE_FILE

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under any sub-path (e.g. GitHub Pages at /gym/).
  base: './',
  build: single
    ? {
        outDir: 'dist-single',
        cssCodeSplit: false,
        assetsInlineLimit: Infinity,
        rolldownOptions: { output: { codeSplitting: false } },
      }
    : {},
})
