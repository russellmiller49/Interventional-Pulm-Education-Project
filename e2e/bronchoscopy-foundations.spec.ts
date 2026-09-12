import { expect, test, type Page } from '@playwright/test'
import { bronchStageLesson } from '../src/features/bronchoscopy-foundations/content/stageLessons'
import {
  BRONCH_SECTION_IDS,
  type BronchSectionId,
} from '../src/features/bronchoscopy-foundations/content/pathway'
import { CAPSTONE_CASES } from '../src/features/bronchoscopy-foundations/content/capstone'
import { capstoneStageItem } from '../src/features/bronchoscopy-foundations/engine/caseStandard'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
} from '../src/features/bronchoscopy-foundations/engine/learnProgress'
import { scopeControlId } from '../src/features/bronchoscopy-foundations/components/scope/types'

// Opt in to the module's isolated local server; never write a test record on a deployed site.
test.skip(!process.env.BRONCH_FOUNDATIONS_BASE_URL, 'Use the dedicated config and a local server.')
test.setTimeout(120_000)
const base = '/en/bronchoscopy-foundations'
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const stage = (page: Page) => page.locator('[data-stage]')
const ready = (page: Page) =>
  expect(page.locator('[data-three-state]')).toHaveAttribute('data-three-state', 'ready', {
    timeout: 30_000,
  })
const control = (page: Page, key: Parameters<typeof scopeControlId>[0]) =>
  page.locator('[id="' + scopeControlId(key) + '"]')

test.beforeEach(async ({ page }) => {
  const url = process.env.BRONCH_FOUNDATIONS_BASE_URL!
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local server required')
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  const response = await page.goto(base)
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-bronch-continue]')).toHaveCount(1)
})
async function openSection(page: Page, id: BronchSectionId) {
  const lesson = bronchStageLesson(id)
  await page.goto(base + '/learn?section=' + id)
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  return lesson
}
async function reachAct(page: Page, id: BronchSectionId, miss = false) {
  const lesson = await openSection(page, id)
  await primary(page).click()
  const step = lesson.steps[lesson.predictionStepIndex]
  if (step.interaction.kind !== 'prediction') throw new Error('Prediction expected')
  const item = step.interaction.stage.item
  const choice = miss
    ? item.choices.find((entry) => !item.correctChoiceIds.includes(entry.id))!.id
    : item.correctChoiceIds[0]
  await page.locator('[data-prediction-choices] input[value="' + choice + '"]').check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute('data-revealed', 'true')
  await primary(page).click()
  return { lesson, choice, item }
}
async function setRange(page: Page, key: 'rotate' | 'deflect', value: number) {
  // Native keyboard input exercises React's real change handler and input provenance.
  const slider = control(page, key)
  await slider.focus()
  const current = Number(await slider.inputValue())
  const step = Number((await slider.getAttribute('step')) ?? 1)
  const direction = current < value ? 1 : -1
  for (let at = current; direction * at < direction * value; at += direction * step)
    await slider.press(direction === 1 ? 'ArrowRight' : 'ArrowLeft')
}
async function record(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), BRONCH_STORAGE_KEY)
}

test('one entry, direct links and incomplete-section resume preserve the first decision', async ({
  page,
}) => {
  await expect(page.locator('[data-bronch-continue]')).toHaveAttribute(
    'href',
    /section=shared-airway/,
  )
  await page.locator('[data-bronch-continue]').click()
  await expect(stage(page)).toHaveAttribute(
    'data-stage',
    bronchStageLesson('shared-airway').steps[0].id,
  )
  const { lesson, choice, item } = await reachAct(page, 'five-controls', true)
  await ready(page)
  const saved = await record(page)
  const first = Object.values(saved.firstAttempts) as { choiceId: string; correct: boolean }[]
  expect(first).toEqual([expect.objectContaining({ choiceId: choice, correct: false })])
  expect(saved.completedSectionIds).not.toContain('five-controls')
  await page.reload()
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  await primary(page).click()
  await page
    .locator('[data-prediction-choices] input[value="' + item.correctChoiceIds[0] + '"]')
    .check()
  await primary(page).click()
  expect((await record(page)).firstAttempts).toEqual(saved.firstAttempts)
})

