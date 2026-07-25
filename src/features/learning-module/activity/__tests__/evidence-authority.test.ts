import {
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  enforceCriticalCareProgressAuthority,
} from '../evidence'
import type { CriticalCareActivityDefinition } from '../types'

function activity(
  overrides: Partial<CriticalCareActivityDefinition> = {},
): CriticalCareActivityDefinition {
  return {
    id: 'ventilation:learn:mechanics',
    moduleId: 'mechanical-ventilation',
    title: 'Respiratory mechanics',
    description: 'Bounded evidence-authority test activity.',
    kind: 'interactive-lab',
    supportedModes: ['guided'],
    pathname: '/mechanical-ventilation/learn',
    query: { activity: 'mechanics' },
    pathwayIds: ['respiratory-failure'],
    competencyIds: ['ventilation-mechanics'],
    prerequisiteActivityIds: [],
    teachesConceptIds: ['respiratory-system-compliance'],
    assumedConceptIds: [],
    estimatedMinutes: 12,
    difficulty: 'foundation',
    completionRuleId: 'validated-transfer',
    assetIds: [],
    reviewStatus: 'draft',
    evidenceIds: ['ventilation-casebook'],
    contentVersion: '2026.07-recovery',
    creditPolicy: 'non-credit',
    completionEvidenceAuthority: 'none',
    ...overrides,
  }
}

describe('critical-care evidence authority', () => {
  it('downgrades completion claims when no validated interaction can support them', () => {
    const definition = activity()

    expect(authoritativeCriticalCareStatus(definition, 'completed')).toBe('in-progress')
    expect(
      enforceCriticalCareProgressAuthority(definition, {
        activityId: definition.id,
        status: 'mastered',
        mode: 'guided',
        attempts: 1,
        competencyEvidenceIds: ['ventilation-mechanics'],
        updatedAt: '2026-07-22T12:00:00.000Z',
      }),
    ).toMatchObject({
      status: 'in-progress',
      competencyEvidenceIds: [],
    })
  })

  it('never grants competency evidence to draft or completion-only activities', () => {
    const draft = activity({
      creditPolicy: 'completion-only',
      completionEvidenceAuthority: 'validated-interaction',
    })
    const completionOnly = activity({
      reviewStatus: 'sme-review',
      creditPolicy: 'completion-only',
      completionEvidenceAuthority: 'validated-interaction',
    })

    expect(authoritativeCriticalCareCompetencyEvidence(draft, draft.competencyIds)).toEqual([])
    expect(
      authoritativeCriticalCareCompetencyEvidence(completionOnly, completionOnly.competencyIds),
    ).toEqual([])
  })

  it('limits reviewed, competency-eligible evidence to the activity contract', () => {
    const reviewed = activity({
      reviewStatus: 'sme-review',
      creditPolicy: 'competency-eligible',
      completionEvidenceAuthority: 'reviewed-engine-score',
    })

    expect(
      authoritativeCriticalCareCompetencyEvidence(reviewed, [
        'ventilation-mechanics',
        'ventilation-mechanics',
        'unrelated-competency',
      ]),
    ).toEqual(['ventilation-mechanics'])
  })
})
