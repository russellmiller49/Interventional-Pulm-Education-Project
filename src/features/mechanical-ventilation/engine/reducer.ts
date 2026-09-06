import {
  simulationControlRanges,
  createDefaultMechanicalVentilationSettings,
  getVentilatorDeviceProfile,
} from '../content/deviceProfiles'
import { resolveVentilationSimulationCase } from '../content/learningPatient'
import {
  clamp,
  deriveEffectivePatient,
  deriveEffectiveVentilationRate,
  deriveMeasurements,
} from './physics'
import { advanceSimulation, applyIntervention, createInitialSimulationState } from './simulation'
import type {
  MechanicalVentilationCommonSettings,
  MechanicalVentilationSettings,
  VentilationAction,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorControlKey,
  VentilatorDeviceId,
  VentilatorModeId,
} from './types'
import { canonicalModeForVentilatorMode, cloneMechanicalVentilationSettings } from './modes'

function caseDefinition(state: VentilationSimulationState): VentilationCaseDefinition {
  return resolveVentilationSimulationCase(state.caseId)
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

/**
 * Bounds a teaching multiplier. Wide enough for a bitten tube or a stiff ARDS lung, narrow enough
 * that the console stays a console rather than becoming a graph of arithmetic.
 */
export const TEACHING_MECHANICS_SCALE_RANGE = [0.25, 6] as const

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1
  return clamp(value, TEACHING_MECHANICS_SCALE_RANGE[0], TEACHING_MECHANICS_SCALE_RANGE[1])
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
    deviceMode: settings.deviceMode,
    advanced: { ...settings.advanced },
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
  mode: VentilatorModeId,
  previous: MechanicalVentilationSettings,
): MechanicalVentilationSettings {
  const next = {
    ...createDefaultMechanicalVentilationSettings(canonicalModeForVentilatorMode(mode)),
    ...commonSettings(previous),
    deviceMode: mode,
    advanced: {
      ...previous.advanced,
      targetVtMl: previous.mode === 'volume-ac' ? previous.vtMl : previous.advanced.targetVtMl,
      spontaneousPressureSupportCmH2O:
        previous.mode === 'pressure-support'
          ? previous.pressureSupportCmH2O
          : previous.advanced.spontaneousPressureSupportCmH2O,
    },
  } as MechanicalVentilationSettings
  return cloneMechanicalVentilationSettings(next)
}

