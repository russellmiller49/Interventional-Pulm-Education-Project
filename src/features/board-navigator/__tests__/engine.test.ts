import { OBJECTIVES, objectiveById } from '../content/objectives'
import { closingSummary, gradeResponse, labStages, outcomeFor } from '../engine/lab'
import {
  createEmptyRecord,
  parseRecord,
  withEvidence,
  withProfile,
  withReview,
  type Evidence,
} from '../engine/record'
import { buildRecommendations, planSession } from '../engine/recommend'
import {
  isReviewDue,
  REVIEW_INTERVAL_DAYS,
  scheduleAfterReview,
  scheduleFirstReview,
} from '../engine/schedule'
import { deriveStatus, isDemonstrated, objectiveStatus } from '../engine/status'

const NOW = '2026-11-04T12:00:00.000Z'

function observe(
  partial: Partial<Evidence> & Pick<Evidence, 'objectiveId' | 'taskKind' | 'phase' | 'outcome'>,
): Evidence {
  return {
    taskId: `${partial.objectiveId}.${partial.phase}`,
    confidence: null,
    misconceptionId: null,
    at: NOW,
    ...partial,
  }
}

describe('status derivation', () => {
  it('starts not-assessed, and never calls an empty objective weak', () => {
    expect(deriveStatus([], undefined, NOW)).toBe('not-assessed')
  })

  it('is exploring after a single observation of either outcome', () => {
    expect(
      deriveStatus(
        [
          observe({
            objectiveId: 'ms-01',
            taskKind: 'choice',
            phase: 'diagnose',
            outcome: 'independent',
          }),
        ],
        undefined,
        NOW,
      ),
    ).toBe('exploring')
    expect(
      deriveStatus(
        [
          observe({
            objectiveId: 'ms-01',
            taskKind: 'choice',
            phase: 'diagnose',
            outcome: 'missed',
          }),
        ],
        undefined,
        NOW,
      ),
    ).toBe('exploring')
  })

  it('needs focus when the same wrong model recurs, or two misses run in a row', () => {
    const recurring = [
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'missed',
        misconceptionId: 'ms-01.midline-divide',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'hotspot',
        phase: 'verify',
        outcome: 'independent',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'predict',
        phase: 'review',
        outcome: 'missed',
        misconceptionId: 'ms-01.midline-divide',
      }),
    ]
    expect(deriveStatus(recurring, undefined, NOW)).toBe('needs-focus')
    const twoMisses = [
      observe({ objectiveId: 'ms-01', taskKind: 'choice', phase: 'diagnose', outcome: 'missed' }),
      observe({ objectiveId: 'ms-01', taskKind: 'hotspot', phase: 'verify', outcome: 'missed' }),
    ]
    expect(deriveStatus(twoMisses, undefined, NOW)).toBe('needs-focus')
  })

  it('is demonstrated only with two task kinds, one of them a transfer, and no trailing miss', () => {
    const sameKind = [
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'independent',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'verify',
        outcome: 'independent',
      }),
    ]
    expect(isDemonstrated(sameKind)).toBe(false)
    const noTransfer = [
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'independent',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'predict',
        phase: 'manipulate',
        outcome: 'independent',
      }),
    ]
    expect(isDemonstrated(noTransfer)).toBe(false)
    const hinted = [
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'with-hint',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'hotspot',
        phase: 'verify',
        outcome: 'independent',
      }),
    ]
    expect(isDemonstrated(hinted)).toBe(false)
    const demonstrated = [
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'independent',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'hotspot',
        phase: 'verify',
        outcome: 'independent',
      }),
    ]
    expect(isDemonstrated(demonstrated)).toBe(true)
    expect(deriveStatus(demonstrated, undefined, NOW)).toBe('demonstrated')
    const thenMissed = [
      ...demonstrated,
      observe({ objectiveId: 'ms-01', taskKind: 'predict', phase: 'review', outcome: 'missed' }),
    ]
    expect(deriveStatus(thenMissed, undefined, NOW)).toBe('needs-focus')
  })

  it('turns demonstrated into review-due once the schedule comes round', () => {
    const demonstrated = [
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'independent',
      }),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'hotspot',
        phase: 'verify',
        outcome: 'independent',
      }),
    ]
    const review = scheduleFirstReview(NOW)
    expect(deriveStatus(demonstrated, review, NOW)).toBe('demonstrated')
    expect(deriveStatus(demonstrated, review, '2026-11-08T12:00:00.000Z')).toBe('review-due')
  })
})

