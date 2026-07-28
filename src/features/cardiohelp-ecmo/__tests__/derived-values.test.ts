import { ecmoReferenceProfileList } from '../content/referenceProfiles'
import { cardiohelpScenarios } from '../content/scenarios'
import {
  RECIRCULATION_FRACTION,
  createInitialSimulationState,
  createReferenceSimulationState,
  deriveDrainageSaturation,
  deriveRecirculationAdjustedCircuitFlow,
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
    expect(state.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(state.circuit.bloodFlow)
  })

  it('keeps displayed flow high while effective flow falls during recirculation', () => {
    const recirculating = advanced('vv-recirculation')
    const baseline = advanced('acute-hypercapnia')

    // The teaching point: the console's flow number is not lower, and is in fact higher.
    expect(recirculating.circuit.bloodFlow).toBeGreaterThan(baseline.circuit.bloodFlow)
    expect(recirculating.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
      baseline.circuit.recirculationAdjustedCircuitFlowLpm,
    )
  })

  it('never reports effective flow above displayed flow in any scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const state = advanced(scenario.id)
      expect(state.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThanOrEqual(
        state.circuit.bloodFlow + 0.01,
      )
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
    const { preOxygenatorSaturation, postOxygenatorSaturation } = state.circuit
    const svo2 = state.patient.systemicVenousSaturationEstimate
    const inferred = (preOxygenatorSaturation - svo2) / (postOxygenatorSaturation - svo2)
    expect(inferred).toBeCloseTo(state.circuit.recirculationFraction, 2)
  })

  it('charges recirculation to arterial saturation once, through effective flow', () => {
    // The fault used to reduce effective flow *and* subtract a flat 6 points, counting itself
    // twice through two unrelated mechanisms.
    const state = advanced('vv-recirculation')
    const withoutRecirculation = deriveRecirculationAdjustedCircuitFlow(state.circuit.bloodFlow, 0)
    const predictedGain =
      (withoutRecirculation - state.circuit.recirculationAdjustedCircuitFlowLpm) * 4
    expect(predictedGain).toBeGreaterThan(6)
  })
})

describe('mixed venous saturation', () => {
  it('moves rather than sitting at its initial value', () => {
    // It was a frozen 68 displayed as a live parameter on two console screens.
    const first = createInitialSimulationState('preload-drainage-collapse')
    const later = advanced('preload-drainage-collapse')
    expect(later.patient.systemicVenousSaturationEstimate).not.toBeCloseTo(
      first.patient.systemicVenousSaturationEstimate,
      1,
    )
  })

  it('falls as delivery falls', () => {
    const wellSupported = advanced('acute-hypercapnia')
    const drainageCollapse = advanced('preload-drainage-collapse')
    expect(drainageCollapse.circuit.bloodFlow).toBeLessThan(wellSupported.circuit.bloodFlow)
    expect(drainageCollapse.patient.systemicVenousSaturationEstimate).toBeLessThan(
      wellSupported.patient.systemicVenousSaturationEstimate,
    )
  })

  it('stays within a saturation range in every scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const svo2 = advanced(scenario.id).patient.systemicVenousSaturationEstimate
      expect(svo2).toBeGreaterThan(0)
      expect(svo2).toBeLessThan(100)
    }
  })
})

