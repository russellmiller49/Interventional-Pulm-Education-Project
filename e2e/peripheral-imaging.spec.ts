import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test'
import { LESSONS } from '../src/features/peripheral-imaging/data/lessons'
import { QUESTION_BY_ID } from '../src/features/peripheral-imaging/data/questions'
import {
  LESION_CENTER,
  projectToDetector,
  toolTipForDepth,
} from '../src/features/peripheral-imaging/lib/physics'

// Explicit opt-in keeps this suite independent of the default port-3001 E2E server.
test.skip(
  !process.env.PERIPHERAL_IMAGING_BASE_URL,
  'Run with the dedicated imaging config and a local development server.',
)
test.setTimeout(120_000)

test.beforeEach(async ({ context, page }) => {
  const base = process.env.PERIPHERAL_IMAGING_BASE_URL!
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
    throw new Error('Imaging smoke checks require localhost.')
  const token = process.env.LOCAL_DEV_AUTH_TOKEN
  if (!token)
    throw new Error(
      'Load the repository local development auth environment before running the imaging checks.',
    )
  // Values remain in memory; do not print the auth URL or persist a browser trace.
  const auth = await context.request
    .get(base + '/api/local-dev-auth', {
      params: { token, next: '/en/fluoroview' },
      maxRedirects: 0,
    })
    .catch(() => {
      throw new Error('Local development auth request failed.')
    })
  expect(auth.status()).toBe(307)
  await page.goto(base + '/en/fluoroview')
  await expect(page.getByRole('button', { name: /^Start —/ })).toBeEnabled()
})
const content = (page: Page) => page.getByRole('region', { name: 'Imaging course content' })
async function lesson(page: Page, id: string) {
  const title = LESSONS.find((item) => item.id === id)!.title
  const pathToggle = page.getByRole('button', { name: /Learning pathway ·/ })
  if ((await pathToggle.isVisible()) && (await pathToggle.getAttribute('aria-expanded')) !== 'true')
    await pathToggle.click()
  await page
    .getByRole('complementary', { name: 'Learning pathway' })
    .getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    .click()
  await expect(content(page).getByRole('heading', { level: 1 })).toHaveText(title)
}
async function explore(page: Page, id: string) {
  await lesson(page, id)
  await content(page).getByRole('button', { name: 'Explore the model' }).click()
}
async function setRange(page: Page, label: string, value: number) {
  const input = content(page).getByRole('slider', { name: label })
  await input.fill(String(value))
  await input.dispatchEvent('change')
}
async function capture(page: Page, info: TestInfo, name: string) {
  // Capture fixed site navigation at the top, rather than mid-page after lesson focus.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath(name), fullPage: true })
}
async function expectImageSignal(canvas: Locator, webgl = true) {
  if (webgl)
    await expect
      .poll(() =>
        canvas.evaluate(
          (node) =>
            (node as HTMLCanvasElement).dataset.threeState ??
            node.closest('[data-projection-state]')?.getAttribute('data-projection-state'),
        ),
      )
      .toBe('ready')
  await expect
    .poll(() =>
      canvas.evaluate((node, useWebgl) => {
        const c = node as HTMLCanvasElement
        let pixels: Uint8Array | Uint8ClampedArray
        if (useWebgl) {
          const gl = c.getContext('webgl2')!
          pixels = new Uint8Array(c.width * c.height * 4)
          gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        } else pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
        let min = 255,
          max = 0
        for (let i = 0; i < pixels.length; i += 4) {
          min = Math.min(min, pixels[i])
          max = Math.max(max, pixels[i])
        }
        return max - min
      }, webgl),
    )
    .toBeGreaterThan(35)
}