test('the real bench requires movement, preserves locks, and supports reset and observation', async ({
  page,
}) => {
  const lesson = await openSection(page, 'five-controls')
  await ready(page)
  await expect(control(page, 'rotate')).toBeDisabled()
  await reachAct(page, 'five-controls')
  await ready(page)
  await expect(primary(page)).toHaveCount(0)
  await setRange(page, 'rotate', 45)
  await setRange(page, 'deflect', 45)
  await setRange(page, 'rotate', 90)
  await expect(primary(page)).toBeEnabled()
  await expect(page.locator('[data-input-mode]')).toHaveAttribute('data-input-mode', /keyboard/)
  await control(page, 'reset').click()
  await expect(primary(page)).toHaveCount(0)
  await setRange(page, 'rotate', 45)
  await setRange(page, 'deflect', 45)
  await setRange(page, 'rotate', 90)
  await primary(page).click()
  const observe = lesson.steps.find((step) => step.interaction.kind === 'observe')!
  await expect(stage(page)).toHaveAttribute('data-stage', observe.id)
  await ready(page)
  await control(page, 'advance').click()
  await control(page, 'withdraw').click()
  await control(page, 'suction').check()
  await control(page, 'suction').uncheck()
  await expect(primary(page)).toBeEnabled()
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('the survey distinguishes entering from inspecting and refuses an unseen-airway claim', async ({
  page,
}) => {
  await reachAct(page, 'systematic-survey')
  await ready(page)
  const rows = page.locator('[data-inspection-ledger] [data-ledger-row]')
  await expect(rows).toHaveCount(6)
  await expect(page.locator('[data-ledger-row="RLL"]')).not.toHaveAttribute(
    'data-ledger-status',
    'inspected',
  )
  const rll = page.locator('[data-ledger-row="RLL"] select')
  expect(await rll.locator('option[value="inspected"]').isDisabled()).toBe(true)
  const rb10 = page.locator('[data-ledger-row="RB10"] select')
  expect(await rb10.locator('option[value="not-safely-accessible"]').isDisabled()).toBe(true)
  await rb10.selectOption('not-observed')
  await expect(rb10).toHaveValue('')
  await expect(page.locator('[data-ledger-row="RB10"]')).toHaveAttribute(
    'data-ledger-status',
    'not-observed',
  )
  await expect(primary(page)).toHaveCount(0)
  await expect(page.locator('[data-scope-scene]')).toContainText(
    'Entering an airway is not inspecting it',
  )
})

test('the report refuses unsupported claims and only opens Continue when every field is supported', async ({
  page,
}) => {
  const { lesson } = await reachAct(page, 'honest-report')
  const interaction = lesson.steps.find((step) => step.interaction.kind === 'report')!.interaction
  if (interaction.kind !== 'report') throw new Error('Report expected')
  await expect(primary(page)).toHaveCount(0)
  const field = interaction.report.fields.find((entry) =>
    entry.options.some((option) => !option.supported),
  )!
  const rejected = field.options.find((option) => !option.supported)!
  const row = page.locator('[data-report-field="' + field.id + '"]')
  await row.locator('input[value="' + rejected.id + '"]').click()
  await expect(row).toHaveAttribute('data-outcome', 'refused')
  await expect(primary(page)).toHaveCount(0)
  for (const entry of interaction.report.fields) {
    const supported = entry.options.find((option) => option.supported)!
    await page
      .locator('[data-report-field="' + entry.id + '"] input[value="' + supported.id + '"]')
      .check()
  }
  await expect(page.locator('[data-report-field][data-outcome="held"]')).toHaveCount(
    interaction.report.fields.length,
  )
  await expect(primary(page)).toBeEnabled()
})

test('Practice records the first answer and offers its paired lesson', async ({ page }) => {
  await page.goto(base + '/practice')
  await page.locator('[data-next-case]').click()
  await expect(page.locator('[data-prediction-choices]')).toBeVisible()
  await page.locator('[data-prediction-choices] input').first().check()
  await page.getByRole('button', { name: 'Submit this answer' }).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute('data-revealed', 'true')
  expect(Object.keys((await record(page)).firstAttempts)).toHaveLength(1)
  await expect(page.locator('a[href*="learn?section="]')).not.toHaveCount(0)
})

test('capstone with one unsafe critical decision does not meet the standard', async ({ page }) => {
  await page.goto(base + '/assess')
  await expect(page.locator('[data-capstone="locked"]')).toBeVisible()
  await page.evaluate(
    ({ key, empty, ids }) =>
      localStorage.setItem(key, JSON.stringify({ ...empty, completedSectionIds: ids })),
    { key: BRONCH_STORAGE_KEY, empty: createEmptyBronchRecord(), ids: BRONCH_SECTION_IDS },
  )
  await page.reload()
  await expect(page.locator('[data-capstone="deciding"]')).toBeVisible()
  await expect(page.locator('[data-prediction-choices]')).toHaveCount(1)
  for (const [index, entry] of CAPSTONE_CASES.entries()) {
    const item = capstoneStageItem(entry.id).item
    const choice =
      index === 0
        ? item.choices.find((option) => option.plausibility === 'unsafe')!.id
        : item.correctChoiceIds[0]
    await page
      .locator('[data-capstone-case="' + entry.id + '"] input[value="' + choice + '"]')
      .check()
    await page.getByRole('button', { name: 'Submit this decision' }).click()
    if (index === 0) await expect(page.locator('[data-answer-verdict][role="alert"]')).toBeVisible()
    if (index === 1) {
      await expect(
        page.locator('[data-capstone-case="' + entry.id + '"] [data-answer-verdict]'),
      ).toHaveAttribute('data-revealed', 'false')
      await expect(page.locator('[data-case-pairing]')).toHaveCount(0)
    }
  }
  await expect(page.locator('[data-capstone-debrief]')).toHaveAttribute(
    'data-standard',
    'not-yet-met',
  )
  await expect(page.locator('[data-capstone-standard]')).toContainText('Seven of eight')
  await expect(page.locator('[data-case-pairing]')).toHaveCount(8)
  await page.reload()
  await expect(page.locator('[data-capstone-debrief]')).toHaveAttribute(
    'data-standard',
    'not-yet-met',
  )
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 700 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]) {
  test('lesson surfaces reflow at ' + viewport.width + 'px', async ({ page }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const id of [
      'shared-airway',
      'five-controls',
      'branch-entry',
      'right-side',
      'systematic-survey',
      'honest-report',
    ] as const) {
      const lesson = await openSection(page, id)
      const stepsTab = page.getByRole('tab', { name: 'Steps', exact: true })
      if (await stepsTab.isVisible()) await stepsTab.click()
      await expect(primary(page)).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      const simTab = page.getByRole('tab', { name: 'Simulator', exact: true })
      if (await simTab.isVisible()) {
        await page.screenshot({ path: info.outputPath(id + '-' + viewport.width + '-steps.png') })
        await simTab.click()
      }
      if (lesson.section.workspace.kind === 'scope') {
        await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
        await ready(page)
        await expect
          .poll(() =>
            page.locator('[data-ostium-pin]').evaluateAll((elements) => {
              const boxes = elements
                .filter((element) => element.textContent?.trim() !== '·')
                .map((element) => element.getBoundingClientRect())
              return boxes.some((a, index) =>
                boxes
                  .slice(index + 1)
                  .some(
                    (b) =>
                      Math.min(a.right, b.right) > Math.max(a.left, b.left) + 0.5 &&
                      Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 0.5,
                  ),
              )
            }),
          )
          .toBe(false)
      }
      if (lesson.section.workspace.kind === 'media')
        await expect(page.locator('[data-media-workspace] img')).toHaveCount(
          lesson.section.workspace.media.length,
        )
      if (lesson.section.workspace.kind === 'map') {
        const map = page.getByRole('group', { name: 'The airway map', exact: true })
        await expect(map.locator('svg')).toBeVisible()
        await map.scrollIntoViewIfNeeded()
      }
      if (await simTab.isVisible()) await expect(simTab).toHaveAttribute('aria-selected', 'true')
      await page.screenshot({ path: info.outputPath(id + '-' + viewport.width + '.png') })
    }
    expect(errors).toEqual([])
  })
}
