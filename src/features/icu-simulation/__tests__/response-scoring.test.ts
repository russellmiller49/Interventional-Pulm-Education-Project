import { getIcuScenario, icuScenarios } from '../content'
import {
  applyIcuCommand,
  createIcuSimulation,
  evaluateIcuMasteryResponse,
  type IcuAssessmentId,
  type IcuCareInterventionId,
  type IcuCommand,
  type IcuReassessmentDomain,
  type IcuScenarioDefinition,
  type IcuShockClassification,
  type IcuSimulationState,
  type IcuTherapyControl,
  type IcuTherapyId,
} from '../engine'

const care = (interventionId: IcuCareInterventionId): IcuCommand => ({
  type: 'care.perform',
  interventionId,
})
const assess = (assessmentId: IcuAssessmentId): IcuCommand => ({
  type: 'assessment.order',
  assessmentId,
})
const diagnose = (classification: IcuShockClassification): IcuCommand => ({
  type: 'diagnosis.commit',
  classification,
})
const prepare = (therapy: IcuTherapyId, configuration: string): IcuCommand => ({
  type: 'therapy.prepare',
  therapy,
  configuration,
})
const start = (therapy: IcuTherapyId): IcuCommand => ({ type: 'therapy.start', therapy })
const stop = (therapy: IcuTherapyId): IcuCommand => ({ type: 'therapy.stop', therapy })
const adjust = (
  therapy: IcuTherapyId,
  control: IcuTherapyControl,
  value: number | string | boolean,
): IcuCommand => ({ type: 'therapy.adjust', therapy, control, value })

function applyCommands(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
  commands: readonly IcuCommand[],
): IcuSimulationState {
  return commands.reduce((current, command) => applyIcuCommand(current, scenario, command), state)
}

function responseAfterMinimum(scenarioId: string, commands: readonly IcuCommand[], seed = 42) {
  const scenario = getIcuScenario(scenarioId)
  let state = createIcuSimulation(scenario, { mode: 'assess', seed })
  state = applyCommands(state, scenario, commands)
  state = applyIcuCommand(state, scenario, {
    type: 'time.advance',
    seconds: scenario.minimumMasteryElapsedSeconds,
  })
  return { scenario, state, response: evaluateIcuMasteryResponse(state, scenario) }
}

function completeWithSerialReassessment(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
  domains: readonly IcuReassessmentDomain[],
): IcuSimulationState {
  state = applyIcuCommand(state, scenario, {
    type: 'time.advance',
    seconds: scenario.minimumMasteryElapsedSeconds - 300,
  })
  state = applyIcuCommand(state, scenario, { type: 'patient.reassess', domains })
  state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 300 })
  state = applyIcuCommand(state, scenario, { type: 'patient.reassess', domains })
  return applyIcuCommand(state, scenario, { type: 'session.complete' })
}

const sepsisCommands: readonly IcuCommand[] = [
  care('antimicrobials'),
  care('source-control'),
  care('vasopressor-up'),
  prepare('ventilator', 'volume-control'),
  start('ventilator'),
  adjust('ventilator', 'fio2', 0.8),
  adjust('ventilator', 'peep-cmh2o', 10),
  adjust('ventilator', 'tidal-volume-ml', 360),
  care('prone'),
  prepare('crrt', 'cvvhd'),
  start('crrt'),
  adjust('crrt', 'dialysate-ml-hour', 2_000),
  adjust('crrt', 'patient-fluid-removal-ml-hour', 100),
]

const lvNoDeviceCommands: readonly IcuCommand[] = [
  care('inotrope-up'),
  care('inotrope-up'),
  care('vasopressor-up'),
  prepare('ventilator', 'volume-control'),
  start('ventilator'),
  adjust('ventilator', 'fio2', 0.6),
  adjust('ventilator', 'peep-cmh2o', 8),
]

const peNoDeviceCommands: readonly IcuCommand[] = [
  care('reperfusion'),
  care('vasopressor-up'),
  care('inotrope-up'),
  prepare('ventilator', 'volume-control'),
  start('ventilator'),
  adjust('ventilator', 'fio2', 0.6),
  adjust('ventilator', 'peep-cmh2o', 5),
]

const hemorrhageCommands: readonly IcuCommand[] = [
  care('blood-products'),
  care('blood-products'),
  care('source-control'),
  care('fluid-bolus'),
]

const mixedCommands: readonly IcuCommand[] = [
  care('antimicrobials'),
  care('source-control'),
  care('vasopressor-up'),
  care('inotrope-up'),
  prepare('ecmo', 'va'),
  start('ecmo'),
  adjust('ecmo', 'rpm', 3_000),
  adjust('ecmo', 'blood-flow-l-min', 3),
]

