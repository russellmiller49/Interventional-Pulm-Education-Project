import { expect, test, type Page } from '@playwright/test'
import { ventilationLearningUnits } from '../src/features/mechanical-ventilation/content/learningCurriculum'
import {
  unitQuestion,
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  type VentilationQuestion,
} from '../src/features/mechanical-ventilation/content/learningQuestions'
import {
  VENTILATION_LEARNING_STORAGE_KEY,
  type VentilationLearningProgress,
} from '../src/features/mechanical-ventilation/engine/learningProgress'

// This now verifies the staged course that replaced the three-pane default Learn workspace.
const url = (id: string) => `/en/mechanical-ventilation/learn?activity=${id}`
async function commit(page: Page, question: VentilationQuestion, choiceId = question.correctId) {
  const option = question.choices.find((choice) => choice.id === choiceId)!
  await page.getByRole('radio', { name: option.label, exact: true }).check()
  await page.getByRole('button', { name: 'I can explain why', exact: true }).click()
  await page.getByRole('button', { name: 'Commit answer', exact: true }).click()
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`one clear beginning, readable breath, and reachable action at ${viewport.width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/en/mechanical-ventilation')
    const start = page.getByRole('link', { name: 'Start — The whole breath', exact: true })
    await expect(start).toBeVisible()
    await noOverflow(page)
    await start.click()
    await expect(page.getByText('Unit 1 of 14', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Explore the breath', exact: true }).click()
    await expect(page.getByRole('img', { name: /Three traces share a time axis/ })).toBeVisible()
    await page.getByRole('button', { name: 'Empty', exact: true }).click()
    await expect(page.locator('figcaption').filter({ hasText: /Gas moves outward/ })).toBeVisible()
    await noOverflow(page)
    await page.getByRole('button', { name: 'See a worked example', exact: true }).click()
    await page.getByRole('button', { name: 'Now make a decision', exact: true }).click()
    const question = unitQuestion(ventilationLearningUnits[0].id, 'check')
    await expect(page.getByRole('button', { name: 'Commit answer' })).toBeDisabled()
    for (const choice of question.choices)
      await expect(page.getByText(choice.rationale, { exact: true })).toHaveCount(0)
    await expect(
      page.getByText(ventilationLearningUnits[0].example.conclusion, { exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('svg[aria-label*="Three traces"]')).toHaveCount(0)
    await commit(page, question)
    await expect(
      page.getByText(
        question.choices.find((choice) => choice.id === question.correctId)!.rationale,
        { exact: true },
      ),
    ).toBeVisible()
    await noOverflow(page)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Try the transfer case' })).toBeVisible()
    await expect(
      page.getByRole('radio', {
        name: question.choices.find((choice) => choice.id === question.correctId)!.label,
      }),
    ).toBeChecked()
    expect(errors).toEqual([])
  })
}

test('works through the whole path, preserves first choices, and unlocks the final check', async ({
  page,
}) => {
  test.setTimeout(240000)
  for (const [index, unit] of ventilationLearningUnits.entries()) {
    await page.goto(url(unit.id))
    await expect(
      page.getByText(`Unit ${index + 1} of ${ventilationLearningUnits.length}`, { exact: true }),
    ).toBeVisible()
    if (unit.recallUnit) {
      await commit(page, unitQuestion(unit.recallUnit, 'transfer'))
      await page.getByRole('button', { name: 'Build on this idea' }).click()
    } else await page.getByRole('button', { name: 'Explore the breath', exact: true }).click()
    await expect(page.getByRole('heading', { name: unit.title, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'See a worked example' }).click()
    await page.getByRole('button', { name: 'Now make a decision' }).click()
    const check = unitQuestion(unit.id, 'check')
    // One deliberate miss should remain a miss after its feedback has been reviewed.
    await commit(
      page,
      check,
      index === 0
        ? check.choices.find((choice) => choice.id !== check.correctId)!.id
        : check.correctId,
    )
    await page.getByRole('button', { name: 'Try the transfer case' }).click()
    await commit(page, unitQuestion(unit.id, 'transfer'))
    await page.getByRole('button', { name: 'See your takeaways' }).click()
    await page.getByRole('button', { name: 'Complete this unit' }).click()
    await expect(page.getByRole('heading', { name: 'Your next step is ready.' })).toBeVisible()
    await noOverflow(page)
  }
  await page.goto('/en/mechanical-ventilation/assess')
  await page.getByRole('button', { name: 'Start final check' }).click()
  for (const [index, question] of ventilationFinalQuestions.entries()) {
    await commit(page, question)
    for (const choice of question.choices)
      await expect(page.getByText(choice.rationale, { exact: true })).toHaveCount(0)
    await page
      .getByRole('button', {
        name:
          index === ventilationFinalQuestions.length - 1 ? 'See your feedback' : 'Next question',
      })
      .click()
  }
  await expect(page.getByRole('heading', { name: 'Final check passed.' })).toBeVisible()
  const record = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    VENTILATION_LEARNING_STORAGE_KEY,
  )
  expect(
    Object.values((record as VentilationLearningProgress).units).filter(
      (value) => value.completedAt,
    ),
  ).toHaveLength(ventilationLearningUnits.length)
  expect(
    record.units[ventilationLearningUnits[0].id].answers[`${ventilationLearningUnits[0].id}:check`]
      .choiceId,
  ).not.toBe(unitQuestion(ventilationLearningUnits[0].id, 'check').correctId)
  expect(record.finalHistory).toHaveLength(1)
  await page.goto('/en/mechanical-ventilation')
  await expect(page.getByText('14 of 14 units completed', { exact: true })).toBeVisible()
})

test('placement fades the example without marking any unit complete', async ({ page }) => {
  await page.goto('/en/mechanical-ventilation/learn?entry=placement')
  await page.getByRole('button', { name: 'Start placement check' }).click()
  for (const [index, question] of ventilationPlacementQuestions.entries()) {
    await commit(page, question)
    await page
      .getByRole('button', {
        name:
          index === ventilationPlacementQuestions.length - 1
            ? 'See your feedback'
            : 'Next question',
      })
      .click()
  }
  await expect(page.getByRole('heading', { name: 'Your guidance is ready.' })).toBeVisible()
  await page.getByRole('link', { name: 'Continue — The whole breath' }).click()
  await page.getByRole('button', { name: 'Begin with a decision' }).click()
  await expect(page.getByRole('heading', { name: 'Make your next decision.' })).toBeVisible()
  await page.goto('/en/mechanical-ventilation/assess')
  await expect(page.getByRole('heading', { name: 'Finish the learning path first.' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Follow one supported breath', exact: true }),
  ).toBeVisible()
})

test('retains the live mechanics diagram and console as an explicit worked experiment', async ({
  page,
}) => {
  const unit = ventilationLearningUnits.find((entry) => entry.id === 'mechanics-load-and-pressure')!
  await page.goto(url(unit.id))
  await commit(page, unitQuestion(unit.recallUnit!, 'transfer'))
  await page.getByRole('button', { name: 'Build on this idea' }).click()
  await page.getByRole('button', { name: 'See a worked example' }).click()
  await page.getByText('Explore the existing diagram and ventilator', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'What peak pressure is made of' })).toBeVisible()
  await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
  await page.getByRole('button', { name: 'Run example', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause example', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause example', exact: true }).click()
  await page.getByRole('button', { name: 'Now make a decision', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'What peak pressure is made of' })).toHaveCount(0)
  await noOverflow(page)
})

test('offers matched cases without losing the full case library', async ({ page }) => {
  await page.goto('/en/mechanical-ventilation/practice?focus=expiration-and-air-trapping')
  await expect(page.getByText('Browse 3 matched cases', { exact: true })).toBeVisible()
  const start = page.getByRole('link', { name: 'Start guided case', exact: true })
  await expect(start).toHaveAttribute('href', /case=MV-05&device=hamilton-c6&mode=guided/)
  await page
    .getByRole('combobox', { name: 'Training console', exact: true })
    .selectOption('puritan-bennett-980')
  await expect(start).toHaveAttribute('href', /device=puritan-bennett-980/)
  await page.getByRole('link', { name: 'Show the full case library' }).click()
  await page.getByText('Browse all 15 cases', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open case', exact: true })).toHaveCount(15)
  await noOverflow(page)
})
