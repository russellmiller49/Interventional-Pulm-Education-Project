/**
 * @jest-environment node
 */
import { imagingStageLesson } from '../content/stageLessons'
import {
  deriveStageProgress,
  emptyImagingStageSession,
  imagingStageReducer,
  stepWorkDone,
  type ImagingStageSession,
} from '../engine/stageSession'

describe('the stage session', () => {
  const lesson = imagingStageLesson('projection')
  const reduce = imagingStageReducer(lesson)
  const [recognize, predict, act, observe, explain, transfer] = lesson.steps

  it('starts on Recognize with nothing performed and the prediction uncommitted', () => {
    const session = emptyImagingStageSession(lesson)
    expect(session.lab?.values).toMatchObject({ orbit: 0, tilt: 0, depth: 22 })
    expect(deriveStageProgress(lesson, session)).toMatchObject({
      furthestPerformedIndex: -1,
      liveIndex: 0,
      predictionCommitted: false,
    })
  })

  it('performs a read step on Continue, a prediction on commit, and never twice', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'CONFIRM_THROUGH', index: 0 })
    expect(deriveStageProgress(lesson, session).furthestPerformedIndex).toBe(0)
    expect(deriveStageProgress(lesson, session).liveIndex).toBe(1)
    session = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'b' })
    const again = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'a' })
    expect(again).toBe(session)
    expect(session.commitments.choices[predict.id]).toBe('b')
    expect(deriveStageProgress(lesson, session)).toMatchObject({
      predictionCommitted: true,
      liveIndex: 2,
    })
  })

  it('does not perform the lab step until its goals are met, and keeps it performed afterwards', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'CONFIRM_THROUGH', index: 0 })
    session = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'a' })
    expect(stepWorkDone(lesson, act, 2, session)).toBe(false)
    session = reduce(session, { type: 'CONFIRM_THROUGH', index: 2 })
    expect(deriveStageProgress(lesson, session).liveIndex).toBe(2)
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 40, depth: 22 } })
    expect(stepWorkDone(lesson, act, 2, session)).toBe(true)
    session = reduce(session, { type: 'CONFIRM_THROUGH', index: 2 })
    expect(deriveStageProgress(lesson, session).liveIndex).toBe(3)
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 0 } })
    expect(deriveStageProgress(lesson, session).liveIndex).toBe(3)
    expect(stepWorkDone(lesson, observe, 3, session)).toBe(true)
  })

  it('snapshots readouts by key and finishes once the transfer is committed', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'SNAPSHOT', key: 'before' })
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 30 } })
    session = reduce(session, { type: 'SNAPSHOT', key: 'after' })
    expect(session.snapshots.before.separationMm).not.toEqual(session.snapshots.after.separationMm)
    session = reduce(session, { type: 'COMMIT_CHOICE', stepId: transfer.id, choiceId: 'c' })
    expect(deriveStageProgress(lesson, session).transferCommitted).toBe(true)
    session = reduce(session, { type: 'FINISH' })
    expect(session.commitments.finished).toBe(true)
    expect(recognize.phase).toBe('recognize')
    expect(explain.phase).toBe('explain')
  })

  it('walks the chain stop by stop and reports the walk done at the last stop', () => {
    const walkLesson = imagingStageLesson('chain-walk')
    const walkReduce = imagingStageReducer(walkLesson)
    let session = emptyImagingStageSession(walkLesson)
    for (let i = 0; i < 5; i += 1)
      session = walkReduce(session, { type: 'WALK_NEXT', stopCount: 6 })
    expect(session.commitments).toMatchObject({ walkStop: 5, walkDone: false })
    session = walkReduce(session, { type: 'WALK_NEXT', stopCount: 6 })
    expect(session.commitments.walkDone).toBe(true)
    const walkStep = walkLesson.steps[2]
    expect(stepWorkDone(walkLesson, walkStep, 2, session)).toBe(false)
    session = walkReduce(session, { type: 'LAB_CHANGE', patch: { orbit: 10 } })
    session = walkReduce(session, { type: 'CONFIRM_THROUGH', index: 2 })
    expect(stepWorkDone(walkLesson, walkStep, 2, session)).toBe(true)
  })
})
