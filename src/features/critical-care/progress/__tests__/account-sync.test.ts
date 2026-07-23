import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityProgress,
  CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'
import type {
  CriticalCareCoarseAccountProgress,
  CriticalCareCoarseProgressBatch,
} from '@/lib/critical-care-progress-sync'

import {
  completedLegacyProgressFixtures,
  masteredLegacyProgressFixtures,
  partialLegacyProgressFixtures,
} from '../__fixtures__/legacyProgress'
import {
  claimCriticalCareAccountSyncOwnership,
  CRITICAL_CARE_ACCOUNT_SYNC_OWNERSHIP_KEY,
  getCriticalCareCoarseProgress,
  hydrateCriticalCareCoarseProgress,
  postCriticalCareCoarseProgress,
  projectCriticalCareCoarseProgress,
} from '../accountSync'
import { readMergedCriticalCareProgress } from '../index'

function definition(
  id: string,
  overrides: Partial<CriticalCareActivityDefinition> = {},
): CriticalCareActivityDefinition {
  return {
    id,
    moduleId: 'icu-hemodynamics',
    title: id,
    description: 'Bounded test activity',
    kind: 'practice-case',
    supportedModes: ['practice'],
    pathname: `/icu-hemodynamics/${id.split(':')[1]}`,
    pathwayIds: [],
    competencyIds: ['signal-validation'],
    prerequisiteActivityIds: [],
    estimatedMinutes: 10,
    difficulty: 'foundation',
    completionRuleId: 'explicit-completion',
    assetIds: [],
    reviewStatus: 'sme-review',
    evidenceIds: [],
    ...overrides,
  }
}

function progress(
  activityId: string,
  overrides: Partial<CriticalCareActivityProgress> = {},
): CriticalCareActivityProgress {
  return {
    activityId,
    status: 'in-progress',
    currentPhase: 'act',
    mode: 'practice',
    bestScore: 72,
    attempts: 2,
    hintCount: 1,
    competencyEvidenceIds: ['signal-validation'],
    updatedAt: '2026-07-22T12:00:00.000Z',
    ...overrides,
  }
}

const activities = [
  definition('hemodynamics:learn:signal-validation', { kind: 'micro-lesson' }),
  definition('hemodynamics:learn:derived-values', { kind: 'micro-lesson' }),
  definition('hemodynamics:practice:HD-01'),
  definition('hemodynamics:assess:masked-seeded', {
    kind: 'assessment',
    masteryRuleId: 'safe-mastery',
    reviewStatus: 'draft',
  }),
] as const

