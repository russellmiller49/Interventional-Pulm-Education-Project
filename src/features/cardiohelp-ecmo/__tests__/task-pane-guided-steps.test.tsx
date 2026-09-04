import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { cardiohelpLearnLessons } from '../content/learnLessons'
import type { GuidedWalkthroughStep } from '../engine'
import {
  latestState,
  mountDrill,
  nowPrimary,
  nowStatus,
  readStep,
  resetStageHarness,
  openConsoleScreenAndAdvance,
} from '../test-support/learnStageHarness'

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
 * one step id, and they pin that a task-pane step still reaches the same simulator state — now on
 * the lesson stage, where the step is a model advance the Now card performs.
 */

jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
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

/** Drive the orientation lesson as far as the settling step and stop there. */
async function walkToSettlingStep() {
  await mountDrill('startup-sensor-orientation')
  readStep(/identify all four domains/i)
  await openConsoleScreenAndAdvance('Parameter list')

  const knob = screen.getByRole('slider', { name: /RPM rotary setpoint/i })
  while (latestState().device.rpmSetpoint < 3200) fireEvent.keyDown(knob, { key: 'ArrowUp' })
  await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
  fireEvent.click(screen.getByRole('button', { name: /^Next step$/i }))
}

beforeEach(() => {
  resetStageHarness()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
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
    // The whole defect in one assertion: no panel is told it is the thing to look at.
    const consolePanel = document.getElementById('cardiohelp-console')
    expect(consolePanel).not.toBeNull()
    expect(consolePanel).toHaveAttribute('data-guided-focus', 'false')
    expect(screen.queryByText(/Guided focus: device console/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Focus: Device console/i)).not.toBeInTheDocument()
    expect(document.querySelector('[data-simulator-task]')).toBeNull()
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
    expect(nowStatus()).toMatch(/Simulation update — no console action/i)
    expect(nowPrimary()).toHaveTextContent('Let the circuit respond')
  })

  it('reaches the same running circuit, flow and readouts the tour is read on', async () => {
    await walkToSettlingStep()

    const before = latestState()
    expect(before.device.rpmSetpoint).toBe(3200)
    expect(before.device.pumpRunning).toBe(false)
    expect(before.circuit.bloodFlow).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Let the circuit respond' }))

    const after = latestState()
    expect(after.device.rpmSetpoint).toBe(3200)
    expect(after.device.pumpRunning).toBe(true)
    expect(after.circuit.bloodFlow).toBeGreaterThan(0)
    for (const channel of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
      expect(after.circuit.readouts[channel].status).toBe('valid')
    }

    // And the separate Next step control now exists and is enabled — the button performs the
    // step, it does not silently advance the lesson.
    expect(nowStatus()).toMatch(/^Done\./)
    expect(screen.getByRole('button', { name: /^Next step$/i })).toBeEnabled()
  })

  it('leaves an ordinary console task with its focus, its help control and its target', async () => {
    await mountDrill('startup-sensor-orientation')
    readStep(/identify all four domains/i)

    // `startup-screen-parameters`: a genuine console task, one screen away.
    expect(document.querySelector('[data-simulator-task]')).not.toBeNull()
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
