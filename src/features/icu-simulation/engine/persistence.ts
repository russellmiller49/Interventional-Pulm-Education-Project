import { z } from 'zod'

import { applyIcuCommand, createIcuSimulation } from './simulation'
import {
  ICU_CONTENT_VERSION,
  ICU_ENGINE_VERSION,
  ICU_MAX_REPLAY_COMMANDS,
  icuAssessmentIds,
  icuCareInterventionIds,
  icuScenarioFamilies,
  icuShockClassifications,
  icuSimulationModes,
  type IcuReplayRecord,
  type IcuScenarioDefinition,
  type IcuScenarioFamily,
  type IcuSimulationMode,
  type IcuSimulationState,
} from './types'

export const ICU_SIMULATION_PROGRESS_STORAGE_KEY = 'icu-simulation-progress-v1' as const
export const ICU_SIMULATION_SESSION_STORAGE_KEY = 'icu-simulation-session-v1' as const
export const ICU_SIMULATION_PROGRESS_VERSION = 1 as const
export const ICU_SYNTHETIC_SESSION_VERSION = 1 as const

const stableId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const controlSchema = z.enum([
  'mode',
  'tidal-volume-ml',
  'rate-per-min',
  'peep-cmh2o',
  'fio2',
  'inspiratory-pressure-cmh2o',
  'pressure-support-cmh2o',
  'rpm',
  'blood-flow-l-min',
  'sweep-l-min',
  'gas-fio2',
  'assist-ratio',
  'performance-level',
  'inflation-offset-ms',
  'deflation-offset-ms',
  'position',
  'purge-state',
  'blood-flow-ml-min',
  'dialysate-ml-hour',
  'replacement-ml-hour',
  'patient-fluid-removal-ml-hour',
])
const driverSchema = z.enum([
  'vasoplegiaSeverity',
  'leftVentricularFailureSeverity',
  'rightVentricularFailureSeverity',
  'pulmonaryVascularObstructionSeverity',
  'tamponadePressureMmHg',
  'lungInjurySeverity',
  'acuteKidneyInjurySeverity',
  'bleedingRateMlHour',
  'infectionBurden',
])
const therapySchema = z.enum(['ventilator', 'ecmo', 'mcs', 'crrt'])
const reassessmentSchema = z.enum(['hemodynamics', 'respiratory', 'renal', 'perfusion', 'devices'])

export const icuCommandSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('assessment.order'), assessmentId: z.enum(icuAssessmentIds) })
    .strict(),
  z
    .object({
      type: z.literal('diagnosis.commit'),
      classification: z.enum(icuShockClassifications),
    })
    .strict(),
  z
    .object({
      type: z.literal('therapy.prepare'),
      therapy: therapySchema,
      configuration: stableId.optional(),
    })
    .strict(),
  z.object({ type: z.literal('therapy.start'), therapy: therapySchema }).strict(),
  z.object({ type: z.literal('therapy.stop'), therapy: therapySchema }).strict(),
  z
    .object({
      type: z.literal('therapy.adjust'),
      therapy: therapySchema,
      control: controlSchema,
      value: z.union([z.number().finite(), stableId, z.boolean()]),
    })
    .strict(),
  z
    .object({ type: z.literal('care.perform'), interventionId: z.enum(icuCareInterventionIds) })
    .strict(),
  z.object({ type: z.literal('alarm.acknowledge'), alarmId: stableId }).strict(),
  z
    .object({
      type: z.literal('patient.reassess'),
      domains: z.array(reassessmentSchema).min(1).max(5),
    })
    .strict(),
  z
    .object({
      type: z.literal('sandbox.adjust'),
      driver: driverSchema,
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({ type: z.literal('time.advance'), seconds: z.number().int().min(1).max(86_400) })
    .strict(),
  z.object({ type: z.literal('session.complete') }).strict(),
])

const replayCommandSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    issuedAtSeconds: z.number().int().nonnegative().max(86_400),
    command: icuCommandSchema,
  })
  .strict()

export const icuReplayRecordSchema = z
  .object({
    version: z.literal(1),
    engineVersion: z.literal(ICU_ENGINE_VERSION),
    contentVersion: z.literal(ICU_CONTENT_VERSION),
    scenarioId: z.enum(icuScenarioFamilies),
    scenarioVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    mode: z.enum(icuSimulationModes),
    seed: z.number().int().nonnegative().max(0xffffffff),
    commands: z.array(replayCommandSchema).max(ICU_MAX_REPLAY_COMMANDS),
  })
  .strict()
  .superRefine((record, context) => {
    let previousTime = 0
    record.commands.forEach((command, index) => {
      if (command.sequence !== index) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Replay command sequence must be contiguous.',
        })
      }
      if (command.issuedAtSeconds < previousTime) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Replay command times must be monotonic.',
        })
      }
      previousTime = command.issuedAtSeconds
    })
  })

