import { ecmoReferenceProfileList } from '../content/referenceProfiles'
import { cardiohelpScenarios } from '../content/scenarios'
import {
  RECIRCULATION_FRACTION,
  createInitialSimulationState,
  createReferenceSimulationState,
  deriveDrainageSaturation,
  deriveEffectiveFlow,
  deriveRecirculationFraction,
  ecmoSimulationReducer,
  type EcmoSimulationState,
  type SimulationAction,
} from '../engine'

function run(
  state: EcmoSimulationState,
  actions: readonly SimulationAction[],
): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, state)
}

function advanced(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId)
  for (let step = 0; step < steps; step += 1) state = run(state, [{ type: 'STEP' }])
  return state
}

/**
 * These pin the module's spine claim: circuit flow is not effective flow. Until this landed, both
 * quantities existed only as local variables inside the saturation calculation and were discarded,
 * so nothing — panel, console, or test — could read the number the module exists to teach.
 */
describe('effective flow and recirculation', () => {
  it('exposes effective flow and recirculation fraction on the circuit', () => {
    const state = advanced('vv-recirculation')
    expect(state.circuit.recirculationFraction).toBeCloseTo(RECIRCULATION_FRACTION.established, 3)
    expect(state.circuit.effectiveFlow).toBeLessThan(state.circuit.bloodFlow)
  })

  it('keeps displayed flow high while effective flow falls during recirculation', () => {
    const recirculating = advanced('vv-recirculation')
    const baseline = advanced('acute-hypercapnia')

    // The teaching point: the console's flow number is not lower, and is in fact higher.
    expect(recirculating.circuit.bloodFlow).toBeGreaterThan(baseline.circuit.bloodFlow)
    expect(recirculating.circuit.effectiveFlow).toBeLessThan(baseline.circuit.effectiveFlow)
  })

  it('never reports effective flow above displayed flow in any scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const state = advanced(scenario.id)
      expect(state.circuit.effectiveFlow).toBeLessThanOrEqual(state.circuit.bloodFlow + 0.01)
    }
  })

  it('applies no VV recirculation term to a VA circuit, whose return is arterial', () => {
    for (const scenario of cardiohelpScenarios.filter((item) => item.supportMode === 'va')) {
      expect(deriveRecirculationFraction(advanced(scenario.id))).toBe(0)
    }
  })

  it('recovers the recirculation fraction from the two saturations a clinician can sample', () => {
    // This is the arithmetic the teaching panel will show. If the engine and the bedside formula
    // disagree, the panel would be teaching something the simulation does not do.
    const state = advanced('vv-recirculation')
    const { preOxygenatorSaturation, postOxygenatorSaturation, svo2 } = state.circuit
    const inferred = (preOxygenatorSaturation - svo2) / (postOxygenatorSaturation - svo2)
    expect(inferred).toBeCloseTo(state.circuit.recirculationFraction, 2)
  })

  it('charges recirculation to arterial saturation once, through effective flow', () => {
    // The fault used to reduce effective flow *and* subtract a flat 6 points, counting itself
    // twice through two unrelated mechanisms.
    const state = advanced('vv-recirculation')
    const withoutRecirculation = deriveEffectiveFlow(state.circuit.bloodFlow, 0)
    const predictedGain = (withoutRecirculation - state.circuit.effectiveFlow) * 4
    expect(predictedGain).toBeGreaterThan(6)
  })
})

describe('mixed venous saturation', () => {
  it('moves rather than sitting at its initial value', () => {
    // It was a frozen 68 displayed as a live parameter on two console screens.
    const first = createInitialSimulationState('preload-drainage-collapse')
    const later = advanced('preload-drainage-collapse')
    expect(later.circuit.svo2).not.toBeCloseTo(first.circuit.svo2, 1)
  })

  it('falls as delivery falls', () => {
    const wellSupported = advanced('acute-hypercapnia')
    const drainageCollapse = advanced('preload-drainage-collapse')
    expect(drainageCollapse.circuit.bloodFlow).toBeLessThan(wellSupported.circuit.bloodFlow)
    expect(drainageCollapse.circuit.svo2).toBeLessThan(wellSupported.circuit.svo2)
  })

  it('stays within a saturation range in every scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const { svo2 } = advanced(scenario.id).circuit
      expect(svo2).toBeGreaterThan(20)
      expect(svo2).toBeLessThan(95)
    }
  })
})

