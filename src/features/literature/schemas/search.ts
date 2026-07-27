import { z } from 'zod'

import {
  DEFAULT_LITERATURE_PAGE_SIZE,
  literatureRelevanceStates,
  literatureSortValues,
  literatureSourceKinds,
  literatureVisibilityStates,
  MAX_LITERATURE_PAGE_SIZE,
  MAX_LITERATURE_QUERY_LENGTH,
  MAX_LITERATURE_REASON_LENGTH,
} from '@/features/literature/constants'

export const pmidSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/, 'Expected a numeric PMID.')

const optionalYearSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().min(1800).max(3000).optional(),
)

const positiveIntegerSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
)

export const literatureSearchSchema = z
  .object({
    q: z.string().trim().max(MAX_LITERATURE_QUERY_LENGTH).default(''),
    topicIds: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
    journalIds: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    yearFrom: optionalYearSchema,
    yearTo: optionalYearSchema,
    publicationTypes: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
    landmarkOnly: z.boolean().default(false),
    sort: z.enum(literatureSortValues).default('relevance'),
    page: positiveIntegerSchema.default(1),
    pageSize: positiveIntegerSchema
      .pipe(z.number().int().min(1).max(MAX_LITERATURE_PAGE_SIZE))
      .default(DEFAULT_LITERATURE_PAGE_SIZE),
    adminPreview: z.boolean().default(false),
  })
  .superRefine((query, context) => {
    if (query.yearFrom && query.yearTo && query.yearFrom > query.yearTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`yearFrom` must not be later than `yearTo`.',
        path: ['yearTo'],
      })
    }
  })

function parseBoolean(value: string | null) {
  return value === '1' || value === 'true'
}

function parseList(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

export function literatureSearchInputFromUrl(searchParams: URLSearchParams) {
  return {
    q: searchParams.get('q') ?? '',
    topicIds: parseList(searchParams, 'topic'),
    journalIds: parseList(searchParams, 'journal'),
    yearFrom: searchParams.get('yearFrom') ?? undefined,
    yearTo: searchParams.get('yearTo') ?? undefined,
    publicationTypes: parseList(searchParams, 'publicationType'),
    landmarkOnly: parseBoolean(searchParams.get('landmark')),
    sort: searchParams.get('sort') ?? 'relevance',
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    adminPreview: parseBoolean(searchParams.get('adminPreview')),
  }
}

const topicDecisionSchema = z.object({
  topicId: z.string().trim().min(1).max(160),
  state: z.enum(['confirmed', 'rejected']),
})

const topicDecisionsSchema = z
  .array(topicDecisionSchema)
  .max(100)
  .superRefine((decisions, context) => {
    const topicIds = new Set<string>()
    decisions.forEach((decision, index) => {
      if (topicIds.has(decision.topicId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Topic decisions must use unique topic IDs.',
          path: [index, 'topicId'],
        })
      }
      topicIds.add(decision.topicId)
    })
  })

export const literatureAdminArticleUpdateSchema = z
  .object({
    relevanceState: z.enum(literatureRelevanceStates).optional(),
    visibilityState: z.enum(literatureVisibilityStates).optional(),
    isLandmark: z.boolean().optional(),
    topicDecisions: topicDecisionsSchema.optional(),
    reason: z.string().trim().max(MAX_LITERATURE_REASON_LENGTH).optional(),
  })
  .superRefine((payload, context) => {
    if (
      payload.relevanceState === undefined &&
      payload.visibilityState === undefined &&
      payload.isLandmark === undefined &&
      payload.topicDecisions === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one curation change is required.',
      })
    }

    if (payload.relevanceState === 'excluded' && !payload.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An exclusion reason is required.',
        path: ['reason'],
      })
    }
  })

export const literatureBulkReviewSchema = z.object({
  pmids: z
    .array(pmidSchema)
    .min(1)
    .max(100)
    .refine((pmids) => new Set(pmids).size === pmids.length, {
      message: 'Bulk-review PMIDs must be unique.',
    }),
  update: literatureAdminArticleUpdateSchema,
})

export const literatureReviewQueueSchema = z.object({
  q: z.string().trim().max(MAX_LITERATURE_QUERY_LENGTH).default(''),
  sourceKind: z.enum(literatureSourceKinds).optional(),
  journalId: z.string().trim().min(1).max(120).optional(),
  year: optionalYearSchema,
  abstractAvailability: z.enum(['all', 'with', 'without']).default('all'),
  topicId: z.string().trim().min(1).max(160).optional(),
  relevanceState: z.enum(literatureRelevanceStates).optional(),
  visibilityState: z.enum(literatureVisibilityStates).optional(),
  page: positiveIntegerSchema.default(1),
  pageSize: positiveIntegerSchema
    .pipe(z.number().int().min(1).max(MAX_LITERATURE_PAGE_SIZE))
    .default(DEFAULT_LITERATURE_PAGE_SIZE),
})

export function literatureReviewQueueInputFromUrl(searchParams: URLSearchParams) {
  return {
    q: searchParams.get('q') ?? '',
    sourceKind: searchParams.get('sourceKind') || undefined,
    journalId: searchParams.get('journal') || undefined,
    year: searchParams.get('year') || undefined,
    abstractAvailability: searchParams.get('abstract') || 'all',
    topicId: searchParams.get('topic') || undefined,
    relevanceState: searchParams.get('relevance') || undefined,
    visibilityState: searchParams.get('visibility') || undefined,
    page: searchParams.get('page') || undefined,
    pageSize: searchParams.get('pageSize') || undefined,
  }
}

export type LiteratureSearchQuery = z.infer<typeof literatureSearchSchema>
export type LiteratureAdminArticleUpdate = z.infer<typeof literatureAdminArticleUpdateSchema>
export type LiteratureReviewQueueQuery = z.infer<typeof literatureReviewQueueSchema>
