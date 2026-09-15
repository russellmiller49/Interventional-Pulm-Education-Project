import {
  MCS_LOCAL_PROGRESS_KEY,
  recordMcsVisit,
} from '@/features/mechanical-circulatory-support/engine/learningProgress'
import { MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY } from '@/features/mechanical-ventilation/engine/progress'
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
  CriticalCareAccountSyncModuleId,
  CriticalCareCoarseAccountProgress,
  CriticalCareCoarseProgressBatch,
} from '@/lib/critical-care-progress-sync'
import {
  masteredLegacyProgressFixtures,
  partialLegacyProgressFixtures,
} from '../__fixtures__/legacyProgress'
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
  ['mechanical-circulatory-support', 'mcs:assess:CAP-IMP-01', MCS_LOCAL_PROGRESS_KEY],
  [
    'mechanical-ventilation',
    'ventilation:practice:MV-01',
    MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
  ],
  ['baxter-crrt', 'crrt:assess:MASTERY-PRISMAX-01', BAXTER_CRRT_PROGRESS_STORAGE_KEY],
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

function account(moduleId: CriticalCareAccountSyncModuleId): CriticalCareCoarseAccountProgress {
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

describe('SHARED-01 and MCS-01 historical consumer boundary', () => {
  beforeEach(() => localStorage.clear())

  it.each(modules)(
    '%s legacy and normalized records are inert in full/public/restricted readers',
    (moduleId, id, key) => {
      const envelope = historicalEnvelope(id)
      const historical = { ...partialLegacyProgressFixtures, ...masteredLegacyProgressFixtures }[
        key
      ]
      expect(historical).toBeDefined()
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

  it.each([
    ['mcs-foundations-signals', 'learn', 'iabp'],
    ['IMP-03', 'practice', 'impella'],
    ['CAP-IMP-01', 'assess', 'impella'],
  ] as const)(
    'keeps a new MCS %s visit and phase without reviving historical grades',
    (id, section, device) => {
      for (const [key, value] of Object.entries(masteredLegacyProgressFixtures))
        localStorage.setItem(key, value)
      const legacy = JSON.parse(localStorage.getItem(MCS_LOCAL_PROGRESS_KEY)!)
      const historical = historicalEnvelope('mcs:assess:CAP-IMP-01')
      // A newer normalized pointer must not displace a valid current module location.
      localStorage.setItem(
        CRITICAL_CARE_PROGRESS_STORAGE_KEY,
        JSON.stringify(
          {
            ...historical,
            resume: { ...historical.resume, updatedAt: '2099-01-01T00:00:00.000Z' },
          },
          null,
          2,
        ),
      )
      const normalizedBytes = localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
      expect(recordMcsVisit(id, section, device, 'observe')).toBe(true)
      const currentBytes = localStorage.getItem(MCS_LOCAL_PROGRESS_KEY)!
      const { selfPaced, ...preserved } = JSON.parse(currentBytes)
      expect(preserved).toEqual(legacy)
      const definitions = criticalCareActivities.filter(
        (activity) => activity.moduleId === 'mechanical-circulatory-support',
      )
      const activityId = `mcs:${section}:${id}`
      for (const result of [
        readMergedCriticalCareProgress(localStorage),
        readMergedCriticalCareProgress(localStorage, definitions),
        readPublicCriticalCareProgress(catalog.activities, localStorage),
      ]) {
        expect(
          result.envelope.activities.filter((item) => item.activityId.startsWith('mcs:')),
        ).toEqual([
          {
            activityId,
            status: 'in-progress',
            mode: 'guided',
            attempts: 0,
            competencyEvidenceIds: [],
            updatedAt: '1970-01-01T00:00:00.000Z',
          },
        ])
        expect(result.envelope.resume).toMatchObject({
          activityId,
          mode: 'guided',
          phase: 'observe',
          deviceId: device,
          payloadVersion: 'mcs-location-v1',
          updatedAt: selfPaced.locationUpdatedAt,
        })
        for (const dashboard of [
          deriveCriticalCareDashboard(result),
          derivePublicCriticalCareDashboard(catalog, result),
        ]) {
          expect(dashboard.audienceState).toBe('returning')
          expect(dashboard.resume?.activity.id).toBe(activityId)
          expect(dashboard.resume?.href).toBe(
            `/mechanical-circulatory-support/${section}?${section === 'learn' ? 'lesson' : 'case'}=${id}`,
          )
          expect(dashboard.resume?.pointer.phase).toBe('observe')
          expect(
            dashboard.modules.find((item) => item.module.id === 'mechanical-circulatory-support'),
          ).toMatchObject({
            state: 'in-progress',
            startedActivities: 1,
            completedActivities: 0,
            percentComplete: 0,
          })
          expect(dashboard.recent.some((item) => item.activity.id.startsWith('mcs:'))).toBe(false)
        }
        expect(getCriticalCareRecommendations(definitions, result.envelope)[0]).toMatchObject({
          activity: { id: activityId },
          reason: 'continue',
        })
        expect(projectCriticalCareCoarseProgress(result.envelope, definitions)).toBeNull()
        expect(projectPublicCriticalCareCoarseProgress(result.envelope, definitions)).toBeNull()
        expect(
          mergeCriticalCareSubsetProgress(historical, {
            ...result.envelope,
            activities: result.envelope.activities.filter((item) =>
              item.activityId.startsWith('mcs:'),
            ),
          }),
        ).toBe(historical)
      }
      expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(normalizedBytes)
      expect(localStorage.getItem(MCS_LOCAL_PROGRESS_KEY)).toBe(currentBytes)
    },
  )

  it('does not accept normalized MCS visit-shaped records as current navigation', () => {
    const historical = historicalEnvelope('mcs:practice:IMP-03')
    const normalized = {
      ...historical,
      activities: [
        {
          activityId: 'mcs:practice:IMP-03',
          status: 'in-progress',
          mode: 'guided',
          attempts: 0,
          competencyEvidenceIds: [],
          updatedAt: '1970-01-01T00:00:00.000Z',
        },
      ],
      resume: { ...historical.resume, mode: 'guided', payloadVersion: 'mcs-location-v1' },
    }
    const bytes = JSON.stringify(normalized, null, 2)
    localStorage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, bytes)
    for (const result of [
      readMergedCriticalCareProgress(localStorage),
      readPublicCriticalCareProgress(catalog.activities, localStorage),
    ]) {
      expect(result.envelope.activities).toEqual([])
      expect(result.envelope.resume).toBeUndefined()
    }
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(bytes)
  })

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

  it('keeps converted catalogs ungraded while preserving ICU assessment authority', () => {
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
    for (const moduleId of ['icu-simulation']) {
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
