import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { deriveCriticalCareDashboard } from '@/features/critical-care/dashboard'
import {
  getCriticalCareResumeTarget,
  readMergedCriticalCareProgress,
  recordCriticalCareActivitySelection,
} from '@/features/critical-care/progress'
import { readPublicCriticalCareProgress } from '@/features/critical-care/progress/publicClient'
import { getCriticalCareRecommendations } from '@/features/critical-care/progress/recommendation'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'
import { MCS_LOCAL_PROGRESS_KEY, recordMcsVisit } from '../engine/learningProgress'

const mcsActivities = criticalCareActivities.filter(
  (a) => a.moduleId === 'mechanical-circulatory-support',
)
const legacy = {
  version: 1,
  completedLessonIds: ['mcs-foundations-signals'],
  completedCaseIds: ['IABP-01'],
  masteredCaseIds: ['IABP-01'],
  completedCapstoneIds: ['CAP-IABP-01'],
  bestScores: { 'IABP-01': 100, 'CAP-IABP-01': 100 },
  criticalErrorStatus: { 'IABP-01': false },
  lastDevice: 'iabp',
  lastSection: 'assess',
  lastActivityId: 'CAP-IABP-01',
  assistanceUsed: { 'CAP-IABP-01': true },
  firstAttempts: { sentinel: 'preserve' },
}
beforeEach(() => window.localStorage.clear())
it.each(mcsActivities)(
  '$id retains its route identity and is open noncredit learning',
  (activity) => {
    expect(activity.creditPolicy).toBe('non-credit')
    expect(activity.completionEvidenceAuthority).toBe('none')
    expect(activity.prerequisiteActivityIds).toEqual([])
    expect(activity.masteryRuleId).toBeUndefined()
    expect(activity.supportedModes).toContain('guided')
    expect(activity.pathname).toContain('/mechanical-circulatory-support')
  },
)
it.each(['merged', 'public'] as const)(
  '%s consumers ignore legacy MCS scores, outcomes and resume without rewriting history',
  (reader) => {
    window.localStorage.setItem(MCS_LOCAL_PROGRESS_KEY, JSON.stringify(legacy))
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: 'mcs:assess:CAP-IABP-01',
      mode: 'challenge',
      query: { case: 'CAP-IABP-01' },
      payloadVersion: 'mcs-selection-v1',
    })
    const normalized = JSON.parse(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)!)
    normalized.activities = [
      {
        activityId: 'mcs:assess:CAP-IABP-01',
        status: 'mastered',
        attempts: 6,
        bestScore: 100,
        competencyEvidenceIds: ['critical-care-safety'],
        updatedAt: normalized.updatedAt,
      },
    ]
    window.localStorage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, JSON.stringify(normalized))
    const before = [
      window.localStorage.getItem(MCS_LOCAL_PROGRESS_KEY),
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY),
    ]
    const read = () =>
      reader === 'merged'
        ? readMergedCriticalCareProgress(window.localStorage)
        : readPublicCriticalCareProgress(criticalCareActivities, window.localStorage)
    const result = read()
    expect(result.envelope.activities.filter((a) => a.activityId.startsWith('mcs:'))).toEqual([])
    expect(result.envelope.resume).toBeUndefined()
    expect(deriveCriticalCareDashboard(result).resume).toBeNull()
    expect(
      getCriticalCareRecommendations(mcsActivities, result.envelope, { limit: 100 }).map(
        (r) => r.activity.id,
      ),
    ).toContain('mcs:assess:CAP-IABP-01')
    expect([
      window.localStorage.getItem(MCS_LOCAL_PROGRESS_KEY),
      window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY),
    ]).toEqual(before)

    recordMcsVisit('CAP-IABP-01', 'assess', 'iabp', 'explain')
    const current = read()
    expect(current.envelope.activities.filter((a) => a.activityId.startsWith('mcs:'))).toEqual([
      expect.objectContaining({
        activityId: 'mcs:assess:CAP-IABP-01',
        status: 'in-progress',
        attempts: 0,
        competencyEvidenceIds: [],
      }),
    ])
    expect(
      current.envelope.activities.find((a) => a.activityId === 'mcs:assess:CAP-IABP-01')?.bestScore,
    ).toBeUndefined()
    expect(current.envelope.resume).toMatchObject({
      activityId: 'mcs:assess:CAP-IABP-01',
      phase: 'explain',
      mode: 'guided',
    })
    expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
      '/mechanical-circulatory-support/assess?case=CAP-IABP-01',
    )
    const stored = JSON.parse(window.localStorage.getItem(MCS_LOCAL_PROGRESS_KEY)!)
    const { selfPaced, ...old } = stored
    expect(old).toEqual(legacy)
    expect(selfPaced).toMatchObject({ visitedCaseIds: ['CAP-IABP-01'] })
    expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(before[1])
  },
)
it('preserves an explicit CRRT selection in both readers', () => {
  recordCriticalCareActivitySelection(window.localStorage, {
    activityId: 'crrt:practice:CRRT-13',
    mode: 'practice',
    query: { case: 'CRRT-13' },
    payloadVersion: 'crrt-selection-v1',
  })
  const before = window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
  expect(getCriticalCareResumeTarget(window.localStorage)?.pointer.activityId).toBe(
    'crrt:practice:CRRT-13',
  )
  expect(
    readPublicCriticalCareProgress(criticalCareActivities, window.localStorage).envelope.resume
      ?.activityId,
  ).toBe('crrt:practice:CRRT-13')
  expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(before)
})

it('orders the current MCS location after an older non-MCS resume without assigning visit chronology or changing the older store', () => {
  recordCriticalCareActivitySelection(
    window.localStorage,
    {
      activityId: 'crrt:practice:CRRT-13',
      mode: 'practice',
      query: { case: 'CRRT-13' },
      payloadVersion: 'crrt-selection-v1',
    },
    '2026-07-22T12:00:00.000Z',
  )
  const before = window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
  expect(getCriticalCareResumeTarget(window.localStorage)?.pointer.activityId).toBe(
    'crrt:practice:CRRT-13',
  )
  recordMcsVisit('IABP-02', 'practice', 'iabp')
  for (const result of [
    readMergedCriticalCareProgress(window.localStorage),
    readPublicCriticalCareProgress(criticalCareActivities, window.localStorage),
  ]) {
    expect(result.envelope.resume?.activityId).toBe('mcs:practice:IABP-02')
    const visit = result.envelope.activities.find((a) => a.activityId === 'mcs:practice:IABP-02')!
    expect(visit.updatedAt).toBe('1970-01-01T00:00:00.000Z')
    expect(visit.attempts).toBe(0)
  }
  expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(before)
})
