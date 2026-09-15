import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { deriveCriticalCareDashboard } from '@/features/critical-care/dashboard'
import { derivePublicCriticalCareDashboard } from '@/features/critical-care/publicDashboard'
import { CARDIOHELP_PROGRESS_STORAGE_KEY } from '@/features/cardiohelp-ecmo/engine/progress'
import { ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY } from '@/features/icu-hemodynamics/engine/progress'
import { ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY } from '@/features/icu-hemodynamics/engine/selfPacedProgress'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '@/features/baxter-crrt/engine/progress'
import { recordCrrtVisit } from '@/features/baxter-crrt/selfPacedProgress'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  type CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'
import type {
  CriticalCareCoarseAccountProgress,
  CriticalCareCoarseProgressBatch,
} from '@/lib/critical-care-progress-sync'
import { masteredLegacyProgressFixtures } from '../__fixtures__/legacyProgress'
import { readMergedCriticalCareProgress } from '../index'
import { readPublicCriticalCareProgress } from '../publicClient'
import { getCriticalCareRecommendations } from '../recommendation'
import {
  getCriticalCareIcuScenarioReadiness,
  getCriticalCareIcuScenarioRecommendation,
} from '../integrated'
import {
  hydrateCriticalCareCoarseProgress,
  projectCriticalCareCoarseProgress,
  getCriticalCareCoarseProgress,
  postCriticalCareCoarseProgress,
} from '../accountSync'
import {
  hydratePublicCriticalCareCoarseProgress,
  projectPublicCriticalCareCoarseProgress,
  mergeCriticalCareSubsetProgress,
  getPublicCriticalCareCoarseProgress,
  postPublicCriticalCareCoarseProgress,
} from '../publicAccountSync'

