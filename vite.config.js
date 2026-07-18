import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Exact-match only — a plain string key would also match (and mangle)
      // deep imports like 'react-konva/lib/ReactKonvaCore'.
      { find: /^react-konva$/, replacement: 'react-konva/lib/ReactKonvaCore' },
      // Redirect Konva's core barrel to a slim shim that drops unused
      // modules (Animation, Tween, Easings, FastLayer) — see src/lib/konva-core-slim.js.
      {
        find: 'konva/lib/Core.js',
        replacement: fileURLToPath(new URL('./src/lib/konva-core-slim.js', import.meta.url)),
      },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // rolldown (vite-plus's bundler) requires manualChunks as a
        // function — the object-map form rollup accepts isn't supported.
        manualChunks(id) {
          if (id.includes('/react-reconciler/') || id.includes('/konva/')) {
            return 'vendor-konva'
          }
        },
      },
    },
  },
  lint: {
    ignorePatterns: ['dist/**', 'docs/ref/**'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  },
})
