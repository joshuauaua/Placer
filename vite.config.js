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
    ],
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
