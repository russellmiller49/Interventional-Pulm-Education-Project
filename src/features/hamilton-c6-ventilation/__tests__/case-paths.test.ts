import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content'
import {
  advanceSimulation,
  createInitialSimulationState,
  isCaseResolved,
  selectCaseOutcome,
  ventilationSimulationReducer,
  type VentilationAction,
  type VentilationSimulationState,
} from '../engine'

function reduce(
  state: VentilationSimulationState,
  actions: readonly VentilationAction[],
): VentilationSimulationState {
  return actions.reduce(ventilationSimulationReducer, state)
}

function settingActions(caseId: string): VentilationAction[] {
  switch (caseId) {
    case 'MV-01':
      return [{ type: 'SET_CONTROL', control: 'peepCmH2O', value: 10 }]
    case 'MV-02':
      return [{ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 80 }]
    case 'MV-03':
      return [{ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 20 }]
    case 'MV-04':
      return [{ type: 'SET_CONTROL', control: 'ratePerMin', value: 14 }]
    case 'MV-05':
      return [
        { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 8 },
        { type: 'SET_CONTROL', control: 'etsPercent', value: 60 },
        { type: 'SET_CONTROL', control: 'triggerThreshold', value: 1 },
      ]
    case 'MV-06':
      return [
        { type: 'SET_CONTROL', control: 'ratePerMin', value: 10 },
        { type: 'SET_CONTROL', control: 'peakFlowLMin', value: 100 },
      ]
    case 'MV-07':
      return [{ type: 'SET_CONTROL', control: 'triggerThreshold', value: 1 }]
    case 'MV-08':
      return [{ type: 'SET_CONTROL', control: 'triggerThreshold', value: 2 }]
    case 'MV-09':
      return [{ type: 'SET_CONTROL', control: 'etsPercent', value: 20 }]
    case 'MV-10':
      return [
        { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 12 },
        { type: 'SET_CONTROL', control: 'etsPercent', value: 50 },
      ]
    case 'MV-11':
      return [{ type: 'SET_CONTROL', control: 'pRampMs', value: 100 }]
    case 'MV-12':
      return [{ type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 11 }]
    case 'MV-15':
      return [
        { type: 'SET_CONTROL', control: 'pressureSupportCmH2O', value: 11 },
        { type: 'SET_CONTROL', control: 'pRampMs', value: 100 },
      ]
    default:
      return []
  }
}

function branchActions(state: VentilationSimulationState): string[] {
  if (state.caseId === 'MV-05') return ['bronchodilator']
  if (state.caseId === 'MV-08') {
    if (state.branch === 'condensate') return ['inspect-circuit', 'drain-condensate']
    if (state.branch === 'leak') return ['inspect-circuit', 'correct-leak']
    return ['inspect-circuit']
  }
  if (state.caseId === 'MV-13') {
    if (state.branch === 'secretions') return ['inspect-circuit', 'suction-airway']
    if (state.branch === 'hme-or-ett') return ['inspect-circuit', 'remove-hme']
    return ['inspect-circuit', 'bronchodilator']
  }
  return []
}

function performIfAvailable(
  state: VentilationSimulationState,
  interventionId: string,
): VentilationSimulationState {
  const definition = mechanicalVentilationCaseById.get(state.caseId)!
  if (!definition.interventions.some((item) => item.id === interventionId)) return state
  return ventilationSimulationReducer(state, { type: 'PERFORM_INTERVENTION', interventionId })
}

function solve(caseId: string, attempt = 1): VentilationSimulationState {
  const definition = mechanicalVentilationCaseById.get(caseId)!
  let state = createInitialSimulationState(caseId, 'practice', attempt)
  state = ventilationSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    mechanismId: definition.correctMechanismId,
    priorityId: definition.correctPriorityId,
    responseId: definition.correctResponseId,
  })
  state = reduce(state, settingActions(caseId))
  for (const interventionId of branchActions(state)) {
    state = performIfAvailable(state, interventionId)
  }
  for (const interventionId of definition.requiredInterventionIds) {
    state = performIfAvailable(state, interventionId)
  }
  state = performIfAvailable(state, 'communicate-plan')
  for (const interventionId of definition.requiredReassessmentIds) {
    state = performIfAvailable(state, interventionId)
  }
  state = advanceSimulation(state, 600)
  state = ventilationSimulationReducer(state, { type: 'COMMIT_REASSESSMENT' })
  return state
}

