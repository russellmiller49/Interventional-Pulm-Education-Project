import { z } from 'zod'
import {
  ventilationExperimentByUnit,
  type LabGoal,
  type LabMetric,
  type LabRound,
} from '../content/learningExperiments'
import { resolveVentilationSimulationCase } from '../content/learningPatient'
import { ventilationLessonAttempt } from '../content/lessonRuntime'
import { plateauReadingValidity } from '../content/plateauValidity'
import { advanceSimulation, createInitialSimulationState } from './simulation'
import { ventilationSimulationReducer } from './reducer'
import {
  ventilatorDeviceIds,
  type VentilationAction,
  type VentilationSimulationState,
  type VentilatorControlKey,
  type VentilatorDeviceId,
  type WaveformSample,
} from './types'

export const VENTILATION_LAB_STORAGE_KEY = 'mechanical-ventilation-live-learning-v1'
export const labMetricLabels: Record<LabMetric, { label: string; unit: string; digits: number }> = {
  peak: { label: 'Peak pressure', unit: 'cmH₂O', digits: 1 },
  plateau: { label: 'Plateau', unit: 'cmH₂O', digits: 1 },
  volume: { label: 'Exhaled volume', unit: 'mL', digits: 0 },
  rate: { label: 'Delivered rate', unit: '/min', digits: 0 },
  minute: { label: 'Minute ventilation', unit: 'L/min', digits: 1 },
  ti: { label: 'Inspiratory time', unit: 's', digits: 2 },
  expiratoryFlow: { label: 'Flow before next breath', unit: 'L/min', digits: 1 },
  intrinsicPeep: { label: 'Intrinsic PEEP', unit: 'cmH₂O', digits: 1 },
  spo2: { label: 'SpO₂', unit: '%', digits: 0 },
  co2: { label: 'Modeled PaCO₂', unit: 'mmHg', digits: 1 },
  map: { label: 'MAP', unit: 'mmHg', digits: 0 },
  effort: { label: 'End-inspiratory effort', unit: 'cmH₂O', digits: 1 },
  missed: { label: 'Missed efforts', unit: '%', digits: 0 },
  dyspnea: { label: 'Dyspnea', unit: '/10', digits: 1 },
  pain: { label: 'Pain', unit: '/10', digits: 1 },
  anxiety: { label: 'Anxiety', unit: '/10', digits: 1 },
}
export interface LabSnapshot {
  readonly values: Record<LabMetric, number>
  readonly plateauValid: boolean
  readonly waveforms: readonly WaveformSample[]
  readonly at: number
}
export function labSnapshot(state: VentilationSimulationState): LabSnapshot {
  const m = state.measurements,
    p = state.patient
  return {
    values: {
      peak: m.peakPressureCmH2O,
      plateau: m.plateauPressureCmH2O,
      volume: m.exhaledVtMl,
      rate: m.totalRatePerMin,
      minute: m.minuteVentilationLMin,
      ti: m.mechanicalInspiratoryTimeSeconds,
      expiratoryFlow: m.expiratoryFlowAtNextBreathLMin,
      intrinsicPeep: m.intrinsicPeepCmH2O,
      spo2: p.gasExchange.spo2Percent,
      co2: p.gasExchange.paCO2MmHg,
      map: p.hemodynamics.mapMmHg,
      effort: m.endInspiratoryEffortCmH2O,
      missed: m.ineffectiveEffortFraction * 100,
      dyspnea: p.human.dyspneaScore,
      pain: p.human.painScore,
      anxiety: p.human.anxietyScore,
    },
    plateauValid: plateauReadingValidity(state).interpretable,
    // Saved reference only. The actual console continues to use all 50 Hz samples.
    waveforms: state.waveforms.filter((_, index) => index % 4 === 0),
    at: state.simulationTime,
  }
}
export function labControlValue(
  state: VentilationSimulationState,
  key: VentilatorControlKey,
): number {
  const s = state.ventilator.settings
  if (key === 'triggerThreshold')
    return s.trigger.type === 'flow' ? s.trigger.thresholdLMin : s.trigger.thresholdCmH2O
  const value = (s as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : 0
}
export function labGoalAction(goal: LabGoal): VentilationAction | null {
  if (goal.type === 'control') return { type: 'SET_CONTROL', control: goal.key, value: goal.value }
  if (goal.type === 'mechanics')
    return { type: 'SET_TEACHING_MECHANICS', overrides: { [goal.key]: goal.value } }
  if (goal.type === 'hold') return { type: 'PERFORM_HOLD', hold: goal.hold }
  if (goal.type === 'intervention') return { type: 'PERFORM_INTERVENTION', interventionId: goal.id }
  return null
}
export type LabPhase = 'explore' | 'predict' | 'experiment' | 'compare' | 'complete'
export interface LabEvidence {
  readonly prediction?: number
  readonly confidence?: 'sure' | 'unsure'
  readonly baseline?: LabSnapshot
  readonly response?: LabSnapshot
  readonly reflection?: string
  readonly completedAt?: string
}
export interface LabEvent {
  readonly at: number
  readonly action: VentilationAction
}
export interface LabCheckpoint {
  readonly version: 1
  readonly unitId: string
  readonly round: 0 | 1
  readonly phase: LabPhase
  readonly device: VentilatorDeviceId
  readonly time: number
  readonly events: readonly LabEvent[]
  readonly evidence: readonly [LabEvidence, LabEvidence]
  readonly observedHolds: readonly ('inspiratory' | 'expiratory')[]
  readonly readySince: number | null
  readonly completedAt?: string
}
export interface LabSession extends LabCheckpoint {
  readonly simulation: VentilationSimulationState
}
export interface LabProgress {
  readonly version: 1
  readonly units: Readonly<Record<string, LabCheckpoint>>
}
export const emptyLabProgress = (): LabProgress => ({ version: 1, units: {} })
export function createLabSimulation(
  unitId: string,
  roundIndex: 0 | 1,
  device: VentilatorDeviceId,
): VentilationSimulationState {
  const round = ventilationExperimentByUnit.get(unitId)!.rounds[roundIndex]
  const attempt =
    round.caseId === 'MV-08'
      ? ventilationLessonAttempt(
          {
            caseId: 'MV-08',
            branch: 'condensate',
            goal: '',
            actions: [],
            requiredEvidence: [],
            responseSeconds: 0,
          },
          1,
        )
      : 1
  let simulation = createInitialSimulationState(round.caseId, 'learn', attempt, device)
  for (const command of round.setup ?? [])
    simulation = ventilationSimulationReducer(simulation, command)
  // Fill a full window with this baseline, including any authored setup changes.
  const warmup = (4 * 60) / simulation.measurements.totalRatePerMin
  simulation = advanceSimulation({ ...simulation, paused: false }, warmup)
  return {
    ...simulation,
    simulationTime: 0,
    waveforms: simulation.waveforms.map((sample) => ({ ...sample, time: sample.time - warmup })),
    trends: [],
    risk: {
      highPlateau: 0,
      stackedVolume: 0,
      dynamicHyperinflation: 0,
      hypoxemia: 0,
      hypotension: 0,
      excessiveSedation: 0,
    },
    criticalErrors: [],
    paused: false,
  }
}
export function createLabSession(
  unitId: string,
  device: VentilatorDeviceId = 'hamilton-c6',
  saved?: LabCheckpoint,
): LabSession {
  if (!saved)
    return {
      version: 1,
      unitId,
      round: 0,
      phase: 'explore',
      device,
      time: 0,
      events: [],
      evidence: [{}, {}],
      observedHolds: [],
      readySince: null,
      simulation: createLabSimulation(unitId, 0, device),
    }
  let simulation = createLabSimulation(unitId, saved.round, saved.device)
  for (const event of saved.events) {
    if (event.at > simulation.simulationTime)
      simulation = advanceSimulation(simulation, event.at - simulation.simulationTime)
    simulation = ventilationSimulationReducer(simulation, event.action)
  }
  if (saved.time > simulation.simulationTime)
    simulation = advanceSimulation(simulation, saved.time - simulation.simulationTime)
  return { ...saved, simulation: { ...simulation, paused: true, speed: 1 } }
}
export function labCheckpoint(session: LabSession): LabCheckpoint {
  const { simulation, ...record } = session
  return { ...record, time: simulation.simulationTime }
}
export function labGoalMet(goal: LabGoal, session: LabSession): boolean {
  if (goal.type === 'control')
    return Math.abs(labControlValue(session.simulation, goal.key) - goal.value) < 0.01
  if (goal.type === 'mechanics')
    return Math.abs(session.simulation.teachingMechanics[goal.key] - goal.value) < 0.01
  if (goal.type === 'hold') return session.observedHolds.includes(goal.hold)
  if (goal.type === 'intervention')
    return (
      session.events.some(
        (event) =>
          event.action.type === 'PERFORM_INTERVENTION' && event.action.interventionId === goal.id,
      ) &&
      session.simulation.interventions.some(
        (item) =>
          item.interventionId === goal.id && item.effectiveAt <= session.simulation.simulationTime,
      )
    )
  const last = session.simulation.waveforms.at(-1)
  return (
    session.simulation.paused &&
    session.simulation.simulationTime >= 4 &&
    last?.phase === 'expiration' &&
    last.flowLMin < -0.1
  )
}
export function labReadyToCompare(session: LabSession): boolean {
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
  return (
    session.phase === 'experiment' &&
    session.readySince !== null &&
    round.goals.every((goal) => labGoalMet(goal, session)) &&
    session.simulation.simulationTime - session.readySince >= round.seconds
  )
}
const viewActions = new Set([
  'TICK',
  'STEP_BREATH',
  'SET_PAUSED',
  'SET_SPEED',
  'SET_SCREEN',
  'TOGGLE_FREEZE',
  'ACK_ALARM',
  'TOGGLE_ALARM_AUDIO',
])
const transientActions = new Set([
  'TICK',
  'STEP_BREATH',
  'SET_PAUSED',
  'SET_SPEED',
  'SET_SCREEN',
  'TOGGLE_ALARM_AUDIO',
])
export type LabAction =
  | { type: 'ENGINE'; action: VentilationAction }
  | { type: 'PREDICT' }
  | { type: 'COMMIT'; choice: number; confidence: 'sure' | 'unsure' }
  | { type: 'COMPARE' }
  | { type: 'REFLECT'; text: string }
  | { type: 'CONTINUE'; now: string }
  | { type: 'RESET' }
  | { type: 'DEVICE'; device: VentilatorDeviceId }
function setEvidence(session: LabSession, value: LabEvidence): readonly [LabEvidence, LabEvidence] {
  return session.round === 0 ? [value, session.evidence[1]] : [session.evidence[0], value]
}
export function learningLabReducer(session: LabSession, action: LabAction): LabSession {
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
  const evidence = session.evidence[session.round]
  if (action.type === 'DEVICE') return createLabSession(session.unitId, action.device)
  if (action.type === 'RESET') {
    const simulation = createLabSimulation(session.unitId, session.round, session.device)
    return {
      ...session,
      phase: evidence.prediction === undefined ? 'explore' : 'experiment',
      time: 0,
      simulation,
      events: [],
      observedHolds: [],
      readySince: null,
      completedAt: undefined,
      evidence: setEvidence(session, {
        prediction: evidence.prediction,
        confidence: evidence.confidence,
        ...(evidence.prediction === undefined ? {} : { baseline: labSnapshot(simulation) }),
      }),
    }
  }
  if (action.type === 'PREDICT' && session.phase === 'explore') {
    // A fresh baseline makes the prediction about an unperformed experiment, even after free exploration.
    const simulation = createLabSimulation(session.unitId, session.round, session.device)
    return {
      ...session,
      simulation,
      phase: 'predict',
      events: [],
      observedHolds: [],
      readySince: null,
      time: 0,
    }
  }
  if (
    action.type === 'COMMIT' &&
    session.phase === 'predict' &&
    [0, 1, 2].includes(action.choice)
  ) {
    return {
      ...session,
      phase: 'experiment',
      evidence: setEvidence(session, {
        ...evidence,
        prediction: evidence.prediction ?? action.choice,
        confidence: evidence.confidence ?? action.confidence,
        baseline: labSnapshot(session.simulation),
      }),
    }
  }
  if (action.type === 'COMPARE' && labReadyToCompare(session))
    return {
      ...session,
      phase: 'compare',
      simulation: { ...session.simulation, paused: true },
      evidence: setEvidence(session, { ...evidence, response: labSnapshot(session.simulation) }),
    }
  if (action.type === 'REFLECT' && session.phase === 'compare')
    return {
      ...session,
      evidence: setEvidence(session, { ...evidence, reflection: action.text.slice(0, 1200) }),
    }
  if (
    action.type === 'CONTINUE' &&
    session.phase === 'compare' &&
    (evidence.reflection?.trim().length ?? 0) >= 12
  ) {
    const nextEvidence = setEvidence(session, { ...evidence, completedAt: action.now })
    if (session.round === 1)
      return { ...session, phase: 'complete', evidence: nextEvidence, completedAt: action.now }
    return {
      ...session,
      round: 1,
      phase: 'explore',
      simulation: createLabSimulation(session.unitId, 1, session.device),
      time: 0,
      events: [],
      observedHolds: [],
      readySince: null,
      evidence: nextEvidence,
    }
  }
  if (action.type !== 'ENGINE') return session
  if (session.phase === 'predict' && !viewActions.has(action.action.type)) return session
  if (
    [
      'LOAD_CASE',
      'CHANGE_DEVICE',
      'REVEAL_DEBRIEF',
      'COMMIT_PREDICTION',
      'COMMIT_REASSESSMENT',
      'TOGGLE_EDUCATOR_OVERLAY',
    ].includes(action.action.type)
  )
    return session
  if (session.events.length >= 512 && !transientActions.has(action.action.type)) return session
  const before = session.simulation
  if (action.action.type === 'TICK' && before.simulationTime >= 900)
    return { ...session, simulation: { ...before, paused: true } }
  const simulation = ventilationSimulationReducer(before, action.action)
  if (simulation === before) return session
  const events = !transientActions.has(action.action.type)
    ? [...session.events, { at: before.simulationTime, action: action.action }]
    : session.events
  const observedHolds =
    simulation.ventilator.holdType &&
    !session.observedHolds.includes(simulation.ventilator.holdType)
      ? [...session.observedHolds, simulation.ventilator.holdType]
      : session.observedHolds
  const next = { ...session, simulation, events, observedHolds, time: simulation.simulationTime }
  if (session.phase !== 'experiment') return next
  const goalsMet = round.goals.every((goal) => labGoalMet(goal, next))
  return {
    ...next,
    readySince: goalsMet ? (session.readySince ?? simulation.simulationTime) : null,
  }
}

const finite = z.number().finite()
const sampleSchema = z.object({
  time: finite,
  pawCmH2O: finite,
  flowLMin: finite,
  volumeMl: finite,
  pmusCmH2O: finite,
  phase: z.enum(['inspiration', 'expiration']),
  triggered: z.boolean(),
  spontaneous: z.boolean(),
})
const snapshotSchema = z.object({
  values: z.object(
    Object.fromEntries(Object.keys(labMetricLabels).map((key) => [key, finite])) as Record<
      LabMetric,
      typeof finite
    >,
  ),
  plateauValid: z.boolean(),
  waveforms: z.array(sampleSchema).max(160),
  at: finite.min(0).max(1000),
})
const evidenceSchema = z.object({
  prediction: z.number().int().min(0).max(2).optional(),
  confidence: z.enum(['sure', 'unsure']).optional(),
  baseline: snapshotSchema.optional(),
  response: snapshotSchema.optional(),
  reflection: z.string().max(1200).optional(),
  completedAt: z.string().datetime().optional(),
})
const smallString = z.string().min(1).max(120)
const eventAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SET_CONTROL'),
    control: smallString,
    value: z.union([finite, smallString, z.boolean()]),
  }),
  z.object({
    type: z.literal('SET_TEACHING_MECHANICS'),
    overrides: z.object({
      complianceScale: finite.min(0.25).max(6).optional(),
      resistanceScale: finite.min(0.25).max(6).optional(),
    }),
  }),
  z.object({ type: z.literal('SELECT_MODE'), mode: smallString }),
  z.object({ type: z.literal('CONFIRM_MODE') }),
  z.object({ type: z.literal('PERFORM_HOLD'), hold: z.enum(['inspiratory', 'expiratory']) }),
  z.object({ type: z.literal('PERFORM_INTERVENTION'), interventionId: smallString }),
  ...(
    ['TOGGLE_LOCK', 'TOGGLE_FREEZE', 'OXYGEN_ENRICHMENT', 'MANUAL_BREATH', 'USE_HINT'] as const
  ).map((type) => z.object({ type: z.literal(type) })),
  z.object({ type: z.literal('ACK_ALARM'), alarmId: smallString.optional() }),
])
const checkpointSchema = z.object({
  version: z.literal(1),
  unitId: smallString,
  round: z.union([z.literal(0), z.literal(1)]),
  phase: z.enum(['explore', 'predict', 'experiment', 'compare', 'complete']),
  device: z.enum(ventilatorDeviceIds),
  time: finite.min(0).max(1000),
  events: z.array(z.object({ at: finite.min(0).max(1000), action: eventAction })).max(512),
  evidence: z.tuple([evidenceSchema, evidenceSchema]),
  observedHolds: z.array(z.enum(['inspiratory', 'expiratory'])).max(2),
  readySince: finite.min(0).max(1000).nullable(),
  completedAt: z.string().datetime().optional(),
})
export function parseLabProgress(raw: string | null): LabProgress {
  if (!raw) return emptyLabProgress()
  try {
    const root = z
      .object({ version: z.literal(1), units: z.record(z.unknown()) })
      .parse(JSON.parse(raw))
    const units: Record<string, LabCheckpoint> = {}
    for (const [id, value] of Object.entries(root.units)) {
      if (!ventilationExperimentByUnit.has(id)) continue
      const parsed = checkpointSchema.safeParse(value)
      if (!parsed.success || parsed.data.unitId !== id) continue
      const p = parsed.data as LabCheckpoint
      let previous = 0
      if (
        p.events.some((event) => {
          const invalid = event.at < previous || event.at > p.time
          previous = event.at
          return invalid
        })
      )
        continue
      if (p.readySince !== null && p.readySince > p.time) continue
      const current = p.evidence[p.round]
      if (
        ['experiment', 'compare', 'complete'].includes(p.phase) &&
        (current.prediction === undefined || !current.baseline)
      )
        continue
      if (['compare', 'complete'].includes(p.phase) && !current.response) continue
      if (p.round === 1 && !p.evidence[0].completedAt) continue
      if (
        (p.phase === 'complete' || p.completedAt) &&
        !p.evidence.every(
          (e) =>
            e.prediction !== undefined &&
            e.baseline &&
            e.response &&
            e.completedAt &&
            (e.reflection?.trim().length ?? 0) >= 12,
        )
      )
        continue
      units[id] = p
    }
    return { version: 1, units }
  } catch {
    return emptyLabProgress()
  }
}
export function labPatientLabel(round: LabRound): string {
  return resolveVentilationSimulationCase(round.caseId).patientDescription
}
