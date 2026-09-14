import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Use the full Chromium headless browser, also used for actual tab-zoom verification.
test.use({ channel: 'chromium' })

test.beforeEach(async ({ context, page }) => {
  // Optional ephemeral localhost auth for an isolated dev server; never seed lesson progress.
  if (process.env.ICU_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ICU_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/icu-hemodynamics`, {
        timeout: 30_000,
      })
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function panel(page: Page, name: 'Steps' | 'Teaching' | 'Simulator') {
  const tabs = page.getByRole('tablist', { name: 'Workspace panel views' })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name, exact: true }).click()
}

async function primary(page: Page) {
  await panel(page, 'Steps')
  await page.locator('[data-now-card] [data-now-primary]').click()
}

async function openSection(page: Page, id: string) {
  await page.goto(`/en/icu-hemodynamics/learn?activity=${id}`)
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', `${id}-1-recognize`)
}

async function reachPrediction(page: Page) {
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('[data-stage]').getAttribute('data-stage'))?.endsWith('-predict'))
      return
    await primary(page)
  }
  throw new Error('Did not reach the prediction through the lesson controls')
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}

async function expectReadableText(locator: Locator) {
  const contrast = await locator.evaluate((element) => {
    const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number)
    const luminance = (rgb: number[]) =>
      rgb.slice(0, 3).reduce((sum, channel, index) => {
        const value = channel / 255
        return (
          sum +
          [0.2126, 0.7152, 0.0722][index] *
            (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        )
      }, 0)
    let ancestor: Element | null = element
    let background = [255, 255, 255]
    while (ancestor) {
      const candidate = channels(getComputedStyle(ancestor).backgroundColor)
      if (candidate.length === 3 || candidate[3] === 1) {
        background = candidate
        break
      }
      ancestor = ancestor.parentElement
    }
    const foreground = luminance(channels(getComputedStyle(element).color))
    const backdrop = luminance(background)
    return (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`teaching, visual question and map submission at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openSection(page, 'why-measure')
    await panel(page, 'Teaching')
    await expect(
      page.getByRole('heading', { name: 'Measurements and their origins' }),
    ).toBeVisible()
    await capture(page, `orientation-${viewport.width}`)
    await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
    await openSection(page, 'waveform-interpretation')
    await panel(page, 'Teaching')
    await expect(
      page.getByRole('heading', { name: 'Normal waveform reference · current walk stop' }),
    ).toBeVisible()
    await capture(page, `normal-reference-${viewport.width}`)
    await reachPrediction(page)
    await panel(page, 'Simulator')
    await expect(page.locator('[data-catheter-map]')).toHaveAttribute('data-tip', 'withheld')
    await expect(page.locator('[data-map-emphasis-target]')).toHaveCount(0)
    const answer = page.locator('[data-catheter-map-answer]')
    // The map uses a visually hidden radio with a full-size clickable answer row.
    await answer.getByText('The pulmonary artery', { exact: true }).click()
    await expect(answer.getByRole('radio', { name: /The pulmonary artery$/ })).toBeChecked()
    await capture(page, `map-question-${viewport.width}`)
    await primary(page)
    await expect(page.locator('[data-now-card] [data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'partly-correct',
    )
    await capture(page, `wrong-answer-${viewport.width}`)
    await primary(page)
    await panel(page, 'Simulator')
    await expect(page.getByRole('heading', { name: 'Name the tracing' })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Vendor-neutral simulated ICU bedside monitor' }),
    ).toHaveCount(0)
    await expect(page.locator('[data-catheter-map]')).toHaveCount(0)
    await expect(page.getByText(/0 of 5 correct · 0 attempted/)).toBeVisible()
    await expectReadableText(
      page.getByRole('radio', { name: 'Right atrium / CVP', exact: true }).locator('..'),
    )
    await capture(page, `focused-recognition-${viewport.width}`)
  })
}

test('pressure demonstrations, correction, fresh observation and before/after snapshots', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openSection(page, 'pressure-system')
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-current-teaching]')).toHaveAttribute(
    'data-current-teaching',
    'level',
  )
  await page.locator('#hemodynamics-control-level').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-level-readout]')).toHaveText('+1 cm')
  await capture(page, 'leveling-keyboard')
  await primary(page)
  await expect(page.locator('[data-current-teaching]')).toHaveAttribute(
    'data-current-teaching',
    'zero',
  )
  await page.getByRole('button', { name: 'Open to air and zero', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Zeroed', exact: true })).toBeDisabled()
  await primary(page)
  await page.locator('#hemodynamics-control-scale').selectOption('240')
  await capture(page, 'arterial-scale')
  await primary(page)
  await expect(page.getByRole('heading', { name: 'Reference flush responses' })).toBeVisible()
  await capture(page, 'dynamic-response-teaching')
  await primary(page)
  await page
    .locator('[data-prediction-choices]')
    .getByRole('radio', { name: /off level, not zeroed, and underdamped/ })
    .check()
  await primary(page)
  await primary(page)
  await page.getByRole('button', { name: 'What do I do now?', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Show me where', exact: true }).click()
  await expect(page.locator('#hemodynamics-control-level')).toBeFocused()
  await page.locator('#hemodynamics-control-level').fill('0')
  await page.locator('#hemodynamics-control-zero').click()
  await primary(page)
  await page.locator('#hemodynamics-control-flush').click()
  await page.locator('[data-flush-classification] input[value="underdamped"]').check()
  await page.getByRole('button', { name: 'Say what it is', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apply the simulated line correction', exact: true })
    .click()
  await expect(page.locator('[data-step-goals] li').last()).toHaveAttribute('data-met', 'false')
  await expect(page.locator('[data-flush-stale]')).toBeVisible()
  await capture(page, 'correction-awaiting-new-observation')
  await page.locator('#hemodynamics-control-flush').click()
  await page.locator('[data-flush-classification] input[value="acceptable"]').check()
  await page.getByRole('button', { name: 'Say what it is', exact: true }).click()
  await primary(page)
  await expect(page.locator('[data-before-after] tbody tr')).toHaveCount(4)
  await page.locator('[data-before-after]').scrollIntoViewIfNeeded()
  await capture(page, 'pressure-before-after')
})

test('normal components, assisted retry, independent example, abnormal question and reload history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSection(page, 'waveform-components')
  await expect(page.getByRole('heading', { name: 'Normal atrial components' })).toBeVisible()
  await capture(page, 'component-demonstration')
  await primary(page)
  for (const [mode, answers] of [
    ['guided', [1, 2, 3, 4, 5]],
    ['independent', [2, 4, 5, 1, 3]],
  ] as const) {
    const activity = page.locator(`[data-component-activity="${mode}"]`)
    await expect(activity).toBeVisible()
    if (mode === 'guided') {
      await activity.getByRole('radio', { name: /^Region 2/ }).check()
      await activity.getByRole('button', { name: 'Check component', exact: true }).click()
      await expect(activity.getByText('Compare the timing.', { exact: true })).toBeVisible()
      await activity.getByRole('button', { name: 'Retry with feedback', exact: true }).click()
    }
    for (const [i, answer] of answers.entries()) {
      await activity.getByRole('radio', { name: new RegExp(`^Region ${answer} ·`) }).check()
      await activity.getByRole('button', { name: 'Check component', exact: true }).click()
      if (i < 4) await activity.getByRole('button', { name: 'Next component', exact: true }).click()
    }
    await capture(page, `${mode}-component-results`)
    await primary(page)
  }
  await expect(
    page.getByRole('heading', { name: 'Contrasting abnormal atrial patterns' }),
  ).toBeVisible()
  await capture(page, 'abnormal-teaching')
  await primary(page)
  await expect(page.locator('[data-now-card] figcaption')).toContainText(
    'Right-atrial question trace',
  )
  await page
    .locator('[data-prediction-choices]')
    .getByRole('radio', { name: /Pericardial constraint/ })
    .check()
  await primary(page)
  await expect(page.locator('[data-now-card] figcaption')).toContainText('Tricuspid regurgitation')
  await capture(page, 'abnormal-question-feedback')
  await primary(page)
  await primary(page)
  await page
    .locator('[data-prediction-choices]')
    .getByRole('radio', { name: /Fluid under tension/ })
    .check()
  await primary(page)
  await primary(page)
  await primary(page)
  await expect(
    page.getByRole('heading', { name: 'Section worked through', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    'waveform-components-1-recognize',
  )
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('icu-hemodynamics-learn-v1') || '{}').completedSectionIds,
    ),
  ).toContain('waveform-components')
})

test('procedural prebriefs remain accessible with the 3D asset unavailable', async ({ page }) => {
  await page.route('**/*.glb', (route) => route.abort())
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const id of ['catheter-advancement', 'pawp-capture']) {
    await openSection(page, id)
    await expect(
      page.locator(
        id === 'catheter-advancement'
          ? '[data-teaching-block="stop-conditions"]'
          : '[data-teaching-block="wedge-sequence"]',
      ),
    ).toBeVisible()
    await capture(page, `${id}-prebrief-no-3d`)
    await primary(page)
    await expect(page.locator('[data-prediction-choices]')).toBeVisible()
  }
})

test('200 percent zoom equivalent retains a coherent keyboard component task', async ({ page }) => {
  // 1440×900 at 200% browser zoom exposes approximately 720×450 CSS pixels.
  await page.setViewportSize({ width: 720, height: 450 })
  await openSection(page, 'waveform-components')
  await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
  await page.locator('[data-now-primary]').focus()
  await expect(page.locator('[data-now-primary]')).toBeFocused()
  await capture(page, 'zoom-equivalent-keyboard')
  await primary(page)
  await panel(page, 'Simulator')
  const activity = page.locator('[data-component-activity]')
  await activity.getByRole('radio', { name: /^Region 1/ }).focus()
  await page.keyboard.press('Space')
  await activity.getByRole('button', { name: 'Check component', exact: true }).click()
  await expect(activity.getByText('Component identified.', { exact: true })).toBeVisible()
  await capture(page, 'zoom-equivalent-component-feedback')
})
