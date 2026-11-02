import { render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { PatientMonitor } from '../components/CircuitAndMonitors'
import { EcmoDrillTeachingPanel } from '../components/teaching/EcmoDrillTeachingPanel'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  ECMO_DIFFERENTIAL_HYPOXEMIA_CAUSES,
  ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD,
  ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES,
  ECMO_NUMBERS,
  ECMO_NUMBER_ONLY_SOURCES,
} from '../content/teachingNumbers'
import {
  CARDIOHELP_PROGRESS_VERSION,
  createDefaultProgress,
  parseLearningProgress,
  parseProgress,
  recordLearnLessonCompleted,
} from '../engine/progress'
import { ecmoSimulationReducer, selectScenarioOutcome } from '../engine/reducer'
import {
  createInitialSimulationState,
  DIFFERENTIAL_VENTILATOR_RESPONSE,
} from '../engine/simulation'
import type { EcmoSimulationState, GuidedWalkthroughStep, SimulationAction } from '../engine/types'
import {
  answerPredictionAndAdvance,
  latestState,
  mountDrill,
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

const SCENARIO_ID = 'va-differential-hypoxemia'
const FAULT = 'differential-hypoxemia'
const UNTREATED_RIGHT_ARM = 82
const LOW_RIGHT_ARM_ALARM = 'Independent monitor: right-arm oxygenation low'
const PLAN_HISTORY =
  'Recorded the plan for the lung cause and for V-AV or conversion to VV. None of it is carried out here, so no reading changes for it.'

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

function oxygenation(state: EcmoSimulationState) {
  const { rightRadialSpo2, spo2, femoralArterialSpo2 } = state.patient
  return {
    rightRadialSpo2,
    spo2,
    femoralArterialSpo2,
    postOxygenatorSaturation: state.circuit.postOxygenatorSaturation,
  }
}

function monitorAlarms(state: EcmoSimulationState) {
  return state.alarms.filter((alarm) => alarm.source === 'patient-monitor').map((a) => a.message)
}

describe('the differential-hypoxemia lesson does what it says', () => {
  it('a lesson that names the ventilator changes the right arm', () => {
    const offered = lessonSteps()
      .flatMap((step) => [step.actionLabel, ...step.expectedResponse])
      .join(' ')
    expect(offered).toMatch(/ventilator/i)
    expect(walkTo().patient.rightRadialSpo2).toBeGreaterThan(fresh().patient.rightRadialSpo2)
  })

  it('never offers confirming and treating as one action', () => {
    const combined = lessonSteps().filter(
      (step) =>
        /confirm|gas/i.test(step.actionLabel) && /ventilator|fio|peep/i.test(step.actionLabel),
    )
    expect(combined.map((step) => step.actionLabel)).toEqual([])
  })

  it('offers each move as its own action, in the order the moves are taught', () => {
    const responses = lessonSteps().filter((step) => step.phase === 'respond')
    expect(responses.map((step) => step.id)).toEqual([
      'va-differential-hypoxemia-confirm-right-arm',
      'va-differential-hypoxemia-raise-ventilator',
      'va-differential-hypoxemia-recheck-right-arm',
      'va-differential-hypoxemia-verify-and-escalate-mixing',
    ])
  })

  it('walks to the same state every time', () => {
    expect(walkTo()).toEqual(walkTo())
  })
})

describe('each action the lesson offers', () => {
  it('drawing the gas: it records a sample and moves no reading', () => {
    const before = walkTo('interpret')
    const step = lessonStep('confirm-right-arm')
    const after = dispatchAll(before, step.actions)

    expect(step.actionLabel).toBe('Draw a right radial gas')
    expect(step.actions).toEqual([{ type: 'DRAW_RIGHT_RADIAL_GAS' }])
    expect(after.patient).toEqual(before.patient)
    expect(after.circuit).toEqual(before.circuit)
    expect(after.scenario.differentialResponse?.rightRadialGas).toEqual({
      saturation: UNTREATED_RIGHT_ARM,
      drawnAt: 0,
    })
    expect(step.expectedResponse).toContain(
      `Right radial gas reads SaO₂ ${UNTREATED_RIGHT_ARM}%, matching the oximeter`,
    )
    // Confirming earns no credit for treating, opens no reassessment and ends no pattern.
    expect(after.scenario.activeFaults).toContain(FAULT)
    expect(after.scenario.correctedFaults).not.toContain(FAULT)
    expect(after.scenario.credit.cause).toBe(false)
    expect(monitorAlarms(after)).toContain(LOW_RIGHT_ARM_ALARM)
    expect(after.history.at(-1)?.label).toBe(
      'Drew a right radial gas: SaO₂ 82.0%. A measurement, so no reading changes.',
    )
  })

  it('raising the ventilator: the right arm answers and the circuit side does not', () => {
    const before = walkTo('confirm-right-arm')
    const step = lessonStep('raise-ventilator')
    const after = dispatchAll(before, step.actions)

    expect(step.actionLabel).toBe('Raise ventilator FiO₂ and PEEP and advance 6 seconds')
    expect(step.actions[0]).toEqual({ type: 'RAISE_VENTILATOR_SUPPORT' })
    expect(after.simulationTime - before.simulationTime).toBe(6)

    expect(after.patient.rightRadialSpo2).toBe(DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2)
    expect(after.patient.spo2).toBe(DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2)
    expect(after.patient.femoralArterialSpo2).toBeGreaterThanOrEqual(98)
    expect(after.circuit.postOxygenatorSaturation).toBe(before.circuit.postOxygenatorSaturation)
    expect(after.patient.airwayPressure).toBe(DIFFERENTIAL_VENTILATOR_RESPONSE.airwayPressure)

    expect(after.patient.pulsePressure).toBe(before.patient.pulsePressure)
    expect(after.patient.nativeCardiacOutputLpm).toBe(before.patient.nativeCardiacOutputLpm)
    expect(after.patient.aorticValveOpening).toBe(true)
    expect(after.circuit.bloodFlow).toBe(before.circuit.bloodFlow)
    expect(after.patient.pulmonaryCongestion).toBe(before.patient.pulmonaryCongestion)

    expect(monitorAlarms(after)).toContain(LOW_RIGHT_ARM_ALARM)
    expect(after.scenario.activeFaults).toContain(FAULT)
    expect(after.history.map((entry) => entry.label)).toContain('Raised ventilator FiO₂ and PEEP')
  })

  it('the right arm climbs over the clock and does not jump', () => {
    const raised = dispatchAll(walkTo('confirm-right-arm'), [{ type: 'RAISE_VENTILATOR_SUPPORT' }])
    expect(raised.patient.rightRadialSpo2).toBe(UNTREATED_RIGHT_ARM)
    const readings = Array.from(
      { length: 6 },
      (_, second) => tick(raised, second + 1).patient.rightRadialSpo2,
    )
    expect(readings).toEqual([...readings].sort((a, b) => a - b))
    expect(readings[0]).toBeLessThan(readings[5])
    expect(readings[5]).toBe(DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2)
  })

  it('repeating the gas: it reads what the oximeter reads and moves nothing', () => {
    const before = walkTo('raise-ventilator')
    const after = dispatchAll(before, lessonStep('recheck-right-arm').actions)

    expect(lessonStep('recheck-right-arm').actionLabel).toBe('Repeat the right radial gas')
    expect(after.patient).toEqual(before.patient)
    expect(after.scenario.differentialResponse?.rightRadialGas).toEqual({
      saturation: before.patient.rightRadialSpo2,
      drawnAt: before.simulationTime,
    })
  })

  it('recording the plan: it is a decision, no reading moves, and the fault stays', () => {
    const before = walkTo('recheck-right-arm')
    const step = lessonStep('verify-and-escalate-mixing')
    const after = dispatchAll(before, step.actions)

    expect(step.actionLabel).toBe('Record the plan for the lung cause and V-AV or VV')
    expect(step.actions).toEqual([{ type: 'CORRECT_FAULT', fault: FAULT }])
    expect(step.instruction).toContain('None of these is carried out in this lesson')
    expect(after.patient).toEqual(before.patient)
    expect(after.scenario.correctedFaults).toContain(FAULT)
    expect(after.scenario.activeFaults).toContain(FAULT)
    expect(after.scenario.credit.cause).toBe(true)
    expect(after.history.at(-1)?.label).toBe(PLAN_HISTORY)
    expect(oxygenation(tick(after, 30))).toEqual(oxygenation(tick(before, 30)))
  })

  it('reassessing: what the step promises is what the monitor reads', () => {
    const after = walkTo()
    const step = lessonStep('reassess')

    expect(step.expectedResponse).toEqual([
      'Right-arm SpO₂ holds at 86%, better and still flagged low',
      'Femoral saturation stays high, so the two sites still read apart',
      'Pulse pressure stays above 20 mmHg, so the heart is still ejecting native blood',
      'The pattern stays active, because the lung cause and V-AV or VV have not been carried out',
    ])
    expect(`${after.patient.rightRadialSpo2}%`).toBe(
      ECMO_NUMBERS.value('differential-ventilator-right-arm'),
    )
    expect(monitorAlarms(after)).toContain(LOW_RIGHT_ARM_ALARM)
    expect(after.patient.femoralArterialSpo2 - after.patient.rightRadialSpo2).toBeGreaterThan(10)
    expect(after.patient.pulsePressure).toBeGreaterThan(20)
    expect(after.scenario.activeFaults).toContain(FAULT)
  })

  it('makes no promise of a right arm that returns to normal', () => {
    const copy = lessonSteps()
      .filter((step) => step.phase === 'respond' || step.phase === 'reassess')
      .flatMap((step) => [step.actionLabel, ...step.expectedResponse])
      .join(' ')
    expect(copy).not.toMatch(/begins to improve/i)
    expect(copy).not.toMatch(/\b(resolves?|normali[sz]es?|corrects?)\b/i)
  })
})

describe('the model behind the lesson', () => {
  it('nothing but the ventilator lifts the right arm', () => {
    const unmoved = [
      tick(fresh(), 30),
      tick(dispatchAll(fresh(), [{ type: 'DRAW_RIGHT_RADIAL_GAS' }]), 30),
      tick(dispatchAll(fresh(), [{ type: 'CORRECT_FAULT', fault: FAULT }]), 30),
      tick(dispatchAll(fresh(), [{ type: 'SET_RPM', rpm: 3800 }]), 30),
      tick(dispatchAll(fresh(), [{ type: 'SET_GAS_FIO2', fio2: 0.8 }]), 30),
      tick(dispatchAll(fresh(), [{ type: 'SET_SWEEP', sweep: 4 }]), 30),
    ]
    for (const state of unmoved) expect(state.patient.rightRadialSpo2).toBe(UNTREATED_RIGHT_ARM)
  })

  it('more pump speed on top of the ventilator adds nothing, as the panel says', () => {
    const raised = walkTo('raise-ventilator')
    const faster = tick(ecmoSimulationReducer(raised, { type: 'SET_RPM', rpm: 3800 }), 10)
    expect(faster.patient.rightRadialSpo2).toBe(DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2)
  })

  it('a gas is a sample: an earlier one keeps what it read', () => {
    const state = walkTo('raise-ventilator')
    expect(state.patient.rightRadialSpo2).toBe(DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2)
    expect(state.scenario.differentialResponse?.rightRadialGas?.saturation).toBe(
      UNTREATED_RIGHT_ARM,
    )
  })

  it('reaches the same place whether the gas comes before or after the ventilator', () => {
    const gasFirst = tick(
      dispatchAll(fresh(), [
        { type: 'DRAW_RIGHT_RADIAL_GAS' },
        { type: 'RAISE_VENTILATOR_SUPPORT' },
      ]),
      8,
    )
    const ventilatorFirst = tick(
      dispatchAll(fresh(), [
        { type: 'RAISE_VENTILATOR_SUPPORT' },
        { type: 'DRAW_RIGHT_RADIAL_GAS' },
      ]),
      8,
    )
    expect(ventilatorFirst.patient).toEqual(gasFirst.patient)
  })

  it('holds the native stream where it stood when the ventilator went up', () => {
    const drifted = tick(fresh(), 8)
    expect(drifted.patient.pulsePressure).toBe(18)
    expect(drifted.patient.nativeCardiacOutputLpm).toBe(2.4)

    const raised = tick(ecmoSimulationReducer(drifted, { type: 'RAISE_VENTILATOR_SUPPORT' }), 8)
    expect(raised.patient.pulsePressure).toBe(18)
    expect(raised.patient.nativeCardiacOutputLpm).toBe(2.4)
  })

  it('raises the ventilator once', () => {
    const raised = ecmoSimulationReducer(fresh(), { type: 'RAISE_VENTILATOR_SUPPORT' })
    expect(ecmoSimulationReducer(raised, { type: 'RAISE_VENTILATOR_SUPPORT' })).toBe(raised)
  })

  it.each(['va-lv-loading', 'va-acute-hypercapnia', 'acute-hypercapnia', 'vv-off-sweep-capstone'])(
    'does nothing on %s, which has no differential hypoxemia',
    (scenarioId) => {
      const state = createInitialSimulationState(scenarioId, 'guided')
      expect(ecmoSimulationReducer(state, { type: 'RAISE_VENTILATOR_SUPPORT' })).toBe(state)
      expect(ecmoSimulationReducer(state, { type: 'DRAW_RIGHT_RADIAL_GAS' })).toBe(state)
    },
  )

  it('lands on the same right arm as the Practice case’s ventilator card', () => {
    const card = clinicalPracticeScenarioById
      .get('va-clinical-differential-hypoxemia')
      ?.clinicalCase?.interventions.find((item) => item.id === 'differential-native-lung')
    expect(card?.patch?.patient?.rightRadialSpo2).toBe(
      DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2,
    )
  })

  it('opens with the chest it will read after the first tick', () => {
    expect(fresh().patient.pulmonaryCongestion).toBe(tick(fresh(), 1).patient.pulmonaryCongestion)
  })
})

describe('the pathways that share this fault', () => {
  it.each(['va-mixed-circulation-capstone', 'va-clinical-differential-hypoxemia'])(
    '%s keeps its recognition line and gains no response state',
    (scenarioId) => {
      const state = createInitialSimulationState(scenarioId, 'guided')
      const after = tick(ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: FAULT }), 10)

      expect(after.scenario.differentialResponse).toBeUndefined()
      expect(after.history.map((entry) => entry.label)).toContain(
        'Recognised and escalated the scenario cause: differential-hypoxemia. This module represents recognition and escalation here, not a treatment, so the pattern persists.',
      )
      expect(after.patient.rightRadialSpo2).toBeLessThan(88)
    },
  )

  it('shows no response rows on the capstone after its management step', () => {
    const state = ecmoSimulationReducer(
      createInitialSimulationState('va-mixed-circulation-capstone', 'guided'),
      { type: 'CORRECT_FAULT', fault: FAULT },
    )
    const { container } = render(<PatientMonitor state={state} />)
    expect(container.querySelector('[data-differential-response]')).toBeNull()
  })
})