function updateCommonControl(
  settings: MechanicalVentilationSettings,
  control: VentilatorControlKey,
  value: number | string | boolean,
  deviceId: VentilatorDeviceId,
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
  if (control === 'targetVtMl') {
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        targetVtMl: bounded(
          value,
          simulationControlRanges.targetVtMl,
          settings.advanced.targetVtMl,
        ),
      },
    }
  }
  if (control === 'spontaneousPressureSupportCmH2O') {
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        spontaneousPressureSupportCmH2O: bounded(
          value,
          simulationControlRanges.spontaneousPressureSupportCmH2O,
          settings.advanced.spontaneousPressureSupportCmH2O,
        ),
      },
    }
  }
  if (control === 'spontaneousRampMs') {
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        spontaneousRampMs: bounded(
          value,
          deviceId === 'hamilton-c6'
            ? ([0, 200] as const)
            : simulationControlRanges.spontaneousRampMs,
          settings.advanced.spontaneousRampMs,
        ),
      },
    }
  }
  if (control === 'spontaneousCyclePercent') {
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        spontaneousCyclePercent: bounded(
          value,
          simulationControlRanges.spontaneousCyclePercent,
          settings.advanced.spontaneousCyclePercent,
        ),
      },
    }
  }
  if (control === 'pHighCmH2O') {
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        pHighCmH2O: Math.max(
          settings.advanced.pLowCmH2O + 1,
          bounded(value, simulationControlRanges.pHighCmH2O, settings.advanced.pHighCmH2O),
        ),
      },
    }
  }
  if (control === 'pLowCmH2O') {
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        pLowCmH2O: Math.min(
          settings.advanced.pHighCmH2O - 1,
          bounded(value, simulationControlRanges.pLowCmH2O, settings.advanced.pLowCmH2O),
        ),
      },
    }
  }
  const advancedNumericRanges = {
    tHighSeconds: simulationControlRanges.tHighSeconds,
    tLowSeconds: simulationControlRanges.tLowSeconds,
    proportionalSupportPercent: simulationControlRanges.proportionalSupportPercent,
    minuteVolumePercent: simulationControlRanges.minuteVolumePercent,
    targetSpO2LowPercent: simulationControlRanges.targetSpO2LowPercent,
    targetPetCO2MmHg: simulationControlRanges.targetPetCO2MmHg,
  } as const
  if (control in advancedNumericRanges) {
    const key = control as keyof typeof advancedNumericRanges
    return {
      ...settings,
      advanced: {
        ...settings.advanced,
        [key]: bounded(value, advancedNumericRanges[key], settings.advanced[key]),
      },
    }
  }
  if (
    control === 'automaticVentilationController' ||
    control === 'automaticOxygenationController' ||
    control === 'autoFlowEnabled' ||
    control === 'intelliSyncEnabled'
  ) {
    return {
      ...settings,
      advanced: { ...settings.advanced, [control]: Boolean(value) },
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
  const common = updateCommonControl(settings, control, value, deviceId)
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

/**
 * Request an occlusion. The valves close at the next real breath boundary, not here.
 *
 * Two earlier attempts got this wrong in the same way. The first closed the valves the instant the
 * button was pressed, which with a typical I:E ratio was almost always mid-expiration. The second
 * tried to jump forward to the boundary using `simulationTime % cycle` — but that arithmetic ran on
 * a different rate from the one `machineTiming` uses, so it still landed in the wrong limb and the
 * model froze at zero volume and baseline pressure: a flat line at PEEP with no plateau at all.
 *
 * So the boundary is no longer computed twice. The request is parked on `pendingHold` and
 * `advanceSimulation` arms it when the phase it is watching for actually arrives.
 */
function performConsoleHold(
  state: VentilationSimulationState,
  hold: 'inspiratory' | 'expiratory',
): VentilationSimulationState {
  if (state.ventilator.holdUntil !== null) return state
  const definition = caseDefinition(state)
  const interventionId = hold === 'inspiratory' ? 'inspiratory-hold' : 'expiratory-hold'
  // Cases that author their own hold intervention still record it; `applyIntervention` now also
  // parks the request rather than closing the valves where the learner happens to be.
  const requested = definition.interventions.some((item) => item.id === interventionId)
    ? applyIntervention(state, definition, interventionId)
    : state

  let advanced: VentilationSimulationState = {
    ...requested,
    ventilator: { ...requested.ventilator, pendingHold: hold },
  }

  /*
   * Run the model forward until it reaches the boundary itself. Pressing the key still does
   * something immediately — the lesson requirements and the console readout both depend on that —
   * but the instant the valves close is decided by `advanceSimulation`, not recomputed here.
   * The cap is a little over one breath so a case that never reaches the awaited phase cannot spin.
   */
  const cycleSeconds = 60 / Math.max(1, advanced.measurements.totalRatePerMin)
  const limitSeconds = cycleSeconds * 1.6 + 0.4
  for (let elapsed = 0; advanced.ventilator.pendingHold !== null && elapsed < limitSeconds; ) {
    advanced = advanceSimulation(advanced, 0.1, definition)
    elapsed += 0.1
  }

  return {
    ...advanced,
    lastResponse:
      advanced.ventilator.holdType === hold
        ? `${hold === 'inspiratory' ? 'Inspiratory' : 'Expiratory'} hold active at end-${
            hold === 'inspiratory' ? 'inspiration' : 'expiration'
          }.`
        : `${hold === 'inspiratory' ? 'Inspiratory' : 'Expiratory'} hold requested; no breath boundary was reached.`,
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
    const rate = deriveEffectiveVentilationRate(
      settings,
      state.patient,
      caseDefinition(state).predictedBodyWeightKg,
    )
    return advanceSimulation({ ...state, paused: true }, 60 / Math.max(1, rate))
  }
  if (action.type === 'SET_SCREEN') {
    return { ...state, ventilator: { ...state.ventilator, screen: action.screen } }
  }
  if (action.type === 'SELECT_MODE') {
    if (state.ventilator.locked) return state
    const descriptor = getVentilatorDeviceProfile(state.deviceId).modes.find(
      (candidate) => candidate.id === action.mode,
    )
    if (!descriptor || descriptor.availability !== 'simulated') {
      return {
        ...state,
        lastResponse:
          descriptor?.availabilityNote ?? 'That mode is not available for this device profile.',
      }
    }
    return {
      ...state,
      ventilator: { ...state.ventilator, pendingMode: action.mode, screen: 'modes' },
      lastResponse: 'Review the selected mode and confirm to apply it at the next breath boundary.',
    }
  }
  if (action.type === 'CONFIRM_MODE') {
    if (state.ventilator.locked || !state.ventilator.pendingMode) {
      return state
    }
    const currentRate = deriveEffectiveVentilationRate(
      state.ventilator.settings,
      state.patient,
      caseDefinition(state).predictedBodyWeightKg,
    )
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
    if (state.ventilator.locked) return state
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
    return {
      ...state,
      ventilator: { ...state.ventilator, oxygenEnrichmentUntil: state.simulationTime + 120 },
      lastResponse: 'O₂ enrichment started for the suction workflow.',
    }
  }
  if (action.type === 'MANUAL_BREATH') {
    return {
      ...state,
      ventilator: { ...state.ventilator, manualBreathUntil: state.simulationTime + 1 },
      lastResponse: 'A manual breath is delivered using the active settings.',
    }
  }
  /*
   * A teaching control, not a device setting: it changes the *patient*, so it is Learn-only. In
   * Practice the case's mechanics are the thing being assessed, and letting a learner soften the
   * lung would resolve the case by editing it.
   */
  if (action.type === 'SET_TEACHING_MECHANICS') {
    if (state.experience !== 'learn') return state
    const teachingMechanics = {
      complianceScale: clampScale(
        action.overrides.complianceScale ?? state.teachingMechanics.complianceScale,
      ),
      resistanceScale: clampScale(
        action.overrides.resistanceScale ?? state.teachingMechanics.resistanceScale,
      ),
    }
    const next = { ...state, teachingMechanics }
    const patient = deriveEffectivePatient(next, caseDefinition(next))
    return {
      ...next,
      patient,
      measurements: deriveMeasurements(next, caseDefinition(next), patient),
    }
  }
  if (action.type === 'PERFORM_HOLD') {
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
      lastResponse: 'Initial frame recorded for comparison with the observed response.',
    }
  }
  if (action.type === 'PERFORM_INTERVENTION') {
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
    return { ...state, phase: 'debrief', paused: true }
  }
  if (action.type === 'TOGGLE_EDUCATOR_OVERLAY') {
    if (state.experience !== 'learn') return state
    return { ...state, showEducatorOverlay: !state.showEducatorOverlay }
  }
  return state
}
