import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { readCrrtLegacyProgress } from '@/features/critical-care/progress/adapters/crrt'
import { mergeCriticalCareProgress } from '@/features/critical-care/progress'
import { readPublicCriticalCareProgress } from '@/features/critical-care/progress/publicClient'
import {
  projectPublicCriticalCareCoarseProgress,
  hydratePublicCriticalCareCoarseProgress,
} from '@/features/critical-care/progress/publicAccountSync'
import { getCriticalCareRecommendations } from '@/features/critical-care/progress/recommendation'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
} from '@/features/learning-module/activity/progress'
import {
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  recordCaseResult,
  serializeProgress,
} from '../engine/progress'
import { recordCrrtVisit } from '../selfPacedProgress'

const date = '2026-09-14T12:00:00.000Z'
const definitions = criticalCareActivities.filter((activity) => activity.moduleId === 'baxter-crrt')
const legacy = recordCaseResult(createDefaultProgress(), {
  caseId: 'MASTERY-PRISMAX-01',
  device: 'prismax-aw8035-2xx',
  roleLens: 'integrated',
  pathway: 'mastery',
  score: 99,
  criticalError: false,
  hintCount: 0,
  reassessmentCompleted: true,
  masteryCompleted: true,
})
const oldEnvelope = {
  ...createEmptyCriticalCareProgress(date),
  activities: [
    {
      activityId: 'crrt:assess:MASTERY-PRISMAX-01',
      status: 'mastered' as const,
      mode: 'challenge' as const,
      attempts: 8,
      bestScore: 99,
      hintCount: 4,
      competencyEvidenceIds: ['crrt-safety'],
      updatedAt: date,
    },
  ],
}
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, serializeProgress(legacy)!)
  localStorage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, JSON.stringify(oldEnvelope))
})
it('keeps all CRRT catalog entries ungraded and accessible, including the stable Assess URL', () => {
  for (const activity of definitions) {
    expect(activity.prerequisiteActivityIds).toEqual([])
    expect(activity.masteryRuleId).toBeUndefined()
    expect(activity.completionEvidenceAuthority).toBe('none')
    expect(activity.creditPolicy).toBe('non-credit')
    expect(activity.kind).not.toBe('assessment')
  }
  expect(
    definitions.find((activity) => activity.id === 'crrt:assess:MASTERY-PRISMAX-01')?.pathname,
  ).toBe('/baxter-crrt/assess')
})
it('reads historical records without projecting them into current progress or recommendations', () => {
  const before = localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)
  expect(readCrrtLegacyProgress(localStorage, criticalCareActivities).activities).toEqual([])
  const publicProgress = readPublicCriticalCareProgress(criticalCareActivities, localStorage)
  expect(
    publicProgress.envelope.activities.filter((activity) =>
      activity.activityId.startsWith('crrt:'),
    ),
  ).toEqual([])
  const merged = mergeCriticalCareProgress(oldEnvelope, [], criticalCareActivities)
  expect(merged.activities).toEqual([])
  const recommendations = getCriticalCareRecommendations(definitions, merged, { limit: 100 })
  expect(recommendations).toHaveLength(definitions.length)
  expect(recommendations.every((item) => item.reason === 'next-unblocked')).toBe(true)
  expect(localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(before)
  expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(oldEnvelope))
})
it('projects only new visits, with no legacy scores, attempts, or competency claims', () => {
  recordCrrtVisit({ section: 'practice', id: 'CRRT-13' })
  const result = readPublicCriticalCareProgress(criticalCareActivities, localStorage)
  expect(
    result.envelope.activities.filter((activity) => activity.activityId.startsWith('crrt:')),
  ).toEqual([
    expect.objectContaining({
      activityId: 'crrt:practice:CRRT-13',
      status: 'in-progress',
      attempts: 0,
      competencyEvidenceIds: [],
    }),
  ])
  expect(result.envelope.activities[0]).not.toHaveProperty('bestScore')
  expect(result.envelope.activities[0]).not.toHaveProperty('hintCount')
})
it('leaves old account completion out of CRRT hydration and publication', () => {
  expect(projectPublicCriticalCareCoarseProgress(oldEnvelope, definitions)).toBeNull()
  const input = createEmptyCriticalCareProgress(date)
  const hydrated = hydratePublicCriticalCareCoarseProgress(
    input,
    {
      schemaVersion: 1,
      accountId: 'test',
      modules: [
        {
          moduleId: 'baxter-crrt',
          percentComplete: 100,
          completedSections: ['learn', 'practice', 'assess'],
          completedAt: date,
          lastVisitedAt: date,
        },
      ],
    },
    definitions,
  )
  expect(hydrated.activities).toEqual([])
})
it('preserves another module consumer when CRRT history is present', () => {
  const activity = criticalCareActivities.find(
    (item) => item.moduleId === 'icu-hemodynamics' && item.kind !== 'assessment',
  )!
  const other = {
    ...oldEnvelope.activities[0],
    activityId: activity.id,
    status: 'in-progress' as const,
    mode: 'guided' as const,
    competencyEvidenceIds: [],
  }
  const result = mergeCriticalCareProgress(
    { ...oldEnvelope, activities: [...oldEnvelope.activities, other] },
    [],
    criticalCareActivities,
  )
  expect(result.activities).toEqual([other])
})
