import { createHash } from 'crypto'
import { expect, test, type Page } from '@playwright/test'
import { bronchStageLesson } from '../src/features/bronchoscopy-foundations/content/stageLessons'
import type { BronchSectionId } from '../src/features/bronchoscopy-foundations/content/pathway'
import { sampleEdgePose } from '../src/lib/airway-anatomy/scope-state'
import {
  scopeControlId,
  type AirwayLabel,
  type ScopeCommand,
} from '../src/features/bronchoscopy-foundations/components/scope/types'
import { scopeGoalStatuses } from '../src/features/bronchoscopy-foundations/engine/scope/scopeGoalEvaluation'
import { ScopePilot } from '../src/features/bronchoscopy-foundations/test-support/scopePilot'
import { ScopeDriver } from '../src/features/bronchoscopy-foundations/test-support/teachingCase'
import { COURSE_FLOWS } from '../src/features/bronchoscopy-foundations/content/courseFlow'
import { SCOPE_CONTROL_PANEL } from '../src/features/bronchoscopy-foundations/content/controlPanel'
import { LOCAL_POLICY_NOT_SUPPLIED } from '../src/features/bronchoscopy-foundations/content/localPolicies'
import { bronchSection } from '../src/features/bronchoscopy-foundations/content/pathway'
import { SOURCE_BY_ID } from '../src/features/bronchoscopy-foundations/data/sources'
import {
  SUPPLIED_RECORD_IDENTITY,
  SUPPLIED_TEACHING_REPORT_ID,
} from '../src/features/bronchoscopy-foundations/engine/inspectionReport'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
} from '../src/features/bronchoscopy-foundations/engine/learnProgress'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  createEmptyBronchSelfPacedRecord,
} from '../src/features/bronchoscopy-foundations/engine/selfPacedProgress'
import {
  isRotationOf,
  sequenceOrderForRound,
} from '../src/features/bronchoscopy-foundations/engine/sequenceOrder'

/**
 * BF-PRE-REVIEW-04 — teaching clarity, honest review state, the survey-to-report path, and the
 * 3D view's retry (BF-01 finding 3). Real routes of the production build with native pointer and
 * keyboard input: no forced clicks, no injected reducer state, no fabricated survey.
 */
test.skip(!process.env.BRONCH_FOUNDATIONS_BASE_URL, 'Use the dedicated config and a local server.')
test.setTimeout(120_000)

const base = '/en/bronchoscopy-foundations'
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const skip = (page: Page) => page.locator('[data-now-card] [data-now-skip]')
const stage = (page: Page) => page.locator('[data-stage]')
const three = (page: Page) => page.locator('[data-three-state]')
const sha256 = (value: string | null) =>
  value === null ? null : createHash('sha256').update(value).digest('hex')

test.beforeEach(async ({ page }) => {
  const url = process.env.BRONCH_FOUNDATIONS_BASE_URL!
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local server required')
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
})

async function openSection(page: Page, id: BronchSectionId) {
  const lesson = bronchStageLesson(id)
  await page.goto(base + '/learn?section=' + id)
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  return lesson
}

/** Walks to the first step of the given kind by the ways on the page offers, answering nothing. */
async function walkTo(page: Page, id: BronchSectionId, stop: (stepId: string) => boolean) {
  const lesson = await openSection(page, id)
  for (let guard = 0; guard <= lesson.steps.length; guard += 1) {
    const stepId = (await stage(page).getAttribute('data-stage'))!
    if (stop(stepId)) return lesson
    if (await skip(page).count()) await skip(page).click()
    else await primary(page).click()
    await expect(stage(page)).not.toHaveAttribute('data-stage', stepId)
  }
  throw new Error('step not reached')
}

async function stored(page: Page) {
  return page.evaluate(
    ([current, earlier]) => ({
      current: localStorage.getItem(current),
      earlier: localStorage.getItem(earlier),
    }),
    [BRONCH_SELF_PACED_STORAGE_KEY, BRONCH_STORAGE_KEY],
  )
}

test.describe('BF-01 finding 3: the 3D view comes back after an asset failure', () => {
  const LARYNX_ASSETS = '**/anatomy/larynx/**'

  async function failedLarynxScene(page: Page) {
    await page.route(LARYNX_ASSETS, (route) => route.abort())
    const lesson = bronchStageLesson('larynx-and-entry')
    const act = lesson.steps.find((step) => step.interaction.kind === 'scope-task')!
    await walkTo(page, 'larynx-and-entry', (stepId) => stepId === act.id)
    await three(page).scrollIntoViewIfNeeded()
    await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
    await expect(page.getByText('The 3D view could not be loaded.')).toBeVisible()
  }

  test('failure, schematic view, then Try the 3D view again reaches a drawn scene', async ({
    page,
  }) => {
    await failedLarynxScene(page)
    await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
    await expect(page.locator('[data-scope-state="fallback"]')).toBeVisible()
    await page.unroute(LARYNX_ASSETS)
    const retry = page.getByRole('button', { name: 'Try the 3D view again', exact: true })
    await retry.focus()
    await page.keyboard.press('Enter')
    await three(page).scrollIntoViewIfNeeded()
    await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
    // The controls open with the drawn scene, and the learner's command reaches the model.
    await expect(page.locator('[data-scope-state="ready"]')).toBeVisible()
  })

  test('a retry that fails again says so, and each further retry is a new bounded attempt', async ({
    page,
  }) => {
    await failedLarynxScene(page)
    await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByRole('button', { name: 'Try the 3D view again', exact: true }).click()
      await three(page).scrollIntoViewIfNeeded()
      // Still failing: the view reports the failure instead of staying in "loading".
      await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
      await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
      await expect(page.locator('[data-scope-state="fallback"]')).toBeVisible()
    }
    // The in-place reload is the same machine: failing again returns to failed, not to loading.
    await page.getByRole('button', { name: 'Try the 3D view again', exact: true }).click()
    await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Reload the 3D view', exact: true }).click()
    await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
    // Then the assets come back and one more retry draws.
    await page.unroute(LARYNX_ASSETS)
    await page.getByRole('button', { name: 'Reload the 3D view', exact: true }).click()
    await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
  })
})

