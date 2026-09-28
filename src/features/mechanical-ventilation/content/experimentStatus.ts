/**
 * Where a Learn experiment stands, in the learner's words — one projection of the lab session.
 *
 * The walkthrough (N7) found an experiment that opened paused, a slider that did nothing visible,
 * a Capture button that stayed disabled until Run was found "in a different panel", and a status
 * line in engine language: "The requested action is present. Check the measurement status and
 * response interval." — plus "Observe for 0 simulated seconds" where nothing had to be observed.
 *
 * Nothing here decides anything new. Whether a goal is met is `labGoalMet`; whether a result may be
 * captured is `labReadyToCompare`; the response interval is the round's own `seconds`, counted in
 * model time from the session's own `readySince`. This file only names the state those already
 * define, so the panel beside the task and the capture gate cannot disagree.
 */
import { labGoalMet, labReadyToCompare, type LabSession } from '../engine/learningLab'
import { ventilationExperimentByUnit, type LabGoal } from './learningExperiments'
import { labGoalPhrase } from './stageLessons'

export type ExperimentStage =
  /** The round is not in its experiment phase (explored freely, or reset before a prediction). */
  | 'not-started'
  /** At least one requested change or maneuver is not in place. */
  | 'awaiting-action'
  /** A requested hold has not finished, or the last one cannot be used for this task. */
  | 'awaiting-measurement'
  /** A bedside action was selected and its modeled effect has not started yet. */
  | 'awaiting-effect'
  /** Everything requested is in place; the response interval is still running. */
  | 'awaiting-interval'
  /** The result may be captured now. */
  | 'ready'
  /** A result has been captured for this application. */
  | 'captured'

export type ExperimentGoalState = 'done' | 'in-progress' | 'to-do' | 'repeat'

export interface ExperimentGoalStatus {
  readonly goal: LabGoal
  /** Lower-case phrase: "set the inspiratory flow to 60 L/min". */
  readonly label: string
  readonly state: ExperimentGoalState
  readonly note?: string
}

export interface ExperimentStatus {
  readonly stage: ExperimentStage
  /** True while model time is advancing. */
  readonly running: boolean
  readonly goals: readonly ExperimentGoalStatus[]
  /** The round's response interval in model seconds; 0 when nothing has to be observed. */
  readonly intervalSeconds: number
  /** Model seconds since everything requested was in place, capped at the interval; null before. */
  readonly elapsedSeconds: number | null
  readonly canCapture: boolean
  /** Model time of the captured result, when there is one. */
  readonly capturedAtSeconds: number | null
  /** One short sentence for the panel. */
  readonly headline: string
  /**
   * A stable phrase for a polite live region. It changes only when the stage or the run state
   * changes — never with the interval count — so assistive technology hears transitions, not ticks.
   */
  readonly announcement: string
}

function holdGoalState(
  session: LabSession,
  goal: Extract<LabGoal, { type: 'hold' }>,
): Pick<ExperimentGoalStatus, 'state' | 'note'> {
  if (labGoalMet(goal, session)) return { state: 'done' }
  const ventilator = session.simulation.ventilator
  if (ventilator.pendingHold === goal.hold)
    return { state: 'in-progress', note: 'requested; the valves close at the next breath boundary' }
  if (ventilator.holdType === goal.hold)
    return { state: 'in-progress', note: 'running; the reading completes when the valves reopen' }
  const revision = session.conditionRevision ?? 0
  const sameType = (session.holds ?? []).filter((hold) => hold.hold === goal.hold)
  const current = sameType.filter((hold) => hold.revision === revision).at(-1)
  if (current && !current.interpretable)
    return {
      state: 'repeat',
      note: 'the last hold was not interpretable for this task; repeat it with the patient quiet',
    }
  if (sameType.length > 0)
    return { state: 'to-do', note: 'the last hold was taken before a later change; repeat it' }
  return { state: 'to-do' }
}

