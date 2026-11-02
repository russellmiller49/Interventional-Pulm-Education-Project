import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { PatientMonitor } from '../components/CircuitAndMonitors'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { cardiohelpScenarioById } from '../content/scenarios'
import { ECMO_NUMBERS } from '../content/teachingNumbers'
import {
  CARDIOHELP_PROGRESS_VERSION,
  createDefaultProgress,
  parseProgress,
  recordLearnLessonCompleted,
} from '../engine/progress'
import { ecmoSimulationReducer, selectScenarioOutcome } from '../engine/reducer'
import { createInitialSimulationState, LV_UNLOADING_RESPONSE } from '../engine/simulation'
import type { EcmoSimulationState, GuidedWalkthroughStep, SimulationAction } from '../engine/types'
import {
  answerPredictionAndAdvance,
  awaitDoneAndAdvance,
  latestState,
  mountDrill,
  nowStatus,
  performAndAdvance,
  readStep,
  resetStageHarness,
} from '../test-support/learnStageHarness'

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

const SCENARIO_ID = 'va-lv-loading'
const VENT_LINE_MMHG = LV_UNLOADING_RESPONSE.ejectingPulsePressure

function lessonSteps(): readonly GuidedWalkthroughStep[] {
  const lesson = cardiohelpLearnLessonByScenarioId.get(SCENARIO_ID)
  if (!lesson) throw new Error(`No Learn lesson for ${SCENARIO_ID}`)
  return lesson.steps
}

function lessonStep(suffix: string): GuidedWalkthroughStep {
  const found = lessonSteps().find((step) => step.id === `${SCENARIO_ID}-${suffix}`)
  if (!found) throw new Error(`No lesson step ${suffix}`)
  return found
}

function dispatchAll(
  state: EcmoSimulationState,
  actions: readonly SimulationAction[],
): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, state)
}

function fresh(): EcmoSimulationState {
  return createInitialSimulationState(SCENARIO_ID, 'guided')
}

/** Every action the lesson offers, in order, up to and including the named step. */
function walkTo(lastSuffix?: string): EcmoSimulationState {
  let state = fresh()
  for (const step of lessonSteps()) {
    // The transfer step's action belongs to the next patient, which the stage loads first.
    if (step.transferScenarioId) break
    state = dispatchAll(state, step.actions)
    if (lastSuffix && step.id === `${SCENARIO_ID}-${lastSuffix}`) break
  }
  return state
}

function tick(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  return dispatchAll(
    state,
    Array.from({ length: seconds }, () => ({ type: 'STEP' as const })),
  )
}

function lvReadings(state: EcmoSimulationState) {
  const { pulsePressure, aorticValveOpening, nativeCardiacOutputLpm, pulmonaryCongestion } =
    state.patient
  return { pulsePressure, aorticValveOpening, nativeCardiacOutputLpm, pulmonaryCongestion }
}

describe('the VA LV-loading lesson does what it says', () => {
  it('the walked lesson lowers flow, and the valve and the pulse answer it', () => {
    const start = fresh()
    const end = walkTo()

    expect(end.device.rpmSetpoint).toBeLessThan(start.device.rpmSetpoint)
    expect(end.circuit.bloodFlow).toBeLessThan(start.circuit.bloodFlow)
    expect(end.patient.pulsePressure).toBeGreaterThanOrEqual(VENT_LINE_MMHG)
    expect(end.patient.aorticValveOpening).toBe(true)
    expect(end.patient.nativeCardiacOutputLpm).toBeGreaterThan(start.patient.nativeCardiacOutputLpm)
  })

  it('offers each move as its own action, in the order the moves are taught', () => {
    const responses = lessonSteps().filter((step) => step.phase === 'respond')
    expect(responses.map((step) => step.id)).toEqual([
      'va-lv-loading-lower-flow',
      'va-lv-loading-read-flow-response',
      'va-lv-loading-start-inotrope',
      'va-lv-loading-escalate-lv-loading',
    ])
  })

  it('walks to the same state every time', () => {
    expect(walkTo()).toEqual(walkTo())
  })
})