const scoreRecordSchema = z
  .record(z.enum(icuScenarioFamilies), z.number().int().min(0).max(100))
  .default({})
const countRecordSchema = z
  .record(z.enum(icuScenarioFamilies), z.number().int().min(0).max(10_000))
  .default({})

const progressSchema = z
  .object({
    version: z.literal(ICU_SIMULATION_PROGRESS_VERSION),
    engineVersion: z.literal(ICU_ENGINE_VERSION),
    contentVersion: z.literal(ICU_CONTENT_VERSION),
    lastScenarioId: z.enum(icuScenarioFamilies),
    lastMode: z.enum(icuSimulationModes),
    completedScenarioIds: z.array(z.enum(icuScenarioFamilies)).max(6),
    masteredScenarioIds: z.array(z.enum(icuScenarioFamilies)).max(6),
    attempts: countRecordSchema,
    bestSafeScores: scoreRecordSchema,
    criticalErrorAttempts: countRecordSchema,
  })
  .strict()
  .superRefine((progress, context) => {
    const duplicate = (items: readonly string[]) => new Set(items).size !== items.length
    if (duplicate(progress.completedScenarioIds) || duplicate(progress.masteredScenarioIds)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Progress IDs must be unique.' })
    }
    if (progress.masteredScenarioIds.some((id) => !progress.completedScenarioIds.includes(id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mastered scenarios must also be completed.',
      })
    }
    for (const [id, count] of Object.entries(progress.criticalErrorAttempts)) {
      if (count > (progress.attempts[id as IcuScenarioFamily] ?? 0)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Critical-error attempts cannot exceed total attempts.',
        })
      }
    }
  })

export interface IcuSimulationProgressV1 {
  readonly version: 1
  readonly engineVersion: typeof ICU_ENGINE_VERSION
  readonly contentVersion: typeof ICU_CONTENT_VERSION
  readonly lastScenarioId: IcuScenarioFamily
  readonly lastMode: IcuSimulationMode
  readonly completedScenarioIds: readonly IcuScenarioFamily[]
  readonly masteredScenarioIds: readonly IcuScenarioFamily[]
  readonly attempts: Readonly<Partial<Record<IcuScenarioFamily, number>>>
  readonly bestSafeScores: Readonly<Partial<Record<IcuScenarioFamily, number>>>
  readonly criticalErrorAttempts: Readonly<Partial<Record<IcuScenarioFamily, number>>>
}

export interface IcuSyntheticSessionV1 {
  readonly version: 1
  readonly replay: IcuReplayRecord
}

export interface IcuStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

const syntheticSessionSchema = z
  .object({ version: z.literal(ICU_SYNTHETIC_SESSION_VERSION), replay: icuReplayRecordSchema })
  .strict()

export function createDefaultIcuProgress(): IcuSimulationProgressV1 {
  return {
    version: 1,
    engineVersion: ICU_ENGINE_VERSION,
    contentVersion: ICU_CONTENT_VERSION,
    lastScenarioId: 'septic-ards-aki',
    lastMode: 'practice',
    completedScenarioIds: [],
    masteredScenarioIds: [],
    attempts: {},
    bestSafeScores: {},
    criticalErrorAttempts: {},
  }
}

export function parseIcuProgress(
  serialized: string | null | undefined,
): IcuSimulationProgressV1 | null {
  if (!serialized) return null
  try {
    const result = progressSchema.safeParse(JSON.parse(serialized) as unknown)
    return result.success ? (result.data as IcuSimulationProgressV1) : null
  } catch {
    return null
  }
}

export function serializeIcuProgress(progress: IcuSimulationProgressV1): string {
  return JSON.stringify(progressSchema.parse(progress))
}

export function readIcuProgress(storage: IcuStorageLike): IcuSimulationProgressV1 {
  try {
    return (
      parseIcuProgress(storage.getItem(ICU_SIMULATION_PROGRESS_STORAGE_KEY)) ??
      createDefaultIcuProgress()
    )
  } catch {
    return createDefaultIcuProgress()
  }
}

