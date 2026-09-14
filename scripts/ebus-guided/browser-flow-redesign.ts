/** Real-root activity journey; never injects completion or acquisition evidence. */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { FINAL_CASES, PRACTICE_CASES } from '../../src/features/ebus-guided/content/cases'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import { activitiesForLesson } from '../../src/features/ebus-guided/content/stage'
import { performModel } from './browser-model-actions'
import { performRecorded, performRecord } from './browser-flow-actions'
import { observeLinked, linkedObservation, performLinked } from './browser-linked-actions'

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
          await expect(primary()).toBeDisabled()
          const lab = activity.task === 'changed-window' ? lesson.transferLab! : lesson.lab!
          if (lab.linkedLesson)
            await performLinked(page, lab.linkedLesson, activity.task === 'changed-window')
          else if (lab.kind === 'model')
            await performModel(page.frameLocator('iframe'), lab.modelPackage!)
          else if (lab.kind === 'knobology') await performRecorded(page, lab)
          else {
            await expect(
              page.frameLocator('iframe').getByLabel('Scope rotation', { exact: true }),
            ).toBeEnabled({ timeout: 60000 })
            await page
              .frameLocator('iframe')
              .getByLabel('Scope rotation', { exact: true })
              .fill('0')
            await expect(primary()).toBeEnabled({ timeout: 30000 })
          }
          const currentObservation = await linkedObservation(page)
          acquiredPixels = lab.linkedLesson
            ? await page
                .frameLocator('iframe')
                .getByLabel('Grayscale ultrasound image', { exact: true })
                .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
            : undefined
          acquiredIdentity =
            currentObservation?.linked?.frameId ?? currentObservation?.model?.frameId
          if (lab.kind === 'knobology') {
            acquiredIdentity = currentObservation?.recorded?.frameId
            recordedPixels =
              lab.goal === 'capture'
                ? (await page
                    .frameLocator('iframe')
                    .getByAltText('Saved teaching image with the calipers you placed')
                    .getAttribute('src'))!
                : await page
                    .frameLocator('iframe')
                    .locator('video')
                    .evaluate((video: HTMLVideoElement) => {
                      const canvas = document.createElement('canvas')
                      canvas.width = video.videoWidth
                      canvas.height = video.videoHeight
                      canvas.getContext('2d')!.drawImage(video, 0, 0)
                      return canvas.toDataURL('image/png')
                    })
          }
          await page.evaluate(() => {
            ;(window as unknown as { acquiredFrame: Element | null }).acquiredFrame =
              document.querySelector('iframe')
          })
          if (!process.env.EBUS_NO_SHOTS)
            await page.screenshot({
              path: `${out}/${lesson.id}-${activity.task}-acquired.png`,
              fullPage: false,
            })
        }
        if (activity.interaction === 'record') {
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
        if (activity.image === 'held') {
          expect(
            await page.evaluate(
              () =>
                (window as unknown as { acquiredFrame: Element }).acquiredFrame ===
                document.querySelector('iframe'),
            ),
          ).toBe(true)
          const currentObservation = await linkedObservation(page)
          if (lesson.lab?.kind === 'knobology') {
            await expect(page.frameLocator('iframe').locator('[data-recorded-held]')).toBeVisible()
            expect(currentObservation?.recorded?.held).toBe(true)
            expect(currentObservation?.recorded?.frameId).toBe(acquiredIdentity)
            expect(
              await page.frameLocator('iframe').locator('[data-recorded-held]').getAttribute('src'),
            ).toBe(recordedPixels)
            expect(
              await page
                .frameLocator('iframe')
                .locator('video')
                .evaluate((video: HTMLVideoElement) => video.paused),
            ).toBe(true)
          }
        }
        if (activity.image === 'held' && acquiredPixels) {
          const currentPixels = await page
            .frameLocator('iframe')
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
          await expect(page.getByText(question.prompt, { exact: true })).toBeVisible()
          await expect(page.getByText(lesson.worked.reasoning, { exact: true })).toHaveCount(0)
          await page
            .getByLabel(question.choices.find((choice) => choice.correct)!.text, { exact: true })
            .check()
          await primary().click()
          await expect(page.getByText(question.explanation, { exact: true }).first()).toBeVisible()
          if (activity.image === 'held' && lesson.lab?.kind === 'knobology') {
            const frame = page.frameLocator('iframe')
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
        page.getByRole('heading', { name: 'Lesson completed', exact: true }),
      ).toBeVisible()
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
              .getByRole('heading', {
                name: new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
              })
              .locator('..')
              .getByRole('button', { name: 'Open case', exact: true })
              .click()
          for (const question of item.questions) {
            await page
              .getByLabel(question.choices.find((choice) => choice.correct)!.text, { exact: true })
              .check()
            await primary().click()
            if (mode === 'practice')
              await expect(
                page.getByText(question.explanation, { exact: true }).first(),
              ).toBeVisible()
            else await expect(page.getByText(question.explanation, { exact: true })).toHaveCount(0)
            await primary().click()
          }
          await expect(
            page.getByRole('heading', { name: 'Case debrief', exact: true }),
          ).toBeVisible()
          await page
            .getByRole('button', {
              name: mode === 'practice' ? 'Return to practice' : 'Record case review and return',
              exact: true,
            })
            .click()
          results.push({ case: item.id, mode, decisions: item.questions.length })
          console.log('PASS', mode, item.id)
        }
      }
      await expect(
        page.getByRole('heading', { name: 'Your learning review', exact: true }),
      ).toBeVisible()
    }
    expect(errors).toEqual([])
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!))
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
