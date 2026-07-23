import {
  clinicalContextSnapshotSchema,
  clinicalLearningItemSchema,
  isClinicalLearningItemCreditEligible,
} from '..'

const reviewedItem = {
  id: 'ventilation.transfer.ards-to-obstructive',
  activityId: 'ventilation:learn:mechanics',
  phase: 'transfer' as const,
  itemType: 'transfer-case' as const,
  contextRequirement: 'patient' as const,
  clinicalContextId: 'ventilation.context.obstructive-1',
  transferVariantId: 'ventilation.variant.obstructive-1',
  stem: 'After the change in expiratory flow, which interpretation best explains the response?',
  choices: [
    {
      id: 'dynamic-hyperinflation',
      label: 'Incomplete exhalation is increasing end-expiratory volume.',
      rationale: 'Persistent expiratory flow at the next breath supports incomplete exhalation.',
      plausibility: 'best' as const,
    },
    {
      id: 'isolated-oxygenation',
      label: 'The pattern is explained by oxygen concentration alone.',
      rationale: 'Oxygen concentration does not account for the expiratory flow pattern.',
      plausibility: 'incorrect-mechanism' as const,
    },
  ],
  correctChoiceIds: ['dynamic-hyperinflation'],
  explanation: 'The flow-time tracing does not return to baseline before the next breath.',
  evidenceIds: ['ventilation-casebook'],
  reviewStatus: 'approved' as const,
  reviewerRole: 'critical-care-physician',
  reviewDate: '2026-07-22',
}

describe('clinical content contracts', () => {
  it('requires an explicit patient presentation for patient context', () => {
    const base = {
      id: 'ventilation.context.obstructive-1',
      contextType: 'patient' as const,
      currentData: [{ id: 'flow', label: 'Expiratory flow', value: 'Does not reach baseline' }],
      activeProblem: 'Possible dynamic hyperinflation',
      immediateGoal: 'Identify the safest next assessment.',
      safetyConstraints: ['Use synthetic educational values only.'],
    }

    expect(clinicalContextSnapshotSchema.safeParse(base).success).toBe(false)
    expect(
      clinicalContextSnapshotSchema.safeParse({
        ...base,
        patient: {
          setting: 'Medical ICU',
          presentation: 'Intubated adult with obstructive physiology and rising airway pressure.',
        },
      }).success,
    ).toBe(true)
  })

  it('requires authored transfer variants, defensible distractors, and source evidence', () => {
    expect(clinicalLearningItemSchema.safeParse(reviewedItem).success).toBe(true)
    expect(
      clinicalLearningItemSchema.safeParse({ ...reviewedItem, transferVariantId: undefined })
        .success,
    ).toBe(false)
    expect(
      clinicalLearningItemSchema.safeParse({
        ...reviewedItem,
        choices: reviewedItem.choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          plausibility: choice.plausibility,
        })),
      }).success,
    ).toBe(false)
    expect(clinicalLearningItemSchema.safeParse({ ...reviewedItem, evidenceIds: [] }).success).toBe(
      false,
    )
  })

  it('blocks software-internal learner copy unless an editorial override is documented', () => {
    const internalCopy = {
      ...reviewedItem,
      stem: 'Which reducer state should this deterministic attempt restore?',
    }

    expect(clinicalLearningItemSchema.safeParse(internalCopy).success).toBe(false)
    expect(
      clinicalLearningItemSchema.safeParse({
        ...internalCopy,
        learnerCopyOverrideReason: 'The term is quoted in an approved software-training item.',
      }).success,
    ).toBe(true)
  })

  it('treats only clinically approved items as credit eligible', () => {
    const approved = clinicalLearningItemSchema.parse(reviewedItem)
    const draft = clinicalLearningItemSchema.parse({ ...reviewedItem, reviewStatus: 'draft' })

    expect(isClinicalLearningItemCreditEligible(approved)).toBe(true)
    expect(isClinicalLearningItemCreditEligible(draft)).toBe(false)
  })
})
