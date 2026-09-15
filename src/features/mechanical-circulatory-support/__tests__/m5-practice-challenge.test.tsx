// MCS-01: replaces examination permissions and assisted-performance contracts; preserves real model actions.
import { fireEvent, screen, within } from '@testing-library/react'
jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { mcsPresentationTitle } from '../content/casePresentation'
import { allMcsScenarios } from '../content/scenarios'
import {
  renderWorkbench,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
  readStoredProgressRaw,
  capturedAnalyticsEvents,
  advanceSimulation,
  renderWorkbenchOnFakeTimers,
} from '../test-support/mcsWorkbench'
import { readMcsLearningProgress } from '../engine/learningProgress'

beforeEach(setupMcsWorkbenchEnvironment)
afterEach(teardownMcsWorkbenchEnvironment)
it.each(allMcsScenarios)(
  '$id opens the worked explanation without creating an answer or action',
  async (scenario) => {
    await renderWorkbench({
      section: scenario.kind === 'capstone' ? 'assess' : 'practice',
      initialActivityId: scenario.id,
    })
    expect(
      screen.getByRole('heading', { name: mcsPresentationTitle(scenario), level: 2 }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    const explanation = document.querySelector('[data-worked-explanation]') as HTMLElement
    expect(within(explanation).getByText('No actions performed.')).toBeInTheDocument()
    expect(within(explanation).getByText('No prediction submitted.')).toBeInTheDocument()
    for (const paragraph of scenario.debrief)
      expect(within(explanation).getByText(paragraph)).toBeInTheDocument()
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
    expect(readStoredProgressRaw()?.completedCaseIds ?? []).toEqual([])
    expect(readMcsLearningProgress().visitedCaseIds).toContain(scenario.id)
    expect(capturedAnalyticsEvents()).toEqual([])
  },
)
it.each(allMcsScenarios)(
  '$id supports inspection, patient exploration and unrestricted explanations',
  async (scenario) => {
    await renderWorkbench({
      section: scenario.kind === 'capstone' ? 'assess' : 'practice',
      initialActivityId: scenario.id,
    })
    for (const name of ['Arterial waveform', 'Filling & RV', 'Device display']) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name }))
    }
    const preload = screen.getByRole('slider', { name: 'Preload' })
    fireEvent.change(preload, { target: { value: '110' } })
    expect(preload).toHaveValue('110')
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByText(scenario.guidedPrompt || scenario.debrief[0])).toBeInTheDocument()
    expect(screen.queryByText(/Assisted Challenge|Routine teaching deferred/)).toBeNull()
  },
)
it.each(allMcsScenarios)(
  '$id permits a wrong prediction, a retry and leaving it unanswered',
  async (scenario) => {
    await renderWorkbench({
      section: scenario.kind === 'capstone' ? 'assess' : 'practice',
      initialActivityId: scenario.id,
    })
    const wrong = scenario.predictionOptions.find(
      (option) => option.id !== scenario.correctPredictionId,
    )!
    fireEvent.click(screen.getByRole('radio', { name: wrong.label }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare prediction' }))
    expect(screen.getByRole('radio', { name: wrong.label })).toBeChecked()
    expect(screen.getByRole('slider', { name: 'Preload' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Try prediction again' }))
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
    expect(capturedAnalyticsEvents()).toEqual([])
  },
)
it('retains the LVAD speed interlock until simulated authorization, independent of a prediction', async () => {
  await renderWorkbench({ section: 'practice', initialActivityId: 'LVAD-01' })
  const speed = screen.getByRole('slider', { name: 'Pump speed' })
  expect(speed).toBeDisabled()
  expect(screen.getByText(/tick it to unlock the pump speed/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: /Authorized-personnel order/ }))
  expect(speed).toBeEnabled()
  fireEvent.change(speed, { target: { value: '5600' } })
  expect(speed).toHaveValue('5600')
})
it('keeps disabled pump topology meaningful and enables controls when that pump is configured', async () => {
  await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-01' })
  expect(screen.getByText(/Right pump controls are unavailable/)).toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox', { name: 'Right-sided Impella configuration' }), {
    target: { value: 'rp' },
  })
  const rp = screen.getByRole('group', { name: 'Impella RP' })
  expect(within(rp).getByRole('slider', { name: 'Performance level' })).toBeEnabled()
})
it('shows safety events immediately and resets the real patient and current actions', async () => {
  await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-02' })
  const inflation = screen.getByRole('slider', { name: 'Deflation vs systole' })
  const baseline = (inflation as HTMLInputElement).value
  fireEvent.change(inflation, { target: { value: '120' } })
  expect(screen.getByText('CRITICAL · Late deflation')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(document.querySelector('[data-worked-explanation]')).toHaveTextContent(
    'iabp:set-deflation',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try again from the case baseline' }))
  expect(screen.getByRole('slider', { name: 'Deflation vs systole' })).toHaveValue(baseline)
  expect(screen.queryByText('CRITICAL · Late deflation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(document.querySelector('[data-worked-explanation]')).toHaveTextContent(
    'No actions performed.',
  )
})
it('continues the real simulation clock without graded or assistance events', async () => {
  await renderWorkbenchOnFakeTimers({ section: 'assess', initialActivityId: 'CAP-IABP-01' })
  const label = screen.getByRole('img', { name: /^ART waveform/ }).getAttribute('aria-label')
  advanceSimulation(1000)
  expect(screen.getByRole('img', { name: /^ART waveform/ })).toBeInTheDocument()
  expect(label).toMatch(/current value/)
  expect(capturedAnalyticsEvents()).toEqual([])
})
