/**
 * "Run N s and capture" (`RUN_AND_CAPTURE`): one click runs the response interval and captures, and
 * what it records is exactly what a live run would have recorded.
 */
import { ventilationLearningExperiments, type LabGoal } from '../content/learningExperiments'
import {
  createLabSession,
  labGoalAction,
  labGoalMet,
  labReadyToCompare,
  learningLabReducer,
  runResponseInterval,
  ventilationBreathPeriodSeconds,
  type LabAction,
  type LabSession,
} from '../engine/learningLab'
import { completedBreath } from '../engine/teachingBreath'
import { ventilatorDeviceIds, type VentilationAction } from '../engine/types'

// Each case runs the real engine for up to a few simulated minutes, on four consoles.
jest.setTimeout(30_000)

const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })
const tick = engine({ type: 'TICK', seconds: 0.1 })

function started(unitId: string, round: 0 | 1, device: (typeof ventilatorDeviceIds)[number]) {
  let session = createLabSession(unitId, device)
  session = learningLabReducer(session, { type: 'OPEN_ROUND', round })
  return learningLabReducer(session, { type: 'START_EXPERIMENT' })
}

/** Every requested change in place, with the clock run only as long as a hold or action needs. */
function goalsInPlace(session: LabSession, goals: readonly LabGoal[], round: 0 | 1): LabSession {
  let current = session
  for (const goal of goals) {
    if (goal.type === 'pause-expiration' || goal.type === 'inspect-inspiration') {
      const breath = completedBreath(current.evidence[round].baseline!.waveforms)
      const phase = goal.type === 'pause-expiration' ? 'expiration' : 'inspiration'
      const sample = breath.find(
        (item, i) => i > 2 && i < breath.length - 2 && item.phase === phase,
      )!
      current = learningLabReducer(current, { type: 'INSPECT', sampleTime: sample.time })
      continue
    }
    current = learningLabReducer(current, engine(labGoalAction(goal)!))
    if (!labGoalMet(goal, current)) {
      current = learningLabReducer(current, engine({ type: 'SET_PAUSED', paused: false }))
      for (let steps = 0; steps < 3000 && !labGoalMet(goal, current); steps += 1)
        current = learningLabReducer(current, tick)
    }
  }
  return learningLabReducer(current, engine({ type: 'SET_PAUSED', paused: true }))
}

/** The same run, live: the clock runs in 0.1-s steps until the gate opens, then Capture. */
function liveRun(session: LabSession): LabSession {
  let current = learningLabReducer(session, engine({ type: 'SET_PAUSED', paused: false }))
  for (let steps = 0; steps < 9000 && !labReadyToCompare(current); steps += 1)
    current = learningLabReducer(current, tick)
  return learningLabReducer(current, { type: 'COMPARE' })
}

const rounds = ventilationLearningExperiments.flatMap((experiment) =>
  ([0, 1] as const).map((round) => [experiment.unitId, round] as const),
)

describe('RUN_AND_CAPTURE', () => {
  it.each(rounds)('%s part %i captures on every console, as a live run would', (unitId, round) => {
    const goals = ventilationLearningExperiments.find((item) => item.unitId === unitId)!.rounds[
      round
    ].goals
    for (const device of ventilatorDeviceIds) {
      const ready = goalsInPlace(started(unitId, round, device), goals, round)
      expect(goals.every((goal) => labGoalMet(goal, ready))).toBe(true)
      const clicked = learningLabReducer(ready, { type: 'RUN_AND_CAPTURE' })
      expect(clicked.phase).toBe('compare')
      expect(clicked.evidence[round].response).toBeDefined()
      expect(clicked.simulation.paused).toBe(true)
      const live = liveRun(ready)
      // The same events, the same condition revisions, the same captured instant and readings.
      expect(clicked.events).toEqual(live.events)
      expect(clicked.conditionRevision).toBe(live.conditionRevision)
      expect(clicked.confounds).toEqual(live.confounds)
      expect(clicked.evidence[round].response!.at).toBe(live.evidence[round].response!.at)
      expect(clicked.evidence[round].response!.values).toEqual(
        live.evidence[round].response!.values,
      )
    }
  })

  it('does nothing until every requested change is in place, and nothing after a capture', () => {
    const fresh = started('waveform-anatomy', 0, 'hamilton-c6')
    expect(learningLabReducer(fresh, { type: 'RUN_AND_CAPTURE' })).toBe(fresh)
    expect(runResponseInterval(fresh)).toBe(fresh)
    const explored = createLabSession('waveform-anatomy', 'hamilton-c6')
    expect(learningLabReducer(explored, { type: 'RUN_AND_CAPTURE' })).toBe(explored)
    const ready = goalsInPlace(fresh, [{ type: 'control', key: 'peakFlowLMin', value: 60 }], 0)
    const captured = learningLabReducer(ready, { type: 'RUN_AND_CAPTURE' })
    expect(learningLabReducer(captured, { type: 'RUN_AND_CAPTURE' })).toBe(captured)
  })

  it('makes no change of its own: the run records only what the learner did', () => {
    const ready = goalsInPlace(
      started('waveform-anatomy', 0, 'hamilton-c6'),
      [{ type: 'control', key: 'peakFlowLMin', value: 60 }],
      0,
    )
    const captured = learningLabReducer(ready, { type: 'RUN_AND_CAPTURE' })
    expect(captured.events).toEqual(ready.events)
    expect(captured.events.map((event) => event.action.type)).toEqual(['SET_CONTROL'])
  })

  it('names the breath period the way one breath steps it', () => {
    const state = started('waveform-anatomy', 0, 'hamilton-c6').simulation
    const settings = state.ventilator.settings
    if (settings.mode !== 'volume-ac') throw new Error('Section 2 opens in volume control')
    expect(ventilationBreathPeriodSeconds(state)).toBeCloseTo(60 / settings.ratePerMin, 6)
  })
})
