import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import { observeLinked, linkedObservation, performLinked } from './browser-linked-actions'

async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3145'
  const out = 'artifacts/ebus-guided/structure-labels'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const errors: string[] = []
  const results: object[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await observeLinked(page)
  const next = () => page.locator('[data-now-primary]').click()
  try {
    for (const id of ['right-paratracheal', 'scope-orientation', 'station-seven', 'ct-map']) {
      const lesson = LESSONS.find((candidate) => candidate.id === id)!
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${base}/en/ebus-guided/learn?section=${id}`)
      await next()
      const frame = page.frameLocator('iframe[title="EBUS workbench"]')
      await expect(frame.getByLabel('Inspect a structure')).toBeVisible({ timeout: 60000 })
      await expect(frame.locator('.linked-structure-letter:visible')).toHaveCount(0)
      await next()
      await page
        .getByLabel(lesson.question.choices.find((choice) => choice.correct)!.text, { exact: true })
        .check()
      await next()
      await next()
      const count = id === 'scope-orientation' ? 4 : 8
      const letters = frame.locator('.linked-structure-letter')
      const selector = frame.getByLabel('Select an unnamed structure', { exact: true })
      await expect(letters).toHaveCount(count, { timeout: 60000 })
      await expect(frame.locator('.linked-structure-letter:visible')).toHaveCount(count)
      await expect(
        frame.locator('.linked-structure-callouts path[visibility="visible"]'),
      ).toHaveCount(count)
      await expect(frame.locator('.linked-landmark-task')).toContainText(
        'Letters mark structures on the 3D',
      )
      const labels = await selector.locator('option').allTextContents()
      expect(
        await letters.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label'))),
      ).toEqual(labels.slice(1))
      await expect
        .poll(async () => (await linkedObservation(page))?.linked?.source, { timeout: 60000 })
        .toBeTruthy()
      const before = (await linkedObservation(page))!
      await frame.locator('.linked-canvas').screenshot({ path: `${out}/${id}-unselected.png` })
      for (let i = 0; i < count; i++) {
        const letter = String.fromCharCode(65 + i)
        await frame.getByRole('button', { name: `Structure ${letter}`, exact: true }).click()
        await expect(selector).toHaveValue(String(i))
        await expect(letters.nth(i)).toHaveAttribute('aria-pressed', 'true')
        await expect(frame.locator('.linked-landmark-task .linked-selection')).toContainText(
          `Structure ${letter} selected`,
        )
        await expect(frame.locator('.linked-structure-callouts .is-selected')).toHaveCount(2)
      }
      await selector.selectOption('0')
      await expect(letters.nth(0)).toHaveAttribute('aria-pressed', 'true')
      const point = await frame
        .locator('.linked-structure-callouts circle')
        .first()
        .evaluate((dot) => ({
          x: Number(dot.getAttribute('cx')),
          y: Number(dot.getAttribute('cy')),
        }))
      const tooltip = frame.locator('.linked-canvas [role="tooltip"]')
      for (const offset of [0, -2, 2, -4, 4]) {
        await frame
          .locator('.linked-canvas canvas')
          .hover({ position: { x: point.x + offset, y: point.y + offset } })
        if (await tooltip.isVisible()) break
      }
      await expect(tooltip).toHaveText(/^Structure [A-H]$/)
      await page.keyboard.press('Escape')
      await expect(tooltip).toBeHidden()
      await frame.locator('.linked-landmark-task').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${out}/${id}-1440.png` })
      await frame.locator('.linked-canvas').screenshot({ path: `${out}/${id}-model.png` })
      const lines = await frame
        .locator('.linked-structure-callouts path')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')))
      await frame.getByRole('button', { name: 'Orbit left', exact: true }).click()
      expect(
        await frame
          .locator('.linked-structure-callouts path')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d'))),
      ).not.toEqual(lines)
      const after = (await linkedObservation(page))!
      expect(after.linked?.identifiedStructures).toEqual(before.linked?.identifiedStructures)
      expect(after.actionCount).toBe(before.actionCount)
      expect(after.linked?.frameId).toBe(before.linked?.frameId)
      await frame.getByRole('button', { name: 'Reset view', exact: true }).click()
      if (id === 'right-paratracheal') {
        await frame.getByRole('button', { name: 'Scope model', exact: true }).click()
        await expect(
          frame.getByRole('button', { name: 'Check landmark', exact: true }),
        ).toHaveCount(0)
        await frame
          .getByRole('button', { name: 'Open Anatomy model for this check', exact: true })
          .click()
        await expect(letters).toHaveCount(8)
        await selector.selectOption('0')
        await frame.getByRole('button', { name: 'Check landmark', exact: true }).click()
        await expect(frame.locator('.linked-landmark-task [role="status"]')).toContainText(
          'Try another structure.',
        )
        await selector.selectOption('')
        await expect(frame.locator('.linked-landmark-task [role="status"]')).toHaveCount(0)
        await expect(
          frame.getByRole('button', { name: 'Check landmark', exact: true }),
        ).toBeDisabled()
        await letters.nth(1).focus()
        await page.keyboard.press('Enter')
        await expect(selector).toHaveValue('1')
        await frame.getByRole('checkbox', { name: 'Isolate selected structure' }).check()
        await expect(
          frame.locator('.linked-structure-callouts path[visibility="visible"]'),
        ).toHaveCount(1)
        await letters.nth(2).click()
        await expect(selector).toHaveValue('2')
        await expect(letters.nth(2)).toHaveAttribute('aria-pressed', 'true')
        await frame.getByRole('checkbox', { name: 'Isolate selected structure' }).uncheck()
        for (const width of [1280, 900]) {
          await page.setViewportSize({ width, height: 900 })
          if (width === 900) await page.getByRole('tab', { name: 'Simulator', exact: true }).click()
          await expect(
            frame.locator('.linked-structure-callouts path[visibility="visible"]'),
          ).toHaveCount(count)
          await frame
            .locator('.linked-canvas')
            .screenshot({ path: `${out}/right-paratracheal-model-${width}.png` })
          await frame.locator('.linked-landmark-task').scrollIntoViewIfNeeded()
          await page.screenshot({ path: `${out}/right-paratracheal-${width}.png` })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true)
          const bounds = await letters.evaluateAll((nodes) =>
            nodes.map((node) => {
              const rect = node.getBoundingClientRect()
              return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
            }),
          )
          for (let a = 0; a < bounds.length; a++)
            for (let b = a + 1; b < bounds.length; b++) {
              const one = bounds[a],
                two = bounds[b]
              expect(
                one.right <= two.x ||
                  two.right <= one.x ||
                  one.bottom <= two.y ||
                  two.bottom <= one.y,
              ).toBe(true)
            }
        }
        await page.setViewportSize({ width: 1440, height: 900 })
        await performLinked(page, 'right-paratracheal')
        await next()
        await expect(frame.locator('.linked-structure-letter:visible')).toHaveCount(0)
        await expect(frame.locator('.linked-landmark-task')).toHaveCount(0)
        await expect(frame.getByLabel('Select an unnamed structure')).toHaveCount(0)
        await page.screenshot({ path: `${out}/right-paratracheal-observe.png` })
      }
      results.push({
        lesson: id,
        matchingMarkers: count,
        selection: 'marker, dropdown',
        observer: 'no acquisition credit',
      })
      console.log('PASS', id)
    }
    expect(errors).toEqual([])
    await writeFile(`${out}/result.json`, JSON.stringify({ results, errors }, null, 2))
  } catch (error) {
    await page.screenshot({ path: `${out}/failure.png` })
    await writeFile(
      `${out}/failure.json`,
      JSON.stringify({ error: String(error), errors }, null, 2),
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