test('BF-01 finding 3: an attempt that hangs fails at its deadline, and the retry asks again', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const LARYNX_ASSETS = '**/anatomy/larynx/**'
  // The request is never answered: neither a failure nor a model.
  await page.route(LARYNX_ASSETS, () => new Promise(() => {}))
  const lesson = bronchStageLesson('larynx-and-entry')
  const act = lesson.steps.find((step) => step.interaction.kind === 'scope-task')!
  await walkTo(page, 'larynx-and-entry', (stepId) => stepId === act.id)
  await three(page).scrollIntoViewIfNeeded()
  await expect(three(page)).toHaveAttribute('data-three-state', 'loading')
  // While it waits, the dock says the controls are waiting too.
  await expect(page.locator('[data-scope-controls-waiting]')).toContainText('still loading')
  await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 70_000 })
  await expect(three(page)).toHaveAttribute('data-three-failure', 'deadline')
  await expect(
    page.getByRole('button', { name: 'Use the schematic view', exact: true }),
  ).toBeVisible()
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await page.getByRole('button', { name: 'Reload the 3D view', exact: true }).click()
  await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
  await expect(three(page)).toHaveAttribute('data-three-attempt', '1')
  await expect(page.locator('[data-scope-controls-waiting]')).toHaveCount(0)
})

/* ------------------------------------------------------------------ *
 * Teaching clarity, honest status and the survey-to-report path
 * ------------------------------------------------------------------ */

const MATRIX = [
  { width: 1204, height: 987, text: 100 },
  { width: 1440, height: 900, text: 100 },
  { width: 1024, height: 768, text: 100 },
  { width: 390, height: 844, text: 100 },
  { width: 320, height: 740, text: 100 },
  // Root font size set to 200% (CSS text enlargement), not native browser zoom.
  { width: 1204, height: 987, text: 200 },
  { width: 390, height: 844, text: 200 },
] as const
const sizeName = (size: (typeof MATRIX)[number]) =>
  `${size.width}×${size.height}, ${size.text}% root text`

async function applySize(page: Page, size: (typeof MATRIX)[number]) {
  await page.setViewportSize({ width: size.width, height: size.height })
  if (size.text === 200)
    await page.addInitScript(() => {
      const enlarge = () => {
        document.documentElement.style.fontSize = '200%'
      }
      if (document.documentElement) enlarge()
      document.addEventListener('DOMContentLoaded', enlarge)
    })
}

/**
 * Nothing in the course makes the page scroll sideways. At 200% root text the site's own header
 * and footer overflow the page (shared chrome, recorded by BF-PRE-REVIEW-02 and unchanged here), so
 * there the course region is measured on its own.
 */
async function courseFits(page: Page) {
  return page.evaluate(() => {
    const course = document.querySelector('[data-stage]')
    if (!course) return { fits: false, widest: 'no course' }
    const enlarged = document.documentElement.style.fontSize === '200%'
    const pageFits = document.documentElement.scrollWidth <= innerWidth + 1
    const courseFitsItself = course.scrollWidth <= course.clientWidth + 1
    return {
      fits: courseFitsItself && (enlarged || pageFits),
      widest: courseFitsItself ? (enlarged || pageFits ? '' : 'page') : 'course',
    }
  })
}

/** Fully inside the viewport and not covered: the element can be read and taken with a pointer. */
async function usable(page: Page, selector: string) {
  const target = page.locator(selector).first()
  await target.scrollIntoViewIfNeeded()
  return target.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const x = Math.min(innerWidth - 2, Math.max(1, box.left + box.width / 2))
    const y = Math.min(innerHeight - 2, Math.max(1, box.top + Math.min(box.height / 2, 12)))
    const top = document.elementFromPoint(x, y)
    return {
      inside: box.left >= -1 && box.right <= innerWidth + 1 && box.width > 0 && box.height > 0,
      onTop: !!top && (node === top || node.contains(top) || top.contains(node)),
      tall: box.height >= 24,
    }
  })
}

/* A synthetic stored record: the shape the survey section saves, partly declared. It stands in for
 * a survey finished earlier on this device; the genuine-survey case below makes one by hand. */
