import { advanceMcsSimulation, createInitialMcsState } from './model'
import { isMcsActionIdPermitted, mcsReducer } from './reducer'
import type { McsAction, McsDeviceKind, McsSimulationState } from './types'

/** Authored observation interval, not a clinical stabilization time or mastery criterion. */
export const MCS_OBSERVATION_SECONDS = 8

export function mcsLearningActionId(action: McsAction): string | null {
  switch (action.type) {
    case 'INSPECT':
      return action.id.startsWith('inspect:') ? action.id : `inspect:${action.id}`
    case 'SELECT_DEVICE':
      return `device:select:${action.device}`
    case 'ESCALATE':
      return 'team:escalate'
    case 'SET_PATIENT_CONTROL':
      return (
        (
          {
            preloadPercent: 'patient:set-preload',
            systemicVascularResistanceDynSecCm5: 'patient:set-svr',
            rightVentricularContractility: 'patient:set-rv',
            pulmonaryVascularResistanceWU: 'patient:set-pvr',
          } as Partial<Record<typeof action.control, string>>
        )[action.control] ?? `patient:${action.control}`
      )
    case 'SET_IABP_CONTROL':
      return `iabp:set-${{ assistRatio: 'ratio', triggerSource: 'trigger', inflationOffsetMs: 'inflation', deflationOffsetMs: 'deflation', running: 'running' }[action.control]}`
    case 'SET_IMPELLA_CONTROL':
      return `impella:${action.side ?? 'left'}:set-${{ performanceLevel: 'level', position: 'position', purgeState: 'purge', running: 'running' }[action.control]}`
    case 'SET_IMPELLA_CONFIGURATION':
      return {
        leftVariant: 'impella:set-left-variant',
        leftEnabled: 'impella:enable-left',
        rightEnabled: 'impella:enable-right',
      }[action.control]
    case 'SET_LVAD_CONTROL':
      return `lvad:${{ speedChangeAuthorized: 'authorize-speed', speedRpm: 'set-speed', powerConnected: 'set-power', controllerFault: 'set-controller', suspectedPumpThrombosis: 'set-thrombosis', running: 'set-running' }[action.control]}`
    default:
      return null
  }
}

/** A feature-local intersection; unknown, setup, reset and clock actions fail closed. */
export function isMcsLearningActionPermitted(
  state: McsSimulationState,
  action: McsAction,
  allowed: readonly string[],
  reviewing = false,
): boolean {
  const id = mcsLearningActionId(action)
  if (reviewing || id === null || !allowed.includes(id) || !isMcsActionIdPermitted(state, id))
    return false
  // SELECT_DEVICE's engine path also checks topology; never use it to escape a scenario.
  if (action.type === 'SELECT_DEVICE' && state.scenario) return false
  if (action.type === 'SET_LVAD_CONTROL' && action.control === 'speedRpm') {
    return state.device.kind === 'lvad' && state.device.speedChangeAuthorized
  }
  return true
}

export function applyMcsLearningAction(
  state: McsSimulationState,
  action: McsAction,
  allowed: readonly string[],
  reviewing = false,
) {
  return isMcsLearningActionPermitted(state, action, allowed, reviewing)
    ? mcsReducer(state, action)
    : state
}

export function mcsTeachingSetup(
  device: McsDeviceKind,
  actions: readonly McsAction[] = [],
  seed = 417,
) {
  let state = createInitialMcsState('learn', device, null, seed)
  for (const action of actions) state = mcsReducer(state, action)
  return {
    ...mcsReducer(advanceMcsSimulation(state, MCS_OBSERVATION_SECONDS), {
      type: 'CLEAR_ACTION_LOG',
    }),
    responseMessage: '',
  }
}

export interface McsDeviceComparison {
  readonly referenceId: 'mcs-reference-patient-v1'
  readonly patient: McsSimulationState['patient']
  readonly seed: number
  readonly configuration: McsSimulationState['device']
  readonly observationSeconds: number
  readonly capturedAtSeconds: number
  readonly additionalVariablesChanged: false
  readonly state: McsSimulationState
}

/** SELECT_DEVICE still rebuilds the existing reference patient and retains visit IDs. */
export function captureMcsDeviceComparison(
  state: McsSimulationState,
  device: McsDeviceKind,
): McsDeviceComparison {
  const selected = mcsReducer(state, { type: 'SELECT_DEVICE', device })
  const observed = advanceMcsSimulation(selected, MCS_OBSERVATION_SECONDS)
  return {
    referenceId: 'mcs-reference-patient-v1',
    patient: selected.patient,
    seed: selected.seed,
    configuration: selected.device,
    observationSeconds: MCS_OBSERVATION_SECONDS,
    capturedAtSeconds: observed.timeSeconds,
    additionalVariablesChanged: false,
    state: observed,
  }
}

export function mcsConfigurationLabel(state: McsSimulationState): string {
  const device = state.device
  if (device.kind === 'iabp')
    return `IABP · 1:${device.assistRatio} · ${device.triggerSource.toUpperCase()} · inflation ${device.inflationOffsetMs} ms · deflation ${device.deflationOffsetMs} ms`
  if (device.kind === 'lvad') return `Durable LVAD teaching model · ${device.speedRpm} rpm`
  return `Impella ${device.left.variant === '55' ? '5.5' : 'CP'} · P${device.left.performanceLevel} · ${device.left.position} · right pump ${device.right.enabled ? 'on' : 'off'}`
}

export function mcsObservedDirection(before: number, after: number, digits = 1) {
  const difference = after - before
  return Math.abs(difference) < 10 ** -digits / 2
    ? 'unchanged'
    : difference > 0
      ? 'increased'
      : 'decreased'
}
