/**
 * The plain learner journey with persistence: hub, every lesson performed for real to its finish,
 * every integrated case, then a reload. Run against an already-started development server; it
 * never seeds or writes learner progress. The detailed per-activity guarantees are
 * `browser-flow-redesign.ts`'s; this checks only what a journey needs.
 */
import { chromium, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { FINAL_CASES } from '../../src/features/ebus-guided/content/cases'
import { LESSONS, lessonHref } from '../../src/features/ebus-guided/content/curriculum'
import {
  activitiesForLesson,
  type LessonActivity,
} from '../../src/features/ebus-guided/content/stage'
import {
  labGoalMet,
  type Lesson,
  type Question,
} from '../../src/features/ebus-guided/content/types'
import { STORAGE_KEY as LEGACY_STORAGE_KEY } from '../../src/features/ebus-guided/engine/progress'
import {
  PROGRESS_STORAGE_KEY,
  type CourseProgress,
} from '../../src/features/ebus-guided/engine/selfPacedProgress'
import { performRecorded, performRecord } from './browser-flow-actions'
import { linkedObservation, observeLinked, performLinked } from './browser-linked-actions'
import { performModel } from './browser-model-actions'

const WORKBENCH = 'iframe[title="EBUS workbench"]'
const out = 'artifacts/ebus-guided'
const primary = (page: Page) => page.locator('[data-now-primary]')
const storedProgress = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as CourseProgress | null,
    PROGRESS_STORAGE_KEY,
  )

/** Select the keyed response and check it; the caller moves on. */
async function answer(page: Page, question: Question) {
  const card = page.locator(`[data-question-id="${question.id}"]`)
  await card
    .getByLabel(question.choices.find((choice) => choice.correct)!.text, { exact: true })
    .check()
  await card.getByRole('button', { name: 'Check response', exact: true }).click()
  await expect(card.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )
}

