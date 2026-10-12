/** Real-root activity journey; never injects completion or acquisition evidence. */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { FINAL_CASES, PRACTICE_CASES } from '../../src/features/ebus-guided/content/cases'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import {
  activitiesForLesson,
  type LessonActivity,
} from '../../src/features/ebus-guided/content/stage'
import { labGoalMet } from '../../src/features/ebus-guided/content/types'
import { PROGRESS_STORAGE_KEY } from '../../src/features/ebus-guided/engine/selfPacedProgress'
import { performModel } from './browser-model-actions'
import { performRecorded, performRecord } from './browser-flow-actions'
import { observeLinked, linkedObservation, performLinked } from './browser-linked-actions'

const WORKBENCH = 'iframe[title="EBUS workbench"]'
/** What the finish card says about an activity that was performed in full (LessonHost.activityStatus). */
function performedStatus(activity: LessonActivity) {
  const checks = activity.questions.length
  const answered = checks === 1 ? 'check answered' : 'both checks answered'
  if (activity.interaction === 'read') return 'Read'
  if (activity.interaction === 'acquire') return 'Image acquired'
  if (activity.interaction === 'questions')
    return answered.charAt(0).toUpperCase() + answered.slice(1)
  return checks ? 'Task completed · ' + answered : 'Task completed'
}

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3136'
  const out = 'artifacts/ebus-guided/flow-redesign'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const errors: string[] = [],
    results: object[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await observeLinked(page)
  const primary = () => page.locator('[data-now-primary]')
  const workbench = () => page.frameLocator(WORKBENCH)
  const storedProgress = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PROGRESS_STORAGE_KEY)
  const selectedIds = process.env.EBUS_LESSONS?.split(',') ?? LESSONS.map((lesson) => lesson.id)
  try {
    for (const lesson of LESSONS.filter((entry) => selectedIds.includes(entry.id))) {
      console.log('START', lesson.id)
      await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      let acquiredPixels: string | undefined
      let acquiredIdentity: string | undefined
      let recordedPixels: string | undefined
      for (const activity of activitiesForLesson(lesson)) {
        console.log('TASK', activity.id)
        await expect(page.locator('[data-ebus-flow]')).toHaveAttribute(
          'data-activity-id',
          activity.id,
        )
        await expect(page.getByRole('heading', { name: activity.title, exact: true })).toBeVisible()
        expect(await page.getByRole('region', { name: 'Steps panel' }).count()).toBe(0)
        if (activity.teaching.includes('foundation')) {
          await expect(page.getByText(lesson.objective, { exact: false }).first()).toBeVisible()
          await expect(page.getByText(lesson.recall, { exact: false }).first()).toBeVisible()
          for (const item of lesson.checklist)
            await expect(page.getByText(item, { exact: true })).toBeVisible()
          for (const paragraph of lesson.paragraphs)
            await expect(page.getByText(paragraph, { exact: true })).toBeVisible()
          if (!process.env.EBUS_NO_SHOTS)
            await page.screenshot({ path: `${out}/${lesson.id}-introduction.png`, fullPage: false })
        }
        if (activity.interaction === 'acquire') {
          const lab = activity.task === 'changed-window' ? lesson.transferLab! : lesson.lab!
          const linkedConsole = lab.kind === 'simulator' && !!lab.linkedLesson
          // The image is the learner's to acquire: the primary control waits for the lab's steps,
          // and leaving without an image is always offered.
          await expect(primary()).toHaveText('Continue with this image')
          await expect(primary()).toBeDisabled()
          await expect(page.locator('[data-skip-acquisition]')).toBeEnabled()
          const surface = page.locator('[data-now-card]')
          if (linkedConsole) await expect(surface).toHaveAttribute('data-console', 'true')
          else await expect(surface).toHaveAttribute('data-top-advance', 'true')
          if (lab.linkedLesson)
            await performLinked(page, lab.linkedLesson, activity.task === 'changed-window')
          else if (lab.kind === 'model') {
            await performModel(workbench(), lab.modelPackage!)
            await expect(primary()).toBeEnabled({ timeout: 30000 })
          } else if (lab.kind === 'knobology') await performRecorded(page, lab)
          else {
            const roll = workbench().getByLabel('Scope rotation', { exact: true })
            await expect(roll).toBeEnabled({ timeout: 60000 })
            await roll.fill('0')
            await expect(primary()).toBeEnabled({ timeout: 30000 })
          }
          await expect(page.locator('[data-acquisition-outstanding]')).toHaveCount(0)
          // The control is shown ready while a frame is still arriving; the gate itself waits for
          // the frame, so the image read here is the one the lesson will hold.
          await expect
            .poll(async () => {
              const observation = await linkedObservation(page)
              return !!observation && labGoalMet(lab, observation)
            })
            .toBe(true)
          const currentObservation = await linkedObservation(page)
          acquiredPixels = lab.linkedLesson
            ? await workbench()
                .getByLabel('Grayscale ultrasound image', { exact: true })
                .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
            : undefined
          acquiredIdentity =
            currentObservation?.linked?.frameId ?? currentObservation?.model?.frameId
          if (lab.kind === 'knobology') {
            acquiredIdentity = currentObservation?.recorded?.frameId
            recordedPixels =
              lab.goal === 'capture'
                ? (await workbench()
                    .getByAltText('Saved teaching image with the calipers you placed')
                    .getAttribute('src'))!
                : await workbench()
                    .locator('video')
                    .evaluate((video: HTMLVideoElement) => {
                      const canvas = document.createElement('canvas')
                      canvas.width = video.videoWidth
                      canvas.height = video.videoHeight
                      canvas.getContext('2d')!.drawImage(video, 0, 0)
                      return canvas.toDataURL('image/png')
                    })
          }
          await page.evaluate((selector) => {
            ;(window as unknown as { acquiredFrame: Element | null }).acquiredFrame =
              document.querySelector(selector)
          }, WORKBENCH)
          if (!process.env.EBUS_NO_SHOTS)
            await page.screenshot({
              path: `${out}/${lesson.id}-${activity.task}-acquired.png`,
              fullPage: false,
            })
        }
        if (activity.interaction === 'record') {
          await expect(primary()).toBeEnabled()
          await expect(primary()).toContainText('without completing this record')
          await performRecord(page, activity)
          if (!process.env.EBUS_NO_SHOTS) {
            await page
              .locator('#ebus-task-title')
              .evaluate((el) =>
                window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 110),
              )
            await page.screenshot({ path: `${out}/${lesson.id}-case-record.png` })
            if (activity.recordTask === 'report') {
              await page
                .getByRole('region', { name: 'Educational report preview', exact: true })
                .scrollIntoViewIfNeeded()
              await page.screenshot({ path: `${out}/results-reporting-report.png` })
            }
          }
        }
        if (activity.interaction === 'matching' || activity.interaction === 'sequence') {
          // Self-paced: the task can be passed over, and the control says that is what it does.
          await expect(primary()).toBeEnabled()
          await expect(primary()).toContainText('without completing this task')
        }
        if (activity.interaction === 'matching' && lesson.matching) {
          for (const pair of lesson.matching.pairs)
            await page.getByLabel(pair.cue, { exact: true }).selectOption(pair.id)
          await page.getByRole('button', { name: 'Check matches', exact: true }).click()
          await expect(page.locator('[data-task-explanation]')).toHaveText(
            lesson.matching.explanation,
          )
        }
        if (activity.interaction === 'sequence' && lesson.sequence) {
          for (const step of lesson.sequence.steps)
            await page.getByRole('button', { name: step.text, exact: true }).click()
          await page.getByRole('button', { name: 'Check sequence', exact: true }).click()
          await expect(page.locator('[data-task-explanation]')).toHaveText(
            lesson.sequence.explanation,
          )
        }
        if (activity.image === 'held') {
          expect(
            await page.evaluate(
              (selector) =>
                (window as unknown as { acquiredFrame: Element }).acquiredFrame ===
                document.querySelector(selector),
              WORKBENCH,
            ),
          ).toBe(true)
          const currentObservation = await linkedObservation(page)
          if (lesson.lab?.kind === 'knobology') {
            await expect(workbench().locator('[data-recorded-held]')).toBeVisible()
            expect(currentObservation?.recorded?.held).toBe(true)
            expect(currentObservation?.recorded?.frameId).toBe(acquiredIdentity)
            expect(await workbench().locator('[data-recorded-held]').getAttribute('src')).toBe(
              recordedPixels,
            )
            expect(
              await workbench()
                .locator('video')
                .evaluate((video: HTMLVideoElement) => video.paused),
            ).toBe(true)
          }
        }
        if (activity.image === 'held' && acquiredPixels) {
          const currentPixels = await workbench()
            .getByLabel('Grayscale ultrasound image', { exact: true })
            .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
          expect(currentPixels).toBe(acquiredPixels)
          expect((await linkedObservation(page))?.linked?.frameId).toBe(acquiredIdentity)
          if (!process.env.EBUS_NO_SHOTS)
            await page.screenshot({
              path: `${out}/${lesson.id}-${activity.id.split(':')[1]}-held.png`,
              fullPage: false,
            })
        }
        for (let i = 0; i < activity.questions.length; i++) {
          const question = lesson[activity.questions[i]]
          const correct = question.choices.find((choice) => choice.correct)!
          const card = page.locator(`[data-question-id="${question.id}"]`)
          await expect(card.locator('legend')).toHaveText(question.prompt)
          await expect(page.getByText(lesson.worked.reasoning, { exact: true })).toHaveCount(0)
          // Self-paced: the check is optional, and its explanation opens before any answer.
          await expect(card).toHaveAttribute('data-answered', 'false')
          await expect(card.locator('[data-question-unavailable]')).toHaveCount(0)
          await expect(primary()).toBeEnabled()
          await expect(primary()).toContainText('without answering')
          await card.getByRole('button', { name: 'Show explanation', exact: true }).click()
          const explanation = card.locator('[data-explanation-reveal]')
          await expect(explanation.locator('[data-explanation-note]')).toBeVisible()
          await expect(explanation.locator('[data-explanation-best]')).toContainText(
            correct.rationale,
          )
          await expect(card.locator('[data-answer-verdict]')).toHaveCount(0)
          await expect(card).toHaveAttribute('data-answered', 'false')
          await card.getByRole('button', { name: 'Hide explanation', exact: true }).click()
          await expect(explanation).toHaveCount(0)
          // The response is checked by its own control; feedback follows the check.
          await card.getByLabel(correct.text, { exact: true }).check()
          await card.getByRole('button', { name: 'Check response', exact: true }).click()
          const verdict = card.locator('[data-answer-verdict]')
          await expect(verdict).toHaveAttribute('data-verdict-outcome', 'correct')
          await expect(verdict).toContainText(correct.rationale)
          await expect(verdict.locator('[data-how-to-distinguish]')).toContainText(
            question.explanation,
          )
          await expect(primary()).not.toContainText('without')
          if (activity.image === 'held' && lesson.lab?.kind === 'knobology') {
            const frame = workbench()
            const before = await frame.locator('[data-recorded-held]').getAttribute('src')
            expect(before).toBe(recordedPixels)
            expect((await linkedObservation(page))?.recorded?.frameId).toBe(acquiredIdentity)
            await page.setViewportSize({ width: 900, height: 768 })
            expect(await frame.locator('[data-recorded-held]').getAttribute('src')).toBe(before)
            expect((await linkedObservation(page))?.recorded?.held).toBe(true)
            await page.setViewportSize({ width: 1440, height: 900 })
            if (!process.env.EBUS_NO_SHOTS) {
              await page.locator('[data-now-card]').scrollIntoViewIfNeeded()
              await page
                .locator('#ebus-task-title')
                .evaluate((el) =>
                  window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 110),
                )
              await page.screenshot({ path: `${out}/${lesson.id}-held-recording.png` })
            }
          }
          if (i < activity.questions.length - 1) await primary().click()
        }
        await expect(primary()).toBeEnabled()
        await primary().click()
      }
      await expect(
        page.getByRole('heading', { name: 'Lesson finished', exact: true }),
      ).toBeVisible()
      // The finish card reports what was actually done, and the lesson is marked reviewed.
      await expect(page.locator('[data-session-summary] li')).toHaveText(
        activitiesForLesson(lesson).map(
          (activity) => activity.title + ': ' + performedStatus(activity),
        ),
      )
      expect((await storedProgress()).reviewedLessonIds).toContain(lesson.id)
      results.push({
        lesson: lesson.id,
        activities: activitiesForLesson(lesson).length,
        retainedPixelsChecked: !!acquiredPixels || lesson.lab?.kind === 'knobology',
      })
      console.log('PASS', lesson.id)
    }
    if (!process.env.EBUS_LESSONS) {
      for (const mode of ['practice', 'assess'] as const) {
        await page.goto(base + '/en/ebus-guided/' + mode)
        for (const item of mode === 'practice' ? PRACTICE_CASES : FINAL_CASES) {
          if (mode === 'practice')
            await page.getByRole('button', { name: item.title, exact: true }).click()
          else
            await page
              .locator(`[data-case-card="${item.id}"]`)
              .getByRole('button', { name: 'Open case', exact: true })
              .click()
          await expect(page.locator('[data-ebus-case]')).toHaveAttribute('data-ebus-case', item.id)
          for (const question of item.questions) {
            const correct = question.choices.find((choice) => choice.correct)!
            const card = page.locator(`[data-question-id="${question.id}"]`)
            await expect(card.locator('legend')).toHaveText(question.prompt)
            // Both kinds of case are self-paced: optional, and explained when a response is checked.
            await expect(primary()).toContainText('without answering')
            await expect(card.locator('[data-answer-verdict]')).toHaveCount(0)
            await card.getByLabel(correct.text, { exact: true }).check()
            await card.getByRole('button', { name: 'Check response', exact: true }).click()
            const verdict = card.locator('[data-answer-verdict]')
            await expect(verdict).toHaveAttribute('data-verdict-outcome', 'correct')
            await expect(verdict.locator('[data-how-to-distinguish]')).toContainText(
              question.explanation,
            )
            await expect(primary()).not.toContainText('without')
            await primary().click()
          }
          await expect(
            page.getByRole('heading', { name: 'Case debrief', exact: true }),
          ).toBeVisible()
          await expect(page.locator('[data-case-debrief] [data-explanation-reveal]')).toHaveCount(
            item.questions.length,
          )
          await page
            .getByRole('button', {
              name: mode === 'practice' ? 'Return to practice' : 'Return to the cases',
              exact: true,
            })
            .click()
          await expect(page.locator('[data-ebus-case]')).toHaveCount(0)
          results.push({ case: item.id, mode, decisions: item.questions.length })
          console.log('PASS', mode, item.id)
        }
      }
      // Only which cases were opened is kept; the case list shows it.
      for (const item of FINAL_CASES)
        await expect(page.locator(`[data-case-card="${item.id}"]`)).toContainText('Opened')
      const stored = await storedProgress()
      expect(stored.openedPracticeCaseIds).toEqual(PRACTICE_CASES.map((item) => item.id))
      expect(stored.openedIntegratedCaseIds).toEqual(FINAL_CASES.map((item) => item.id))
    }
    expect(errors).toEqual([])
    const record = await storedProgress()
    await writeFile(
      `${out}/journey-${process.env.EBUS_RUN_NAME ?? 'all'}-result.json`,
      JSON.stringify({ results, errors, record }, null, 2),
    )
  } catch (error) {
    if (!process.env.EBUS_NO_SHOTS)
      await page.screenshot({ path: `${out}/journey-failure.png`, fullPage: false })
    await writeFile(
      `${out}/failure-messages.json`,
      JSON.stringify(
        await page.evaluate(() =>
          (window as unknown as { linkedMessages: unknown[] }).linkedMessages.slice(-12),
        ),
        null,
        2,
      ),
    )
    throw error
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
