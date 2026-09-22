/**
 * ECMO-FELLOW-02 — causal truth and time truth in the engine.
 *
 * Every assertion here drives the real reducer on the model's own clock through the shared plans in
 * `test-support/causalTrajectories.ts`: A time only, B assessment only, C the intended treatment,
 * D a harmful or ineffective path, compared at matched modeled seconds. This file deliberately
 * imports only engine entry points that predate the batch, so the identical file runs against the
 * baseline checkout — which is how its failing-before evidence was produced.
 *
 * Sections:
 *   A  time semantics — load, action time, the clock, passive actions
 *   B  ownership — a case left alone does not recover on its own; a treatment's effect is its own
 *   C  preserved controls — intended deterioration and responses that already worked
 *   D  replay, restart and cross-case reset
 */
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { cardiohelpScenarios } from '../content/scenarios'
import { createInitialSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SimulationAction } from '../engine/types'
import {
  ECMO_CAUSAL_PLANS,
  readingAt,
  runCausalPlan,
  type CausalPathId,
} from '../test-support/causalTrajectories'

function run(scenarioId: string, path: CausalPathId) {
  const plan = ECMO_CAUSAL_PLANS[scenarioId]?.find((candidate) => candidate.id === path)
  if (!plan) throw new Error(`no plan ${scenarioId}/${path}`)
  return runCausalPlan(scenarioId, plan)
}

function at(scenarioId: string, path: CausalPathId, t: number) {
  const reading = readingAt(run(scenarioId, path), t)
  if (!reading) throw new Error(`no reading at ${t}`)
  return reading
}

function reduce(state: EcmoSimulationState, actions: readonly SimulationAction[]) {
  return actions.reduce(ecmoSimulationReducer, state)
}

const RATE_LIMITED = [
  'paCO2',
  'spo2',
  'rightRadialSpo2',
  'femoralArterialSpo2',
  'nativeCardiacOutputLpm',
  'pulsePressure',
  'meanArterialPressure',
  'centralVenousPressure',
  'lactate',
  'urineOutputMlHr',
  'airwayPressure',
  'distalLimbNirs',
] as const

