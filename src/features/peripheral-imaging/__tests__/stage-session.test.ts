/**
 * @jest-environment node
 */
import { imagingStageLesson } from '../content/stageLessons'
import { labGoalsMet } from '../engine/labGoalEvaluation'
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
  const recognize = lesson.steps[0]
  const actIndex = lesson.steps.findIndex((s) => s.interaction.kind === 'lab-task')
  const act = lesson.steps[actIndex]
  const observeIndex = lesson.steps.findIndex((s) => s.interaction.kind === 'observe')
  const observe = lesson.steps[observeIndex]
  const predict = lesson.steps[lesson.predictionStepIndex]
  const explain = lesson.steps.find((s) => s.interaction.kind === 'explain')!
  const transfer = lesson.steps[lesson.transferStepIndex]

  it('starts on the first step with nothing performed and nothing answered', () => {
    const session = emptyImagingStageSession(lesson)
    expect(session.lab?.values).toMatchObject({ orbit: 0, tilt: 0, depth: 22 })
    expect(deriveStageProgress(lesson, session)).toMatchObject({
      furthestPerformedIndex: -1,
      liveIndex: 0,
      predictionCommitted: false,
    })
  })

  it('performs a read step on Continue and a check when an answer is checked, and never twice', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'CONTINUE_PAST', index: 0 })
    expect(deriveStageProgress(lesson, session)).toMatchObject({
      furthestPerformedIndex: 0,
      liveIndex: 1,
    })
    session = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'b' })
    const again = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'a' })
    expect(again).toBe(session)
    expect(session.commitments.choices[predict.id]).toBe('b')
    // Checking an answer is not moving: the learner stays where they are to read the feedback.
    expect(deriveStageProgress(lesson, session)).toMatchObject({
      predictionCommitted: true,
      liveIndex: 1,
    })
  })

  it('moves the learner past every step without performing, answering or snapshotting anything', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    for (let index = 0; index < lesson.steps.length - 1; index += 1) {
      session = reduce(session, { type: 'SKIP_PAST', index })
      expect(deriveStageProgress(lesson, session).liveIndex).toBe(index + 1)
    }
    const progress = deriveStageProgress(lesson, session)
    expect(progress.performedIds.size).toBe(0)
    expect(progress.furthestPerformedIndex).toBe(-1)
    expect(progress.predictionCommitted).toBe(false)
    expect(session.commitments).toMatchObject({ choices: {}, sorts: {}, performedIds: [] })
    expect(session.snapshots).toEqual({})
    expect(session.lab).toEqual(emptyImagingStageSession(lesson).lab)
    expect(stepWorkDone(lesson, act, actIndex, session)).toBe(false)
    // Skipping a step already passed changes nothing.
    expect(reduce(session, { type: 'SKIP_PAST', index: 0 })).toBe(session)
  })

  it('does not perform a lab step without its goals, even when the learner moves past it', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'SKIP_PAST', index: actIndex - 1 })
    expect(deriveStageProgress(lesson, session).liveIndex).toBe(actIndex)
    expect(stepWorkDone(lesson, act, actIndex, session)).toBe(false)
    session = reduce(session, { type: 'CONTINUE_PAST', index: actIndex })
    expect(deriveStageProgress(lesson, session).liveIndex).toBe(actIndex + 1)
    expect(deriveStageProgress(lesson, session).performedIds.has(act.id)).toBe(false)
  })

  it('performs a lab step when the learner continues with its goals met, and keeps it performed', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'SKIP_PAST', index: actIndex - 1 })
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 40, depth: 22 } })
    expect(stepWorkDone(lesson, act, actIndex, session)).toBe(true)
    session = reduce(session, { type: 'CONTINUE_PAST', index: actIndex })
    expect(deriveStageProgress(lesson, session)).toMatchObject({
      liveIndex: actIndex + 1,
      furthestPerformedIndex: actIndex,
    })
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 0 } })
    expect(deriveStageProgress(lesson, session).performedIds.has(act.id)).toBe(true)
    expect(stepWorkDone(lesson, observe, observeIndex, session)).toBe(true)
  })

  it('does not count an observation nobody made, even when the starting state meets its goals', () => {
    if (observe.interaction.kind !== 'observe') throw new Error('Missing observation')
    const { goals, lab } = observe.interaction
    let untouched: ImagingStageSession = emptyImagingStageSession(lesson)
    untouched = reduce(untouched, { type: 'SKIP_PAST', index: observeIndex - 1 })
    // Projection's comparison ends at the frontal view, which is also where the lab starts.
    expect(labGoalsMet(goals, untouched.lab!, lab, lesson.sectionId)).toBe(true)
    expect(stepWorkDone(lesson, observe, observeIndex, untouched)).toBe(false)
    untouched = reduce(untouched, { type: 'CONTINUE_PAST', index: observeIndex })
    expect(deriveStageProgress(lesson, untouched).performedIds.has(observe.id)).toBe(false)

    // Making the change and coming back is the observation.
    let made: ImagingStageSession = emptyImagingStageSession(lesson)
    made = reduce(made, { type: 'SKIP_PAST', index: observeIndex - 1 })
    made = reduce(made, { type: 'LAB_CHANGE', patch: { orbit: 40 } })
    expect(stepWorkDone(lesson, observe, observeIndex, made)).toBe(false)
    made = reduce(made, { type: 'LAB_CHANGE', patch: { orbit: 0 } })
    expect(stepWorkDone(lesson, observe, observeIndex, made)).toBe(true)
  })

  it('never performs an earlier skipped step when the learner continues past a later one', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'SKIP_PAST', index: actIndex })
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 40, depth: 22 } })
    session = reduce(session, { type: 'LAB_CHANGE', patch: { orbit: 0 } })
    session = reduce(session, { type: 'CONTINUE_PAST', index: observeIndex })
    const performed = deriveStageProgress(lesson, session).performedIds
    expect(performed.has(act.id)).toBe(false)
    for (const step of lesson.steps.slice(0, actIndex)) expect(performed.has(step.id)).toBe(false)
    expect([...performed]).toEqual(
      stepWorkDone(lesson, observe, observeIndex, session) ? [observe.id] : [],
    )
  })

  it('lets a check be tried again before the learner moves past it, and not after', () => {
    let session: ImagingStageSession = emptyImagingStageSession(lesson)
    session = reduce(session, { type: 'SKIP_PAST', index: lesson.predictionStepIndex - 1 })
    session = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'a' })
    session = reduce(session, { type: 'RETRY_CHOICE', stepId: predict.id })
    expect(session.commitments.choices[predict.id]).toBeUndefined()
    expect(deriveStageProgress(lesson, session).performedIds.has(predict.id)).toBe(false)
    session = reduce(session, { type: 'COMMIT_CHOICE', stepId: predict.id, choiceId: 'b' })
    session = reduce(session, { type: 'CONTINUE_PAST', index: lesson.predictionStepIndex })
    expect(reduce(session, { type: 'RETRY_CHOICE', stepId: predict.id })).toBe(session)
  })

  it('snapshots readouts by key, and finishes after the transfer whether or not it was answered', () => {
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

    let unanswered: ImagingStageSession = emptyImagingStageSession(lesson)
    unanswered = reduce(unanswered, { type: 'SKIP_PAST', index: lesson.steps.length - 1 })
    unanswered = reduce(unanswered, { type: 'FINISH' })
    expect(unanswered.commitments).toMatchObject({ finished: true, choices: {}, performedIds: [] })
    expect(deriveStageProgress(lesson, unanswered).transferCommitted).toBe(false)
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
    const walkStep = walkLesson.steps[1]
    expect(stepWorkDone(walkLesson, walkStep, 1, session)).toBe(false)
    session = walkReduce(session, { type: 'LAB_CHANGE', patch: { orbit: 10 } })
    session = walkReduce(session, { type: 'CONTINUE_PAST', index: 1 })
    expect(stepWorkDone(walkLesson, walkStep, 1, session)).toBe(true)
    expect(deriveStageProgress(walkLesson, session).performedIds.has(walkStep.id)).toBe(true)
  })
})
