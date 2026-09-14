import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import CaseActivity from '../components/MechanicalVentilationCaseActivityV2'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationStageLesson } from '../content/stageLessons'
import { ventilationFinalQuestions } from '../content/learningQuestions'
import { VENTILATION_SELF_PACED_KEY, parseSelfPacedProgress } from '../engine/selfPacedProgress'
import type { VentilationAction, VentilationSimulationState } from '../engine/types'

let consoleState: VentilationSimulationState | undefined
const pushes: unknown[] = []
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : href.pathname + '?' + new URLSearchParams(href.query).toString()
      }
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: (target: unknown) => pushes.push(target) }),
}))
jest.mock('../components/MechanicalVentilatorConsole', () => ({
  MechanicalVentilatorConsole: ({
    state,
    dispatch,
    controlsEnabled,
  }: {
    state: VentilationSimulationState
    dispatch: (action: VentilationAction) => void
    controlsEnabled: boolean
  }) => {
    consoleState = state
    return (
      <div>
        <button
          disabled={!controlsEnabled || state.ventilator.locked}
          onClick={() => dispatch({ type: 'SET_CONTROL', control: 'oxygenPercent', value: 70 })}
        >
          Change oxygen
        </button>
        <button onClick={() => dispatch({ type: 'PERFORM_HOLD', hold: 'inspiratory' })}>
          Perform actual hold
        </button>
      </div>
    )
  },
}))

const legacyKeys = [
  'mechanical-ventilation-learning-flow-v1',
  'mechanical-ventilation-live-learning-v1',
  'mechanical-ventilation-progress-v2',
  'hamilton-c6-ventilation-progress-v1',
  'mechanical-ventilation-session-v1',
  'critical-care-activity-progress-v1',
]
let legacy: Record<string, string>
beforeEach(() => {
  localStorage.clear()
  pushes.length = 0
  consoleState = undefined
  jest.useFakeTimers()
  legacy = Object.fromEntries(
    legacyKeys.map((key) => [key, JSON.stringify({ retained: key, bestScore: 99 })]),
  )
  for (const [key, value] of Object.entries(legacy)) localStorage.setItem(key, value)
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})
const boot = () => act(() => jest.advanceTimersByTime(10))
function expectLegacyUnchanged() {
  for (const [key, value] of Object.entries(legacy)) expect(localStorage.getItem(key)).toBe(value)
}

describe('self-paced public MV (supersedes commitment, grading and replay gates)', () => {
  it.each(['placement', 'final', 'review'] as const)(
    '%s questions allow reveal, retry and continue without answers or saved responses',
    (kind) => {
      render(<MechanicalVentilationCourseCheck kind={kind} />)
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
      fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
      expect(screen.getByRole('heading', { name: 'Explanation' })).toBeInTheDocument()
      expect(
        screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
      ).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      expectLegacyUnchanged()
      expect(localStorage.getItem(VENTILATION_SELF_PACED_KEY)).toBeNull()
      expect(document.body.textContent).not.toMatch(
        /80%|passed|first.attempt|correct on this attempt|mastered/i,
      )
    },
  )

  it('explains a non-keyed choice without blocking the next application', () => {
    render(<MechanicalVentilationCourseCheck kind="final" />)
    const question = ventilationFinalQuestions[0]
    const choice = question.choices.find((item) => item.id !== question.correctId)!
    fireEvent.click(screen.getByRole('radio', { name: choice.label }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    expect(screen.getAllByText(choice.rationale).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expectLegacyUnchanged()
  })

  it.each(ventilationLearningUnits.map((unit) => unit.id))(
    '%s permits direct explanation and end-of-section navigation with no performed result',
    (unitId) => {
      render(<VentilationStageHost unitId={unitId} />)
      boot()
      const lesson = ventilationStageLesson(unitId)
      fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
        target: { value: lesson.steps.length - 1 },
      })
      expect(screen.getByText(/No response has been captured/)).toBeInTheDocument()
      expect(consoleState?.interventions).toEqual([])
      expect(consoleState?.prediction.mechanismId).toBeNull()
      expect(consoleState?.prediction.committed).toBe(false)
      expect(screen.getByRole('button', { name: 'Change oxygen' })).toBeEnabled()
      const stored = parseSelfPacedProgress(localStorage.getItem(VENTILATION_SELF_PACED_KEY))
      expect(stored.visited).toEqual([unitId])
      expect(stored.location?.step).toBe(lesson.steps.length - 1)
      expect(Object.keys(stored).sort()).toEqual(['location', 'version', 'visited'])
      expectLegacyUnchanged()
    },
  )

  it('keeps controls available during optional prediction, and reload restores only reading location', () => {
    const unitId = 'controls-and-goals'
    const lesson = ventilationStageLesson(unitId)
    const mounted = render(<VentilationStageHost unitId={unitId} />)
    boot()
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: lesson.predictionStepIndex },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change oxygen' }))
    expect(consoleState?.ventilator.settings.oxygenPercent).toBe(70)
    const reinforcement = document.querySelector('[data-reinforcement]') as HTMLElement
    fireEvent.click(within(reinforcement).getByRole('button', { name: 'Show explanation' }))
    expect(consoleState?.interventions).toEqual([])
    mounted.unmount()
    render(<VentilationStageHost unitId={unitId} />)
    boot()
    expect(screen.getByRole('combobox', { name: 'Choose step' })).toHaveValue(
      String(lesson.predictionStepIndex),
    )
    expect(consoleState?.simulationTime).toBe(0)
    expect(consoleState?.paused).toBe(true)
    expect(consoleState?.ventilator.settings.oxygenPercent).not.toBe(70)
    expectLegacyUnchanged()
  })

  it.each(['guided', 'practice', 'challenge'] as const)(
    'old %s case entry has no answer/timer/score gate or graded writes',
    (mode) => {
      render(<CaseActivity caseId="MV-14" deviceId="hamilton-c6" mode={mode} section="assess" />)
      boot()
      expect(consoleState?.prediction.committed).toBe(false)
      expect(consoleState?.challengeMode).toBe('untimed')
      fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
      expect(consoleState?.prediction.committed).toBe(false)
      expect(consoleState?.interventions).toEqual([])
      expect(screen.getByRole('button', { name: 'Change oxygen' })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'One breath' }))
      expect(consoleState!.simulationTime).toBeGreaterThan(0)
      fireEvent.click(screen.getByRole('button', { name: 'Perform actual hold' }))
      expect(consoleState?.ventilator.holdType).toBe('inspiratory')
      fireEvent.click(screen.getByRole('button', { name: 'Restart patient' }))
      expect(consoleState?.simulationTime).toBe(0)
      expect(consoleState?.prediction.committed).toBe(false)
      expectLegacyUnchanged()
      expect(document.body.textContent).not.toMatch(
        /score\s*\d|passed|mastered|first.attempt|time remaining/i,
      )
    },
  )

  it('excludes the misleading MV-03 live example on a saved challenge URL', () => {
    render(<CaseActivity caseId="MV-03" deviceId="hamilton-c6" mode="challenge" section="assess" />)
    boot()
    expect(screen.getByText(/live case under modeling review/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change oxygen' })).not.toBeInTheDocument()
    expect(consoleState).toBeUndefined()
    expectLegacyUnchanged()
  })
})
