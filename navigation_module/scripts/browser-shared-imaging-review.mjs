import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.NAVIGATION_REVIEW_URL ?? 'http://127.0.0.1:3132'
const output = path.resolve(process.env.NAVIGATION_REVIEW_OUTPUT ?? 'artifacts/navigation-review')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true }),
  errors = [],
  journeys = []
const session = (page) =>
  page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith('bronchoedu:session:v1:')),
      ) ?? 'null',
    ),
  )
const pose = (page) =>
  page.locator('.scope-render').evaluate((e) => JSON.parse(e.dataset.scopePoseLps))
const advance = (page) => page.getByRole('button', { name: 'Move scope forward', exact: true })
const waitDepth = (page, depth) =>
  page.waitForFunction(
    (expected) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('bronchoedu:session:v1:'))
      return (
        key && Math.abs(JSON.parse(localStorage.getItem(key)).driveDistanceMm - expected) < 0.01
      )
    },
    depth,
    { timeout: 15000 },
  )
try {
  for (const level of ['Beginner', 'Advanced']) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1100 },
      recordVideo: { dir: output, size: { width: 1280, height: 880 } },
    })
    await context.addInitScript(() => {
      Math.random = () => 0.37
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto(base)
    await page.getByRole('button', { name: level, exact: true }).click({ timeout: 60000 })
    await page.getByRole('button', { name: 'Surprise me', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForFunction(
      () =>
        document.querySelector('.scope-render')?.dataset.scopePoseLps &&
        [...document.querySelectorAll('canvas.ct-canvas')].every((c) => c.dataset.slicePlaneLps),
    )
    await advance(page).click()
    await waitDepth(page, 8)
    const inserted = await session(page)
    await page.getByRole('button', { name: 'Move scope backward', exact: true }).click()
    await waitDepth(page, 0)
    assert.ok(
      (await session(page)).driveDistanceMm < inserted.driveDistanceMm,
      'Withdrawal must reduce insertion',
    )
    await advance(page).click()
    await waitDepth(page, 8)
    const saved = await session(page)
    await page.reload()
    await page
      .getByRole('button', { name: 'Move scope forward', exact: true })
      .waitFor({ timeout: 60000 })
    await waitDepth(page, 8)
    const restored = await session(page)
    for (const key of [
      'activeTargetId',
      'locationId',
      'mode',
      'selectedEndpointId',
      'currentDecisionIndex',
      'driveDistanceMm',
    ])
      assert.equal(restored[key], saved[key], `Restored ${key}`)
    console.log(`${level}: session and withdrawal passed`)
    await page.waitForFunction(() =>
      [...document.querySelectorAll('canvas.ct-canvas')].every((c) => c.dataset.slicePlaneLps),
    )
    const axial = page.locator('section.ct-pane').first(),
      canvas = axial.locator('canvas.ct-canvas')
    await page.waitForTimeout(1200)
    const dimensions = await page.locator('canvas.ct-canvas').evaluateAll((elements) =>
      elements.map((c) => {
        const p = JSON.parse(c.dataset.slicePlaneLps),
          r = c.getBoundingClientRect()
        return { actual: r.width / r.height, expected: p.widthMm / p.heightMm }
      }),
    )
    for (const d of dimensions)
      assert.ok(
        Math.abs(d.actual / d.expected - 1) < 0.015,
        'CT must preserve physical aspect ratio',
      )
    const originalPixels = await canvas.evaluate((c) => c.toDataURL())
    const windowLevel = page.getByLabel('Axial window level', { exact: true })
    const savedLevel = await windowLevel.inputValue()
    await windowLevel.fill('300')
    await page.waitForFunction(
      (before) => document.querySelector('canvas.ct-canvas')?.toDataURL() !== before,
      originalPixels,
      { timeout: 15000 },
    )
    await windowLevel.fill(savedLevel)
    await axial.getByLabel('Follow scope', { exact: true }).uncheck()
    await page.waitForTimeout(300)
    const held = await canvas.getAttribute('data-slice-plane-lps')
    await advance(page).click()
    await page.waitForTimeout(500)
    assert.equal(
      await canvas.getAttribute('data-slice-plane-lps'),
      held,
      'Follow off must hold the CT plane',
    )
    await axial.getByLabel('Follow scope', { exact: true }).check()
    await page.waitForFunction(
      () => {
        const frame = JSON.parse(document.querySelector('.scope-render').dataset.scopePoseLps)
        return [...document.querySelectorAll('canvas.ct-canvas')].every((c) => {
          const p = JSON.parse(c.dataset.slicePlaneLps)
          const d = frame.position.reduce((sum, v, i) => sum + (v - p.center[i]) * p.normal[i], 0)
          return Math.abs(d) < p.widthMm / p.width
        })
      },
      null,
      { timeout: 15000 },
    )
    const frame = await pose(page),
      planes = await page
        .locator('canvas.ct-canvas')
        .evaluateAll((cs) => cs.map((c) => JSON.parse(c.dataset.slicePlaneLps)))
    for (const p of planes) {
      const distance = frame.position.reduce(
        (sum, v, i) => sum + (v - p.center[i]) * p.normal[i],
        0,
      )
      assert.ok(
        Math.abs(distance) < p.widthMm / p.width,
        'CT plane and rendered tip must agree within one pixel',
      )
    }
    await page.screenshot({ path: path.join(output, `${level.toLowerCase()}-review.png`) })
    console.log(`${level}: CT controls and synchronization passed`)
    let stops = 0,
      wrongFeedback = false
    for (let step = 0; step < 220; step++) {
      if (await page.getByText('Lesion reached', { exact: true }).count()) break
      const choices = page.locator('.scope-choice-row .choice-button')
      if (await choices.count()) {
        const count = await choices.count()
        let correct = -1
        for (let i = 0; i < count; i++) {
          await choices.nth(i).click()
          const state = await choices.nth(i).getAttribute('class')
          if (state.includes('choice-correct')) correct = i
          else wrongFeedback = true
        }
        assert.ok(correct >= 0, 'Every stop must offer a correct route choice')
        await choices.nth(correct).click()
        await page.getByRole('button', { name: 'Drive on', exact: true }).click()
        stops++
        console.log(`${level}: passed branch ${stops}`)
      } else if (await advance(page).count()) {
        // Auto-drive can finish between locator discovery and Playwright's click checks.
        // Activate the currently mounted transport button atomically; no app state is injected.
        await advance(page).evaluateAll((buttons) => buttons[0]?.click())
      }
      await page.waitForTimeout(90)
    }
    await page.getByText('Lesion reached', { exact: true }).waitFor({ timeout: 30000 })
    assert.ok(wrongFeedback)
    await page.screenshot({ path: path.join(output, `${level.toLowerCase()}-complete.png`) })
    if (level === 'Advanced') {
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      assert.equal(
        await page.getByLabel('Centerline', { exact: true }).count(),
        0,
        'Assessment must hide route controls',
      )
      await page.screenshot({ path: path.join(output, 'assessment.png') })
    }
    journeys.push({
      level,
      stops,
      completed: true,
      wrongFeedback,
      withdrawal: true,
      sessionRestore: true,
      windowLevel: true,
      follow: true,
      physicalAspect: true,
      ctTipAgreement: true,
    })
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(
    path.join(output, 'browser-review.json'),
    JSON.stringify({ journeys, errors }, null, 2),
  )
}
assert.equal(errors.length, 0, errors.join('\n'))
console.log(JSON.stringify({ journeys, errors, output }, null, 2))