describe('the review schedule', () => {
  it('expands on retention and collapses on a miss', () => {
    const first = scheduleFirstReview(NOW)
    expect(first.stage).toBe(0)
    expect(isReviewDue(first, NOW)).toBe(false)
    const later = `2026-11-0${7}T12:00:00.000Z`
    expect(isReviewDue(first, later)).toBe(true)
    const second = scheduleAfterReview(first, true, later)
    expect(second.stage).toBe(1)
    expect(new Date(second.dueAt).getTime() - new Date(later).getTime()).toBe(
      REVIEW_INTERVAL_DAYS[1] * 86_400_000,
    )
    const reset = scheduleAfterReview(second, false, later)
    expect(reset.stage).toBe(0)
    const capped = [0, 1, 2, 3, 4, 5].reduce(
      (entry) => scheduleAfterReview(entry, true, later),
      first,
    )
    expect(capped.stage).toBe(REVIEW_INTERVAL_DAYS.length - 1)
  })
})

describe('recommendations', () => {
  it('starts an empty learner on an unassessed objective with a rationale that names the blank map', () => {
    const list = buildRecommendations(createEmptyRecord(), NOW)
    expect(list.length).toBe(OBJECTIVES.length)
    expect(list[0].reason).toBe('unassessed')
    expect(list[0].rationale).toMatch(/assessed|No evidence/)
    // Safety-critical objectives lead the unassessed tier.
    expect(list[0].safetyCritical).toBe(true)
  })

  it('puts a confirmed gap first for a board learner and names the wrong model', () => {
    let record = withProfile(
      createEmptyRecord(),
      { goal: 'board', examDate: null, sessionMinutes: 10 },
      NOW,
    )
    record = withEvidence(
      record,
      observe({
        objectiveId: 'ms-02',
        taskKind: 'sort',
        phase: 'diagnose',
        outcome: 'missed',
        misconceptionId: 'ms-02.seven-is-sided',
      }),
    )
    record = withEvidence(
      record,
      observe({
        objectiveId: 'ms-02',
        taskKind: 'choice',
        phase: 'verify',
        outcome: 'missed',
        misconceptionId: 'ms-02.seven-is-sided',
      }),
    )
    const [first] = buildRecommendations(record, NOW)
    expect(first.objective.id).toBe('ms-02')
    expect(first.reason).toBe('gap')
    expect(first.rationale).toContain('Station 7 is N3')
  })

  it('puts a due review first for a knowledge-maintenance learner', () => {
    let record = withProfile(
      createEmptyRecord(),
      { goal: 'maintenance', examDate: null, sessionMinutes: 5 },
      NOW,
    )
    record = withEvidence(
      record,
      observe({
        objectiveId: 'pl-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'independent',
      }),
    )
    record = withEvidence(
      record,
      observe({ objectiveId: 'pl-01', taskKind: 'sort', phase: 'verify', outcome: 'independent' }),
    )
    record = withReview(
      record,
      'pl-01',
      { stage: 0, dueAt: '2026-11-01T00:00:00.000Z', lastAt: '2026-10-29T00:00:00.000Z' },
      NOW,
    )
    const [first] = buildRecommendations(record, NOW)
    expect(first.objective.id).toBe('pl-01')
    expect(first.reason).toBe('review')
    expect(first.mode).toBe('review')
  })

  it('recommends a prerequisite that is holding back an objective the learner is struggling with', () => {
    let record = withProfile(
      createEmptyRecord(),
      { goal: 'fellowship', examDate: null, sessionMinutes: 10 },
      NOW,
    )
    // ms-03 depends on ms-02, which depends on ms-01; ms-03 is exploring, the prerequisites unassessed.
    record = withEvidence(
      record,
      observe({
        objectiveId: 'ms-03',
        taskKind: 'sequence',
        phase: 'diagnose',
        outcome: 'missed',
        misconceptionId: 'ms-03.biggest-first',
      }),
    )
    const list = buildRecommendations(record, NOW)
    expect(list[0].reason).toBe('prerequisite')
    expect(list[0].objective.id).toBe('ms-02')
    expect(list[0].rationale).toContain(objectiveById('ms-03').title)
  })

  it('fits a session to the minutes and always offers at least one lab', () => {
    const list = buildRecommendations(createEmptyRecord(), NOW)
    expect(planSession(list, 5).length).toBe(1)
    const ten = planSession(list, 10)
    expect(ten.reduce((sum, entry) => sum + entry.minutes, 0)).toBeLessThanOrEqual(12)
    expect(planSession(list, 20).length).toBeGreaterThanOrEqual(3)
  })
})

