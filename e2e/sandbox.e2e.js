/* The Sandbox — the one part of the app whose state is the URL, so it is the part
 * most worth driving in a real browser. Every experiment has to open from a tile,
 * survive a cold load of its own link, and go back. */

import { test, expect } from './fixtures/app.js'

// Mirrors src/sandbox/experiments.js. Kept as a literal rather than imported so
// that renaming an experiment has to be a deliberate change here too.
const EXPERIMENTS = [
  { id: 'street-mixer', name: 'Street Section Mixer' },
  { id: 'desire-lines', name: 'Desire Lines' },
  { id: 'fifteen-minute', name: '15-Minute Reach' },
  { id: 'budget-ballot', name: 'Budget Ballot' },
]

test.describe('sandbox', () => {
  test('the gallery lists every experiment', async ({ page }) => {
    await page.goto('/sandbox')

    await expect(page.getByRole('heading', { name: 'Sandbox', level: 1 })).toBeVisible()
    for (const { name } of EXPERIMENTS) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
    }
  })

  for (const { id, name } of EXPERIMENTS) {
    test(`${name} opens from its tile and writes /sandbox/${id}`, async ({ page }) => {
      await page.goto('/sandbox')

      await page.getByRole('button', { name: new RegExp(name) }).click()

      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/sandbox/${id}$`))

      // And back out again, to the gallery rather than the welcome screen.
      await page.getByRole('button', { name: 'All experiments' }).click()
      await expect(page.getByRole('heading', { name: 'Sandbox', level: 1 })).toBeVisible()
      await expect(page).toHaveURL(/\/sandbox$/)
    })

    test(`/sandbox/${id} renders ${name} on a cold load`, async ({ page }) => {
      await page.goto(`/sandbox/${id}`)

      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
      // The shareable link the experiment offers is the one that was just loaded.
      await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
    })
  }

  test('an unknown experiment id says so and still shows the gallery', async ({ page }) => {
    await page.goto('/sandbox/not-an-experiment')

    await expect(page.getByRole('status')).toContainText('There is no experiment called')
    await expect(page.getByRole('status')).toContainText('not-an-experiment')
    await expect(page.getByRole('button', { name: /Street Section Mixer/ })).toBeVisible()
  })

  test('the Street Section Mixer reallocates the street when something is added', async ({ page }) => {
    await page.goto('/sandbox/street-mixer')

    // The default preset fills the full 20 m, so adding a cycle track has to come
    // out of what is already there rather than making the street wider.
    await expect(page.getByRole('slider', { name: 'Street width' })).toHaveValue('20')
    await expect(page.getByRole('button', { name: 'Widen Cycle track' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Cycle track', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Widen Cycle track' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Street width' })).toHaveValue('20')
  })
})
