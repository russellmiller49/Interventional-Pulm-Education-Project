import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { ecmoInteractiveFoundationSectionIds } from '../content/foundationLessonRuntime'
import { FoundationStageHost } from '../components/stage/FoundationStageHost'
import { EcmoPracticeActivity } from '../components/practice/EcmoPracticeActivity'
import { EcmoCircuitControls } from '../components/EcmoCircuitControls'
import {
  buildDrillStageLesson,
  resolveGuidedLesson,
} from '../components/stage/adapters/drillStageAdapter'
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import { nextIncompleteSectionLink } from '../content/pathwayResolver'
import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  parseLearningProgress,
  recordTopicVisit,
  writeLearningProgress,
} from '../engine'
import { latestState, mountDrill, resetStageHarness } from '../test-support/learnStageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`}
      {...rest}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

beforeEach(() => {
  resetStageHarness()
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
})

function selectTask(id: string) {
  const button = document.querySelector<HTMLButtonElement>(`[data-step-id="${id}"] button`)
  expect(button).not.toBeNull()
  fireEvent.click(button!)
}

function stored() {
  return JSON.parse(localStorage.getItem(CARDIOHELP_PROGRESS_STORAGE_KEY) ?? '{}')
}

it.each(['gas-source-interruption', 'va-gas-source-interruption'])(
  '%s initializes the real air-event transfer and uses its protective clamp without a prediction',
  async (id) => {
    await mountDrill(id)
    const lesson = buildDrillStageLesson(resolveGuidedLesson(id), latestState().supportMode)
    const transfer = lesson.steps.find((step) => step.interaction.kind === 'transfer-scenario')!
    selectTask(transfer.id)
    expect(latestState().scenario.prediction.committed).toBe(false)
    expect(latestState().scenario.activityStarted).toBe(false)
    expect(latestState().simulationTime).toBe(0)
    expect(latestState().circuit.returnClampClosed).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
    expect(latestState().simulationTime).toBe(0)
    expect(latestState().scenario.prediction.goalId).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start guided activity' }))
    expect(latestState().simulationTime).toBe(4)
    expect(latestState().circuit.bubbleResetRequired).toBe(true)
    expect(latestState().device.pumpRunning).toBe(false)
    expect(latestState().scenario.prediction.committed).toBe(false)
    const clamp = screen.getByRole('button', { name: /^Return clamp/ })
    expect(clamp).toBeEnabled()
    fireEvent.click(clamp)
    expect(latestState().circuit.returnClampClosed).toBe(true)
    expect(latestState().circuit.drainageClampClosed).toBe(false)
    expect(latestState().circuit.bubbleResetRequired).toBe(true)
    expect(latestState().device.pumpRunning).toBe(false)
    expect(latestState().scenario.prediction.goalId).toBeNull()
    expect(stored().scenarioAttempts).toBeUndefined()
    expect(stored().completedLabs).toBeUndefined()
  },
)

it('keeps a skipped transfer unperformed, and starts it afresh on return', async () => {
  await mountDrill('gas-source-interruption')
  selectTask('gas-source-interruption-transfer')
  fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
  expect(latestState().scenario.activityStarted).toBe(false)
  expect(latestState().circuit.returnClampClosed).toBe(false)
  expect(
    document.querySelector('[data-step-id="gas-source-interruption-transfer"]'),
  ).not.toHaveAttribute('data-step-state', 'done')
  expect(stored().completedLearnLessonIds).toBeUndefined()
})

it.each(['arterial-bubble-stop', 'va-arterial-bubble-stop'])(
  '%s preserves resumption interlocks without any quiz',
  (id) => {
    let state = createInitialSimulationState(id)
    for (let i = 0; i < 4; i++) state = ecmoSimulationReducer(state, { type: 'STEP' })
    const before = state
    state = ecmoSimulationReducer(state, { type: 'START_ACTIVITY' })
    expect(state.scenario.prediction).toEqual(before.scenario.prediction)
    expect(state.history).toEqual(before.history)
    state = ecmoSimulationReducer(state, { type: 'RESUME_SUPPORT_AFTER_BUBBLE' })
    expect(state.circuit.bubbleResetRequired).toBe(true)
    expect(state.device.pumpRunning).toBe(false)
    render(<EcmoCircuitControls state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    expect(screen.getByRole('button', { name: /^Return clamp/ })).toBeDisabled()
  },
)

it('offers feedback, retry, and skip for an actual wrong prediction without graded writes', async () => {
  await mountDrill('gas-source-interruption')
  const lesson = buildDrillStageLesson(resolveGuidedLesson('gas-source-interruption'), 'vv')
  selectTask(lesson.steps[lesson.predictionStepIndex].id)
  const authored = ecmoLearnPredictionFor('gas-source-interruption')!
  const wrong = authored.item.choices.find((choice) => choice.plausibility !== 'best')!
  fireEvent.click(screen.getByRole('radio', { name: wrong.label }))
  fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/ }))
  expect(latestState().scenario.prediction.goalId).toBe(authored.commitments[wrong.id].goalId)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByRole('radio', { name: wrong.label })).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
  expect(stored().scenarioAttempts).toBeUndefined()
  expect(global.fetch).not.toHaveBeenCalled()
})