describe('HAMILTON-C6 case solvability and branch safety', () => {
  it.each(mechanicalVentilationCases.map((item) => item.id))(
    '%s retains a safe physiologic endpoint and mastery path',
    (caseId) => {
      const definition = mechanicalVentilationCaseById.get(caseId)!
      const state = solve(caseId)
      const outcome = selectCaseOutcome(state, definition)
      expect(isCaseResolved(state, definition)).toBe(true)
      expect(outcome.resolved).toBe(true)
      expect(outcome.criticalErrors).toEqual([])
      expect(outcome.score).toBeGreaterThanOrEqual(80)
      expect(outcome.mastery).toBe(true)
    },
  )

  it('keeps deterministic case-ID/attempt branches reproducible', () => {
    for (const caseId of ['MV-04', 'MV-05', 'MV-08', 'MV-13', 'MV-14']) {
      const first = createInitialSimulationState(caseId, 'practice', 3)
      const replay = createInitialSimulationState(caseId, 'practice', 3)
      expect(replay.seed).toBe(first.seed)
      expect(replay.branch).toBe(first.branch)
      expect(replay.waveforms).toEqual(first.waveforms)
    }
  })

  it.each([1, 2, 3, 4, 5])(
    'keeps MV-08 attempt %i solvable across seeded branch variation',
    (attempt) => {
      const definition = mechanicalVentilationCaseById.get('MV-08')!
      const state = solve('MV-08', attempt)
      expect(isCaseResolved(state, definition)).toBe(true)
    },
  )

  it.each([1, 2, 3, 4, 5])(
    'keeps MV-13 attempt %i solvable across resistance branches',
    (attempt) => {
      const definition = mechanicalVentilationCaseById.get('MV-13')!
      const state = solve('MV-13', attempt)
      expect(isCaseResolved(state, definition)).toBe(true)
      expect(
        state.measurements.peakPressureCmH2O - state.measurements.plateauPressureCmH2O,
      ).toBeLessThanOrEqual(15)
    },
  )

  it('keeps unsafe ventilator and sedation actions harmful', () => {
    const mv06 = mechanicalVentilationCaseById.get('MV-06')!
    let hyperinflated = createInitialSimulationState('MV-06', 'practice')
    hyperinflated = ventilationSimulationReducer(hyperinflated, {
      type: 'COMMIT_PREDICTION',
      mechanismId: mv06.correctMechanismId,
      priorityId: mv06.correctPriorityId,
      responseId: mv06.correctResponseId,
    })
    hyperinflated = ventilationSimulationReducer(hyperinflated, {
      type: 'SET_CONTROL',
      control: 'ratePerMin',
      value: 35,
    })
    hyperinflated = advanceSimulation(hyperinflated, 30)
    expect(hyperinflated.risk.dynamicHyperinflation).toBeGreaterThan(15)
    expect(hyperinflated.criticalErrors).toContain('Sustained severe dynamic hyperinflation')

    const mv15 = mechanicalVentilationCaseById.get('MV-15')!
    let oversedated = createInitialSimulationState('MV-15', 'practice')
    oversedated = ventilationSimulationReducer(oversedated, {
      type: 'COMMIT_PREDICTION',
      mechanismId: mv15.correctMechanismId,
      priorityId: mv15.correctPriorityId,
      responseId: mv15.correctResponseId,
    })
    oversedated = ventilationSimulationReducer(oversedated, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'deepen-sedation',
    })
    expect(oversedated.criticalErrors).toContain(
      'Deep sedation before assessing pain, dyspnea, and delirium',
    )
  })
})
