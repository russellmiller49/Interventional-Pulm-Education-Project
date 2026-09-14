/** Task layouts, keyboard flow, device semantics and existing launch gates. Public browser UI. */
import { chromium, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3161'
const output = path.resolve(process.env.MV_REVIEW_OUTPUT ?? 'artifacts/mv-targeted')
await mkdir(output, { recursive: true })
const browser = await chromium.launch(),
  results = []
const units = [
  'breathing-with-support',
  'waveform-anatomy',
  'controls-and-goals',
  'mechanics-load-and-pressure',
  'modes-and-breath-delivery',
  'lung-protection',
  'expiration-and-air-trapping',
  'triggering-and-cycling',
  'oxygenation-response',
  'ventilation-and-co2',
  'waveform-reading-sequence',
  'dyssynchrony-mechanisms',
  'safety-reassessment-and-human-factors',
  'high-peak-pressure-integration',
]
const devices = ['hamilton-c6', 'drager-evita-v800-v600', 'puritan-bennett-980', 'carefusion-avea']
const nativeModes = {
  'hamilton-c6': ['Modes', 'PCV+'],
  'drager-evita-v800-v600': ['Other modes', 'PC-AC'],
  'puritan-bennett-980': ['Vent Setup', 'A/C + PC'],
  'carefusion-avea': ['MODE', 'Pressure A/C'],
}
const viewports = [
  [1440, 900],
  [1280, 800],
  [1280, 600],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 844],
]
async function newPage(width = 1280, height = 800) {
  return browser.newPage({
    ...(process.env.MV_REVIEW_STORAGE ? { storageState: process.env.MV_REVIEW_STORAGE } : {}),
    viewport: { width, height },
    reducedMotion: 'reduce',
  })
}
async function load(page, route) {
  const response = await page.goto(`${base}/en/mechanical-ventilation${route}`)
  expect(response.status()).toBe(200)
}
async function primary(page) {
  const button = page.locator('[data-now-primary]')
  await expect(button).toBeEnabled()
  await button.press('Enter')
}
async function prediction(page, unit) {
  if (unit === 'waveform-anatomy') for (let stop = 0; stop < 4; stop++) await primary(page)
  if (
    ['triggering-and-cycling', 'waveform-reading-sequence', 'dyssynchrony-mechanisms'].includes(
      unit,
    )
  ) {
    await primary(page)
    await page.locator('[data-location-choices]').getByRole('radio').first().check()
    await primary(page)
  }
  await primary(page)
}
async function axe(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  return page.evaluate(async () =>
    (
      await window.axe.run(
        document.querySelector('[data-stage-frame]') ??
          document.querySelector('[data-case-flow]') ??
          document.querySelector('main'),
      )
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  )
}
async function audit(page, unit, width, height, phase) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  const regions = await page
    .locator('[data-stage-frame] *')
    .evaluateAll((nodes) =>
      nodes
        .filter(
          (n) =>
            /auto|scroll/.test(getComputedStyle(n).overflowY) &&
            n.scrollHeight > n.clientHeight + 2 &&
            n.clientHeight > 0,
        )
        .map((n) => ({ tag: n.tagName, label: n.getAttribute('aria-label') })),
    )
  const violations = await axe(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: path.join(output, `${unit}-${phase}-${width}x${height}.png`),
    fullPage: true,
  })
  results.push({ type: 'layout', unit, phase, width, height, overflow, regions, violations })
  expect(overflow).toBeLessThanOrEqual(1)
  expect(regions).toEqual([])
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([])
}
try {
  for (const [width, height] of viewports)
    for (const unit of units) {
      if (process.env.MV_REVIEW_DEVICES_ONLY) continue
      if (
        process.env.MV_REVIEW_MAX_VIEWPORT_INDEX &&
        viewports.findIndex((v) => v[0] === width && v[1] === height) >
          Number(process.env.MV_REVIEW_MAX_VIEWPORT_INDEX)
      )
        continue
      if (
        process.env.MV_REVIEW_MIN_VIEWPORT_INDEX &&
        viewports.findIndex((v) => v[0] === width && v[1] === height) <
          Number(process.env.MV_REVIEW_MIN_VIEWPORT_INDEX)
      )
        continue
      const page = await newPage(width, height),
        errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await load(page, `/learn?activity=${unit}`)
      await expect(page.locator('[data-now-card]')).toBeVisible({ timeout: 60000 })
      await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
      await audit(page, unit, width, height, 'reference')
      if (unit === 'modes-and-breath-delivery') {
        const figure = page.locator('[data-idealized-comparison]')
        const axes = await figure.locator('svg text').allTextContents()
        const patient = await page.evaluate(() =>
          localStorage.getItem('mechanical-ventilation-live-learning-v1'),
        )
        await page
          .getByRole('combobox', { name: 'Illustration compliance', exact: true })
          .selectOption('0.5')
        await expect(figure.locator('[data-ideal-column="volumeTargeted"]')).toContainText(
          '400.0 mL',
        )
        await expect(figure.locator('[data-ideal-column="pressureTargeted"]')).not.toContainText(
          '400.0 mL',
        )
        expect(await figure.locator('svg text').allTextContents()).toEqual(axes)
        expect(
          await page.evaluate(() =>
            localStorage.getItem('mechanical-ventilation-live-learning-v1'),
          ),
        ).toBe(patient)
        const fontSizes = await figure
          .locator('svg text')
          .evaluateAll((nodes) =>
            nodes.map((n) => parseFloat(getComputedStyle(n).fontSize) * n.getScreenCTM().a),
          )
        expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(11.8)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: path.join(output, `vc-pc-shared-axes-${width}x${height}.png`),
          fullPage: true,
        })
        await page.getByRole('button', { name: 'Restore illustration reference' }).click()
      }

      await prediction(page, unit)
      const answer = page.locator('[data-prediction-choices]').getByRole('radio').first()
      await answer.check()
      await page.setViewportSize({ width: width === 320 ? 390 : width - 1, height })
      await expect(answer).toBeChecked()
      await page.setViewportSize({ width, height })
      await primary(page)
      await primary(page)
      await audit(page, unit, width, height, 'working')
      if (unit === 'breathing-with-support') {
        const cursor = page
          .locator('[data-now-card]')
          .getByRole('slider', { name: 'Captured breath time cursor' })
        await cursor.focus()
        await cursor.press('End')
        await cursor.press('ArrowLeft')
        await page.getByRole('button', { name: 'Use this captured interval' }).press('Enter')
        await expect(page.locator('[data-now-primary]')).toBeEnabled()
      }
      expect(errors).toEqual([])
      await page.close()
      console.log(
        `LAYOUT ${unit} ${width}x${height}: reference, working, keyboard; no document overflow`,
      )
    }
  for (const device of devices) {
    const page = await newPage()
    await load(page, '/learn?activity=controls-and-goals')
    await expect(page.locator('[data-now-card]')).toBeVisible()
    await prediction(page, 'controls-and-goals')
    await page.getByText('Console and experiment options', { exact: true }).click()
    await page.getByRole('combobox', { name: 'Console', exact: true }).selectOption(device)
    if (!(await page.locator('[data-prediction-choices]').count())) await primary(page)
    await page.locator('[data-prediction-choices]').getByRole('radio').first().check()
    await primary(page)
    await primary(page)
    const input = page.locator('#mv-quick-vtMl')
    await input.focus()
    await input.press('ArrowRight')
    const pendingValue = await input.inputValue()
    const saved = () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('mechanical-ventilation-live-learning-v1')).units[
            'controls-and-goals'
          ],
      )
    const before = await saved()
    await page.getByText('Console and experiment options', { exact: true }).click()
    await page.getByRole('button', { name: /View full .* console/ }).click()
    await expect(page.locator('[data-device]')).toHaveCount(1)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByText(
        'The full native console needs more width. Return to the task controls to continue here.',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Return to task controls' }).click()
    await expect(input).toHaveValue(pendingValue)
    expect((await saved()).events).toEqual(before.events)
    if (device !== 'hamilton-c6') {
      await page
        .getByRole('button', {
          name: device === 'carefusion-avea' ? 'ACCEPT' : 'Press knob to confirm',
          exact: true,
        })
        .click()
      expect((await saved()).events.length).toBe(before.events.length + 1)
    }
    await expect(page.getByRole('combobox', { name: 'Console', exact: true })).toBeDisabled()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.getByRole('button', { name: /View full .* console/ }).click()
    const [modeNavigation, modeLabel] = nativeModes[device]
    await page.getByRole('button', { name: modeNavigation, exact: true }).click()
    const beforeMode = await saved()
    await page
      .locator('[data-availability="simulated"]')
      .filter({ has: page.locator('strong', { hasText: modeLabel }) })
      .click()
    expect((await saved()).events.length).toBe(beforeMode.events.length + 1)
    await page
      .getByRole('button', {
        name: device === 'carefusion-avea' ? `MODE ACCEPT ${modeLabel}` : `Confirm ${modeLabel}`,
        exact: true,
      })
      .click()
    const confirmed = await saved()
    expect(confirmed.events.slice(-2).map((event) => event.action.type)).toEqual([
      'SELECT_MODE',
      'CONFIRM_MODE',
    ])
    await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
    await expect(page.locator('[data-device]')).toContainText(modeLabel)
    await page.screenshot({
      path: path.join(output, `${device}-native-mode-confirmed.png`),
      fullPage: true,
    })
    results.push({
      type: 'confirmation',
      device,
      pendingValue,
      nativeViewAndResize: 'same patient, pending edit and event count',
      confirmed: true,
      mode: modeLabel,
      modeEvents: confirmed.events.slice(-2),
    })
    await page.close()
    console.log(`DEVICE ${device}: pending edit, native view, resize, same confirmation path`)
  }
  for (const [width, height] of [
    [390, 844],
    [320, 844],
    [1280, 600],
  ]) {
    const page = await newPage(width, height)
    await load(page, '/practice?case=MV-15&device=hamilton-c6&mode=practice')
    await expect(
      page.getByRole('heading', { name: 'A larger screen is recommended' }),
    ).toBeVisible()
    results.push({ type: 'native-case-gate', width, height, gate: 'preserved' })
    await page.close()
  }
  for (const route of ['/practice', '/assess', '/learn?entry=placement', '/learn?entry=review']) {
    const page = await newPage()
    await load(page, route)
    await expect(page.locator('#main-content')).toBeVisible()
    results.push({ type: 'route', route, headings: await page.locator('h1,h2').allTextContents() })
    await page.close()
  }
  const legacy = await newPage()
  const legacyResponse = await legacy.goto(`${base}/en/hamilton-c6-ventilation`)
  expect(legacyResponse.status()).toBe(200)
  results.push({ type: 'route', route: '/en/hamilton-c6-ventilation', status: 200 })
  await legacy.close()
} finally {
  await writeFile(path.join(output, 'layout-results.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
