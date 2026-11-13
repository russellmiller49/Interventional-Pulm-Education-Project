import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * CRRT: the filtration fraction the prescription builder calculates.
 *
 * Clinical review, 2026-11-13. The value is a calculated estimate by a stated expression,
 *
 *   fluid across the membrane ÷ (blood flow × (1 − hematocrit) + pre-filter fluid),
 *
 * the expression in the AJKD Core Curriculum 2025 (Table 5). It is not either of the two values
 * a PrisMax shows, and the page says so. Every expected number below is arithmetic on the
 * entries, written out here; none is copied from the page.
 */

const estimate = (entry: {
  blood: number
  hematocrit: number
  pbp: number
  pre: number
  post: number
  removal: number
}) => {
  const plasma = entry.blood * 60 * (1 - entry.hematocrit / 100)
  const preFilter = entry.pbp + entry.pre
  const across = preFilter + entry.post + entry.removal
  return { percent: (across / (plasma + preFilter)) * 100, plasma, preFilter, across }
}
const mlh = (value: number) => `${Math.round(value).toLocaleString('en-US')} mL/h`
/** The builder's starting entries. */
const start = { blood: 100, hematocrit: 30, pbp: 200, pre: 300, post: 500, removal: 100 }

async function openBuilder(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-prescription-dosing')
  const sources = page.locator('summary', { hasText: /^Sources$/ }).first()
  await expect(sources).toBeVisible({ timeout: 90_000 })
  // The summary is in the server's markup before React attaches; wait for the page to settle.
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await sources.click()
  await page.locator('summary', { hasText: 'Free calculation reference' }).click()
  const builder = page.getByRole('region', { name: 'Staged Prescription Builder' })
  await expect(builder).toBeVisible({ timeout: 30_000 })
  return builder
}

const step = (builder: Locator, ordinal: 1 | 2 | 3) =>
  builder
    .getByRole('navigation', { name: 'Prescription building steps' })
    .locator('button')
    .nth(ordinal - 1)

async function enter(builder: Locator, entries: Record<string, number>) {
  await step(builder, 2).click()
  for (const [label, value] of Object.entries(entries)) {
    const field = builder.getByRole('spinbutton', { name: new RegExp(`^${label}`) })
    await field.fill(String(value))
    await field.blur()
  }
}

/** Step 3, with the section that holds the value open. */
async function section(builder: Locator) {
  await step(builder, 3).click()
  const part = builder.locator('[data-crrt-filtration-fraction]')
  if (!(await part.isVisible()))
    await builder.locator('summary', { hasText: 'Advanced calculations and limits' }).click()
  await expect(part).toBeVisible()
  return part
}

test('the builder prints the estimate with its working, and says what it is and is not', async ({
  page,
}) => {
  const builder = await openBuilder(page)
  const part = await section(builder)
  const expected = estimate(start)
  // 1,100 ÷ (4,200 + 500) = 23.4%
  expect(expected.percent.toFixed(1)).toBe('23.4')
  await expect(part.getByRole('heading', { level: 4 })).toHaveText(
    'Filtration fraction (calculated estimate)',
  )
  await expect(part.locator('[data-crrt-filtration-fraction-value]')).toHaveText('23.4%')
  await expect(part).toContainText(
    `${mlh(expected.across)} across the membrane ÷ (${mlh(expected.plasma)} plasma + ${mlh(expected.preFilter)} pre-filter fluid)`,
  )
  await expect(part).toContainText('Within the 20%–25% ceiling range.')

  // Not the machine's display, and how the machine's two values differ. No machine number.
  const note = part.locator('[data-crrt-filtration-fraction-estimate]')
  await expect(note).toContainText('This is a calculated estimate')
  await expect(note).toContainText('AJKD Core Curriculum 2025 (Table 5)')
  await expect(note).toContainText('It is not the PrisMax display.')
  await expect(note).toContainText('FF Blood % and FF Plasma % (operator’s manual, p. 218)')
  await expect(note).toContainText(
    'FF Blood % leaves the pre-filter fluid out of the numerator, so with any pre-filter fluid it reads lower than this estimate.',
  )
  // One ceiling statement, each number with its source and scope.
  await expect(part.locator('[data-crrt-filtration-fraction-ceiling]')).toHaveText(
    'Keep it at or below 20%–25% to lower the risk of the filter clotting (AJKD Core Curriculum, 2025); with regional citrate a higher fraction is reported, anecdotally, to be tolerated. For post-dilution CVVH, 25% is the usual maximum (Claure-Del Granado and Clark, 2021).',
  )
  await expect(part).not.toContainText(/Sources differ|Under 20%/)
  // What the estimate leaves out.
  await expect(part.locator('[data-crrt-filtration-fraction-limits]')).toContainText(
    'The hematocrit is the one entered and stays fixed',
  )
  await expect(part.locator('[data-crrt-filtration-fraction-limits]')).toContainText(
    'does not change solute clearance when fluid is moved before the filter',
  )
})

