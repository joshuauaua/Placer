/* The whole point of the app: capture a view, draw on it, describe it, post it.
 *
 * `googleMaps: true` puts a stub of the Maps JS API in place of Google's script
 * (see e2e/fixtures/app.js), which is what makes this runnable with no API key and
 * no network. Its panorama reports itself hidden, so the capture goes down
 * MapContainer's html-to-image branch and the frame is produced in the browser.
 *
 * The Konva export in StreetScreen.handleNext and the localStorage round trip in
 * services/api.js are the two things here that jsdom cannot do at all, and they are
 * both on this path. */

import { test, expect, IMAGINATIONS_KEY } from './fixtures/app.js'

// Tall enough for the whole 1000x700 stage: the canvas is centred in its panel, so
// in a short viewport it overflows under the toolbar and a drag aimed at its top
// half lands on the toolbar instead.
test.use({ googleMaps: true, viewport: { width: 1440, height: 1000 } })

const TITLE = 'Pocket park on the old Lot 7 parking'
const BLURB = 'Five parking bays nobody uses, turned into somewhere to sit in the shade.'

test.describe('making an imagination', () => {
  test('capture, draw, describe and post', async ({ page }) => {
    await page.goto('/')

    // 1 — the map, opened from the welcome screen.
    await page.getByRole('button', { name: 'Start imagining' }).click()
    const capture = page.getByRole('button', { name: 'Capture view' })
    await expect(capture).toBeVisible()

    // 2 — capture. The button reports itself busy while the frame is produced, and
    // the step only changes once the capture resolves.
    await capture.click()
    await expect(page.getByRole('button', { name: 'Next: Describe' })).toBeVisible({ timeout: 30_000 })

    // 3 — draw a line on the canvas. Both buttons start disabled with nothing on
    // the stage, so they are how we know the line landed.
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeDisabled()
    await page.getByRole('button', { name: /^draw$/i }).click()

    const stage = page.locator('canvas').first()
    const box = await stage.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, { steps: 12 })
    await page.mouse.up()

    await expect(page.getByRole('button', { name: 'Clear All' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeEnabled()

    // 4 — describe it. "Next: Post" stays disabled until all three fields are in.
    await page.getByRole('button', { name: 'Next: Describe' }).click()
    await expect(page.getByRole('heading', { name: 'Describe your imagination' })).toBeVisible()
    // The canvas was exported and is being shown back.
    await expect(page.getByRole('img', { name: 'Your imagination' })).toBeVisible()

    const next = page.getByRole('button', { name: 'Next: Post' })
    await expect(next).toBeDisabled()
    await page.locator('#imagination-title').fill(TITLE)
    await page.getByRole('button', { name: 'Green space' }).click()
    await page.locator('#imagination-blurb').fill(BLURB)
    await expect(next).toBeEnabled()

    // 5 — post it.
    await next.click()
    await expect(page.getByRole('heading', { name: 'Ready to post' })).toBeVisible()
    await expect(page.getByText(TITLE)).toBeVisible()
    await page.getByRole('button', { name: 'Post to community' }).click()

    // 6 — back on the map, with the imagination saved.
    await expect(page.getByRole('button', { name: 'Capture view' })).toBeVisible()

    const saved = await page.evaluate(
      (key) => JSON.parse(window.localStorage.getItem(key) ?? '[]'),
      IMAGINATIONS_KEY,
    )
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ title: TITLE, blurb: BLURB, cat: 'green' })
    expect(saved[0].position).toEqual(expect.objectContaining({
      lat: expect.any(Number),
      lng: expect.any(Number),
    }))
  })

  test('the description step can be left and come back to without losing the drawing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start imagining' }).click()
    await page.getByRole('button', { name: 'Capture view' }).click()
    await expect(page.getByRole('button', { name: 'Next: Describe' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^draw$/i }).click()
    const box = await page.locator('canvas').first().boundingBox()
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 12 })
    await page.mouse.up()
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeEnabled()

    await page.getByRole('button', { name: 'Next: Describe' }).click()
    await page.locator('#imagination-title').fill(TITLE)
    await page.getByRole('button', { name: 'Back to canvas' }).click()

    // The line survived, because App holds it rather than StreetScreen.
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeEnabled()

    // And so did the title.
    await page.getByRole('button', { name: 'Next: Describe' }).click()
    await expect(page.locator('#imagination-title')).toHaveValue(TITLE)
  })
})
