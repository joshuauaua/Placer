import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const opencvFile = require.resolve('@techstark/opencv-js')
const opencvVersion = require('@techstark/opencv-js/package.json').version
// Version-keyed so the file lands under the immutable Cache-Control rule in
// public/_headers and stays cached across app deploys, unlike a bundler chunk
// hash which churns on every rebuild regardless of whether OpenCV changed.
const opencvAssetPath = `assets/opencv-${opencvVersion}.js`

// OpenCV.js is a 13 MB UMD build with its WASM embedded. Bundling it inflates
// it further (~2.2 MB of pure overhead) and drags in a "crypto externalized"
// warning, so emit it as a plain static asset instead of running it through
// the bundler at all.
// Two plugins, not one, because `apply` gates every hook on the object: the
// build-time emitFile() call and the dev/test-time serve middleware need
// opposite `apply` values, and emitFile() warns (context method not
// supported) if it fires during `vp dev`/`vp test`'s serve-mode plugin
// container.
function opencvAssetBuildPlugin() {
  return {
    name: 'opencv-asset-build',
    apply: 'build',
    buildStart() {
      this.emitFile({
        type: 'asset',
        fileName: opencvAssetPath,
        source: readFileSync(opencvFile),
      })
    },
  }
}

function opencvAssetServePlugin() {
  return {
    name: 'opencv-asset-serve',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(`/${opencvAssetPath}`, (req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        res.end(readFileSync(opencvFile))
      })
    },
  }
}

// Link-preview crawlers need an absolute og:image URL, and each branch deploys
// to its own host, so index.html's %SITE_ORIGIN% is resolved per build.
// Branches with a custom domain use it; any other Vercel build falls back to
// its branch URL, and a local build to the public site.
const SITE_HOSTS = {
  Development: 'staging.plcr.org',
  main: 'beta.plcr.org',
  landingpage: 'plcr.org',
}

function siteOrigin() {
  const host =
    SITE_HOSTS[process.env.VERCEL_GIT_COMMIT_REF] ??
    process.env.VERCEL_BRANCH_URL ??
    'plcr.org'
  return `https://${host}`
}

function siteOriginPlugin() {
  return {
    name: 'site-origin',
    transformIndexHtml: (html) => html.replaceAll('%SITE_ORIGIN%', siteOrigin()),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), opencvAssetBuildPlugin(), opencvAssetServePlugin(), siteOriginPlugin()],
  define: {
    __OPENCV_ASSET_PATH__: JSON.stringify(opencvAssetPath),
  },
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
          if (id.includes('/react-dom/')) {
            return 'vendor-react'
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
