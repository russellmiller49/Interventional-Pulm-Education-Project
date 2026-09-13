/** Run against an already-started development server; does not seed learner progress. */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { LESSONS } from '../../src/features/ebus-guided/content/curriculum'
import { FINAL_CASES } from '../../src/features/ebus-guided/content/cases'
async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://localhost:3135'
  const out = 'artifacts/ebus-guided'
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const next = () => page.locator('[data-now-primary]').click()
  const choose = async (question: (typeof LESSONS)[number]['question']) => {
    await page.getByLabel(question.choices.find((c) => c.correct)!.text, { exact: true }).check()
    await next()
    await next()
  }
  try {
    await page.goto(base + '/en/ebus-guided')
    await expect(page.getByRole('link', { name: 'Start course', exact: true })).toBeVisible()
    await page.screenshot({ path: out + '/overview-desktop.png', fullPage: true })
    for (const lesson of LESSONS) {
      await page.goto(base + '/en/ebus-guided/learn?section=' + lesson.id)
      await expect(page.getByRole('heading', { name: 'Orientation', exact: true })).toBeVisible()
      await next()
      await next()
      await choose(lesson.question)
      if (lesson.lab) {
        const frame = page.frameLocator('iframe[title="EBUS workbench"]')
        await expect(page.locator('[data-now-primary]')).toBeDisabled()
        if (lesson.lab.kind === 'simulator') {
          const control = frame.getByLabel(
            lesson.lab.goal === 'coupling' ? 'Tip flexion' : 'Scope rotation',
            { exact: true },
          )
          await expect(control).toBeEnabled({ timeout: 60000 })
          await control.fill(lesson.lab.goal === 'coupling' ? '10' : '0')
          if (lesson.lab.linkedLesson && lesson.id !== 'acoustic-contact') {
            const selector = frame.getByLabel('Inspect a structure')
            await expect(selector).toBeVisible({ timeout: 30000 })
            await selector.selectOption(
              lesson.id === 'scope-orientation'
                ? 'transducer_face'
                : lesson.id === 'right-paratracheal'
                  ? 'azygous'
                  : 'carina',
            )
            if (lesson.id === 'ct-map')
              await frame.getByRole('button', { name: 'Model section', exact: true }).click()
            if (lesson.id === 'station-seven') {
              await expect(
                frame.getByRole('button', { name: 'Right main bronchus · scanned', exact: true }),
              ).toBeVisible({ timeout: 30000 })
              await frame.getByRole('button', { name: 'Left main bronchus', exact: true }).click()
              await control.fill('0')
            }
          }
        } else {
          if (lesson.lab.goal === 'depth') {
            const input = frame.getByLabel('Image depth', { exact: true })
            await expect(input).toBeEnabled({ timeout: 30000 })
            await input.fill('2')
          }
          if (lesson.lab.goal === 'gain') {
            const gain = frame.getByLabel('Image gain', { exact: true }),
              contrast = frame.getByLabel('Image contrast', { exact: true })
            await expect(gain).toBeEnabled({ timeout: 30000 })
            await gain.fill('3')
            await expect(contrast).toBeEnabled()
            await contrast.fill('4')
            await expect(gain).toBeEnabled()
            await gain.fill('4')
          }
          if (lesson.lab.goal === 'doppler') {
            await expect(
              frame.getByRole('button', { name: 'Color Doppler', exact: true }),
            ).toBeEnabled({ timeout: 30000 })
            await frame.getByRole('button', { name: 'Color Doppler', exact: true }).click()
          }
          if (lesson.lab.goal === 'capture') {
            await expect(
              frame.getByRole('button', { name: 'Freeze image', exact: true }),
            ).toBeEnabled({ timeout: 30000 })
            await frame.getByRole('button', { name: 'Freeze image', exact: true }).click()
            await frame.getByRole('button', { name: 'Measure', exact: true }).click()
            await frame.getByRole('button', { name: 'Left', exact: true }).click()
            await frame.getByRole('button', { name: 'Set first caliper', exact: true }).click()
            await frame.getByRole('button', { name: 'Right', exact: true }).click()
            await frame.getByRole('button', { name: 'Right', exact: true }).click()
            await frame.getByRole('button', { name: 'Save image', exact: true }).click()
            await expect(
              frame.getByAltText('Saved teaching image with the calipers you placed'),
            ).toBeVisible()
          }
        }
        await expect(page.locator('[data-now-primary]')).toBeEnabled({ timeout: 30000 })
        await page.screenshot({ path: out + '/lab-' + lesson.id + '.png' })
      } else if (lesson.sequence) {
        for (const step of lesson.sequence.steps)
          await page.getByRole('button', { name: step.text, exact: true }).click()
        await page.getByRole('button', { name: 'Check sequence', exact: true }).click()
      } else if (lesson.matching) {
        for (const pair of lesson.matching.pairs)
          await page.getByLabel(pair.cue, { exact: true }).selectOption({ label: pair.response })
        await page.getByRole('button', { name: 'Check matches', exact: true }).click()
      }
      await next()
      await choose(lesson.observation)
      await next()
      await choose(lesson.transfer)
      await expect(
        page.getByRole('heading', { name: 'Lesson completed', exact: true }),
      ).toBeVisible()
      const completed = await page.evaluate(
        () => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!).completed,
      )
      if (!completed.includes(lesson.id)) throw new Error('Completion missing: ' + lesson.id)
      console.log('LESSON PASS ' + lesson.id)
    }
    await page.goto(base + '/en/ebus-guided/assess')
    for (const item of FINAL_CASES) {
      await page.getByRole('button', { name: 'Open case', exact: true }).first().click()
      for (const question of item.questions) await choose(question)
      await expect(page.getByRole('heading', { name: 'Case debrief', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Record case review and return', exact: true }).click()
      console.log('CASE PASS ' + item.id)
    }
    await expect(
      page.getByRole('heading', { name: 'Your learning review', exact: true }),
    ).toBeVisible()
    await page.screenshot({ path: out + '/assessment-complete.png', fullPage: true })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Your learning review', exact: true }),
    ).toBeVisible()
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!))
    const legacyKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => /socal|ebus/i.test(k) && k !== 'ip-ebus-guided-v1'),
    )
    if (errors.length) throw new Error(errors.join('\n'))
    if (legacyKeys.length) throw new Error('Legacy storage changed: ' + legacyKeys.join(', '))
    await writeFile(
      out + '/journey-result.json',
      JSON.stringify(
        {
          lessons: record.completed.length,
          cases: record.completedCases.length,
          firstResponses: Object.keys(record.firstAttempts).length,
          assessmentComplete: record.assessmentComplete,
          errors,
          legacyKeys,
        },
        null,
        2,
      ),
    )
    console.log('Full journey passed', record.completed.length, record.completedCases.length)
  } catch (error) {
    await page.screenshot({ path: out + '/journey-failure.png', fullPage: true })
    throw error
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