it.each(['vv', 'va'] as const)(
  'legacy Assess %s supports immediate explanation, hints, restart and no-answer management',
  async (track) => {
    window.history.replaceState(null, '', `/cardiohelp-ecmo/assess?track=${track}`)
    render(<EcmoPracticeActivity section="assess" />)
    await waitFor(() => expect(document.querySelector('[data-hydrated="true"]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
    expect(screen.getByText(/authored case explanation/)).toBeInTheDocument()
    expect(screen.getAllByText(/No prediction recorded/).length).toBeGreaterThan(0)
    expect(screen.getByText('No action was recorded in this run.')).toBeInTheDocument()
    expect(stored().scenarioAttempts).toBeUndefined()
    expect(stored().bestScores).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start guided activity' }))
    expect(document.querySelector('[data-case-stage="manage"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.queryByText(/Clues are off/)).not.toBeInTheDocument()
  },
)

it.each(clinicalPracticeScenarios.map((scenario) => scenario.id))(
  '%s opens management and explanation without a plan',
  async (id) => {
    window.history.replaceState(null, '', `/cardiohelp-ecmo/practice?case=${id}`)
    render(<EcmoPracticeActivity section="practice" />)
    await waitFor(() => expect(document.querySelector('[data-hydrated="true"]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Start guided activity' }))
    expect(document.querySelector('[data-case-stage="manage"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
    expect(screen.getByText('No action was recorded in this run.')).toBeInTheDocument()
    expect(stored().scenarioAttempts).toBeUndefined()
  },
)

it.each([
  'vv-normal-state',
  'va-normal-state',
  'vv-integration-capstone',
  'va-integration-capstone',
] as const)('%s permits no-answer review and reload without an invented answer', (sectionId) => {
  const supportMode = sectionId.startsWith('vv') ? 'vv' : 'va'
  const view = render(<FoundationStageHost sectionId={sectionId} supportMode={supportMode} />)
  const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')]
  expect(rows.every((button) => !button.disabled)).toBe(true)
  fireEvent.click(rows.at(-1)!)
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
  expect(document.querySelector('[data-optional-explanation]')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
  expect(stored().completedFoundationSectionIds).toBeUndefined()
  expect(stored().selfPaced.visitedTopicIds).toContain(`learn:${supportMode}:${sectionId}`)
  view.unmount()
  render(
    <FoundationStageHost sectionId={sectionId} supportMode={supportMode} initialPhase="transfer" />,
  )
  expect(document.querySelectorAll('[data-step-state="done"]')).toHaveLength(0)
  expect(global.fetch).not.toHaveBeenCalled()
})

it('preserves every legacy field while using only new visits and location for navigation', () => {
  const legacy = {
    ...createDefaultProgress(),
    version: 1,
    bestScores: { 'vv-off-sweep-capstone': 100 },
    mastery: true,
    unknownLegacy: { preserve: 'exactly' },
  }
  localStorage.setItem(CARDIOHELP_PROGRESS_STORAGE_KEY, JSON.stringify(legacy))
  const current = parseLearningProgress(JSON.stringify(legacy))
  expect(current.bestScores).toEqual({})
  expect(nextIncompleteSectionLink('vv', current)?.section.id).toBe('why-extracorporeal-support')
  writeLearningProgress(
    recordTopicVisit(current, {
      section: 'learn',
      supportMode: 'vv',
      scenarioId: 'gas-source-interruption',
    }),
  )
  const { selfPaced, ...preserved } = stored()
  expect(preserved).toEqual(legacy)
  expect(selfPaced.visitedTopicIds).toEqual(['learn:vv:gas-source-interruption'])
  expect(
    nextIncompleteSectionLink('vv', parseLearningProgress(JSON.stringify(stored())))?.section.id,
  ).toBe('gas-source-interruption')
})

it.each(
  ecmoInteractiveFoundationSectionIds.flatMap((id) =>
    (['recognize', 'predict', 'act', 'observe', 'explain', 'transfer'] as const).map((phase) => ({
      id,
      phase,
    })),
  ),
)(
  '$id / $phase reloads a fresh model with an open outline and no restored answers or actions',
  ({ id, phase }) => {
    render(
      <FoundationStageHost
        sectionId={id}
        supportMode={id.startsWith('va-') ? 'va' : 'vv'}
        initialPhase={phase}
      />,
    )
    expect(document.querySelector('[data-step-list] [aria-current="step"]')).toBe(
      document.querySelector('[data-step-list] button'),
    )
    expect(document.querySelectorAll('[data-step-state="done"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-comparison-complete="true"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')].every(
        (button) => !button.disabled,
      ),
    ).toBe(true)
    expect(stored().selfPaced.visitedTopicIds.length).toBe(1)
    expect(stored().scenarioAttempts).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
  },
)

it.each(['gas-source-interruption', 'va-gas-source-interruption'])(
  '%s reaches the air event through sequential no-answer skips',
  async (id) => {
    await mountDrill(id)
    const lesson = buildDrillStageLesson(resolveGuidedLesson(id), latestState().supportMode)
    const transferIndex = lesson.steps.findIndex(
      (step) => step.interaction.kind === 'transfer-scenario',
    )
    for (let i = 0; i < transferIndex; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
    }
    expect(latestState().scenario.prediction.committed).toBe(false)
    expect(latestState().scenario.activityStarted).toBe(false)
    expect(latestState().simulationTime).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Start guided activity' }))
    fireEvent.click(screen.getByRole('button', { name: /^Return clamp/ }))
    expect(latestState().circuit.returnClampClosed).toBe(true)
    expect(latestState().scenario.prediction.committed).toBe(false)
    expect(latestState().device.pumpRunning).toBe(false)
    expect(stored().scenarioAttempts).toBeUndefined()
  },
)

it('opens debrief directly from the stage outline without claiming a reassessment', async () => {
  render(<EcmoPracticeActivity section="practice" />)
  await waitFor(() => expect(document.querySelector('[data-hydrated="true"]')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /5.*Debrief/ }))
  expect(screen.queryByText('Your reassessment is recorded')).not.toBeInTheDocument()
  expect(screen.getByText('No action was recorded in this run.')).toBeInTheDocument()
  expect(stored().scenarioAttempts).toBeUndefined()
})