const SURVEY_AT = '2026-10-05T10:00:00.000Z'
const surveyRow = (label: string, patch: Record<string, unknown>) => ({
  label,
  identified: true,
  ostiumVisualized: true,
  entered: false,
  distalViewObtained: false,
  inspected: 'no',
  limitation: null,
  ...patch,
})
const SYNTHETIC_SURVEY = {
  sectionId: 'systematic-survey',
  at: SURVEY_AT,
  rows: [
    surveyRow('RLL', { entered: true, distalViewObtained: true, inspected: 'declared' }),
    surveyRow('RB6', { entered: true, distalViewObtained: true, inspected: 'declared' }),
    surveyRow('RB7', { entered: true }),
    surveyRow('RB8', {}),
    surveyRow('RB9', { ostiumVisualized: false, identified: false, limitation: 'not-observed' }),
    surveyRow('RB10', { limitation: 'not-safely-accessible' }),
  ],
}
const CURRENT_WITH_SURVEY = JSON.stringify({
  ...createEmptyBronchSelfPacedRecord(),
  surveySnapshot: SYNTHETIC_SURVEY,
  updatedAt: SURVEY_AT,
})
const LEGACY_WITH_SURVEY = JSON.stringify({
  ...createEmptyBronchRecord(),
  completedSectionIds: ['systematic-survey'],
  inspectionSnapshot: SYNTHETIC_SURVEY,
  updatedAt: '2026-09-01T00:00:00.000Z',
})

/** Seeds storage once, before the app's first script, and never again on a later navigation. */
async function seedStorage(page: Page, entries: Readonly<Record<string, string>>) {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('bf04-seeded')) return
    sessionStorage.setItem('bf04-seeded', '1')
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value)
  }, entries)
}

const reportStepId = bronchStageLesson('honest-report').steps.find(
  (step) => step.course?.learnerRecord,
)!.id
const openReport = (page: Page) =>
  walkTo(page, 'honest-report', (stepId) => stepId === reportStepId)
const choice = (page: Page, kind: 'learner' | 'supplied' | 'none') =>
  page.locator(`[data-survey-record-option="${kind}"] input`)
const reportFields = (page: Page) =>
  page
    .locator('[data-report-field]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-report-field')))
const surveyOnDevice = async (page: Page) =>
  JSON.stringify(JSON.parse((await stored(page)).current ?? 'null')?.surveySnapshot ?? null)

