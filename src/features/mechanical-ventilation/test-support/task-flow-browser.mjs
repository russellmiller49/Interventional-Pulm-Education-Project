/** All 14 units, both authored rounds and final-check boundary through public UI only.
 * Run with `npx tsx .../task-flow-browser.mjs`; output/storage env match targeted-browser.mjs.
 * Curriculum imports identify the actions to exercise; no completed record or reducer call is injected.
 */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { ventilationLearningUnits } = require('../content/learningCurriculum.ts')
const { ventilationExperimentByUnit } = require('../content/learningExperiments.ts')
const { ventilationStageLesson } = require('../content/stageLessons.ts')
const { ventilationFinalQuestions } = require('../content/learningQuestions.ts')

const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3161'
const output = path.resolve(process.env.MV_REVIEW_OUTPUT ?? 'artifacts/mv-task-flow')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  ...(process.env.MV_REVIEW_STORAGE ? { storageState: process.env.MV_REVIEW_STORAGE } : {}),
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const results = [],
  errors = []
page.on('pageerror', (error) => errors.push(error.message))
const primary = () => page.locator('[data-now-primary]')
async function proceed() {
  await expect(primary()).toBeEnabled()
  await primary().click()
}
async function capture(name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
}
async function snapshot() {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('mechanical-ventilation-live-learning-v1') ?? '{}'),
  )
}
async function range(key, value) {
  const input = page.locator(`#mv-quick-${key}`)
  await expect(input).toBeEnabled()
  const min = Number(await input.getAttribute('min')),
    step = Number(await input.getAttribute('step'))
  await input.focus()
  await input.press('Home')
  for (let i = 0; i < Math.round((value - min) / step); i++) await input.press('ArrowRight')
  await expect(input).toHaveValue(String(value))
}
async function advanceUntilReady() {
  for (let breath = 0; breath < 150; breath++) {
    if ((await primary().count()) && (await primary().isEnabled())) return
    await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
  }
  throw new Error(
    `Observation did not finish: ${await page.locator('[data-now-card]').innerText()}`,
  )
}
async function observation(unitId, round) {
  await expect(page.locator('[data-observation-task]')).toBeVisible()
  await expect(primary()).toBeDisabled()
  let answer
  if (unitId === 'breathing-with-support') {
    answer = round === 0 ? 'Outward flow with falling volume' : 'Inward flow with rising volume'
  } else {
    const table = page.locator('[data-observation-task] table')
    const metric =
      unitId === 'waveform-anatomy'
        ? 'Inspiratory time'
        : unitId === 'mechanics-load-and-pressure'
          ? 'Plateau'
          : unitId === 'modes-and-breath-delivery' && round === 0
            ? 'Peak pressure'
            : 'Exhaled volume'
    const values = await table
      .getByRole('row')
      .filter({ hasText: metric })
      .locator('td')
      .allTextContents()
    let before = parseFloat(values[0]),
      after = parseFloat(values[1])
    if (unitId === 'mechanics-load-and-pressure' && round === 0) {
      const peak = await table
        .getByRole('row')
        .filter({ hasText: 'Peak pressure' })
        .locator('td')
        .allTextContents()
      before = parseFloat(peak[0]) - before
      after = parseFloat(peak[1]) - after
    }
    answer =
      after > before
        ? 'Rose'
        : after < before
          ? 'Fell'
          : 'Stayed similar at the displayed precision'
  }
  await page
    .locator('[data-observation-task]')
    .getByRole('radio', { name: answer, exact: true })
    .check()
  await proceed()
  await expect(page.locator('[data-observation-feedback]')).toContainText(
    'Your observation matches this run.',
  )
  await proceed()
}