describe('grading', () => {
  it('grades a choice and names the documented wrong model it matched', () => {
    const task = objectiveById('ms-01').lab.diagnose
    expect(task.kind).toBe('choice')
    if (task.kind !== 'choice') return
    expect(gradeResponse(task, { kind: 'choice', optionId: task.answerId })).toMatchObject({
      correct: true,
      misconceptionId: null,
    })
    expect(gradeResponse(task, { kind: 'choice', optionId: '4l' })).toMatchObject({
      correct: false,
      misconceptionId: 'ms-01.midline-divide',
    })
  })

  it('grades a sequence and names the step that came too early', () => {
    const task = objectiveById('ms-03').lab.diagnose
    if (task.kind !== 'sequence') throw new Error('expected a sequence')
    expect(gradeResponse(task, { kind: 'sequence', order: task.order }).correct).toBe(true)
    const biggestFirst = gradeResponse(task, {
      kind: 'sequence',
      order: ['11r', '4l', '7', 'primary'],
    })
    expect(biggestFirst.correct).toBe(false)
    expect(biggestFirst.misconceptionId).toBe('ms-03.biggest-first')
  })

  it('grades a sort by every placement', () => {
    const task = objectiveById('ms-02').lab.diagnose
    if (task.kind !== 'sort') throw new Error('expected a sort')
    const right = Object.fromEntries(task.items.map((item) => [item.id, item.bucketId]))
    expect(gradeResponse(task, { kind: 'sort', placements: right }).correct).toBe(true)
    const sevenWrong = gradeResponse(task, { kind: 'sort', placements: { ...right, '7': 'n3' } })
    expect(sevenWrong.correct).toBe(false)
    expect(sevenWrong.misplaced).toEqual(['7'])
    expect(sevenWrong.misconceptionId).toBe('ms-02.seven-is-sided')
  })

  it('grades a hotspot and reads the wrong region as its misconception', () => {
    const task = objectiveById('ms-01').lab.verify
    if (task.kind !== 'hotspot') throw new Error('expected a hotspot')
    expect(gradeResponse(task, { kind: 'hotspot', regionId: '10R' }).correct).toBe(true)
    expect(gradeResponse(task, { kind: 'hotspot', regionId: '4R' }).misconceptionId).toBe(
      'ms-01.four-vs-ten',
    )
  })

  it('records a hint as success with a hint, never as independent', () => {
    expect(outcomeFor({ correct: true, misconceptionId: null, misplaced: [] }, true)).toBe(
      'with-hint',
    )
    expect(outcomeFor({ correct: true, misconceptionId: null, misplaced: [] }, false)).toBe(
      'independent',
    )
    expect(outcomeFor({ correct: false, misconceptionId: null, misplaced: [] }, true)).toBe(
      'missed',
    )
  })

  it('runs five stages with a manipulation, four without, and two in review', () => {
    expect(labStages(true, 'repair')).toEqual([
      'diagnose',
      'explain',
      'manipulate',
      'verify',
      'close',
    ])
    expect(labStages(false, 'repair')).toEqual(['diagnose', 'explain', 'verify', 'close'])
    expect(labStages(true, 'review')).toEqual(['verify', 'close'])
  })

  it('closes the loop with the conceptual distinction, not a number', () => {
    const closed = closingSummary({
      diagnose: { correct: false, misconceptionId: 'x', misplaced: [] },
      verify: { correct: true, misconceptionId: null, misplaced: [] },
      distinction: 'Side first, then level.',
      misconceptionLabel: 'Station 7 is sided.',
    })
    expect(closed.headline).toMatch(/repaired/)
    expect(closed.detail).toContain('Station 7 is sided.')
    expect(closed.detail).toContain('Side first, then level.')
  })
})

describe('the record', () => {
  it('rejects a malformed record and drops unknown objectives from a valid one', () => {
    expect(parseRecord('{"version":2}')).toBeNull()
    expect(parseRecord('not json')).toBeNull()
    const record = withEvidence(
      createEmptyRecord(),
      observe({
        objectiveId: 'ms-01',
        taskKind: 'choice',
        phase: 'diagnose',
        outcome: 'independent',
      }),
    )
    const withGhost = {
      ...record,
      evidence: [...record.evidence, { ...record.evidence[0], objectiveId: 'retired-99' }],
      reviews: { 'retired-99': { stage: 0, dueAt: NOW, lastAt: NOW } },
    }
    const parsed = parseRecord(JSON.stringify(withGhost))
    expect(parsed?.evidence.map((entry) => entry.objectiveId)).toEqual(['ms-01'])
    expect(parsed?.reviews).toEqual({})
    expect(objectiveStatus(parsed!, 'ms-01', NOW).status).toBe('exploring')
  })
})