test.describe('A35: the report is written from a record that is named for what it is', () => {
  for (const size of MATRIX) {
    test(`my survey, the supplied record and no evidence stay apart at ${sizeName(size)}`, async ({
      page,
    }) => {
      await applySize(page, size)
      await seedStorage(page, {
        [BRONCH_SELF_PACED_STORAGE_KEY]: CURRENT_WITH_SURVEY,
        [BRONCH_STORAGE_KEY]: LEGACY_WITH_SURVEY,
      })
      await openReport(page)
      const legacyBefore = sha256((await stored(page)).earlier)
      expect(legacyBefore).toBe(sha256(LEGACY_WITH_SURVEY))
      const surveyBefore = await surveyOnDevice(page)
      expect(surveyBefore).toBe(JSON.stringify(SYNTHETIC_SURVEY))

      // The learner's own survey is the default and is shown as recorded.
      await expect(choice(page, 'learner')).toBeChecked()
      await expect(page.locator('[data-bronch-report]')).toHaveAttribute(
        'data-bronch-report',
        'report-from-your-survey',
      )
      const mine = await reportFields(page)
      expect(mine).toEqual([
        'survey-source',
        'survey-RLL',
        'survey-RB6',
        'survey-RB7',
        'survey-RB8',
        'survey-RB9',
        'survey-RB10',
        'survey-larynx',
      ])
      const mineEvidence = await page.locator('[data-report-field-evidence]').allTextContents()
      // Each choice can be reached by keyboard and is not left under the page's fixed chrome: the
      // focused control itself is on screen and on top, with a label wide enough to read.
      for (const kind of ['learner', 'supplied', 'none'] as const) {
        await choice(page, kind).focus()
        const reach = await choice(page, kind).evaluate((input) => {
          const box = input.getBoundingClientRect()
          const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          const label = input.closest('label')!.getBoundingClientRect()
          return {
            onScreen: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0,
            onTop: top === input || !!top?.closest('label')?.contains(input),
            labelFits: label.left >= -1 && label.right <= innerWidth + 1 && label.height >= 24,
          }
        })
        expect([kind, reach]).toEqual([kind, { onScreen: true, onTop: true, labelFits: true }])
      }

      // Keyboard: the native radio group moves from "mine" to the supplied record.
      await choice(page, 'learner').focus()
      await page.keyboard.press('ArrowDown')
      await expect(choice(page, 'supplied')).toBeChecked()
      await expect(page.locator('[data-bronch-report]')).toHaveAttribute(
        'data-bronch-report',
        SUPPLIED_TEACHING_REPORT_ID,
      )
      const identity = page.locator('[data-supplied-record-identity]')
      await expect(identity).toContainText(SUPPLIED_RECORD_IDENTITY)
      expect((await usable(page, '[data-supplied-record-identity]')).inside).toBe(true)
      await expect(page.locator('[data-report-evidence]')).toContainText(SUPPLIED_RECORD_IDENTITY)
      expect(await reportFields(page)).toEqual([
        'survey-source',
        'survey-LB6',
        'survey-LB7+8',
        'survey-LB9',
        'survey-LB10',
        'survey-larynx',
      ])
      for (const evidence of await page
        .locator('[data-report-field^="survey-LB"] [data-report-field-evidence]')
        .allTextContents())
        expect(evidence).toMatch(/^Supplied teaching record, not your examination:/)
      await expect(page.locator('[data-stage]')).not.toContainText('Your completed survey record')
      expect(await courseFits(page)).toEqual({ fits: true, widest: '' })

      // Pointer: calling the supplied record one's own examination is refused.
      const source = page.locator('[data-report-field="survey-source"]')
      await source.locator('input[value="own-examination"]').click()
      await expect(source).toHaveAttribute('data-outcome', 'refused')
      for (const [field, option] of [
        ['survey-source', 'supplied-evidence'],
        ['survey-LB6', 'recorded-status'],
        ['survey-LB7+8', 'recorded-status'],
        ['survey-LB9', 'recorded-status'],
        ['survey-LB10', 'recorded-status'],
        ['survey-larynx', 'not-assessed'],
      ] as const)
        await page.locator(`[data-report-field="${field}"] input[value="${option}"]`).check()
      await expect(page.locator('[data-now-status]')).toContainText(
        'It was not your examination, and nothing was saved as your survey.',
      )
      await expect(primary(page)).toBeEnabled()

      // Nothing was written: the learner's survey and the earlier record's bytes are what they were.
      expect(await surveyOnDevice(page)).toBe(surveyBefore)
      expect(sha256((await stored(page)).earlier)).toBe(legacyBefore)
      expect((await stored(page)).current).not.toContain('LB6')

      // Back to the learner's own survey: the same fields and the same evidence, nothing carried.
      await choice(page, 'learner').check()
      expect(await reportFields(page)).toEqual(mine)
      expect(await page.locator('[data-report-field-evidence]').allTextContents()).toEqual(
        mineEvidence,
      )
      await expect(identity).toHaveCount(0)
      await expect(page.locator('[data-report-field][data-outcome]')).toHaveCount(0)
      await expect(primary(page)).toHaveCount(0)

      // No evidence: neither record's rows are shown.
      await choice(page, 'none').check()
      expect(await reportFields(page)).toEqual(['survey-source', 'survey-larynx'])
      await expect(skip(page)).toHaveText('Continue without completing')
      expect(await courseFits(page)).toEqual({ fits: true, widest: '' })
      expect(await surveyOnDevice(page)).toBe(surveyBefore)
      expect(sha256((await stored(page)).earlier)).toBe(legacyBefore)
    })
  }

  test('no survey, a legacy-only record and a broken record all leave "mine" unavailable', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    // No stored record at all.
    await openReport(page)
    await expect(choice(page, 'learner')).toBeDisabled()
    await expect(choice(page, 'none')).toBeChecked()
    await expect(page.locator('[data-survey-record-option="learner"]')).toContainText(
      'Not available',
    )
    expect(await reportFields(page)).toEqual(['survey-source', 'survey-larynx'])
    await page.close()

    // The earlier course's survey only: unread, unoffered, bytes unchanged.
    const legacyOnly = await context.newPage()
    await legacyOnly.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
    await legacyOnly.setViewportSize({ width: 1204, height: 987 })
    await seedStorage(legacyOnly, { [BRONCH_STORAGE_KEY]: LEGACY_WITH_SURVEY })
    await openReport(legacyOnly)
    await expect(choice(legacyOnly, 'learner')).toBeDisabled()
    await choice(legacyOnly, 'supplied').check()
    await expect(legacyOnly.locator('[data-supplied-record-identity]')).toBeVisible()
    expect(sha256((await stored(legacyOnly)).earlier)).toBe(sha256(LEGACY_WITH_SURVEY))
    expect(await surveyOnDevice(legacyOnly)).toBe('null')
    await legacyOnly.close()

    // A current record that does not parse is no survey; a reviewed mark alone is no survey.
    for (const current of [
      '{"version":1,"surveySnapshot":',
      JSON.stringify({
        ...createEmptyBronchSelfPacedRecord(),
        visitedSectionIds: ['systematic-survey'],
        reviewedSectionIds: ['systematic-survey'],
      }),
    ]) {
      const next = await context.newPage()
      await next.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
      await next.setViewportSize({ width: 1204, height: 987 })
      await seedStorage(next, { [BRONCH_SELF_PACED_STORAGE_KEY]: current })
      await openReport(next)
      await expect(choice(next, 'learner')).toBeDisabled()
      expect(await reportFields(next)).toEqual(['survey-source', 'survey-larynx'])
      await next.close()
    }
  })

  test('finishing the section after the supplied record saves no survey; S12 says the survey is used again', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    const lesson = await openReport(page)
    await choice(page, 'supplied').check()
    for (const [field, option] of [
      ['survey-source', 'supplied-evidence'],
      ['survey-LB6', 'recorded-status'],
      ['survey-LB7+8', 'recorded-status'],
      ['survey-LB9', 'recorded-status'],
      ['survey-LB10', 'recorded-status'],
      ['survey-larynx', 'not-assessed'],
    ] as const)
      await page.locator(`[data-report-field="${field}"] input[value="${option}"]`).check()
    for (let guard = 0; guard <= lesson.steps.length + 1; guard += 1) {
      if (await page.locator('[data-section-completion]').count()) break
      if (await skip(page).count()) await skip(page).click()
      else await primary(page).click()
    }
    await expect(page.locator('[data-section-completion]')).toBeVisible()
    const saved = JSON.parse((await stored(page)).current!)
    expect(saved.reviewedSectionIds).toEqual(['honest-report'])
    expect(saved.surveySnapshot).toBeNull()
    expect((await stored(page)).earlier).toBeNull()

    const survey = bronchStageLesson('systematic-survey')
    const act = survey.steps.find((step) => step.interaction.kind === 'scope-task')!
    await walkTo(page, 'systematic-survey', (stepId) => stepId === act.id)
    const note = page.locator('[data-course-note="record-use"]')
    await expect(note).toContainText(bronchSection('honest-report').title)
    await expect(note).toContainText('nothing is filled in for you')
    // The supplied record never appears in the survey section.
    await expect(page.locator('[data-stage]')).not.toContainText('Supplied teaching record')
    await expect(page.locator('[data-ledger-row="LB6"]')).toHaveCount(0)
  })
})

