import { expect, test, type Page } from '@playwright/test'

const MCS = '/en/mechanical-circulatory-support'
const APPROVED_STEM =
  'A continuous-flow LVAD patient develops low flow with rising and converging filling pressures after a bedside procedure; pump speed is unchanged and the power path remains connected.'

async function openLesson(page: Page, lesson: string) {
  await page.goto(`${MCS}/learn?lesson=${lesson}`)
  await page.waitForSelector('[data-now-card], [data-prerequisite-reference]')
  for (let i = 0; i < 6; i++) {
    const next = page.locator('[data-prerequisite-reference] button', {
      hasText: /Next reference|Begin the patient example|Continue/,
    })
    if (!(await next.count())) break
    await next.first().click()
  }
  await expect(page.locator('[data-now-card]')).toBeVisible()
}

/** The task card's one way on: Next stop on the walk (same task, next stop), Continue elsewhere. */
async function continueStep(page: Page) {
  const where = () =>
    page.evaluate(
      () =>
        `${document.querySelector('[data-mcs-task-flow]')?.getAttribute('data-stage')} | ${
          document.querySelector('[data-now-card] h2')?.textContent
        }`,
    )
  const prior = await where()
  await page.locator('[data-now-primary]').click()
  await expect.poll(where).not.toBe(prior)
}

async function reach(page: Page, selector: string) {
  for (let i = 0; i < 30; i++) {
    if (await page.locator(selector).count()) return
    await continueStep(page)
  }
  throw new Error(`Did not reach ${selector}`)
}

async function capture(page: Page, name: string) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true })
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/analytics**', (route) => route.fulfill({ status: 204 }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const size of [
  { width: 1280, height: 800 },
  { width: 1707, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`approved CAP stem, hub and Learn wording (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto(MCS)
    await expect(page.getByText(/then integration with patient evaluation/)).toBeVisible()
    await capture(page, 'hub')
    await page.goto(`${MCS}/learn`)
    await expect(page.getByText(/evaluation of the supported patient/)).toBeVisible()
    await capture(page, 'learn')
    await page.goto(`${MCS}/assess?case=CAP-LVAD-01`)
    await expect(page.locator('[data-case-identity]')).toContainText(APPROVED_STEM)
    await expect(page.locator('[data-case-identity]')).not.toContainText(
      'speed and power are unchanged',
    )
    await expect(page.getByText('Approved power path', { exact: true })).toBeVisible()
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()
    await expect(page.locator('[data-monitor-target="monitor:power-pulsatility"]')).toContainText(
      'POWER / PI',
    )
    await expect(
      page.getByRole('radio', { name: 'Pericardial constraint limits biventricular filling' }),
    ).toBeVisible()
    await capture(page, 'cap-lvad-01')
  })

  test(`clinical evaluation copy and run identifier (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'mcs-foundations-signals')
    await expect(page.getByText('Clinical perfusion evaluation', { exact: true })).toBeVisible()
    // The run is identified by the one clock at the head of the simulator (it replaced the run
    // details): whether the circulation runs and its simulated time, with no seed or example number.
    const clock = page.locator('[data-flow-visual] [data-clock-bar]')
    await expect(clock).toHaveAttribute('data-clock-state', 'paused')
    await expect(clock.locator('[data-clock-time]')).toHaveText(/^Paused at \d+\.\d s$/)
    await expect(clock).not.toContainText(/Example number|seed/i)
    await capture(page, 'clinical-perfusion-and-identity')
    await reach(page, '[data-task-readings]')
    await reach(page, '[data-causal-ladder-summary]')
    await page
      .getByText('Reading the result: pressure, flow, oxygen delivery, patient response', {
        exact: true,
      })
      .click()
    // Patient response is clinical evaluation: taught as what is read at the bedside.
    await expect(page.locator('[data-causal-ladder-summary]')).toContainText(
      'Mentation, urine output, skin findings and the lactate trend are read at the bedside.',
    )
    await capture(page, 'clinical-boundaries')
    await openLesson(page, 'lvad-parameters-assessment')
    await page.getByRole('button', { name: 'Patient assessment', exact: true }).click()
    await expect(page.getByText('Separate patient evaluation', { exact: true })).toBeVisible()
    await capture(page, 'separate-patient-evaluation')
  })

  test(`captured and provided examples retain their identifiers (${size.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'mcs-foundations-mechanisms')
    for (let i = 0; i < 20; i++) {
      if (await page.locator('[data-now-card] [data-mcs-control="control:select-iabp"]').count())
        break
      await continueStep(page)
    }
    for (const id of ['control:select-iabp', 'control:select-impella', 'control:select-lvad']) {
      await page.locator(`[data-now-card] [data-mcs-control="${id}"]`).first().click()
      await expect(page.locator(`[data-now-card] [data-mcs-control="${id}"]`).first()).toBeEnabled()
    }
    await reach(page, '[data-retained-comparison]')
    await page.getByText('Settings for each run', { exact: true }).click()
    for (const id of ['iabp', 'impella', 'lvad']) {
      await expect(page.locator(`[data-comparison-device="${id}"] small`)).toContainText(
        /Started at \d+\.\d\d s/,
      )
      await expect(page.locator(`[data-comparison-device="${id}"] small`)).toContainText(
        'read 8 s later · same patient',
      )
    }
    await capture(page, 'captured-identities')
    await openLesson(page, 'impella-unloading-placement')
    await reach(page, '[data-unloading-comparison]')
    for (const card of await page.locator('[data-unloading-condition]').all()) {
      await card.getByText('Starting state', { exact: true }).click()
      await expect(card.getByText(/eight simulated seconds of observation/)).toBeVisible()
    }
    await capture(page, 'provided-example-identities')
  })
}