function goalStatus(session: LabSession, goal: LabGoal): ExperimentGoalStatus {
  const label = labGoalPhrase(goal)
  if (goal.type === 'hold') return { goal, label, ...holdGoalState(session, goal) }
  if (labGoalMet(goal, session)) return { goal, label, state: 'done' }
  if (goal.type === 'intervention') {
    const record = session.simulation.interventions.find((item) => item.interventionId === goal.id)
    if (record) {
      const wait = Math.max(0, record.effectiveAt - session.simulation.simulationTime)
      return {
        goal,
        label,
        state: 'in-progress',
        note: `selected; its modeled effect starts in ${Math.ceil(wait)} s of model time`,
      }
    }
  }
  return { goal, label, state: 'to-do' }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function ventilationExperimentStatus(session: LabSession): ExperimentStatus {
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
  const evidence = session.evidence[session.round]
  const running = !session.simulation.paused
  const goals = round.goals.map((goal) => goalStatus(session, goal))
  const intervalSeconds = Math.max(0, round.seconds)
  const now = session.simulation.simulationTime
  const canCapture = labReadyToCompare(session)
  const base = { running, goals, intervalSeconds, canCapture }

  if (evidence.response)
    return {
      ...base,
      stage: 'captured',
      elapsedSeconds: null,
      capturedAtSeconds: evidence.response.at,
      headline: `Result captured at ${evidence.response.at.toFixed(1)} s of model time. Reset the patient to repeat it.`,
      announcement: 'Result captured.',
    }

  if (session.phase !== 'experiment')
    return {
      ...base,
      stage: 'not-started',
      elapsedSeconds: null,
      capturedAtSeconds: null,
      headline: 'Not started. Start the experiment from its baseline to record a result.',
      announcement: 'Experiment not started.',
    }

  const pausedOrRunning = running ? 'Running' : 'Paused'
  const next = goals.find((goal) => goal.state === 'to-do' || goal.state === 'repeat')
  if (next)
    return {
      ...base,
      stage: next.state === 'repeat' ? 'awaiting-measurement' : 'awaiting-action',
      elapsedSeconds: null,
      capturedAtSeconds: null,
      headline: `${pausedOrRunning}. Next: ${next.label}.`,
      announcement: `${pausedOrRunning}. Waiting for: ${next.label}.`,
    }

  const hold = goals.find((goal) => goal.goal.type === 'hold' && goal.state === 'in-progress')
  if (hold)
    return {
      ...base,
      stage: 'awaiting-measurement',
      elapsedSeconds: null,
      capturedAtSeconds: null,
      headline: running
        ? `Hold ${hold.note}.`
        : `Hold ${hold.note}. It happens only while the experiment runs.`,
      announcement: running ? 'Hold in progress.' : 'Hold requested; paused.',
    }

  const effect = goals.find((goal) => goal.state === 'in-progress')
  if (effect)
    return {
      ...base,
      stage: 'awaiting-effect',
      elapsedSeconds: null,
      capturedAtSeconds: null,
      headline: `${capitalize(effect.label)}: ${effect.note}.${running ? '' : ' Model time advances only while the experiment runs.'}`,
      announcement: running
        ? 'Waiting for the modeled effect.'
        : 'Waiting for the modeled effect; paused.',
    }

  if (canCapture)
    return {
      ...base,
      stage: 'ready',
      elapsedSeconds: intervalSeconds,
      capturedAtSeconds: null,
      headline:
        intervalSeconds > 0
          ? `Ready to capture. Everything requested is in place and ${intervalSeconds} s of model time have passed.`
          : 'Ready to capture. Everything requested is in place.',
      announcement: 'Result ready to capture.',
    }

  const elapsed = Math.min(intervalSeconds, Math.max(0, now - (session.readySince ?? now)))
  return {
    ...base,
    stage: 'awaiting-interval',
    elapsedSeconds: elapsed,
    capturedAtSeconds: null,
    headline: running
      ? `Running. Response interval ${elapsed.toFixed(1)} of ${intervalSeconds} s of model time.`
      : `Change in place. Run the experiment to let the patient respond: ${elapsed.toFixed(1)} of ${intervalSeconds} s so far.`,
    announcement: running
      ? 'Change in place; response interval running.'
      : 'Change in place; paused. Run the experiment to continue.',
  }
}
