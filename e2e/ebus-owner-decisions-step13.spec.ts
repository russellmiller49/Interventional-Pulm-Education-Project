import { expect, test } from '@playwright/test'
import { LESSONS } from '../src/features/ebus-guided/content/curriculum'
import { GLOSSARY } from '../src/features/ebus-guided/content/glossary'

const lesson = (id: string) => LESSONS.find((entry) => entry.id === id)!

for (const condition of [
  { width: 1707, height: 900, rootText: 100, theme: 'light' },
  { width: 1440, height: 900, rootText: 100, theme: 'dark' },
  { width: 1246, height: 1021, rootText: 100, theme: 'light' },
  { width: 1024, height: 768, rootText: 100, theme: 'dark' },
  { width: 390, height: 844, rootText: 100, theme: 'light' },
  { width: 320, height: 740, rootText: 100, theme: 'dark' },
  { width: 1024, height: 768, rootText: 200, theme: 'light' },
] as const) {
  test(`approved copy and glossary at ${condition.width}, ${condition.rootText}% root text, ${condition.theme}`, async ({
    page,
  }) => {
    await page.setViewportSize(condition)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(({ rootText, theme }) => {
      localStorage.setItem('theme', theme)
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = `${rootText}%`
      })
    }, condition)
    for (const id of [
      'preparation',
      'scope-orientation',
      'ct-map',
      'measurement-phantoms',
      'results-reporting',
    ]) {
      await page.goto(`/en/ebus-guided/learn?section=${id}`)
      await expect(page.locator('html')).toHaveClass(new RegExp(condition.theme))
      const copy = lesson(id).paragraphs.find((text) =>
        /Patients should fast|Measurements in this simulator|recommends against routine/.test(text),
      )!
      await expect(page.getByText(copy, { exact: true })).toBeVisible()
      if (id === 'scope-orientation') {
        await expect(
          page.getByText(lesson(id).paragraphs.find((text) => text.includes('image right'))!, {
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          page.getByText(lesson(id).paragraphs.find((text) => text.includes('0°'))!, {
            exact: true,
          }),
        ).toBeVisible()
      }
      if (id === 'results-reporting') {
        await page.getByText('Sources and model limits', { exact: true }).click()
        await expect(
          page.getByText(/owner-approved scope; full text not independently verified/),
        ).toBeVisible()
      }
    }
    await page.getByRole('button', { name: 'Help', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Help with this task' })
    for (const id of [
      'tnm',
      'iaslc',
      'nsclc',
      'pet',
      'fna',
      'ers-esge-ests',
      'chest',
      'ifu',
      'chs',
    ]) {
      const term = GLOSSARY.find((entry) => entry.id === id)!
      const details = dialog.locator(`[data-glossary-term="${id}"]`)
      await details.locator('summary').focus()
      await page.keyboard.press('Enter')
      await expect(details).toHaveAttribute('open', '')
      await expect(details.getByText(term.definition, { exact: true })).toBeVisible()
      await expect(details).toContainText('Source and limits:')
      await page.keyboard.press('Enter')
    }
    await dialog.screenshot({ path: test.info().outputPath('approved-glossary.png') })
    const chs = dialog.locator('[data-glossary-term="chs"]')
    await chs.locator('summary').click()
    await chs.screenshot({ path: test.info().outputPath('chs-source-hold.png') })
  })
}

test('OD-01 preserves a real held air-gap frame and keeps explanation, retry, back and reset self-paced', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/ebus-guided/learn?section=contact-cutaway-model')
  await page.locator('[data-now-primary]').click()
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  const condition = frame.getByLabel('Contact condition')
  await expect(condition).toBeVisible({ timeout: 60_000 })
  await condition.selectOption('gap')
  await frame.getByLabel('Gain · illustrative').fill('90')
  await frame.getByRole('button', { name: 'Inspect acoustic path' }).click()
  for (const mode of ['direct', 'balloon', 'bubble', 'shadow']) {
    await condition.selectOption(mode)
    await frame.getByRole('button', { name: 'Inspect acoustic path' }).click()
  }
  await condition.selectOption('gap')
  await page.getByRole('button', { name: 'Hold this acquisition', exact: true }).click()
  await expect(page.locator('[data-evidence-identity="held"]')).toContainText('air gap')
  await page.locator('[data-now-primary]').click()
  const question = page.locator('[data-question-id="cutaway-observe"]')
  await expect(question).toContainText(lesson('contact-cutaway-model').observation.prompt)
  await expect(page.locator('[data-task-instruction]')).toContainText(
    'does not depend on which contact condition you held',
  )
  await question.getByRole('button', { name: 'Show explanation' }).click()
  await expect(question).toHaveAttribute('data-answered', 'false')
  await question.getByRole('button', { name: 'Hide explanation' }).click()
  await question
    .getByRole('radio', { name: 'Both are corrected by raising gain', exact: true })
    .check()
  await question.getByRole('button', { name: 'Check response' }).click()
  await expect(question).toHaveAttribute('data-answered', 'true')
  await question.getByRole('button', { name: /Try again/ }).click()
  await question
    .getByRole('radio', {
      name: lesson('contact-cutaway-model').observation.choices[1].text,
      exact: true,
    })
    .check()
  await question.getByRole('button', { name: 'Check response' }).click()
  await expect(page.locator('[data-evidence-identity="held"]')).toContainText('air gap')
  await page.locator('[data-now-primary]').click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(question).toHaveAttribute('data-answered', 'true')
  await expect(
    question.getByRole('radio', {
      name: lesson('contact-cutaway-model').observation.choices[1].text,
      exact: true,
    }),
  ).toBeChecked()
  await page.screenshot({ path: test.info().outputPath('held-gap-mechanism-comparison.png') })
  await page.getByRole('button', { name: 'Restart lesson', exact: true }).click()
  await expect(page.locator('[data-evidence-identity="held"]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('[data-evidence-identity="held"]')).toHaveCount(0)
})

test('OD-03 sequence reveal includes approved protected-preparation wording before answering', async ({
  page,
}) => {
  await page.goto('/en/ebus-guided/learn?section=needle-safety')
  await page.locator('[data-now-primary]').click()
  await page.getByRole('button', { name: 'Show the sequence', exact: true }).click()
  await expect(
    page.getByText(lesson('needle-safety').sequence!.explanation, { exact: false }),
  ).toBeVisible()
  await expect(page.locator('[data-now-primary]')).toBeEnabled()
})

test('unchanged production H.264 gain example still decodes and produces a genuine held image', async ({
  page,
}) => {
  await page.goto('/en/ebus-guided/learn?section=gain-contrast')
  await page.locator('[data-now-primary]').click()
  await page.locator('[data-now-primary]').click()
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  const clip = frame.getByLabel('Ultrasound teaching clip')
  await expect
    .poll(
      () =>
        clip.evaluate((element: HTMLVideoElement) => ({
          decoded: element.readyState >= 2 && element.videoWidth > 0 && element.videoHeight > 0,
          source: new URL(element.currentSrc).pathname.split('/').at(-1),
        })),
      { timeout: 60_000 },
    )
    .toEqual({ decoded: true, source: 'Depth4.mp4' })
  const gain = frame.getByLabel('Image gain')
  await gain.fill('4')
  // Changing gain alone cannot satisfy the existing comparison task.
  await expect(
    page.getByRole('button', { name: 'Hold this acquisition', exact: true }),
  ).toBeDisabled()
  await frame.getByLabel('Image contrast').fill('4')
  await expect(gain).toBeEnabled()
  await gain.fill('3')
  await expect(
    page.getByRole('button', { name: 'Hold this acquisition', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Hold this acquisition', exact: true }).click()
  await expect(page.locator('[data-evidence-identity="held"]')).toBeVisible()
  await expect(frame.locator('[data-recorded-held]')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('production-recorded-hold.png') })
})
