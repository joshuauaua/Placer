/* The admin routes are gated on a build-time flag, not authentication (see the
 * AdminGate comment in src/App.jsx). .env.e2e leaves the flag false, which is what
 * a production build should look like, so what these check is that the gate holds
 * on a direct URL — the only way either route is reachable. */

import { test, expect } from './fixtures/app.js'

test.describe('admin gate', () => {
  for (const path of ['/admin', '/admin/imaginations']) {
    test(`${path} is refused when VITE_ADMIN_ENABLED is not true`, async ({ page }) => {
      await page.goto(path)

      await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible()
      await expect(page.getByText('The admin dashboard is not available in this environment.')).toBeVisible()
    })
  }
})
