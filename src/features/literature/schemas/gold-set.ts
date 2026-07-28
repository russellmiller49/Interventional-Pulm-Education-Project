import { z } from 'zod'

import { literatureGoldSetLabels, literatureTaxonomy } from '@/features/literature/config'
import {
  literatureGoldSetConfidenceLabels,
  literatureGoldSetDatasetSplits,
  literatureGoldSetItemActions,
  literatureGoldSetKinds,
  literatureGoldSetMetadataSufficiencyLabels,
  literatureGoldSetRelevanceLabels,
  MAX_LITERATURE_GOLD_NOTES_LENGTH,
  MAX_LITERATURE_GOLD_REVIEW_SECONDS,
} from '@/features/literature/gold-set/constants'

const optionalReviewEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullable()

const uniqueStringArray = (maximum: number) =>
  z
    .array(z.string().trim().min(1).max(160))
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: 'Values must be unique.',
    })

export const literatureGoldReviewPayloadSchema = z
  .object({
    relevanceLabel: optionalReviewEnum(literatureGoldSetRelevanceLabels),
    metadataSufficiency: optionalReviewEnum(literatureGoldSetMetadataSufficiencyLabels),
    reviewerConfidence: optionalReviewEnum(literatureGoldSetConfidenceLabels),
    topicIds: uniqueStringArray(100).default([]),
    technologyTags: uniqueStringArray(100).default([]),
    clinicalPurposes: uniqueStringArray(30).default([]),
    diseaseTags: uniqueStringArray(30).default([]),
    studyDesign: z.string().trim().min(1).max(160).nullable().default(null),
    publicationStatus: z.string().trim().min(1).max(160).nullable().default(null),
    categorizationFromFullText: z.boolean().default(false),
    notes: z.string().trim().max(MAX_LITERATURE_GOLD_NOTES_LENGTH).default(''),
    usedSupplementalMetadata: z.boolean().default(false),
    reviewSeconds: z.number().int().min(0).max(MAX_LITERATURE_GOLD_REVIEW_SECONDS).default(0),
  })
  .superRefine((payload, context) => {
    const knownTechnologyTags = new Set(
      literatureGoldSetLabels.technology_tags.map((option) => option.id),
    )
    const knownBroadTopics = new Set(literatureTaxonomy.topics.map((topic) => topic.id))
    const knownClinicalPurposes = new Set(literatureTaxonomy.facets.clinical_purpose)
    const knownDiseases = new Set(literatureTaxonomy.facets.disease)
    const knownStudyDesigns = new Set(literatureTaxonomy.facets.study_design)
    const knownPublicationStatuses = new Set(literatureTaxonomy.facets.publication_class)

    const checks: Array<[string[], Set<string>, (string | number)[]]> = [
      [payload.topicIds, knownBroadTopics, ['topicIds']],
      [payload.technologyTags, knownTechnologyTags, ['technologyTags']],
      [payload.clinicalPurposes, knownClinicalPurposes, ['clinicalPurposes']],
      [payload.diseaseTags, knownDiseases, ['diseaseTags']],
    ]
    checks.forEach(([values, known, path]) => {
      values.forEach((value, index) => {
        if (!known.has(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown controlled label: ${value}`,
            path: [...path, index],
          })
        }
      })
    })

    if (payload.studyDesign && !knownStudyDesigns.has(payload.studyDesign)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown study design: ${payload.studyDesign}`,
        path: ['studyDesign'],
      })
    }
    if (payload.publicationStatus && !knownPublicationStatuses.has(payload.publicationStatus)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown publication status: ${payload.publicationStatus}`,
        path: ['publicationStatus'],
      })
    }
  })

export const literatureGoldCompleteReviewSchema = literatureGoldReviewPayloadSchema.superRefine(
  (payload, context) => {
    if (!payload.relevanceLabel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A relevance decision is required.',
        path: ['relevanceLabel'],
      })
    }
    if (!payload.metadataSufficiency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Metadata sufficiency is required.',
        path: ['metadataSufficiency'],
      })
    }
    if (!payload.reviewerConfidence) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reviewer confidence is required.',
        path: ['reviewerConfidence'],
      })
    }

    const included =
      payload.relevanceLabel === 'include_core' || payload.relevanceLabel === 'include_adjacent'
    if (included) {
      if (payload.topicIds.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one broad topic is required for included articles.',
          path: ['topicIds'],
        })
      }
      if (payload.clinicalPurposes.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one clinical purpose is required for included articles.',
          path: ['clinicalPurposes'],
        })
      }
      if (!payload.studyDesign) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Study design is required for included articles.',
          path: ['studyDesign'],
        })
      }
      if (!payload.publicationStatus) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Publication status is required for included articles.',
          path: ['publicationStatus'],
        })
      }
    } else if (
      payload.topicIds.length > 0 ||
      payload.technologyTags.length > 0 ||
      payload.clinicalPurposes.length > 0 ||
      payload.diseaseTags.length > 0 ||
      payload.studyDesign ||
      payload.publicationStatus ||
      payload.categorizationFromFullText
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Topic and categorization labels are collected only for included articles.',
        path: ['topicIds'],
      })
    }
  },
)

export const literatureGoldReviewRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save_draft'),
    review: literatureGoldReviewPayloadSchema,
  }),
  z.object({
    action: z.literal('complete_review'),
    review: literatureGoldCompleteReviewSchema,
  }),
  z.object({
    action: z.enum(literatureGoldSetItemActions),
  }),
])

export const literatureGoldBatchQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  status: z.enum(['all', 'unresolved', 'return_later', 'completed']).default('unresolved'),
  split: z.enum([...literatureGoldSetDatasetSplits, 'all']).default('development'),
})

export const literatureGoldExportQuerySchema = z.object({
  batchId: z.string().uuid(),
  format: z.enum(['json', 'csv']).default('json'),
  split: z.enum([...literatureGoldSetDatasetSplits, 'all']).default('development'),
  includeHistory: z.boolean().default(false),
})

export const literatureGoldCreateOptionsSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{2,79}$/u),
  kind: z.enum(literatureGoldSetKinds),
  size: z.number().int().min(1).max(5_000),
  seed: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  testPercent: z.number().int().min(0).max(50),
})
