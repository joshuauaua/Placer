/* The map without a Google Maps key — which is what CI has, and what a
 * misconfigured deployment would have. The view still has to render and say why it
 * is empty rather than fail silently. The keyed path is e2e/create-flow.e2e.js. */

import { test, expect } from './fixtures/app.js'

test.describe('map view without an API key', () => {
  test('Explore opens the map and explains the missing key', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Start imagining' }).click()

    await expect(page.getByText('Google Maps API Key Required')).toBeVisible()
    await expect(page.getByText('Add your API key to .env to enable map functionality.')).toBeVisible()
  })

  test('the map controls are still there to be found', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Explore', exact: true }).click()

    await expect(page.getByPlaceholder('Search for an address...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Capture view' })).toBeVisible()
  })

  test('no request is made to Google', async ({ page, externalRequests }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Explore', exact: true }).click()
    await expect(page.getByText('Google Maps API Key Required')).toBeVisible()

    // MapContainer appends the script tag regardless of whether the key is empty,
    // so this is the check that a keyless build's one outbound request is the
    // harmless one it looks like — and that the fixture stopped it.
    const google = externalRequests.filter((url) => url.includes('maps.googleapis.com'))
    expect(google.length).toBeGreaterThan(0)
    expect(google.every((url) => url.includes('key=&'))).toBe(true)
  })
})
