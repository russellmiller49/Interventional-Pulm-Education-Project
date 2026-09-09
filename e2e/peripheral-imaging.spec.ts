import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { LESSONS } from '../src/features/peripheral-imaging/data/lessons'
import { QUESTION_BY_ID } from '../src/features/peripheral-imaging/data/questions'

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

test('desktop pathway, all lab surfaces and persistent answer boundary', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(content(page).locator('canvas')).toHaveCount(1)
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
  await expect(content(page).getByText('11.0 mm', { exact: true })).toBeVisible()
  await expect(content(page).locator('canvas')).toHaveCount(1)
  await capture(page, testInfo, 'geometry-desktop.png')
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
    }
  }
  await page
    .getByRole('navigation', { name: 'Course resources' })
    .getByRole('button', { name: 'References' })
    .click()
  await expect(content(page).getByRole('link', { name: /\(\.glb\)/ })).toHaveCount(4)
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
