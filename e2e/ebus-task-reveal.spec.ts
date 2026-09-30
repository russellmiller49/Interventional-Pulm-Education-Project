import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { LESSONS } from '../src/features/ebus-guided/content/curriculum'

test.beforeEach(async ({ context }) => {
  if (!process.env.EBUS_E2E_TOKEN_FILE) return
  const token = readFileSync(process.env.EBUS_E2E_TOKEN_FILE, 'utf8').trim()
  await context.request
    .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/ebus-guided`)
    .catch((error: unknown) => {
      throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
    })
})

for (const condition of [
  { width: 1246, height: 1021, rootText: 100 },
  { width: 390, height: 844, rootText: 100 },
  { width: 1024, height: 768, rootText: 200 },
] as const) {
  for (const task of [
    { lessonId: 'clinical-question', kind: 'matching', button: 'Show the matches' },
    { lessonId: 'preparation', kind: 'sequence', button: 'Show the sequence' },
  ] as const) {
    test(`${task.kind} reveal survives return and clears on restart at ${condition.width}, ${condition.rootText}% root text`, async ({
      page,
    }) => {
      const lesson = LESSONS.find((entry) => entry.id === task.lessonId)!
      await page.setViewportSize(condition)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`/en/ebus-guided/learn?section=${task.lessonId}`)
      if (condition.rootText === 200) {
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
      }
      await page.locator('[data-now-primary]').click()
      const reveal = page.getByRole('button', { name: task.button, exact: true })
      await reveal.press('Enter')
      const reference = page.locator(`[data-task-reference="${task.kind}"]`)
      const assertReference = async () => {
        await expect(reference).toBeVisible()
        if (task.kind === 'matching') {
          for (const pair of lesson.matching!.pairs) {
            await expect(reference.getByText(pair.cue, { exact: true })).toBeVisible()
            await expect(reference.getByText(pair.response, { exact: true })).toBeVisible()
          }
        } else {
          await expect(reference.getByRole('listitem')).toHaveText(
            lesson.sequence!.steps.map((step) => step.text),
          )
        }
        await expect(reference.getByRole('button')).toHaveCount(0)
        await expect(reference.getByRole('combobox')).toHaveCount(0)
      }
      await assertReference()
      await expect(page.locator('[data-now-primary]')).toBeEnabled()
      await page.locator('[data-now-primary]').click()
      await page.locator('[data-now-primary]').click()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await assertReference()
      await reference.screenshot({ path: test.info().outputPath('revealed-reference.png') })
      await page.getByRole('button', { name: 'Restart lesson', exact: true }).click()
      await page.locator('[data-now-primary]').click()
      await expect(reference).toHaveCount(0)
      await expect(page.getByRole('button', { name: task.button, exact: true })).toBeEnabled()
    })
  }
}