describe('each action the lesson offers', () => {
  it('lower pump speed: the console answers at once and the patient waits for the clock', () => {
    const before = walkTo('interpret')
    const step = lessonStep('lower-flow')
    const after = dispatchAll(before, step.actions)

    expect(step.actionLabel).toBe('Lower pump speed to 2400 rpm')
    expect(step.actions).toEqual([{ type: 'SET_RPM', rpm: 2400 }])
    expect(after.device.rpmSetpoint).toBe(2400)
    expect(after.circuit.bloodFlow).toBeCloseTo(3, 0)
    expect(after.circuit.bloodFlow).toBeLessThan(before.circuit.bloodFlow)
    expect(after.patient).toEqual(before.patient)
  })

  it('reading lower flow alone: the pulse widens, stays under the line, and the valve stays shut', () => {
    const after = walkTo('read-flow-response')

    expect(after.scenario.inotropeRunning).toBeUndefined()
    expect(after.patient.pulsePressure).toBe(LV_UNLOADING_RESPONSE.settledByMoves[1].pulsePressure)
    expect(after.patient.pulsePressure).toBeLessThan(VENT_LINE_MMHG)
    expect(after.patient.aorticValveOpening).toBe(false)
    expect(after.patient.nativeCardiacOutputLpm).toBe(
      LV_UNLOADING_RESPONSE.settledByMoves[1].nativeCardiacOutputLpm,
    )
    expect(after.patient.pulmonaryCongestion).toBe('marked')
    expect(after.patient.meanArterialPressure).toBeGreaterThan(65)
    expect(lessonStep('read-flow-response').expectedResponse).toContain(
      'Aortic valve still not observed to open',
    )
  })

  it('starting the inotrope: the valve opens at the line and the chest does not change', () => {
    const after = walkTo('start-inotrope')

    expect(lessonStep('start-inotrope').actionLabel).toBe('Start an inotrope and advance 3 seconds')
    expect(after.scenario.inotropeRunning).toBe(true)
    expect(after.patient.pulsePressure).toBe(LV_UNLOADING_RESPONSE.settledByMoves[2].pulsePressure)
    expect(after.patient.pulsePressure).toBeGreaterThan(VENT_LINE_MMHG)
    expect(after.patient.aorticValveOpening).toBe(true)
    expect(after.patient.pulmonaryCongestion).toBe('marked')
    expect(after.history.map((entry) => entry.label)).toContain('Started an inotrope')
  })

  it('the valve reads open only once the pulse the monitor shows has reached the line', () => {
    let state = dispatchAll(walkTo('read-flow-response'), [{ type: 'START_INOTROPE' }])
    for (let second = 0; second < 6; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
      expect(state.patient.aorticValveOpening).toBe(state.patient.pulsePressure >= VENT_LINE_MMHG)
    }
  })

  it('recording the plan: it is a decision, the readings do not move, and the fault stays', () => {
    const before = walkTo('start-inotrope')
    const step = lessonStep('escalate-lv-loading')
    const after = dispatchAll(before, step.actions)

    expect(step.actionLabel).toBe('Record the plan for volume removal and the vent')
    expect(step.actions).toEqual([{ type: 'CORRECT_FAULT', fault: 'lv-loading' }])
    expect(step.instruction).toContain('Neither is carried out in this lesson')
    expect(after.patient).toEqual(before.patient)
    expect(after.device.rpmSetpoint).toBe(before.device.rpmSetpoint)
    expect(after.scenario.correctedFaults).toContain('lv-loading')
    expect(after.scenario.activeFaults).toContain('lv-loading')
    expect(after.scenario.credit.cause).toBe(true)
    expect(after.history.at(-1)?.label).toBe(
      'Recorded the plan for volume removal and a left-ventricular vent. Neither is carried out here, so no reading changes for them.',
    )
    // The clock changes nothing for the plan either: the settled response simply holds.
    expect(lvReadings(tick(after, 30))).toEqual(lvReadings(after))
  })

  it('reassessing: what the step promises is what the monitor reads', () => {
    const after = walkTo()
    const step = lessonStep('reassess')

    expect(step.expectedResponse).toEqual([
      `Pulse pressure stays ${ECMO_NUMBERS.value('lv-ejection-pulsatility')}`,
      'The aortic valve is observed to open',
      'Pulmonary congestion is still marked, because volume removal and the vent have not been carried out',
      `Circuit flow holds at ${ECMO_NUMBERS.value('lv-unloading-flow')}`,
    ])
    expect(after.patient.pulsePressure).toBeGreaterThan(VENT_LINE_MMHG)
    expect(after.patient.aorticValveOpening).toBe(true)
    expect(after.patient.pulmonaryCongestion).toBe('marked')
    expect(`about ${after.circuit.bloodFlow.toFixed(1)} L/min`).toBe(
      ECMO_NUMBERS.value('lv-unloading-flow'),
    )
  })
})