try {
  for (const unit of ventilationLearningUnits) {
    if (process.env.MV_REVIEW_UNIT && unit.id !== process.env.MV_REVIEW_UNIT) continue
    const lesson = ventilationStageLesson(unit.id),
      experiment = ventilationExperimentByUnit.get(unit.id)
    await page.goto(`${base}/en/mechanical-ventilation/learn?activity=${unit.id}`)
    await expect(page.locator('[data-now-card]')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
    await capture(`${unit.id}-reference`)
    const first = lesson.steps[0].interaction
    if (first.kind === 'walk') for (let stop = 0; stop < 4; stop++) await proceed()
    if (first.kind === 'locate') {
      await proceed()
      await expect(page.locator('[data-prerequisite-teaching]')).toHaveCount(0)
      await expect(page.locator('[data-phase-band]')).toHaveCount(0)
      const choice = first.item.choices.find((item) =>
        first.item.correctChoiceIds.includes(item.id),
      )
      await page
        .locator('[data-location-choices]')
        .getByRole('radio', { name: choice.label, exact: true })
        .check()
      await proceed()
    }
    await proceed()
    for (let roundIndex = 0; roundIndex < 2; roundIndex++) {
      const round = experiment.rounds[roundIndex]
      await expect(page.locator('[data-prediction-choices]')).toBeVisible()
      if (unit.id === 'high-peak-pressure-integration') {
        await expect(page.locator('[data-metric="plateau"] dd')).toHaveText(
          'Acquire a current inspiratory hold',
        )
        await expect(page.locator('[data-metric="plateau"] small')).toHaveCount(0)
        await page.getByText('Console and experiment options', { exact: true }).click()
        await page.getByRole('button', { name: /View full .* console/ }).click()
        await expect(page.getByText(/plateau pressure has not been acquired/)).toBeVisible()
        await capture(`${unit.id}-round-${roundIndex + 1}-native-before-measurement`)
        await page.getByRole('button', { name: 'Return to task controls' }).click()
        await page.getByText('Console and experiment options', { exact: true }).click()
        await expect(
          page.locator('[data-patient-properties], [data-teaching-column], [data-phase-band]'),
        ).toHaveCount(0)
        await expect(page.locator('[data-stage-sources]')).toHaveAttribute(
          'data-stage-sources-claims',
          'false',
        )
        if (roundIndex === 1)
          await expect(page.locator('[data-task-map], [data-now-back]')).toHaveCount(0)
      }
      await page
        .locator('[data-prediction-choices]')
        .getByRole('radio', { name: round.choices[round.correct], exact: true })
        .check()
      await proceed()
      await proceed()
      if (unit.id === 'high-peak-pressure-integration') {
        await page.getByRole('button', { name: 'Assess the patient', exact: true }).click()
        await expect(primary()).toHaveCount(0)
      }
      for (const goal of round.goals) {
        if (goal.type === 'control' || goal.type === 'mechanics') await range(goal.key, goal.value)
        else if (goal.type === 'hold') {
          await page.locator(`#mv-quick-hold-${goal.hold}`).click()
          await expect(page.locator('[data-hold-provenance]')).toContainText(
            /queued|active|waiting|in progress/i,
          )
          for (let i = 0; i < 2; i++)
            await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
        } else if (goal.type === 'intervention') await page.locator(`#mv-quick-${goal.id}`).click()
        else {
          const cursor = page
            .locator('[data-now-card]')
            .getByRole('slider', { name: 'Captured breath time cursor' })
          const max = Number(await cursor.getAttribute('max'))
          await cursor.focus()
          await cursor.press('Home')
          for (let i = 0; i < (roundIndex === 0 ? Math.floor(max * 0.3) : 2); i++)
            await cursor.press('ArrowRight')
          await page.getByRole('button', { name: 'Use this captured interval' }).press('Enter')
        }
      }
      await capture(`${unit.id}-round-${roundIndex + 1}-action`)
      if (unit.id === 'lung-protection' && roundIndex === 1)
        await expect(page.locator('[data-hold-provenance]')).toContainText(
          /unsuitable|not interpretable/i,
        )
      if (roundIndex === 0) {
        await advanceUntilReady()
        await proceed()
      } // await actual action effects, then observe
      if (round.seconds > 0) {
        if (await primary().count()) await expect(primary()).toBeDisabled()
        await advanceUntilReady()
      }
      await proceed()
      if (lesson.steps.some((step) => step.interaction.kind === 'interpret'))
        await observation(unit.id, roundIndex)
      await expect(page.locator('[data-task-workbench]')).toHaveCount(0)
      await capture(`${unit.id}-round-${roundIndex + 1}-comparison`)
      await proceed()
      if (unit.id === 'controls-and-goals' && roundIndex === 0) {
        await expect(page.locator('[data-worked-setting-map]')).toHaveCount(0)
        for (const row of await page.locator('[data-sort-row]').all()) {
          await row
            .getByRole('combobox')
            .selectOption(
              /exhaled|total rate|peak pressure/i.test(await row.innerText()) ? 'reported' : 'set',
            )
        }
        await proceed()
        await proceed()
      }
    }
    await expect(page.locator('[data-now-card]')).toContainText(
      'This section has been worked through.',
    )
    const saved = (await snapshot()).units[unit.id]
    expect(saved.completedAt).toBeTruthy()
    expect(
      saved.evidence.every(
        (item) => item.prediction !== undefined && item.baseline && item.response,
      ),
    ).toBe(true)
    results.push({
      unit: unit.id,
      rounds: 2,
      steps: lesson.steps.map((step) => ({ id: step.id, presentation: step.presentation })),
      evidence: saved,
    })
    await page.reload()
    await expect(page.locator('[data-now-card]')).toContainText(
      'This section has been worked through.',
    )
    console.log(`PASS ${unit.id}: both rounds and paused reload`)
  }
  if (!process.env.MV_REVIEW_UNIT) {
    await page.goto(`${base}/en/mechanical-ventilation/assess`)
    await page.getByRole('button', { name: 'Start final check' }).click()
    for (const question of ventilationFinalQuestions) {
      const form = page.locator(`[data-ventilation-question="${question.id}"]`)
      await form
        .getByRole('radio', {
          name: question.choices.find((choice) => choice.id === question.correctId).label,
          exact: true,
        })
        .check()
      await form.getByRole('button', { name: 'Commit answer' }).click()
      await expect(page.locator('[data-correct]')).toHaveCount(0)
      await form.getByRole('button', { name: /Next question|See your feedback/ }).click()
    }
    await expect(page.getByRole('heading', { name: 'Knowledge check met.' })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Your answers and targeted feedback' }),
    ).toBeVisible()
    await capture('final-check-full-set-feedback')
    results.push({
      check: 'final check unlocked from real completed lessons; feedback withheld until full set',
      questions: ventilationFinalQuestions.length,
      passed: true,
    })
  }
  expect(errors).toEqual([])
} catch (error) {
  await capture('failure')
  console.error(
    await page
      .locator('[data-now-card]')
      .innerText()
      .catch(() => page.url()),
  )
  throw error
} finally {
  await writeFile(
    path.join(output, 'task-flow-results.json'),
    JSON.stringify({ results, errors }, null, 2),
  )
  await context.storageState({ path: path.join(output, 'task-flow-resume.json') })
  await browser.close()
}
