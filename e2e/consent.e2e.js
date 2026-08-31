/* The cookie banner. Consent is the one decision the app has to keep across a
 * reload, and the one place where a wrong answer means data leaving the browser —
 * so it is checked in a real browser, against real localStorage, with the network
 * watched.
 *
 * `consent: null` opts out of the fixture that pre-decides for every other spec. */

import { test, expect, CONSENT_KEY } from './fixtures/app.js'

test.use({ consent: null })

const banner = (page) => page.getByRole('region', { name: 'Cookie consent' })

const storedConsent = (page) =>
  page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)

test.describe('cookie consent', () => {
  test('an undecided visitor is asked, and nothing has been sent yet', async ({ page, externalRequests }) => {
    await page.goto('/')

    await expect(banner(page)).toBeVisible()
    await expect(banner(page)).toContainText('PLACER uses PostHog')
    expect(await storedConsent(page)).toBeNull()
    // PostHog is not loaded until the choice is made — see src/analytics.js.
    expect(externalRequests.filter((url) => url.includes('posthog'))).toEqual([])
  })

  test('accepting records the choice and the banner stays away after a reload', async ({ page }) => {
    await page.goto('/')

    await banner(page).getByRole('button', { name: 'Accept' }).click()

    await expect(banner(page)).toBeHidden()
    expect(await storedConsent(page)).toBe('granted')

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Reimagine Your City' })).toBeVisible()
    await expect(banner(page)).toBeHidden()
  })

  test('rejecting records the choice and does not ask again', async ({ page }) => {
    await page.goto('/')

    await banner(page).getByRole('button', { name: 'Reject' }).click()

    await expect(banner(page)).toBeHidden()
    expect(await storedConsent(page)).toBe('denied')

    await page.reload()
    await expect(banner(page)).toBeHidden()
  })

  test('the banner links to the privacy policy without deciding anything', async ({ page }) => {
    await page.goto('/')

    await banner(page).getByRole('link', { name: 'Privacy Policy' }).click()

    await expect(page).toHaveURL(/\/privacy$/)
    // Reading the policy is not a decision, so the ask is still up and nothing has
    // been recorded either way.
    await expect(banner(page)).toBeVisible()
    expect(await storedConsent(page)).toBeNull()

    // Known limitation, not an assertion of intent: the click writes the URL but
    // leaves the view on the welcome screen, because Switch reconciles the two
    // MainApp routes as one instance and `initialView` only applies on first mount
    // — the trade-off App.jsx documents. Loading that URL does show the policy.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible()
    await expect(banner(page)).toBeVisible()
  })
})