export function writeIcuProgress(
  storage: IcuStorageLike,
  progress: IcuSimulationProgressV1,
): boolean {
  try {
    storage.setItem(ICU_SIMULATION_PROGRESS_STORAGE_KEY, serializeIcuProgress(progress))
    return true
  } catch {
    return false
  }
}

export function recordIcuScenarioResult(
  progress: IcuSimulationProgressV1,
  state: IcuSimulationState,
): IcuSimulationProgressV1 {
  if (!icuScenarioFamilies.includes(state.scenarioId as IcuScenarioFamily)) return progress
  const scenarioId = state.scenarioId as IcuScenarioFamily
  if (state.mode === 'learn' || state.mode === 'sandbox') {
    return progressSchema.parse({
      ...progress,
      lastScenarioId: scenarioId,
      lastMode: state.mode,
    }) as IcuSimulationProgressV1
  }
  const attempts = (progress.attempts[scenarioId] ?? 0) + 1
  const hasCriticalError = state.outcome.criticalErrorIds.length > 0
  return progressSchema.parse({
    ...progress,
    lastScenarioId: scenarioId,
    lastMode: state.mode,
    completedScenarioIds: state.outcome.completed
      ? [...new Set([...progress.completedScenarioIds, scenarioId])]
      : progress.completedScenarioIds,
    masteredScenarioIds:
      state.mode === 'assess' && state.outcome.mastery
        ? [...new Set([...progress.masteredScenarioIds, scenarioId])]
        : progress.masteredScenarioIds,
    attempts: { ...progress.attempts, [scenarioId]: attempts },
    bestSafeScores: hasCriticalError
      ? progress.bestSafeScores
      : {
          ...progress.bestSafeScores,
          [scenarioId]: Math.max(
            progress.bestSafeScores[scenarioId] ?? 0,
            state.outcome.score.total,
          ),
        },
    criticalErrorAttempts: {
      ...progress.criticalErrorAttempts,
      [scenarioId]: (progress.criticalErrorAttempts[scenarioId] ?? 0) + (hasCriticalError ? 1 : 0),
    },
  }) as IcuSimulationProgressV1
}

export function parseIcuReplayRecord(value: unknown): IcuReplayRecord | null {
  const result = icuReplayRecordSchema.safeParse(value)
  return result.success ? (result.data as IcuReplayRecord) : null
}

export function createIcuSyntheticSession(state: IcuSimulationState): IcuSyntheticSessionV1 {
  return syntheticSessionSchema.parse({ version: 1, replay: state.replay }) as IcuSyntheticSessionV1
}

export function parseIcuSyntheticSession(
  serialized: string | null | undefined,
): IcuSyntheticSessionV1 | null {
  if (!serialized) return null
  try {
    const result = syntheticSessionSchema.safeParse(JSON.parse(serialized) as unknown)
    return result.success ? (result.data as IcuSyntheticSessionV1) : null
  } catch {
    return null
  }
}

export function writeIcuSyntheticSession(
  storage: IcuStorageLike,
  state: IcuSimulationState,
): boolean {
  try {
    storage.setItem(
      ICU_SIMULATION_SESSION_STORAGE_KEY,
      JSON.stringify(createIcuSyntheticSession(state)),
    )
    return true
  } catch {
    return false
  }
}

export function readIcuSyntheticSession(storage: IcuStorageLike): IcuSyntheticSessionV1 | null {
  try {
    return parseIcuSyntheticSession(storage.getItem(ICU_SIMULATION_SESSION_STORAGE_KEY))
  } catch {
    return null
  }
}

export function clearIcuSyntheticSession(storage: IcuStorageLike): void {
  try {
    storage.removeItem?.(ICU_SIMULATION_SESSION_STORAGE_KEY)
  } catch {
    // Optional local resume must never interrupt the simulator.
  }
}

export function resumeIcuSyntheticSession(
  session: IcuSyntheticSessionV1,
  scenario: IcuScenarioDefinition,
): IcuSimulationState {
  const parsed = syntheticSessionSchema.parse(session) as IcuSyntheticSessionV1
  const replay = parsed.replay
  if (replay.scenarioId !== scenario.id || replay.scenarioVersion !== scenario.version)
    throw new Error('Synthetic-session scenario version is incompatible.')
  let state = createIcuSimulation(scenario, { mode: replay.mode, seed: replay.seed })
  for (const record of replay.commands) {
    if (record.issuedAtSeconds !== state.clock.elapsedSeconds)
      throw new Error('Synthetic-session replay timing is inconsistent.')
    state = applyIcuCommand(state, scenario, record.command)
  }
  return state
}