describe('the loaded-ventricle model', () => {
  it('the plan alone treats nothing, however long the clock runs', () => {
    const start = fresh()
    const after = tick(
      ecmoSimulationReducer(start, { type: 'CORRECT_FAULT', fault: 'lv-loading' }),
      30,
    )
    expect(after.patient.pulsePressure).toBe(5)
    expect(after.patient.aorticValveOpening).toBe(false)
    expect(after.patient.nativeCardiacOutputLpm).toBe(0.8)
  })

  it('leaves an untreated ventricle exactly where it was', () => {
    const after = tick(fresh(), 30)
    expect(lvReadings(after)).toEqual({
      pulsePressure: 5,
      aorticValveOpening: false,
      nativeCardiacOutputLpm: 0.8,
      pulmonaryCongestion: 'marked',
    })
  })

  it('an inotrope alone, at full flow, does what lower flow alone does', () => {
    const after = tick(ecmoSimulationReducer(fresh(), { type: 'START_INOTROPE' }), 6)
    expect(after.patient.pulsePressure).toBe(LV_UNLOADING_RESPONSE.settledByMoves[1].pulsePressure)
    expect(after.patient.aorticValveOpening).toBe(false)
  })

  it('reaches the same place in either order', () => {
    const flowFirst = tick(
      dispatchAll(fresh(), [{ type: 'SET_RPM', rpm: 2400 }, { type: 'START_INOTROPE' }]),
      8,
    )
    const inotropeFirst = tick(
      dispatchAll(fresh(), [{ type: 'START_INOTROPE' }, { type: 'SET_RPM', rpm: 2400 }]),
      8,
    )
    expect(lvReadings(inotropeFirst)).toEqual(lvReadings(flowFirst))
  })

  it('takes the response away again when flow goes back up', () => {
    const treated = walkTo()
    const raised = tick(ecmoSimulationReducer(treated, { type: 'SET_RPM', rpm: 3200 }), 6)
    expect(raised.patient.pulsePressure).toBeLessThan(VENT_LINE_MMHG)
    expect(raised.patient.aorticValveOpening).toBe(false)
  })

  it('does not count a stopped pump as lowered flow', () => {
    const after = tick(ecmoSimulationReducer(fresh(), { type: 'SET_RPM', rpm: 0 }), 6)
    expect(after.circuit.bloodFlow).toBe(0)
    expect(after.patient.pulsePressure).toBe(5)
    expect(after.patient.aorticValveOpening).toBe(false)
  })

  it('does not widen the pulse for raising the pump speed', () => {
    const after = tick(ecmoSimulationReducer(fresh(), { type: 'SET_RPM', rpm: 3600 }), 6)
    expect(after.patient.pulsePressure).toBe(5)
    expect(after.patient.aorticValveOpening).toBe(false)
  })

  it('starts the inotrope once', () => {
    const started = ecmoSimulationReducer(fresh(), { type: 'START_INOTROPE' })
    expect(ecmoSimulationReducer(started, { type: 'START_INOTROPE' })).toBe(started)
  })

  it.each(['va-differential-hypoxemia', 'va-acute-hypercapnia', 'acute-hypercapnia'])(
    'does nothing on %s, which has no loading ventricle',
    (scenarioId) => {
      const state = createInitialSimulationState(scenarioId, 'guided')
      expect(ecmoSimulationReducer(state, { type: 'START_INOTROPE' })).toBe(state)
    },
  )
})

