import type {
  ClinicalInterventionDefinition,
  EcmoSimulationState,
  ScenarioDefinition,
} from './types'

export interface ClinicalInterventionResult {
  state: EcmoSimulationState
  intervention: ClinicalInterventionDefinition | null
  resolutionReady: boolean
  penalty: ClinicalInterventionDefinition['penalty'] | null
  blocked: boolean
}

export interface ClinicalStartResult {
  state: EcmoSimulationState
  started: boolean
  message: string
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function clinicalRequirementsMet(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
): boolean {
  const clinicalCase = definition.clinicalCase
  const clinical = state.scenario.clinical
  if (!clinicalCase || !clinical) return false
  const applied = new Set(clinical.appliedInterventions.map((record) => record.interventionId))
  return clinicalCase.requiredInterventionIds.every((id) => applied.has(id))
}

function settingsMatch(state: EcmoSimulationState, definition: ScenarioDefinition): boolean {
  const targets = definition.clinicalCase?.initiationTargets
  if (!targets) return true
  return (
    Math.abs(state.device.rpmSetpoint - targets.rpm) <= (targets.rpmTolerance ?? 50) &&
    Math.abs(state.gas.sweepLpm - targets.sweepLpm) <= (targets.sweepTolerance ?? 0.1) &&
    Math.abs(state.gas.fio2 - targets.fio2) <= (targets.fio2Tolerance ?? 0.01)
  )
}

export function applyClinicalIntervention(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
  interventionId: string,
): ClinicalInterventionResult {
  const clinicalCase = definition.clinicalCase
  const clinical = state.scenario.clinical
  const selected = clinicalCase?.interventions.find((item) => item.id === interventionId) ?? null
  if (!clinicalCase || !clinical || !selected) {
    return { state, intervention: selected, resolutionReady: false, penalty: null, blocked: true }
  }

  const appliedIds = new Set(clinical.appliedInterventions.map((record) => record.interventionId))
  if (appliedIds.has(selected.id) && !selected.repeatable) {
    return {
      state: {
        ...state,
        scenario: {
          ...state.scenario,
          clinical: { ...clinical, lastResponse: `${selected.label} was already completed.` },
        },
      },
      intervention: selected,
      resolutionReady: clinicalRequirementsMet(state, definition),
      penalty: null,
      blocked: true,
    }
  }

  const missingPrerequisites = (selected.prerequisites ?? []).filter((id) => !appliedIds.has(id))
  if (missingPrerequisites.length) {
    const missingLabels = missingPrerequisites.map(
      (id) => clinicalCase.interventions.find((item) => item.id === id)?.label ?? id,
    )
    return {
      state: {
        ...state,
        scenario: {
          ...state.scenario,
          clinical: {
            ...clinical,
            lastResponse: `Complete first: ${missingLabels.join(', ')}.`,
          },
        },
      },
      intervention: selected,
      resolutionReady: false,
      penalty: null,
      blocked: true,
    }
  }

  const patched: EcmoSimulationState = {
    ...state,
    device: { ...state.device, ...selected.patch?.device },
    circuit: { ...state.circuit, ...selected.patch?.circuit },
    gas: { ...state.gas, ...selected.patch?.gas },
    patient: { ...state.patient, ...selected.patch?.patient },
  }
  const record = {
    id: `${selected.id}-${state.simulationTime}-${clinical.appliedInterventions.length}`,
    interventionId: selected.id,
    label: selected.label,
    effect: selected.effect,
    response: selected.response,
    time: state.simulationTime,
  }
  const nextClinical = {
    ...clinical,
    trajectory:
      selected.effect === 'harmful'
        ? ('deteriorating' as const)
        : selected.effect === 'temporizing'
          ? ('temporarily-stabilized' as const)
          : clinical.trajectory,
    appliedInterventions: [...clinical.appliedInterventions, record],
    revealedFindings: unique([...clinical.revealedFindings, ...(selected.reveals ?? [])]),
    lastResponse: selected.response,
  }
  const next = {
    ...patched,
    scenario: { ...patched.scenario, clinical: nextClinical },
  }
  return {
    state: next,
    intervention: selected,
    resolutionReady: !clinicalCase.initiationTargets && clinicalRequirementsMet(next, definition),
    penalty: selected.penalty ?? null,
    blocked: false,
  }
}

export function attemptClinicalEcmoStart(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
): ClinicalStartResult {
  const clinicalCase = definition.clinicalCase
  const clinical = state.scenario.clinical
  if (!clinicalCase || !clinical || !clinicalCase.initiationTargets) {
    return { state, started: false, message: 'This case does not require ECMO initiation.' }
  }
  if (clinical.supportStatus === 'on-ecmo') {
    return { state, started: false, message: 'ECMO support is already running.' }
  }
  if (!clinicalRequirementsMet(state, definition)) {
    const next = {
      ...state,
      scenario: {
        ...state.scenario,
        clinical: {
          ...clinical,
          lastResponse:
            'The circuit cannot be started until readiness and connection steps are complete.',
        },
      },
    }
    return { state: next, started: false, message: next.scenario.clinical?.lastResponse ?? '' }
  }
  if (!settingsMatch(state, definition)) {
    const next = {
      ...state,
      scenario: {
        ...state.scenario,
        clinical: {
          ...clinical,
          supportStatus: 'ready-to-start' as const,
          lastResponse:
            'Readiness is complete, but the current RPM, sweep, and gas FiO₂ do not match the supplied simulated initiation orders.',
        },
      },
    }
    return { state: next, started: false, message: next.scenario.clinical?.lastResponse ?? '' }
  }

  const record = {
    id: `start-ecmo-${state.simulationTime}-${clinical.appliedInterventions.length}`,
    interventionId: 'start-ecmo',
    label: 'Start ECMO with configured settings',
    effect: 'definitive' as const,
    response: clinicalCase.completionResponse,
    time: state.simulationTime,
  }
  return {
    state: {
      ...state,
      device: { ...state.device, pumpRunning: true },
      scenario: {
        ...state.scenario,
        clinical: {
          ...clinical,
          supportStatus: 'on-ecmo',
          trajectory: 'improving',
          appliedInterventions: [...clinical.appliedInterventions, record],
          lastResponse: clinicalCase.completionResponse,
        },
      },
    },
    started: true,
    message: clinicalCase.completionResponse,
  }
}

export function markClinicalImproving(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
): EcmoSimulationState {
  const clinical = state.scenario.clinical
  if (!clinical || !definition.clinicalCase) return state
  return {
    ...state,
    scenario: {
      ...state.scenario,
      clinical: {
        ...clinical,
        trajectory: 'improving',
        lastResponse: definition.clinicalCase.completionResponse,
      },
    },
  }
}
