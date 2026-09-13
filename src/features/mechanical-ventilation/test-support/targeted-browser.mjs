/** Real browser walkthrough against an already running local app.
 * MV_REVIEW_URL=http://127.0.0.1:3161 node src/features/mechanical-ventilation/test-support/targeted-browser.mjs
 * Uses public UI controls and the browser clock; never injects completion/evidence.
 */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3161'
const output = path.resolve('artifacts/mv-targeted')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const results = []
const scenarios = [
  [
    'breathing-with-support',
    ['Expiration', 'Inspiration'],
    [null, null],
    ['Outward flow with falling volume', 'Inward flow with rising volume'],
  ],
  [
    'waveform-anatomy',
    ['The same volume arrives sooner', 'A slower volume rise over more time'],
    [
      ['peakFlowLMin', 60],
      ['peakFlowLMin', 30],
    ],
    ['Fell', 'Rose'],
  ],
  [
    'controls-and-goals',
    ['The measured exhaled tidal volume', 'The gas mixture entering the circuit'],
    [
      ['vtMl', 500],
      ['oxygenPercent', 60],
    ],
    ['Rose', 'Stayed similar at the displayed precision'],
  ],
  [
    'mechanics-load-and-pressure',
    ['A larger peak-to-plateau gap', 'Pressure rises; delivered volume stays similar'],
    [
      ['resistanceScale', 2],
      ['complianceScale', 0.5],
    ],
    ['Rose', 'Rose'],
  ],
  [
    'modes-and-breath-delivery',
    ['Pressure rises; delivered volume stays similar', 'Pressure stays similar while volume falls'],
    [
      ['complianceScale', 0.5],
      ['complianceScale', 0.5],
    ],
    ['Rose', 'Fell'],
  ],
]