describe('the copy and the register agree with the model', () => {
  it('prints the sizes the engine runs on', () => {
    const [, oneMove, bothMoves] = LV_UNLOADING_RESPONSE.settledByMoves
    expect(ECMO_NUMBERS.value('lv-unloading-response')).toBe(
      `pulse pressure ${oneMove.pulsePressure} mmHg with one move and ${bothMoves.pulsePressure} mmHg with both; native output ${oneMove.nativeCardiacOutputLpm} and ${bothMoves.nativeCardiacOutputLpm} L/min`,
    )
    expect(ECMO_NUMBERS.value('lv-ejection-pulsatility')).toBe(`above ${VENT_LINE_MMHG} mmHg`)
    expect(ECMO_NUMBERS.value('lv-vent-pulsatility')).toContain(`less than ${VENT_LINE_MMHG} mmHg`)
  })

  it('files the simulated sizes as teaching conventions, and says what they are', () => {
    for (const id of ['lv-unloading-flow', 'lv-unloading-response'] as const) {
      const row = ECMO_NUMBERS.get(id)
      expect(row.class).toBe('teaching-convention')
      expect(row.note).toBeTruthy()
      expect(row.signedBy).toBeNull()
    }
  })

  it('no longer promises a vent or a treatment the lesson does not deliver', () => {
    const copy = lessonSteps()
      .filter((step) => step.phase === 'respond' || step.phase === 'reassess')
      .flatMap((step) => [step.actionLabel, ...step.expectedResponse])
      .join(' ')
    expect(copy).not.toMatch(/call for a vent/i)
    expect(copy).not.toMatch(/\bvent is placed\b/i)
    expect(copy).not.toMatch(/inotrope started/i)
  })

  it('tells the debrief which moves happened and which were planned', () => {
    const workflow = cardiohelpScenarioById.get(SCENARIO_ID)?.debrief.correctWorkflow.join(' ')
    expect(workflow).toContain('lower flow and the inotrope are carried out')
    expect(workflow).toContain(ECMO_NUMBERS.value('lv-unloading-response'))
    expect(workflow).toContain('Volume removal and the vent are a recorded plan')
  })

  it('keeps answer words out of the steps it added', () => {
    const copy = ['lower-flow', 'read-flow-response', 'start-inotrope', 'escalate-lv-loading']
      .map(lessonStep)
      .flatMap((step) => [step.instruction, step.rationale, ...step.expectedResponse])
      .join(' ')
    expect(copy).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
  })
})

describe('saved course progress', () => {
  it('keeps the ids a saved run points at', () => {
    const lesson = cardiohelpLearnLessonByScenarioId.get(SCENARIO_ID)
    expect(lesson?.id).toBe('learn-va-lv-loading')
    expect(lesson?.scenarioId).toBe(SCENARIO_ID)
    expect(lesson?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        'va-lv-loading-observe',
        'va-lv-loading-interpret',
        'va-lv-loading-escalate-lv-loading',
        'va-lv-loading-reassess',
      ]),
    )
  })

  it('reads a run saved before this change and does not ask for it again', () => {
    const saved = recordLearnLessonCompleted(createDefaultProgress(), SCENARIO_ID)
    const envelope = JSON.stringify({
      ...saved,
      lastLessonScenarioIdByMode: { va: SCENARIO_ID },
      lastVisited: { section: 'learn', scenarioId: SCENARIO_ID, supportMode: 'va' },
    })
    const parsed = parseProgress(envelope)

    expect(CARDIOHELP_PROGRESS_VERSION).toBe(2)
    expect(parsed?.completedLearnLessonIds).toEqual([SCENARIO_ID])
    expect(parsed?.lastLessonScenarioIdByMode.va).toBe(SCENARIO_ID)
    expect(parsed?.lastVisited?.scenarioId).toBe(SCENARIO_ID)
  })

  it('still earns the same credit for the committed plan', () => {
    let state = ecmoSimulationReducer(fresh(), {
      type: 'COMMIT_PREDICTION',
      goalId: 'protect-left-heart',
      control: 'assess-lv-loading',
      direction: 'inspect',
    })
    state = lessonSteps()
      .filter((step) => step.phase === 'respond' || step.phase === 'reassess')
      .reduce((current, step) => dispatchAll(current, step.actions), state)
    const definition = cardiohelpScenarioById.get(SCENARIO_ID)
    if (!definition) throw new Error(`No scenario ${SCENARIO_ID}`)
    const reassessment = resolveScenarioReassessment(definition)
    state = dispatchAll(state, [
      {
        type: 'COMMIT_REASSESSMENT',
        answers: {
          deviceOptionId: reassessment.device.correctOptionId,
          circuitOptionId: reassessment.circuit.correctOptionId,
          patientOptionId: reassessment.patient.correctOptionId,
        },
      },
      { type: 'REVEAL_DEBRIEF' },
    ])

    expect(state.scenario.credit).toMatchObject({
      goal: true,
      control: true,
      direction: true,
      cause: true,
      reassessment: true,
    })
    expect(state.scenario.execution).toEqual({ controlMatched: true, directionMatched: true })
    expect(selectScenarioOutcome(state).mastery).toBe(true)
  })
})

