import { z } from 'zod'

const stableId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

export const learnerCopyReviewTerms = [
  'reducer',
  'engine',
  'route',
  'query',
  'seed',
  'localstorage',
  'state reuse',
  'hot-swap',
  'deterministic attempt',
  'checkpoint payload',
  'simulator behavior',
  'score',
  'scored',
  'points',
  'grade',
  'graded',
  'percent',
  '%',
  'pass',
  'passed',
  'fail',
  'failed',
  'correct',
  'incorrect',
  'wrong',
  'mastery',
  'mastered',
  'exam',
  'test',
  'quiz',
  'assessment',
  'attempt N of',
  'X out of Y',
  'certification',
  'certified',
  'competent',
  'competency',
] as const

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function learnerCopyPattern(term: (typeof learnerCopyReviewTerms)[number]): RegExp {
  if (term === '%') return /%/
  if (term === 'attempt N of') return /\battempt\s+\d+\s+of\b/i
  if (term === 'X out of Y') return /\b\d+\s+out\s+of\s+\d+\b/i
  const escaped = escapeRegularExpression(term)
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, 'i')
}

export function flaggedLearnerCopyTerms(value: string): readonly string[] {
  return learnerCopyReviewTerms.filter((term) => learnerCopyPattern(term).test(value))
}

const clinicalLearningChoiceSchema = z
  .object({
    id: stableId,
    label: z.string().trim().min(1).max(500),
    rationale: z.string().trim().min(1).max(1_500),
    plausibility: z.enum(['best', 'reasonable-but-incomplete', 'unsafe', 'incorrect-mechanism']),
  })
  .strict()

export const clinicalLearningItemSchema = z
  .object({
    id: stableId,
    activityId: stableId,
    phase: z.enum(['recognize', 'predict', 'observe', 'explain', 'transfer']),
    itemType: z.enum([
      'signal-recognition',
      'mechanism-interpretation',
      'management-decision',
      'response-prediction',
      'reassessment',
      'transfer-case',
    ]),
    contextRequirement: z.enum(['patient', 'technical', 'context-independent']),
    clinicalContextId: stableId.optional(),
    visualAssetIds: z.array(stableId).max(20).optional(),
    transferVariantId: stableId.optional(),
    stem: z.string().trim().min(1).max(2_000),
    choices: z.array(clinicalLearningChoiceSchema).min(2).max(8),
    correctChoiceIds: z.array(stableId).min(1).max(8),
    explanation: z.string().trim().min(1).max(3_000),
    evidenceIds: z.array(stableId).min(1).max(30),
    reviewStatus: z.enum(['draft', 'sme-review', 'approved']),
    reviewerRole: z.string().trim().min(1).max(160).optional(),
    reviewDate: z.string().date().optional(),
    learnerCopyOverrideReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((item, context) => {
    const choiceIds = new Set(item.choices.map((choice) => choice.id))
    for (const correctId of item.correctChoiceIds) {
      if (!choiceIds.has(correctId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['correctChoiceIds'],
          message: `Unknown correct choice: ${correctId}`,
        })
      }
    }
    if (item.contextRequirement === 'patient' && !item.clinicalContextId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clinicalContextId'],
        message: 'Patient items require a clinical context.',
      })
    }
    if (
      item.contextRequirement === 'technical' &&
      !item.clinicalContextId &&
      (item.visualAssetIds?.length ?? 0) === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['visualAssetIds'],
        message: 'Technical items require a technical context or visual asset.',
      })
    }
    if (
      item.phase === 'transfer' &&
      (!item.transferVariantId || item.itemType !== 'transfer-case')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transferVariantId'],
        message: 'Transfer items require an authored variant and transfer-case item type.',
      })
    }
    const bestChoiceIds = new Set(
      item.choices.filter((choice) => choice.plausibility === 'best').map((choice) => choice.id),
    )
    if (!item.correctChoiceIds.every((id) => bestChoiceIds.has(id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'Every correct choice must be classified as best.',
      })
    }
    const flagged = flaggedLearnerCopyTerms(
      [
        item.stem,
        item.explanation,
        ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
      ].join(' '),
    )
    if (flagged.length > 0 && !item.learnerCopyOverrideReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stem'],
        message: `Learner copy contains software-internal terms: ${flagged.join(', ')}`,
      })
    }
  })

export type ClinicalLearningItem = z.infer<typeof clinicalLearningItemSchema>

export function isClinicalLearningItemCreditEligible(item: ClinicalLearningItem): boolean {
  return item.reviewStatus === 'approved'
}
