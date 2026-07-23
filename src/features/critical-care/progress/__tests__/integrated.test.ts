import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  parseSerializedCriticalCareProgress,
  type CriticalCareActivityProgress,
  type CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'
import { icuScenarioFamilies } from '@/features/icu-simulation/engine/types'

import {
  getCriticalCareEligibleIcuAssessmentScenarioIds,
  getCriticalCareIcuScenarioReadiness,
  getCriticalCareIcuScenarioRecommendation,
  isCriticalCareIcuAssessGateActivityApproved,
  recordCriticalCareIcuOutcome,
} from '../integrated'
import {
  CRITICAL_CARE_INTEGRATED_OUTCOMES_MAX_COURSES,
  CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY,
} from '../types'

const NOW = '2026-07-22T12:00:00.000Z'

class MemoryStorage {
  readonly values = new Map<string, string>()
  readonly setItem = jest.fn((key: string, value: string) => this.values.set(key, value))

  constructor(initial: Readonly<Record<string, string>> = {}) {
    Object.entries(initial).forEach(([key, value]) => this.values.set(key, value))
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
}

function completed(activityId: string): CriticalCareActivityProgress {
  return {
    activityId,
    status: 'completed',
    attempts: 1,
    competencyEvidenceIds: [],
    updatedAt: NOW,
  }
}

function envelope(activityIds: readonly string[] = []): CriticalCareProgressEnvelope {
  return {
    version: 1,
    activities: activityIds.map(completed),
    updatedAt: NOW,
  }
}

describe('integrated ICU capstone progress boundary', () => {
  it('keeps the public aggregate bound synchronized with the private course catalog', () => {
    expect(CRITICAL_CARE_INTEGRATED_OUTCOMES_MAX_COURSES).toBe(icuScenarioFamilies.length)
  })

  it('starts with a broad foundation course and changes recommendation with focused completion', () => {
    expect(getCriticalCareIcuScenarioRecommendation(envelope())).toMatchObject({
      scenarioId: 'septic-ards-aki',
      reason: 'foundation',
    })

    const cardiogenic = envelope(['hemodynamics:practice:HD-03', 'mcs:practice:IMP-03'])
    expect(getCriticalCareIcuScenarioRecommendation(cardiogenic)).toMatchObject({
      scenarioId: 'lv-cardiogenic',
      reason: 'focused-alignment',
      readiness: {
        completedRequirementCount: 2,
        totalRequirementCount: 2,
        eligibleForAssess: true,
        approvedGateRequirementCount: 0,
        gateStatus: 'preview-open',
      },
    })

    expect(
      getCriticalCareIcuScenarioRecommendation(envelope(['hemodynamics:practice:HD-01']))
        .scenarioId,
    ).toBe('hemorrhagic')
  })

  it('uses explainable any-of groups for assessment eligibility and direct refreshers', () => {
    const partial = getCriticalCareIcuScenarioReadiness(
      'septic-ards-aki',
      envelope(['ventilation:practice:MV-14']),
    )
    expect(partial).toMatchObject({
      completedRequirementCount: 1,
      totalRequirementCount: 3,
      percentReady: 33,
      approvedGateRequirementCount: 0,
      gateStatus: 'preview-open',
      eligibleForAssess: true,
    })
    expect(partial.requirements.find((item) => item.id === 'septic-ventilation')).toMatchObject({
      completed: true,
      countsForAssessGate: false,
      assessGateSatisfied: true,
      rationale: expect.any(String),
    })
    expect(partial.requirements.flatMap((item) => item.refreshers).every((item) => item.href)).toBe(
      true,
    )

    const ready = envelope([
      'hemodynamics:practice:HD-02',
      'ventilation:practice:MV-01',
      'crrt:practice:CRRT-10',
    ])
    expect(getCriticalCareEligibleIcuAssessmentScenarioIds(ready)).toContain('septic-ards-aki')
  })

  it('never turns pending-review or non-credit activities into hard Assess gates', () => {
    const reviewedCase = criticalCareActivityById.get('hemodynamics:practice:HD-03')
    const draftLesson = criticalCareActivityById.get(
      'ventilation:learn:mechanics-load-and-pressure',
    )
    expect(reviewedCase?.reviewStatus).toBe('sme-review')
    expect(draftLesson?.reviewStatus).toBe('draft')
    expect(isCriticalCareIcuAssessGateActivityApproved(reviewedCase)).toBe(false)
    expect(isCriticalCareIcuAssessGateActivityApproved(draftLesson)).toBe(false)

    const readiness = getCriticalCareIcuScenarioReadiness(
      'lv-cardiogenic',
      envelope(['ventilation:learn:mechanics-load-and-pressure']),
    )
    expect(readiness).toMatchObject({
      approvedGateRequirementCount: 0,
      satisfiedApprovedGateRequirementCount: 0,
      gateStatus: 'preview-open',
      eligibleForAssess: true,
    })
    expect(
      getCriticalCareIcuScenarioRecommendation(
        envelope(['ventilation:learn:mechanics-load-and-pressure']),
      ).reason,
    ).toBe('foundation')
  })

  it('writes only normalized coarse ICU outcome evidence', () => {
    const storage = new MemoryStorage()

    expect(
      recordCriticalCareIcuOutcome(storage, {
        scenarioId: 'lv-cardiogenic',
        mode: 'assess',
        score: 88.4,
        mastered: true,
        attempts: 2,
        now: NOW,
      }),
    ).toBe(true)

    const serialized = storage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
    const saved = parseSerializedCriticalCareProgress(serialized)
    expect(saved?.activities).toEqual([
      {
        activityId: 'icu:assess:lv-cardiogenic',
        status: 'completed',
        mode: 'challenge',
        bestScore: 88,
        attempts: 2,
        competencyEvidenceIds: [],
        updatedAt: NOW,
      },
    ])
    expect(serialized).not.toMatch(
      /patient|waveform|commands|replay|therapy|deviceState|focusedState/i,
    )
    expect(storage.getItem(CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 1,
        completedCourseCount: 1,
        latestCompletedAt: NOW,
      }),
    )
    expect(storage.getItem(CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY)).not.toMatch(
      /lv-cardiogenic|scenario|patient|waveform|commands|replay/i,
    )
  })

  it('counts one longitudinal course across Practice and Assess attempts', () => {
    const storage = new MemoryStorage()
    const attempts = [
      {
        scenarioId: 'lv-cardiogenic' as const,
        mode: 'practice' as const,
        now: '2026-07-22T12:00:00.000Z',
      },
      {
        scenarioId: 'lv-cardiogenic' as const,
        mode: 'assess' as const,
        now: '2026-07-22T13:00:00.000Z',
      },
      {
        scenarioId: 'tamponade' as const,
        mode: 'practice' as const,
        now: '2026-07-22T14:00:00.000Z',
      },
    ]

    for (const attempt of attempts) {
      expect(
        recordCriticalCareIcuOutcome(storage, {
          ...attempt,
          score: 82,
          mastered: false,
          attempts: 1,
        }),
      ).toBe(true)
    }

    expect(JSON.parse(storage.getItem(CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY)!)).toEqual({
      version: 1,
      completedCourseCount: 2,
      latestCompletedAt: '2026-07-22T14:00:00.000Z',
    })
  })

  it('does not overwrite corrupt or incompatible normalized progress', () => {
    const corrupt = '{not-json'
    const storage = new MemoryStorage({
      [CRITICAL_CARE_PROGRESS_STORAGE_KEY]: corrupt,
    })

    expect(
      recordCriticalCareIcuOutcome(storage, {
        scenarioId: 'tamponade',
        mode: 'practice',
        score: 72,
        mastered: false,
        attempts: 1,
        now: NOW,
      }),
    ).toBe(false)
    expect(storage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(corrupt)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})
