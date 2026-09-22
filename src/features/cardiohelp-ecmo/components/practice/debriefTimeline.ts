import { observeSimulation } from '../../engine/reducer'
import { replayWithoutAction } from '../../engine/counterfactual'
import type {
  ClinicalInterventionEffect,
  EcmoActionObservation,
  EcmoObservation,
  EcmoSimulationState,
} from '../../engine/types'

/**
 * The debrief's "what each action did" account, built from immutable readings (ECMO-FELLOW-02).
 *
 * It used to be recomputed at render time from the live trend buffer, which holds one sample per
 * second and overwrites that second's sample whenever the circuit is recomputed at the same time.
 * So the "before" reading for an action was the state *after* every action taken in that second:
 * starting ECMO read "Circuit flow: unchanged" for a change from 0.00 to 4.05 L/min (C1-3), and a
 * transfusion's MAP read "unchanged" because the patient change it earned lands on the next second
 * (C2-1). Every chip named one number and no pair, and none said what the case would have done
 * without the action.
 *
 * Now every comparison is a named pair of readings the reducer recorded and never recomputes:
 *
 * - **At the action** — the state the action was taken in against the state it produced, at the
 *   same simulation time. Circuit and device can change here; the patient cannot, by the engine's
 *   rule that nothing about the patient changes without the clock.
 * - **Over the modeled interval that followed** — from the state the last action in that second
 *   left, to the state the next action found (or the state at the reveal, when the clock stops).
 *   Everything the case did on its own in that interval is in this change too.
 * - **The same case left untreated, over the same seconds** — a deterministic replay from load with
 *   the clock alone, so the learner can see how much of the interval change the case would have
 *   made anyway.
 *
 * Actions taken in the same second, with no clock advance between them, are grouped and said to be
 * so. No time is invented to spread them out.
 */

export interface DebriefActionEntry {
  readonly id: string
  readonly time: number
  readonly label: string
  /** The authored response line, shown as the case's own description; never a measurement. */
  readonly authoredResponse: string | null
  readonly effect: ClinicalInterventionEffect | null
  readonly observation: EcmoActionObservation | null
}

export interface DebriefSignalChange {
  readonly label: string
  readonly unit: string
  readonly before: string
  readonly after: string
  readonly changed: boolean
}

export interface DebriefTimeGroup {
  readonly time: number
  readonly entries: readonly DebriefActionEntry[]
  /** Modeled seconds between this second's last action and the next action or the reveal. */
  readonly intervalSeconds: number
  readonly intervalEndTime: number
  /** This run, from the last reading of this second to the next reading. Null if never recorded. */
  readonly interval: readonly DebriefSignalChange[] | null
  /** The untreated replay over the same seconds. Null when no modeled time passed. */
  readonly untreated: readonly DebriefSignalChange[] | null
}

interface SignalSpec {
  readonly label: string
  readonly unit: string
  readonly read: (observation: EcmoObservation) => number | null
  readonly digits: number
}

function patientSignals(supportMode: EcmoSimulationState['supportMode']): readonly SignalSpec[] {
  return [
    {
      label: supportMode === 'va' ? 'Right-arm SpO₂' : 'SpO₂',
      unit: '%',
      read: (o) => o.spo2,
      digits: 1,
    },
    ...(supportMode === 'va'
      ? [
          {
            label: 'Femoral SpO₂',
            unit: '%',
            read: (o: EcmoObservation) => o.femoralArterialSpo2,
            digits: 1,
          },
        ]
      : []),
    { label: 'PaCO₂', unit: 'mm Hg', read: (o) => o.paCO2, digits: 0 },
    { label: 'MAP', unit: 'mm Hg', read: (o) => o.meanArterialPressure, digits: 0 },
    { label: 'Lactate', unit: 'mmol/L', read: (o) => o.lactate, digits: 1 },
  ]
}

