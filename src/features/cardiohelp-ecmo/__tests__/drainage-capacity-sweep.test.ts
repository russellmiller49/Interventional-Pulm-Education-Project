import {
  DRAINAGE_CAPACITY_LPM,
  calculateNominalCardiohelpBloodFlowLMin,
  createInitialSimulationState,
  ecmoSimulationReducer,
  resolveDrainageLimitation,
} from '../engine'
import type { EcmoSimulationState } from '../engine/types'

/**
 * The drainage-limited faults, swept exhaustively.
 *
 * The model used to multiply the pump curve by a constant while a drainage-limited fault was
 * active, which left displayed flow — and, through it, the modelled patient's saturation — rising
 * with every extra revolution. The reducer charged a critical error for exactly that action, so a
 * learner who tested the reflex watched the patient improve and was scored as though they had
 * harmed them. This suite is the invariant that replaces that arrangement: past the drainage the
 * case can supply, asking for more must never look like it worked.
 *
 * Written in the same shape as the A2 recirculation sweep — every reachable setpoint, both
 * directions, both tracks — because the same class of defect is being excluded.
 */

const SETPOINTS: readonly number[] = Array.from({ length: 26 }, (_, index) => 1000 + index * 160)

/** Every drainage-limited scenario the module authors, across both tracks and both surfaces. */
const DRAINAGE_SCENARIOS: readonly { readonly id: string; readonly fault: string }[] = [
  { id: 'preload-drainage-collapse', fault: 'preload-limited' },
  { id: 'va-preload-drainage-collapse', fault: 'preload-limited' },
  { id: 'clinical-vv-occult-hemorrhage', fault: 'hemorrhagic-hypovolemia' },
  { id: 'clinical-vv-tension-pneumothorax', fault: 'tension-pneumothorax' },
  { id: 'va-clinical-tamponade', fault: 'tamponade' },
]

/** Plausible opening speeds, so nothing depends on the one number a case happens to author. */
const OPENING_RPMS: readonly number[] = [2600, 3000, 3200, 3600, 4000]

function settle(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let current = state
  for (let tick = 0; tick < seconds; tick += 1) {
    current = ecmoSimulationReducer(current, { type: 'STEP' })
  }
  return current
}

/**
 * The state a speed produces, settled, with the clock left where every sample shares it.
 *
 * Sharing the settled time matters: the instability term is a function of the modelled clock, so
 * two samples taken at different times differ by up to 0.42 L/min for reasons that have nothing to
 * do with the speed being compared.
 */
function atSpeed(scenarioId: string, rpm: number, seconds = 12): EcmoSimulationState {
  const opening = createInitialSimulationState(scenarioId, 'guided')
  return settle(ecmoSimulationReducer(opening, { type: 'SET_RPM', rpm }), seconds)
}

describe('the drainage-capacity model', () => {
  it.each(DRAINAGE_SCENARIOS)('$id authors a capacity the pump curve can exceed', ({ id }) => {
    const state = createInitialSimulationState(id, 'guided')
    const limitation = resolveDrainageLimitation(state, state.device.rpmSetpoint)
    expect(limitation).not.toBeNull()
    if (!limitation) return
    // The case has to open past its own capacity or there is no collapse to teach.
    expect(limitation.limited).toBe(true)
    expect(limitation.capacityLpm).toBeGreaterThan(0)
    expect(limitation.capacityLpm).toBeLessThan(limitation.demandedLpm)
  })

  it('takes the capacity a case authors over the fault default', () => {
    const state = createInitialSimulationState('preload-drainage-collapse', 'guided')
    const withoutOverride = resolveDrainageLimitation(state, 3600)
    expect(withoutOverride?.capacityLpm).toBe(DRAINAGE_CAPACITY_LPM['preload-limited'])

    const authored: EcmoSimulationState = {
      ...state,
      scenario: { ...state.scenario, drainageCapacityLpm: 2.2 },
    }
    expect(resolveDrainageLimitation(authored, 3600)?.capacityLpm).toBe(2.2)
  })

  it('reports no limitation at all when no drainage-limited fault is active', () => {
    const state = createInitialSimulationState('vv-recirculation', 'guided')
    expect(resolveDrainageLimitation(state, 5000)).toBeNull()
  })
})

