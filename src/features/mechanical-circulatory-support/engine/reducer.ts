import { advanceMcsSimulation, clamp, createDefaultMcsDevice, createInitialMcsState } from './model'
import type {
  IabpDeviceState,
  ImpellaDeviceState,
  LvadDeviceState,
  McsAction,
  McsDerivedMetrics,
  McsMetricCriterion,
  McsScoreBreakdown,
  McsSimulationState,
  ImpellaSide,
} from './types'

function unique(values: readonly string[], value: string): readonly string[] {
  return values.includes(value) ? values : [...values, value]
}

function addActionIds(state: McsSimulationState, ...ids: string[]): McsSimulationState {
  return { ...state, actionIds: [...new Set([...state.actionIds, ...ids])] }
}

function refresh(state: McsSimulationState): McsSimulationState {
  return advanceMcsSimulation({ ...state, score: null, completed: false }, 0)
}

export function isMcsActionIdPermitted(state: McsSimulationState, actionId: string): boolean {
  if (!state.scenario) return true
  return (
    state.scenario.permittedActionIds.includes(actionId) ||
    (actionId.startsWith('patient:') &&
      state.scenario.permittedActionIds.includes('patient:adjust'))
  )
}

function actionNotPermitted(state: McsSimulationState): McsSimulationState {
  return {
    ...state,
    responseMessage: 'That action is outside the permitted controls for this station.',
  }
}

function metricMeetsCriterion(metrics: McsDerivedMetrics, criterion: McsMetricCriterion): boolean {
  const value = metrics[criterion.metric]
  if (typeof criterion.value === 'boolean') return value === criterion.value
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  if (criterion.operator === 'at-least') return value >= criterion.value
  if (criterion.operator === 'at-most') return value <= criterion.value
  return value === criterion.value
}

export function calculateMcsScore(state: McsSimulationState): McsScoreBreakdown {
  const scenario = state.scenario
  if (!scenario) {
    return { inspection: 0, prediction: 0, management: 0, response: 0, reassessment: 0, total: 0 }
  }
  const requiredInspections = scenario.requiredActionIds.filter((id) => id.startsWith('inspect:'))
  const completedInspections = requiredInspections.filter((id) =>
    state.actionIds.includes(id),
  ).length
  const inspection =
    requiredInspections.length === 0 ? 20 : (completedInspections / requiredInspections.length) * 20
  const prediction = state.selectedPredictionId === scenario.correctPredictionId ? 20 : 0
  const completedActions = scenario.requiredActionIds.filter((id) =>
    state.actionIds.includes(id),
  ).length
  const management = (completedActions / Math.max(1, scenario.requiredActionIds.length)) * 35
  const criteriaMet = scenario.successCriteria.filter((criterion) =>
    metricMeetsCriterion(state.metrics, criterion),
  ).length
  const response = (criteriaMet / Math.max(1, scenario.successCriteria.length)) * 20
  const reassessment = state.reassessed ? 5 : 0
  const total = Math.round(
    clamp(inspection + prediction + management + response + reassessment, 0, 100),
  )
  return {
    inspection: Math.round(inspection),
    prediction: Math.round(prediction),
    management: Math.round(management),
    response: Math.round(response),
    reassessment,
    total,
  }
}

export function hasMcsMastery(state: McsSimulationState): boolean {
  const score = state.score ?? calculateMcsScore(state)
  return score.total >= 80 && state.criticalErrors.length === 0
}

function iabpActionId(control: string): string {
  if (control === 'assistRatio') return 'iabp:set-ratio'
  if (control === 'triggerSource') return 'iabp:set-trigger'
  if (control === 'inflationOffsetMs') return 'iabp:set-inflation'
  if (control === 'deflationOffsetMs') return 'iabp:set-deflation'
  return 'iabp:set-running'
}

function impellaActionId(side: ImpellaSide, control: string): string {
  if (control === 'performanceLevel') return `impella:${side}:set-level`
  if (control === 'position') return `impella:${side}:set-position`
  if (control === 'purgeState') return `impella:${side}:set-purge`
  return `impella:${side}:set-running`
}

function impellaConfigurationActionId(control: string): string {
  if (control === 'leftVariant') return 'impella:set-left-variant'
  if (control === 'rightEnabled') return 'impella:enable-right'
  return 'impella:enable-left'
}

function lvadActionId(control: string): string {
  if (control === 'speedChangeAuthorized') return 'lvad:authorize-speed'
  if (control === 'speedRpm') return 'lvad:set-speed'
  if (control === 'powerConnected') return 'lvad:set-power'
  if (control === 'suspectedPumpThrombosis') return 'lvad:set-thrombosis'
  if (control === 'controllerFault') return 'lvad:set-controller'
  return 'lvad:set-running'
}