const now = '2026-09-14T12:00:00.000Z'
const empty: CriticalCareProgressEnvelope = { version: 1, activities: [], updatedAt: now }
const catalog = buildCriticalCarePublicClientCatalog()
const modules = [
  ['icu-hemodynamics', 'hemodynamics:practice:HD-03', ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
  ['cardiohelp-ecmo', 'ecmo:assess:vv-off-sweep-capstone', CARDIOHELP_PROGRESS_STORAGE_KEY],
] as const

function historicalEnvelope(id: string): CriticalCareProgressEnvelope {
  const activity = criticalCareActivities.find((item) => item.id === id)!
  return {
    ...empty,
    activities: [
      {
        activityId: id,
        status: 'mastered',
        bestScore: 100,
        attempts: 9,
        competencyEvidenceIds: activity.competencyIds,
        updatedAt: now,
      },
    ],
    resume: {
      activityId: id,
      pathname: activity.pathname,
      query: activity.query,
      mode: activity.supportedModes[0],
      phase: 'explain',
      payloadVersion: 'historical-v1',
      updatedAt: now,
    },
  }
}

function account(
  moduleId: 'icu-hemodynamics' | 'cardiohelp-ecmo',
): CriticalCareCoarseAccountProgress {
  return {
    schemaVersion: 1,
    accountId: 'learner',
    modules: [
      {
        moduleId,
        percentComplete: 100,
        completedSections: ['learn', 'practice', 'assess'],
        completedAt: now,
        lastVisitedAt: now,
      },
    ],
  }
}

describe('SHARED-01 historical HD/ECMO consumer boundary', () => {
  beforeEach(() => localStorage.clear())

  it.each(modules)(
    '%s legacy and normalized records are inert in full/public/restricted readers',
    (moduleId, id, key) => {
      const envelope = historicalEnvelope(id)
      const historical = masteredLegacyProgressFixtures[key]
      // Deliberate whitespace proves the read does not canonicalize stored JSON.
      localStorage.setItem(key, ` \n${historical}\n `)
      localStorage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, JSON.stringify(envelope, null, 2))
      const before = { ...localStorage }
      const restricted = criticalCareActivities.filter((activity) => activity.moduleId === moduleId)
      for (const result of [
        readMergedCriticalCareProgress(localStorage),
        readMergedCriticalCareProgress(localStorage, restricted),
        readPublicCriticalCareProgress(catalog.activities, localStorage),
      ]) {
        expect(result.envelope.activities).toEqual([])
        expect(result.envelope.resume).toBeUndefined()
        expect(
          getCriticalCareRecommendations(criticalCareActivities, result.envelope, { limit: 100 }),
        ).toEqual(getCriticalCareRecommendations(criticalCareActivities, empty, { limit: 100 }))
      }
      // Raw historical bytes remain available, and no current module record is synthesized.
      expect({ ...localStorage }).toEqual(before)
      expect(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)).toBeNull()
      expect(JSON.parse(localStorage.getItem(key)!).selfPaced).toBeUndefined()
    },
  )

  it.each(modules)(
    '%s raw records cannot affect dashboards, recommendations, or ICU readiness',
    (_moduleId, id) => {
      const envelope = historicalEnvelope(id)
      const read = {
        envelope,
        normalizedSource: {
          moduleId: 'critical-care',
          storageKey: CRITICAL_CARE_PROGRESS_STORAGE_KEY,
          status: 'valid' as const,
        },
        legacySources: [],
        notices: [],
      }
      const baseline = { ...read, envelope: empty }
      expect(deriveCriticalCareDashboard(read)).toEqual(deriveCriticalCareDashboard(baseline))
      expect(derivePublicCriticalCareDashboard(catalog, read)).toEqual(
        derivePublicCriticalCareDashboard(catalog, baseline),
      )
      expect(
        getCriticalCareRecommendations(criticalCareActivities, envelope, { limit: 100 }),
      ).toEqual(getCriticalCareRecommendations(criticalCareActivities, empty, { limit: 100 }))
      expect(getCriticalCareIcuScenarioRecommendation(envelope)).toEqual(
        getCriticalCareIcuScenarioRecommendation(empty),
      )
      expect(getCriticalCareIcuScenarioReadiness('lv-cardiogenic', envelope)).toEqual(
        getCriticalCareIcuScenarioReadiness('lv-cardiogenic', empty),
      )
    },
  )

  it.each(modules)(
    '%s account hydration preserves history and cannot publish an old grade',
    async (moduleId, id) => {
      const historical = historicalEnvelope(id)
      const bytes = JSON.stringify(historical)
      const remote = account(moduleId)
      const remoteBytes = JSON.stringify(remote)
      for (const input of [empty, historical]) {
        expect(hydrateCriticalCareCoarseProgress(input, remote)).toBe(input)
        expect(hydratePublicCriticalCareCoarseProgress(input, remote, criticalCareActivities)).toBe(
          input,
        )
        expect(
          projectCriticalCareCoarseProgress(input, criticalCareActivities, [moduleId]),
        ).toBeNull()
        expect(projectPublicCriticalCareCoarseProgress(input, criticalCareActivities)).toBeNull()
      }
      expect(
        mergeCriticalCareSubsetProgress(historical, {
          ...historical,
          activities: historical.activities.map((item) => ({
            ...item,
            updatedAt: '2026-09-15T12:00:00.000Z',
            attempts: 99,
          })),
        }),
      ).toBe(historical)
      expect(JSON.stringify(historical)).toBe(bytes)
      expect(JSON.stringify(remote)).toBe(remoteBytes)
      const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => remote })
      expect((await getCriticalCareCoarseProgress('learner', fetcher))?.modules).toEqual([])
      expect(
        (await getPublicCriticalCareCoarseProgress('learner', criticalCareActivities, fetcher))
          ?.modules,
      ).toEqual([])
      fetcher.mockClear()
      const batch: CriticalCareCoarseProgressBatch = {
        schemaVersion: 1,
        modules: [
          {
            moduleId,
            percentComplete: 100,
            completedSections: ['learn', 'practice', 'assess'],
            completed: true,
          },
        ],
      }
      await expect(postCriticalCareCoarseProgress(batch, 'learner', fetcher)).resolves.toBe(false)
      await expect(
        postPublicCriticalCareCoarseProgress(batch, 'learner', criticalCareActivities, fetcher),
      ).resolves.toBe(false)
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  it('keeps CRRT real visits/resume and its public account exclusions, and leaves MV inert', () => {
    for (const [key, value] of Object.entries(masteredLegacyProgressFixtures))
      localStorage.setItem(key, value)
    const historical = localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!
    expect(
      readMergedCriticalCareProgress(localStorage).envelope.activities.filter((item) =>
        /^(crrt|ventilation):/.test(item.activityId),
      ),
    ).toEqual([])
    expect(recordCrrtVisit({ section: 'learn', id: 'crrt-circuit-pressures' }, localStorage)).toBe(
      true,
    )
    const current = localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!
    const { selfPaced, ...legacy } = JSON.parse(current)
    expect(legacy).toEqual(JSON.parse(historical))
    expect(selfPaced.visitedLessonIds).toEqual(['crrt-circuit-pressures'])
    for (const read of [
      readMergedCriticalCareProgress(localStorage),
      readPublicCriticalCareProgress(catalog.activities, localStorage),
    ]) {
      expect(
        read.envelope.activities.filter((item) => item.activityId.startsWith('crrt:')),
      ).toEqual([
        expect.objectContaining({
          activityId: 'crrt:learn:crrt-circuit-pressures',
          status: 'in-progress',
          attempts: 0,
          competencyEvidenceIds: [],
        }),
      ])
      expect(read.envelope.resume?.activityId).toBe('crrt:learn:crrt-circuit-pressures')
      expect(
        read.envelope.activities.some((item) => item.activityId.startsWith('ventilation:')),
      ).toBe(false)
    }
    for (const moduleId of ['baxter-crrt', 'mechanical-ventilation'] as const) {
      const remote = {
        ...account('icu-hemodynamics'),
        modules: [{ ...account('icu-hemodynamics').modules[0], moduleId }],
      }
      expect(hydratePublicCriticalCareCoarseProgress(empty, remote, catalog.activities)).toBe(empty)
    }
    expect(localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(current)
  })

  it('changes only HD/ECMO grading metadata while keeping stable destinations and other module policies', () => {
    for (const [moduleId] of modules) {
      const definitions = criticalCareActivities.filter(
        (activity) => activity.moduleId === moduleId,
      )
      expect(definitions.length).toBeGreaterThan(0)
      for (const activity of definitions) {
        expect(activity.creditPolicy).toBe('non-credit')
        expect(activity.completionEvidenceAuthority).toBe('none')
        expect(activity.masteryRuleId).toBeUndefined()
        expect(activity.prerequisiteActivityIds).toEqual([])
        if (activity.pathname.endsWith('/assess')) expect(activity.kind).toBe('practice-case')
      }
    }
    for (const moduleId of ['mechanical-circulatory-support', 'icu-simulation']) {
      const assess = criticalCareActivities.filter(
        (activity) => activity.moduleId === moduleId && activity.pathname.endsWith('/assess'),
      )
      expect(assess.length).toBeGreaterThan(0)
      for (const activity of assess) {
        expect(activity.kind).toBe('assessment')
        expect(activity.masteryRuleId).toBeDefined()
        expect(activity.completionEvidenceAuthority).toBe('reviewed-engine-score')
      }
    }
  })
})
