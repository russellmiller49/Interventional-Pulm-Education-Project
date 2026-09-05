import { expect, test, type Locator, type Page } from '@playwright/test'
import { ventilationLearningUnits } from '../src/features/mechanical-ventilation/content/learningCurriculum'
import { ventilationExperimentByUnit } from '../src/features/mechanical-ventilation/content/learningExperiments'
import { ventilationFinalQuestions } from '../src/features/mechanical-ventilation/content/learningQuestions'
import {
  labCheckpoint,
  VENTILATION_LAB_STORAGE_KEY,
} from '../src/features/mechanical-ventilation/engine/learningLab'
import { completeLabUnit } from '../src/features/mechanical-ventilation/test-support/live-learning'

const url = (id: string) => `/en/mechanical-ventilation/learn?activity=${id}`
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)
}
async function moveSlider(slider: Locator, target: number) {
  const bounds = await slider.evaluate((node: HTMLInputElement) => ({
    min: Number(node.min),
    step: Number(node.step),
  }))
  await slider.press('Home')
  for (let i = 0; i < Math.round((target - bounds.min) / bounds.step); i++)
    await slider.press('ArrowRight')
  await expect(slider).toHaveValue(String(target))
}
async function predict(page: Page, id: string, round: 0 | 1 = 0, answer?: number) {
  const experiment = ventilationExperimentByUnit.get(id)!.rounds[round]
  await page.getByRole('button', { name: 'Try the experiment', exact: true }).click()
  await expect(page.getByRole('button', { name: /Commit prediction/ })).toBeDisabled()
  for (const rationale of experiment.rationales)
    await expect(page.getByText(rationale, { exact: true })).toHaveCount(0)
  await page
    .getByRole('radio', { name: experiment.choices[answer ?? experiment.correct], exact: true })
    .check()
  await page.getByRole('button', { name: /Commit prediction/ }).click()
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`running entry, visible tracings, and usable controls at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/en/mechanical-ventilation')
    const console = page.getByTestId('live-learning-console')
    await expect(console).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause simulation' })).toBeVisible()
    await expect(console.locator('figure')).toHaveCount(3)
    await noOverflow(page)
    if (viewport.width >= 851) {
      const trace = await console.locator('figure').first().boundingBox()
      const slider = await page.getByRole('slider', { name: /Patient compliance/ }).boundingBox()
      expect(trace!.y).toBeGreaterThan(80)
      expect(trace!.y + trace!.height).toBeLessThan(viewport.height)
      expect(slider!.y + slider!.height).toBeLessThan(viewport.height)
    }
    await page.getByRole('button', { name: /Learning map/ }).click()
    const map = page.getByRole('dialog', { name: 'Learning map' })
    await expect(map.getByRole('link')).toHaveCount(17)
    await page.keyboard.press('Escape')
    await expect(map).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Learning map/ })).toBeFocused()
    await console.evaluate((node) => node.setAttribute('data-retained', 'yes'))
    await page.getByRole('button', { name: 'Try the experiment', exact: true }).click()
    await expect(console).toHaveAttribute('data-retained', 'yes')
    await expect(page.getByRole('slider', { name: /Patient compliance/ })).toBeDisabled()
    await expect(page.getByText('Explain the physiology on this ventilator')).toHaveCount(0)
    await expect(console.locator('figure')).toHaveCount(3)
    await noOverflow(page)
    await page.screenshot({
      path: testInfo.outputPath(`live-prediction-${viewport.width}.png`),
      fullPage: true,
    })
    expect(errors).toEqual([])
  })
}

test('uses actual control changes and holds, restores evidence, and transfers to a changed lung', async ({
  page,
}) => {
  const id = 'mechanics-load-and-pressure'
  await page.goto(url(id))
  await predict(page, id, 0, 1)
  const compare = page.getByRole('button', { name: 'Compare the response', exact: true })
  await expect(compare).toBeDisabled()
  await moveSlider(page.getByRole('slider', { name: /Patient resistance/ }), 2)
  await expect(compare).toBeDisabled()
  await page.getByRole('button', { name: 'Perform inspiratory hold', exact: true }).click()
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('5')
  await expect(compare).toBeEnabled({ timeout: 15000 })
  await compare.click()
  await expect(page.getByText('Update your prediction with what you observed.')).toBeVisible()
  const table = page.getByRole('table', { name: 'Recorded response from your experiment' })
  const peak = table.getByRole('row').filter({ hasText: 'Peak pressure' })
  const values = await peak.locator('td').allTextContents()
  expect(Number(values[1])).toBeGreaterThan(Number(values[0]) + 4)
  await page
    .getByRole('textbox')
    .fill('Peak pressure increased; the plateau changed very little after flow stopped.')
  await page.reload()
  await expect(
    page.getByRole('table', { name: 'Recorded response from your experiment' }),
  ).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveValue(
    'Peak pressure increased; the plateau changed very little after flow stopped.',
  )
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
  await page.getByText('Compare saved tracings', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Before your change' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'After your change' })).toBeVisible()
  await page
    .getByRole('button', { name: 'Test the relationship in the next setup', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Separate stiffness from resistance' }),
  ).toBeVisible()
  await predict(page, id, 1)
  await moveSlider(page.getByRole('slider', { name: /Patient compliance/ }), 0.5)
  await page.getByRole('button', { name: 'Perform inspiratory hold', exact: true }).click()
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('5')
  await expect(compare).toBeEnabled({ timeout: 15000 })
  await compare.click()
  await page
    .getByRole('textbox')
    .fill('The plateau increased when compliance fell, unlike the resistance experiment.')
  await page.getByRole('button', { name: 'Finish these experiments', exact: true }).click()
  await expect(page.getByText('Two experiments. One relationship to carry forward.')).toBeVisible()
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    VENTILATION_LAB_STORAGE_KEY,
  )
  expect(saved.units[id].evidence[0].prediction).toBe(1)
  expect(saved.units[id].completedAt).toBeTruthy()
  await noOverflow(page)
})

test('keeps all four original consoles selectable and the original case route usable', async ({
  page,
}) => {
  await page.goto(url('waveform-anatomy'))
  await page.getByRole('button', { name: /Learning map/ }).click()
  const device = page.getByRole('combobox', { name: /Training device/ })
  await expect(device.locator('option')).toHaveCount(4)
  for (const id of [
    'drager-evita-v800-v600',
    'puritan-bennett-980',
    'carefusion-avea',
    'hamilton-c6',
  ]) {
    await device.selectOption(id)
    await expect(
      page.getByTestId('live-learning-console').locator('section[data-device]'),
    ).toHaveAttribute('data-device', id)
  }
  await page.keyboard.press('Escape')
  await page.goto('/en/mechanical-ventilation/practice?case=MV-01&device=hamilton-c6&mode=guided')
  await expect(page.locator('[data-device="hamilton-c6"]')).toBeVisible()
  await expect(page.locator('figure').first()).toBeVisible()
})

test('unlocks the independent knowledge check only after all live units and preserves question feedback boundaries', async ({
  page,
}) => {
  await page.goto('/en/mechanical-ventilation/assess')
  await expect(page.getByRole('heading', { name: 'Finish the learning path first.' })).toBeVisible()
  const units = Object.fromEntries(
    ventilationLearningUnits.map((unit) => [unit.id, labCheckpoint(completeLabUnit(unit.id))]),
  )
  await page.evaluate(
    ({ key, units }) => localStorage.setItem(key, JSON.stringify({ version: 1, units })),
    { key: VENTILATION_LAB_STORAGE_KEY, units },
  )
  await page.reload()
  await page.getByRole('button', { name: 'Start final check', exact: true }).click()
  for (const q of ventilationFinalQuestions) {
    const answer = q.choices.find((c) => c.id === q.correctId)!
    for (const option of q.choices)
      await expect(page.getByText(option.rationale, { exact: true })).toHaveCount(0)
    await page.getByRole('radio', { name: answer.label, exact: true }).check()
    await page.getByRole('button', { name: 'Commit answer', exact: true }).click()
    await expect(page.getByText(answer.rationale, { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /Next question|See your feedback/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Final check passed.' })).toBeVisible()
})

test('keeps the live workspace keyboard accessible without serious accessibility violations', async ({
  page,
}) => {
  await page.goto(url('mechanics-load-and-pressure'))
  await page.getByTestId('live-learning-console').waitFor()
  await page.addScriptTag({ path: require.resolve('axe-core') })
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: unknown,
            options: unknown,
          ) => Promise<{ violations: Array<{ id: string; impact: string; nodes: unknown[] }> }>
        }
      }
    ).axe
    const result = await axe.run('[data-ventilation-learning-unit]', {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    })
    return result.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact))
      .map((v) => ({ id: v.id, nodes: v.nodes }))
  })
  expect(violations).toEqual([])
})

test('offers a paused, step-through patient when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(url('waveform-anatomy'))
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
  const initial = await page
    .getByTestId('live-learning-console')
    .locator('figure')
    .first()
    .innerText()
  await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
  expect(
    await page.getByTestId('live-learning-console').locator('figure').first().innerText(),
  ).not.toBe(initial)
})
