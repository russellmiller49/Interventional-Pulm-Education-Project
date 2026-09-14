/** Failure, accessibility and continuity checks against the real root + embedded applications. */
import { chromium, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import { activitiesForLesson } from '../../src/features/ebus-guided/content/stage'
import { EXAMINATION_CASE } from '../../src/features/ebus-guided/content/examination-cases'
import { examinationKey } from '../../src/features/ebus-guided/engine/examination'
import { PRACTICE_CASES } from '../../src/features/ebus-guided/content/cases'
import { observeLinked, linkedObservation, performLinked } from './browser-linked-actions'
import { performRecorded } from './browser-flow-actions'

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3136'
  const out = 'artifacts/ebus-guided/flow-redesign'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const results: object[] = []
  const makePage = async (width = 1440, height = 900) => {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
    await observeLinked(page)
    return page
  }
  const primary = (page: Page) => page.locator('[data-now-primary]')
  async function enterAcquire(page: Page, id: string) {
    const lesson = LESSONS.find((item) => item.id === id)!
    await page.goto(base + '/en/ebus-guided/learn?section=' + id)
    for (const activity of activitiesForLesson(lesson)) {
      await expect(page.locator('[data-ebus-flow]')).toHaveAttribute(
        'data-activity-id',
        activity.id,
      )
      if (activity.interaction === 'acquire') return lesson
      for (const slot of activity.questions) {
        const question = lesson[slot]
        await page
          .getByLabel(question.choices.find((choice) => choice.correct)!.text, { exact: true })
          .check()
        await primary(page).click()
      }
      await primary(page).click()
    }
    throw new Error('No acquisition in ' + id)
  }
  const photograph = async (page: Page, name: string) => {
    await page
      .locator('#ebus-task-title')
      .evaluate((element) =>
        window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 110),
      )
    await page.screenshot({ path: out + '/' + name + '.png' })
  }
  try {
    for (const [width, height] of [
      [1440, 900],
      [1280, 720],
      [1024, 768],
      [900, 768],
      [768, 900],
      [390, 844],
      [320, 844],
    ]) {
      const page = await makePage(width, height)
      await page.goto(base + '/en/ebus-guided/learn?section=clinical-question')
      await expect(
        page.getByRole('heading', { name: 'Define what the examination must answer', exact: true }),
      ).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
      await page.getByRole('button', { name: 'Help', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused()
      await page.getByRole('button', { name: 'Course outline', exact: true }).click()
      const dialog = page.getByRole('dialog')
      expect(await dialog.getByRole('link').count()).toBe(LESSONS.length)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Course outline', exact: true })).toBeFocused()
      await photograph(page, 'reading-' + width)
      if (width < 768) {
        await enterAcquire(page, 'acoustic-contact')
        await expect(page.getByRole('heading', { name: 'Desktop or tablet lab' })).toBeVisible()
        await expect(primary(page)).toBeDisabled()
        expect(
          await page.evaluate(
            () => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!).completed,
          ),
        ).toEqual([])
        await photograph(page, 'unsupported-model-' + width)
        await enterAcquire(page, 'image-depth')
        await performRecorded(page, LESSONS.find((lesson) => lesson.id === 'image-depth')!.lab!)
        await primary(page).click()
        await expect(page.frameLocator('iframe').locator('[data-recorded-held]')).toBeVisible()
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(1)
        await photograph(page, 'recorded-phone-' + width)
      }
      results.push({
        check: 'reading-controls-and-supported-device-behavior',
        width,
        height,
        passed: true,
      })
      await page.close()
    }
    {
      const page = await makePage(),
        lesson = await enterAcquire(page, 'acoustic-contact')
      const frame = page.frameLocator('iframe'),
        canvas = frame.getByLabel('Grayscale ultrasound image', { exact: true })
      await expect(primary(page)).toBeDisabled()
      await performLinked(page, 'acoustic-contact')
      const acquired = (await linkedObservation(page))!,
        pixels = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
      const comparison = frame.locator('.linked-contact-comparison canvas')
      const comparisonPixels = await comparison.evaluateAll((elements: HTMLCanvasElement[]) =>
        elements.map((element) => element.toDataURL()),
      )
      expect(comparisonPixels).toHaveLength(4)
      expect(comparisonPixels[0]).not.toBe(comparisonPixels[2])
      expect(comparisonPixels[1]).not.toBe(comparisonPixels[3])
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page.locator('iframe')).toBeHidden()
      await primary(page).click()
      expect((await linkedObservation(page))?.actionCount).toBe(acquired.actionCount)
      expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(
        pixels,
      )
      await primary(page).click()
      await expect(frame.locator('.linked-image-tooltip, .linked-image-hint')).toHaveCount(0)
      expect(
        await comparison.evaluateAll((elements: HTMLCanvasElement[]) =>
          elements.map((element) => element.toDataURL()),
        ),
      ).toEqual(comparisonPixels)
      await page
        .getByLabel(lesson.observation.choices.find((choice) => choice.correct)!.text, {
          exact: true,
        })
        .check()
      for (const width of [1024, 900, 768, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        if (width < 768) {
          await expect(primary(page)).toBeDisabled()
          await expect(page.locator('iframe')).toBeHidden()
          continue
        }
        await expect(primary(page)).toBeEnabled({ timeout: 30000 })
        expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(
          pixels,
        )
        expect((await linkedObservation(page))?.linked?.source?.sessionId).toBe(
          acquired.linked!.source!.sessionId,
        )
        await expect(
          page.getByLabel(lesson.observation.choices.find((choice) => choice.correct)!.text, {
            exact: true,
          }),
        ).toBeChecked()
      }
      await photograph(page, 'contact-held-before-response')
      // An actual child reboot invalidates the held source; replaying old evidence cannot repair it.
      const child = page.frames().find((entry) => entry.url().includes('guided.html'))!
      await child.evaluate(() => window.location.reload())
      await expect(primary(page)).toBeDisabled()
      await expect
        .poll(async () => (await linkedObservation(page))?.linked?.source?.sessionId, {
          timeout: 60000,
        })
        .not.toBe(acquired.linked!.source!.sessionId)
      await child.evaluate(
        (observation) =>
          parent.postMessage(
            {
              version: 1,
              type: 'observation',
              sessionId: observation.linked!.source!.sessionId,
              observation,
            },
            location.origin,
          ),
        acquired,
      )
      await page.evaluate(
        (observation) =>
          window.postMessage(
            {
              version: 1,
              type: 'observation',
              sessionId: observation.linked!.source!.sessionId,
              observation,
            },
            location.origin,
          ),
        acquired,
      )
      await expect(primary(page)).toBeDisabled()
      const record = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!),
      )
      expect(record.firstAttempts['acoustic-contact:' + lesson.observation.id]).toBeUndefined()
      expect(record.completed).toEqual([])
      await photograph(page, 'stale-held-image-blocked')
      results.push({
        check: 'review-resize-held-pixels-selection-reboot-stale-source-window',
        passed: true,
      })
      await page.close()
    }
    {
      const page = await makePage(),
        lesson = await enterAcquire(page, 'scope-orientation'),
        frame = page.frameLocator('iframe')
      await expect
        .poll(async () => (await linkedObservation(page))?.linked?.source, { timeout: 60000 })
        .toBeTruthy()
      const before = (await linkedObservation(page))!
      await frame.getByRole('button', { name: 'Orbit left', exact: true }).click()
      expect((await linkedObservation(page))?.actionCount).toBe(before.actionCount)
      expect((await linkedObservation(page))?.linked?.source?.pose).toEqual(
        before.linked?.source?.pose,
      )
      await expect(primary(page)).toBeDisabled()
      await frame.getByLabel('Scope rotation', { exact: true }).focus()
      await page.keyboard.press('ArrowLeft')
      await expect.poll(async () => (await linkedObservation(page))?.roll).toBe(84)
      // Tab can leave the iframe: explicit root focus remains possible and is not recaptured.
      await page.getByRole('button', { name: 'Help', exact: true }).focus()
      await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused()
      expect(lesson.lab!.linkedLesson).toBe('scope-orientation')
      results.push({
        check: 'observer-camera-no-credit-keyboard-scope-and-focus-exit',
        passed: true,
      })
      await page.close()
    }
    {
      const page = await makePage()
      await enterAcquire(page, 'image-depth')
      const video = page.frameLocator('iframe').locator('video')
      await page
        .frameLocator('iframe')
        .getByRole('button', { name: 'Play clip', exact: true })
        .click()
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
        .toBe(false)
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await primary(page).click()
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
        .toBe(true)
      await page.setViewportSize({ width: 900, height: 768 })
      expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true)
      results.push({
        check: 'explicit-play-review-return-and-resize-do-not-autoplay',
        passed: true,
      })
      await page.close()
    }
    for (const failure of ['missing-model', 'unavailable-recording', 'decode-failure'] as const) {
      const page = await makePage()
      if (failure === 'missing-model')
        await page.route('**/acoustic-contact-cutaway.glb', (route) => route.abort())
      else
        await page.route('**/*.mp4', (route) =>
          failure === 'decode-failure'
            ? route.fulfill({
                status: 200,
                contentType: 'video/mp4',
                body: 'This is deliberately not video data.',
              })
            : route.abort(),
        )
      await enterAcquire(
        page,
        failure === 'missing-model' ? 'contact-cutaway-model' : 'image-depth',
      )
      await expect(page.frameLocator('iframe').getByRole('alert').first()).toBeVisible({
        timeout: 60000,
      })
      await expect(primary(page)).toBeDisabled()
      await photograph(page, failure)
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!).completed),
      ).toEqual([])
      results.push({ check: failure, passed: true })
      await page.close()
    }
    {
      const page = await makePage()
      await enterAcquire(page, 'acoustic-contact')
      await performLinked(page, 'acoustic-contact')
      const lost = await page
        .frameLocator('iframe')
        .locator('.linked-canvas canvas')
        .first()
        .evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext('webgl2')
          const extension = context?.getExtension('WEBGL_lose_context')
          if (!extension) return false
          extension.loseContext()
          return true
        })
      expect(lost).toBe(true)
      await expect(primary(page)).toBeDisabled({ timeout: 15000 })
      results.push({ check: 'actual-webgl-context-loss-invalidates-acquisition', passed: true })
      await page.close()
    }
    {
      const page = await makePage(),
        lesson = await enterAcquire(page, 'capture')
      await performRecorded(page, lesson.lab!)
      await primary(page).click()
      const frame = page.frameLocator('iframe')
      await expect(frame.locator('[data-recorded-held]')).toBeVisible()
      const pixels = await frame.locator('[data-recorded-held]').getAttribute('src')
      // Double every computed font size, including px-based iframe text. This is text enlargement, not browser zoom.
      for (const documentFrame of page.frames())
        await documentFrame.evaluate(() => {
          const sizes = [...document.querySelectorAll<HTMLElement>('body, body *')].map(
            (element) => [element, getComputedStyle(element).fontSize] as const,
          )
          for (const [element, size] of sizes) element.style.fontSize = parseFloat(size) * 2 + 'px'
        })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
      expect(await frame.locator('[data-recorded-held]').getAttribute('src')).toBe(pixels)
      expect(await frame.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(
        true,
      )
      await photograph(page, 'capture-200-percent-text')
      results.push({
        check: '200-percent-computed-text-root-and-iframe-held-calipers',
        passed: true,
        browserZoom: 'not tested',
      })
      await page.close()
    }
    {
      const page = await makePage()
      const goPlan = async () => {
        await page.goto(base + '/en/ebus-guided/learn?section=systematic-staging')
        await primary(page).click()
      }
      await goPlan()
      await page.getByLabel('Plan assessment of 4R', { exact: true }).check()
      await page.getByLabel('N category for 4R if malignant', { exact: true }).selectOption('N3')
      await page.setViewportSize({ width: 900, height: 768 })
      await expect(page.getByLabel('Plan assessment of 4R', { exact: true })).toBeChecked()
      await goPlan()
      await expect(page.getByLabel('Plan assessment of 4R', { exact: true })).toBeChecked()
      await expect(
        page.getByText('Compatible case draft restored.', { exact: false }),
      ).toBeVisible()
      const key = examinationKey(EXAMINATION_CASE.id)
      await page.evaluate((key) => {
        const draft = JSON.parse(localStorage.getItem(key)!)
        draft.caseVersion = 999
        localStorage.setItem(key, JSON.stringify(draft))
      }, key)
      await goPlan()
      await expect(
        page.getByText('The saved draft belongs to a different content or geometry version.', {
          exact: false,
        }),
      ).toBeVisible()
      await expect(primary(page)).toBeDisabled()
      await page
        .getByRole('button', { name: 'Start a record for this version', exact: true })
        .click()
      expect(
        await page.evaluate(
          (key) => Object.keys(localStorage).some((entry) => entry.startsWith(key + ':archive:')),
          key,
        ),
      ).toBe(true)
      await expect(page.getByLabel('Plan assessment of 4R', { exact: true })).not.toBeChecked()
      results.push({ check: 'case-plan-resize-reload-version-mismatch-and-archive', passed: true })
      await page.close()
    }
    {
      const page = await makePage()
      await page.goto(base + '/en/ebus-guided/assess')
      await expect(
        page.getByRole('heading', { name: 'Finish the guided course first.' }),
      ).toBeVisible()
      await page.goto(base + '/en/ebus-guided/practice')
      await page.getByLabel('Independent practice — feedback at debrief', { exact: true }).check()
      const item = PRACTICE_CASES.find((entry) => entry.id === 'practice-handoff')!
      await page.getByRole('button', { name: item.title, exact: true }).click()
      const question = item.questions[0],
        unsafe = question.choices.find((choice) => choice.unsafe)!
      await page.getByLabel(unsafe.text, { exact: true }).check()
      await primary(page).click()
      await expect(primary(page)).toHaveText('Revise this response')
      await expect(page.getByText('Not correct, and unsafe.', { exact: false })).toBeVisible()
      await primary(page).click()
      await page
        .getByLabel(question.choices.find((choice) => choice.correct)!.text, { exact: true })
        .check()
      await primary(page).click()
      await expect(page.getByText(question.explanation, { exact: true })).toHaveCount(0)
      expect(
        await page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!).firstAttempts[key].choiceId,
          item.id + ':' + question.id,
        ),
      ).toBe(unsafe.id)
      await page.reload()
      await expect(
        page.getByRole('heading', { name: 'Return to the parts that need another look.' }),
      ).toBeVisible()
      results.push({
        check: 'assessment-eligibility-independent-practice-safety-history-reload',
        passed: true,
      })
      await page.close()
    }
    {
      const page = await makePage()
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => {
          throw new Error('Storage intentionally unavailable')
        }
      })
      await page.goto(base + '/en/ebus-guided/learn?section=clinical-question')
      await expect(
        page.getByText('Browser storage is unavailable.', { exact: false }),
      ).toBeVisible()
      results.push({ check: 'unavailable-local-storage-notice', passed: true })
      await page.close()
    }
  } finally {
    await writeFile(out + '/regressions-result.json', JSON.stringify(results, null, 2))
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
