/* The chrome around the app: the welcome screen, the nav, the footer, and the two
 * legal pages — which are the only views reachable both by a click and by a direct
 * URL, and are lazy chunks either way. */

import { test, expect } from './fixtures/app.js'

test.describe('navigation', () => {
  test('the welcome screen is what a visitor lands on', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Reimagine Your City' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start imagining' })).toBeVisible()
    // The three steps, from the "How it works" card.
    await expect(page.getByText('Find a spot', { exact: true })).toBeVisible()
    await expect(page.getByText('Place assets', { exact: true })).toBeVisible()
    await expect(page.getByText('Share it', { exact: true })).toBeVisible()
  })

  test('the nav reaches About, Resources and Sandbox, and the logo comes back', async ({ page }) => {
    await page.goto('/')

    await page.getByText('About', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'About PLACER' })).toBeVisible()

    await page.getByText('Resources', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Resources', level: 1 })).toBeVisible()

    await page.getByText('Sandbox', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sandbox', level: 1 })).toBeVisible()
    // The Sandbox is the one view that lives in the URL.
    await expect(page).toHaveURL(/\/sandbox$/)

    // Leaving it writes the URL back, rather than stranding the app on /sandbox.
    await page.getByText('About', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'About PLACER' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  test('the footer opens the legal pages', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Privacy Policy', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible()

    await page.getByRole('link', { name: 'GDPR', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'GDPR', level: 1 })).toBeVisible()
  })

  test.describe('as a direct URL', () => {
    for (const [path, heading] of [
      ['/privacy', 'Privacy Policy'],
      ['/gdpr', 'GDPR'],
    ]) {
      test(`${path} renders ${heading} on a cold load`, async ({ page }) => {
        await page.goto(path)

        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
        // Still inside the app shell, not a bare page.
        await expect(page.getByText('© 2026 PLACER')).toBeVisible()
      })
    }
  })

  test('an unknown path falls through to the welcome screen', async ({ page }) => {
    await page.goto('/no-such-page')

    await expect(page.getByRole('heading', { name: 'Reimagine Your City' })).toBeVisible()
  })
})