describe('ICU modeled-response mastery gate', () => {
  it.each([
    ['septic-ards-aki', sepsisCommands, []],
    ['lv-cardiogenic', lvNoDeviceCommands, ['lv-no-rescue-device']],
    ['massive-pe-rv', peNoDeviceCommands, ['pe-no-rescue-device']],
    ['hemorrhagic', hemorrhageCommands, []],
    ['tamponade', [care('tamponade-drainage')], ['tamponade-no-ventilation']],
    ['mixed-cardiogenic-vasodilatory', mixedCommands, []],
  ] as const)('passes a deterministic safe %s trajectory', (scenarioId, commands, paths) => {
    const { response } = responseAfterMinimum(scenarioId, commands)
    expect(response.passed).toBe(true)
    expect(response.passedPathIds).toEqual(paths)
    expect(
      response.criteria.filter((criterion) => !criterion.passed && criterion.pathId === null),
    ).toHaveLength(0)
  })

  it.each([
    [
      'lv-cardiogenic',
      [
        care('inotrope-up'),
        care('inotrope-up'),
        care('vasopressor-up'),
        prepare('ventilator', 'volume-control'),
        start('ventilator'),
        adjust('ventilator', 'peep-cmh2o', 8),
        prepare('mcs', 'iabp'),
        start('mcs'),
        adjust('mcs', 'assist-ratio', 1),
      ],
      'lv-mcs-rescue',
    ],
    [
      'lv-cardiogenic',
      [
        care('inotrope-up'),
        care('vasopressor-up'),
        prepare('ventilator', 'volume-control'),
        start('ventilator'),
        adjust('ventilator', 'peep-cmh2o', 8),
        prepare('ecmo', 'va'),
        start('ecmo'),
        adjust('ecmo', 'rpm', 3_000),
        adjust('ecmo', 'blood-flow-l-min', 3),
      ],
      'lv-va-ecmo-rescue',
    ],
    [
      'massive-pe-rv',
      [
        care('reperfusion'),
        care('vasopressor-up'),
        care('inotrope-up'),
        prepare('mcs', 'rp-impella'),
        start('mcs'),
        adjust('mcs', 'performance-level', 5),
      ],
      'pe-rp-mcs-rescue',
    ],
    [
      'massive-pe-rv',
      [
        care('reperfusion'),
        care('vasopressor-up'),
        care('inotrope-up'),
        prepare('ecmo', 'va'),
        start('ecmo'),
        adjust('ecmo', 'rpm', 3_400),
        adjust('ecmo', 'blood-flow-l-min', 3.5),
      ],
      'pe-va-ecmo-rescue',
    ],
  ] as const)(
    'accepts the authored rescue path for %s (%s)',
    (scenarioId, commands, expectedPath) => {
      const { response } = responseAfterMinimum(scenarioId, commands)
      expect(response.passed).toBe(true)
      expect(response.passedPathIds).toContain(expectedPath)
    },
  )

  it('calibrates hemorrhage recovery to two abstract blood-product support actions', () => {
    const oneMilestone = responseAfterMinimum('hemorrhagic', [
      care('blood-products'),
      care('source-control'),
      care('fluid-bolus'),
    ]).response
    const twoMilestones = responseAfterMinimum('hemorrhagic', hemorrhageCommands).response

    expect(oneMilestone.passed).toBe(false)
    expect(twoMilestones.passed).toBe(true)
  })

  it('fails untreated trajectories and withholds response truth until debrief', () => {
    for (const scenario of icuScenarios) {
      let state = createIcuSimulation(scenario, { mode: 'assess', seed: 43 })
      state = applyIcuCommand(state, scenario, {
        type: 'time.advance',
        seconds: scenario.minimumMasteryElapsedSeconds,
      })
      expect(evaluateIcuMasteryResponse(state, scenario).passed).toBe(false)
      expect(state.outcome.response.evaluated).toBe(false)
      state = applyIcuCommand(state, scenario, { type: 'session.complete' })
      expect(state.outcome.response.evaluated).toBe(true)
      expect(state.outcome.mastery).toBe(false)
    }
  })

  it.each([
    [
      'lv-cardiogenic',
      [prepare('mcs', 'iabp'), start('mcs'), stop('mcs'), ...lvNoDeviceCommands],
      'lv-no-rescue-mcs-never-started',
    ],
    [
      'massive-pe-rv',
      [prepare('mcs', 'rp-impella'), start('mcs'), stop('mcs'), ...peNoDeviceCommands],
      'pe-no-rescue-mcs-never-started',
    ],
    [
      'tamponade',
      [
        prepare('ventilator', 'volume-control'),
        start('ventilator'),
        stop('ventilator'),
        care('tamponade-drainage'),
      ],
      'tamponade-no-ventilation-never-started',
    ],
  ] as const)(
    'does not treat start-then-stop as a valid no-device path for %s',
    (scenarioId, commands, historyPredicateId) => {
      const { response } = responseAfterMinimum(scenarioId, commands)
      expect(response.passed).toBe(false)
      expect(
        response.criteria.find((criterion) => criterion.id === historyPredicateId),
      ).toMatchObject({ passed: false, actual: 'started previously' })
    },
  )

  it('allows LV mastery without rescue hardware and never mutates action history for credit', () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    let state = createIcuSimulation(scenario, { mode: 'assess', seed: 44 })
    state = applyCommands(state, scenario, [
      diagnose('lv-cardiogenic'),
      assess('focused-echo'),
      assess('pac'),
      ...lvNoDeviceCommands,
      care('communicate-plan'),
    ])
    state = completeWithSerialReassessment(state, scenario, ['hemodynamics', 'respiratory'])

    expect(state.outcome.mastery).toBe(true)
    expect(state.outcome.score.total).toBe(100)
    expect(state.outcome.response.passedPathIds).toEqual(['lv-no-rescue-device'])
    expect(state.outcome.response.substitutedActionIds).toEqual([
      'device:circulatory-support:adjust',
      'therapy:circulatory-support:start',
    ])
    expect(state.performedActionIds).not.toContain('therapy:circulatory-support:start')
    expect(
      state.actionHistory.some((record) => record.actionId.includes('circulatory-support')),
    ).toBe(false)
  })

  it('allows PE mastery after reperfusion without a rescue device', () => {
    const scenario = getIcuScenario('massive-pe-rv')
    let state = createIcuSimulation(scenario, { mode: 'assess', seed: 45 })
    state = applyCommands(state, scenario, [
      diagnose('rv-obstructive'),
      assess('focused-echo'),
      assess('abg'),
      ...peNoDeviceCommands,
      care('communicate-plan'),
    ])
    state = completeWithSerialReassessment(state, scenario, ['hemodynamics', 'respiratory'])

    expect(state.outcome.mastery).toBe(true)
    expect(state.outcome.score.total).toBeGreaterThanOrEqual(80)
    expect(state.outcome.response.passedPathIds).toEqual(['pe-no-rescue-device'])
    expect(state.devices.ecmo.status).not.toBe('running')
    expect(state.devices.mcs.status).not.toBe('running')
  })

  it('makes drainage definitive and allows tamponade mastery without ventilation or fluid bridge', () => {
    const scenario = getIcuScenario('tamponade')
    let state = createIcuSimulation(scenario, { mode: 'assess', seed: 46 })
    state = applyCommands(state, scenario, [
      diagnose('tamponade-obstructive'),
      assess('focused-echo'),
      assess('bedside-exam'),
      care('tamponade-drainage'),
      care('communicate-plan'),
    ])
    state = completeWithSerialReassessment(state, scenario, ['hemodynamics', 'perfusion'])

    expect(state.outcome.mastery).toBe(true)
    expect(state.outcome.score.total).toBe(100)
    expect(state.outcome.response.passedPathIds).toEqual(['tamponade-no-ventilation'])
    expect(state.outcome.response.substitutedActionIds).toEqual([
      'care:fluid-bolus',
      'device:ventilator:peep-cmh2o',
    ])
    expect(state.performedActionIds).not.toContain('care:fluid-bolus')
    expect(state.devices.ventilator.status).not.toBe('running')
  })

  it('fails a rescue pathway when a critical support alarm remains active', () => {
    const { scenario, state } = responseAfterMinimum('lv-cardiogenic', [
      care('inotrope-up'),
      care('inotrope-up'),
      care('vasopressor-up'),
      prepare('mcs', 'iabp'),
      start('mcs'),
      adjust('mcs', 'assist-ratio', 1),
    ])
    const withCriticalAlarm: IcuSimulationState = {
      ...state,
      alarms: [
        ...state.alarms,
        {
          id: 'mcs:test-critical',
          subsystem: 'mcs',
          code: 'TEST_CRITICAL',
          message: 'Synthetic critical support limitation',
          priority: 'critical',
          mappingReviewStatus: 'pending',
          active: true,
          startedAtSeconds: state.clock.elapsedSeconds,
          acknowledgedAtSeconds: null,
          correctedAtSeconds: null,
        },
      ],
    }
    const response = evaluateIcuMasteryResponse(withCriticalAlarm, scenario)
    expect(response.passed).toBe(false)
    expect(
      response.criteria.find((criterion) => criterion.id === 'lv-mcs-rescue-alarm-free'),
    ).toMatchObject({ passed: false, actual: 1 })
  })

  it('blocks extreme pre-start ECMO settings when an unmapped drainage limitation remains', () => {
    const { state, response } = responseAfterMinimum('mixed-cardiogenic-vasodilatory', [
      care('antimicrobials'),
      care('source-control'),
      care('vasopressor-up'),
      care('inotrope-up'),
      prepare('ecmo', 'va'),
      adjust('ecmo', 'rpm', 5_000),
      adjust('ecmo', 'blood-flow-l-min', 7),
      start('ecmo'),
    ])
    const drainageAlarm = state.alarms.find(
      (alarm) => alarm.subsystem === 'ecmo' && alarm.code === 'DRAINAGE_LIMITED',
    )

    expect(drainageAlarm).toMatchObject({ active: true, priority: null })
    expect(response.passed).toBe(false)
    expect(
      response.criteria.find((criterion) => criterion.id === 'mixed-ecmo-alarm-free'),
    ).toMatchObject({ passed: false, actual: 1, target: '0 unresolved device limitations' })
  })
})
