import { clamp, measurementMeetsCriterion, roundTo } from './calculations'
import {
  advanceHemodynamicSimulation,
  catheterPositionDepth,
  createInitialHemodynamicState,
  deriveHemodynamicMeasurements,
} from './simulation'
import { generateThermodilutionCurve, thermodilutionAcceptedAverage } from './thermodilution'
import type {
  CatheterPosition,
  HemodynamicAction,
  HemodynamicScoreBreakdown,
  HemodynamicSimulationState,
} from './types'

const catheterSequence: readonly CatheterPosition[] = ['introducer', 'ra', 'rv', 'pa']

function refreshMeasurements(state: HemodynamicSimulationState): HemodynamicSimulationState {
  const measurements = deriveHemodynamicMeasurements(state.parameters, state.measurementSystem)
  return { ...state, measurements }
}

export function calculateHemodynamicScore(
  state: HemodynamicSimulationState,
): HemodynamicScoreBreakdown {
  const signalChecks = new Set(state.signalValidationChecks)
  let signalValidity = 0
  if (state.measurementSystem.zeroed) signalValidity += 5
  if (Math.abs(state.measurementSystem.transducerLevelCm) <= 1) signalValidity += 5
  if (state.measurementSystem.artifact === 'none') signalValidity += 5
  if (signalChecks.has('fast-flush') || signalChecks.has('waveform-valid')) signalValidity += 5

  const mechanism =
    (state.selectedMechanismId === state.caseDefinition.correctMechanismId ? 12 : 0) +
    (state.selectedPriorityId === state.caseDefinition.correctPriorityId ? 8 : 0)

  const required = state.caseDefinition.requiredInterventionIds
  const completedRequired = required.filter((id) =>
    state.completedInterventionIds.includes(id),
  ).length
  const unsafeCount = state.caseDefinition.unsafeInterventionIds.filter((id) =>
    state.completedInterventionIds.includes(id),
  ).length
  const criteriaMet = state.caseDefinition.successCriteria.filter((criterion) =>
    measurementMeetsCriterion(state.measurements, criterion),
  ).length
  const managementBase =
    required.length === 0 ? 15 : (completedRequired / Math.max(1, required.length)) * 15
  const criteriaScore =
    state.caseDefinition.successCriteria.length === 0
      ? 10
      : (criteriaMet / state.caseDefinition.successCriteria.length) * 10
  const management = clamp(managementBase + criteriaScore - unsafeCount * 8, 0, 25)

  const acceptedValid = state.thermodilutionTrials.filter(
    (trial) => trial.accepted === true && trial.quality === 'valid',
  ).length
  const thermodilutionAndDerived =
    (acceptedValid >= state.caseDefinition.thermodilution.minimumAcceptedTrials
      ? 10
      : acceptedValid * 2) + (signalChecks.has('derived-reviewed') ? 5 : 0)

  const reassessmentAndSafety =
    (state.reassessed ? 10 : 0) + (state.criticalErrors.length === 0 ? 10 : 0)

  return {
    signalValidity: roundTo(signalValidity, 0),
    mechanism: roundTo(mechanism, 0),
    management: roundTo(management, 0),
    thermodilutionAndDerived: roundTo(clamp(thermodilutionAndDerived, 0, 15), 0),
    reassessmentAndSafety: roundTo(reassessmentAndSafety, 0),
    total: roundTo(
      signalValidity +
        mechanism +
        management +
        clamp(thermodilutionAndDerived, 0, 15) +
        reassessmentAndSafety,
      0,
    ),
  }
}

export function hasHemodynamicMastery(state: HemodynamicSimulationState): boolean {
  const score = state.score ?? calculateHemodynamicScore(state)
  return score.total >= 80 && state.criticalErrors.length === 0
}

