import { ecmoSimulationReducer } from '../engine'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { FoundationComparison } from '../components/teaching/FoundationComparison'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
  type EcmoSharedFoundationSectionId,
} from '../content/foundationLessonRuntime'
import { ecmoFoundationTeachingTasks } from '../content/foundationTeachingTasks'
import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  parseProgress,
  recordScenarioResult,
} from '../engine/progress'
import type { SupportMode } from '../engine/types'
import {
  createEcmoFoundationSessionState,
  createFoundationVariantState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
  ecmoFoundationSnapshot,
  type EcmoFoundationComparisonPlan,
} from '../session/foundationSession'
import {
  advanceFoundationOnce,
  currentFoundationStep,
  reachFoundationStep,
  submitFoundationAnswer,
} from '../test-support/foundationJourney'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))
jest.mock('../components/EcmoCircuit3D', () => ({ EcmoCircuit3D: () => <div /> }))

function planFor(
  section: EcmoSharedFoundationSectionId,
  taskId: string,
  mode: SupportMode,
): EcmoFoundationComparisonPlan {
  const task = ecmoFoundationTeachingTasks[section].find((task) => task.id === taskId)!
  const runtime = ecmoFoundationLessonRuntime(section)
  const guided = runtime.guidedActions.find((action) => action.id === task.actionId)!
  return {
    taskId: `${section}-${taskId}`,
    guided,
    baselineVariant: ecmoFoundationPrimaryVariant(runtime, mode),
    resultVariant: ecmoFoundationVariant(runtime, mode, guided.variantId!)!,
  }
}
const comparisonTasks = (
  Object.keys(ecmoFoundationTeachingTasks) as EcmoSharedFoundationSectionId[]
).flatMap((section) =>
  ecmoFoundationTeachingTasks[section]
    .filter((task) => task.actionId)
    .flatMap((task) => (['vv', 'va'] as const).map((mode) => ({ section, taskId: task.id, mode }))),
)

function cells(signal: string): string[] {
  return [...document.querySelectorAll(`[data-comparison-signal="${signal}"] td`)].map(
    (cell) => cell.textContent ?? '',
  )
}
function primary() {
  return document.querySelector<HTMLButtonElement>('[data-now-primary]')!
}

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  window.localStorage.clear()
})

