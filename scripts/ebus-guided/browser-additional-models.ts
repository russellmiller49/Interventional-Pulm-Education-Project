import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import { performModel } from './browser-model-actions'
async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3146',
    out = 'artifacts/ebus-guided/additional-models'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 }, hasTouch: true })
  const errors: string[] = [],
    results: object[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const primary = () => page.locator('[data-now-primary]'),
    next = () => primary().click()
  const answer = async (q: (typeof LESSONS)[number]['question']) => {
    await page.getByLabel(q.choices.find((c) => c.correct)!.text, { exact: true }).check()
    await next()
    await next()
  }
  try {
    for (const lesson of LESSONS.filter((l) => l.lab?.modelPackage)) {
      const pkg = lesson.lab!.modelPackage!,
        frame = page.frameLocator('iframe[title="EBUS workbench"]')
      await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      await expect(page.getByRole('heading', { name: 'Orientation', exact: true })).toBeVisible({
        timeout: 60000,
      })
      await next()
      await expect(frame.locator('[data-model-frame]')).toHaveAttribute(
        'data-model-frame',
        /additional-models-v1/,
        { timeout: 60000 },
      )
      // Real mesh hover and an equivalent discoverable selector, independent of activity evidence.
      const canvas = frame.locator('.model-viewport canvas')
      await canvas.scrollIntoViewIfNeeded()
      let discovered = false
      for (const y of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        if (discovered) break
        for (const x of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
          const b = (await canvas.boundingBox())!
          await canvas.hover({ position: { x: b.width * x, y: b.height * y } })
          if (await frame.getByRole('tooltip').isVisible()) {
            discovered = true
            break
          }
        }
      }
      expect(discovered).toBe(true)
      await page.screenshot({ path: `${out}/${pkg}-worked-hover.png` })
      await canvas.press('Escape')
      await expect(frame.getByRole('tooltip')).toHaveCount(0)
      await frame.getByLabel('Discover a structure', { exact: true }).selectOption({ index: 1 })
      if (pkg === 'contact') await performModel(frame, pkg)
      await next()
      await answer(lesson.question)
      await expect(primary()).toBeDisabled()
      await expect(frame.locator('[data-model-frame]')).toHaveAttribute(
        'data-model-frame',
        /additional-models-v1/,
        { timeout: 60000 },
      )
      await expect(frame.locator('.model-image [role=tooltip]')).toHaveCount(0)
      await expect(frame.getByText('Authored short axis: 16 mm', { exact: true })).toHaveCount(0)
      if (pkg === 'needle')
        await expect(
          frame.getByRole('option', { name: 'True needle tip (teaching view)', exact: true }),
        ).toHaveCount(0)
      await performModel(frame, pkg)
      await expect(primary()).toBeEnabled()
      await page.screenshot({ path: `${out}/${pkg}-act-complete.png` })
      const id = await frame.locator('[data-model-frame]').getAttribute('data-model-frame')
      await next()
      await expect(frame.locator('.model-controls fieldset')).toHaveAttribute('disabled', '')
      await expect(
        frame.getByRole('button', { name: 'Reset activity', exact: true }),
      ).toBeDisabled()
      await expect(frame.locator('[data-model-frame]')).toHaveAttribute('data-model-frame', id!)
      await expect(frame.getByText('Authored short axis: 16 mm', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: `${out}/${pkg}-observe.png` })
      await answer(lesson.observation)
      await expect(frame.locator('[data-model-frame]')).toHaveAttribute('data-model-frame', id!)
      if (pkg === 'measurement')
        await expect(frame.getByText('Authored short axis: 16 mm', { exact: true })).toBeVisible()
      if (pkg === 'routes') {
        // Unsupported final state still retains a visible anatomy view, with no invented route arrow.
        await expect(
          frame.getByText('No supported orientation preset for this selection.', { exact: true }),
        ).toBeVisible()
      }
      await page.screenshot({ path: `${out}/${pkg}-explain.png` })
      await next()
      if (pkg === 'needle') {
        const unsafe = lesson.transfer.choices.find((c) => c.unsafe)!
        await page.getByLabel(unsafe.text, { exact: true }).check()
        await next()
        await expect(primary()).toHaveText('Revise this response')
        await next()
      }
      await answer(lesson.transfer)
      await expect(
        page.getByRole('heading', { name: 'Lesson completed', exact: true }),
      ).toBeVisible()
      results.push({
        lesson: lesson.id,
        package: pkg,
        frameId: id,
        hover: true,
        concealed: true,
        completed: true,
      })
    }
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!))
    expect(record.completed).toHaveLength(4)
    expect(Object.keys(record.firstAttempts)).toHaveLength(12)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Orientation', exact: true })).toBeVisible()
    const last = LESSONS.find((l) => l.lab?.modelPackage === 'measurement')!
    await page.goto(base + '/en/ebus-guided/learn?section=' + last.id)
    await next()
    await next()
    await answer(last.question)
    await page.setViewportSize({ width: 900, height: 1050 })
    await page.getByRole('tab', { name: 'Simulator', exact: true }).click()
    const frame = page.frameLocator('iframe[title="EBUS workbench"]')
    await expect(frame.locator('.model-viewport canvas')).toBeVisible({ timeout: 60000 })
    await page.screenshot({ path: out + '/compact-900.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Desktop or tablet lab' })).toBeVisible()
    await expect(primary()).toBeDisabled()
    await page.screenshot({ path: out + '/phone-gate.png' })
    await page.setViewportSize({ width: 1500, height: 1050 })
    // A failed new model must not earn completion.
    await page.route('**/guided-v2/*.glb', (route) => route.abort())
    await page.goto(base + '/en/ebus-guided/learn?section=contact-cutaway-model')
    await next()
    await next()
    await answer(LESSONS.find((l) => l.id === 'contact-cutaway-model')!.question)
    await expect(page.frameLocator('iframe').getByRole('alert')).toContainText('could not', {
      timeout: 60000,
    })
    await expect(primary()).toBeDisabled()
    expect(errors).toEqual([])
    await writeFile(
      out + '/browser-result.json',
      JSON.stringify(
        {
          results,
          errors,
          firstResponses: 12,
          compact: 900,
          phoneGate: 390,
          assetFailureBlocked: true,
        },
        null,
        2,
      ),
    )
    console.log('All four additional model journeys passed')
  } catch (e) {
    await page.screenshot({ path: out + '/failure.png' })
    throw e
  } finally {
    await browser.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
