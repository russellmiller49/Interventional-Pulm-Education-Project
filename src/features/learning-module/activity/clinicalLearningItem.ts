import { z } from 'zod'

const stableId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

/** Vocabulary that describes the software rather than the medicine. */
const softwareInternalTerms = [
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
] as const

/**
 * Vocabulary that turns formative practice into an examination.
 *
 * This is the half of the review list that protects a publication position rather than a teaching
 * preference: none of this content is credit-eligible, and copy that talks about a score, a
 * percentage, a pass or a mastery claim asserts something the module is not in a position to assert.
 * It stays banned in authored items and in the verdict cards alike.
 */
const gradingTerms = [
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

/**
 * Correctness labels — banned in authored item text, permitted in a verdict.
 *
 * These are separated from `gradingTerms` because they are governed by a different decision. In an
 * authored stem, choice label or rationale a correctness word is answer leakage: a choice that says
 * "the correct answer is..." hands over the key. That ban stands.
 *
 * In the verdict a learner reads *after* committing, the same words are the point. An owner review
 * of the ECMO module in September 2026 found the cards describing the reasoning ("That read holds")
 * without ever stating the outcome, and asked for the outcome to be explicit — which is also what
 * the retrieval-practice literature asks for, since feedback a learner cannot decode does not
 * correct anything. `AnswerVerdict` and `ChoiceReasoningFeedback` therefore lead with "Correct." or
 * "Not correct." and are checked against `gradingTerms` alone, not against this list.
 */
const correctnessTerms = ['correct', 'incorrect', 'wrong'] as const

/**
 * Everything an authored item may not say. Composed in its original order, so the message a schema
 * failure prints is unchanged.
 */
export const learnerCopyReviewTerms = [
  ...softwareInternalTerms,
  ...gradingTerms.slice(0, gradingTerms.indexOf('failed') + 1),
  ...correctnessTerms,
  ...gradingTerms.slice(gradingTerms.indexOf('failed') + 1),
] as const

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function learnerCopyPattern(term: string): RegExp {
  if (term === '%') return /%/
  if (term === 'attempt N of') return /\battempt\s+\d+\s+of\b/i
  if (term === 'X out of Y') return /\b\d+\s+out\s+of\s+\d+\b/i
  const escaped = escapeRegularExpression(term)
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, 'i')
}

export function flaggedLearnerCopyTerms(value: string): readonly string[] {
  return learnerCopyReviewTerms.filter((term) => learnerCopyPattern(term).test(value))
}

/**
 * The subset a verdict card must still avoid: examination and scoring vocabulary, but not the
 * correctness label the card exists to state. See `correctnessTerms` for why the two are separate.
 */
export function flaggedGradingCopyTerms(value: string): readonly string[] {
  return gradingTerms.filter((term) => learnerCopyPattern(term).test(value))
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
