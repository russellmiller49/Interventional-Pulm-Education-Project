import { createInitialCrrtSimulationState } from '../initialState'
import { crrtSimulationReducer } from '../reducer'
import type { CrrtScheduledEventDefinition, CrrtSimulationState } from '../types'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

const filterRiskEvent: CrrtScheduledEventDefinition = {
  id: 'synthetic-filter-risk',
  atSeconds: 350,
  jitterSeconds: null,
  action: {
    type: 'SET_FILTER_RISK',
    procoagulantBurdenFraction: 0.4,
    lowEffectiveBloodFlowFraction: 0.2,
  },
  reviewStatus: 'pending',
  sourceIds: ['TEST-P2-001'],
}

function startedState(): CrrtSimulationState {
  return crrtSimulationReducer(
    createInitialCrrtSimulationState({ fixture: createSyntheticFixture([filterRiskEvent]) }),
    { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
  )
}

function advanceRepeated(state: CrrtSimulationState, seconds: number, count: number) {
  let next = state
  for (let index = 0; index < count; index += 1) {
    next = crrtSimulationReducer(next, { type: 'ADVANCE_TIME', seconds })
  }
  return next
}

function expectEquivalent(left: CrrtSimulationState, right: CrrtSimulationState) {
  expect(left.simulationTimeSeconds).toBe(right.simulationTimeSeconds)
  expect(left.deliveredTherapy.cumulativeActualEffluentMl).toBeCloseTo(
    right.deliveredTherapy.cumulativeActualEffluentMl,
    10,
  )
  expect(left.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl).toBeCloseTo(
    right.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl,
    10,
  )
  expect(left.deliveredTherapy.cumulativeWholePatientBalanceMl).toBeCloseTo(
    right.deliveredTherapy.cumulativeWholePatientBalanceMl,
    10,
  )
  expect(left.circuit.filter.foulingBurdenFraction).toBeCloseTo(
    right.circuit.filter.foulingBurdenFraction,
    10,
  )
  expect(left.circuit.filter.clotBurdenFraction).toBeCloseTo(
    right.circuit.filter.clotBurdenFraction,
    10,
  )
  expect(left.circuit.pressures).toEqual(right.circuit.pressures)
  expect(left.scenario.appliedEventIds).toEqual(right.scenario.appliedEventIds)
  expect(left.trends).toHaveLength(right.trends.length)
  for (let index = 0; index < left.trends.length; index += 1) {
    const leftTrend = left.trends[index]
    const rightTrend = right.trends[index]
    expect(leftTrend.timeSeconds).toBe(rightTrend.timeSeconds)
    expect(leftTrend.cumulativeActualEffluentMl).toBeCloseTo(
      rightTrend.cumulativeActualEffluentMl,
      8,
    )
    expect(leftTrend.cumulativeMachinePatientFluidRemovalMl).toBeCloseTo(
      rightTrend.cumulativeMachinePatientFluidRemovalMl,
      8,
    )
    expect(leftTrend.cumulativeWholePatientBalanceMl).toBeCloseTo(
      rightTrend.cumulativeWholePatientBalanceMl,
      8,
    )
    expect(leftTrend.foulingBurdenFraction).toBeCloseTo(rightTrend.foulingBurdenFraction, 8)
    expect(leftTrend.clotBurdenFraction).toBeCloseTo(rightTrend.clotBurdenFraction, 8)
  }
  if (left.patient.status === 'configured' && right.patient.status === 'configured') {
    expect(left.patient.hemodynamicStressIndex).toBeCloseTo(
      right.patient.hemodynamicStressIndex,
      10,
    )
    expect(left.patient.solutes.potassium?.concentrationPerLiter).toBeCloseTo(
      right.patient.solutes.potassium?.concentrationPerLiter ?? Number.NaN,
      10,
    )
  }
}

describe('CRRT canonical time advancement', () => {
  it('makes 60 one-minute, four 15-minute, and one one-hour advance equivalent', () => {
    const minuteSteps = advanceRepeated(startedState(), 60, 60)
    const fifteenMinuteSteps = advanceRepeated(startedState(), 15 * 60, 4)
    const oneHour = advanceRepeated(startedState(), 60 * 60, 1)

    expectEquivalent(minuteSteps, fifteenMinuteSteps)
    expectEquivalent(minuteSteps, oneHour)
    expect(oneHour.deliveredTherapy.cumulativeActualEffluentMl).toBeCloseTo(1_100, 10)
    expect(oneHour.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl).toBeCloseTo(100, 10)
    expect(oneHour.deliveredTherapy.cumulativeWholePatientBalanceMl).toBeCloseTo(0, 10)
    expect(oneHour.trends).toHaveLength(12)
    expect(oneHour.trends.at(-1)).toMatchObject({
      prescribedEffluentDoseMlKgHour: oneHour.deliveredTherapy.prescribedEffluentDoseMlKgHour,
      deliveredDoseMlKgHour: oneHour.deliveredTherapy.deliveredDoseMlKgHour,
      soluteConcentrationsPerLiter: {
        potassium:
          oneHour.patient.status === 'configured'
            ? oneHour.patient.solutes.potassium?.concentrationPerLiter
            : undefined,
      },
    })
  })

  it('uses actual delivery for dose and keeps external inputs running through downtime', () => {
    let continuous = startedState()
    continuous = crrtSimulationReducer(continuous, { type: 'ADVANCE_TIME', seconds: 3600 })

    let interrupted = startedState()
    interrupted = crrtSimulationReducer(interrupted, { type: 'ADVANCE_TIME', seconds: 1800 })
    interrupted = crrtSimulationReducer(interrupted, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'paused',
    })
    interrupted = crrtSimulationReducer(interrupted, { type: 'ADVANCE_TIME', seconds: 1800 })

    expect(interrupted.deliveredTherapy.cumulativeDowntimeSeconds).toBe(1800)
    expect(interrupted.deliveredTherapy.downtimeSecondsByReason.paused).toBe(1800)
    expect(interrupted.deliveredTherapy.cumulativeActualEffluentMl).toBeCloseTo(
      continuous.deliveredTherapy.cumulativeActualEffluentMl / 2,
      10,
    )
    expect(interrupted.deliveredTherapy.deliveredDoseMlKgHour).toBeCloseTo(
      (continuous.deliveredTherapy.deliveredDoseMlKgHour ?? 0) / 2,
      10,
    )
    expect(interrupted.deliveredTherapy.cumulativeWholePatientBalanceMl).toBeCloseTo(50, 10)
  })
})