test('desktop pathway, all lab surfaces and persistent answer boundary', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text()))
      errors.push(message.text())
  })
  await expect(content(page).locator('canvas')).toHaveCount(1)
  await expect(content(page).getByText('Authored target', { exact: true })).toBeVisible()
  await expectImageSignal(content(page).locator('canvas'))
  await capture(page, testInfo, 'course-desktop.png')
  await page.getByRole('button', { name: /^Start —/ }).click()
  await content(page)
    .getByRole('button', { name: /Check$/ })
    .click()
  await expect(content(page).getByRole('button', { name: /Commit response/ })).toBeDisabled()
  await expect(content(page).getByText(/Visible hardware and a virtual destination/)).toHaveCount(0)
  await content(page).getByRole('radio').first().check()
  await content(page)
    .getByRole('button', { name: /Commit response/ })
    .click()
  await expect(content(page).getByText('A point to revisit')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^Continue —/ }).click()
  await expect(content(page).getByText('A point to revisit')).toBeVisible()
  await expect(content(page).getByRole('radio').first()).toBeChecked()
  await content(page).getByRole('button', { name: 'Review this unit' }).click()
  await content(page).getByRole('button', { name: 'Complete unit & continue' }).click()
  await expect(content(page).getByRole('heading', { level: 1 })).toHaveText(LESSONS[1].title)

  await explore(page, 'projection')
  await setRange(page, 'C-arm obliquity', 30)
  const target = projectToDetector(LESION_CENTER, 30, 0),
    tip = projectToDetector(toolTipForDepth(22), 30, 0)
  const separation = Math.hypot(target[0] - tip[0], target[1] - tip[1]).toFixed(1)
  await expect(content(page).getByText(separation + ' mm', { exact: true })).toBeVisible()
  await expect(content(page).locator('canvas')).toHaveCount(2)
  await expect(content(page).locator('[data-projection-state=ready]')).toBeVisible()
  await expectImageSignal(content(page).locator('[data-projection-state=ready] canvas'))
  await expectImageSignal(content(page).locator('canvas').first())
  await capture(page, testInfo, 'geometry-desktop.png')
  await content(page).getByRole('button', { name: 'C-arm motion', exact: true }).click()
  await expectImageSignal(content(page).locator('canvas').first())
  const gantryBefore = await content(page)
    .locator('canvas')
    .first()
    .evaluate((node) => (node as HTMLCanvasElement).toDataURL())
  await setRange(page, 'C-arm obliquity', -35)
  await expect
    .poll(() =>
      content(page)
        .locator('canvas')
        .first()
        .evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
    )
    .not.toBe(gantryBefore)
  await content(page)
    .getByRole('img', { name: 'Original FluoroView C-arm animation, a generic motion reference.' })
    .screenshot({ path: testInfo.outputPath('original-carm.png') })
  for (const id of [
    'field',
    'time',
    'dts-acquisition',
    'fixed-suite',
    'mobile-suite',
    'tool-confirmation',
    'changing-anatomy',
    'staff-protection',
    'dose-reporting',
  ]) {
    await explore(page, id)
    await expect(content(page).getByText(/Authored teaching model/)).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    if (id === 'tool-confirmation') {
      await content(page).getByRole('button', { name: 'Example B', exact: true }).click()
      await content(page).getByRole('button', { name: 'Reveal geometric explanation' }).click()
      await expect(content(page).getByText(/Sampling window fully within the sphere/)).toBeVisible()
      await expect(content(page).getByText(/The tip is outside/)).toBeVisible()
      await expect(content(page).getByText('Sampling window', { exact: true })).toBeVisible()
      await capture(page, testInfo, 'sampling-desktop.png')
      await expect(content(page).locator('[data-ct-state=ready]')).toHaveCount(3)
      await expectImageSignal(content(page).locator('[data-ct-state=ready]').first(), false)
    }
    if (id === 'dts-acquisition') {
      await expect(content(page).locator('[data-dts-state=ready]')).toBeVisible()
      const planeCanvas = content(page)
        .getByRole('img', { name: /CT-derived shift-and-add plane/ })
        .locator('canvas')
      await expectImageSignal(planeCanvas, false)
      const before = await planeCanvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())
      await content(page).getByRole('button', { name: 'Tool plane', exact: true }).click()
      await expect
        .poll(() => planeCanvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL()))
        .not.toBe(before)
      await content(page)
        .locator('[data-dts-state=ready]')
        .screenshot({ path: testInfo.outputPath('ct-tomosynthesis.png') })
    }
    if (id === 'mobile-suite') {
      await expect(content(page).locator('[data-projection-state=ready]')).toHaveCount(2)
      for (const canvas of await content(page)
        .locator('[data-projection-state=ready] canvas')
        .all())
        await expectImageSignal(canvas)
    }
  }
  await page
    .getByRole('navigation', { name: 'Course resources' })
    .getByRole('button', { name: 'References' })
    .click()
  await expect(content(page).getByRole('link', { name: /\(\.glb\)/ })).toHaveCount(2)
  await expect(content(page).getByRole('link', { name: /video|youtube|webinar/i })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('acquisition invalidation and safety-critical case scoring', async ({ page }) => {
  await explore(page, 'cbct-acquisition')
  await expect(content(page).getByRole('button', { name: 'Capture teaching state' })).toBeDisabled()
  await content(page).getByRole('button', { name: 'Center the teaching target' }).click()
  for (const checkbox of await content(page).getByRole('checkbox').all()) await checkbox.check()
  await content(page).getByRole('button', { name: 'Capture teaching state' }).click()
  await expect(content(page).getByText('Teaching state captured.')).toBeVisible()
  await setRange(page, 'Target depth offset', 15)
  await expect(content(page).getByRole('button', { name: 'Capture teaching state' })).toBeDisabled()
  await expect(content(page).getByRole('checkbox').first()).not.toBeChecked()
  await expect(content(page).getByText('Teaching state captured.')).toHaveCount(0)
  await lesson(page, 'suite-cases')
  await content(page).getByRole('button', { name: 'Start the suite cases' }).click()
  const cases = LESSONS[LESSONS.length - 1]
  for (const id of cases.checkIds) {
    const question = QUESTION_BY_ID[id]
    const chosen =
      id === 'case-6' ? 0 : question.choices.findIndex((choice) => choice.id === question.correct)
    await content(page).getByRole('radio').nth(chosen).check()
    await content(page).getByRole('button', { name: 'Commit response' }).click()
    await content(page)
      .getByRole('button', {
        name: id === cases.checkIds.at(-1) ? 'Review this unit' : 'Continue to the next decision',
      })
      .click()
  }
  await expect(content(page).getByText(/First decisions · 7\/8 correct/)).toBeVisible()
  await expect(
    content(page).getByRole('heading', { name: 'Independent case check: review needed' }),
  ).toBeVisible()
})

test('mobile, enlarged text, glossary and inside-lab resume', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(content(page).locator('canvas')).toHaveCount(1)
  await expect(content(page).getByText('Authored target', { exact: true })).toBeVisible()
  await expectImageSignal(content(page).locator('canvas'))
  await capture(page, testInfo, 'course-mobile.png')
  await explore(page, 'tool-confirmation')
  await setRange(page, 'Anterior / posterior offset', -10)
  await page.reload()
  await page.getByRole('button', { name: /^Continue —/ }).click()
  await expect(
    content(page).getByRole('slider', { name: 'Anterior / posterior offset' }),
  ).toHaveValue('-10')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expect(content(page).getByText('Sampling window', { exact: true })).toBeVisible()
  await capture(page, testInfo, 'sampling-mobile.png')
  await page
    .getByRole('navigation', { name: 'Course resources' })
    .getByRole('button', { name: 'Glossary' })
    .click()
  await content(page).getByRole('searchbox').fill('parallax')
  await expect(content(page).locator('dt')).toHaveText(['Parallax'])
  await page.evaluate(() => {
    const region = document.getElementById('imaging-content')!
    const sizes = Array.from(region.querySelectorAll<HTMLElement>('*')).map(
      (el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const,
    )
    for (const [element, fontSize] of sizes) element.style.fontSize = fontSize * 2 + 'px'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