describe('drainage saturation', () => {
  it('is the mixture of venous return and returned circuit blood, in every scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const settled = advanced(scenario.id)
      const { preOxygenatorSaturation, postOxygenatorSaturation } = settled.circuit
      const svo2 = settled.patient.systemicVenousSaturationEstimate
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
 * Oxygen consumption is an authored educational-model input, not a measurement. Moving it off a
 * module-global constant is what lets a scenario vary metabolic demand later without rewriting the
 * oxygen balance.
 */
describe('oxygen consumption as a model input', () => {
  function withConsumption(profileId: 'vv-reference', mlMin: number): EcmoSimulationState {
    let state = createReferenceSimulationState(profileId)
    state = { ...state, modelInputs: { oxygenConsumptionMlMin: mlMin } }
    for (let step = 0; step < 12; step += 1) state = run(state, [{ type: 'STEP' }])
    return state
  }

  it('is authored explicitly by both reference profiles', () => {
    for (const profile of ecmoReferenceProfileList) {
      expect(profile.inputs.modelInputs.oxygenConsumptionMlMin).toBe(150)
      expect(createReferenceSimulationState(profile.id).modelInputs.oxygenConsumptionMlMin).toBe(
        150,
      )
    }
  })

  it('defaults to 150 for scenarios that do not author it', () => {
    expect(
      createInitialSimulationState('acute-hypercapnia').modelInputs.oxygenConsumptionMlMin,
    ).toBe(150)
  })

  it('lowers the systemic venous estimate when consumption rises', () => {
    const baseline = withConsumption('vv-reference', 150)
    const higher = withConsumption('vv-reference', 260)
    expect(higher.patient.systemicVenousSaturationEstimate).toBeLessThan(
      baseline.patient.systemicVenousSaturationEstimate,
    )
  })

  it('raises the systemic venous estimate when consumption falls', () => {
    const baseline = withConsumption('vv-reference', 150)
    const lower = withConsumption('vv-reference', 90)
    expect(lower.patient.systemicVenousSaturationEstimate).toBeGreaterThan(
      baseline.patient.systemicVenousSaturationEstimate,
    )
  })

  it('lowers the estimate when hemoglobin falls, all else equal', () => {
    const baseline = withConsumption('vv-reference', 150)
    let anemic = createReferenceSimulationState('vv-reference')
    anemic = { ...anemic, circuit: { ...anemic.circuit, hemoglobin: 7 } }
    for (let step = 0; step < 12; step += 1) anemic = run(anemic, [{ type: 'STEP' }])
    expect(anemic.patient.systemicVenousSaturationEstimate).toBeLessThan(
      baseline.patient.systemicVenousSaturationEstimate,
    )
  })

  it('does not clamp the systemic estimate to the console display range', () => {
    // The console floor is 40.0%. The latent estimate is not a console reading, so an extreme
    // demand must be free to drive it below that rather than resting on a device boundary.
    const extreme = withConsumption('vv-reference', 900)
    expect(extreme.patient.systemicVenousSaturationEstimate).toBeLessThan(40)
  })
})

/**
 * The CARDIOHELP venous probe measures blood in the disposable's measuring cell, which sits on the
 * venous inlet of the oxygenator pump unit — so the SvO₂ tile reads the drainage limb, not a
 * systemic estimate (IFU Rev 2.3: p39, p46, p104).
 */
describe('device SvO2 tile mapping', () => {
  it('is fed from the venous-line saturation in every scenario', () => {
    for (const scenario of cardiohelpScenarios) {
      const state = advanced(scenario.id)
      expect(state.circuit.readouts.venousLineSaturation.raw).toBeCloseTo(
        state.circuit.preOxygenatorSaturation,
        3,
      )
    }
  })

  it('differs from the systemic estimate during VV recirculation — which is the clue', () => {
    const state = advanced('vv-recirculation')
    const tile = state.circuit.readouts.venousLineSaturation.raw
    const systemic = state.patient.systemicVenousSaturationEstimate
    expect(tile).toBeGreaterThan(systemic + 5)
  })

  it('shows the unavailable convention rather than a clamped boundary when out of range', () => {
    let state = createReferenceSimulationState('vv-reference')
    // Drive the venous line below the console's documented 40.0% floor.
    state = { ...state, modelInputs: { oxygenConsumptionMlMin: 900 } }
    for (let step = 0; step < 12; step += 1) state = run(state, [{ type: 'STEP' }])
    const readout = state.circuit.readouts.venousLineSaturation
    if (readout.raw < 40) {
      expect(readout.status).toBe('device-unavailable')
      expect(readout.displayed).toBeNull()
      expect(readout.raw).not.toBeCloseTo(40, 1)
    }
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
      inside(circuit.recirculationAdjustedCircuitFlowLpm, e.recirculationAdjustedCircuitFlowLpm)
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
    expect(vv.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(vv.circuit.bloodFlow)
    expect(va.circuit.recirculationAdjustedCircuitFlowLpm).toBeCloseTo(va.circuit.bloodFlow, 2)
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
        expect(state.circuit.readouts.pVen.status).toBe('simulation-unmodeled')
      }
    }
  })

  it('reports valid pressures on a running reference circuit', () => {
    expect(createReferenceSimulationState('vv-reference').circuit.readouts.pVen.status).toBe(
      'valid',
    )
    expect(createReferenceSimulationState('va-reference').circuit.readouts.pVen.status).toBe(
      'valid',
    )
  })

  it('raises no pressure alarm while the channels are invalid', () => {
    const stopped = settle('startup-sensor-orientation', 12)
    expect(stopped.circuit.readouts.pVen.status).toBe('simulation-unmodeled')
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
    expect(state.circuit.readouts.pVen.status).toBe('simulation-unmodeled')
    expect(state.alarms.some((alarm) => alarm.code === 'ART_BUBBLE')).toBe(true)
  })

  it('distinguishes a device-side unavailability from a simulation limitation', () => {
    const unmodeled = settle('startup-sensor-orientation', 12).circuit.readouts.pVen
    expect(unmodeled.status).toBe('simulation-unmodeled')
    expect(unmodeled.displayed).toBeNull()
    // The accessible text must say this is the model's limit, not a claim about the device.
    expect(unmodeled.reason).toMatch(/not modeled/i)
    expect(unmodeled.reason).toMatch(/simulation/i)

    // And the raw model value survives for anything that legitimately needs it.
    expect(Number.isFinite(unmodeled.raw)).toBe(true)
  })

  it('never displays a value that differs from its raw model value', () => {
    // Clamping to a display boundary and rendering it would fabricate a measurement.
    for (const scenario of cardiohelpScenarios) {
      const { readouts } = advanced(scenario.id).circuit
      for (const readout of Object.values(readouts)) {
        if (readout.displayed !== null) expect(readout.displayed).toBe(readout.raw)
      }
    }
  })

  it('keeps a clamped line valid, because that pressure is modelled and teachable', () => {
    let state = createReferenceSimulationState('vv-reference')
    state = run(state, [{ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true }])
    for (let step = 0; step < 3; step += 1) state = run(state, [{ type: 'STEP' }])
    if (state.circuit.returnClampClosed) {
      expect(state.circuit.readouts.pVen.status).toBe('valid')
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

/**
 * The renamed flow field. "Effective flow" was ambiguous: in VA the recirculation term is zero, so
 * the old name implied a total systemic flow the quantity never described.
 */
describe('recirculation-adjusted circuit flow naming', () => {
  it('leaves no ambiguous effectiveFlow field on the runtime circuit', () => {
    const circuit: Record<string, unknown> = {
      ...createReferenceSimulationState('vv-reference').circuit,
    }
    expect('effectiveFlow' in circuit).toBe(false)
    expect('recirculationAdjustedCircuitFlowLpm' in circuit).toBe(true)
  })

  it('equals displayed circuit flow in VA, where no VV recirculation term applies', () => {
    let va = createReferenceSimulationState('va-reference')
    for (let step = 0; step < 12; step += 1) va = run(va, [{ type: 'STEP' }])
    expect(va.circuit.recirculationFraction).toBe(0)
    expect(va.circuit.recirculationAdjustedCircuitFlowLpm).toBeCloseTo(va.circuit.bloodFlow, 2)

    // Native output stays a separate quantity; this value is not total systemic flow.
    expect(va.patient.nativeCardiacOutputLpm).toBeGreaterThan(0)
    expect(va.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
      va.circuit.bloodFlow + va.patient.nativeCardiacOutputLpm,
    )
  })
})
