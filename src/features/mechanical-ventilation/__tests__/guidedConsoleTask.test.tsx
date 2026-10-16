/**
 * "Show me where" and the Now card's instruction name a control the learner can actually find on
 * the console in front of them, and the instruction stops once the lab says the goal is met.
 *
 * Every authored goal, on every one of the four consoles: the id the resolver returns is on the
 * rendered surface (following the console's own screen navigation, as a learner would), a setting
 * goal's target is a value that console's knob can reach, and applying the goal's own action turns
 * the task satisfied.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render } from '@testing-library/react'

import { VentilationConsoleSurface } from '../components/stage/VentilationConsoleSurface'
import { buildConsoleNumericControls } from '../content/consoleControls'
import { consoleScreenId } from '../content/consoleControlIds'
import {
  canonicalToNativeControlValue,
  getVentilatorDeviceProfile,
  nativeToCanonicalControlValue,
} from '../content/deviceProfiles'
import { resolveGuidedConsoleTask } from '../content/guidedConsoleTask'
import { ventilationLearningExperiments, type LabGoal } from '../content/learningExperiments'
import { ventilationStageLesson } from '../content/stageLessons'
import {
  createLabSession,
  labGoalAction,
  labGoalMet,
  learningLabReducer,
  type LabAction,
  type LabSession,
} from '../engine/learningLab'
import { completedBreath } from '../engine/teachingBreath'
import { ventilatorDeviceIds, type VentilationAction, type VentilatorScreen } from '../engine/types'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)
// Each case renders the console surface and runs the real engine.
jest.setTimeout(30_000)

const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })

function started(unitId: string, round: 0 | 1, device: (typeof ventilatorDeviceIds)[number]) {
  let session = createLabSession(unitId, device)
  session = learningLabReducer(session, { type: 'OPEN_ROUND', round })
  return learningLabReducer(session, { type: 'START_EXPERIMENT' })
}

function taskStep(unitId: string, round: 0 | 1) {
  const lesson = ventilationStageLesson(unitId)
  return lesson.steps.find(
    (step) => step.interaction.kind === 'simulator-task' && step.interaction.round === round,
  )
}

function surface(session: LabSession, unitId: string, round: 0 | 1) {
  const step = taskStep(unitId, round)!
  const experiment = ventilationLearningExperiments.find((item) => item.unitId === unitId)!
  return (
    <VentilationConsoleSurface
      session={session}
      step={step}
      round={experiment.rounds[round]}
      engine={() => undefined}
      lab={() => undefined}
      guidedControlId={null}
      onPendingChange={() => undefined}
      onSelectDevice={() => undefined}
      onResetPatient={() => undefined}
    />
  )
}

/** Run the model until the goal is met (a hold or a bedside action needs model time). */
function untilMet(goal: LabGoal, session: LabSession): LabSession {
  let current = learningLabReducer(session, engine({ type: 'SET_PAUSED', paused: false }))
  for (let steps = 0; steps < 3000 && !labGoalMet(goal, current); steps += 1)
    current = learningLabReducer(current, engine({ type: 'TICK', seconds: 0.1 }))
  return current
}

// Every goal a Learn task asks for: the parts that have a simulator task in their lesson.
const cases = ventilationLearningExperiments.flatMap((experiment) =>
  ([0, 1] as const)
    .filter((round) => taskStep(experiment.unitId, round) !== undefined)
    .flatMap((round) =>
      experiment.rounds[round].goals.flatMap((goal, index) =>
        ventilatorDeviceIds.map(
          (device) => [experiment.unitId, round, index, goal.type, device] as const,
        ),
      ),
    ),
)

