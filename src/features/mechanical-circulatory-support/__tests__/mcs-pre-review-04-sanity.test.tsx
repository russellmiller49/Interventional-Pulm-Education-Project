import { cleanup, fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)
jest.mock('../components/EcmoCannulationPreview', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').impellaPreviewModule(),
)

import { McsSourcesPanel } from '../components/McsSourcesPanel'
import { McsCaseWorkflow } from '../components/McsCaseWorkflow'
import { mcsActionDisplayName, mcsHasActionDisplayName } from '../content/actionDisplayNames'
import { mcsCasePredictionReasoning } from '../content/casePredictionReasoning'
import { mcsScenarioById } from '../content/scenarios'
import { createInitialMcsState } from '../engine'
import { advanceMcsSimulation } from '../engine/model'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

function openSort() {
  mountSection('mcs-foundations-mechanisms')
  for (let i = 0; i < 20 && !document.querySelector('[data-control-panel-sort]'); i++) {
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-step-bar-continue]')!)
  }
  expect(document.querySelector('[data-control-panel-sort]')).not.toBeNull()
}

it('allows an unanswered sort to reveal every classification, retry, and continue without a response', () => {
  openSort()
  const saved = window.localStorage.getItem('interventionalpulm:mcs-progress:v1')
  expect(
    [...document.querySelectorAll<HTMLSelectElement>('[data-control-panel-sort] select')].every(
      (s) => !s.value,
    ),
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Show example classifications/i }))
  expect(document.querySelectorAll('[data-sort-outcome-label]').length).toBeGreaterThan(0)
  for (const verdict of document.querySelectorAll('[data-sort-outcome-label]')) {
    expect(verdict).toHaveTextContent('Example classification.')
  }
  expect(window.localStorage.getItem('interventionalpulm:mcs-progress:v1')).toBe(saved)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    '[data-control-panel-sort] select',
  )) {
    expect(select).toBeEnabled()
    expect(select).toHaveValue('')
  }
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-step-bar-continue]')!)
  expect(document.querySelector('[data-control-panel-sort]')).toBeNull()
})

it('clears sort answers when Try again says it does', () => {
  openSort()
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    '[data-control-panel-sort] select',
  )) {
    fireEvent.change(select, { target: { value: select.options[1].value } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Compare classifications' }))
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    '[data-control-panel-sort] select',
  ))
    expect(select).toHaveValue('')
})

it('keeps the synthesis hold visible on an unmapped section without opening sources', () => {
  mountSection('mcs-device-selection-integration')
  const notice = screen.getByText(/MCS-03-10.*NOT REVIEWED.*source-owner review required/i)
  expect(notice.closest('details')).toBeNull()
})

it('keeps the synthesis hold visible in an unmapped practice case before explanation', () => {
  const scenario = mcsScenarioById.get('IABP-03')!
  render(
    <McsCaseWorkflow
      state={createInitialMcsState('practice', 'iabp', scenario, 417)}
      dispatch={jest.fn()}
    />,
  )
  const notice = screen.getByText(/MCS-03-10.*NOT REVIEWED.*source-owner review required/i)
  expect(notice.closest('details')).toBeNull()
})

it('orders the hub citations by opened evidence before unopened guidelines', () => {
  const { container } = render(<McsSourcesPanel />)
  const titles = [...container.querySelectorAll('article h3')].map((x) => x.textContent)
  expect(
    titles.indexOf('A Guide to Mechanical Circulatory Support: A Primer for VAD Clinicians'),
  ).toBeLessThan(titles.indexOf('ISHLT/HFSA Guideline on Acute Mechanical Circulatory Support'))
  expect(container).not.toHaveTextContent(
    /from a July 19, 2026 check|Labeling sources last checked/,
  )
})

it('does not describe an isolated timing change when IABP-01 also changes LV contractility', () => {
  const scenario = mcsScenarioById.get('IABP-01')!
  const base = createInitialMcsState('practice', 'iabp', null, 417)
  const state = createInitialMcsState('practice', 'iabp', scenario, 417)
  expect(state.patient.leftVentricularContractility).not.toBe(
    base.patient.leftVentricularContractility,
  )
  expect(mcsCasePredictionReasoning('IABP-01', 'late-deflation')).not.toMatch(/nothing else moved/)
})

it('does not call CAP-LVAD-01 power unchanged when constrained filling lowers derived power', () => {
  const scenario = mcsScenarioById.get('CAP-LVAD-01')!
  const base = advanceMcsSimulation(createInitialMcsState('practice', 'lvad', null, 417), 8)
  const state = advanceMcsSimulation(createInitialMcsState('practice', 'lvad', scenario, 417), 8)
  expect(state.metrics.pumpPowerW).not.toBe(base.metrics.pumpPowerW)
  expect(mcsCasePredictionReasoning('CAP-LVAD-01', 'constrained-filling')).not.toMatch(
    /power (?:is |are )?unchanged|speed and power are unchanged/,
  )
})

it.each(['future:control', 'toString', 'constructor', '__proto__'])(
  'uses the neutral unknown-action fallback for %s',
  (id) => {
    expect(mcsHasActionDisplayName(id)).toBe(false)
    expect(mcsActionDisplayName(id)).toBe('Used a simulator control')
  },
)
