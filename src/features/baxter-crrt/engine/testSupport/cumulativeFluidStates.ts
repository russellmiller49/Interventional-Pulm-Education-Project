/**
 * States for reviewing the cumulative-fluid attribution gate.
 *
 * The shipped pilot fixtures all hold makeup at zero and none of them carries a
 * makeup bag, so the defect this gate closes is unreachable from them. These
 * states add one makeup bag to CRRT-10 — a bag, not a new physiology — because
 * the coupled-delivery check requires exactly one connected bag per active
 * term. Without it a nonzero makeup rate drives the whole circuit's delivery
 * fraction to zero and nothing is delivered at all, which is a different state
 * from makeup actually having been carried.
 *
 * Nothing here changes an engine calculation. Every value is produced by the
 * real reducer.
 */
import {
  advanceCrrt,
  crrtSteadyFixture,
  loadCrrtFixture,
  startCrrtTherapy,
} from '../../livePressureStationModel'
import { crrtSimulationReducer } from '../reducer'
import type {
  BagState,
  ConfiguredPrescriptionState,
  CrrtEngineFixture,
  CrrtSimulationState,
} from '../types'

export const CRRT_REVIEW_MAKEUP_FLOW_ML_HOUR = 100

function makeupBag(): BagState {
  const source = (crrtSteadyFixture.bags ?? []).find((bag) => bag.flowTerm === 'dialysate')
  if (!source)
    throw new Error('CRRT-10 no longer carries a dialysate bag to model a makeup bag on.')
  return Object.freeze({
    ...source,
    id: 'review-makeup-bag',
    label: 'Makeup',
    flowTerm: 'makeup' as const,
    direction: 'source' as const,
    capacityMl: 5_000,
    calculatedVolumeMl: 5_000,
    measuredVolumeMl: 5_000,
    cumulativePumpVolumeMl: 0,
  })
}

/** CRRT-10 with a makeup bag installed and nothing else changed. */
export function crrtFixtureWithMakeupBag(): CrrtEngineFixture {
  return {
    ...crrtSteadyFixture,
    bags: [...(crrtSteadyFixture.bags ?? []), makeupBag()],
  }
}

export function withCrrtMakeupFlow(
  state: CrrtSimulationState,
  makeupFlowMlHour: number,
): CrrtSimulationState {
  const prescription = state.prescription
  if (prescription.status !== 'configured') return state
  const next: ConfiguredPrescriptionState = {
    ...prescription,
    flows: { ...prescription.flows, makeupFlowMlHour },
  }
  return crrtSimulationReducer(state, { type: 'SET_PRESCRIPTION', prescription: next })
}

/** A clean run on the same fixture, with the makeup bag installed but unused. */
export function crrtCleanRunWithMakeupBag(hours = 4): CrrtSimulationState {
  return advanceCrrt(startCrrtTherapy(loadCrrtFixture(crrtFixtureWithMakeupBag())), hours * 3_600)
}

/** Makeup running now. */
export function crrtMakeupRunningState(hours = 2): CrrtSimulationState {
  return advanceCrrt(
    withCrrtMakeupFlow(
      startCrrtTherapy(loadCrrtFixture(crrtFixtureWithMakeupBag())),
      CRRT_REVIEW_MAKEUP_FLOW_ML_HOUR,
    ),
    hours * 3_600,
  )
}

/**
 * The case the rate-based ledger cannot see: makeup was delivered earlier in
 * the run and the setting has since been returned to zero. The cumulative
 * totals still contain the volume accumulated while it was running.
 */
export function crrtPriorMakeupThenZeroState(hours = 2): CrrtSimulationState {
  return advanceCrrt(withCrrtMakeupFlow(crrtMakeupRunningState(), 0), hours * 3_600)
}

/**
 * A nonzero makeup rate with no makeup bag. The coupled-delivery check fails
 * the whole circuit closed, so nothing is delivered — but the rate alone is
 * still enough to withhold.
 */
export function crrtMakeupWithoutBagState(hours = 2): CrrtSimulationState {
  return advanceCrrt(
    withCrrtMakeupFlow(
      startCrrtTherapy(loadCrrtFixture(crrtSteadyFixture)),
      CRRT_REVIEW_MAKEUP_FLOW_ML_HOUR,
    ),
    hours * 3_600,
  )
}

export interface CrrtCumulativeFluidReviewState {
  readonly id: string
  readonly label: string
  readonly expected: 'available' | 'no-case-attached' | 'unresolved-makeup-attribution'
  readonly state: CrrtSimulationState
}

export function crrtCumulativeFluidReviewStates(): readonly CrrtCumulativeFluidReviewState[] {
  return Object.freeze([
    {
      id: 'clean-no-makeup-bag',
      label: 'Ordinary run, no makeup bag',
      expected: 'available' as const,
      state: advanceCrrt(startCrrtTherapy(loadCrrtFixture(crrtSteadyFixture)), 4 * 3_600),
    },
    {
      id: 'clean-with-makeup-bag',
      label: 'Ordinary run, makeup bag installed but never used',
      expected: 'available' as const,
      state: crrtCleanRunWithMakeupBag(),
    },
    {
      id: 'makeup-running',
      label: 'Makeup running now',
      expected: 'unresolved-makeup-attribution' as const,
      state: crrtMakeupRunningState(),
    },
    {
      id: 'prior-makeup-then-zero',
      label: 'Makeup delivered earlier, setting since returned to zero',
      expected: 'unresolved-makeup-attribution' as const,
      state: crrtPriorMakeupThenZeroState(),
    },
    {
      id: 'makeup-rate-without-bag',
      label: 'Makeup rate set with no makeup bag, so nothing is delivered',
      expected: 'unresolved-makeup-attribution' as const,
      state: crrtMakeupWithoutBagState(),
    },
  ])
}