describe('the copy and the register agree with the model', () => {
  it('prints the sizes the engine runs on', () => {
    expect(ECMO_NUMBERS.value('differential-ventilator-right-arm')).toBe(
      `${DIFFERENTIAL_VENTILATOR_RESPONSE.rightArmSpo2}%`,
    )
    expect(ECMO_NUMBERS.value('differential-ventilator-airway-pressure')).toBe(
      `${DIFFERENTIAL_VENTILATOR_RESPONSE.airwayPressure} cmH₂O`,
    )
  })

  it('files the simulated sizes as teaching conventions, and says what they are', () => {
    for (const id of [
      'differential-ventilator-right-arm',
      'differential-ventilator-airway-pressure',
    ] as const) {
      const row = ECMO_NUMBERS.get(id)
      expect(row.class).toBe('teaching-convention')
      expect(row.note).toBeTruthy()
      expect(row.signedBy).toBeNull()
    }
  })

  it('gives every published line its class, source and locator', () => {
    expect(ECMO_NUMBERS.get('mixing-point-pulse-pressure').class).toBe('consensus')
    expect(ECMO_NUMBERS.get('ecmo-minimum-oxygenation').class).toBe('expert-reference')
    expect(ECMO_NUMBERS.get('ecpr-saturation-target').class).toBe('guideline')
    expect(ECMO_NUMBERS.get('va-peep-pulmonary-edema').class).toBe('guideline')
    for (const id of [
      'mixing-point-pulse-pressure',
      'ecmo-minimum-oxygenation',
      'ecpr-saturation-target',
      'va-peep-pulmonary-edema',
    ] as const) {
      const row = ECMO_NUMBERS.get(id)
      expect(row.signedBy).toBeNull()
      expect(row.sources[0]?.locator.trim().length).toBeGreaterThan(0)
    }
    expect(ECMO_NUMBER_ONLY_SOURCES.map((source) => source.id)).toContain('elso-ecpr-2021')
  })

  it('teaches why the right arm is the sample that matters', () => {
    const { rationale } = lessonStep('confirm-right-arm')
    expect(rationale).toMatch(/innominate artery leaves the arch just after the coronaries/i)
    expect(rationale).toMatch(/femoral sample or a left-hand oximeter/i)
    expect(rationale).toContain(ECMO_NUMBERS.value('mixing-point-pulse-pressure'))
    expect(lessonStep('recheck-right-arm').rationale).toMatch(
      /ventilator on the right-arm gas and the membrane on the post-oxygenator gas/i,
    )
  })

  it('keeps confirming apart from treating and treating apart from the cause', () => {
    expect(lessonStep('confirm-right-arm').instruction).toContain(
      'This step measures. It treats nothing.',
    )
    expect(lessonStep('raise-ventilator').instruction).toMatch(/^Now treat\./)
    const plan = lessonStep('verify-and-escalate-mixing')
    expect(plan.instruction).toContain('It does not treat why they are failing.')
    for (const move of ECMO_DIFFERENTIAL_HYPOXEMIA_CAUSES.moves) {
      expect(plan.instruction).toContain(move)
    }
    for (const move of ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.moves.slice(2)) {
      expect(plan.instruction).toContain(move)
    }
    expect(plan.rationale).toContain(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.moves[1])
  })

  it('names which source gives which line', () => {
    const { instruction } = lessonStep('recheck-right-arm')
    expect(instruction).toContain(
      `Taha 2024 gives a minimum on ECMO of ${ECMO_NUMBERS.value('ecmo-minimum-oxygenation')}`,
    )
    expect(instruction).toContain(
      `ELSO 2021 targets ${ECMO_NUMBERS.value('ecpr-saturation-target')} after ECPR`,
    )
    expect(lessonStep('raise-ventilator').instruction).toContain(
      ECMO_NUMBERS.value('va-peep-pulmonary-edema'),
    )
  })

  it('tells the debrief what happened and what was only planned', () => {
    const record = ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD
    expect(record).toContain('The gas confirms the pattern and changes no reading.')
    expect(record).toContain(
      `The ventilator lifts the right arm to ${ECMO_NUMBERS.value('differential-ventilator-right-arm')}`,
    )
    expect(record).toContain('The lung cause and V-AV or VV are a recorded plan')
    expect(cardiohelpScenarioById.get(SCENARIO_ID)?.debrief.correctWorkflow).toContain(record)
  })

  it('keeps answer words out of the steps it added', () => {
    const copy = [
      'confirm-right-arm',
      'raise-ventilator',
      'recheck-right-arm',
      'verify-and-escalate-mixing',
    ]
      .map(lessonStep)
      .flatMap((step) => [step.instruction, step.rationale, ...step.expectedResponse])
      .join(' ')
    expect(copy).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
  })
})