test.describe('A7: the S14 ordering task', () => {
  const sequence = (() => {
    const act = bronchSection('washing-and-lavage').act
    if (act.kind !== 'sequence') throw new Error('S14 is a sequence')
    return act.sequence
  })()
  const authored = sequence.steps.map((step) => step.id)
  const sequenceStepId = bronchStageLesson('washing-and-lavage').steps.find(
    (step) => step.interaction.kind === 'sequence',
  )!.id
  const shown = (page: Page) =>
    page
      .locator('[data-bronch-sequence] > ol [data-sequence-step]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-sequence-step')!))

  for (const size of [MATRIX[0], MATRIX[3], MATRIX[6]]) {
    test(`a stable order, the worked order on request, and an optional reshuffle at ${sizeName(size)}`, async ({
      page,
    }) => {
      await applySize(page, size)
      await walkTo(page, 'washing-and-lavage', (stepId) => stepId === sequenceStepId)
      const first = await shown(page)
      expect(first).toEqual(sequenceOrderForRound(sequence, 0))
      expect(isRotationOf(first, authored)).toBe(false)

      // The worked order opens before any attempt, and closing it rearranges nothing.
      await page.locator('[data-show-explanation]').focus()
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-sequence-explanation] li')).toHaveCount(authored.length)
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-sequence-explanation]')).toHaveCount(0)
      expect(await shown(page)).toEqual(first)

      // Keyboard ordering: the second step moves up one place, and stays there.
      const second = page.locator(`[data-sequence-step="${first[1]}"]`)
      await second.locator('button[aria-label^="Move up"]').focus()
      await page.keyboard.press('Enter')
      const arranged = await shown(page)
      expect(arranged.slice(0, 2)).toEqual([first[1], first[0]])

      // A reload opens the same first order: it is a function of the task, not a draw.
      await page.reload()
      await walkTo(page, 'washing-and-lavage', (stepId) => stepId === sequenceStepId)
      expect(await shown(page)).toEqual(first)

      // The reshuffle is the learner's own, optional request.
      const shuffle = page.locator('[data-sequence-shuffle]')
      expect((await usable(page, '[data-sequence-shuffle]')).inside).toBe(true)
      await shuffle.click()
      const reshuffled = await shown(page)
      expect(reshuffled).toEqual(sequenceOrderForRound(sequence, 1))
      expect(isRotationOf(reshuffled, authored)).toBe(false)
      await expect(page.locator('[data-sequence-shuffle-note]')).toContainText('same steps')
      await expect(skip(page)).toHaveText('Continue without checking')
      expect(await courseFits(page)).toEqual({ fits: true, widest: '' })

      // Checking a misplaced order names the worked position; trying again starts a new order.
      await primary(page).click()
      await expect(page.locator('[data-sequence-verdict]')).toHaveCount(authored.length)
      await page.locator('[data-now-card] [data-now-secondary]').click()
      const again = await shown(page)
      expect(again).toEqual(sequenceOrderForRound(sequence, 2))
      expect(JSON.parse((await stored(page)).current!).surveySnapshot).toBeNull()
    })
  }
})

