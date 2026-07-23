import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  parseSerializedCriticalCareProgress,
  type CriticalCareActivityProgress,
  type CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'

import {
  getCriticalCareEligibleIcuAssessmentScenarioIds,
  getCriticalCareIcuScenarioReadiness,
  getCriticalCareIcuScenarioRecommendation,
  recordCriticalCareIcuOutcome,
} from '../integrated'

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
  it('starts with a broad foundation course and changes recommendation with focused completion', () => {
    expect(getCriticalCareIcuScenarioRecommendation(envelope())).toMatchObject({
      scenarioId: 'septic-ards-aki',
      reason: 'foundation',
    })

    const cardiogenic = envelope(['hemodynamics:practice:HD-03', 'mcs:practice:IMP-03'])
    expect(getCriticalCareIcuScenarioRecommendation(cardiogenic)).toMatchObject({
      scenarioId: 'lv-cardiogenic',
      reason: 'assess-ready',
      readiness: {
        completedRequirementCount: 2,
        totalRequirementCount: 2,
        eligibleForAssess: true,
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
      eligibleForAssess: false,
    })
    expect(partial.requirements.find((item) => item.id === 'septic-ventilation')).toMatchObject({
      completed: true,
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
        status: 'mastered',
        mode: 'challenge',
        bestScore: 88,
        attempts: 2,
        competencyEvidenceIds: [
          'multiorgan-prioritization',
          'cross-system-reassessment',
          'integrated-device-management',
          'critical-care-safety',
        ],
        updatedAt: NOW,
      },
    ])
    expect(serialized).not.toMatch(
      /patient|waveform|commands|replay|therapy|deviceState|focusedState/i,
    )
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