export function mcsReducer(state: McsSimulationState, action: McsAction): McsSimulationState {
  switch (action.type) {
    case 'TICK':
      return advanceMcsSimulation(state, action.seconds)
    case 'SELECT_DEVICE': {
      if (state.scenario && state.scenario.device !== action.device) return state
      const next = createInitialMcsState(state.section, action.device, null, state.seed)
      return {
        ...next,
        actionIds: unique(state.actionIds, `device:select:${action.device}`),
        responseMessage: `${createDefaultMcsDevice(action.device).kind.toUpperCase()} mechanism selected. Change one variable at a time.`,
      }
    }
    case 'OPEN_STUDIO':
      return createInitialMcsState(state.section, action.device, null, state.seed + 1)
    case 'LOAD_SCENARIO':
      return createInitialMcsState(
        state.section,
        action.scenario.device,
        action.scenario,
        state.seed + 1,
      )
    case 'RESET':
      return createInitialMcsState(
        state.section,
        state.deviceKind,
        state.scenario,
        action.seed ?? state.seed + 1,
      )
    case 'INSPECT': {
      const id = action.id.startsWith('inspect:') ? action.id : `inspect:${action.id}`
      if (!isMcsActionIdPermitted(state, id)) return actionNotPermitted(state)
      return {
        ...addActionIds(state, id),
        inspectedIds: unique(state.inspectedIds, id),
        scenarioPhase: state.scenario ? 'predict' : state.scenarioPhase,
        responseMessage:
          id === 'inspect:arterial'
            ? `ART: MAP ${state.metrics.mapMmHg} mm Hg · pulse pressure ${state.metrics.pulsePressureMmHg} mm Hg.`
            : id === 'inspect:preload'
              ? `Filling: RAP ${state.metrics.rapMmHg}, PCWP ${state.metrics.pcwpMmHg} mm Hg · PAPi ${state.metrics.papi}.`
              : state.device.kind === 'impella'
                ? `Device: left pump ${state.metrics.leftDeviceFlowLMin.toFixed(1)} L/min · RP ${state.metrics.rightDeviceFlowLMin.toFixed(1)} L/min · ${state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min effective systemic flow.`
                : `Device: ${state.metrics.deviceFlowLMin.toFixed(1)} L/min device flow · ${state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min effective flow.`,
      }
    }
    case 'SELECT_PREDICTION':
      return state.predictionCommitted ? state : { ...state, selectedPredictionId: action.id }
    case 'COMMIT_PREDICTION':
      if (!state.selectedPredictionId) {
        return { ...state, responseMessage: 'Choose a mechanism before committing.' }
      }
      return {
        ...state,
        predictionCommitted: true,
        scenarioPhase: 'adjust',
        responseMessage:
          'Initial frame recorded. Adjust the model, observe the coupled response, then reassess.',
      }
    case 'SET_RHYTHM':
      if (!isMcsActionIdPermitted(state, 'patient:set-rhythm')) return actionNotPermitted(state)
      return refresh({
        ...addActionIds(state, 'patient:adjust', 'patient:set-rhythm'),
        patient: { ...state.patient, rhythm: action.rhythm },
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    case 'SET_PATIENT_CONTROL': {
      const bounds: Record<typeof action.control, readonly [number, number]> = {
        heartRateBpm: [40, 180],
        preloadPercent: [50, 145],
        systemicVascularResistanceDynSecCm5: [400, 2200],
        leftVentricularContractility: [0.2, 1.4],
        rightVentricularContractility: [0.2, 1.4],
        pulmonaryVascularResistanceWU: [0.5, 9],
        peepCmH2O: [0, 20],
        aorticInsufficiencySeverity: [0, 1],
      }
      const [minimum, maximum] = bounds[action.control]
      const specificId =
        action.control === 'preloadPercent'
          ? 'patient:set-preload'
          : action.control === 'systemicVascularResistanceDynSecCm5'
            ? 'patient:set-svr'
            : action.control === 'rightVentricularContractility'
              ? 'patient:set-rv'
              : action.control === 'pulmonaryVascularResistanceWU'
                ? 'patient:set-pvr'
                : 'patient:adjust'
      if (!isMcsActionIdPermitted(state, specificId)) return actionNotPermitted(state)
      return refresh({
        ...addActionIds(state, 'patient:adjust', specificId),
        patient: { ...state.patient, [action.control]: clamp(action.value, minimum, maximum) },
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    }
    case 'SET_TAMPONADE':
      if (!isMcsActionIdPermitted(state, 'patient:set-tamponade')) return actionNotPermitted(state)
      return refresh({
        ...addActionIds(state, 'patient:adjust', 'patient:set-tamponade'),
        patient: { ...state.patient, tamponade: action.active },
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    case 'SET_IABP_CONTROL': {
      if (state.device.kind !== 'iabp') return state
      if (!isMcsActionIdPermitted(state, iabpActionId(action.control)))
        return actionNotPermitted(state)
      const device = { ...state.device, [action.control]: action.value } as IabpDeviceState
      let criticalErrors = state.criticalErrors
      if (
        state.scenario &&
        action.control === 'deflationOffsetMs' &&
        typeof action.value === 'number' &&
        action.value > 120
      ) {
        criticalErrors = unique(criticalErrors, 'iabp-late-deflation-created')
      }
      return refresh({
        ...addActionIds(state, iabpActionId(action.control)),
        device,
        criticalErrors,
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    }
    case 'SET_IMPELLA_CONTROL': {
      if (state.device.kind !== 'impella') return state
      const side = action.side ?? 'left'
      const actionId = impellaActionId(side, action.control)
      if (!isMcsActionIdPermitted(state, actionId)) return actionNotPermitted(state)
      const currentPump = state.device[side]
      let criticalErrors = state.criticalErrors
      if (
        state.scenario &&
        action.control === 'performanceLevel' &&
        typeof action.value === 'number' &&
        action.value > currentPump.performanceLevel &&
        state.alarms.some((candidate) => candidate.id === `impella-${side}-suction`)
      ) {
        criticalErrors = unique(criticalErrors, 'impella-escalated-through-suction')
      }
      const device = {
        ...state.device,
        [side]: { ...currentPump, [action.control]: action.value },
      } as ImpellaDeviceState
      return refresh({
        ...addActionIds(state, actionId),
        device,
        criticalErrors,
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    }
    case 'SET_IMPELLA_CONFIGURATION': {
      if (state.device.kind !== 'impella') return state
      const actionId = impellaConfigurationActionId(action.control)
      if (!isMcsActionIdPermitted(state, actionId)) return actionNotPermitted(state)
      const device: ImpellaDeviceState =
        action.control === 'leftVariant'
          ? {
              ...state.device,
              left: {
                ...state.device.left,
                enabled: true,
                variant: action.value as ImpellaDeviceState['left']['variant'],
              },
            }
          : action.control === 'leftEnabled'
            ? {
                ...state.device,
                left: { ...state.device.left, enabled: Boolean(action.value) },
              }
            : {
                ...state.device,
                right: { ...state.device.right, enabled: Boolean(action.value) },
              }
      return refresh({
        ...addActionIds(state, actionId),
        device,
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    }
    case 'SET_LVAD_CONTROL': {
      if (state.device.kind !== 'lvad') return state
      if (!isMcsActionIdPermitted(state, lvadActionId(action.control)))
        return actionNotPermitted(state)
      let criticalErrors = state.criticalErrors
      if (state.scenario && action.control === 'speedRpm' && !state.device.speedChangeAuthorized) {
        criticalErrors = unique(criticalErrors, 'lvad-unauthorized-speed-change')
        return {
          ...state,
          criticalErrors,
          responseMessage:
            'Speed change blocked: enable only the simulated authorized-personnel order. Real changes require the prescribing MCS team.',
        }
      }
      if (state.scenario && action.control === 'powerConnected' && action.value === false) {
        criticalErrors = unique(criticalErrors, 'lvad-power-disconnected-by-learner')
      }
      const device = { ...state.device, [action.control]: action.value } as LvadDeviceState
      return refresh({
        ...addActionIds(state, lvadActionId(action.control)),
        device,
        criticalErrors,
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
      })
    }
    case 'ESCALATE':
      if (!isMcsActionIdPermitted(state, 'team:escalate')) return actionNotPermitted(state)
      return {
        ...addActionIds(state, 'team:escalate'),
        escalated: true,
        scenarioPhase: state.scenario ? 'observe' : state.scenarioPhase,
        responseMessage: 'Shock/MCS team escalation documented in the simulation.',
      }
    case 'REASSESS':
      return {
        ...state,
        reassessed: true,
        scenarioPhase: 'reassess',
        responseMessage: `Reassessment: effective flow ${state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min, MAP ${state.metrics.mapMmHg}, RAP ${state.metrics.rapMmHg}, PCWP ${state.metrics.pcwpMmHg} mm Hg.`,
      }
    case 'COMPLETE': {
      const score = calculateMcsScore(state)
      return {
        ...state,
        score,
        completed: true,
        scenarioPhase: 'debrief',
        responseMessage:
          state.criticalErrors.length > 0
            ? 'Debrief ready. Review the safety interruption and the cues that preceded it.'
            : 'Debrief ready. Compare your frame, actions, and observed response.',
      }
    }
  }
}