describe('retained comparisons use the real model and authored actions', () => {
  it.each(comparisonTasks)(
    '$section / $taskId / $mode has its own unchanged baseline, result and modeled time',
    ({ section, taskId, mode }) => {
      const plan = planFor(section, taskId, mode)
      const initial = createEcmoFoundationSessionState(plan.baselineVariant)
      const expected = ecmoFoundationSessionReducer(
        initial,
        ecmoFoundationRestoreAction(plan.resultVariant, plan.guided),
      ).simulation
      const first = ecmoFoundationSessionReducer(initial, { type: 'RUN_COMPARISON', plan })
      const saved = first.comparisons[plan.taskId]
      expect(saved.before).toEqual(
        ecmoFoundationSnapshot(createFoundationVariantState(plan.baselineVariant)),
      )
      expect(saved.after).toEqual(ecmoFoundationSnapshot(expected))
      expect(saved.before.simulationTime).toBe(8)
      expect(saved.after.simulationTime).toBe(expected.simulationTime)
      expect(first.clockRunning).toBe(false)
      // Deliberately evolve the current state. Repeating still starts at the same reference.
      const evolved = ecmoFoundationSessionReducer(first, { type: 'ADVANCE', seconds: 10 })
      const repeated = ecmoFoundationSessionReducer(evolved, { type: 'RUN_COMPARISON', plan })
      expect(repeated.comparisons[plan.taskId]).toEqual(saved)
      // Reopening uses the retained object, not a rerun at a new time.
      const reopened = ecmoFoundationSessionReducer(evolved, { type: 'OPEN_COMPARISON', plan })
      expect(reopened.simulation).toBe(saved.result)
      expect(reopened.comparisons[plan.taskId]).toBe(saved)
    },
  )

  it.each(['vv', 'va'] as const)(
    '%s oxygen fraction produces a visible off-console sample response',
    (mode) => {
      const plan = planFor('blood-flow-versus-sweep', 'oxygen', mode)
      const session = ecmoFoundationSessionReducer(
        createEcmoFoundationSessionState(plan.baselineVariant),
        { type: 'RUN_COMPARISON', plan },
      )
      const saved = session.comparisons[plan.taskId]
      render(
        <FoundationComparison
          baseline={saved.before}
          comparison={saved}
          actionId={plan.guided.id}
          supportMode={mode}
        />,
      )
      expect(cells('gasOxygenFraction')).toEqual(['1.00', '0.60', '-0.40'])
      expect(cells('postOxygenatorSaturation')).toEqual(['99.0', '97.8', '-1.2'])
      expect(saved.after.simulationTime - saved.before.simulationTime).toBe(20)
      expect(saved.after.bloodFlow).toBe(saved.before.bloodFlow)
      expect(saved.after.sweepLpm).toBe(saved.before.sweepLpm)
      if (mode === 'va') {
        expect(cells('rightRadialSpo2')).toEqual(['96.0', '96.0', '0.0'])
        expect(screen.getByText(/fixed in this preview/)).toBeInTheDocument()
      } else expect(Number(cells('spo2')[2])).toBeLessThan(0)
      expect(screen.getByText(/simulated sample, off console/)).toBeInTheDocument()
    },
  )

  it('reset removes only the intended comparison and leaves missing pressures unavailable', () => {
    const pump = planFor('blood-flow-versus-sweep', 'pump', 'vv')
    const sweep = planFor('blood-flow-versus-sweep', 'sweep', 'vv')
    let session = createEcmoFoundationSessionState(pump.baselineVariant)
    session = ecmoFoundationSessionReducer(session, { type: 'RUN_COMPARISON', plan: pump })
    session = ecmoFoundationSessionReducer(session, { type: 'RUN_COMPARISON', plan: sweep })
    const savedPump = session.comparisons[pump.taskId]
    session = ecmoFoundationSessionReducer(session, {
      type: 'OPEN_COMPARISON',
      plan: sweep,
      reset: true,
    })
    expect(session.comparisons[sweep.taskId]).toBeUndefined()
    expect(session.comparisons[pump.taskId]).toBe(savedPump)
    expect(session.simulation.device.rpmSetpoint).toBe(3200)
    expect(session.simulation.gas.sweepLpm).toBe(4)
    const disconnected = ecmoSimulationReducer(savedPump.result, { type: 'DISCONNECT_FLOW_SENSOR' })
    const unavailableFlow = ecmoFoundationSnapshot(disconnected)
    expect(unavailableFlow.displayedBloodFlow).toBeNull()
    expect(unavailableFlow.bloodFlow).toBeGreaterThan(0)
    // An unavailable input on either side makes its difference unavailable too.
    const before = { ...unavailableFlow, pInt: null, deltaP: null }
    const after = { ...savedPump.after, pVen: null }
    render(
      <FoundationComparison
        baseline={before}
        comparison={{ ...savedPump, before, after }}
        actionId="increase-rpm"
        supportMode="vv"
      />,
    )
    expect(cells('displayedBloodFlow')[0]).toBe('--')
    expect(cells('displayedBloodFlow')[2]).toBe('--')
    expect(cells('pInt')[0]).toBe('--')
    expect(cells('pInt')[2]).toBe('--')
    expect(cells('pVen')[1]).toBe('--')
    expect(cells('pVen')[2]).toBe('--')
    expect(cells('deltaP')[2]).toBe('--')
  })
})

