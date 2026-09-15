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
      activity: { id: 'hemodynamics:learn:why-measure' },
      href: '/icu-hemodynamics/learn?activity=why-measure',
    })
    expect(dashboard.modules).toHaveLength(4)
    expect(dashboard.pathways).toHaveLength(5)
  })

  it('resolves an exact safe checkpoint and recommends a different next activity', () => {
    const activity = criticalCareActivityById.get('mcs:learn:mcs-foundations-signals')!
    const dashboard = deriveCriticalCareDashboard(
      readResult({
        version: 1,
        activities: [
          progress(activity.id, {
            currentPhase: 'act',
            mode: 'guided',
            attempts: 0,
            updatedAt: '1970-01-01T00:00:00.000Z',
          }),
        ],
        resume: {
          activityId: activity.id,
          pathname: activity.pathname,
          query: activity.query,
          mode: 'guided',
          phase: 'act',
          checkpointId: 'measurement-chain-checked',
          payloadVersion: 'mcs-location-v1',
          updatedAt: '2026-07-22T12:00:00.000Z',
        },
        updatedAt: '2026-07-22T12:00:00.000Z',
      }),
    )

    expect(dashboard.audienceState).toBe('returning')
    expect(dashboard.resume).toMatchObject({
      href: '/mechanical-circulatory-support/learn?lesson=mcs-foundations-signals',
      pointer: { phase: 'act', checkpointId: 'measurement-chain-checked' },
    })
    expect(dashboard.recommendation?.activity.id).not.toBe(activity.id)
    expect(dashboard.recent).toEqual([])
  })

  it.each(['completed', 'mastered'] as const)(
    'does not turn historical MCS %s into visits or recommendations',
    (status) => {
      const historical = progress('mcs:practice:IABP-01', {
        status,
        bestScore: 99,
        attempts: 4,
        competencyEvidenceIds: ['critical-care-safety'],
      })
      const empty = { version: 1 as const, activities: [], updatedAt: historical.updatedAt }
      expect(
        deriveCriticalCareDashboard(readResult({ ...empty, activities: [historical] })),
      ).toEqual(deriveCriticalCareDashboard(readResult(empty)))
    },
  )

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
    expect(dashboard.recommendation?.activity.id).toBe('hemodynamics:learn:why-measure')
  })

  it('excludes historical MCS completion from module states and pathway milestones', () => {
    const completed = [
      progress('mcs:practice:IMP-01', { status: 'completed' }),
      progress('mcs:practice:IABP-01', { status: 'completed' }),
    ]
    const modules = summarizeCriticalCareModules(completed)
    const pathways = summarizeCriticalCarePathways(completed)
    const mcsActivityCount = criticalCareActivities.filter(
      (activity) => activity.moduleId === 'mechanical-circulatory-support',
    ).length

    expect(
      modules.find((item) => item.module.id === 'mechanical-circulatory-support'),
    ).toMatchObject({
      state: 'not-started',
      completedActivities: 0,
      totalActivities: mcsActivityCount,
      percentComplete: 0,
    })
    expect(pathways.find((item) => item.pathway.id === 'shock-and-perfusion')).toMatchObject({
      state: 'not-started',
      completedActivities: 0,
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
