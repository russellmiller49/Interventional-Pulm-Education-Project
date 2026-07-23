import {
  criticalCareActivities,
  criticalCareActivityById,
} from '@/features/critical-care/content/activities'
import { ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY } from '@/features/icu-hemodynamics/engine/progress'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  type CriticalCareActivityProgress,
  type CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'

import {
  corruptProgressFixture,
  masteredLegacyProgressFixtures,
} from '../__fixtures__/legacyProgress'
import { getCriticalCareRecommendation, getCriticalCareRecommendations } from '../recommendation'
import {
  getCriticalCareResumeTarget,
  mergeCriticalCareProgress,
  readMergedCriticalCareProgress,
} from '../index'
import { LEGACY_PROGRESS_EPOCH, type CriticalCareReadableStorage } from '../types'

class ReadOnlyFixtureStorage implements CriticalCareReadableStorage {
  readonly setItem = jest.fn(() => {
    throw new Error('Normalized reads must remain read-only.')
  })

  constructor(readonly values: Readonly<Record<string, string>> = {}) {}

  getItem(key: string): string | null {
    return this.values[key] ?? null
  }
}

function catalogActivity(id: string) {
  const activity = criticalCareActivityById.get(id)
  if (!activity) throw new Error(`Missing catalog test activity ${id}`)
  return activity
}

function normalizedActivity(
  activityId: string,
  overrides: Partial<CriticalCareActivityProgress> = {},
): CriticalCareActivityProgress {
  return {
    activityId,
    status: 'in-progress',
    attempts: 1,
    competencyEvidenceIds: [],
    updatedAt: '2026-07-22T12:00:00.000Z',
    ...overrides,
  }
}

function normalizedEnvelope(
  activities: readonly CriticalCareActivityProgress[],
): CriticalCareProgressEnvelope {
  return {
    version: 1,
    activities,
    updatedAt: '2026-07-22T12:00:00.000Z',
  }
}