describe('the rendered introductory teaching journey', () => {
  it('gates the real primary action, retains Back, and invalidates only a reset task', () => {
    render(<EcmoFoundationLessonActivity sectionId="pump-and-pressure-zones" supportMode="vv" />)
    expect(primary()).toHaveTextContent('Continue')
    advanceFoundationOnce()
    expect(currentFoundationStep()).toBe('pump-and-pressure-zones-act')
    expect(primary()).toHaveTextContent('Increase pump speed by 300 rpm')
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(
      document.querySelector('[data-step-id="pump-and-pressure-zones-observe"] button'),
    ).toBeEnabled()
    expect(document.querySelector('[data-foundation-comparison]')).toHaveAttribute(
      'data-comparison-complete',
      'false',
    )
    fireEvent.click(primary())
    expect(cells('rpmSetpoint')).toEqual(['3200', '3500', '+300'])
    expect(cells('displayedBloodFlow')).toEqual(['4.05', '4.43', '+0.38'])
    expect(cells('pInt')).toEqual(['242', '251', '+9'])
    const result = document.querySelector('[data-foundation-comparison]')!.textContent
    fireEvent.click(screen.getByRole('button', { name: 'Repeat this comparison' }))
    expect(document.querySelector('[data-foundation-comparison]')!.textContent).toBe(result)
    fireEvent.click(primary())
    expect(currentFoundationStep()).toBe('pump-and-pressure-zones-observe')
    expect(document.querySelector('[data-foundation-comparison]')!.textContent).toBe(result)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(document.querySelector('[data-foundation-comparison]')!.textContent).toBe(result)
    fireEvent.click(screen.getByRole('button', { name: 'Reset this comparison' }))
    expect(primary()).toHaveTextContent('Increase pump speed by 300 rpm')
    expect(cells('rpmSetpoint')).toEqual(['3200', '--', '--'])
    fireEvent.click(primary())
    expect(document.querySelector('[data-foundation-comparison]')!.textContent).toBe(result)
  })

  it('shows each control only on its own task and preserves the first case answer across story work', () => {
    const section = 'blood-flow-versus-sweep'
    const history = recordScenarioResult(createDefaultProgress(), {
      scenarioId: 'acute-hypercapnia',
      score: 63,
      criticalError: true,
      completed: false,
    })
    const payload = JSON.stringify(history)
    window.localStorage.setItem(CARDIOHELP_PROGRESS_STORAGE_KEY, payload)
    const writes = jest.spyOn(Storage.prototype, 'setItem')
    render(<EcmoFoundationLessonActivity sectionId={section} supportMode="vv" />)
    for (const taskId of ['pump', 'sweep', 'oxygen']) {
      reachFoundationStep(section, taskId)
      expect(document.querySelectorAll('[data-foundation-comparison]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-active-foundation-block]')).toHaveLength(1)
      expect(document.querySelector('[data-story-problems]')).toBeNull()
      fireEvent.click(primary())
    }
    reachFoundationStep(section, 'predict')
    const prediction = ecmoFoundationLearningItemsFor(section).prediction
    const firstAnswer = prediction.choices.find(
      (choice) => !prediction.correctChoiceIds.includes(choice.id),
    )!.id
    submitFoundationAnswer(firstAnswer)
    for (const taskId of ['sweep-story', 'speed-story']) {
      reachFoundationStep(section, taskId)
      expect(primary()).toHaveTextContent('Submit answer')
      expect(primary()).toBeDisabled()
      expect(document.querySelector('[data-foundation-comparison]')).toHaveAttribute(
        'data-comparison-complete',
        'false',
      )
      submitFoundationAnswer()
      expect(primary()).not.toHaveTextContent('Continue')
      fireEvent.click(primary())
      expect(primary()).toHaveTextContent('Continue')
    }
    reachFoundationStep(section, 'transfer')
    expect(writes).toHaveBeenCalledTimes(1)
    const { selfPaced, ...legacy } = JSON.parse(
      window.localStorage.getItem(CARDIOHELP_PROGRESS_STORAGE_KEY)!,
    )
    expect(legacy).toEqual(JSON.parse(payload))
    expect(selfPaced.visitedTopicIds).toContain(`learn:vv:${section}`)
    for (let i = 0; i < 3; i++) fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentFoundationStep()).toBe(`${section}-predict`)
    expect(document.querySelector(`input[value="${firstAnswer}"]`)).toBeChecked()
    expect(document.querySelector('fieldset[data-prediction-choices]')).toBeDisabled()
    reachFoundationStep(section, 'transfer')
    submitFoundationAnswer()
    const stored = parseProgress(window.localStorage.getItem(CARDIOHELP_PROGRESS_STORAGE_KEY))!
    expect(stored.scenarioAttempts).toEqual(history.scenarioAttempts)
    expect(stored.bestScores).toEqual(history.bestScores)
    expect(stored.criticalErrorStatus).toEqual(history.criticalErrorStatus)
    expect(stored.completedFoundationSectionIds).toBeUndefined()
  })

  it('track changes and fresh links start with teaching and fresh comparison state', () => {
    const view = render(
      <EcmoFoundationLessonActivity sectionId="blood-flow-versus-sweep" supportMode="vv" />,
    )
    reachFoundationStep('blood-flow-versus-sweep', 'oxygen')
    fireEvent.click(primary())
    view.rerender(
      <EcmoFoundationLessonActivity
        sectionId="blood-flow-versus-sweep"
        supportMode="va"
        initialPhase="transfer"
      />,
    )
    expect(currentFoundationStep()).toBe('blood-flow-versus-sweep-recognize')
    expect(document.querySelector('[data-ecmo-stage-frame]')).toHaveAttribute(
      'data-support-mode',
      'va',
    )
    expect(document.querySelector('[data-foundation-comparison]')).toBeNull()
    reachFoundationStep('blood-flow-versus-sweep', 'oxygen')
    expect(document.querySelector('[data-foundation-comparison]')).toHaveAttribute(
      'data-comparison-complete',
      'false',
    )
    expect(
      document.querySelector('[data-active-foundation-block="control-oxygen"]'),
    ).toHaveTextContent(/holds VA regional patient saturations fixed/)
    fireEvent.click(primary())
    expect(cells('rightRadialSpo2')[2]).toBe('0.0')
  })
})
