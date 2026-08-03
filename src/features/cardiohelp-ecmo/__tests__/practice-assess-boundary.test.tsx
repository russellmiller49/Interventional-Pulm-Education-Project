import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { ecmoLearnPredictions } from '../content/learnPredictionItems'
import { cardiohelpScenarios } from '../content/scenarios'
import {
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
} from '../engine'
import { PracticeCasePlayer } from '../components/PracticeCasePlayer'

/**
 * The boundary this package deliberately did not cross.
 *
 * B1/B2 changed Learn only. Practice and Assess have their own feedback timing — manage the case,
 * get the correctness picture in the debrief — and redesigning that is a separate package (B2.1:
 * guided-Practice post-action coaching and independent Practice/Assess debrief timing). These tests
 * exist so that work is a decision someone makes on purpose rather than something that leaks
 * sideways out of a Learn change: they fail the moment a verdict, an authored Learn choice set, or
 * an immediate correctness label appears on a Practice or Assess surface.
 *
 * They pin behaviour, not implementation. Practice may be redesigned later; it may not be redesigned
 * by accident here.
 */

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/practice',
}))

function renderPractice(
  scenarioId: string,
  mode: 'guided' | 'challenge' = 'guided',
  prepare?: (state: ReturnType<typeof createInitialSimulationState>) => typeof state,
) {
  const scenario =
    clinicalPracticeScenarios.find((item) => item.id === scenarioId) ??
    cardiohelpScenarios.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`Missing scenario ${scenarioId}`)
  const initial = createInitialSimulationState(scenarioId, mode)
  const state = prepare ? prepare(initial) : initial
  const dispatch = jest.fn()
  render(
    <PracticeCasePlayer
      state={state}
      scenario={scenario}
      progress={createDefaultProgress()}
      outcome={selectScenarioOutcome(state)}
      dispatch={dispatch}
      onLoadScenario={jest.fn()}
      onReveal={jest.fn()}
    />,
  )
  return { scenario, state, dispatch }
}

/** Every authored Learn choice label, which no Practice or Assess surface may show. */
const learnChoiceLabels = Object.values(ecmoLearnPredictions).flatMap((entry) =>
  entry.item.choices.map((choice) => choice.label),
)

describe('Practice is unchanged by the Learn prediction work', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    mockRouterPush.mockReset()
  })

  it('still plans with its own three fields rather than an authored Learn choice set', () => {
    renderPractice('clinical-vv-initiation-ards')
    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))

    // Three independent selections, composed by the learner — not one question with authored
    // options. This is the distinction between Practice and Learn, and it stays.
    expect(screen.getByLabelText('Goal')).toBeInTheDocument()
    expect(screen.getByLabelText('First priority')).toBeInTheDocument()
    expect(screen.getByLabelText('Expected immediate effect')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    for (const label of learnChoiceLabels) {
      expect(screen.queryByText(label)).toBeNull()
    }
  })

  it('commits the learner’s own three fields and says nothing about whether they fit', () => {
    const { dispatch } = renderPractice('clinical-vv-initiation-ards')
    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))

    // A deliberately mismatched plan: Practice must accept it without comment.
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'relieve-obstruction' } })
    fireEvent.change(screen.getByLabelText('First priority'), { target: { value: 'rpm' } })
    fireEvent.change(screen.getByLabelText('Expected immediate effect'), {
      target: { value: 'decrease' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit before action' }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMIT_PREDICTION',
      goalId: 'relieve-obstruction',
      control: 'rpm',
      direction: 'decrease',
    })
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelector('[data-plausibility]')).toBeNull()
  })

  it('moves from plan to manage with no verdict in between', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )
    if (!scenario) throw new Error('missing scenario')

    renderPractice('clinical-vv-occult-hemorrhage', 'guided', (initial) =>
      ecmoSimulationReducer(initial, {
        type: 'COMMIT_PREDICTION',
        goalId: scenario.expectation.goalId,
        control: scenario.expectation.control,
        direction: scenario.expectation.direction,
      }),
    )

    /*
     * This is the behaviour the revision plan flagged and this package deliberately left alone:
     * committing moves straight to Manage, and the learner is told nothing about the plan on the
     * way. Redesigning it is B2.1's decision to make, not a side effect of the Learn work.
     */
    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    expect(within(workflow).getByRole('button', { name: /Manage/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.queryByRole('button', { name: /Commit before action/i })).toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(screen.queryByText(/why the other answers do not fit/i)).toBeNull()
  })

  it('gives a committed plan that misses the expectation no correctness label either', () => {
    renderPractice('clinical-vv-occult-hemorrhage', 'guided', (initial) =>
      ecmoSimulationReducer(initial, {
        type: 'COMMIT_PREDICTION',
        goalId: 'relieve-obstruction',
        control: 'rpm',
        direction: 'increase',
      }),
    )

    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelector('[data-plausibility]')).toBeNull()
    expect(screen.queryByText(/that read holds/i)).toBeNull()
    expect(screen.queryByText(/predicts a different pattern/i)).toBeNull()
  })

  it('keeps the engine’s scoring of a Practice plan exactly as it was', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )
    if (!scenario) throw new Error('missing scenario')
    const { goalId, control, direction } = scenario.expectation

    const matched = ecmoSimulationReducer(createInitialSimulationState(scenario.id, 'guided'), {
      type: 'COMMIT_PREDICTION',
      goalId,
      control,
      direction,
    })
    expect(matched.scenario.credit).toMatchObject({ goal: true, control: true, direction: true })
    expect(matched.scenario.phase).toBe('act')

    const missed = ecmoSimulationReducer(createInitialSimulationState(scenario.id, 'guided'), {
      type: 'COMMIT_PREDICTION',
      goalId: 'relieve-obstruction',
      control: 'rpm',
      direction: 'increase',
    })
    expect(missed.scenario.credit).toMatchObject({
      goal: false,
      control: false,
      direction: false,
    })
    expect(missed.scenario.phase).toBe('act')
  })
})

describe('Assess is unchanged by the Learn prediction work', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    mockRouterPush.mockReset()
  })

  it('labels nothing at commitment in Challenge mode', () => {
    const scenario = cardiohelpScenarios.find((item) => item.id === 'gas-source-interruption')
    if (!scenario) throw new Error('missing scenario')

    renderPractice('gas-source-interruption', 'challenge', (initial) =>
      ecmoSimulationReducer(initial, {
        type: 'COMMIT_PREDICTION',
        goalId: 'localize-resistance',
        control: 'rpm',
        direction: 'increase',
      }),
    )

    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelector('[data-plausibility]')).toBeNull()
    for (const label of learnChoiceLabels) {
      expect(screen.queryByText(label)).toBeNull()
    }
  })

  it('still defers the teaching note on an action until the learner asks for it', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )
    if (!scenario) throw new Error('missing scenario')
    const intervention = scenario.clinicalCase?.interventions.find(
      (item) => item.id === 'hemorrhage-search',
    )
    if (!intervention) throw new Error('missing intervention')

    renderPractice('clinical-vv-occult-hemorrhage', 'challenge', (initial) => {
      const committed = ecmoSimulationReducer(initial, {
        type: 'COMMIT_PREDICTION',
        goalId: scenario.expectation.goalId,
        control: scenario.expectation.control,
        direction: scenario.expectation.direction,
      })
      return ecmoSimulationReducer(committed, {
        type: 'APPLY_CLINICAL_INTERVENTION',
        interventionId: intervention.id,
      })
    })

    expect(screen.queryByText(intervention.response)).toBeNull()
    expect(screen.getByText(/Routine teaching note saved for the debrief/i)).toBeInTheDocument()
  })
})