test('the estimate follows blood flow, hematocrit, the pre/post split and net removal', async ({
  page,
}) => {
  const builder = await openBuilder(page)
  const value = (part: Locator) => part.locator('[data-crrt-filtration-fraction-value]')

  // More blood flow: more plasma reaches the filter, so the fraction falls. 1,100 ÷ 8,900.
  let now = { ...start, blood: 200 }
  await enter(builder, { 'Blood flow': 200 })
  let part = await section(builder)
  expect(estimate(now).percent.toFixed(1)).toBe('12.4')
  await expect(value(part)).toHaveText('12.4%')
  await expect(part).toContainText('Below the 20%–25% ceiling.')

  // A higher hematocrit at the same blood flow: less plasma, so it rises. 1,100 ÷ 7,100.
  now = { ...now, hematocrit: 45 }
  await enter(builder, { 'Practice hematocrit': 45 })
  part = await section(builder)
  expect(estimate(now).percent.toFixed(1)).toBe('15.5')
  await expect(value(part)).toHaveText('15.5%')

  // The same replacement volume moved from before the filter to after it: it rises.
  now = { ...start, pre: 0, post: 800 }
  await enter(builder, {
    'Blood flow': 100,
    'Practice hematocrit': 30,
    'Pre-filter replacement flow': 0,
    'Post-filter replacement flow': 800,
  })
  part = await section(builder)
  // 1,100 ÷ (4,200 + 200) = 25.0%, against 23.4% with 300 mL/h of it before the filter.
  expect(estimate(now).percent.toFixed(1)).toBe('25.0')
  await expect(value(part)).toHaveText('25.0%')
  await expect(part).toContainText(
    `${mlh(1_100)} across the membrane ÷ (${mlh(4_200)} plasma + ${mlh(200)} pre-filter fluid)`,
  )
  await expect(part).toContainText('At or above 25%, the top of the ceiling range.')

  // More net removal: more crosses the membrane, the denominator is unchanged. 1,300 ÷ 4,400.
  now = { ...now, removal: 300 }
  await enter(builder, { 'Patient fluid removal': 300 })
  part = await section(builder)
  expect(estimate(now).percent.toFixed(1)).toBe('29.5')
  await expect(value(part)).toHaveText('29.5%')
})

test('no value is printed without a blood flow or with a makeup flow, and never a broken number', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const builder = await openBuilder(page)

  await enter(builder, { 'Blood flow': 0 })
  let part = await section(builder)
  await expect(part.locator('[data-crrt-filtration-fraction-value]')).toHaveCount(0)
  await expect(part.locator('[data-crrt-filtration-fraction-reason]')).toHaveText(
    'Not stated without a blood flow: no plasma reaches the filter.',
  )
  await expect(part).not.toContainText(/NaN|Infinity|undefined/)

  await enter(builder, { 'Blood flow': 100, 'Device makeup flow': 50 })
  part = await section(builder)
  await expect(part.locator('[data-crrt-filtration-fraction-value]')).toHaveCount(0)
  await expect(part.locator('[data-crrt-filtration-fraction-reason]')).toHaveText(
    'Not stated while a makeup flow is entered: its volume cannot be attributed.',
  )

  // Back to a prescription with a value.
  await enter(builder, { 'Device makeup flow': 0 })
  part = await section(builder)
  await expect(part.locator('[data-crrt-filtration-fraction-value]')).toHaveText('23.4%')

  // A hematocrit of 100% leaves no plasma: the entry is refused, and nothing is calculated from it.
  await enter(builder, { 'Practice hematocrit': 100 })
  await expect(builder).toContainText('Practice hematocrit must be at most 99.9.')
  await expect(builder).not.toContainText(/NaN|Infinity/)
  expect(errors).toEqual([])
})

test('on a phone the section reads in full with nothing pushed sideways', async ({ page }) => {
  const builder = await openBuilder(page, 390, 844)
  const part = await section(builder)
  await part.scrollIntoViewIfNeeded()
  await expect(part.locator('[data-crrt-filtration-fraction-value]')).toHaveText('23.4%')
  await expect(part.locator('[data-crrt-filtration-fraction-estimate]')).toBeVisible()
  const fits = await part.evaluate((element) => {
    const frame = element.getBoundingClientRect()
    return [...element.querySelectorAll('p, h4')].every((line) => {
      const box = line.getBoundingClientRect()
      return box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.right <= innerWidth
    })
  })
  expect(fits).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)
})