describe('the teaching panel', () => {
  function committed(state: EcmoSimulationState): EcmoSimulationState {
    return ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'inspect',
    })
  }

  function liveState(state: EcmoSimulationState) {
    const { container } = render(<EcmoDrillTeachingPanel state={committed(state)} />)
    return container.querySelector('[data-live-differential-state]')?.textContent ?? ''
  }

  it('prints the same record the scenario debrief carries', () => {
    const { container } = render(<EcmoDrillTeachingPanel state={committed(fresh())} />)
    expect(container.querySelector('[data-differential-lesson-record]')?.textContent).toBe(
      ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD,
    )
  })

  it('says the pattern is active before the ventilator', () => {
    expect(liveState(fresh())).toBe(
      'The upper-body pattern is active on this circuit, with the two arterial sites 17.0 points apart.',
    )
  })

  it('says the pattern is still active after the walk, and never that it is recovering', () => {
    const text = liveState(walkTo())
    expect(text).toContain('still active with the ventilator raised')
    expect(text).toContain('12.5 points apart')
    expect(text).not.toMatch(/recovery curve|recognised and escalated/i)
  })
})

describe('saved course progress', () => {
  it('keeps the ids a saved run points at', () => {
    const lesson = cardiohelpLearnLessonByScenarioId.get(SCENARIO_ID)
    expect(lesson?.id).toBe('learn-va-differential-hypoxemia')
    expect(lesson?.scenarioId).toBe(SCENARIO_ID)
    expect(lesson?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        'va-differential-hypoxemia-observe',
        'va-differential-hypoxemia-interpret',
        'va-differential-hypoxemia-verify-and-escalate-mixing',
        'va-differential-hypoxemia-reassess',
      ]),
    )
  })

  it('reads a run saved before this change and does not ask for it again', () => {
    const saved = recordLearnLessonCompleted(createDefaultProgress(), SCENARIO_ID)
    const parsed = parseProgress(
      JSON.stringify({
        ...saved,
        lastLessonScenarioIdByMode: { va: SCENARIO_ID },
        lastVisited: { section: 'learn', scenarioId: SCENARIO_ID, supportMode: 'va' },
      }),
    )

    expect(CARDIOHELP_PROGRESS_VERSION).toBe(2)
    expect(parsed?.completedLearnLessonIds).toEqual([SCENARIO_ID])
    expect(parsed?.lastLessonScenarioIdByMode.va).toBe(SCENARIO_ID)
    expect(parsed?.lastVisited?.scenarioId).toBe(SCENARIO_ID)
  })

  it('reads the self-paced record the Learn stage writes', () => {
    const parsed = parseLearningProgress(
      JSON.stringify({
        selfPaced: {
          visitedTopicIds: [`learn:va:${SCENARIO_ID}`],
          lastVisited: { section: 'learn', scenarioId: SCENARIO_ID, supportMode: 'va' },
          lastLessonScenarioIdByMode: { va: SCENARIO_ID },
          lastCaseScenarioIdByMode: {},
        },
      }),
    )

    expect(parsed.visitedTopicIds).toEqual([`learn:va:${SCENARIO_ID}`])
    expect(parsed.lastLessonScenarioIdByMode.va).toBe(SCENARIO_ID)
    expect(parsed.lastVisited?.scenarioId).toBe(SCENARIO_ID)
  })

  it('still earns the same credit for the committed plan', () => {
    let state = ecmoSimulationReducer(fresh(), {
      type: 'COMMIT_PREDICTION',
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
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

  it('reads the untreated patient with no response rows', () => {
    render(<PatientMonitor state={fresh()} />)
    expect(monitorValue('Right-arm SpO₂')).toBe('82.0%')
    expect(monitorValue('Right radial gas')).toBeNull()
    expect(monitorValue('Ventilator FiO₂ and PEEP')).toBeNull()
    expect(monitorValue('Lung cause, V-AV or VV')).toBeNull()
  })

  it('shows the gas beside the oximeter once it is drawn, and nothing else', () => {
    render(<PatientMonitor state={walkTo('confirm-right-arm')} />)
    expect(monitorValue('Right-arm SpO₂')).toBe('82.0%')
    expect(monitorValue('Right radial gas')).toBe('SaO₂ 82.0% at 0 s')
    expect(monitorValue('Ventilator FiO₂ and PEEP')).toBeNull()
  })

  it('keeps what was done apart from what was only planned', () => {
    render(<PatientMonitor state={walkTo()} />)
    expect(monitorValue('Right-arm SpO₂')).toBe('86.0%')
    expect(monitorValue('Femoral arterial SpO₂')).toBe('98.5%')
    expect(monitorValue('Right radial gas')).toBe('SaO₂ 86.0% at 6 s')
    expect(monitorValue('Ventilator FiO₂ and PEEP')).toBe('Raised')
    expect(monitorValue('Lung cause, V-AV or VV')).toBe('Planned, not carried out')
    expect(monitorValue('Pulse pressure')).toBe('22 mmHg')
    expect(screen.getByText('Attention: low simulated upper-body oxygenation')).toBeInTheDocument()
  })
})

describe('on the real Learn stage', () => {
  beforeEach(() => {
    resetStageHarness()
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch
  })

  it('walks the gas, the ventilator, the recheck and the plan the way a learner does', async () => {
    await mountDrill(SCENARIO_ID)
    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance(SCENARIO_ID)

    const opening = latestState().patient
    performAndAdvance(/Draw a right radial gas/i)
    expect(latestState().patient).toEqual(opening)
    expect(latestState().scenario.differentialResponse?.rightRadialGas?.saturation).toBe(82)

    performAndAdvance(/Raise ventilator FiO₂ and PEEP and advance 6 seconds/i)
    expect(latestState().patient.rightRadialSpo2).toBe(86)
    expect(latestState().patient.femoralArterialSpo2).toBeGreaterThanOrEqual(98)
    expect(latestState().patient.pulsePressure).toBe(opening.pulsePressure)

    performAndAdvance(/Repeat the right radial gas/i)
    expect(latestState().scenario.differentialResponse?.rightRadialGas?.saturation).toBe(86)

    const beforePlan = latestState().patient
    performAndAdvance(/Record the plan for the lung cause and V-AV or VV/i)
    expect(latestState().patient).toEqual(beforePlan)
    expect(latestState().scenario.correctedFaults).toContain(FAULT)
    expect(latestState().scenario.activeFaults).toContain(FAULT)

    performAndAdvance(/Advance 1 second and inspect the response/i)
    expect(latestState().patient.rightRadialSpo2).toBe(86)
    // This drill's Explain is its authored panel, not the scenario's debrief list.
    expect(document.querySelector('[data-differential-lesson-record]')).toHaveTextContent(
      ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD,
    )
    expect(document.querySelector('[data-live-differential-state]')).toHaveTextContent(
      'still active with the ventilator raised',
    )
  })
})