describe('on the patient monitor', () => {
  function monitorValue(label: string): string | null {
    const row = screen.queryByText(label)?.closest('div')
    return row ? within(row).getByRole('strong', { hidden: true }).textContent : null
  }

  it('reads the untreated ventricle with no treatment rows', () => {
    render(<PatientMonitor state={fresh()} />)
    expect(monitorValue('Aortic-valve opening')).toBe('Not observed')
    expect(monitorValue('Inotrope')).toBeNull()
    expect(monitorValue('Volume removal and vent')).toBeNull()
  })

  it('keeps what was done apart from what was only planned', () => {
    render(<PatientMonitor state={walkTo()} />)
    expect(monitorValue('Aortic-valve opening')).toBe('Present')
    expect(monitorValue('Pulse pressure')).toBe('12 mmHg')
    expect(monitorValue('Native cardiac output')).toBe('1.6 L/min')
    expect(monitorValue('Pulmonary congestion')).toBe('marked')
    expect(monitorValue('Inotrope')).toBe('Running')
    expect(monitorValue('Volume removal and vent')).toBe('Planned, not carried out')
  })
})

describe('on the real Learn stage', () => {
  beforeEach(() => {
    resetStageHarness()
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch
  })

  it('walks the rotary, the inotrope and the plan the way a learner does', async () => {
    await mountDrill(SCENARIO_ID)
    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance(SCENARIO_ID)

    const knob = await screen.findByRole('slider', { name: /RPM rotary setpoint/i })
    while (latestState().device.rpmSetpoint > 2400) fireEvent.keyDown(knob, { key: 'ArrowDown' })
    expect(nowStatus()).toMatch(/^Done\./)
    await awaitDoneAndAdvance()

    performAndAdvance(/Advance 3 seconds and read the ventricle/i)
    expect(latestState().patient.aorticValveOpening).toBe(false)
    expect(latestState().patient.pulsePressure).toBeLessThan(VENT_LINE_MMHG)

    performAndAdvance(/Start an inotrope and advance 3 seconds/i)
    expect(latestState().patient.aorticValveOpening).toBe(true)
    expect(latestState().patient.pulsePressure).toBeGreaterThan(VENT_LINE_MMHG)

    const beforePlan = latestState().patient
    performAndAdvance(/Record the plan for volume removal and the vent/i)
    expect(latestState().patient).toEqual(beforePlan)
    expect(latestState().scenario.correctedFaults).toContain('lv-loading')
    expect(latestState().scenario.activeFaults).toContain('lv-loading')

    performAndAdvance(/Advance 1 second and inspect the response/i)
    const debrief = document.querySelector('[data-drill-explain="va-lv-loading"]')
    expect(debrief).toHaveTextContent('Volume removal and the vent are a recorded plan')
    expect(debrief).toHaveTextContent(ECMO_NUMBERS.value('lv-unloading-response'))
    expect(debrief).toHaveTextContent('lowering it helps without opening the valve by itself')
  })
})
