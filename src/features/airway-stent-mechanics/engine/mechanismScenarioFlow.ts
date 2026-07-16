import type {
  MechanismArchitectureBehavior,
  MechanismArchitectureFamily,
  MechanismConsequenceState,
  MechanismPhase,
  MechanismPredictionChoice,
  MechanismScenario,
} from '../content/mechanismScenarioRegistry'

export interface MechanismScenarioState {
  architectureFamily: MechanismArchitectureFamily
  phaseIndex: number
  selectedPredictionId: string | null
  committedPredictionId: string | null
  completedObservationIds: readonly string[]
  completedArchitectureFamilies: readonly MechanismArchitectureFamily[]
  completed: boolean
}

export type MechanismScenarioAction =
  | { type: 'select-architecture'; architectureFamily: MechanismArchitectureFamily }
  | { type: 'select-prediction'; predictionId: string }
  | { type: 'commit-prediction' }
  | { type: 'toggle-observation'; observationId: string }
  | { type: 'advance' }
  | { type: 'previous' }
  | { type: 'complete' }
  | { type: 'restart' }

export function createInitialMechanismScenarioState(
  scenario: MechanismScenario,
): MechanismScenarioState {
  const architectureFamily = scenario.architectureFamilies[0]
  if (!architectureFamily) {
    throw new Error(`Mechanism scenario ${scenario.id} has no architecture family.`)
  }

  return {
    architectureFamily,
    phaseIndex: 0,
    selectedPredictionId: null,
    committedPredictionId: null,
    completedObservationIds: [],
    completedArchitectureFamilies: [],
    completed: false,
  }
}

export function getCurrentMechanismPhase(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
): MechanismPhase {
  const phase = scenario.phases[state.phaseIndex]
  if (!phase) {
    throw new Error(
      `Invalid phase index ${state.phaseIndex} for mechanism scenario ${scenario.id}.`,
    )
  }
  return phase
}

export function getMechanismArchitectureBehavior(
  scenario: MechanismScenario,
  architectureFamily: MechanismArchitectureFamily,
): MechanismArchitectureBehavior {
  const behavior = scenario.architectureBehaviors.find(
    (candidate) => candidate.architectureFamily === architectureFamily,
  )
  if (!behavior) {
    throw new Error(
      `Unknown architecture family ${architectureFamily} for mechanism scenario ${scenario.id}.`,
    )
  }
  return behavior
}

export function getCommittedMechanismPrediction(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
): MechanismPredictionChoice | null {
  if (!state.committedPredictionId) return null
  return (
    scenario.learnerPrompt.choices.find((choice) => choice.id === state.committedPredictionId) ??
    null
  )
}

export function getMechanismConsequence(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
): MechanismConsequenceState | null {
  if (state.phaseIndex !== scenario.phases.length - 1) return null
  const committedPrediction = getCommittedMechanismPrediction(scenario, state)
  if (!committedPrediction) return null
  return (
    scenario.consequenceStates.find(
      (consequence) => consequence.id === committedPrediction.consequenceStateId,
    ) ?? null
  )
}

export function getMissingMechanismObservations(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
): string[] {
  const phase = getCurrentMechanismPhase(scenario, state)
  const completed = new Set(state.completedObservationIds)
  return (phase.requiredObservationIds ?? []).filter(
    (observationId) => !completed.has(observationId),
  )
}

export function canAdvanceMechanismScenario(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
): boolean {
  return Boolean(
    state.committedPredictionId &&
    state.phaseIndex < scenario.phases.length - 1 &&
    getMissingMechanismObservations(scenario, state).length === 0,
  )
}

export function getPendingMechanismArchitectureFamilies(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
): MechanismArchitectureFamily[] {
  if (scenario.completionPolicy === 'selected-architecture-family' && state.completed) return []
  const completed = new Set(state.completedArchitectureFamilies)
  return scenario.architectureFamilies.filter(
    (architectureFamily) => !completed.has(architectureFamily),
  )
}

