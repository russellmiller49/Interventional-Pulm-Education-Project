import { z } from 'zod'

import {
  criticalCareActivityPhases,
  criticalCareActivityModes,
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'

import { createInitialSimulationState } from './simulation'
import { ventilationSimulationReducer } from './reducer'
import {
  ventilatorDeviceIds,
  type LearningExperience,
  type VentilationAction,
  type VentilationSimulationState,
  type VentilatorDeviceId,
} from './types'

export const MECHANICAL_VENTILATION_SESSION_STORAGE_KEY = 'mechanical-ventilation-session-v1'
export const MECHANICAL_VENTILATION_SESSION_VERSION = 1 as const
export const MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION = 'ventilation-semantic-v1'

const replayActionTypes = [
  'SELECT_MODE',
  'CONFIRM_MODE',
  'SET_CONTROL',
  'TOGGLE_LOCK',
  'ACK_ALARM',
  'OXYGEN_ENRICHMENT',
  'MANUAL_BREATH',
  'PERFORM_HOLD',
  'COMMIT_PREDICTION',
  'PERFORM_INTERVENTION',
  'USE_HINT',
  'COMMIT_REASSESSMENT',
  'REVEAL_DEBRIEF',
] as const

type VentilationReplayActionType = (typeof replayActionTypes)[number]

export type VentilationReplayAction = Extract<
  VentilationAction,
  { type: VentilationReplayActionType }
>

export interface VentilationReplayEvent {
  readonly atSimulationSeconds: number
  readonly action: VentilationReplayAction
}

export interface MechanicalVentilationSessionV1 {
  readonly version: 1
  readonly payloadVersion: typeof MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION
  readonly activityId: string
  readonly caseId: string
  readonly deviceId: VentilatorDeviceId
  readonly activityMode: CriticalCareActivityMode
  readonly experience: LearningExperience
  readonly activityPhase: CriticalCareActivityPhase
  readonly attempt: number
  readonly engineSeed: number
  readonly simulationTime: number
  readonly events: readonly VentilationReplayEvent[]
  readonly updatedAt: string
}

export interface VentilationSessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

const boundedString = z.string().min(1).max(160)
const replayActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SELECT_MODE'), mode: boundedString }).strict(),
  z.object({ type: z.literal('CONFIRM_MODE') }).strict(),
  z
    .object({
      type: z.literal('SET_CONTROL'),
      control: boundedString,
      value: z.union([z.number().finite(), boundedString, z.boolean()]),
    })
    .strict(),
  z.object({ type: z.literal('TOGGLE_LOCK') }).strict(),
  z.object({ type: z.literal('ACK_ALARM'), alarmId: boundedString.optional() }).strict(),
  z.object({ type: z.literal('OXYGEN_ENRICHMENT') }).strict(),
  z.object({ type: z.literal('MANUAL_BREATH') }).strict(),
  z
    .object({ type: z.literal('PERFORM_HOLD'), hold: z.enum(['inspiratory', 'expiratory']) })
    .strict(),
  z
    .object({
      type: z.literal('COMMIT_PREDICTION'),
      mechanismId: boundedString,
      priorityId: boundedString,
      responseId: boundedString,
    })
    .strict(),
  z.object({ type: z.literal('PERFORM_INTERVENTION'), interventionId: boundedString }).strict(),
  z.object({ type: z.literal('USE_HINT') }).strict(),
  z.object({ type: z.literal('COMMIT_REASSESSMENT') }).strict(),
  z.object({ type: z.literal('REVEAL_DEBRIEF') }).strict(),
])

const sessionSchema = z
  .object({
    version: z.literal(MECHANICAL_VENTILATION_SESSION_VERSION),
    payloadVersion: z.literal(MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION),
    activityId: z.string().regex(/^ventilation:(practice|assess):[a-zA-Z0-9-]+$/),
    caseId: z.string().regex(/^MV-\d{2}$/),
    deviceId: z.enum(ventilatorDeviceIds),
    activityMode: z.enum(criticalCareActivityModes),
    experience: z.enum(['learn', 'practice']),
    activityPhase: z.enum(criticalCareActivityPhases),
    attempt: z.number().int().min(1).max(10_000),
    engineSeed: z.number().int().nonnegative(),
    simulationTime: z.number().finite().min(0).max(7_200),
    events: z
      .array(
        z
          .object({
            atSimulationSeconds: z.number().finite().min(0).max(7_200),
            action: replayActionSchema,
          })
          .strict(),
      )
      .max(512),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((session, context) => {
    if (
      (session.activityMode === 'guided' && session.experience !== 'learn') ||
      (session.activityMode !== 'guided' && session.experience !== 'practice')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['experience'],
        message: 'Activity mode and engine experience are incompatible.',
      })
    }

    let previous = 0
    for (const [index, event] of session.events.entries()) {
      if (
        event.atSimulationSeconds < previous ||
        event.atSimulationSeconds > session.simulationTime
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', index, 'atSimulationSeconds'],
          message: 'Replay events must be ordered within the saved simulation time.',
        })
      }
      previous = event.atSimulationSeconds
    }
  })