describe('above the modelled drainage limit, asking for more never looks like it worked', () => {
  it.each(DRAINAGE_SCENARIOS)(
    '$id: flow, oxygenation, suction and chatter all move the honest way across every setpoint',
    ({ id }) => {
      const samples = SETPOINTS.map((rpm) => ({ rpm, state: atSpeed(id, rpm) })).filter(
        ({ rpm, state }) => resolveDrainageLimitation(state, rpm)?.limited,
      )
      expect(samples.length).toBeGreaterThan(4)

      for (let index = 1; index < samples.length; index += 1) {
        const lower = samples[index - 1]
        const higher = samples[index]
        const where = `${id} ${lower.rpm} → ${higher.rpm} rpm`

        // Flow does not increase. Asserted through the label so a failure names the pair.
        expect(`${where}: flow ${higher.state.circuit.bloodFlow}`).toBe(
          `${where}: flow ${Math.min(higher.state.circuit.bloodFlow, lower.state.circuit.bloodFlow)}`,
        )

        // The modelled patient does not improve for it.
        expect(higher.state.patient.spo2).toBeLessThanOrEqual(lower.state.patient.spo2)

        // Suction becomes no less negative.
        expect(higher.state.circuit.pVen).toBeLessThanOrEqual(lower.state.circuit.pVen)

        // Chatter persists or appears; it never resolves by pulling harder.
        if (lower.state.circuit.drainageChatter) {
          expect(higher.state.circuit.drainageChatter).toBe(true)
        }
      }
    },
  )

  it.each(DRAINAGE_SCENARIOS)(
    '$id: the mechanism-specific guard fires from every plausible opening speed, in the raising direction only',
    ({ id }) => {
      let compared = 0
      for (const opening of OPENING_RPMS) {
        const base = ecmoSimulationReducer(createInitialSimulationState(id, 'guided'), {
          type: 'SET_RPM',
          rpm: opening,
        })
        // A case may clamp the setpoint it will accept, so the speed actually reached is read back
        // rather than assumed — and a base that is already charged cannot show whether the next
        // move charged again, because the error list de-duplicates by id.
        if (base.scenario.criticalErrors.includes('rpm-during-collapse')) continue
        const baseRpm = base.device.rpmSetpoint

        for (const rpm of SETPOINTS) {
          const next = ecmoSimulationReducer(base, { type: 'SET_RPM', rpm })
          const reachedRpm = next.device.rpmSetpoint
          const charged = next.scenario.criticalErrors.includes('rpm-during-collapse')
          const raising = reachedRpm > baseRpm
          const pastCapacity = resolveDrainageLimitation(base, reachedRpm)?.limited ?? false
          const where = `${id} ${baseRpm} → ${reachedRpm} rpm`
          compared += 1

          if (raising && pastCapacity) {
            expect(`${where}: charged=${charged}`).toBe(`${where}: charged=true`)
          } else {
            // Never charged for holding, for backing off, or for coming back up inside what the
            // drainage can actually supply.
            expect(`${where}: charged=${charged}`).toBe(`${where}: charged=false`)
          }
        }
      }
      expect(compared).toBeGreaterThan(20)
    },
  )
})

describe('reducing speed toward the supported range is the taught direction', () => {
  it.each(DRAINAGE_SCENARIOS)(
    '$id: backing off relieves the suction, steadies the flow, and costs nothing',
    ({ id }) => {
      const opening = createInitialSimulationState(id, 'guided')
      const openingRpm = opening.device.rpmSetpoint
      const before = settle(opening, 12)

      const reduced = atSpeed(id, Math.max(1000, openingRpm - 300))
      expect(reduced.scenario.criticalErrors).not.toContain('rpm-during-collapse')
      // Flow rises rather than falls, because less of it is being lost to the collapse.
      expect(reduced.circuit.bloodFlow).toBeGreaterThan(before.circuit.bloodFlow)
      // And the suction relaxes.
      expect(reduced.circuit.pVen).toBeGreaterThan(before.circuit.pVen)
    },
  )

  it('moves the authored 3600 to 3300 action in the taught direction on both tracks', () => {
    for (const id of ['preload-drainage-collapse', 'va-preload-drainage-collapse']) {
      const before = atSpeed(id, 3600)
      const after = atSpeed(id, 3300)
      expect(after.circuit.bloodFlow).toBeGreaterThan(before.circuit.bloodFlow)
      expect(after.circuit.pVen).toBeGreaterThan(before.circuit.pVen)
      expect(after.scenario.criticalErrors).not.toContain('rpm-during-collapse')
    }
  })

  it('relieves the chatter once demand comes back inside the drainage', () => {
    const collapsing = atSpeed('preload-drainage-collapse', 3600)
    expect(collapsing.circuit.drainageChatter).toBe(true)

    const capacity = DRAINAGE_CAPACITY_LPM['preload-limited']
    // A speed whose demand sits inside the capacity: there is nothing being drawn shut.
    const withinRpm = SETPOINTS.filter(
      (rpm) => calculateNominalCardiohelpBloodFlowLMin(rpm) <= capacity,
    ).at(-1)
    expect(withinRpm).toBeDefined()
    const supported = atSpeed('preload-drainage-collapse', withinRpm ?? 2400)
    expect(supported.circuit.drainageChatter).toBe(false)
    expect(supported.scenario.criticalErrors).not.toContain('rpm-during-collapse')
  })

  it('leaves the underlying fault active until the cause itself is corrected', () => {
    // Backing the pump off is a holding action, and the model must not let it read as a cure.
    const reduced = atSpeed('preload-drainage-collapse', 2400)
    expect(reduced.scenario.activeFaults).toContain('preload-limited')
    expect(reduced.scenario.correctedFaults).not.toContain('preload-limited')

    const corrected = settle(
      ecmoSimulationReducer(reduced, { type: 'CORRECT_FAULT', fault: 'preload-limited' }),
      12,
    )
    expect(corrected.scenario.correctedFaults).toContain('preload-limited')
    expect(resolveDrainageLimitation(corrected, corrected.device.rpmSetpoint)).toBeNull()
  })
})

describe('the correction does not reach the recirculation model', () => {
  it('leaves the A2 behaviour exactly as it was: displayed flow up, effective flow down', () => {
    const opening = atSpeed('vv-recirculation', 3800)
    const escalated = atSpeed('vv-recirculation', 4600)
    expect(escalated.circuit.bloodFlow).toBeGreaterThan(opening.circuit.bloodFlow)
    expect(escalated.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
      opening.circuit.recirculationAdjustedCircuitFlowLpm,
    )
    expect(escalated.scenario.criticalErrors).toContain('rpm-during-recirculation')
    // And recirculation is never mislabelled as a drainage collapse.
    expect(escalated.scenario.criticalErrors).not.toContain('rpm-during-collapse')
  })
})
