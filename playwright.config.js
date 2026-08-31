/* PLACER — Playwright end-to-end tests.
 *
 * These run against a production build served by `vp preview`, not the dev
 * server: the app's routes are lazy chunks and the map pulls in a 13 MB OpenCV
 * asset, and only the built output puts those together the way a visitor gets
 * them.
 *
 * Specs are named *.e2e.js rather than *.spec.js on purpose. Vitest's default
 * include is **\/*.{test,spec}.*, so this is what keeps `vp test` and
 * `playwright test` from collecting each other's files without either runner
 * needing an exclude list.
 */

import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  // The specs share a browser only, never state: each one seeds its own
  // localStorage, so they are safe to run in any order.
  fullyParallel: true,
  // A stray .only would silently shrink the suite CI is trusting.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker on CI: the runners are two-core, and the canvas work in the
  // create flow is the kind of thing that gets flaky when starved.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // -m e2e picks up .env.e2e, so the build under test is the same one whether
    // the developer running it has a .env with real keys or not.
    // --host 127.0.0.1 rather than the default: `vp preview` otherwise announces
    // itself on "localhost", which does not always resolve to the address below.
    command: `npm run build -- -m e2e && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Generous because the build, not the server, is the slow half: emitting the
    // OpenCV asset alone moves 13 MB.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