describe('A · time semantics', () => {
  const allScenarios = [...clinicalPracticeScenarios, ...cardiohelpScenarios]

  it('C1 presentation MAP and the first modeled reading describe the same instant', () => {
    const caseDefinition = clinicalPracticeScenarios.find(
      (scenario) => scenario.id === 'clinical-vv-initiation-ards',
    )
    const presentation = caseDefinition?.clinicalCase?.data.find((row) => row.label === 'MAP')
    const loaded = createInitialSimulationState('clinical-vv-initiation-ards')
    expect(presentation?.value).toBe(`${loaded.patient.meanArterialPressure} mmHg`)
    expect(loaded.patient.meanArterialPressure).toBe(70)
  })

  it.each(allScenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s: loading is not a second of the clock — t = 0 shows the authored patient',
    (_id, scenario) => {
      const loaded = createInitialSimulationState(scenario.id, 'guided')
      expect(loaded.simulationTime).toBe(0)
      const authored = scenario.initialState.patient ?? {}
      for (const field of RATE_LIMITED) {
        const value = authored[field]
        if (value === undefined) continue
        expect(`${field}=${loaded.patient[field]}`).toBe(`${field}=${value}`)
      }
    },
  )

  it('C4-1: PaCO₂ no longer settles from the default patient in the first seconds of a case', () => {
    // The walkthrough: "the same drift to 46 I saw in the first 3 s of every case".
    for (const t of [0, 1, 3, 8]) {
      expect(at('clinical-vv-oxygenator-thrombosis', 'A', t).paCO2).toBe(46)
      expect(at('clinical-vv-recirculation-migration', 'A', t).paCO2).toBe(46)
    }
  })

  it('VA13-1: a VA drill opens on VA values, not the VV default patient', () => {
    const opened = createInitialSimulationState('va-acute-hypercapnia', 'guided')
    expect(opened.patient.pulsePressure).toBe(18)
    expect(opened.patient.nativeCardiacOutputLpm).toBe(2.4)
    expect(opened.patient.rightRadialSpo2).toBe(96)
    expect(opened.patient.femoralArterialSpo2).toBe(98.5)
    // The stem's respiratory rate follows its authored "high" work of breathing.
    expect(opened.patient.workOfBreathing).toBe('high')
    expect(opened.patient.respiratoryRate).toBe(32)
    // And the observe step's "pulse pressure unchanged" is now true while the clock runs.
    const later = reduce(opened, [{ type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }])
    expect(later.patient.pulsePressure).toBe(18)
  })

  it('a control change recomputes the circuit at the second it is made, without moving the patient', () => {
    const opened = createInitialSimulationState('clinical-vv-occult-hemorrhage', 'guided')
    const slowed = ecmoSimulationReducer(opened, { type: 'SET_RPM', rpm: 3200 })
    expect(slowed.simulationTime).toBe(0)
    // Flow and drainage pressure answer the speed change in the same second (S8-3's holding move).
    expect(slowed.circuit.bloodFlow).not.toBe(opened.circuit.bloodFlow)
    expect(slowed.circuit.pVen).toBeGreaterThan(opened.circuit.pVen)
    // Nothing about the patient moves at an unchanged time.
    expect(slowed.patient).toEqual(opened.patient)
  })

  it('keeps action observation IDs distinct after the bounded history fills in one modeled second', () => {
    let state = createInitialSimulationState('clinical-vv-recirculation-migration')
    for (let index = 0; index < 105; index += 1) {
      state = ecmoSimulationReducer(state, { type: 'SET_SCREEN', screen: 'blood' })
    }
    const ids = state.history.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(state.history.at(-1)?.observation?.before.time).toBe(0)
    expect(state.history.at(-1)?.observation?.after.time).toBe(0)
  })

  it('an action-time recomputation spends no battery and moves no haemoglobin', () => {
    let state = createInitialSimulationState('transport-power-loss', 'guided')
    state = reduce(state, [{ type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }])
    expect(state.device.powerSource).toBe('battery')
    const battery = state.device.batteryPercent
    const hemoglobin = state.circuit.hemoglobin
    const clamped = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: true,
    })
    expect(clamped.simulationTime).toBe(state.simulationTime)
    expect(clamped.device.batteryPercent).toBe(battery)
    expect(clamped.circuit.hemoglobin).toBe(hemoglobin)
  })

  it('the model clock stops at the reveal: a tick or step after it changes nothing', () => {
    let state = createInitialSimulationState('clinical-vv-recirculation-migration', 'guided')
    state = reduce(state, [
      { type: 'SET_PAUSED', paused: false },
      { type: 'STEP' },
      { type: 'REVEAL_DEBRIEF' },
    ])
    expect(state.scenario.phase).toBe('complete')
    expect(ecmoSimulationReducer(state, { type: 'TICK' })).toBe(state)
    expect(ecmoSimulationReducer(state, { type: 'STEP' })).toBe(state)
  })

  it.each([
    ['REVEAL_DEBRIEF', { type: 'REVEAL_DEBRIEF' }],
    ['SET_SCREEN', { type: 'SET_SCREEN', screen: 'blood' }],
    ['ACK_ALARM', { type: 'ACK_ALARM' }],
    ['START_ACTIVITY', { type: 'START_ACTIVITY' }],
    ['TOGGLE_ALARM_AUDIO', { type: 'TOGGLE_ALARM_AUDIO' }],
  ] as const)('passive %s advances no time and moves no physiology', (_name, action) => {
    const opened = reduce(createInitialSimulationState('va-clinical-tamponade', 'guided'), [
      { type: 'STEP' },
      { type: 'STEP' },
    ])
    const after = ecmoSimulationReducer(opened, action as SimulationAction)
    expect(after.simulationTime).toBe(opened.simulationTime)
    expect(after.patient).toEqual(opened.patient)
    expect(after.circuit.bloodFlow).toBe(opened.circuit.bloodFlow)
  })

  it('IV-4: the off-sweep breathing response is timed from the sweep stopping, not from the case clock', () => {
    // Trial started at 5 s: breathing must not change until 25 s. It used to change at 20 s.
    const late = run('vv-off-sweep-capstone', 'D')
    expect(readingAt(late, 20)?.workOfBreathing).toBe('low')
    expect(readingAt(late, 25)?.workOfBreathing).toBe('high')
    // Trial started at 0 s: the response arrives 20 s later, as authored.
    const early = run('vv-off-sweep-capstone', 'C')
    expect(readingAt(early, 16)?.workOfBreathing).toBe('low')
    expect(readingAt(early, 20)?.workOfBreathing).toBe('high')
  })

  it('resets the off-sweep timer on restore and a later stop, without counting unrelated actions', () => {
    let state = createInitialSimulationState('vv-off-sweep-capstone', 'guided')
    state = reduce(state, [
      { type: 'SET_SWEEP', sweep: 0 },
      ...Array.from({ length: 12 }, () => ({ type: 'STEP' as const })),
    ])
    expect(state.scenario.sweepStoppedAt).toBe(0)
    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 3 })
    expect(state.scenario.sweepStoppedAt).toBeNull()
    state = reduce(
      state,
      Array.from({ length: 10 }, () => ({ type: 'STEP' as const })),
    )
    expect(state.patient.workOfBreathing).toBe('low')
    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 0 })
    expect(state.scenario.sweepStoppedAt).toBe(22)
    const fixedTime = state.simulationTime
    state = reduce(state, [
      { type: 'SET_RPM', rpm: 3300 },
      { type: 'SET_GAS_FIO2', fio2: 0.8 },
    ])
    expect(state.simulationTime).toBe(fixedTime)
    expect(state.scenario.sweepStoppedAt).toBe(22)
    state = reduce(
      state,
      Array.from({ length: 19 }, () => ({ type: 'STEP' as const })),
    )
    expect(state.patient.workOfBreathing).toBe('low')
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.patient.workOfBreathing).toBe('high')
  })
})

