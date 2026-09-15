import { BRONCH_SECTION_IDS } from '../content/pathway'
import { bronchStageLesson, scopeViewOfStep } from '../content/stageLessons'
import { inspectionReport } from '../engine/inspectionReport'
import { createScopeState } from '../engine/scope/scopeReducer'
import {
  createEmptyBronchSelfPacedRecord,
  parseBronchSelfPacedRecord,
  withSurveySnapshot,
} from '../engine/selfPacedProgress'
import {
  bronchStageReducer,
  deriveStageProgress,
  emptyBronchStageSession,
  learnerActedOnScope,
  stepWorkDone,
} from '../engine/stageSession'
import { teachingCase } from '../test-support/teachingCase'

beforeEach(() => localStorage.clear())

it('keeps entry, inspection declarations and absent examination evidence separate in reporting', () => {
  const lesson = bronchStageLesson('systematic-survey')
  const task = lesson.steps.find((step) => step.interaction.kind === 'scope-task')!.interaction
  if (task.kind !== 'scope-task') throw new Error('Survey missing')
  const ledger = createScopeState(task.view, teachingCase()).ledger
  const entered = {
    ...ledger,
    RMSB: {
      label: 'RMSB' as const,
      identified: true,
      ostiumVisualized: true,
      entered: true,
      distalViewObtained: false,
      inspected: 'no' as const,
      limitation: null,
    },
  }
  const record = withSurveySnapshot(createEmptyBronchSelfPacedRecord(), entered, '2026-09-14')
  const restored = parseBronchSelfPacedRecord(JSON.stringify(record))!
  expect(restored.surveySnapshot?.rows).toEqual(Object.values(entered))
  const report = inspectionReport({ inspectionSnapshot: restored.surveySnapshot })
  const field = report.fields.find((field) => field.id === 'survey-RMSB')!
  expect(field.options.find((option) => option.supported)?.label).toBe(
    'Entered; inspection not declared',
  )
  for (const row of report.fields)
    expect(
      row.options
        .filter((option) => option.supported)
        .some((option) => /normal throughout|larynx normal/i.test(option.label)),
    ).toBe(false)
  expect(
    report.fields
      .find((field) => field.id === 'survey-larynx')!
      .options.find((option) => option.supported)?.label,
  ).toMatch(/not assessed/)
  expect(inspectionReport({ inspectionSnapshot: null }).fields[0].evidence).toMatch(
    /No completed survey record/,
  )
})

/**
 * Self-paced contract (BF-01), replacing "Finish needs every step performed": the learner can move
 * past any step, and moving never records that the step was done.
 */
it('moves past any step without doing it, and never turns a skip, a confirm or Finish into activity evidence', () => {
  for (const id of ['five-controls', 'systematic-survey', 'honest-report'] as const) {
    const lesson = bronchStageLesson(id)
    const reducer = bronchStageReducer(lesson)
    let session = emptyBronchStageSession()
    // Confirming ahead of the learner moves nothing, and Finish needs every step moved past.
    session = reducer(session, { type: 'CONFIRM_THROUGH', index: lesson.steps.length - 1 })
    expect(session.commitments.confirmed).toBe(-1)
    expect(reducer(session, { type: 'FINISH' }).commitments.finished).toBe(false)
    expect(reducer(session, { type: 'SKIP_PAST', index: 1 }).commitments.confirmed).toBe(-1)
    for (let index = 0; index < lesson.steps.length; index++) {
      const kind = lesson.steps[index].interaction.kind
      if (kind !== 'read' && kind !== 'explain') {
        // Continue on an activity not done moves nothing; the skip is the way on.
        expect(reducer(session, { type: 'CONFIRM_THROUGH', index }).commitments.confirmed).toBe(
          index - 1,
        )
      }
      session = reducer(session, { type: 'SKIP_PAST', index })
      expect(session.commitments.confirmed).toBe(index)
    }
    expect(session.commitments.performedIds).toEqual([])
    expect(deriveStageProgress(lesson, session).movedPastIds).toEqual(
      lesson.steps
        .filter((step) => step.interaction.kind !== 'read' && step.interaction.kind !== 'explain')
        .map((step) => step.id),
    )
    session = reducer(session, { type: 'FINISH' })
    expect(session.commitments.finished).toBe(true)
    expect(session.commitments.performedIds).toEqual([])
  }
  expect(localStorage.length).toBe(0)
})

it('keeps answers and retries in the session only', () => {
  const lesson = bronchStageLesson('shared-airway')
  const reducer = bronchStageReducer(lesson)
  let session = emptyBronchStageSession()
  for (let index = 0; index < lesson.predictionStepIndex; index++)
    session = reducer(session, { type: 'SKIP_PAST', index })
  const check = lesson.steps[lesson.predictionStepIndex]
  if (check.interaction.kind !== 'prediction') throw new Error('Check missing')
  const item = check.interaction.stage.item
  const wrong = item.choices.find((choice) => !item.correctChoiceIds.includes(choice.id))!.id
  session = reducer(session, { type: 'COMMIT_CHOICE', stepId: check.id, choiceId: wrong })
  expect(session.commitments.performedIds).toEqual([check.id])
  session = reducer(session, { type: 'RETRY_STEP', stepId: check.id })
  expect(session.commitments.choices[check.id]).toBeUndefined()
  expect(session.commitments.performedIds).toEqual([])
  expect(session.commitments.confirmed).toBe(lesson.predictionStepIndex - 1)
  session = reducer(session, {
    type: 'COMMIT_CHOICE',
    stepId: check.id,
    choiceId: item.correctChoiceIds[0],
  })
  session = reducer(session, { type: 'CONFIRM_THROUGH', index: lesson.predictionStepIndex })
  expect(session.commitments.confirmed).toBe(lesson.predictionStepIndex)
  // A retry is refused for an activity whose feedback loop is built in.
  const scenario = bronchStageLesson('poor-return').steps.find(
    (step) => step.interaction.kind === 'scenario',
  )!
  const poorReturn = bronchStageReducer(bronchStageLesson('poor-return'))
  const before = emptyBronchStageSession()
  expect(poorReturn(before, { type: 'RETRY_STEP', stepId: scenario.id })).toBe(before)
  expect(localStorage.length).toBe(0)
})

/** The goals-met-at-entry guard: an untouched start state is never the learner's work. */
it('counts no authored scope goal before the learner drives the scope', () => {
  const metAtEntry: string[] = []
  for (const id of BRONCH_SECTION_IDS) {
    const lesson = bronchStageLesson(id)
    lesson.steps.forEach((step, index) => {
      if (step.interaction.kind !== 'scope-task' && step.interaction.kind !== 'observe') return
      const state = createScopeState(scopeViewOfStep(step)!, teachingCase())
      expect(learnerActedOnScope(state)).toBe(false)
      const session = { ...emptyBronchStageSession(), scope: { [step.id]: state } }
      if (stepWorkDone(lesson, step, index, session)) metAtEntry.push(step.id)
    })
  }
  expect(metAtEntry).toEqual([])
})
