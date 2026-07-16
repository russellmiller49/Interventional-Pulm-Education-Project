import {
  simulationControlRanges,
  createDefaultMechanicalVentilationSettings,
} from '../content/deviceProfiles'
import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content/runtimeCases'
import { clamp, deriveEffectivePatient, deriveMeasurements } from './physics'
import { advanceSimulation, applyIntervention, createInitialSimulationState } from './simulation'
import type {
  MechanicalVentilationCommonSettings,
  CanonicalVentilationMode,
  MechanicalVentilationSettings,
  VentilationAction,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorControlKey,
  VentilatorDeviceId,
} from './types'

function caseDefinition(state: VentilationSimulationState): VentilationCaseDefinition {
  return mechanicalVentilationCaseById.get(state.caseId) ?? mechanicalVentilationCases[0]
}

function numeric(value: number | string | boolean, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function bounded(
  value: number | string | boolean,
  range: readonly [number, number],
  fallback: number,
) {
  return clamp(numeric(value, fallback), range[0], range[1])
}

function maxControlledPRampMs(inspiratoryTimeSeconds: number): number {
  return Math.min(
    simulationControlRanges.pRampControlledMs[1],
    Math.floor((inspiratoryTimeSeconds * 1000) / 3),
  )
}

function commonSettings(
  settings: MechanicalVentilationSettings,
): MechanicalVentilationCommonSettings {
  return {
    oxygenPercent: settings.oxygenPercent,
    peepCmH2O: settings.peepCmH2O,
    trigger: { ...settings.trigger },
    highPressureLimitCmH2O: settings.highPressureLimitCmH2O,
    trcEnabled: settings.trcEnabled,
    trcPercent: settings.trcPercent,
    tubeInnerDiameterMm: settings.tubeInnerDiameterMm,
  }
}

function settingsForMode(
  mode: CanonicalVentilationMode,
  previous: MechanicalVentilationSettings,
): MechanicalVentilationSettings {
  return {
    ...createDefaultMechanicalVentilationSettings(mode),
    ...commonSettings(previous),
  } as MechanicalVentilationSettings
}

function updateCommonControl(
  settings: MechanicalVentilationSettings,
  control: VentilatorControlKey,
  value: number | string | boolean,
): MechanicalVentilationSettings | null {
  if (control === 'oxygenPercent') {
    return {
      ...settings,
      oxygenPercent: bounded(value, simulationControlRanges.oxygenPercent, settings.oxygenPercent),
    }
  }
  if (control === 'peepCmH2O') {
    return {
      ...settings,
      peepCmH2O: bounded(value, simulationControlRanges.peepCmH2O, settings.peepCmH2O),
    }
  }
  if (control === 'highPressureLimitCmH2O') {
    return {
      ...settings,
      highPressureLimitCmH2O: bounded(
        value,
        simulationControlRanges.highPressureLimitCmH2O,
        settings.highPressureLimitCmH2O,
      ),
    }
  }
  if (control === 'triggerType' && (value === 'flow' || value === 'pressure')) {
    return {
      ...settings,
      trigger:
        value === 'flow'
          ? { type: 'flow', thresholdLMin: 2 }
          : { type: 'pressure', thresholdCmH2O: -2 },
    }
  }
  if (control === 'triggerThreshold') {
    return {
      ...settings,
      trigger:
        settings.trigger.type === 'flow'
          ? {
              type: 'flow',
              thresholdLMin: bounded(
                value,
                settings.mode === 'pressure-support'
                  ? simulationControlRanges.flowTriggerLMin
                  : simulationControlRanges.flowTriggerMandatoryLMin,
                settings.trigger.thresholdLMin,
              ),
            }
          : {
              type: 'pressure',
              thresholdCmH2O: bounded(
                value,
                simulationControlRanges.pressureTriggerCmH2O,
                settings.trigger.thresholdCmH2O,
              ),
            },
    }
  }
  if (control === 'trcEnabled') return { ...settings, trcEnabled: Boolean(value) }
  if (control === 'trcPercent') {
    return {
      ...settings,
      trcPercent: bounded(value, simulationControlRanges.trcPercent, settings.trcPercent),
    }
  }
  if (control === 'tubeInnerDiameterMm') {
    return {
      ...settings,
      tubeInnerDiameterMm: bounded(
        value,
        simulationControlRanges.adultTubeInnerDiameterMm,
        settings.tubeInnerDiameterMm,
      ),
    }
  }
  return null
}

export function updateVentilatorControl(
  settings: MechanicalVentilationSettings,
  control: VentilatorControlKey,
  value: number | string | boolean,
  deviceId: VentilatorDeviceId = 'hamilton-c6',
): MechanicalVentilationSettings {
  const common = updateCommonControl(settings, control, value)
  if (common) return common

  if (settings.mode === 'volume-ac') {
    if (control === 'vtMl') {
      return { ...settings, vtMl: bounded(value, simulationControlRanges.vtMl, settings.vtMl) }
    }
    if (control === 'ratePerMin') {
      return {
        ...settings,
        ratePerMin: bounded(
          value,
          simulationControlRanges.mandatoryRatePerMin,
          settings.ratePerMin,
        ),
      }
    }
    if (control === 'peakFlowLMin') {
      return {
        ...settings,
        peakFlowLMin: bounded(value, simulationControlRanges.peakFlowLMin, settings.peakFlowLMin),
      }
    }
    if (
      control === 'flowPattern' &&
      ['square', 'decelerating-50', 'sine', 'decelerating-100'].includes(String(value))
    ) {
      return { ...settings, flowPattern: value as typeof settings.flowPattern }
    }
    if (control === 'pausePercent') {
      return {
        ...settings,
        pausePercent: bounded(value, simulationControlRanges.pausePercent, settings.pausePercent),
      }
    }
  }

  if (settings.mode === 'pressure-ac') {
    if (control === 'deltaPControlCmH2O') {
      return {
        ...settings,
        deltaPControlCmH2O: bounded(
          value,
          simulationControlRanges.deltaPControlCmH2O,
          settings.deltaPControlCmH2O,
        ),
      }
    }
    if (control === 'ratePerMin') {
      return {
        ...settings,
        ratePerMin: bounded(
          value,
          simulationControlRanges.mandatoryRatePerMin,
          settings.ratePerMin,
        ),
      }
    }
    if (control === 'inspiratoryTimeSeconds') {
      const inspiratoryTimeSeconds = bounded(
        value,
        simulationControlRanges.inspiratoryTimeSeconds,
        settings.inspiratoryTimeSeconds,
      )
      return {
        ...settings,
        inspiratoryTimeSeconds,
        pRampMs: Math.min(settings.pRampMs, maxControlledPRampMs(inspiratoryTimeSeconds)),
      }
    }
    if (control === 'pRampMs') {
      return {
        ...settings,
        pRampMs: clamp(
          numeric(value, settings.pRampMs),
          simulationControlRanges.pRampControlledMs[0],
          maxControlledPRampMs(settings.inspiratoryTimeSeconds),
        ),
      }
    }
  }

  if (settings.mode === 'pressure-support') {
    if (control === 'pressureSupportCmH2O') {
      return {
        ...settings,
        pressureSupportCmH2O: bounded(
          value,
          simulationControlRanges.pressureSupportCmH2O,
          settings.pressureSupportCmH2O,
        ),
      }
    }
    if (control === 'pRampMs') {
      const range =
        deviceId === 'hamilton-c6'
          ? ([0, 200] as const)
          : simulationControlRanges.pRampPressureSupportMs
      return {
        ...settings,
        pRampMs: bounded(value, range, settings.pRampMs),
      }
    }
    if (control === 'etsPercent') {
      return {
        ...settings,
        etsPercent: bounded(value, simulationControlRanges.etsPercent, settings.etsPercent),
      }
    }
    if (control === 'tiMaxSeconds') {
      return {
        ...settings,
        tiMaxSeconds: bounded(value, simulationControlRanges.tiMaxSeconds, settings.tiMaxSeconds),
      }
    }
    if (control === 'apneaBackupEnabled') {
      return { ...settings, apneaBackupEnabled: Boolean(value) }
    }
    if (control === 'apneaRatePerMin') {
      return {
        ...settings,
        apneaRatePerMin: bounded(
          value,
          simulationControlRanges.apneaRatePerMin,
          settings.apneaRatePerMin,
        ),
      }
    }
  }

  return settings
}

function refreshMeasurements(state: VentilationSimulationState): VentilationSimulationState {
  const definition = caseDefinition(state)
  const patient = deriveEffectivePatient(state, definition)
  return {
    ...state,
    patient,
    measurements: deriveMeasurements({ ...state, patient }, definition, patient),
  }
}

function canChangeTherapy(state: VentilationSimulationState): boolean {
  return state.experience === 'learn' || state.prediction.committed
}

function performConsoleHold(
  state: VentilationSimulationState,
  hold: 'inspiratory' | 'expiratory',
): VentilationSimulationState {
  const definition = caseDefinition(state)
  const interventionId = hold === 'inspiratory' ? 'inspiratory-hold' : 'expiratory-hold'
  if (definition.interventions.some((item) => item.id === interventionId)) {
    return applyIntervention(state, definition, interventionId)
  }
  return {
    ...state,
    ventilator: {
      ...state.ventilator,
      holdType: hold,
      holdUntil: state.simulationTime + 10,
    },
    lastResponse: `${hold === 'inspiratory' ? 'Inspiratory' : 'Expiratory'} hold active.`,
  }
}

export function ventilationSimulationReducer(
  state: VentilationSimulationState,
  action: VentilationAction,
): VentilationSimulationState {
  if (action.type === 'LOAD_CASE') {
    return createInitialSimulationState(
      action.caseId,
      action.experience,
      action.attempt ?? 1,
      action.deviceId ?? state.deviceId,
    )
  }
  if (action.type === 'CHANGE_DEVICE') {
    return createInitialSimulationState(
      state.caseId,
      state.experience,
      action.attempt ?? 1,
      action.deviceId,
    )
  }
  if (action.type === 'TICK') {
    if (state.paused) return state
    return advanceSimulation(state, (action.seconds ?? 0.1) * state.speed)
  }
  if (action.type === 'SET_PAUSED') return { ...state, paused: action.paused }
  if (action.type === 'SET_SPEED') return { ...state, speed: action.speed }
  if (action.type === 'SET_CHALLENGE_MODE') {
    return { ...state, challengeMode: action.challengeMode }
  }
  if (action.type === 'STEP_BREATH') {
    const settings = state.ventilator.settings
    const rate =
      settings.mode === 'pressure-support'
        ? state.patient.drive.neuralRatePerMin
        : settings.ratePerMin
    return advanceSimulation({ ...state, paused: true }, 60 / Math.max(1, rate))
  }
  if (action.type === 'SET_SCREEN') {
    return { ...state, ventilator: { ...state.ventilator, screen: action.screen } }
  }
  if (action.type === 'SELECT_MODE') {
    if (!canChangeTherapy(state) || state.ventilator.locked) return state
    return {
      ...state,
      ventilator: { ...state.ventilator, pendingMode: action.mode, screen: 'modes' },
      lastResponse: 'Review the selected mode and confirm to apply it at the next breath boundary.',
    }
  }
  if (action.type === 'CONFIRM_MODE') {
    if (!canChangeTherapy(state) || state.ventilator.locked || !state.ventilator.pendingMode) {
      return state
    }
    const currentRate =
      state.ventilator.settings.mode === 'pressure-support'
        ? state.patient.drive.neuralRatePerMin
        : state.ventilator.settings.ratePerMin
    const cycle = 60 / Math.max(1, currentRate)
    const remainder = state.simulationTime % cycle
    const atBoundary =
      remainder < 0.02 ? state : advanceSimulation(state, Math.max(0.02, cycle - remainder))
    const pendingMode = state.ventilator.pendingMode
    return refreshMeasurements({
      ...atBoundary,
      ventilator: {
        ...atBoundary.ventilator,
        settings: settingsForMode(pendingMode, atBoundary.ventilator.settings),
        pendingMode: null,
        screen: 'main',
      },
      lastResponse: 'Mode change confirmed and applied at a breath boundary.',
    })
  }
  if (action.type === 'SET_CONTROL') {
    if (!canChangeTherapy(state) || state.ventilator.locked) return state
    const settings = updateVentilatorControl(
      state.ventilator.settings,
      action.control,
      action.value,
      state.deviceId,
    )
    return refreshMeasurements({
      ...state,
      ventilator: { ...state.ventilator, settings },
      phase: state.phase === 'debrief' ? 'debrief' : 'act',
    })
  }
  if (action.type === 'TOGGLE_LOCK') {
    return { ...state, ventilator: { ...state.ventilator, locked: !state.ventilator.locked } }
  }
  if (action.type === 'TOGGLE_FREEZE') {
    return { ...state, ventilator: { ...state.ventilator, frozen: !state.ventilator.frozen } }
  }
  if (action.type === 'TOGGLE_ALARM_AUDIO') {
    return {
      ...state,
      ventilator: {
        ...state.ventilator,
        alarmAudioEnabled: !state.ventilator.alarmAudioEnabled,
      },
    }
  }
  if (action.type === 'ACK_ALARM') {
    const acknowledgedAt = state.simulationTime
    const alarms = state.alarms.map((alarm) =>
      !action.alarmId || alarm.id === action.alarmId ? { ...alarm, acknowledgedAt } : alarm,
    )
    const ids = new Set(alarms.filter((alarm) => alarm.acknowledgedAt).map((alarm) => alarm.id))
    return {
      ...state,
      alarms,
      alarmHistory: state.alarmHistory.map((alarm) =>
        ids.has(alarm.id) ? { ...alarm, acknowledgedAt } : alarm,
      ),
      ventilator: {
        ...state.ventilator,
        audioPausedUntil: state.simulationTime + 120,
      },
      lastResponse:
        'Alarm acknowledged. Audio is paused for two simulated minutes; the condition remains active.',
    }
  }
  if (action.type === 'OXYGEN_ENRICHMENT') {
    if (!canChangeTherapy(state)) return state
    return {
      ...state,
      ventilator: { ...state.ventilator, oxygenEnrichmentUntil: state.simulationTime + 120 },
      lastResponse: 'O₂ enrichment started for the suction workflow.',
    }
  }
  if (action.type === 'MANUAL_BREATH') {
    if (!canChangeTherapy(state)) return state
    return {
      ...state,
      ventilator: { ...state.ventilator, manualBreathUntil: state.simulationTime + 1 },
      lastResponse: 'A manual breath is delivered using the active settings.',
    }
  }
  if (action.type === 'PERFORM_HOLD') {
    if (!canChangeTherapy(state)) return state
    return performConsoleHold(state, action.hold)
  }
  if (action.type === 'COMMIT_PREDICTION') {
    if (state.experience !== 'practice' || state.prediction.committed) return state
    return {
      ...state,
      prediction: {
        committed: true,
        mechanismId: action.mechanismId,
        priorityId: action.priorityId,
        responseId: action.responseId,
      },
      phase: 'act',
      lastResponse: 'Prediction committed. Ventilator and bedside actions are now available.',
    }
  }
  if (action.type === 'PERFORM_INTERVENTION') {
    if (!canChangeTherapy(state)) {
      return { ...state, lastResponse: 'Commit your prediction before intervening.' }
    }
    return applyIntervention(state, caseDefinition(state), action.interventionId)
  }
  if (action.type === 'USE_HINT') {
    const available =
      state.experience === 'learn' ||
      (state.challengeMode === 'untimed' && state.simulationTime >= 60)
    if (!available) return state
    const definition = caseDefinition(state)
    const hintIndex = Math.min(state.hintsUsed, definition.hintLadder.length - 1)
    return {
      ...state,
      hintsUsed: state.hintsUsed + 1,
      lastResponse: definition.hintLadder[hintIndex] ?? 'No additional hint is available.',
    }
  }
  if (action.type === 'COMMIT_REASSESSMENT') {
    const performed = new Set(state.interventions.map((record) => record.interventionId))
    const required = caseDefinition(state).requiredReassessmentIds
    return {
      ...state,
      reassessment: {
        committed: true,
        actionIds: required.filter((id) => performed.has(id)),
      },
      lastResponse: required.every((id) => performed.has(id))
        ? 'Reassessment committed. You may now reveal the debrief.'
        : 'Reassessment committed, but one or more case-specific checks were not repeated.',
    }
  }
  if (action.type === 'REVEAL_DEBRIEF') {
    if (!state.reassessment.committed && state.experience === 'practice') return state
    return { ...state, phase: 'debrief', paused: true }
  }
  if (action.type === 'TOGGLE_EDUCATOR_OVERLAY') {
    if (state.experience !== 'learn') return state
    return { ...state, showEducatorOverlay: !state.showEducatorOverlay }
  }
  return state
}
