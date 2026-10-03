import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
test.use({ channel: 'chromium' })
test.beforeEach(async ({ context, page }) => {
  if (process.env.ICU_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ICU_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/icu-hemodynamics/learn`)
      .catch((e: unknown) => {
        throw new Error(String(e).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
})
async function task(page: Page, activity: string, prefix: string) {
  await page.goto(`/en/icu-hemodynamics/learn?activity=${activity}`)
  await page.locator('[data-lesson-shell]').waitFor()
  await page.getByText('Tasks in this section · open any task', { exact: true }).click()
  await page.getByRole('button', { name: new RegExp('^' + prefix) }).click()
}
for (const condition of [
  { width: 1204, height: 987, root: 100 },
  { width: 1440, height: 900, root: 100 },
  { width: 1024, height: 768, root: 100 },
  { width: 390, height: 844, root: 100 },
  { width: 320, height: 740, root: 100 },
  { width: 1204, height: 987, root: 200 },
  { width: 320, height: 740, root: 200 },
]) {
  test(`comparisons and enlarged callouts at ${condition.width} / ${condition.root}% root`, async ({
    page,
  }) => {
    await page.setViewportSize(condition)
    await task(page, 'waveform-interpretation', '2. RV and PA')
    await page.evaluate((r) => (document.documentElement.style.fontSize = r + '%'), condition.root)
    const figures = page.locator('figure[class*="atlasFigure"]')
    await expect(figures).toHaveCount(2)
    await expect
      .poll(async () =>
        figures
          .locator('svg')
          .evaluateAll((es) =>
            es.every(
              (e) =>
                Math.abs(
                  e.getBoundingClientRect().width - (e as SVGSVGElement).viewBox.baseVal.width,
                ) < 2,
            ),
          ),
      )
      .toBe(true)
    const rectangles = await figures
      .locator('svg')
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()))
    if (condition.width >= 1024 && condition.root === 100)
      expect(Math.abs(rectangles[0].top - rectangles[1].top)).toBeLessThan(2)
    for (const figure of await figures.all()) {
      await expect(figure.getByText('Pressure axis 0–40 mmHg', { exact: false })).toBeVisible()
      const geometry = await figure.locator('svg').evaluate((svg) => ({
        width: svg.getBoundingClientRect().width,
        viewWidth: (svg as SVGSVGElement).viewBox.baseVal.width,
        labels: [...svg.querySelectorAll('[data-annotation-label] text')].map((t) => ({
          text: t.textContent,
          font: parseFloat(getComputedStyle(t).fontSize),
          y: Number(t.getAttribute('y')),
        })),
        points: [...svg.querySelectorAll('[data-annotation-label] circle')].map((p) =>
          Number(p.getAttribute('cy')),
        ),
      }))
      expect(Math.abs(geometry.width - geometry.viewWidth)).toBeLessThan(2)
      for (const label of geometry.labels) {
        expect(label.text).toMatch(/^\d+$/)
        expect(label.y).toBeGreaterThan(192)
        expect(label.font).toBeGreaterThanOrEqual(condition.root === 200 ? 25 : 12)
      }
      expect(geometry.points.every((y) => y >= 66 && y <= 192)).toBe(true)
    }
    expect(
      await page.locator('[data-lesson-shell]').evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1)
    if (condition.width < 1024 || condition.root === 100)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
    await page.screenshot({ path: test.info().outputPath('rv-pa.png'), fullPage: true })
    await task(page, 'pressure-system', '5. Three dynamic')
    await page.evaluate((r) => (document.documentElement.style.fontSize = r + '%'), condition.root)
    const flush = page.locator('[data-comparison="dynamic-response"] figure')
    await expect(flush).toHaveCount(3)
    const before = await flush
      .locator('path[class*="flushTrace"]')
      .evaluateAll((ps) => ps.map((p) => (p.getAttribute('d')!.match(/L /g) || []).length))
    const zoom = page.getByRole('button', { name: /^View (release detail|complete traces)$/ })
    await zoom.focus()
    await page.keyboard.press('Enter')
    await expect(zoom).toHaveAttribute('aria-pressed', 'true')
    expect(
      await flush
        .locator('path[class*="flushTrace"]')
        .evaluateAll((ps) => ps.map((p) => (p.getAttribute('d')!.match(/L /g) || []).length)),
    ).toEqual(before)
    await expect(page.locator('[data-flush-view="release"]')).toHaveCount(3)
    for (const figure of await flush.all()) {
      const labels = await figure
        .locator('svg')
        .evaluate((svg) =>
          [...svg.querySelectorAll('text')]
            .filter((text) => text.textContent?.endsWith(' s'))
            .map((text) => text.getBoundingClientRect().toJSON()),
        )
      for (let index = 1; index < labels.length; index++)
        expect(labels[index - 1].right).toBeLessThanOrEqual(labels[index].left)
      await expect(figure.getByText(/Release detail.*same retained samples/)).toBeVisible()
    }
    expect(
      await page.locator('[data-lesson-shell]').evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1)
    if (condition.width < 1024 || condition.root === 100)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
    await page.screenshot({ path: test.info().outputPath('release.png'), fullPage: true })
  })
}
test('flush control, retained response and interpretation share a usable workbench; ART scale stays absent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await task(page, 'pressure-system', '8. Read the response')
  const flush = page.locator('#hemodynamics-control-flush')
  await flush.click()
  await expect(page.locator('[data-flush-classification]')).toBeVisible({ timeout: 10000 })
  const result = page.locator('[data-dock="flush"]')
  await result.scrollIntoViewIfNeeded()
  await expect(flush).toBeInViewport()
  await expect(result.locator('figure')).toBeInViewport()
  await expect(page.locator('[data-flush-classification]')).toBeInViewport()
  await expect(page.locator('#hemodynamics-control-scale')).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('flush-workbench.png') })
})
test('Practice observation return preserves intervention identity, a draft and one patient workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/icu-hemodynamics/practice?case=HD-01')
  await page.getByRole('button', { name: 'Orient to the patient and signals' }).click()
  await page.getByRole('button', { name: 'Go to the actions without recording a frame' }).click()
  const workspace = page.locator('[data-case-workspace]')
  await expect(workspace).toHaveCount(1)
  const trials = workspace.getByText('Cardiac-output trials', { exact: true })
  await trials.click()
  const volume = workspace.getByRole('combobox', { name: /^Volume/ })
  await volume.selectOption('15')
  const plr = page.getByRole('button', { name: /PLR/ })
  await plr.click()
  await expect(plr).toBeDisabled()
  await page.getByRole('button', { name: 'Observe the modeled response', exact: true }).click()
  await page.getByRole('button', { name: 'Return to actions and measurement tools' }).click()
  await expect(plr).toBeDisabled()
  await expect(volume).toHaveValue('15')
  await expect(workspace).toHaveCount(1)
  await expect(page.locator('main')).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath('practice-return.png'), fullPage: true })
})

test('frozen RA inspection reports retained time separately and keyboard zoom keeps it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1204, height: 987 })
  await task(page, 'catheter-advancement', '3. Advance')
  const freeze = page.getByRole('button', { name: 'Freeze trace', exact: true })
  await freeze.focus()
  await page.keyboard.press('Enter')
  const status = page.locator('[data-trace-inspection]')
  await expect(status).toContainText('Frozen trace')
  const frozen = (await status.textContent())!.match(/latest retained sample ([\d.]+) s/)![1]
  const zoom = page.getByRole('button', { name: /^View (one retained beat|full sweep)$/ })
  await zoom.focus()
  await page.keyboard.press('Space')
  await expect(zoom).toHaveAttribute('aria-pressed', 'true')
  await expect(status).toContainText('readouts still use the full retained sweep')
  await expect
    .poll(async () => Number((await status.textContent())!.match(/model time ([\d.]+) s/)![1]))
    .toBeGreaterThan(Number(frozen))
  expect((await status.textContent())!.match(/latest retained sample ([\d.]+) s/)![1]).toBe(frozen)
  await page.screenshot({ path: test.info().outputPath('frozen-one-beat.png'), fullPage: true })
})

test('all changed phone workbench surfaces contain 200% root text, including open Sources', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  for (const [activity, prefix] of [
    ['pressure-system', '2. Leveling'],
    ['pressure-system', '8. Read the response'],
    ['waveform-components', '3. When the atrial'],
    ['waveform-components', '5. Interpret'],
    ['catheter-advancement', '3. Advance'],
  ]) {
    await task(page, activity, prefix)
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
    if (prefix === '8. Read the response') {
      await page.locator('#hemodynamics-control-flush').click()
      await expect(page.getByText('How did it settle?')).toBeVisible()
    }
    if (prefix === '5. Interpret') {
      await page.locator('[data-stage-sources] summary').focus()
      await page.keyboard.press('Enter')
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1)
    await page.screenshot({
      path: test.info().outputPath(activity + '-' + prefix[0] + '.png'),
      fullPage: true,
    })
  }
})