test.describe('wayfinding, first-use names and honest status', () => {
  for (const size of [MATRIX[0], MATRIX[2], MATRIX[4], MATRIX[5]]) {
    test(`a repeat is named, policy is said once and parts are numbered honestly at ${sizeName(size)}`, async ({
      page,
    }) => {
      await applySize(page, size)

      // A6: the S1 check says it repeats the worked example, and keeps its help and its skip.
      const s1 = bronchStageLesson('shared-airway')
      const check = s1.steps.find((step) => step.course?.id === 'check')!
      await walkTo(page, 'shared-airway', (stepId) => stepId === check.id)
      const rehearsal = page.locator('[data-course-note="rehearsal"]')
      await expect(rehearsal).toContainText('Guided rehearsal, not a new case.')
      expect((await usable(page, '[data-course-note="rehearsal"]')).inside).toBe(true)
      await expect(page.locator('[data-show-explanation]')).toBeVisible()
      await expect(skip(page)).toHaveText('Continue without answering')
      await expect(
        page.getByText(`about ${s1.minutes} min (estimate, not timed with learners)`),
      ).toBeVisible()
      expect(await courseFits(page)).toEqual({ fits: true, widest: '' })

      // A14: three policy blocks on one part, one statement, each block naming its own policy.
      const s2 = bronchStageLesson('clinical-question')
      const planning = s2.steps.find((step) => step.course?.id === 'planning')!
      await walkTo(page, 'clinical-question', (stepId) => stepId === planning.id)
      const teaching = (await page.locator('[data-course-teaching]').textContent()) ?? ''
      expect(teaching.split(LOCAL_POLICY_NOT_SUPPLIED).length - 1).toBe(1)
      expect(teaching).not.toContain('Not configured')
      await expect(
        page.locator('[data-block-policies][data-local-policy-note="short"]'),
      ).toHaveCount(
        COURSE_FLOWS['clinical-question']!.find((chunk) => chunk.id === 'planning')!.blocks.filter(
          (id) => (s2.section.blocks.find((block) => block.id === id)?.localPolicyIds ?? []).length,
        ).length,
      )
      const link = page.locator('[data-part-policies] a[data-reference-link="local-policies"]')
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('href', /\/reference#local-policies$/)
      expect((await usable(page, '[data-part-policies] a')).inside).toBe(true)
      expect(await courseFits(page)).toEqual({ fits: true, widest: '' })

      // A34: the second topic of S21 is announced where it starts.
      const s21 = bronchStageLesson('icu-physiology')
      const second = s21.steps.find((step) => step.course?.id === 'procedure-purpose')!
      await walkTo(page, 'icu-physiology', (stepId) => stepId === second.id)
      await expect(page.locator('[data-course-note="topic-change"]')).toContainText(
        'A second topic starts here.',
      )
      expect(await courseFits(page)).toEqual({ fits: true, widest: '' })
    })
  }

  test('A11, A39, A19: the five controls, sub-step positions and the S3 part names', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    const lesson = await openSection(page, 'five-controls')
    await expect(page.locator('[data-five-control]')).toHaveText(
      SCOPE_CONTROL_PANEL.controls.map((control) => control.plainName),
    )
    await expect(page.locator('[data-five-controls-list]')).toContainText(
      'separate from the five questions',
    )
    const positions: string[] = []
    for (let index = 0; index < lesson.steps.length; index += 1) {
      positions.push((await page.locator('[data-now-focus] p').first().textContent()) ?? '')
      if (index === lesson.steps.length - 1) break
      const before = (await stage(page).getAttribute('data-stage'))!
      if (await skip(page).count()) await skip(page).click()
      else await primary(page).click()
      await expect(stage(page)).not.toHaveAttribute('data-stage', before)
    }
    expect(new Set(positions).size).toBe(positions.length)
    expect(positions.filter((line) => /step 2 of 2/.test(line)).length).toBeGreaterThan(0)

    const s3 = await openSection(page, 'pre-use-check')
    const act = s3.section.act
    if (act.kind !== 'identify') throw new Error('S3 is an identify set')
    const names = [
      ...new Set(act.identify.rows.flatMap((row) => row.choices.map((entry) => entry.label))),
    ].sort()
    const defined = (await page.locator('[data-part-names-first-use] dt').allTextContents()).sort()
    expect(defined).toEqual(names)
    await expect(page.locator('[data-part-names-first-use] dd').first()).toBeVisible()
  })

  test('A31, A41, SUP-10: reflection is unrecorded, the record explains itself, the map has a key', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const left = bronchStageLesson('left-side')
    const act = left.steps.find((step) => step.interaction.kind === 'scope-task')!
    await walkTo(page, 'left-side', (stepId) => stepId === act.id)
    // The note sits with the coaching: the scene still comes on screen and draws on a phone.
    await three(page).scrollIntoViewIfNeeded()
    await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
    await expect(page.locator('[data-course-note="reflection"]')).toContainText(
      'no goal depends on it',
    )
    for (const label of await page.locator('[data-step-goals] li').allTextContents())
      expect(label).not.toMatch(/\bsay\b/i)
    await expect(skip(page)).toHaveText('Continue without completing')

    await page.setViewportSize({ width: 1024, height: 768 })
    const survey = bronchStageLesson('systematic-survey')
    const surveyAct = survey.steps.find((step) => step.interaction.kind === 'scope-task')!
    await walkTo(page, 'systematic-survey', (stepId) => stepId === surveyAct.id)
    await three(page).scrollIntoViewIfNeeded()
    await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
    const legend = page.locator('[data-ledger-legend]')
    await legend.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(legend.locator('[data-ledger-legend-entry="model"]')).toContainText(
      'Neither is a declaration, and neither is an inspection.',
    )
    await expect(legend.locator('[data-ledger-legend-entry="learner"]')).toContainText(
      'Your declarations, made in the Declare column.',
    )
    // The record is unchanged by reading about it.
    await expect(page.locator('[data-ledger-row="RLL"]')).not.toHaveAttribute(
      'data-ledger-status',
      'inspected',
    )
    // Below the width where the view and the map share a row, the map is its own tab.
    const mapTab = page.getByRole('tab', { name: 'Airway map' })
    if (await mapTab.isVisible()) await mapTab.click()
    const key = page.locator('[data-airway-abbreviations]').first()
    await key.locator('summary').click()
    await expect(key.locator('[data-airway-abbreviation="BI"] dd')).toHaveText(
      'Bronchus intermedius',
    )
    expect(await courseFits(page)).toEqual({ fits: true, widest: '' })
  })

  test('A27, A40, A42, A43, SUP-06, SUP-14: instructions, badges, marks, sources and one still', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    // The hub: untimed estimates and what "review pending" means.
    await page.goto(base)
    await expect(page.locator('[data-time-estimate-note]')).toContainText('not measurements')
    await expect(page.locator('[data-pathway-composition]')).toContainText(
      /about \d+ min \(estimate\)/,
    )
    await expect(page.locator('[data-review-status-explained]')).toContainText(
      'not yet recorded here',
    )

    // S4: the monitor says what its badges are compared against.
    await openSection(page, 'sedation-and-monitoring')
    await expect(page.locator('[data-trend-legend]').first()).toContainText(
      'this patient’s own earlier state',
    )
    // S4 sources: a transcript is named by its file, with its lecture title unverified.
    const summary = page.locator('[data-stage-sources] summary')
    await summary.scrollIntoViewIfNeeded()
    await summary.click()
    const transcript = SOURCE_BY_ID.get('T07')!
    await expect(
      page.locator('[data-stage-sources] [data-evidence-id="T07"] [data-source-title]'),
    ).toHaveText(transcript.displayTitle)
    expect(transcript.displayTitle).toContain('lecture title not verified')

    // S8: the lens step is a guided demonstration on its authored context.
    const s8 = bronchStageLesson('view-loss')
    const lens = s8.steps.find((step) => step.course?.id === 'lens')!
    await walkTo(page, 'view-loss', (stepId) => stepId === lens.id)
    await expect(page.locator('[data-current-instruction]')).toContainText(
      'A guided demonstration of clearing the lens',
    )
    await expect(page.locator('[data-current-instruction]')).not.toContainText(
      'Read the observations',
    )

    // S13: the normal still is on the screen once.
    await openSection(page, 'describe-findings')
    await expect(page.locator('[data-block-id="normal-right-main"] figure')).toHaveCount(0)
    await expect(page.locator('[data-stage] figure')).toHaveCount(1)

    // S23: an all-skip journey to the end; the mark is described as set by reaching the end.
    const s23 = await openSection(page, 'what-completion-means')
    await expect(page.locator('[data-record-reviewed]')).toContainText(
      'The course sets this mark when you reach the end of a section',
    )
    for (let guard = 0; guard <= s23.steps.length + 1; guard += 1) {
      if (await page.locator('[data-section-completion]').count()) break
      if (await skip(page).count()) await skip(page).click()
      else await primary(page).click()
    }
    const card = page.locator('[data-completion-reviewed]')
    await expect(card).toContainText('Reaching the end marked this section reviewed')
    await expect(card).toContainText('not a sign-off')
    await expect(page.locator('[data-completion-competence]')).toContainText(
      'does not establish procedural competence',
    )
    await page.locator('[data-toggle-reviewed]').click()
    await expect(card).toContainText('not marked reviewed')
    expect(JSON.parse((await stored(page)).current!).reviewedSectionIds).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * A genuine survey, made with the page's own controls, then used in the report
 * ------------------------------------------------------------------ */

/**
 * A learner's survey, planned against the same engine the page runs and limited to what the page
 * offers: the fixed Advance and Withdraw steps, whole-degree rotation and deflection, Clear the
 * lens and the Declare menu. The plan is a list of inputs to make; nothing is injected — every one
 * is then made on the real controls, and the page's own record and goals are what is asserted.
 */
function planSurvey(): readonly ScopeCommand[] {
  const act = bronchSection('systematic-survey').act
  if (act.kind !== 'scope-lab') throw new Error('S12 is a scope lab')
  const driver = new ScopeDriver(act.view)
  const sc = driver.scopeCase!
  const step = driver.state.inputs.stepMm
  const sent: ScopeCommand[] = []
  const pilot = new ScopePilot({
    view: act.view,
    scopeCase: sc,
    get state() {
      return driver.state
    },
    send(command: ScopeCommand) {
      const made: ScopeCommand =
        command.type === 'set-rotation' || command.type === 'set-deflection'
          ? { ...command, deg: Math.round(command.deg) }
          : command
      if (made.type === 'advance' && Math.abs(made.mm) !== step)
        throw new Error(`The page has no ${made.mm} mm advance`)
      sent.push(made)
      driver.send(made)
    },
  })
  const origin = (label: AirwayLabel) => sc.originEdge.get(label)!
  const pathTo = (edgeId: number) => {
    const path: number[] = []
    let edge = sc.index.edgesById.get(edgeId)
    while (edge) {
      path.unshift(edge.id)
      const parent = sc.index.nodesById.get(edge.startNodeId)?.parentEdgeId
      edge = parent == null ? undefined : sc.index.edgesById.get(parent)
    }
    return path
  }
  const goTo = (target: number) => {
    const path = pathTo(target)
    for (let guard = 0; pilot.engine.edgeId !== target; guard += 1) {
      if (guard > 200) throw new Error('The plan is stuck')
      const edge = sc.index.edgesById.get(pilot.engine.edgeId)!
      if (edge.lengthMm - pilot.engine.distanceMm > step + 0.01) {
        pilot.straighten()
        pilot.advance()
        continue
      }
      const next = sc.index.edgesById.get(path[path.indexOf(pilot.engine.edgeId) + 1])!
      pilot.aimAtPoint(sampleEdgePose(next, Math.min(8, next.lengthMm)).point)
      pilot.advance()
    }
    pilot.straighten()
  }
  const inspect = (label: AirwayLabel) => {
    goTo(origin(label))
    if (pilot.state.signals.view === 'contaminated') pilot.send({ type: 'clear-lens' })
    const edge = sc.index.edgesById.get(origin(label))!
    const want = Math.min(8, edge.lengthMm * 0.5) + 0.2
    while (
      pilot.engine.edgeId === origin(label) &&
      pilot.engine.distanceMm < want &&
      edge.lengthMm - pilot.engine.distanceMm > step + 0.01
    )
      pilot.advance()
    pilot.send({ type: 'declare', airway: label, status: 'inspected' })
  }
  inspect('RLL')
  for (const label of ['RB6', 'RB7', 'RB8', 'RB9'] as const) {
    inspect(label)
    pilot.withdrawTo('RLL')
  }
  pilot.lookAt('RB10')
  pilot.send({ type: 'declare', airway: 'RB10', status: 'not-safely-accessible' })
  pilot.withdrawToEdge(origin('RLL'))
  goTo(origin('RB6'))
  if (scopeGoalStatuses(act.goals, driver.state).some((status) => !status.met))
    throw new Error('The plan does not meet the survey goals')
  return sent
}

const scopeControl = (page: Page, key: Parameters<typeof scopeControlId>[0]) =>
  page.locator('[id="' + scopeControlId(key) + '"]')

/** A slider moved the way a keyboard user moves it: page keys for the bulk, arrows for the rest. */
async function setSlider(page: Page, key: 'rotate' | 'deflect', value: number) {
  const slider = scopeControl(page, key)
  await slider.focus()
  let current = Number(await slider.inputValue())
  const pageStep =
    (Number(await slider.getAttribute('max')) - Number(await slider.getAttribute('min'))) / 10
  while (Math.abs(value - current) > pageStep) {
    const before = current
    await slider.press(current < value ? 'PageUp' : 'PageDown')
    current = Number(await slider.inputValue())
    if (current === before) break
  }
  for (let guard = 0; current !== value && guard < 400; guard += 1) {
    await slider.press(current < value ? 'ArrowRight' : 'ArrowLeft')
    current = Number(await slider.inputValue())
  }
  expect(current).toBe(value)
}

test('A35: a survey made on the real controls is kept, offered as mine in the report, and never altered by the supplied record', async ({
  page,
}) => {
  test.setTimeout(600_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const plan = planSurvey()
  const survey = bronchStageLesson('systematic-survey')
  const act = survey.steps.find((step) => step.interaction.kind === 'scope-task')!
  await walkTo(page, 'systematic-survey', (stepId) => stepId === act.id)
  await three(page).scrollIntoViewIfNeeded()
  await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
  expect(JSON.parse((await stored(page)).current!).surveySnapshot).toBeNull()

  for (const command of plan) {
    switch (command.type) {
      case 'advance':
        await scopeControl(page, command.mm > 0 ? 'advance' : 'withdraw').press('Enter')
        break
      case 'set-rotation':
        await setSlider(page, 'rotate', command.deg)
        break
      case 'set-deflection':
        await setSlider(page, 'deflect', command.deg)
        break
      case 'clear-lens':
        await scopeControl(page, 'clearLens').press('Enter')
        break
      case 'declare':
        await page
          .locator(`[data-ledger-row="${command.airway}"] select`)
          .selectOption(command.status)
        break
      default:
        throw new Error(`Unplanned input ${command.type}`)
    }
  }

  // The page's own goals and record, read from the page.
  await expect(page.locator('[data-step-goals] li[data-met="true"]')).toHaveCount(5)
  for (const label of ['RLL', 'RB6', 'RB7', 'RB8', 'RB9'])
    await expect(page.locator(`[data-ledger-row="${label}"]`)).toHaveAttribute(
      'data-ledger-status',
      'inspected',
    )
  await expect(page.locator('[data-ledger-row="RB10"]')).toHaveAttribute(
    'data-ledger-status',
    'not-safely-accessible',
  )
  await expect(primary(page)).toBeEnabled()
  // Not saved yet: the survey is kept when the section is finished.
  expect(JSON.parse((await stored(page)).current!).surveySnapshot).toBeNull()
  for (let guard = 0; guard <= survey.steps.length + 1; guard += 1) {
    if (await page.locator('[data-section-completion]').count()) break
    if (await skip(page).count()) await skip(page).click()
    else await primary(page).click()
  }
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  const kept = JSON.parse((await stored(page)).current!).surveySnapshot
  expect(kept.rows.map((row: { label: string }) => row.label)).toEqual([
    'RLL',
    'RB6',
    'RB7',
    'RB8',
    'RB9',
    'RB10',
  ])
  const keptBytes = JSON.stringify(kept)

  // The report offers it as mine, by default, exactly as recorded.
  await openReport(page)
  await expect(choice(page, 'learner')).toBeEnabled()
  await expect(choice(page, 'learner')).toBeChecked()
  await expect(page.locator('[data-report-evidence]')).toContainText('Your completed survey record')
  await expect(
    page.locator('[data-report-field="survey-RB9"] [data-report-field-evidence]'),
  ).toContainText('inspection declared by the learner')
  await expect(
    page.locator('[data-report-field="survey-RB10"] [data-report-field-evidence]'),
  ).toContainText('not safely accessible')
  const mine = await page.locator('[data-report-field-evidence]').allTextContents()

  // The supplied record replaces nothing: after using it, the learner's survey is byte-identical.
  await choice(page, 'supplied').check()
  await expect(page.locator('[data-supplied-record-identity]')).toBeVisible()
  await page.locator('[data-report-field="survey-LB6"] input[value="recorded-status"]').check()
  expect(JSON.stringify(JSON.parse((await stored(page)).current!).surveySnapshot)).toBe(keptBytes)
  await choice(page, 'learner').check()
  expect(await page.locator('[data-report-field-evidence]').allTextContents()).toEqual(mine)
  await page.reload()
  await openReport(page)
  await expect(choice(page, 'learner')).toBeChecked()
  expect(JSON.stringify(JSON.parse((await stored(page)).current!).surveySnapshot)).toBe(keptBytes)
})