describe('drainage saturation', () => {
  it('is the mixture of venous return and returned circuit blood, in every scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const { preOxygenatorSaturation, postOxygenatorSaturation, svo2 } = advanced(
        scenario.id,
      ).circuit
      const low = Math.min(svo2, postOxygenatorSaturation)
      const high = Math.max(svo2, postOxygenatorSaturation)
      expect(preOxygenatorSaturation).toBeGreaterThanOrEqual(low - 0.2)
      expect(preOxygenatorSaturation).toBeLessThanOrEqual(high + 0.2)
    }
  })

  it('rises toward the returned blood as recirculation rises', () => {
    const venous = 65
    const returned = 99
    const baseline = deriveDrainageSaturation(venous, returned, RECIRCULATION_FRACTION.baseline)
    const established = deriveDrainageSaturation(
      venous,
      returned,
      RECIRCULATION_FRACTION.established,
    )
    expect(baseline).toBeGreaterThan(venous)
    expect(established).toBeGreaterThan(baseline)
    expect(established).toBeLessThan(returned)
  })

  it('equals mixed venous saturation when nothing recirculates', () => {
    expect(deriveDrainageSaturation(70, 99, 0)).toBeCloseTo(70, 5)
  })
})

/**
 * The reference circuits exist so a physiology lesson can sit beside a running, fault-free
 * console. They author inputs only, so these tests are what stop the authored expectations from
 * drifting away from the physics that actually produces them.
 */
describe('reference circuits', () => {
  function settled(profileId: 'vv-reference' | 'va-reference'): EcmoSimulationState {
    let state = createReferenceSimulationState(profileId)
    for (let step = 0; step < 12; step += 1) state = run(state, [{ type: 'STEP' }])
    return state
  }

  it.each(ecmoReferenceProfileList.map((profile) => [profile.id, profile] as const))(
    '%s derives a circuit inside its authored bounds',
    (_id, profile) => {
      const state = settled(profile.id)
      const { circuit, patient } = state
      const e = profile.expected

      const inside = (value: number, range?: { low: number; high: number }) => {
        if (!range) return
        expect(value).toBeGreaterThanOrEqual(range.low)
        expect(value).toBeLessThanOrEqual(range.high)
      }
      inside(circuit.bloodFlow, e.bloodFlow)
      inside(circuit.pVen, e.pVen)
      inside(circuit.pArt, e.pArt)
      inside(circuit.pInt, e.pInt)
      inside(circuit.deltaP, e.deltaP)
      inside(circuit.effectiveFlow, e.effectiveFlow)
      inside(patient.pulsePressure, e.pulsePressure)
      inside(patient.rightRadialSpo2, e.rightRadialSpo2)
      inside(patient.femoralArterialSpo2, e.femoralArterialSpo2)
      expect(circuit.recirculationFraction).toBeCloseTo(e.recirculationFraction, 3)
    },
  )

  it('runs fault-free and unpaused, unlike the orientation scenarios', () => {
    for (const profile of ecmoReferenceProfileList) {
      const state = settled(profile.id)
      expect(state.scenario.activeFaults).toHaveLength(0)
      expect(state.paused).toBe(false)
      expect(state.circuit.bloodFlow).toBeGreaterThan(0)
      expect(state.device.pumpRunning).toBe(true)
    }
  })

  it('poses no scored question — nothing to predict, no critical errors, no clinical case', () => {
    for (const profile of ecmoReferenceProfileList) {
      const state = settled(profile.id)
      expect(state.scenario.criticalErrors).toHaveLength(0)
      expect(state.scenario.penalties).toBe(0)
      expect(state.scenario.clinical).toBeNull()
    }
  })

  it('holds pump and gas settings identical across the two, so only the physiology differs', () => {
    const vv = settled('vv-reference')
    const va = settled('va-reference')
    expect(vv.device.rpmSetpoint).toBe(va.device.rpmSetpoint)
    expect(vv.gas.sweepLpm).toBe(va.gas.sweepLpm)
    expect(vv.gas.fio2).toBe(va.gas.fio2)
    expect(vv.circuit.bloodFlow).toBeCloseTo(va.circuit.bloodFlow, 2)

    // Same circuit, different physiology: VV drains part of its own return, VA does not.
    expect(vv.circuit.effectiveFlow).toBeLessThan(vv.circuit.bloodFlow)
    expect(va.circuit.effectiveFlow).toBeCloseTo(va.circuit.bloodFlow, 2)
  })
})

