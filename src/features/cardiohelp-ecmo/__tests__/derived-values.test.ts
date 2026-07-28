import { cardiohelpScenarios } from '../content/scenarios'
import {
  RECIRCULATION_FRACTION,
  createInitialSimulationState,
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