describe('B · a case left alone does not recover on its own, and a treatment keeps what it bought', () => {
  it('C5-3 recirculation: untreated SpO₂ holds; repositioning is what raises it', () => {
    for (const t of [0, 3, 8, 10, 20]) {
      expect(at('clinical-vv-recirculation-migration', 'A', t).spo2).toBe(78)
      // Two assessment cards change nothing either.
      expect(at('clinical-vv-recirculation-migration', 'B', t).spo2).toBe(78)
    }
    const treated10 = at('clinical-vv-recirculation-migration', 'C', 10).spo2
    const untreated10 = at('clinical-vv-recirculation-migration', 'A', 10).spo2
    expect(treated10).toBeGreaterThan(untreated10 + 5)
    // Pre-oxygenator saturation moves only with the treatment too.
    expect(at('clinical-vv-recirculation-migration', 'A', 20).preOxygenator).toBe(
      at('clinical-vv-recirculation-migration', 'A', 0).preOxygenator,
    )
    // The harmful speed increase still costs saturation.
    expect(at('clinical-vv-recirculation-migration', 'D', 3).spo2).toBeLessThan(78)
  })

  it('VAC5-1 differential hypoxemia: no-action is flat, and the ventilation card’s gain persists', () => {
    for (const t of [0, 3, 8, 20]) {
      const untreated = at('va-clinical-differential-hypoxemia', 'A', t)
      expect(untreated.spo2).toBe(78)
      expect(untreated.pulsePressure).toBe(28)
      expect(untreated.nativeOutput).toBe(3.5)
    }
    // The supportive ventilation card lands at 86 and is still 86 twenty seconds later.
    expect(at('va-clinical-differential-hypoxemia', 'C', 1).spo2).toBe(86)
    expect(at('va-clinical-differential-hypoxemia', 'C', 20).spo2).toBe(86)
    // More speed changes circuit flow and MAP by one, and nothing about the upper body.
    const faster = at('va-clinical-differential-hypoxemia', 'D', 8)
    const untreated = at('va-clinical-differential-hypoxemia', 'A', 8)
    expect(faster.flow).toBeGreaterThan(untreated.flow)
    expect(faster.spo2).toBe(untreated.spo2)
    expect(faster.pulsePressure).toBe(untreated.pulsePressure)
  })

  it('VAC2-1 tamponade: pulse pressure no longer widens untreated, and native output starts VA', () => {
    for (const t of [0, 3, 8, 20]) {
      expect(at('va-clinical-tamponade', 'A', t).pulsePressure).toBe(6)
      expect(at('va-clinical-tamponade', 'A', t).nativeOutput).toBe(2.4)
    }
  })

  it('VAC3-1 vasoplegia: pressors hold the MAP they bought while the tone problem stands', () => {
    // Pressors at 0 s land at 65 and hold until source control at 6 s; they used to fade to 48.
    expect(at('va-clinical-vasoplegia', 'C', 3).map).toBe(65)
    expect(at('va-clinical-vasoplegia', 'C', 5).map).toBe(65)
    // The recovered ventricle the case describes stays recovered.
    expect(at('va-clinical-vasoplegia', 'A', 20).nativeOutput).toBe(4.5)
    expect(at('va-clinical-vasoplegia', 'A', 20).pulsePressure).toBe(25)
  })

  it('a new shock fault can lower MAP despite an earlier held vasopressor response', () => {
    let state = createInitialSimulationState('va-clinical-vasoplegia', 'guided')
    state = reduce(state, [
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'vasoplegia-pressors' },
      { type: 'STEP' },
    ])
    expect(state.patient.meanArterialPressure).toBe(65)
    state = ecmoSimulationReducer(state, { type: 'INJECT_FAULT', fault: 'tamponade' })
    expect(state.patient.meanArterialPressure).toBe(65)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.patient.meanArterialPressure).toBeLessThan(65)
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'tamponade' })
    state = reduce(
      state,
      Array.from({ length: 4 }, () => ({ type: 'STEP' as const })),
    )
    expect(state.patient.meanArterialPressure).toBe(65)
  })

  it('VAC1-1 VA initiation: pulsatility and native output do not improve untreated', () => {
    for (const t of [0, 3, 8, 20]) {
      expect(at('va-clinical-initiation-shock', 'A', t).pulsePressure).toBe(8)
      expect(at('va-clinical-initiation-shock', 'A', t).nativeOutput).toBe(1.2)
    }
  })

  it('VA oxygenator thrombosis (VAC4) and VA air (VAC7): the untreated patient no longer recovers', () => {
    for (const t of [0, 8, 20]) {
      expect(at('va-clinical-oxygenator-thrombosis', 'A', t).spo2).toBe(84)
      expect(at('va-clinical-oxygenator-thrombosis', 'A', t).map).toBe(56)
      expect(at('va-clinical-oxygenator-thrombosis', 'A', t).lactate).toBe(4.9)
      expect(at('va-clinical-circuit-air-embolism', 'A', t).map).toBe(48)
      expect(at('va-clinical-circuit-air-embolism', 'A', t).spo2).toBe(88)
    }
    // Treatment is what moves them.
    expect(at('va-clinical-oxygenator-thrombosis', 'C', 20).map).toBeGreaterThan(56)
    expect(at('va-clinical-circuit-air-embolism', 'C', 20).map).toBeGreaterThan(48)
  })

  it('C1-4 VV initiation: lactate no longer clears untreated, so its fall is attributable to support', () => {
    for (const t of [0, 3, 8, 20])
      expect(at('clinical-vv-initiation-ards', 'A', t).lactate).toBe(3.2)
    expect(at('clinical-vv-initiation-ards', 'C', 20).lactate).toBeLessThan(3.2)
  })

  it('IV integrated case: values the brief calls settled stay settled before the trial', () => {
    for (const t of [0, 3, 8, 20]) {
      expect(at('vv-off-sweep-capstone', 'A', t).paCO2).toBe(43)
      expect(at('vv-off-sweep-capstone', 'A', t).spo2).toBe(95)
    }
  })
})

