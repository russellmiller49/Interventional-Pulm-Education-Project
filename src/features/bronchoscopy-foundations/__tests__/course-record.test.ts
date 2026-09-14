import { bronchStageLesson } from '../content/stageLessons'
import { bronchStageReducer, emptyBronchStageSession } from '../engine/stageSession'
import {
  createEmptyBronchRecord,
  isSectionCompleted,
  parseBronchRecord,
  withFirstAttempt,
  withInspectionSnapshot,
  withSectionCompleted,
} from '../engine/learnProgress'
import { inspectionReport } from '../engine/inspectionReport'
import { createScopeState } from '../engine/scope/scopeReducer'
import { teachingCase } from '../test-support/teachingCase'

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
  const record = withInspectionSnapshot(createEmptyBronchRecord(), entered, '2026-09-14')
  const restored = parseBronchRecord(JSON.stringify(record))!
  expect(restored.inspectionSnapshot?.rows).toEqual(Object.values(entered))
  const report = inspectionReport(restored)
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
  expect(inspectionReport(createEmptyBronchRecord()).fields[0].evidence).toMatch(
    /No completed survey record/,
  )
})

it('versions the newly required personal report while retaining historical completion and first answers', () => {
  const historical = {
    ...createEmptyBronchRecord(),
    completedSectionIds: ['honest-report'],
    firstAttempts: { 'honest-report:Q11': { choiceId: 'a', correct: false, at: '2026-09-12' } },
  }
  expect(isSectionCompleted(historical, 'honest-report')).toBe(false)
  const current = withSectionCompleted(historical, 'honest-report')
  expect(isSectionCompleted(current, 'honest-report')).toBe(true)
  expect(current.firstAttempts).toEqual(historical.firstAttempts)
  expect(current.completedSectionIds).toEqual(['honest-report'])
  const same = withSectionCompleted(createEmptyBronchRecord(), 'pre-use-check')
  expect(same.sectionVersions['pre-use-check']).toBeUndefined()
  expect(isSectionCompleted(same, 'pre-use-check')).toBe(true)
})

it('does not turn repeated confirms, a skipped page or Finish into activity evidence', () => {
  for (const id of ['five-controls', 'systematic-survey', 'honest-report'] as const) {
    const lesson = bronchStageLesson(id)
    const reducer = bronchStageReducer(lesson)
    let session = emptyBronchStageSession()
    session = reducer(session, { type: 'CONFIRM_THROUGH', index: lesson.steps.length - 1 })
    expect(session.commitments.confirmed).toBe(-1)
    for (let round = 0; round < 3; round++)
      for (let index = 0; index < lesson.steps.length; index++)
        session = reducer(session, { type: 'CONFIRM_THROUGH', index })
    session = reducer(session, { type: 'FINISH' })
    expect(session.commitments.finished).toBe(false)
  }
})

it('preserves the first response and its declared support across correction and serialization', () => {
  const step = bronchStageLesson('shared-airway').steps.find(
    (step) => step.interaction.kind === 'prediction',
  )!
  if (step.interaction.kind !== 'prediction') throw new Error('Check missing')
  const item = step.interaction.stage.item
  const key = `shared-airway:${item.id}`
  const wrong = item.choices.find((choice) => !item.correctChoiceIds.includes(choice.id))!.id
  const first = withFirstAttempt(
    createEmptyBronchRecord(),
    key,
    wrong,
    '2026-09-14',
    'reviewed-teaching',
  )
  const corrected = withFirstAttempt(
    first,
    key,
    item.correctChoiceIds[0],
    '2026-09-15',
    'learn-after-teaching',
  )
  expect(parseBronchRecord(JSON.stringify(corrected))?.firstAttempts[key]).toEqual({
    choiceId: wrong,
    correct: false,
    at: '2026-09-14',
    support: 'reviewed-teaching',
  })
})
