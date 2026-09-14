import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { readPublicCriticalCareProgress } from '@/features/critical-care/progress/publicClient'
import { mergeCriticalCareProgress } from '@/features/critical-care/progress'
import { getCriticalCareRecommendations } from '@/features/critical-care/progress/recommendation'
import {
  hydratePublicCriticalCareCoarseProgress,
  projectPublicCriticalCareCoarseProgress,
  postPublicCriticalCareCoarseProgress,
  mergeCriticalCareSubsetProgress,
} from '@/features/critical-care/progress/publicAccountSync'
import {
  createDefaultProgress,
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
} from '../engine/progress'
import {
  emptySelfPacedProgress,
  parseSelfPacedProgress,
  visitVentilationLocation,
} from '../engine/selfPacedProgress'
import { createLabSession, learningLabReducer, labReadyToCompare } from '../engine/learningLab'
import { ventilationExperimentByUnit } from '../content/learningExperiments'

it('stores only valid topics and locations, never legacy scores inferred as visits', () => {
  expect(parseSelfPacedProgress(JSON.stringify(createDefaultProgress())).visited).toEqual([])
  expect(parseSelfPacedProgress('{broken')).toEqual(emptySelfPacedProgress())
  const location = { section: 'learn' as const, id: 'controls-and-goals', step: 1 }
  expect(visitVentilationLocation(emptySelfPacedProgress(), location)).toEqual({
    version: 1,
    visited: ['controls-and-goals'],
    location,
  })
  expect(
    parseSelfPacedProgress(
      JSON.stringify({
        version: 1,
        visited: ['controls-and-goals', 'not-a-topic'],
        scores: { any: 100 },
        hints: 20,
        location,
      }),
    ),
  ).toEqual({ version: 1, visited: ['controls-and-goals'], location })
})

it('leaves legacy storage byte-identical and excludes MV grades and old resume from current shared results', () => {
  const oldCase = {
    ...createDefaultProgress(),
    completedCases: ['MV-01'],
    bestScores: { 'MV-01': 100 },
    criticalErrorStatus: { 'MV-01': false },
  }
  const normalized = {
    version: 1 as const,
    activities: [
      {
        activityId: 'ventilation:practice:MV-01',
        status: 'mastered' as const,
        mode: 'practice' as const,
        attempts: 4,
        bestScore: 100,
        competencyEvidenceIds: [],
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
  const values = new Map([
    [MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY, JSON.stringify(oldCase)],
    [
      LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
      JSON.stringify({ ...oldCase, version: 1, attempts: { 'MV-01': 4 } }),
    ],
    ['critical-care-activity-progress-v1', JSON.stringify(normalized)],
  ])
  const before = [...values]
  const storage = { getItem: (key: string) => values.get(key) ?? null }
  const result = readPublicCriticalCareProgress(criticalCareActivities, storage)
  expect(
    result.envelope.activities.filter((item) => item.activityId.startsWith('ventilation:')),
  ).toEqual([])
  expect(result.envelope.resume).toBeUndefined()
  expect(mergeCriticalCareProgress(normalized, []).activities).toEqual([])
  expect([...values]).toEqual(before)
  const mv = criticalCareActivities.filter(
    (activity) => activity.moduleId === 'mechanical-ventilation',
  )
  expect(
    mv.every(
      (activity) =>
        activity.prerequisiteActivityIds.length === 0 &&
        !activity.masteryRuleId &&
        activity.completionEvidenceAuthority === 'none',
    ),
  ).toBe(true)
  expect(getCriticalCareRecommendations(mv, normalized)).toEqual(
    getCriticalCareRecommendations(mv, { ...normalized, activities: [] }),
  )
})

it('starts an optional experiment without fabricating prediction, observation, or successful completion', () => {
  let session = createLabSession('controls-and-goals')
  session = learningLabReducer(session, { type: 'START_EXPERIMENT' })
  expect(session.evidence[0].prediction).toBeUndefined()
  expect(session.simulation.prediction.committed).toBe(false)
  expect(session.evidence[0].baseline).toBeDefined()
  expect(learningLabReducer(session, { type: 'COMPARE' })).toBe(session)
  expect(session.evidence[0].response).toBeUndefined()
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[0]
  const goal = round.goals[0]
  expect(goal.type).toBe('control')
  if (goal.type !== 'control') throw new Error('Expected the authored volume-control experiment')
  session = learningLabReducer(session, {
    type: 'ENGINE',
    action: { type: 'SET_CONTROL', control: goal.key, value: goal.value },
  })
  session = learningLabReducer(session, {
    type: 'ENGINE',
    action: { type: 'SET_PAUSED', paused: false },
  })
  for (let second = 0; second < round.seconds + 2; second++)
    session = learningLabReducer(session, { type: 'ENGINE', action: { type: 'TICK', seconds: 1 } })
  expect(labReadyToCompare(session)).toBe(true)
  session = learningLabReducer(session, { type: 'COMPARE' })
  expect(session.evidence[0].response).toBeDefined()
  expect(session.evidence[0].prediction).toBeUndefined()
  expect(session.completedAt).toBeUndefined()
})

it('keeps old MV account completion inert without overwriting the historical local subset', async () => {
  const historical = {
    version: 1 as const,
    activities: [
      {
        activityId: 'ventilation:practice:MV-01',
        status: 'mastered' as const,
        attempts: 2,
        bestScore: 99,
        competencyEvidenceIds: [],
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
  const current = mergeCriticalCareProgress(historical, [])
  const hydrated = hydratePublicCriticalCareCoarseProgress(
    current,
    {
      schemaVersion: 1,
      accountId: 'test-account',
      modules: [
        {
          moduleId: 'mechanical-ventilation',
          percentComplete: 100,
          completedSections: ['learn', 'practice', 'assess'],
          completedAt: null,
          lastVisitedAt: historical.updatedAt,
        },
      ],
    },
    criticalCareActivities,
  )
  expect(hydrated).toBe(current)
  expect(projectPublicCriticalCareCoarseProgress(historical, criticalCareActivities)).toBeNull()
  expect(mergeCriticalCareSubsetProgress(historical, hydrated)).toBe(historical)
  const fetcher = jest.fn()
  expect(
    await postPublicCriticalCareCoarseProgress(
      {
        schemaVersion: 1,
        modules: [
          {
            moduleId: 'mechanical-ventilation',
            percentComplete: 100,
            completedSections: ['practice'],
            completed: true,
          },
        ],
      },
      'test-account',
      criticalCareActivities,
      fetcher,
    ),
  ).toBe(false)
  expect(fetcher).not.toHaveBeenCalled()
})