/**
 * The pressure equations describe a primed circuit with the pump turning. With the pump stopped
 * their zero-flow intercepts (pVen -25, pArt 146, pInt 146) are not measurements of anything, and
 * putting them on screen would read as live data for a state the model does not describe.
 *
 * The device's own convention settles how to present that: the IFU shows measured values that are
 * unavailable or outside the valid range as dashes rather than numbers (Rev 2.3 §3, page 47).
 */
describe('pressure signal validity', () => {
  function settle(id: string, steps = 6): EcmoSimulationState {
    let state = createInitialSimulationState(id)
    for (let step = 0; step < steps; step += 1) state = run(state, [{ type: 'STEP' }])
    return state
  }

  it('marks the pressure channels invalid whenever the circuit is not flowing', () => {
    for (const scenario of cardiohelpScenarios) {
      const state = settle(scenario.id, 12)
      if (state.circuit.bloodFlow === 0 && !state.circuit.returnClampClosed) {
        expect(state.circuit.pressureSignalsValid).toBe(false)
      }
    }
  })

  it('reports valid pressures on a running reference circuit', () => {
    expect(createReferenceSimulationState('vv-reference').circuit.pressureSignalsValid).toBe(true)
    expect(createReferenceSimulationState('va-reference').circuit.pressureSignalsValid).toBe(true)
  })

  it('raises no pressure alarm while the channels are invalid', () => {
    const stopped = settle('startup-sensor-orientation', 12)
    expect(stopped.circuit.pressureSignalsValid).toBe(false)
    const pressureAlarms = stopped.alarms.filter((alarm) =>
      ['pVen', 'pInt', 'pArt'].includes(alarm.parameter ?? ''),
    )
    expect(pressureAlarms).toHaveLength(0)
  })

  it('still raises non-pressure alarms while the pressure channels are invalid', () => {
    // Scoping matters: suppressing the pressure block must not silence bubble, gas, power, or
    // patient alarms on a stopped circuit. Air in the arterial limb is exactly the case where a
    // stopped pump must still be shouting.
    const state = settle('arterial-bubble-stop', 12)
    expect(state.circuit.bloodFlow).toBe(0)
    expect(state.circuit.pressureSignalsValid).toBe(false)
    expect(state.alarms.some((alarm) => alarm.code === 'ART_BUBBLE')).toBe(true)
  })

  it('keeps a clamped line valid, because that pressure is modelled and teachable', () => {
    let state = createReferenceSimulationState('vv-reference')
    state = run(state, [{ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }])
    for (let step = 0; step < 3; step += 1) state = run(state, [{ type: 'STEP' }])
    if (state.circuit.returnClampClosed) {
      expect(state.circuit.pressureSignalsValid).toBe(true)
    }
  })
})

/**
 * The gradient across the membrane is a resistance times a flow. It used to carry a fixed
 * +50 mmHg, which put the reference circuit near 60 mmHg and contradicted the module's own
 * authored return-obstruction text.
 */
describe('membrane pressure drop', () => {
  it('is zero when nothing is flowing', () => {
    const stopped = createInitialSimulationState('arterial-bubble-stop')
    let state = stopped
    for (let step = 0; step < 6; step += 1) state = run(state, [{ type: 'STEP' }])
    expect(state.circuit.bloodFlow).toBe(0)
    expect(state.circuit.deltaP).toBe(0)
  })

  it('separates return obstruction from oxygenator resistance', () => {
    const settle = (id: string) => {
      let state = createInitialSimulationState(id)
      for (let step = 0; step < 12; step += 1) state = run(state, [{ type: 'STEP' }])
      return state
    }
    const returnObstruction = settle('afterload-return-obstruction')
    const oxygenator = settle('afterload-oxygenator-resistance')

    // Both raise pInt to nearly the same place, so pInt alone cannot tell them apart.
    expect(Math.abs(returnObstruction.circuit.pInt - oxygenator.circuit.pInt)).toBeLessThan(30)

    // pArt and the gradient are what separate them.
    expect(returnObstruction.circuit.pArt).toBeGreaterThan(280)
    expect(oxygenator.circuit.pArt).toBeLessThan(240)
    expect(oxygenator.circuit.deltaP).toBeGreaterThan(returnObstruction.circuit.deltaP * 3)

    // Obstruction is downstream of the membrane, so its gradient still just tracks flow and does
    // not rise above the reference circuit's — which is what the authored scenario text claims.
    const reference = createReferenceSimulationState('vv-reference')
    expect(returnObstruction.circuit.deltaP).toBeLessThanOrEqual(reference.circuit.deltaP)
  })
})