describe('critical-care coarse account sync projection', () => {
  beforeEach(() => window.localStorage.clear())

  it('projects only percentages and completed section enums from non-draft activities', () => {
    const envelope: CriticalCareProgressEnvelope = {
      version: 1,
      activities: [
        progress('hemodynamics:learn:signal-validation', { status: 'completed' }),
        progress('hemodynamics:learn:derived-values'),
        progress('hemodynamics:practice:HD-01', { status: 'mastered', bestScore: 94 }),
        progress('hemodynamics:assess:masked-seeded', { status: 'mastered', bestScore: 98 }),
      ],
      resume: {
        activityId: 'hemodynamics:learn:derived-values',
        pathname: '/icu-hemodynamics/learn',
        mode: 'practice',
        phase: 'act',
        scenarioId: 'synthetic-case',
        checkpointId: 'safe-checkpoint',
        payloadVersion: 'local-replay-v1',
        updatedAt: '2026-07-22T12:00:00.000Z',
      },
      updatedAt: '2026-07-22T12:00:00.000Z',
    }

    const batch = projectCriticalCareCoarseProgress(envelope, activities)

    expect(batch).toEqual({
      schemaVersion: 1,
      modules: [
        {
          moduleId: 'icu-hemodynamics',
          percentComplete: 67,
          completedSections: ['practice'],
          completed: false,
        },
      ],
    })
    const serialized = JSON.stringify(batch)
    for (const prohibited of [
      'bestScore',
      'attempts',
      'hintCount',
      'resume',
      'scenarioId',
      'checkpointId',
      'payloadVersion',
      'competencyEvidenceIds',
      'currentPhase',
    ]) {
      expect(serialized).not.toContain(prohibited)
    }
  })

  it('does not create account rows for untouched or draft-only progress', () => {
    const empty: CriticalCareProgressEnvelope = {
      version: 1,
      activities: [],
      updatedAt: '2026-07-22T12:00:00.000Z',
    }
    expect(projectCriticalCareCoarseProgress(empty, activities)).toBeNull()

    expect(
      projectCriticalCareCoarseProgress(
        {
          ...empty,
          activities: [progress('hemodynamics:assess:masked-seeded', { status: 'mastered' })],
        },
        [activities[3]],
      ),
    ).toBeNull()
  })

  it('projects legacy-only MCS, ECMO, and CRRT progress from the merged reader', () => {
    const values = {
      ...partialLegacyProgressFixtures,
      ...completedLegacyProgressFixtures,
      ...masteredLegacyProgressFixtures,
    }
    const storage = {
      getItem: (key: string) => values[key as keyof typeof values] ?? null,
      setItem: jest.fn(),
    }

    const merged = readMergedCriticalCareProgress(storage)
    const projected = projectCriticalCareCoarseProgress(
      merged.envelope,
      undefined,
      merged.legacySources
        .filter((source) => source.status === 'valid' && source.activities.length > 0)
        .map((source) => source.moduleId),
    )

    expect(projected?.modules.map((module) => module.moduleId)).toEqual(
      expect.arrayContaining(['mechanical-circulatory-support', 'cardiohelp-ecmo', 'baxter-crrt']),
    )
  })

  it('hydrates only explicitly completed sections without inventing partial identities', () => {
    const empty: CriticalCareProgressEnvelope = {
      version: 1,
      activities: [],
      updatedAt: '2026-07-01T00:00:00.000Z',
    }
    const server: CriticalCareCoarseAccountProgress = {
      schemaVersion: 1,
      accountId: 'user-1',
      modules: [
        {
          moduleId: 'icu-hemodynamics',
          percentComplete: 75,
          completedSections: ['learn'],
          completedAt: null,
          lastVisitedAt: '2026-07-22T12:00:00.000Z',
        },
      ],
    }

    const hydrated = hydrateCriticalCareCoarseProgress(empty, server, activities)

    expect(hydrated.activities).toHaveLength(2)
    expect(hydrated.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'hemodynamics:learn:signal-validation',
          status: 'completed',
          attempts: 0,
          competencyEvidenceIds: [],
        }),
        expect.objectContaining({
          activityId: 'hemodynamics:learn:derived-values',
          status: 'completed',
        }),
      ]),
    )
    expect(hydrated.activities.some((item) => item.activityId.includes(':practice:'))).toBe(false)

    const percentOnly = hydrateCriticalCareCoarseProgress(
      empty,
      {
        ...server,
        modules: [{ ...server.modules[0], percentComplete: 50, completedSections: [] }],
      },
      activities,
    )
    expect(percentOnly).toEqual(empty)
  })

  it('never downgrades detailed local mastery while hydrating coarse completion', () => {
    const local: CriticalCareProgressEnvelope = {
      version: 1,
      activities: [
        progress('hemodynamics:learn:signal-validation', {
          status: 'mastered',
          bestScore: 96,
          attempts: 4,
          competencyEvidenceIds: ['signal-validation'],
        }),
      ],
      updatedAt: '2026-07-22T12:00:00.000Z',
    }
    const hydrated = hydrateCriticalCareCoarseProgress(
      local,
      {
        schemaVersion: 1,
        accountId: 'user-1',
        modules: [
          {
            moduleId: 'icu-hemodynamics',
            percentComplete: 50,
            completedSections: ['learn'],
            completedAt: null,
            lastVisitedAt: '2026-07-23T12:00:00.000Z',
          },
        ],
      },
      activities,
    )

    expect(
      hydrated.activities.find(
        (item) => item.activityId === 'hemodynamics:learn:signal-validation',
      ),
    ).toMatchObject({
      status: 'mastered',
      bestScore: 96,
      attempts: 4,
      competencyEvidenceIds: ['signal-validation'],
    })
  })

  it('claims anonymous progress once and blocks a shared-browser account switch', () => {
    const storage = window.localStorage

    expect(claimCriticalCareAccountSyncOwnership(storage, 'user-1')).toBe('claimed')
    expect(claimCriticalCareAccountSyncOwnership(storage, 'user-1')).toBe('owned')
    expect(claimCriticalCareAccountSyncOwnership(storage, 'user-2')).toBe('blocked')
    expect(JSON.parse(storage.getItem(CRITICAL_CARE_ACCOUNT_SYNC_OWNERSHIP_KEY) ?? '{}')).toEqual({
      version: 1,
      accountId: 'user-1',
    })
  })

  it('reads only schema-valid coarse progress for the expected account', async () => {
    const remote: CriticalCareCoarseAccountProgress = {
      schemaVersion: 1,
      accountId: 'user-1',
      modules: [],
    }
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => remote })

    await expect(getCriticalCareCoarseProgress('user-1', fetcher)).resolves.toEqual(remote)
    await expect(getCriticalCareCoarseProgress('user-2', fetcher)).resolves.toBeNull()
    expect(fetcher).toHaveBeenCalledWith(
      '/api/critical-care/progress',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    )
  })

  it('posts only a schema-validated batch and fails closed without interrupting learning', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true })
    const valid: CriticalCareCoarseProgressBatch = {
      schemaVersion: 1,
      modules: [
        {
          moduleId: 'icu-hemodynamics',
          percentComplete: 50,
          completedSections: [],
          completed: false,
        },
      ],
    }

    await expect(postCriticalCareCoarseProgress(valid, 'user-1', fetcher)).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/critical-care/progress',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'X-Critical-Care-Sync-Account': 'user-1' }),
      }),
    )
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(valid)

    const invalid = {
      ...valid,
      modules: [{ ...valid.modules[0], waveformSamples: [1, 2, 3] }],
    }
    await expect(
      postCriticalCareCoarseProgress(invalid as typeof valid, 'user-1', fetcher),
    ).resolves.toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