/** Perform one activity the way a learner would, then continue. */
async function performActivity(page: Page, lesson: Lesson, activity: LessonActivity) {
  await expect(page.locator('[data-ebus-flow]')).toHaveAttribute('data-activity-id', activity.id)
  if (activity.interaction === 'acquire') {
    const changed = activity.task === 'changed-window'
    const lab = changed ? lesson.transferLab! : lesson.lab!
    const frame = page.frameLocator(WORKBENCH)
    await expect(primary(page)).toBeDisabled()
    if (lab.linkedLesson) await performLinked(page, lab.linkedLesson, changed)
    else if (lab.kind === 'model') await performModel(frame, lab.modelPackage!)
    else if (lab.kind === 'knobology') await performRecorded(page, lab)
    else {
      const roll = frame.getByLabel('Scope rotation', { exact: true })
      await expect(roll).toBeEnabled({ timeout: 60000 })
      await roll.fill('0')
    }
    await expect(primary(page)).toBeEnabled({ timeout: 30000 })
    // The control is shown ready while a frame is still arriving; the lesson's gate waits for it.
    await expect
      .poll(async () => {
        const observation = await linkedObservation(page)
        return !!observation && labGoalMet(lab, observation)
      })
      .toBe(true)
    await page.screenshot({
      path: out + '/lab-' + lesson.id + (changed ? '-changed-window' : '') + '.png',
    })
  }
  if (activity.interaction === 'record') await performRecord(page, activity)
  if (activity.interaction === 'matching' && lesson.matching) {
    for (const pair of lesson.matching.pairs)
      await page.getByLabel(pair.cue, { exact: true }).selectOption(pair.id)
    await page.getByRole('button', { name: 'Check matches', exact: true }).click()
  }
  if (activity.interaction === 'sequence' && lesson.sequence) {
    for (const step of lesson.sequence.steps)
      await page.getByRole('button', { name: step.text, exact: true }).click()
    await page.getByRole('button', { name: 'Check sequence', exact: true }).click()
  }
  for (const [index, slot] of activity.questions.entries()) {
    await answer(page, lesson[slot])
    if (index < activity.questions.length - 1) await primary(page).click()
  }
  await expect(primary(page)).toBeEnabled()
  await primary(page).click()
}

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://localhost:3135'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  await observeLinked(page)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  // Requests that failed or were refused, reported with a failure: a lab that will not load says why.
  const failedRequests: string[] = []
  page.on('requestfailed', (r) => failedRequests.push(r.failure()?.errorText + ' ' + r.url()))
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(r.status() + ' ' + r.url())
  })
  const lessonIds = LESSONS.map((lesson) => lesson.id)
  const caseIds = FINAL_CASES.map((item) => item.id)
  try {
    // 1. The hub: one recommended way in, and nothing recorded yet.
    await page.goto(base + '/en/ebus-guided')
    const door = page.locator('[data-course-door]')
    await expect(door).toHaveText('Start with ' + LESSONS[0].title)
    expect(await door.getAttribute('href')).toContain(lessonHref(LESSONS[0].id))
    await expect(page.locator('[data-course-marks]')).toContainText(
      '0 of ' + LESSONS.length + ' lessons reviewed · 0 opened',
    )
    expect(await storedProgress(page)).toBeNull()
    await page.screenshot({ path: out + '/overview-desktop.png', fullPage: true })

    // 2. Every lesson, performed to its finish and stored as reviewed.
    for (const [index, lesson] of LESSONS.entries()) {
      if (index === 0) await door.click()
      else await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible()
      for (const activity of activitiesForLesson(lesson))
        await performActivity(page, lesson, activity)
      await expect(
        page.getByRole('heading', { name: 'Lesson finished', exact: true }),
      ).toBeVisible()
      const stored = await storedProgress(page)
      expect(stored?.reviewedLessonIds).toEqual(lessonIds.slice(0, index + 1))
      expect(stored?.lastLocation).toEqual({ kind: 'lesson', id: lesson.id })
      console.log('LESSON PASS ' + lesson.id)
    }

    // 3. Every integrated case, opened and worked to its debrief.
    await page.goto(base + '/en/ebus-guided/assess')
    for (const item of FINAL_CASES) {
      await page
        .locator(`[data-case-card="${item.id}"]`)
        .getByRole('button', { name: 'Open case', exact: true })
        .click()
      await expect(page.locator('[data-ebus-case]')).toHaveAttribute('data-ebus-case', item.id)
      for (const question of item.questions) {
        await answer(page, question)
        await primary(page).click()
      }
      await expect(page.getByRole('heading', { name: 'Case debrief', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Return to the cases', exact: true }).click()
      console.log('CASE PASS ' + item.id)
    }
    const caseCards = page.locator('[data-case-card]')
    await expect(caseCards).toHaveCount(FINAL_CASES.length)
    for (const item of FINAL_CASES)
      await expect(page.locator(`[data-case-card="${item.id}"]`)).toContainText('· Opened')
    await page.screenshot({ path: out + '/assessment-complete.png', fullPage: true })
    const before = (await storedProgress(page))!
    expect(before.reviewedLessonIds).toEqual(lessonIds)
    expect(before.visitedLessonIds).toEqual(lessonIds)
    expect(before.openedIntegratedCaseIds).toEqual(caseIds)

    // 4. A reload keeps the record, and the pages still show it.
    await page.reload()
    for (const item of FINAL_CASES) {
      const card = page.locator(`[data-case-card="${item.id}"]`)
      await expect(card).toContainText('· Opened')
      await expect(card.getByRole('button', { name: 'Open again', exact: true })).toBeVisible()
    }
    const record = (await storedProgress(page))!
    expect(record).toEqual(before)
    await page.goto(base + '/en/ebus-guided')
    await expect(page.locator('[data-course-door]')).toHaveText('Open the integrated cases')
    await expect(page.locator('[data-course-marks]')).toContainText(
      LESSONS.length + ' of ' + LESSONS.length + ' lessons reviewed',
    )
    expect(await storedProgress(page)).toEqual(before)

    // 5. No page errors, and no other course storage created or changed.
    const otherKeys = await page.evaluate(
      // The course writes two things: the progress record, and one draft per case record
      // (`examinationKey` in engine/examination.ts). Anything else would be a stray write.
      (own) =>
        Object.keys(localStorage).filter(
          (k) => /socal|ebus/i.test(k) && k !== own && !k.startsWith('ip-ebus-guided-examination:'),
        ),
      PROGRESS_STORAGE_KEY,
    )
    expect(errors).toEqual([])
    expect(otherKeys, 'no socal/ebus storage beyond progress and case-record drafts').toEqual([])
    expect(otherKeys).not.toContain(LEGACY_STORAGE_KEY)

    // 6. The result, from the record's real fields.
    await writeFile(
      out + '/journey-result.json',
      JSON.stringify(
        {
          storageKey: PROGRESS_STORAGE_KEY,
          lessonsReviewed: record.reviewedLessonIds.length,
          lessonsOpened: record.visitedLessonIds.length,
          lessonsSavedForLater: record.reviewLaterLessonIds.length,
          practiceCasesOpened: record.openedPracticeCaseIds.length,
          integratedCasesOpened: record.openedIntegratedCaseIds.length,
          lastLocation: record.lastLocation,
          survivedReload: true,
          errors,
          otherKeys,
        },
        null,
        2,
      ),
    )
    console.log(
      'Full journey passed',
      record.reviewedLessonIds.length,
      record.openedIntegratedCaseIds.length,
    )
  } catch (error) {
    await page.screenshot({ path: out + '/journey-failure.png', fullPage: true })
    if (failedRequests.length) console.error('Failed requests:\n' + failedRequests.join('\n'))
    throw error
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