const CIRCUIT_SIGNALS: readonly SignalSpec[] = [
  { label: 'Circuit flow', unit: 'L/min', read: (o) => o.bloodFlow, digits: 2 },
  { label: 'Drainage pressure (pVen)', unit: 'mm Hg', read: (o) => o.pVen, digits: 0 },
]

function formatReading(value: number | null, digits: number): string {
  return value === null ? 'not shown' : value.toFixed(digits)
}

function compare(
  before: EcmoObservation,
  after: EcmoObservation,
  specs: readonly SignalSpec[],
): DebriefSignalChange[] {
  return specs.map((spec) => {
    const from = formatReading(spec.read(before), spec.digits)
    const to = formatReading(spec.read(after), spec.digits)
    return { label: spec.label, unit: spec.unit, before: from, after: to, changed: from !== to }
  })
}

/** Circuit and device changes produced at the moment of one action. */
export function changesAtAction(observation: EcmoActionObservation): DebriefSignalChange[] {
  const changes = compare(observation.before, observation.after, CIRCUIT_SIGNALS)
  const pumpBefore = observation.before.pumpRunning ? 'running' : 'stopped'
  const pumpAfter = observation.after.pumpRunning ? 'running' : 'stopped'
  return [
    {
      label: 'Pump',
      unit: '',
      before: pumpBefore,
      after: pumpAfter,
      changed: pumpBefore !== pumpAfter,
    },
    ...changes,
  ].filter((change) => change.changed)
}

export function debriefActionEntries(state: EcmoSimulationState): readonly DebriefActionEntry[] {
  const clinical = state.scenario.clinical
  if (clinical) {
    return clinical.appliedInterventions.map((record) => ({
      id: record.id,
      time: record.time,
      label: record.label,
      authoredResponse: record.response,
      effect: record.effect,
      observation: record.observation ?? null,
    }))
  }
  return state.history
    .filter(
      (entry) => entry.kind === 'action' && !/prediction|reassessment|clue/i.test(entry.label),
    )
    .map((entry) => ({
      id: entry.id,
      time: entry.time,
      label: entry.label,
      authoredResponse: null,
      effect: null,
      observation: entry.observation ?? null,
    }))
}

export function buildDebriefTimeline(state: EcmoSimulationState): readonly DebriefTimeGroup[] {
  const entries = debriefActionEntries(state)
  if (entries.length === 0) return []
  const byTime = new Map<number, DebriefActionEntry[]>()
  for (const entry of entries) byTime.set(entry.time, [...(byTime.get(entry.time) ?? []), entry])
  const times = [...byTime.keys()].sort((a, b) => a - b)
  const atReveal = observeSimulation(state)
  const replay = replayWithoutAction(state.scenario.scenarioId, [...times, state.simulationTime])
  const specs = [...CIRCUIT_SIGNALS.slice(0, 1), ...patientSignals(state.supportMode)]

  return times.map((time, index) => {
    const group = byTime.get(time) ?? []
    const nextTime = times[index + 1]
    const intervalEndTime = nextTime ?? state.simulationTime
    const intervalSeconds = Math.max(0, intervalEndTime - time)
    const start = group.at(-1)?.observation?.after ?? null
    const end =
      nextTime === undefined ? atReveal : (byTime.get(nextTime)?.[0]?.observation?.before ?? null)
    const untreatedStart = replay.get(time)
    const untreatedEnd = replay.get(intervalEndTime)
    return {
      time,
      entries: group,
      intervalSeconds,
      intervalEndTime,
      interval: start && end && intervalSeconds > 0 ? compare(start, end, specs) : null,
      untreated:
        untreatedStart && untreatedEnd && intervalSeconds > 0
          ? compare(untreatedStart, untreatedEnd, specs)
          : null,
    }
  })
}

export function describeSignalChange(change: DebriefSignalChange): string {
  const unit = change.unit ? ` ${change.unit}` : ''
  return change.changed
    ? `${change.label} ${change.before} → ${change.after}${unit}`
    : `${change.label} unchanged at ${change.after}${unit}`
}
