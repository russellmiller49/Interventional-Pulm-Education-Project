import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useCallback, useReducer, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

import { cardiohelpLearnLessons } from '../content/learnLessons'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type GuidedControlId,
  type GuidedTarget,
  type GuidedWalkthroughStep,
} from '../engine'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { LearnLessonPlayer, resolveGuidedLesson } from '../components/LearnLessonPlayer'

/**
 * A step the learner completes in the lesson pane must not be dressed as a console task.
 *
 * Owner smoke test, 2026-08-06: `startup-settle-circuit` showed "Focus: Device console", a
 * sliders/control icon, and an "I need help finding it" button. All three describe something on the
 * CARDIOHELP, and there is nothing on the CARDIOHELP that can satisfy the step — its two `STEP`
 * actions advance the *model* so the circuit responds to the RPM change the previous step made. The
 * help button's only possible answer was to spotlight the whole console section, which is exactly
 * the hunt the owner reported.
 *
 * These tests pin the distinction at the level it is authored (`interaction`), not at the level of
 * one step id, and they pin that a task-pane step still reaches the same simulator state.
 */

jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const SETTLE_STEP_ID = 'startup-settle-circuit'

function allSteps(): readonly GuidedWalkthroughStep[] {
  return cardiohelpLearnLessons.flatMap((lesson) => lesson.steps)
}

function stepById(id: string): GuidedWalkthroughStep {
  const found = allSteps().find((step) => step.id === id)
  if (!found) throw new Error(`No guided step ${id}`)
  return found
}

interface Probe {
  rpmSetpoint: number
  pumpRunning: boolean
  flow: number
  pVen: string
  pInt: string
  pArt: string
  deltaP: string
}

function readProbe(): Probe {
  return JSON.parse(screen.getByTestId('probe').textContent ?? '{}') as Probe
}

const targetChanges: (GuidedTarget | null)[] = []

function Harness({ scenarioId }: { scenarioId: string }) {
  const [state, dispatch] = useReducer(ecmoSimulationReducer, scenarioId, (id) =>
    createInitialSimulationState(id, 'guided'),
  )
  const [guidedTarget, setGuidedTarget] = useState<GuidedTarget | null>('circuit')
  const [guidedControlId, setGuidedControlId] = useState<GuidedControlId | null>(null)
  const lesson = resolveGuidedLesson(scenarioId)
  /*
   * Stable identity, like the real workbench's `useCallback`. An inline arrow here re-runs the
   * player's step-entry effect on every render, and that effect clears the help control — which
   * looks exactly like a broken help button.
   */
  const handleTargetChange = useCallback((target: GuidedTarget | null) => {
    targetChanges.push(target)
    setGuidedTarget(target)
  }, [])

  const probe: Probe = {
    rpmSetpoint: state.device.rpmSetpoint,
    pumpRunning: state.device.pumpRunning,
    flow: state.circuit.bloodFlow,
    pVen: state.circuit.readouts.pVen.status,
    pInt: state.circuit.readouts.pInt.status,
    pArt: state.circuit.readouts.pArt.status,
    deltaP: state.circuit.readouts.deltaP.status,
  }

  return (
    <>
      <output data-testid="probe">{JSON.stringify(probe)}</output>
      <LearnLessonPlayer
        key={lesson.id}
        state={state}
        lesson={lesson}
        dispatch={dispatch}
        onSelectLesson={jest.fn()}
        onCompleteLesson={jest.fn()}
        onTryPractice={jest.fn()}
        onTargetChange={handleTargetChange}
        onControlHelpChange={setGuidedControlId}
      />
      <CardiohelpConsole
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={guidedTarget}
        guidedControlId={guidedControlId}
      />
    </>
  )
}

function nextStep() {
  fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
}

