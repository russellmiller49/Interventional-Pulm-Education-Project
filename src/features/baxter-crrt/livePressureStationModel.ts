/**
 * The states behind the live pressure profile.
 *
 * Every number the learner sees is produced by running the real engine over an
 * authored fixture. Nothing is typed in. The two blood-flow settings exist so a
 * learner can watch pressures move without anything obstructing: same case,
 * same access, same filter, same fluids, one changed pump setting.
 *
 * CRRT-10 is the fixture because it is the only pilot case that schedules
 * nothing touching a pressure, so a comparison across it is genuinely a
 * comparison of one variable.
 */
import { baxterCrrtPilotFixtures } from './content/pilotCases'
import { createInitialCrrtSimulationState } from './engine/initialState'
import { crrtSimulationReducer } from './engine/reducer'
import type {
  ConfiguredPrescriptionState,
  CrrtEngineFixture,
  CrrtSimulationState,
} from './engine/types'

export function requireCrrtPilotFixture(id: string): CrrtEngineFixture {
  const fixture = baxterCrrtPilotFixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`Unknown CRRT pilot fixture: ${id}`)
  return fixture
}

/** Runs at 120 mL/min and schedules no pressure event. */
export const crrtSteadyFixture: CrrtEngineFixture = requireCrrtPilotFixture('CRRT-10')

/** Raises access resistance and flags an access obstruction at 1 800 s. */
export const crrtAuthoredAccessFixture: CrrtEngineFixture = requireCrrtPilotFixture('CRRT-13')

export function loadCrrtFixture(
  fixture: CrrtEngineFixture = crrtSteadyFixture,
): CrrtSimulationState {
  return crrtSimulationReducer(createInitialCrrtSimulationState(), {
    type: 'LOAD_FIXTURE',
    fixture,
    experience: 'orientation',
    roleLens: 'integrated',
    attempt: 1,
  })
}

export function startCrrtTherapy(state: CrrtSimulationState): CrrtSimulationState {
  return crrtSimulationReducer(state, { type: 'SET_DELIVERY_STATE', deliveryState: 'running' })
}

export function advanceCrrt(state: CrrtSimulationState, seconds: number): CrrtSimulationState {
  return crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds })
}

/** Re-prescribes at a different blood flow, changing nothing else. */
export function withCrrtBloodFlow(
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

/** A running case carrying a real recorded history. */
export function crrtRunningState(hours = 4): CrrtSimulationState {
  return advanceCrrt(startCrrtTherapy(loadCrrtFixture(crrtSteadyFixture)), hours * 3_600)
}

export const CRRT_STATION_BASE_BLOOD_FLOW_ML_MIN = 120
export const CRRT_STATION_RAISED_BLOOD_FLOW_ML_MIN = 180

export interface CrrtLivePressureStationSetting {
  readonly id: 'baseline' | 'raised'
  readonly label: string
  readonly bloodFlowMlMin: number
  readonly state: CrrtSimulationState
}

/**
 * The two settings the station offers. The raised setting continues the same
 * run rather than starting a second one, so the recorded history carries the
 * change and the learner can see when it happened.
 */
export function crrtLivePressureStationSettings(): readonly CrrtLivePressureStationSetting[] {
  const baseline = crrtRunningState()
  return Object.freeze([
    {
      id: 'baseline' as const,
      label: `Blood flow ${CRRT_STATION_BASE_BLOOD_FLOW_ML_MIN} mL/min`,
      bloodFlowMlMin: CRRT_STATION_BASE_BLOOD_FLOW_ML_MIN,
      state: baseline,
    },
    {
      id: 'raised' as const,
      label: `Blood flow ${CRRT_STATION_RAISED_BLOOD_FLOW_ML_MIN} mL/min`,
      bloodFlowMlMin: CRRT_STATION_RAISED_BLOOD_FLOW_ML_MIN,
      state: advanceCrrt(withCrrtBloodFlow(baseline, CRRT_STATION_RAISED_BLOOD_FLOW_ML_MIN), 3_600),
    },
  ])
}
