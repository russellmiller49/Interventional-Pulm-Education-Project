import { totalCirculatingVolumeMl } from '@/features/hemodynamics-core'

import { getIcuScenario, icuScenarios } from '../content'
import {
  advanceIcuSimulation,
  advanceIcuSlowPhysiology,
  aggregateMechanicalSupportEffects,
  applyIcuCommand,
  createIcuSimulation,
  createInitialIcuEcmoState,
  mergeIcuAlarmDescriptors,
  stepEcmo,
  type IcuCommand,
  type IcuDeviceAlarm,
  type IcuPatientSnapshot,
  type IcuTherapyEffect,
} from '../engine'

function command(
  state: ReturnType<typeof createIcuSimulation>,
  scenario: ReturnType<typeof getIcuScenario>,
  value: IcuCommand,
) {
  return applyIcuCommand(state, scenario, value)
}

function slowSeconds(
  patient: ReturnType<typeof createIcuSimulation>['patient'],
  devices: ReturnType<typeof createIcuSimulation>['devices'],
  effects: readonly IcuTherapyEffect[],
  seconds: number,
) {
  let next = patient
  for (let second = 0; second < seconds; second += 1)
    next = advanceIcuSlowPhysiology(next, devices, effects, 1)
  return next
}

describe('canonical ICU engine', () => {
  it('preserves each authored shock baseline on the first tick', () => {
    for (const scenario of icuScenarios) {
      const initial = createIcuSimulation(scenario, { seed: 1 })
      const advanced = advanceIcuSimulation(initial, scenario, 1)
      expect(advanced.patient.hemodynamics.mapMmHg).toBeCloseTo(
        scenario.initialPatient.hemodynamics.mapMmHg,
        0,
      )
      expect(advanced.patient.hemodynamics.nativeCardiacOutputLMin).toBeCloseTo(
        scenario.initialPatient.hemodynamics.nativeCardiacOutputLMin,
        1,
      )
      expect(totalCirculatingVolumeMl(advanced.compartments)).toBeCloseTo(
        advanced.patient.hemodynamics.circulatingVolumeMl,
        6,
      )
    }
  })

  it('steps deterministically and is equivalent across time partitions', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    const initialA = createIcuSimulation(scenario, { seed: 42 })
    const initialB = createIcuSimulation(scenario, { seed: 42 })
    const whole = advanceIcuSimulation(initialA, scenario, 120)
    const partitioned = advanceIcuSimulation(
      advanceIcuSimulation(initialB, scenario, 37),
      scenario,
      83,
    )
    expect(partitioned).toEqual(whole)
    expect(whole.trends).toHaveLength(3)
  })

  it('does not self-normalize untreated shock during the opening minute', () => {
    for (const scenario of icuScenarios) {
      const state = advanceIcuSimulation(createIcuSimulation(scenario, { seed: 2 }), scenario, 60)
      expect(state.patient.hemodynamics.mapMmHg).toBeLessThanOrEqual(
        scenario.initialPatient.hemodynamics.mapMmHg + 5,
      )
      expect(state.patient.hemodynamics.nativeCardiacOutputLMin).toBeLessThanOrEqual(
        scenario.initialPatient.hemodynamics.nativeCardiacOutputLMin + 0.5,
      )
    }
  })

  it('accumulates slow bleeding, renal, infection, and CRRT changes without quantization', () => {
    const hemorrhage = createIcuSimulation(getIcuScenario('hemorrhagic'), { seed: 3 })
    const bled = slowSeconds(hemorrhage.patient, hemorrhage.devices, [], 3_600)
    expect(bled.hematology.cumulativeBloodLossMl).toBeCloseTo(720, 6)
    expect(bled.hematology.hemoglobinGdl).toBeLessThan(hemorrhage.patient.hematology.hemoglobinGdl)

    const sepsis = createIcuSimulation(getIcuScenario('septic-ards-aki'), { seed: 4 })
    const untreated = slowSeconds(sepsis.patient, sepsis.devices, [], 3_600)
    const antimicrobial = slowSeconds(
      { ...sepsis.patient, antimicrobialsAdministered: true },
      sepsis.devices,
      [],
      3_600,
    )
    expect(untreated.renal.creatinineMgDl).not.toBe(sepsis.patient.renal.creatinineMgDl)
    expect(antimicrobial.drivers.infectionBurden).toBeLessThan(untreated.drivers.infectionBurden)

    const clearance: IcuTherapyEffect = {
      kind: 'solute-clearance',
      source: 'crrt',
      clearanceMlMin: 30,
    }
    const cleared = slowSeconds(sepsis.patient, sepsis.devices, [clearance], 3_600)
    expect(cleared.renal.creatinineMgDl).toBeLessThan(untreated.renal.creatinineMgDl)

    for (const rateMlHour of [25, 50, 100, 200, 600]) {
      const removed = slowSeconds(
        sepsis.patient,
        sepsis.devices,
        [{ kind: 'volume-removal', source: 'crrt', rateMlHour }],
        3_600,
      )
      expect(removed.renal.cumulativeCrrtRemovalMl).toBeCloseTo(rateMlHour, 6)
      expect(
        untreated.hemodynamics.circulatingVolumeMl - removed.hemodynamics.circulatingVolumeMl,
      ).toBeCloseTo(rateMlHour, 6)
    }
  })

  it('models higher PEEP as a preload burden', () => {
    const scenario = getIcuScenario('massive-pe-rv')
    let low = createIcuSimulation(scenario, { seed: 10 })
    low = command(low, scenario, {
      type: 'therapy.prepare',
      therapy: 'ventilator',
      configuration: 'volume-control',
    })
    low = command(low, scenario, { type: 'therapy.start', therapy: 'ventilator' })
    let high = low
    low = command(low, scenario, {
      type: 'therapy.adjust',
      therapy: 'ventilator',
      control: 'peep-cmh2o',
      value: 5,
    })
    high = command(high, scenario, {
      type: 'therapy.adjust',
      therapy: 'ventilator',
      control: 'peep-cmh2o',
      value: 18,
    })
    low = advanceIcuSimulation(low, scenario, 90)
    high = advanceIcuSimulation(high, scenario, 90)
    expect(high.patient.hemodynamics.nativeCardiacOutputLMin).toBeLessThan(
      low.patient.hemodynamics.nativeCardiacOutputLMin,
    )
    expect(high.patient.hemodynamics.mapMmHg).toBeLessThan(low.patient.hemodynamics.mapMmHg)
  })

  it('keeps VV gas exchange separate from VA systemic-flow support', () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    const base = createIcuSimulation(scenario, { seed: 11 })
    const snapshot: IcuPatientSnapshot = {
      elapsedSeconds: 0,
      patient: base.patient,
      circulationParameters: base.circulationParameters,
      compartments: base.compartments,
      devices: base.devices,
    }
    const initial = {
      ...createInitialIcuEcmoState(),
      status: 'running' as const,
      rpm: 3_400,
      targetBloodFlowLMin: 4,
      sweepLMin: 4,
    }
    const vv = stepEcmo({ ...initial, mode: 'vv' }, snapshot, 1)
    const va = stepEcmo({ ...initial, mode: 'va' }, snapshot, 1)
    const vvSupport = vv.effects.find((effect) => effect.kind === 'mechanical-support')
    const vaSupport = va.effects.find((effect) => effect.kind === 'mechanical-support')
    expect(vvSupport?.kind === 'mechanical-support' && vvSupport.effect.transfers).toEqual([])
    expect(
      vaSupport?.kind === 'mechanical-support' && vaSupport.effect.effectiveSystemicFlowLMin,
    ).toBeGreaterThan(base.patient.hemodynamics.nativeCardiacOutputLMin)
  })

  it('does not geometrically decay stable ECMO delivery at fixed preload', () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    const base = createIcuSimulation(scenario, { seed: 12 })
    const snapshot: IcuPatientSnapshot = {
      elapsedSeconds: 0,
      patient: {
        ...base.patient,
        hemodynamics: { ...base.patient.hemodynamics, circulatingVolumeMl: 3_400 },
      },
      circulationParameters: base.circulationParameters,
      compartments: base.compartments,
      devices: base.devices,
    }
    const initial = {
      ...createInitialIcuEcmoState(),
      status: 'running' as const,
      mode: 'va' as const,
      rpm: 3_200,
      targetBloodFlowLMin: 4,
    }
    const first = stepEcmo(initial, snapshot, 1)
    const second = stepEcmo(first.state, snapshot, 1)
    expect(second.state.bloodFlowLMin).toBe(first.state.bloodFlowLMin)
  })

  it('applies CRRT removal to the same circulating volume', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    const control = advanceIcuSimulation(createIcuSimulation(scenario, { seed: 13 }), scenario, 600)
    let treated = createIcuSimulation(scenario, { seed: 13 })
    treated = command(treated, scenario, {
      type: 'therapy.prepare',
      therapy: 'crrt',
      configuration: 'cvvhd',
    })
    treated = command(treated, scenario, { type: 'therapy.start', therapy: 'crrt' })
    treated = command(treated, scenario, {
      type: 'therapy.adjust',
      therapy: 'crrt',
      control: 'patient-fluid-removal-ml-hour',
      value: 600,
    })
    treated = advanceIcuSimulation(treated, scenario, 600)
    expect(treated.patient.renal.cumulativeCrrtRemovalMl).toBeGreaterThan(90)
    expect(treated.patient.hemodynamics.circulatingVolumeMl).toBeLessThan(
      control.patient.hemodynamics.circulatingVolumeMl,
    )
  })

  it('preserves source MCS native/effective flow and avoids ventilator CO2 double counting', () => {
    const support = aggregateMechanicalSupportEffects(
      [
        {
          kind: 'mechanical-support',
          source: 'mcs',
          effect: {
            transfers: [],
            nativeFlowLMin: 2,
            deviceFlowLMin: 3,
            recirculatingFlowLMin: 0,
            effectiveSystemicFlowLMin: 4.4,
          },
        },
      ],
      5,
    )
    expect(support.nativeFlowLMin).toBe(2)
    expect(support.effectiveSystemicFlowLMin).toBe(4.4)

    const scenario = getIcuScenario('septic-ards-aki')
    const base = createIcuSimulation(scenario, { seed: 14 })
    const ventilatorEffect: IcuTherapyEffect = {
      kind: 'gas-exchange',
      source: 'ventilator',
      oxygenationCapacity: 0.8,
      co2RemovalMlMin: 10_000,
    }
    const withSignal = advanceIcuSlowPhysiology(base.patient, base.devices, [ventilatorEffect], 60)
    const withoutSignal = advanceIcuSlowPhysiology(
      base.patient,
      base.devices,
      [{ ...ventilatorEffect, co2RemovalMlMin: 0 }],
      60,
    )
    expect(withSignal.respiratory.paCO2MmHg).toBe(withoutSignal.respiratory.paCO2MmHg)
  })

  it('fails closed on concurrent ECMO and MCS starts', () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    let state = createIcuSimulation(scenario, { seed: 15 })
    state = command(state, scenario, {
      type: 'therapy.prepare',
      therapy: 'mcs',
      configuration: 'left-impella',
    })
    state = command(state, scenario, { type: 'therapy.start', therapy: 'mcs' })
    state = command(state, scenario, {
      type: 'therapy.prepare',
      therapy: 'ecmo',
      configuration: 'va',
    })
    state = command(state, scenario, { type: 'therapy.start', therapy: 'ecmo' })
    expect(state.devices.mcs.status).toBe('running')
    expect(state.devices.ecmo.status).toBe('ready')
    expect(state.history.at(-1)?.code).toBe('therapy.start:rejected')
  })

  it('rejects off-device, malformed, and out-of-range device commands before credit', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    let state = createIcuSimulation(scenario, { seed: 16 })
    state = command(state, scenario, {
      type: 'therapy.adjust',
      therapy: 'ventilator',
      control: 'peep-cmh2o',
      value: 10,
    })
    expect(state.history.at(-1)?.code).toBe('therapy.adjust:rejected')
    expect(state.performedActionIds).not.toContain('device:ventilator:peep-cmh2o')

    state = command(state, scenario, {
      type: 'therapy.prepare',
      therapy: 'ventilator',
      configuration: 'not-a-ventilator-mode',
    })
    expect(state.devices.ventilator.status).toBe('off')
    state = command(state, scenario, {
      type: 'therapy.prepare',
      therapy: 'ventilator',
      configuration: 'volume-control',
    })
    state = command(state, scenario, {
      type: 'therapy.adjust',
      therapy: 'ventilator',
      control: 'peep-cmh2o',
      value: 30,
    })
    expect(state.devices.ventilator.peepCmH2O).toBe(5)
    expect(state.history.at(-1)?.code).toBe('therapy.adjust:rejected')

    state = command(state, scenario, {
      type: 'therapy.prepare',
      therapy: 'crrt',
      configuration: 'not-a-crrt-modality',
    })
    expect(state.devices.crrt.status).toBe('off')
  })

  it('applies only bounded disease-driver changes in Sandbox', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    const initial = createIcuSimulation(scenario, { mode: 'sandbox', seed: 17 })
    const adjusted = command(initial, scenario, {
      type: 'sandbox.adjust',
      driver: 'vasoplegiaSeverity',
      value: 0.5,
    })
    expect(adjusted.patient.drivers.vasoplegiaSeverity).toBe(0.5)
    expect(adjusted.history.at(-1)?.code).toBe('sandbox.adjust')

    const outOfBounds = command(adjusted, scenario, {
      type: 'sandbox.adjust',
      driver: 'vasoplegiaSeverity',
      value: 2,
    })
    expect(outOfBounds.patient.drivers.vasoplegiaSeverity).toBe(0.5)
    expect(outOfBounds.history.at(-1)?.code).toBe('sandbox.adjust:rejected')

    const practice = createIcuSimulation(scenario, { mode: 'practice', seed: 18 })
    const rejectedOutsideSandbox = command(practice, scenario, {
      type: 'sandbox.adjust',
      driver: 'vasoplegiaSeverity',
      value: 0.5,
    })
    expect(rejectedOutsideSandbox.patient.drivers.vasoplegiaSeverity).toBe(
      practice.patient.drivers.vasoplegiaSeverity,
    )
  })

  it('resets acknowledgement when a corrected alarm recurs', () => {
    const descriptor = {
      id: 'patient:LOW_MAP',
      subsystem: 'patient' as const,
      code: 'LOW_MAP',
      message: 'Low MAP',
      priority: 'warning' as const,
      mappingReviewStatus: 'pending' as const,
      active: true,
    }
    const started = mergeIcuAlarmDescriptors([], [descriptor], 1)[0]
    const acknowledged: IcuDeviceAlarm = { ...started, acknowledgedAtSeconds: 2 }
    const corrected = mergeIcuAlarmDescriptors([acknowledged], [], 3)[0]
    const recurrent = mergeIcuAlarmDescriptors([corrected], [descriptor], 4)[0]
    expect(recurrent.startedAtSeconds).toBe(4)
    expect(recurrent.acknowledgedAtSeconds).toBeNull()
  })
})
