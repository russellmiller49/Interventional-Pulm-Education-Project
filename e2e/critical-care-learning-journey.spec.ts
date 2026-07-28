import { expect, test } from '@playwright/test'

test.setTimeout(120_000)

test('moves from concept context through a safety interrupt and teaching debrief', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('critical-care-assumed-concepts-hidden-v1')
    window.localStorage.removeItem('critical-care-assumed-concepts-dismissed-v1')
  })

  // Compile both ends of the journey before client-side navigation. Next's dev
  // server can otherwise reload during its first route compilation and reset the
  // zero-delay device suitability check before it commits.
  const activityWarmup = await page.request.get('/en/icu-hemodynamics/assess?start=1')
  expect(activityWarmup.ok()).toBe(true)

  await page.goto('/en/critical-care/concepts/cc.measurement.signal-validity')
  await expect(
    page.getByRole('heading', { name: 'Signal validity before interpretation' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Where this shows up' })).toBeVisible()

  await page.locator('a[href*="/icu-hemodynamics/assess?start=1"]').first().click()
  await expect(page.getByRole('heading', { name: 'Checking this display' })).toBeHidden({
    timeout: 60_000,
  })
  await expect(
    page.getByRole('heading', { name: 'Pressure equalization with a falling pulse pressure' }),
  ).toBeVisible({ timeout: 60_000 })

  const refresher = page.getByRole('button', { name: /Signal validity before interpretation/i })
  await expect(refresher).toBeVisible()
  await refresher.click()
  await expect(refresher).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText(/A precise display can still represent a poor signal/i)).toBeVisible()
  await refresher.click()
  await expect(refresher).toHaveAttribute('aria-expanded', 'false')

  await page.getByText('Case workflow', { exact: true }).click()
  await page.getByRole('button', { name: 'Orient to the patient and signals' }).click()
  await page.getByLabel('Suspected mechanism').selectOption({ index: 1 })
  await page.getByLabel('Immediate priority').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Commit mechanism and priority' }).click()

  await page.getByRole('button', { name: /PEEP ↑/ }).click()
  await expect(page.getByText('Action paused for safety')).toBeVisible()
  await expect(page.getByText(/Stopping here—in a real patient/i)).toBeVisible()
  await page.getByRole('button', { name: 'Rewind to before this action' }).click()

  await page.getByRole('button', { name: /Drainage pathway/ }).click()
  await page.getByRole('button', { name: 'Observe the modeled response' }).click()
  await page.getByRole('button', { name: 'Commit final reassessment' }).click()

  await expect(
    page.getByRole('heading', {
      name: /Before we look at what happened—what did you think was going on/i,
    }),
  ).toBeVisible()
  await page
    .getByLabel('My working frame')
    .fill('Pericardial constraint was limiting filling and forward flow.')
  await page.getByRole('button', { name: 'Capture this frame and reveal the trace' }).click()

  await expect(page.getByRole('heading', { name: '1. Decision trace' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2. Expert reasoning contrast' })).toBeVisible()
  await page.getByRole('radio', { name: 'Which cue I trusted' }).click()
  await expect(
    page.getByRole('heading', { name: '5. Concepts for this divergence point' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: '5. Concepts for this divergence point' })
      .getByRole('link', { name: 'Transmural pressure' }),
  ).toBeVisible()
})
