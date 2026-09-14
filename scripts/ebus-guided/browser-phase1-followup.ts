import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import { linkedTaskKey } from '../../src/lib/ebus-linked-contract'
import { observeLinked, linkedObservation, performLinked } from './browser-linked-actions'

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3145'
  const out = 'artifacts/ebus-guided/phase-1-followup'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1080 },
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const errors: string[] = [],
    results: object[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await observeLinked(page)
  const primary = () => page.locator('[data-now-primary]')
  const next = async () => {
    const steps = page.getByRole('tab', { name: 'Steps', exact: true })
    if ((page.viewportSize()?.width ?? 1500) < 1100) {
      await expect(steps).toBeVisible()
      await steps.click()
      await expect(steps).toHaveAttribute('aria-selected', 'true')
    }
    await primary().click()
  }
  const answer = async (question: (typeof LESSONS)[number]['question']) => {
    await page.getByLabel(question.choices.find((c) => c.correct)!.text, { exact: true }).check()
    await next()
    await next()
  }
  const pixels = () =>
    page
      .frameLocator('iframe')
      .getByLabel('Grayscale ultrasound image', { exact: true })
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  const revealHover = async () => {
    const frame = page.frameLocator('iframe')
    const canvas = frame.getByLabel('Grayscale ultrasound image', { exact: true })
    await canvas.scrollIntoViewIfNeeded()
    const box = (await canvas.boundingBox())!
    for (const y of [0.35, 0.5, 0.65, 0.8])
      for (const x of [0.35, 0.5, 0.65]) {
        await canvas.hover({ position: { x: x * box.width, y: y * box.height } })
        if (
          await frame.locator('.simulator-continuous-ultrasound .linked-image-tooltip').isVisible()
        ) {
          await canvas.focus()
          await page.keyboard.press('ArrowLeft')
          await page.keyboard.press('Escape')
          return
        }
      }
    throw new Error('No image discovery label found in the acquired sector')
  }
  try {
    for (const lesson of LESSONS.filter((l) => l.lab?.linkedLesson)) {
      console.log('START', lesson.id)
      await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      await expect(page.getByRole('heading', { name: 'Orientation', exact: true })).toBeVisible()
      await page.screenshot({ path: `${out}/${lesson.id}-before.png` })
      await next()
      const frame = page.frameLocator('iframe[title="EBUS workbench"]')
      await expect(frame.getByLabel('Inspect a structure')).toBeVisible({ timeout: 60000 })
      if (await frame.getByRole('button', { name: 'Show neighboring anatomy' }).isVisible())
        await frame.getByRole('button', { name: 'Show neighboring anatomy' }).click()
      await frame.getByRole('button', { name: 'Demonstrate rotation', exact: true }).click()
      await expect.poll(async () => (await linkedObservation(page))?.roll).toBe(25)
      const rotation = await linkedObservation(page)
      await frame.getByRole('button', { name: 'Demonstrate flexion', exact: true }).click()
      await expect.poll(async () => (await linkedObservation(page))?.flexion).toBe(15)
      expect((await linkedObservation(page))?.roll).toBe(rotation?.roll)
      expect((await linkedObservation(page))?.actionCount).toBe(0)
      expect((await linkedObservation(page))?.ready).toBe(false)
      await frame.getByRole('button', { name: 'Reset example', exact: true }).click()
      await next()
      await answer(lesson.question)
      await expect(primary()).toBeDisabled()
      await expect
        .poll(async () => (await linkedObservation(page))?.ready, { timeout: 60000 })
        .toBe(true)
      await expect
        .poll(async () => (await linkedObservation(page))?.linked?.source, { timeout: 60000 })
        .toBeTruthy()
      if (lesson.id === 'scope-orientation') {
        const before = (await linkedObservation(page))!
        await frame.getByRole('button', { name: 'Orbit left', exact: true }).click()
        const afterOrbit = (await linkedObservation(page))!
        expect(afterOrbit.actionCount).toBe(before.actionCount)
        expect(afterOrbit.linked?.source?.pose).toEqual(before.linked?.source?.pose)
        expect(afterOrbit.linked?.source?.settings).toEqual(before.linked?.source?.settings)
        expect(afterOrbit.linked?.frameId).toEqual(before.linked?.frameId)
        await frame.getByLabel('Select an unnamed structure').selectOption('0')
        await frame.getByRole('button', { name: 'Check landmark', exact: true }).click()
        await expect(frame.locator('.linked-landmark-task')).toContainText('Try another structure')
        const old = await linkedObservation(page)
        await frame.getByRole('button', { name: 'Reset acquisition', exact: true }).click()
        await expect
          .poll(async () => (await linkedObservation(page))?.linked?.source?.sessionId, {
            timeout: 60000,
          })
          .not.toBe(old?.linked?.source?.sessionId)
        await expect
          .poll(async () => (await linkedObservation(page))?.linked?.source, { timeout: 60000 })
          .toBeTruthy()
        const child = page.frames().find((f) => f.url().includes('guided.html'))!
        await child.evaluate(
          (observation) =>
            parent.postMessage(
              {
                version: 1,
                type: 'observation',
                sessionId: observation?.linked?.source?.sessionId,
                observation,
              },
              location.origin,
            ),
          old,
        )
        await expect(primary()).toBeDisabled()
        const control = frame.getByLabel('Scope rotation', { exact: true })
        await control.focus()
        await page.keyboard.press('ArrowLeft')
        await expect.poll(async () => (await linkedObservation(page))?.roll).toBe(84)
        await expect(frame.locator('.linked-image-tooltip, .linked-image-hint')).toHaveCount(0)
      }
      await performLinked(page, lesson.lab!.linkedLesson!)
      const acquired = (await linkedObservation(page))!,
        beforePixels = await pixels()
      expect(acquired.linked!.source!.frameId).toBe(acquired.linked!.frameId)
      expect(acquired.linked!.source!.settings.contactQuality).toBe(acquired.contactQuality)
      if (lesson.id === 'acoustic-contact') {
        await expect(
          frame.getByRole('heading', { name: 'Tip and wall: initial / current' }),
        ).toBeVisible()
        const comparisons = await frame
          .locator('.linked-contact-comparison canvas')
          .evaluateAll((canvases) => canvases.map((c) => (c as HTMLCanvasElement).toDataURL()))
        expect(comparisons).toHaveLength(4)
        expect(comparisons[0]).not.toBe(comparisons[2])
        expect(comparisons[1]).not.toBe(comparisons[3])
        await frame.locator('.linked-contact-comparison').scrollIntoViewIfNeeded()
        await frame
          .locator('.linked-contact-comparison')
          .screenshot({ path: out + '/contact-comparison.png' })
      }
      await frame
        .locator('.guided-workbench')
        .screenshot({ path: `${out}/${lesson.id}-acquired.png` })
      await next()
      if (lesson.observation.imagePolicy === 'none') {
        await expect(page.locator('iframe')).toBeHidden()
      } else {
        await expect(
          frame.getByRole('heading', { name: 'Retained ultrasound', exact: true }),
        ).toBeVisible()
        expect(await pixels()).toBe(beforePixels)
        await expect(frame.getByLabel('Select an unnamed structure')).toHaveCount(0)
        await expect(frame.locator('.linked-physical')).toBeHidden()
        await expect(frame.locator('.linked-image-tooltip, .linked-image-hint')).toHaveCount(0)
        await expect(frame.getByRole('checkbox', { name: /boundary/ })).toHaveCount(0)
      }
      await page.screenshot({ path: `${out}/${lesson.id}-observe.png` })
      await answer(lesson.observation)
      await expect(page.locator('iframe')).toBeVisible()
      expect(await pixels()).toBe(beforePixels)
      if (lesson.id === 'scope-orientation') await revealHover()
      await page.screenshot({ path: `${out}/${lesson.id}-explain.png` })
      // Review does not replay the activity or replace the held scan.
      const review = page.locator('[data-step-id="' + lesson.id + '-step-0"] button')
      await expect(review).toBeEnabled()
      {
        await review.click()
        await expect(page.locator('iframe')).toBeHidden()
        await next()
        expect(await pixels()).toBe(beforePixels)
      }
      await next()
      if (lesson.transferLab) {
        await expect(primary()).toBeDisabled()
        await expect(page.getByText(lesson.transfer.prompt)).toHaveCount(0)
        await performLinked(page, lesson.lab!.linkedLesson!, true)
        const changed = (await linkedObservation(page))!
        expect(changed.linked!.source!.pose.originLps).not.toEqual(
          acquired.linked!.source!.pose.originLps,
        )
        expect(changed.linked!.source!.sessionId).not.toBe(acquired.linked!.source!.sessionId)
        expect(changed.linked!.source!.geometrySha256).toBe(acquired.linked!.source!.geometrySha256)
        await next()
        await expect(
          frame.getByRole('heading', { name: 'Retained ultrasound', exact: true }),
        ).toBeVisible()
        await page.screenshot({ path: `${out}/${lesson.id}-changed-window.png` })
      }
      await answer(lesson.transfer)
      await expect(
        page.getByRole('heading', { name: 'Lesson completed', exact: true }),
      ).toBeVisible()
      const record = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!),
      )
      expect(
        record.skillObservations[linkedTaskKey(lesson.lab!.linkedLesson!, 'guided')].source.frameId,
      ).toBe(acquired.linked!.frameId)
      results.push({
        lesson: lesson.id,
        acquisition: acquired.linked!.source,
        transfer: !!lesson.transferLab,
      })
      console.log('PASS', lesson.id)
    }
    const recordBefore = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!),
    )
    await page.reload()
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!).firstAttempts,
      ),
    ).toEqual(recordBefore.firstAttempts)
    expect(Object.keys(recordBefore.skillObservations)).toHaveLength(7)
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) => /socal|ebus/i.test(k) && k !== 'ip-ebus-guided-v1'),
      ),
    ).toEqual([])
    await page.setViewportSize({ width: 900, height: 1050 })
    await page.goto(base + '/en/ebus-guided/learn?section=scope-orientation')
    await next()
    await expect(page.frameLocator('iframe').getByLabel('Inspect a structure')).toBeVisible({
      timeout: 60000,
    })
    await page.screenshot({ path: out + '/compact-900.png' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(
      false,
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('tab', { name: 'Simulator', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Desktop or tablet lab' })).toBeVisible()
    await page.screenshot({ path: out + '/phone-gate.png' })
    await page.setViewportSize({ width: 1500, height: 1080 })
    await page.route('**/models/guided-v1/mediastinum-teaching.glb', (route) => route.abort())
    await page.goto(base + '/en/ebus-guided/learn?section=scope-orientation')
    await next()
    await next()
    await answer(LESSONS.find((l) => l.id === 'scope-orientation')!.question)
    await expect(
      page.frameLocator('iframe').getByRole('button', { name: 'Retry teaching models' }),
    ).toBeVisible({ timeout: 60000 })
    await expect(primary()).toBeDisabled()
    await page.screenshot({ path: out + '/missing-model-gate.png' })
    expect(errors).toEqual([])
    await writeFile(
      out + '/browser-result.json',
      JSON.stringify(
        {
          results,
          skillObservations: recordBefore.skillObservations,
          firstResponses: Object.keys(recordBefore.firstAttempts).length,
          errors,
          reducedMotion: true,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await page.screenshot({ path: out + '/failure.png', fullPage: true })
    await writeFile(
      out + '/failure.json',
      JSON.stringify(
        { error: String(error), observation: await linkedObservation(page), errors },
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