export function icuHemodynamicsReducer(
  state: HemodynamicSimulationState,
  action: HemodynamicAction,
): HemodynamicSimulationState {
  switch (action.type) {
    case 'TICK':
      return advanceHemodynamicSimulation(state, action.seconds)
    case 'RESET_CASE': {
      const next = createInitialHemodynamicState(
        action.definition,
        action.mode ?? state.mode,
        action.seed ?? state.seed,
      )
      return { ...next, workspace: state.workspace }
    }
    case 'SET_MODE': {
      const next = createInitialHemodynamicState(state.caseDefinition, action.mode, state.seed)
      return { ...next, workspace: state.workspace }
    }
    case 'SET_WORKSPACE':
      return { ...state, workspace: action.workspace }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SELECT_MECHANISM':
      return state.predictionCommitted ? state : { ...state, selectedMechanismId: action.id }
    case 'SELECT_PRIORITY':
      return state.predictionCommitted ? state : { ...state, selectedPriorityId: action.id }
    case 'COMMIT_PREDICTION':
      if (!state.selectedMechanismId || !state.selectedPriorityId) return state
      return {
        ...state,
        predictionCommitted: true,
        phase: 'measure',
        responseMessage: 'Prediction locked. Validate the signals before treating the model.',
      }
    case 'SET_CATHETER_POSITION':
      return {
        ...state,
        catheter: {
          ...state.catheter,
          position: action.position,
          insertionDepthCm: catheterPositionDepth(action.position),
          balloonInflated: false,
          wedgeStartedAt: null,
          wedgeCaptureReady: false,
        },
      }
    case 'ADVANCE_CATHETER': {
      const currentIndex = catheterSequence.indexOf(state.catheter.position)
      const nextPosition = catheterSequence[Math.min(catheterSequence.length - 1, currentIndex + 1)]
      return {
        ...state,
        catheter: {
          ...state.catheter,
          position: nextPosition,
          insertionDepthCm: catheterPositionDepth(nextPosition),
          forcedSafetyRecovery: false,
        },
        responseMessage: `Catheter advanced to ${nextPosition.toUpperCase()}. Confirm the waveform before advancing again.`,
      }
    }
    case 'RETRACT_CATHETER': {
      const normalizedPosition =
        state.catheter.position === 'wedge' ? 'pa' : state.catheter.position
      const currentIndex = catheterSequence.indexOf(normalizedPosition)
      const nextPosition = catheterSequence[Math.max(0, currentIndex - 1)]
      return {
        ...state,
        catheter: {
          ...state.catheter,
          position: nextPosition,
          insertionDepthCm: catheterPositionDepth(nextPosition),
          balloonInflated: false,
          wedgeStartedAt: null,
          wedgeCaptureReady: false,
        },
      }
    }
    case 'SET_TRANSDUCER_LEVEL':
      return refreshMeasurements({
        ...state,
        measurementSystem: {
          ...state.measurementSystem,
          transducerLevelCm: clamp(action.levelCm, -20, 20),
        },
      })
    case 'ZERO_TRANSDUCER':
      return refreshMeasurements({
        ...state,
        measurementSystem: {
          ...state.measurementSystem,
          zeroed: true,
          transducerLevelCm: 0,
        },
        signalValidationChecks: [...new Set([...state.signalValidationChecks, 'zero-level'])],
        responseMessage: 'Transducer zero accepted at the phlebostatic axis.',
      })
    case 'SET_DAMPING':
      return refreshMeasurements({
        ...state,
        measurementSystem: {
          ...state.measurementSystem,
          dampingRatio: clamp(action.dampingRatio, 0.15, 1.5),
          artifact:
            action.dampingRatio > 0.95
              ? 'overdamped'
              : action.dampingRatio < 0.4
                ? 'underdamped'
                : 'none',
        },
      })
    case 'SET_ARTIFACT':
      return refreshMeasurements({
        ...state,
        measurementSystem: { ...state.measurementSystem, artifact: action.artifact },
      })
    case 'FAST_FLUSH': {
      const artifact = state.measurementSystem.artifact
      const dampingRatio = state.measurementSystem.dampingRatio
      const finding =
        artifact === 'overdamped' || dampingRatio > 0.95
          ? 'Sluggish return without oscillation: overdamping suspected.'
          : artifact === 'underdamped' || dampingRatio < 0.4
            ? 'Multiple high-frequency oscillations: underdamping suspected.'
            : 'One to two oscillations with prompt return: dynamic response is acceptable.'
      return {
        ...state,
        measurementSystem: {
          ...state.measurementSystem,
          fastFlushActiveUntil: state.timeSeconds + 1.2,
          lastFastFlushFinding: finding,
        },
        signalValidationChecks: [...new Set([...state.signalValidationChecks, 'fast-flush'])],
        responseMessage: finding,
      }
    }
    case 'VALIDATE_SIGNAL':
      return {
        ...state,
        signalValidationChecks: [...new Set([...state.signalValidationChecks, action.check])],
      }
    case 'START_WEDGE': {
      if (state.catheter.position !== 'pa' || state.catheter.balloonInflated) {
        const errorId = state.catheter.balloonInflated
          ? 'overwedge-balloon-reinflation'
          : 'balloon-inflated-before-pa'
        return {
          ...state,
          criticalErrors: [...new Set([...state.criticalErrors, errorId])],
          responseMessage: 'Unsafe balloon inflation blocked. Return to a confirmed PA position.',
        }
      }
      return {
        ...state,
        catheter: {
          ...state.catheter,
          position: 'wedge',
          insertionDepthCm: catheterPositionDepth('wedge'),
          balloonInflated: true,
          wedgeStartedAt: state.timeSeconds,
          wedgeCaptureReady: false,
          wedgeCursorTime: null,
          storedAtEndExpiration: false,
          forcedSafetyRecovery: false,
        },
        responseMessage:
          'Balloon inflated. A 12-second wedge capture is running; deflate promptly after storage.',
      }
    }
    case 'PLACE_WEDGE_CURSOR':
      if (!state.catheter.wedgeCaptureReady) return state
      return {
        ...state,
        catheter: {
          ...state.catheter,
          wedgeCursorTime: state.timeSeconds,
          storedAtEndExpiration: true,
        },
        responseMessage: 'Cursor placed at the modeled end-expiratory point.',
      }
    case 'STORE_WEDGE':
      if (!state.catheter.wedgeCaptureReady || state.catheter.wedgeCursorTime === null) return state
      return {
        ...state,
        catheter: {
          ...state.catheter,
          storedWedgeMmHg: state.measurements.pawpMmHg,
        },
        signalValidationChecks: [...new Set([...state.signalValidationChecks, 'wedge-stored'])],
        responseMessage:
          'PAWP stored. Deflate the balloon now and confirm return of the PA waveform.',
      }
    case 'DEFLATE_WEDGE':
      return {
        ...state,
        catheter: {
          ...state.catheter,
          position: 'pa',
          insertionDepthCm: catheterPositionDepth('pa'),
          balloonInflated: false,
          wedgeStartedAt: null,
          wedgeCaptureReady: false,
        },
        responseMessage: 'Balloon deflated; PA waveform restored.',
      }
    case 'GENERATE_THERMODILUTION_TRIAL': {
      if (state.thermodilutionTrials.length >= state.caseDefinition.thermodilution.maximumTrials) {
        return { ...state, responseMessage: 'Six trials is the maximum for this modeled series.' }
      }
      const sequence = state.thermodilutionTrials.length + 1
      const trial = generateThermodilutionCurve({
        trueCardiacOutputLMin: state.measurements.cardiacOutputLMin,
        technique: action.technique,
        configuration: state.caseDefinition.thermodilution,
        modifiers: {
          tricuspidRegurgitationSeverity: state.parameters.tricuspidRegurgitationSeverity,
          shuntFraction: state.parameters.shuntFraction,
          lowFlowFraction: clamp((3 - state.measurements.cardiacOutputLMin) / 3, 0, 0.8),
          rhythmRegularity: state.parameters.rhythmRegularity,
          catheterPosition: state.catheter.position,
        },
        seed: state.seed,
        sequence,
        generatedAt: state.timeSeconds,
      })
      return {
        ...state,
        thermodilutionTrials: [...state.thermodilutionTrials, trial],
        responseMessage:
          trial.quality === 'valid'
            ? 'Curve generated without an automatic quality alert. Review it before acceptance.'
            : `Curve quality: ${trial.quality}. ${trial.alerts[0] ?? 'Review technique.'}`,
      }
    }
    case 'SET_THERMODILUTION_ACCEPTED': {
      const thermodilutionTrials = state.thermodilutionTrials.map((trial) =>
        trial.id === action.trialId ? { ...trial, accepted: action.accepted } : trial,
      )
      const average = thermodilutionAcceptedAverage(thermodilutionTrials)
      return {
        ...state,
        thermodilutionTrials,
        responseMessage:
          average === null
            ? 'Continue until at least three technically valid accepted trials are available.'
            : `Accepted thermodilution average: ${average.toFixed(1)} L/min.`,
      }
    }
    case 'APPLY_INTERVENTION': {
      if (state.mode === 'practice' && !state.predictionCommitted) return state
      if (
        !action.intervention.repeatable &&
        state.completedInterventionIds.includes(action.intervention.id)
      ) {
        return state
      }
      const effectId = `${action.intervention.id}-${state.activeEffects.length + 1}`
      const criticalErrors =
        action.intervention.critical ||
        state.caseDefinition.safetyCriticalErrorIds.includes(action.intervention.id)
          ? [...new Set([...state.criticalErrors, action.intervention.id])]
          : state.criticalErrors
      const correctedMeasurementSystem =
        action.intervention.id === 'correct-measurement-system'
          ? {
              ...state.measurementSystem,
              zeroed: true,
              transducerLevelCm: 0,
              dampingRatio: 0.65,
              artifact: 'none' as const,
              noiseAmplitudeMmHg: 0.12,
            }
          : state.measurementSystem
      const correctedCatheter =
        action.intervention.id === 'reposition-catheter'
          ? {
              ...state.catheter,
              position: 'pa' as const,
              insertionDepthCm: catheterPositionDepth('pa'),
              balloonInflated: false,
              wedgeStartedAt: null,
              wedgeCaptureReady: false,
            }
          : state.catheter
      const nextState: HemodynamicSimulationState = {
        ...state,
        activeEffects: [
          ...state.activeEffects,
          {
            id: effectId,
            interventionId: action.intervention.id,
            startedAt: state.timeSeconds,
            onsetSeconds: action.intervention.onsetSeconds,
            recoverySeconds: action.intervention.recoverySeconds ?? null,
            deltas: action.intervention.parameterDeltas,
          },
        ],
        completedInterventionIds: [
          ...new Set([...state.completedInterventionIds, action.intervention.id]),
        ],
        criticalErrors,
        measurementSystem: correctedMeasurementSystem,
        catheter: correctedCatheter,
        phase: 'response',
        responseMessage: action.intervention.response,
      }
      return refreshMeasurements(nextState)
    }
    case 'REASSESS':
      return {
        ...state,
        reassessed: true,
        phase: 'reassess',
        responseMessage: 'Serial perfusion, pressure, flow, and signal validity reassessed.',
      }
    case 'COMPLETE_CASE': {
      const scored = { ...state, phase: 'debrief' as const, completed: true }
      return { ...scored, score: calculateHemodynamicScore(scored) }
    }
    case 'TOGGLE_FREEZE':
      return { ...state, frozen: !state.frozen }
    case 'SET_SWEEP':
      return { ...state, sweepSeconds: action.seconds }
    case 'SET_PRESSURE_SCALE':
      return { ...state, pressureScaleMmHg: action.maximum }
    case 'TOGGLE_PV_LOOPS':
      return { ...state, showPressureVolumeLoops: !state.showPressureVolumeLoops }
    case 'ACKNOWLEDGE_ALARMS':
      return {
        ...state,
        alarms: state.alarms.map((alarm) => ({ ...alarm, acknowledged: true })),
      }
    default:
      return state
  }
}