describe('C · preserved controls: intended deterioration and responses that already worked', () => {
  it('hemorrhage untreated: MAP and hemoglobin keep falling; the treated path recovers', () => {
    expect(at('clinical-vv-occult-hemorrhage', 'A', 8).map).toBe(46)
    expect(at('clinical-vv-occult-hemorrhage', 'A', 20).hemoglobin).toBeLessThan(6.8)
    expect(at('clinical-vv-occult-hemorrhage', 'C', 3).map).toBe(65)
  })

  it('tamponade: untreated MAP sinks to the story target; decompression lifts it and drops CVP', () => {
    expect(at('va-clinical-tamponade', 'A', 20).map).toBe(40)
    expect(at('va-clinical-tamponade', 'C', 20).map).toBeGreaterThan(65)
    expect(at('va-clinical-tamponade', 'C', 8).cvp).toBe(8)
  })

  it('a temporizing card still fades: the tamponade vasopressor rises and falls back', () => {
    expect(at('va-clinical-tamponade', 'D', 1).map).toBe(52)
    expect(at('va-clinical-tamponade', 'D', 20).map).toBe(40)
  })

  it('the VV air case still falls off support until resumed', () => {
    expect(at('clinical-vv-circuit-air-embolism', 'A', 0).spo2).toBe(84)
    expect(at('clinical-vv-circuit-air-embolism', 'A', 8).spo2).toBe(82)
    expect(at('clinical-vv-circuit-air-embolism', 'C', 20).spo2).toBeGreaterThan(90)
  })

  it('the gas case still accumulates CO₂ untreated and recovers over modeled time after repair', () => {
    expect(at('clinical-vv-gas-disconnection', 'A', 8).paCO2).toBe(90)
    const repaired = [3, 8, 20].map((t) => at('clinical-vv-gas-disconnection', 'C', t).paCO2)
    expect(repaired[0]).toBeGreaterThan(repaired[1])
    expect(repaired[1]).toBeGreaterThan(repaired[2])
  })

  it('tension pneumothorax: decompression still drops CVP and airway pressure', () => {
    expect(at('clinical-vv-tension-pneumothorax', 'C', 8).cvp).toBe(8)
    expect(at('clinical-vv-tension-pneumothorax', 'C', 8).airwayPressure).toBe(24)
    expect(at('clinical-vv-tension-pneumothorax', 'A', 8).map).toBe(42)
  })

  it('every clinical case authors no directional value that its own story target would improve', () => {
    // The story targets are deterioration endpoints. If a case ever authored a value worse than
    // its fault's target, the fault would improve an untreated patient — the defect this batch
    // removed. Checked by running each case untreated for a minute of modeled time.
    for (const scenario of clinicalPracticeScenarios) {
      const opened = createInitialSimulationState(scenario.id, 'guided')
      const later = reduce(
        opened,
        Array.from({ length: 60 }, (): SimulationAction => ({ type: 'STEP' })),
      )
      // Authored fields only: an unauthored saturation can still swing with a drainage-limited
      // flow's instability, which is modeled dynamics rather than an authored value recovering.
      const authored = scenario.initialState.patient ?? {}
      const upward = ['spo2', 'rightRadialSpo2', 'meanArterialPressure', 'distalLimbNirs'] as const
      for (const field of upward) {
        if (authored[field] === undefined) continue
        expect(`${scenario.id}.${field}: ${later.patient[field] > opened.patient[field]}`).toBe(
          `${scenario.id}.${field}: false`,
        )
      }
      if (authored.lactate !== undefined) {
        expect(`${scenario.id}.lactate: ${later.patient.lactate < opened.patient.lactate}`).toBe(
          `${scenario.id}.lactate: false`,
        )
      }
    }
  })
})