export function reduceMechanismScenarioState(
  scenario: MechanismScenario,
  state: MechanismScenarioState,
  action: MechanismScenarioAction,
): MechanismScenarioState {
  switch (action.type) {
    case 'select-architecture': {
      if (!scenario.architectureFamilies.includes(action.architectureFamily)) {
        throw new Error(
          `Unknown architecture family ${action.architectureFamily} for mechanism scenario ${scenario.id}.`,
        )
      }
      if (state.architectureFamily === action.architectureFamily) return state
      return {
        ...createInitialMechanismScenarioState(scenario),
        architectureFamily: action.architectureFamily,
        completedArchitectureFamilies: state.completedArchitectureFamilies,
        completed: state.completed,
      }
    }

    case 'select-prediction': {
      const predictionExists = scenario.learnerPrompt.choices.some(
        (choice) => choice.id === action.predictionId,
      )
      if (!predictionExists) {
        throw new Error(
          `Unknown prediction ${action.predictionId} for mechanism scenario ${scenario.id}.`,
        )
      }
      if (state.selectedPredictionId === action.predictionId) return state

      const revisingCommittedPrediction = Boolean(
        state.committedPredictionId && state.committedPredictionId !== action.predictionId,
      )
      return {
        ...state,
        selectedPredictionId: action.predictionId,
        committedPredictionId: revisingCommittedPrediction ? null : state.committedPredictionId,
        phaseIndex: revisingCommittedPrediction ? 0 : state.phaseIndex,
        completedObservationIds: revisingCommittedPrediction ? [] : state.completedObservationIds,
        completed: state.completed,
      }
    }

    case 'commit-prediction': {
      if (!state.selectedPredictionId) return state
      const predictionExists = scenario.learnerPrompt.choices.some(
        (choice) => choice.id === state.selectedPredictionId,
      )
      if (!predictionExists) return state
      return {
        ...state,
        committedPredictionId: state.selectedPredictionId,
        phaseIndex: Math.min(1, scenario.phases.length - 1),
        completedObservationIds: [],
        completed: state.completed,
      }
    }

    case 'toggle-observation': {
      if (!state.committedPredictionId) return state
      const phase = getCurrentMechanismPhase(scenario, state)
      if (!(phase.requiredObservationIds ?? []).includes(action.observationId)) return state

      const completed = new Set(state.completedObservationIds)
      if (completed.has(action.observationId)) completed.delete(action.observationId)
      else completed.add(action.observationId)
      return { ...state, completedObservationIds: [...completed] }
    }

    case 'advance':
      if (!canAdvanceMechanismScenario(scenario, state)) return state
      return { ...state, phaseIndex: state.phaseIndex + 1 }

    case 'previous':
      if (!state.committedPredictionId || state.phaseIndex <= 1) return state
      return { ...state, phaseIndex: state.phaseIndex - 1 }

    case 'complete': {
      if (!getMechanismConsequence(scenario, state)) return state
      const completedArchitectureFamilies = state.completedArchitectureFamilies.includes(
        state.architectureFamily,
      )
        ? state.completedArchitectureFamilies
        : [...state.completedArchitectureFamilies, state.architectureFamily]
      const overallComplete =
        scenario.completionPolicy === 'selected-architecture-family' ||
        scenario.architectureFamilies.every((architectureFamily) =>
          completedArchitectureFamilies.includes(architectureFamily),
        )

      if (overallComplete) {
        return { ...state, completedArchitectureFamilies, completed: true }
      }

      const nextArchitectureFamily = scenario.architectureFamilies.find(
        (architectureFamily) => !completedArchitectureFamilies.includes(architectureFamily),
      )
      if (!nextArchitectureFamily) return { ...state, completedArchitectureFamilies }

      return {
        ...createInitialMechanismScenarioState(scenario),
        architectureFamily: nextArchitectureFamily,
        completedArchitectureFamilies,
      }
    }

    case 'restart': {
      const restarted = createInitialMechanismScenarioState(scenario)
      return {
        ...restarted,
        architectureFamily: state.architectureFamily,
        completedArchitectureFamilies: state.completedArchitectureFamilies,
        completed: state.completed,
      }
    }
  }
}
