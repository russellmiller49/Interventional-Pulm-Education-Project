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

async function continueStep(page: Page) {
  const prior = await page.locator('[data-mcs-task-flow]').getAttribute('data-stage')
  await page.locator('[data-step-bar-continue]').click()
  await expect(page.locator('[data-mcs-task-flow]')).not.toHaveAttribute('data-stage', prior!)
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
    await page.locator('[data-run-details] summary').click()
    await expect(page.locator('[data-run-details] p')).toContainText(/Example number \d+/)
    await expect(page.locator('[data-run-details] p')).toContainText('not a clinical value')
    await capture(page, 'clinical-perfusion-and-identity')
    await reach(page, '[data-task-readings]')
    await expect(page.locator('[data-task-readings]')).toContainText(
      'bedside evaluation; they are not simulated.',
    )
    await reach(page, '[data-causal-ladder-summary]')
    await page
      .getByText('Reading the result: pressure, flow, oxygen delivery, patient response', {
        exact: true,
      })
      .click()
    await expect(page.locator('[data-causal-ladder-summary]')).toContainText(
      'require clinical evaluation; these responses are not simulated.',
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
    await page.getByText('Captured configurations and patient identity', { exact: true }).click()
    for (const id of ['iabp', 'impella', 'lvad']) {
      await expect(page.locator(`[data-comparison-device="${id}"] small`)).toContainText(
        /Example number \d+ · captured at/,
      )
      await expect(page.locator(`[data-comparison-device="${id}"] small`)).toContainText(
        'observation 8 s · patient',
      )
    }
    await capture(page, 'captured-identities')
    await openLesson(page, 'impella-unloading-placement')
    await reach(page, '[data-unloading-comparison]')
    for (const card of await page.locator('[data-unloading-condition]').all()) {
      await card.getByText('Starting state and model assumptions', { exact: true }).click()
      await expect(card.getByText(/Example number 417/)).toBeVisible()
      await expect(card.getByText(/eight simulated seconds of observation/)).toBeVisible()
    }
    await capture(page, 'provided-example-identities')
  })
}