describe('D · deterministic replay, restart and cross-case reset', () => {
  it('replays identically: the same plan twice gives the same rows', () => {
    for (const [scenarioId, plans] of Object.entries(ECMO_CAUSAL_PLANS)) {
      for (const plan of plans) {
        expect(runCausalPlan(scenarioId, plan).rows).toEqual(runCausalPlan(scenarioId, plan).rows)
      }
    }
  })

  it('restart reloads the authored case exactly, whatever the previous run did', () => {
    const fresh = createInitialSimulationState('va-clinical-differential-hypoxemia', 'guided')
    const played = run('va-clinical-differential-hypoxemia', 'C').final
    const restarted = ecmoSimulationReducer(played, {
      type: 'LOAD_SCENARIO',
      scenarioId: 'va-clinical-differential-hypoxemia',
      mode: 'guided',
    })
    expect(restarted.patient).toEqual(fresh.patient)
    expect(restarted.simulationTime).toBe(0)
    // Nothing the previous run held carries into the new one.
    const next = reduce(
      restarted,
      Array.from({ length: 10 }, (): SimulationAction => ({ type: 'STEP' })),
    )
    expect(next.patient.rightRadialSpo2).toBe(78)
  })

  it('loading another case carries nothing across', () => {
    const vasoplegia = run('va-clinical-vasoplegia', 'C').final
    const tamponade = ecmoSimulationReducer(vasoplegia, {
      type: 'LOAD_SCENARIO',
      scenarioId: 'va-clinical-tamponade',
      mode: 'guided',
    })
    expect(tamponade.patient).toEqual(
      createInitialSimulationState('va-clinical-tamponade', 'guided').patient,
    )
    const later = reduce(tamponade, [{ type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }])
    // The vasoplegia run's held MAP is not applied to the tamponade patient.
    expect(later.patient.meanArterialPressure).toBe(43)
  })

  it('a repeated card is refused rather than applied twice', () => {
    const once = reduce(
      createInitialSimulationState('va-clinical-differential-hypoxemia', 'guided'),
      [
        { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'differential-native-lung' },
        { type: 'STEP' },
      ],
    )
    const twice = reduce(once, [
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'differential-native-lung' },
      { type: 'STEP' },
    ])
    expect(twice.scenario.clinical?.appliedInterventions).toHaveLength(1)
    expect(twice.patient.rightRadialSpo2).toBe(once.patient.rightRadialSpo2)
  })
})
