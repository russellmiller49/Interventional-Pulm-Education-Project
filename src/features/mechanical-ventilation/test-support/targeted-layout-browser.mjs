/** Responsive, accessible, device and preserved-route smoke checks; real isolated browser contexts. */
import { chromium, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3161'
const output = path.resolve('artifacts/mv-targeted')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const results = []
const units = [
  'breathing-with-support',
  'waveform-anatomy',
  'controls-and-goals',
  'mechanics-load-and-pressure',
  'modes-and-breath-delivery',
]
const devices = ['hamilton-c6', 'drager-evita-v800-v600', 'puritan-bennett-980', 'carefusion-avea']
const viewports = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [390, 844],
  [320, 844],
]
async function pane(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if (await tab.isVisible()) await tab.click()
}
async function load(page, route) {
  const response = await page.goto(`${base}/en/mechanical-ventilation${route}`)
  expect(response.status()).toBe(200)
}
async function axe(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  return page.evaluate(async () => {
    const result = await window.axe.run(
      document.querySelector('[data-stage-frame]') ?? document.querySelector('main'),
    )
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    }))
  })
}
try {
  for (const [width, height] of viewports) {
    for (const unit of units) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await load(page, `/learn?activity=${unit}`)
      await expect(page.locator('[data-foundation-teaching]')).toBeAttached()
      await pane(page, 'Teaching')
      await expect(page.locator('[data-foundation-teaching]')).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
      await page.screenshot({ path: path.join(output, `${unit}-teaching-${width}x${height}.png`) })
      const violations = await axe(page)
      results.push({ type: 'layout', unit, width, height, overflow, errors, violations })
      expect(errors).toEqual([])
      // On compact screens, the same pending answer survives visiting the simulator.
      if (unit === 'breathing-with-support') {
        await pane(page, 'Steps')
        await page.locator('[data-now-primary]').press('Enter')
        const answer = page
          .locator('[data-prediction-choices]')
          .getByRole('radio', { name: 'Expiration', exact: true })
        await answer.check()
        await pane(page, 'Simulator')
        if (width <= 1024)
          await expect(page.locator('[data-pane="simulator"]')).toContainText(
            'Selected answer: Expiration',
          )
        await pane(page, 'Steps')
        await expect(answer).toBeChecked()
        await page.locator('[data-now-primary]').press('Enter')
        await page.locator('[data-now-primary]').press('Enter')
        await expect(page.locator('[data-now-focus]')).toBeFocused()
        const slider = page.locator('[data-now-card]').getByRole('slider')
        await slider.focus()
        await slider.press('End')
        await slider.press('ArrowLeft')
        await page.getByRole('button', { name: 'Use this captured interval' }).press('Enter')
        await expect(page.locator('[data-now-primary]')).toBeEnabled()
        await page.screenshot({
          path: path.join(output, `keyboard-capture-${width}x${height}.png`),
        })
      }
      await page.close()
      console.log(
        `LAYOUT ${unit} ${width}x${height}: overflow ${overflow}, axe violations ${violations.length}`,
      )
    }
  }
  for (const device of devices) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    })
    await load(page, '/learn?activity=mechanics-load-and-pressure')
    await page.getByRole('combobox', { name: 'Console', exact: true }).selectOption(device)
    await expect(page.getByRole('combobox', { name: 'Console', exact: true })).toHaveValue(device)
    await page.locator('[data-now-primary]').click()
    await page
      .locator('[data-prediction-choices]')
      .getByRole('radio', { name: 'A larger peak-to-plateau gap' })
      .check()
    await page.locator('[data-now-primary]').click()
    await page.locator('[data-now-primary]').click()
    await page.locator('[data-now-secondary]').click()
    const resistance = page.locator('#mv-quick-resistanceScale')
    await expect(resistance).toBeEnabled()
    await resistance.focus()
    await resistance.press('Home')
    for (let i = 0; i < 35; i++) await resistance.press('ArrowRight')
    await expect(resistance).toHaveValue('2')
    await page.locator('#mv-quick-hold-inspiratory').click()
    for (let i = 0; i < 2; i++)
      await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
    await expect(page.locator('[data-now-primary]')).toBeEnabled()
    await page.screenshot({ path: path.join(output, `${device}-mechanics-action-1280.png`) })
    results.push({
      type: 'device',
      device,
      control: 'resistance 2x',
      currentHold: 'acquired',
      status: 'passed',
    })
    await page.close()
    console.log(`DEVICE ${device}: native console, patient control, actual hold passed`)
  }
  const routes = [
    ...[
      'lung-protection',
      'expiration-and-air-trapping',
      'triggering-and-cycling',
      'oxygenation-response',
      'ventilation-and-co2',
      'waveform-reading-sequence',
      'dyssynchrony-mechanisms',
      'safety-reassessment-and-human-factors',
      'high-peak-pressure-integration',
    ].map((id) => `/learn?activity=${id}`),
    '/practice',
    '/practice?case=MV-15&device=carefusion-avea&mode=practice',
    '/assess',
    '/assess?case=masked-seeded&seed=targeted-review&device=hamilton-c6',
    '/learn?entry=placement',
    '/learn?entry=review',
  ]
  for (const route of routes) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await load(page, route)
    await expect(page.locator('#main-content')).toBeVisible()
    if (route.includes('activity=')) {
      await expect(page.locator('[data-now-card]')).toBeVisible()
      await expect(page.locator('[data-foundation-teaching]')).toHaveCount(0)
    }
    const headings = await page.locator('h1,h2,h3').allTextContents()
    results.push({ type: 'route', route, errors, headings })
    expect(errors).toEqual([])
    await page.close()
    console.log(`ROUTE ${route}: rendered`)
  }
} finally {
  await writeFile(path.join(output, 'layout-results.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
