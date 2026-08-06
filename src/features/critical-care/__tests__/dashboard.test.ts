import {
  criticalCareActivities,
  criticalCareActivityById,
} from '@/features/critical-care/content/activities'
import {
  criticalCareActivityHref,
  deriveCriticalCareDashboard,
  summarizeCriticalCareModules,
  summarizeCriticalCarePathways,
} from '@/features/critical-care/dashboard'
import type { CriticalCareProgressReadResult } from '@/features/critical-care/progress/types'
import type {
  CriticalCareActivityProgress,
  CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'

const emptyReport = {
  moduleId: 'critical-care',
  storageKey: 'critical-care-activity-progress-v1',
  status: 'empty' as const,
}

function readResult(
  envelope: CriticalCareProgressEnvelope,
  notices: CriticalCareProgressReadResult['notices'] = [],
): CriticalCareProgressReadResult {
  return {
    envelope,
    normalizedSource: emptyReport,
    legacySources: [],
    notices,
  }
}

function progress(
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

describe('critical-care dashboard derivation', () => {
  it('gives a new learner one stable reviewed recommendation', () => {
    const dashboard = deriveCriticalCareDashboard(
      readResult({ version: 1, activities: [], updatedAt: '1970-01-01T00:00:00.000Z' }),
    )

    expect(dashboard.audienceState).toBe('new')
    expect(dashboard.resume).toBeNull()
    expect(dashboard.recommendation).toMatchObject({
      activity: { id: 'hemodynamics:learn:pressure-system' },
      href: '/icu-hemodynamics/learn?activity=pressure-system',
    })
    expect(dashboard.modules).toHaveLength(4)
    expect(dashboard.pathways).toHaveLength(5)
  })

  it('resolves an exact safe checkpoint and recommends a different next activity', () => {
    const activity = criticalCareActivityById.get('hemodynamics:learn:pac-signal-validation')!
    const dashboard = deriveCriticalCareDashboard(
      readResult({
        version: 1,
        activities: [progress(activity.id, { currentPhase: 'act', mode: 'guided' })],
        resume: {
          activityId: activity.id,
          pathname: activity.pathname,
          query: activity.query,
          mode: 'guided',
          phase: 'act',
          checkpointId: 'measurement-chain-checked',
          payloadVersion: 'pac-signal-validation-v1',
          updatedAt: '2026-07-22T12:00:00.000Z',
        },
        updatedAt: '2026-07-22T12:00:00.000Z',
      }),
    )

    expect(dashboard.audienceState).toBe('returning')
    expect(dashboard.resume).toMatchObject({
      href: '/icu-hemodynamics/learn?activity=pac-signal-validation',
      pointer: { phase: 'act', checkpointId: 'measurement-chain-checked' },
    })
    expect(dashboard.recommendation?.activity.id).not.toBe(activity.id)
    expect(dashboard.recent.map((item) => item.activity.id)).toEqual([activity.id])
  })

  it('does not invent recent chronology for legacy projections', () => {
    const dashboard = deriveCriticalCareDashboard(
      readResult({
        version: 1,
        activities: [
          progress('mcs:practice:IABP-01', {
            status: 'completed',
            updatedAt: '1970-01-01T00:00:00.000Z',
          }),
        ],
        updatedAt: '1970-01-01T00:00:00.000Z',
      }),
    )

    expect(dashboard.audienceState).toBe('returning')
    expect(dashboard.recent).toEqual([])
    expect(
      dashboard.modules.find((item) => item.module.id === 'mechanical-circulatory-support'),
    ).toMatchObject({ state: 'in-progress', completedActivities: 1, startedActivities: 1 })
  })

  it('recalculates recommendations and summaries from authoritative evidence', () => {
    const invalidCompletion = progress('hemodynamics:learn:pressure-system', {
      status: 'mastered',
      competencyEvidenceIds: ['signal-validation', 'critical-care-safety'],
    })
    const dashboard = deriveCriticalCareDashboard(
      readResult({
        version: 1,
        activities: [invalidCompletion],
        updatedAt: invalidCompletion.updatedAt,
      }),
    )

    expect(dashboard.recommendation).toMatchObject({
      activity: { id: 'hemodynamics:learn:pressure-system' },
      progress: { status: 'in-progress', competencyEvidenceIds: [] },
    })
    expect(dashboard.recent[0]?.progress).toMatchObject({
      status: 'in-progress',
      competencyEvidenceIds: [],
    })
    expect(dashboard.modules.find((item) => item.module.id === 'icu-hemodynamics')).toMatchObject({
      state: 'in-progress',
      completedActivities: 0,
      startedActivities: 1,
    })
  })

  it('surfaces an incompatible-only state without treating it as learner progress', () => {
    const dashboard = deriveCriticalCareDashboard(
      readResult({ version: 1, activities: [], updatedAt: '1970-01-01T00:00:00.000Z' }, [
        {
          moduleId: 'critical-care',
          storageKey: 'critical-care-activity-progress-v1',
          status: 'incompatible',
          issue: 'unsupported-version',
          detectedVersion: '99',
        },
      ]),
    )

    expect(dashboard.audienceState).toBe('incompatible')
    expect(dashboard.issueCount).toBe(1)
    expect(dashboard.recommendation?.activity.id).toBe('hemodynamics:learn:pressure-system')
  })

  it('calculates module states and pathway milestones only from explicit completion', () => {
    const completed = [
      progress('hemodynamics:learn:pac-signal-validation', { status: 'completed' }),
      progress('hemodynamics:practice:HD-01', { status: 'completed' }),
    ]
    const modules = summarizeCriticalCareModules(completed)
    const pathways = summarizeCriticalCarePathways(completed)
    const hemodynamicsActivityCount = criticalCareActivities.filter(
      (activity) => activity.moduleId === 'icu-hemodynamics',
    ).length

    expect(modules.find((item) => item.module.id === 'icu-hemodynamics')).toMatchObject({
      state: 'in-progress',
      completedActivities: 2,
      totalActivities: hemodynamicsActivityCount,
      percentComplete: Math.round((2 / hemodynamicsActivityCount) * 100),
    })
    expect(pathways.find((item) => item.pathway.id === 'shock-and-perfusion')).toMatchObject({
      state: 'in-progress',
      completedActivities: 2,
    })
  })

  it('builds stable local activity links from catalog queries', () => {
    const activity = criticalCareActivityById.get('ecmo:practice:clinical-vv-initiation-ards')
    expect(activity).toBeDefined()
    expect(criticalCareActivityHref(activity!)).toBe(
      '/cardiohelp-ecmo/practice?case=clinical-vv-initiation-ards&track=vv',
    )
  })
})