export function isVentilationReplayAction(
  action: VentilationAction,
): action is VentilationReplayAction {
  return (replayActionTypes as readonly string[]).includes(action.type)
}

export function parseMechanicalVentilationSession(
  serialized: string | null | undefined,
): MechanicalVentilationSessionV1 | null {
  if (!serialized) return null
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(serialized) as unknown)
    return parsed.success ? (parsed.data as MechanicalVentilationSessionV1) : null
  } catch {
    return null
  }
}

export function readMechanicalVentilationSession(
  storage: VentilationSessionStorageLike | null,
): MechanicalVentilationSessionV1 | null {
  if (!storage) return null
  try {
    return parseMechanicalVentilationSession(
      storage.getItem(MECHANICAL_VENTILATION_SESSION_STORAGE_KEY),
    )
  } catch {
    return null
  }
}

export function writeMechanicalVentilationSession(
  storage: VentilationSessionStorageLike | null,
  session: MechanicalVentilationSessionV1,
): boolean {
  if (!storage) return false
  const parsed = sessionSchema.safeParse(session)
  if (!parsed.success) return false
  try {
    storage.setItem(MECHANICAL_VENTILATION_SESSION_STORAGE_KEY, JSON.stringify(parsed.data))
    return true
  } catch {
    return false
  }
}

export function clearMechanicalVentilationSession(
  storage: VentilationSessionStorageLike | null,
): void {
  if (!storage) return
  try {
    storage.removeItem?.(MECHANICAL_VENTILATION_SESSION_STORAGE_KEY)
  } catch {
    // Optional replay storage must never interrupt the simulator.
  }
}

export function createMechanicalVentilationSession(input: {
  readonly activityId: string
  readonly state: VentilationSimulationState
  readonly activityMode: CriticalCareActivityMode
  readonly activityPhase: CriticalCareActivityPhase
  readonly attempt: number
  readonly events: readonly VentilationReplayEvent[]
  readonly now?: string
}): MechanicalVentilationSessionV1 {
  return sessionSchema.parse({
    version: MECHANICAL_VENTILATION_SESSION_VERSION,
    payloadVersion: MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION,
    activityId: input.activityId,
    caseId: input.state.caseId,
    deviceId: input.state.deviceId,
    activityMode: input.activityMode,
    experience: input.state.experience,
    activityPhase: input.activityPhase,
    attempt: input.attempt,
    engineSeed: input.state.seed,
    simulationTime: input.state.simulationTime,
    events: input.events,
    updatedAt: input.now ?? new Date().toISOString(),
  }) as MechanicalVentilationSessionV1
}

function advanceReplayTo(
  state: VentilationSimulationState,
  simulationTime: number,
): VentilationSimulationState | null {
  const delta = simulationTime - state.simulationTime
  if (delta < -0.001) return null
  if (delta <= 0.001) return state
  let next = ventilationSimulationReducer(state, { type: 'SET_SPEED', speed: 1 })
  next = ventilationSimulationReducer(next, { type: 'SET_PAUSED', paused: false })
  next = ventilationSimulationReducer(next, { type: 'TICK', seconds: delta })
  return ventilationSimulationReducer(next, { type: 'SET_PAUSED', paused: true })
}

export function replayMechanicalVentilationSession(
  session: MechanicalVentilationSessionV1,
): VentilationSimulationState | null {
  let state = createInitialSimulationState(
    session.caseId,
    session.experience,
    session.attempt,
    session.deviceId,
  )
  if (state.seed !== session.engineSeed) return null

  for (const event of session.events) {
    const advanced = advanceReplayTo(state, event.atSimulationSeconds)
    if (!advanced) return null
    state = ventilationSimulationReducer(advanced, event.action)
  }

  const restored = advanceReplayTo(state, session.simulationTime)
  if (!restored) return null
  return ventilationSimulationReducer(restored, { type: 'SET_PAUSED', paused: true })
}