/** Drive the orientation lesson as far as the settling step and stop there. */
async function walkToSettlingStep() {
  render(<Harness scenarioId="startup-sensor-orientation" />)
  fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
  nextStep()

  fireEvent.click(screen.getByRole('button', { name: 'Parameter list' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled())
  nextStep()

  const knob = screen.getByRole('slider', { name: /RPM rotary setpoint/i })
  while (readProbe().rpmSetpoint < 3200) fireEvent.keyDown(knob, { key: 'ArrowUp' })
  await waitFor(() => expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled())
  nextStep()
}

beforeEach(() => {
  targetChanges.length = 0
})

describe('a task-pane step is not presented as a console task', () => {
  it('declares itself in the authored step rather than being inferred from its actions', () => {
    const settle = stepById(SETTLE_STEP_ID)
    expect(settle.interaction).toBe('task-pane')

    // Authored, and it has to be: `startup-respond` carries one action and is a real console task;
    // this step carries two and is not. No rule over action types separates them.
    expect(settle.actions).toEqual([{ type: 'STEP' }, { type: 'STEP' }])
    expect(stepById('startup-respond').interaction).toBeUndefined()
  })

  it('carries the same declaration on the VA clone', () => {
    expect(stepById(`va-${SETTLE_STEP_ID}`).interaction).toBe('task-pane')
  })

  it('publishes no simulator focus target and focuses no panel', async () => {
    await walkToSettlingStep()

    expect(screen.getByRole('heading', { name: 'Let the circuit respond' })).toBeInTheDocument()
    // The whole defect in one assertion: the last target published on entering this step is null,
    // so no panel is told it is the thing to look at.
    expect(targetChanges.at(-1)).toBeNull()

    const consolePanel = document.getElementById('cardiohelp-console')
    expect(consolePanel).not.toBeNull()
    expect(consolePanel).toHaveAttribute('data-guided-focus', 'false')
    expect(screen.queryByText(/Guided focus: device console/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Focus: Device console/i)).not.toBeInTheDocument()
  })

  it('offers no help-finding control, because there is nothing on the console to find', async () => {
    await walkToSettlingStep()

    expect(
      screen.queryByRole('button', { name: /I need help finding it/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show me where/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Highlight it again/i })).not.toBeInTheDocument()
  })

  it('says in its own words that no console action is required', async () => {
    await walkToSettlingStep()

    expect(screen.getByText(/No console action is required/i)).toBeInTheDocument()
    expect(screen.getByText(/Simulation update — no console action/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Let the circuit respond' })).toHaveAttribute(
      'data-interaction',
      'task-pane',
    )
  })

  it('reaches the same running circuit, flow and readouts the tour is read on', async () => {
    await walkToSettlingStep()

    const before = readProbe()
    expect(before).toMatchObject({ rpmSetpoint: 3200, pumpRunning: false, flow: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Let the circuit respond' }))

    const after = readProbe()
    expect(after.rpmSetpoint).toBe(3200)
    expect(after.pumpRunning).toBe(true)
    expect(after.flow).toBeGreaterThan(0)
    for (const channel of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
      expect(after[channel]).toBe('valid')
    }

    // And the separate Next step control still exists and is now enabled — the button performs the
    // step, it does not silently advance the lesson.
    expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled()
  })

  it('leaves an ordinary console task with its focus, its help control and its target', async () => {
    render(<Harness scenarioId="startup-sensor-orientation" />)
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    nextStep()

    // `startup-screen-parameters`: a genuine console task, one screen away.
    expect(screen.getAllByText(/Focus: Device console/i).length).toBeGreaterThan(0)
    expect(targetChanges.at(-1)).toBe('console')
    expect(screen.getByRole('button', { name: /Show me where/i })).toBeInTheDocument()
    expect(document.getElementById('cardiohelp-console')).toHaveAttribute(
      'data-guided-focus',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    await waitFor(() =>
      expect(document.getElementById('cardiohelp-screen-parameters')).toHaveAttribute(
        'data-guided-help',
        'true',
      ),
    )
  })
})

describe('every authored task-pane step', () => {
  const taskPaneSteps = allSteps().filter((step) => step.interaction === 'task-pane')

  it('exists', () => {
    expect(taskPaneSteps.map((step) => step.id)).toEqual([SETTLE_STEP_ID, `va-${SETTLE_STEP_ID}`])
  })

  it.each(taskPaneSteps.map((step) => [step.id, step] as const))(
    '%s: is completed in the pane and never asks the learner to find a control',
    (_id, step) => {
      expect(step.actions.length).toBeGreaterThan(0)
      // A prediction step is answered, not performed; the two modes must not collide.
      expect(step.predictionScenarioId).toBeUndefined()
      // Copy that would send the learner to the device.
      expect(step.instruction).not.toMatch(/\bon the console\b/i)
      expect(step.actionLabel).not.toMatch(/\bconsole\b/i)
    },
  )
})