describe('normalized critical-care progress merge', () => {
  it('uses a deterministic epoch for a completely empty read', () => {
    const storage = new ReadOnlyFixtureStorage()
    const result = readMergedCriticalCareProgress(storage, criticalCareActivities)

    expect(result.envelope).toEqual({
      version: 1,
      activities: [],
      updatedAt: LEGACY_PROGRESS_EPOCH,
    })
    expect(result.normalizedSource.status).toBe('empty')
    expect(result.legacySources.every((source) => source.status === 'empty')).toBe(true)
    expect(result.notices).toEqual([])
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('merges colliding normalized and legacy records monotonically', () => {
    const activityId = 'hemodynamics:practice:HD-01'
    const normalized = normalizedEnvelope([
      normalizedActivity(activityId, { status: 'in-progress', attempts: 7, bestScore: 40 }),
    ])
    const storage = new ReadOnlyFixtureStorage({
      [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: JSON.stringify(normalized),
      [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
        masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
    })

    const result = readMergedCriticalCareProgress(storage, criticalCareActivities)
    expect(result.envelope.activities.find((item) => item.activityId === activityId)).toMatchObject(
      {
        status: 'mastered',
        attempts: 7,
        bestScore: 92,
        updatedAt: '2026-07-22T12:00:00.000Z',
      },
    )
    expect(result.normalizedSource.status).toBe('valid')
    expect(result.envelope.updatedAt).toBe('2026-07-22T12:00:00.000Z')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('sanitizes historical completion and competency claims against the current activity contract', () => {
    const activityId = 'ventilation:learn:mechanics-load-and-pressure'
    const result = mergeCriticalCareProgress(
      normalizedEnvelope([
        normalizedActivity(activityId, {
          status: 'mastered',
          competencyEvidenceIds: [
            'ventilation-mechanics',
            'ventilation-mode-selection',
            'unrelated-competency',
          ],
        }),
      ]),
      [],
      criticalCareActivities,
    )

    expect(result.activities.find((item) => item.activityId === activityId)).toMatchObject({
      status: 'in-progress',
      competencyEvidenceIds: [],
    })
  })

  it('reports corrupt and incompatible normalized envelopes while safely retaining legacy data', () => {
    const corrupt = readMergedCriticalCareProgress(
      new ReadOnlyFixtureStorage({
        [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: corruptProgressFixture,
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(corrupt.normalizedSource).toMatchObject({
      status: 'corrupt',
      issue: 'invalid-json',
    })
    expect(
      corrupt.envelope.activities.find((item) => item.activityId === 'hemodynamics:practice:HD-01')
        ?.status,
    ).toBe('mastered')

    const incompatible = readMergedCriticalCareProgress(
      new ReadOnlyFixtureStorage({
        [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 99 }),
      }),
      criticalCareActivities,
    )
    expect(incompatible.normalizedSource).toMatchObject({
      status: 'incompatible',
      issue: 'unsupported-version',
      detectedVersion: '99',
    })
    expect(incompatible.notices).toContainEqual(incompatible.normalizedSource)
  })

  it('selects the newest valid catalog resume and falls back from an invalid normalized route', () => {
    const definition = catalogActivity('hemodynamics:practice:HD-01')
    const validNormalized: CriticalCareProgressEnvelope = {
      ...normalizedEnvelope([normalizedActivity(definition.id)]),
      resume: {
        activityId: definition.id,
        pathname: definition.pathname,
        query: definition.query,
        mode: 'practice',
        phase: 'act',
        scenarioId: 'HD-01',
        payloadVersion: 'normalized-v1',
        updatedAt: '2026-07-22T12:00:00.000Z',
      },
    }
    const normalizedTarget = getCriticalCareResumeTarget(
      new ReadOnlyFixtureStorage({
        [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: JSON.stringify(validNormalized),
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(normalizedTarget).toMatchObject({
      href: '/icu-hemodynamics/practice?case=HD-01',
      pointer: { payloadVersion: 'normalized-v1', phase: 'act' },
    })

    const invalidNormalized: CriticalCareProgressEnvelope = {
      ...validNormalized,
      resume: { ...validNormalized.resume!, pathname: '/wrong-route' },
    }
    const fallback = getCriticalCareResumeTarget(
      new ReadOnlyFixtureStorage({
        [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: JSON.stringify(invalidNormalized),
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(fallback?.pointer).toMatchObject({
      activityId: 'hemodynamics:practice:HD-01',
      payloadVersion: 'icu-hemodynamics-progress-v2',
      updatedAt: LEGACY_PROGRESS_EPOCH,
    })

    const fallbackRead = readMergedCriticalCareProgress(
      new ReadOnlyFixtureStorage({
        [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: JSON.stringify(invalidNormalized),
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    )
    expect(fallbackRead.notices).toContainEqual(
      expect.objectContaining({
        storageKey: CRITICAL_CARE_PROGRESS_STORAGE_KEY,
        status: 'incompatible',
        issue: 'catalog-target-mismatch',
      }),
    )
  })

  it('merges pure inputs without mutating either source', () => {
    const normalized = normalizedEnvelope([
      normalizedActivity('hemodynamics:learn:pac-signal-validation'),
    ])
    const legacy = readMergedCriticalCareProgress(
      new ReadOnlyFixtureStorage({
        [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
          masteredLegacyProgressFixtures[ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY],
      }),
      criticalCareActivities,
    ).legacySources
    const before = JSON.stringify({ normalized, legacy })

    const merged = mergeCriticalCareProgress(normalized, legacy, criticalCareActivities)

    expect(merged.activities.map((item) => item.activityId)).toEqual([
      'hemodynamics:learn:pac-signal-validation',
      'hemodynamics:practice:HD-01',
    ])
    expect(JSON.stringify({ normalized, legacy })).toBe(before)
  })
})

describe('deterministic critical-care recommendations', () => {
  const empty = normalizedEnvelope([])

  it('gives a new learner one stable first activity', () => {
    expect(getCriticalCareRecommendation(criticalCareActivities, empty)).toMatchObject({
      activity: { id: 'hemodynamics:learn:pac-signal-validation' },
      reason: 'next-unblocked',
    })
  })

  it('prioritizes continuing an in-progress activity', () => {
    const progress = normalizedEnvelope([
      normalizedActivity('ventilation:practice:MV-06', { status: 'in-progress' }),
    ])
    expect(getCriticalCareRecommendation(criticalCareActivities, progress)).toMatchObject({
      activity: { id: 'ventilation:practice:MV-06' },
      reason: 'continue',
    })
  })

  it('downgrades unsupported completion before ranking or prerequisite checks', () => {
    const nonCreditLesson = catalogActivity('hemodynamics:learn:pressure-system')
    const invalidCompletion = normalizedEnvelope([
      normalizedActivity(nonCreditLesson.id, {
        status: 'mastered',
        competencyEvidenceIds: ['signal-validation', 'critical-care-safety'],
      }),
    ])

    expect(getCriticalCareRecommendation([nonCreditLesson], invalidCompletion)).toMatchObject({
      activity: { id: nonCreditLesson.id },
      reason: 'continue',
      progress: { status: 'in-progress', competencyEvidenceIds: [] },
    })

    const capstone = catalogActivity('mcs:assess:CAP-IMP-01')
    const unsupportedPrerequisites = normalizedEnvelope(
      capstone.prerequisiteActivityIds.map((activityId) =>
        normalizedActivity(activityId, { status: 'completed' }),
      ),
    )
    expect(
      getCriticalCareRecommendations(criticalCareActivities, unsupportedPrerequisites, {
        limit: 100,
      }).some((recommendation) => recommendation.activity.id === capstone.id),
    ).toBe(false)
  })

  it('respects prerequisites and deterministically applies learner preferences', () => {
    const blockedCapstone = catalogActivity('mcs:assess:CAP-IMP-01')
    const pac = catalogActivity('hemodynamics:learn:pac-signal-validation')
    expect(getCriticalCareRecommendation([blockedCapstone, pac], empty)?.activity.id).toBe(pac.id)

    const ventilation = catalogActivity('ventilation:practice:MV-01')
    expect(
      getCriticalCareRecommendation([pac, ventilation], empty, {
        preferredModuleIds: ['mechanical-ventilation'],
      })?.activity.id,
    ).toBe(ventilation.id)

    expect(
      getCriticalCareRecommendations([pac, ventilation], empty, {
        missedCompetencyIds: ['signal-validation'],
        limit: 2,
      }).map((item) => item.activity.id),
    ).toEqual([pac.id, ventilation.id])
  })
})
