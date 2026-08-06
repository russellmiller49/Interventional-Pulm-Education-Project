/**
 * Representative engine states for reviewing the live pressure profile.
 *
 * Every state here is produced by the real reducer from an authored fixture.
 * Nothing is hand-written: no pressure is typed in, no fault is invented to
 * make a review table look complete, and where the engine cannot reach a state
 * this module says so rather than fabricating one.
 *
 * Shared by the pressure-profile tests, `dump-crrt-numbers.ts`, and
 * `render-crrt-live-pressure-device.ts` so all three review the same states.
 */
import { baxterCrrtPilotFixtures } from '../../content/pilotCases'
import { createInitialCrrtSimulationState } from '../initialState'
import { crrtSimulationReducer } from '../reducer'
import { applyScheduledEventAction, recomputeCrrtDerivedState } from '../simulation'
import type { ConfiguredPrescriptionState, CrrtEngineFixture, CrrtSimulationState } from '../types'

function requireFixture(id: string): CrrtEngineFixture {
  const fixture = baxterCrrtPilotFixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`Unknown CRRT pilot fixture: ${id}`)
  return fixture
}

/**
 * CRRT-10 runs at 120 mL/min and schedules nothing that touches a pressure, so
 * it is the only fixture that gives an unchanged baseline to compare against.
 */
export const steadyFixture: CrrtEngineFixture = requireFixture('CRRT-10')

/**
 * CRRT-13 is the authored access case: at 1 800 s it raises access resistance
 * and flags an access obstruction. Reaching the changed-access state by running
 * this fixture past its own event beats injecting a resistance by hand.
 */
export const authoredAccessFixture: CrrtEngineFixture = requireFixture('CRRT-13')

export function loadFixture(fixture: CrrtEngineFixture = steadyFixture): CrrtSimulationState {
  return crrtSimulationReducer(createInitialCrrtSimulationState(), {
    type: 'LOAD_FIXTURE',
    fixture,
    experience: 'orientation',
    roleLens: 'integrated',
    attempt: 1,
  })
}

export function start(state: CrrtSimulationState): CrrtSimulationState {
  return crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
}

export function advance(state: CrrtSimulationState, seconds: number): CrrtSimulationState {
  return crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds })
}

/** Re-prescribes at a different blood flow, changing nothing else. */
export function withBloodFlow(
  state: CrrtSimulationState,
  bloodFlowMlMin: number,
): CrrtSimulationState {
  const prescription = state.prescription
  if (prescription.status !== 'configured') return state
  const next: ConfiguredPrescriptionState = {
    ...prescription,
    flows: { ...prescription.flows, bloodFlowMlMin },
  }
  return crrtSimulationReducer(state, { type: 'SET_PRESCRIPTION', prescription: next })
}

/** A running case with a real recorded history behind it. */
export function runningState(hours = 4): CrrtSimulationState {
  return advance(start(loadFixture(steadyFixture)), hours * 3_600)
}

export interface CrrtLivePressureReviewState {
  readonly id: string
  readonly label: string
  /** What a reviewer should be checking in this state. */
  readonly focus: string
  readonly state: CrrtSimulationState
}

/**
 * The states the engine can actually reach. Two of the states a full review
 * would want do not exist in this model and are named in
 * `crrtLivePressureModelBoundaries` instead of being faked.
 */
export function crrtLivePressureReviewStates(): readonly CrrtLivePressureReviewState[] {
  const running = runningState()
  const higherFlow = advance(withBloodFlow(running, 180), 1_800)

  return Object.freeze([
    {
      id: 'stable-running',
      label: 'Stable running therapy',
      focus:
        'Four sites and two relationships, all live. Recorded history is present for access, filter, return, and TMP only.',
      state: running,
    },
    {
      id: 'higher-blood-flow',
      label: 'Same circuit at a higher blood flow',
      focus:
        'Blood flow 120 to 180 mL/min with no new obstruction. Pressures move; nothing here is a fault.',
      state: higherFlow,
    },
    {
      id: 'changed-access-pattern',
      label: 'Changed access pattern',
      focus:
        'The authored access case run past its own event at 30 minutes. Access pressure moves furthest; the profile localises it there rather than at the filter.',
      state: advance(start(loadFixture(authoredAccessFixture)), 4 * 3_600),
    },
    {
      id: 'increasing-filter-burden',
      label: 'Increasing filter burden',
      focus: 'Fouling and clot burden accumulate over time, widening the filter pressure drop.',
      state: advance(
        applyScheduledEventAction(start(loadFixture(steadyFixture)), {
          type: 'SET_FILTER_RISK',
          procoagulantBurdenFraction: 1,
          lowEffectiveBloodFlowFraction: 1,
        }),
        12 * 3_600,
      ),
    },
    {
      id: 'changed-return-pattern',
      label: 'Changed return pattern',
      focus: 'Return resistance rises. Return, filter, TMP and the drop all move together.',
      state: recomputeCrrtDerivedState(
        applyScheduledEventAction(running, {
          type: 'SET_RETURN_RESISTANCE',
          resistanceMmHgPerMlMin: 1.2,
        }),
      ),
    },
    {
      id: 'changed-effluent-pattern',
      label: 'Changed effluent pattern',
      focus:
        'Effluent pressure is an authored observation, not a flow-derived value. Changing it moves TMP and leaves the drop alone.',
      state: recomputeCrrtDerivedState(
        applyScheduledEventAction(running, {
          type: 'SET_OBSERVED_EFFLUENT_PRESSURE',
          pressureMmHg: 40,
        }),
      ),
    },
    {
      id: 'stopped-therapy',
      label: 'Stopped therapy',
      focus:
        'The engine keeps publishing zero-flow reference values. The surface must say the pump is stopped rather than present these as live readings.',
      state: crrtSimulationReducer(running, {
        type: 'SET_DELIVERY_STATE',
        deliveryState: 'paused',
      }),
    },
    {
      id: 'no-pressure-model',
      label: 'No pressure model loaded',
      focus: 'All six unavailable together, with a stated reason. None of them may render as zero.',
      state: createInitialCrrtSimulationState(),
    },
  ])
}

/**
 * States a reviewer might expect that this engine genuinely cannot produce.
 * Recorded here so the gap is reported rather than simulated.
 */
export const crrtLivePressureModelBoundaries: readonly string[] = Object.freeze([
  'A single unavailable direct pressure. `derivePressures` writes all six pressures together, so unavailability is always whole-model. There is no per-transducer fault in this engine and none is invented.',
  'A withheld calculated relationship while its input sites still read. TMP and filter pressure drop are computed whenever filter, return, and effluent are present, and all six go null together otherwise. The withholding this module does have is the fluid ledger under an unresolved makeup attribution, which the universal circuit already renders.',
  'Recorded history for effluent pressure or filter pressure drop. `TrendSample` carries access, filter, return, and TMP only, so those two channels are current values with no series behind them.',
])
