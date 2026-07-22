import { getIcuScenario } from '../content'
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

describe('canonical ICU engine', () => {
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