describe('guided console task', () => {
  it.each(cases)('%s part %i goal %i (%s) on %s', (unitId, round, index, _kind, device) => {
    const goal = ventilationLearningExperiments.find((item) => item.unitId === unitId)!.rounds[
      round
    ].goals[index]
    const profile = getVentilatorDeviceProfile(device)
    let session = started(unitId, round, device)
    // The goals before this one, done in the order the task lists them (a condensate is cleared
    // after the circuit is inspected), then paused where a learner would be.
    const goals = ventilationLearningExperiments.find((item) => item.unitId === unitId)!.rounds[
      round
    ].goals
    for (const earlier of goals.slice(0, index)) {
      if (earlier.type === 'pause-expiration' || earlier.type === 'inspect-inspiration') continue
      session = untilMet(earlier, learningLabReducer(session, engine(labGoalAction(earlier)!)))
    }
    session = learningLabReducer(session, engine({ type: 'SET_PAUSED', paused: true }))
    let task = resolveGuidedConsoleTask(goal, session, profile)
    expect(task.satisfied).toBe(false)
    expect(task.instruction.length).toBeGreaterThan(15)

    // Follow the console's own navigation the way the instruction says.
    const { rerender } = render(surface(session, unitId, round))
    for (let hops = 0; hops < 2; hops += 1) {
      expect(document.getElementById(task.controlId)).not.toBeNull()
      const screen = (['controls', 'tools'] as VentilatorScreen[]).find(
        (candidate) => task.controlId === consoleScreenId(candidate),
      )
      if (!screen) break
      session = learningLabReducer(session, engine({ type: 'SET_SCREEN', screen }))
      rerender(surface(session, unitId, round))
      task = resolveGuidedConsoleTask(goal, session, profile)
    }
    expect(document.getElementById(task.controlId)).not.toBeNull()

    if (goal.type === 'control') {
      // The target is a value this console's knob reaches, and reaching it meets the goal.
      const settings = session.simulation.ventilator.settings
      const control = buildConsoleNumericControls(device, settings).find(
        (candidate) => candidate.key === goal.key,
      )!
      const target = canonicalToNativeControlValue(device, settings, goal.key, goal.value)
      const steps = (target - control.value) / control.step
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6)
      expect(target).toBeGreaterThanOrEqual(control.minimum - 1e-9)
      expect(target).toBeLessThanOrEqual(control.maximum + 1e-9)
      const turned = learningLabReducer(
        session,
        engine({
          type: 'SET_CONTROL',
          control: goal.key,
          value: Number(
            nativeToCanonicalControlValue(
              device,
              settings,
              goal.key,
              Number(target.toFixed(2)),
            ).toFixed(2),
          ),
        }),
      )
      expect(resolveGuidedConsoleTask(goal, turned, profile).satisfied).toBe(true)
      expect(task.instruction).toContain(String(Number(target.toFixed(2))))
    }

    // The goal's own action, and the model time it needs, satisfy the task.
    let done: LabSession
    if (goal.type === 'pause-expiration' || goal.type === 'inspect-inspiration') {
      const breath = completedBreath(session.evidence[round].baseline!.waveforms)
      const phase = goal.type === 'pause-expiration' ? 'expiration' : 'inspiration'
      const sample = breath.find(
        (item, i) => i > 2 && i < breath.length - 2 && item.phase === phase,
      )!
      done = learningLabReducer(session, { type: 'INSPECT', sampleTime: sample.time })
    } else {
      done = untilMet(goal, learningLabReducer(session, engine(labGoalAction(goal)!)))
    }
    expect(resolveGuidedConsoleTask(goal, done, profile).satisfied).toBe(true)
  })

  it('says "press the knob" or "press ACCEPT" while a knob-and-confirm console holds an edit', () => {
    const goal = { type: 'control', key: 'vtMl', value: 500 } as const
    for (const device of ventilatorDeviceIds) {
      const profile = getVentilatorDeviceProfile(device)
      const session = learningLabReducer(
        started('controls-and-goals', 0, device),
        engine({ type: 'SET_SCREEN', screen: 'controls' }),
      )
      const pending = { key: 'vtMl' as const, label: 'VT', displayValue: '500', unit: 'mL' }
      const task = resolveGuidedConsoleTask(goal, session, profile, pending)
      if (profile.commitBehavior === 'immediate') {
        expect(task.controlId).toBe('mv-control-vtMl')
      } else {
        expect(task.controlId).toBe('mv-pending-confirm')
        expect(task.instruction).toMatch(
          device === 'carefusion-avea' ? /press ACCEPT/ : /press the knob/,
        )
      }
    }
  })
})