async function primary(page) {
  const button = page.locator('[data-now-primary]')
  await expect(button).toBeEnabled()
  await button.click()
}
async function range(page, key, target) {
  const input = page.locator(`#mv-quick-${key}`)
  await expect(input).toBeEnabled()
  const min = Number(await input.getAttribute('min'))
  const step = Number(await input.getAttribute('step'))
  await input.focus()
  await input.press('Home')
  for (let i = 0; i < Math.round((target - min) / step); i++) await input.press('ArrowRight')
  await expect(input).toHaveValue(String(target))
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) })
}
async function snapshot(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('mechanical-ventilation-live-learning-v1') ?? '{}'),
  )
}
try {
  for (const [unit, predictions, controls, observations] of scenarios) {
    if (process.env.MV_REVIEW_UNIT && unit !== process.env.MV_REVIEW_UNIT) continue
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.clock.install()
    await page.goto(`${base}/en/mechanical-ventilation/learn?activity=${unit}`)
    await expect(page.locator('[data-foundation-teaching]')).toBeVisible()
    await screenshot(page, `${unit}-teaching-1440`)
    if (unit === 'waveform-anatomy') {
      const positions = []
      for (const stop of ['trigger', 'inspiration', 'cycling', 'expiration']) {
        const figure = page.locator(`[data-guided-stop="${stop}"]`)
        await expect(figure).toBeVisible()
        const cursors = await figure
          .locator('[data-time-cursor]')
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.timeCursor))
        expect(new Set(cursors).size).toBe(1)
        positions.push(cursors[0])
        await primary(page)
      }
      expect(new Set(positions).size).toBe(4)
    }
    await primary(page)
    for (let round = 0; round < 2; round++) {
      await expect(page.locator('[data-prediction-choices]')).toBeVisible()
      await expect(page.locator('[data-foundation-teaching] [data-phase-band]')).toHaveCount(0)
      // Choose the authored answer by its rendered wording, not its shuffled position.
      await page
        .locator('[data-prediction-choices]')
        .getByRole('radio', { name: predictions[round], exact: true })
        .check()
      await primary(page)
      await primary(page)
      if (unit === 'breathing-with-support') {
        const cursor = page
          .locator('[data-now-card]')
          .getByRole('slider', { name: 'Captured breath time cursor' })
        await cursor.focus()
        await cursor.press('Home')
        const max = Number(await cursor.getAttribute('max'))
        const index = round === 0 ? Math.floor(max * 0.6) : 2
        for (let i = 0; i < index; i++) await cursor.press('ArrowRight')
        await page
          .getByRole('button', { name: 'Use this captured interval', exact: true })
          .press('Enter')
        // The accessible capture works with the real simulation paused under reduced motion.
        await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
      } else {
        await page.locator('[data-now-secondary]').click()
        await range(page, ...controls[round])
        if (unit === 'mechanics-load-and-pressure') {
          await page.locator('#mv-quick-hold-inspiratory').click()
          await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
          await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
        }
      }
      await screenshot(page, `${unit}-round-${round + 1}-action-1440`)
      if (round === 0) await primary(page)
      if (unit !== 'breathing-with-support') {
        await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('5')
        const run = page.getByRole('button', { name: 'Run', exact: true })
        if (await run.count()) await run.click()
        await page.clock.runFor(9000)
      }
      await primary(page)
      await expect(page.locator('[data-observation-task]')).toBeVisible()
      await expect(page.locator('[data-now-primary]')).toBeDisabled()
      await screenshot(page, `${unit}-round-${round + 1}-comparison-1440`)
      let observedAnswer = observations[round]
      if (unit !== 'breathing-with-support') {
        const table = page.locator('[data-observation-task] table')
        const metric =
          unit === 'waveform-anatomy'
            ? 'Inspiratory time'
            : unit === 'mechanics-load-and-pressure'
              ? 'Plateau'
              : unit === 'modes-and-breath-delivery' && round === 0
                ? 'Peak pressure'
                : 'Exhaled volume'
        const values = await table
          .getByRole('row')
          .filter({ hasText: metric })
          .locator('td')
          .allTextContents()
        let before = parseFloat(values[0]),
          after = parseFloat(values[1])
        if (unit === 'mechanics-load-and-pressure' && round === 0) {
          const peak = await table
            .getByRole('row')
            .filter({ hasText: 'Peak pressure' })
            .locator('td')
            .allTextContents()
          before = parseFloat(peak[0]) - before
          after = parseFloat(peak[1]) - after
        }
        observedAnswer =
          after > before
            ? 'Rose'
            : after < before
              ? 'Fell'
              : 'Stayed similar at the displayed precision'
        console.log(
          `${unit} round ${round + 1}: displayed ${before} → ${after}; answer ${observedAnswer}`,
        )
      }
      await page
        .locator('[data-observation-task]')
        .getByRole('radio', { name: observedAnswer, exact: true })
        .check()
      await primary(page)
      await expect(page.locator('[data-observation-feedback]')).toContainText(
        'Your observation matches this run.',
      )
      await primary(page)
      await primary(page)
      if (unit === 'controls-and-goals' && round === 0) {
        // The six rows remain an independent sort after the worked teaching.
        const rows = page.locator('[data-sort-row]')
        expect(await rows.count()).toBe(6)
        for (let i = 0; i < (await rows.count()); i++) {
          const row = rows.nth(i)
          const text = await row.innerText()
          await row
            .getByRole('combobox')
            .selectOption(/exhaled|total rate|peak pressure/i.test(text) ? 'reported' : 'set')
        }
        await primary(page)
        await primary(page)
      }
    }
    await expect(page.locator('[data-now-card]')).toContainText(
      'This section has been worked through.',
    )
    const stored = await snapshot(page)
    results.push({
      unit,
      viewport: '1440x900',
      reducedMotion: true,
      bothRounds: 'passed',
      errors,
      stored,
    })
    expect(errors).toEqual([])
    await page.reload()
    await expect(page.locator('[data-now-card]')).toContainText(
      'This section has been worked through.',
    )
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
    await page.close()
    console.log(`PASS ${unit}: both rounds, recorded observation, refresh`)
  }
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await screenshot(page, 'walkthrough-failure')
      console.error(
        await page
          .locator('[data-now-card]')
          .innerText()
          .catch(() => page.url()),
      )
      console.error(
        'RADIOS',
        await page
          .getByRole('radio')
          .evaluateAll((nodes) => nodes.map((n) => n.parentElement.textContent)),
      )
    }
  throw error
} finally {
  await writeFile(path.join(output, 'walkthrough-results.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
