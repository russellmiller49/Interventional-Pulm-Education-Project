import { ventilationExperimentByUnit } from '../content/learningExperiments'
import {
  createLabSession,
  labGoalAction,
  labReadyToCompare,
  learningLabReducer,
  type LabSession,
} from '../engine/learningLab'
import type { VentilatorDeviceId } from '../engine/types'

/** Exercise the same controller as the browser, including real hold boundaries and response delays. */
export function performLabRound(initial: LabSession, prediction?: number): LabSession {
  const round = ventilationExperimentByUnit.get(initial.unitId)!.rounds[initial.round]
  let session = learningLabReducer(initial, { type: 'PREDICT' })
  session = learningLabReducer(session, {
    type: 'COMMIT',
    choice: prediction ?? round.correct,
    confidence: 'sure',
  })
  for (const goal of round.goals) {
    const action = labGoalAction(goal)
    if (action) session = learningLabReducer(session, { type: 'ENGINE', action })
  }
  for (let step = 0; step < 4000 && !labReadyToCompare(session); step++) {
    session = learningLabReducer(session, {
      type: 'ENGINE',
      action: { type: 'TICK', seconds: 0.1 },
    })
    const sample = session.simulation.waveforms.at(-1)
    if (
      round.goals.some((goal) => goal.type === 'pause-expiration') &&
      session.simulation.simulationTime >= 4 &&
      sample?.phase === 'expiration' &&
      sample.flowLMin < -0.1
    ) {
      session = learningLabReducer(session, {
        type: 'ENGINE',
        action: { type: 'SET_PAUSED', paused: true },
      })
    }
  }
  if (!labReadyToCompare(session))
    throw new Error(`Unreachable experiment: ${initial.unitId}, round ${initial.round}`)
  return learningLabReducer(session, { type: 'COMPARE' })
}
export function finishLabRound(session: LabSession): LabSession {
  session = learningLabReducer(session, {
    type: 'REFLECT',
    text: 'I connected the control change with the observed patient response.',
  })
  return learningLabReducer(session, { type: 'CONTINUE', now: '2026-09-05T01:00:00.000Z' })
}
export function completeLabUnit(id: string, device?: VentilatorDeviceId): LabSession {
  return finishLabRound(
    performLabRound(finishLabRound(performLabRound(createLabSession(id, device)))),
  )
}
