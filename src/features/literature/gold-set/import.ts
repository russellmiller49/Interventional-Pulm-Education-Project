import { z } from 'zod'

import {
  literatureGoldCompleteReviewSchema,
  literatureGoldReviewPayloadSchema,
} from '@/features/literature/schemas/gold-set'

import type { LiteratureGoldReviewPayload } from './types'
import {
  parseLiteratureGoldSetCsv,
  type LiteratureGoldCsvRow,
  type LiteratureGoldExportReview,
} from './export'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const PMID_PATTERN = /^[0-9]{1,12}$/u
const BATCH_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/u
const completedAtSchema = z.string().datetime({ offset: true })

export interface LiteratureGoldReviewImportDecision {
  batchId: string | null
  itemId: string
  pmid: string
  reviewSource: 'completed' | 'draft'
  sourceReviewId: string | null
  review: LiteratureGoldReviewPayload
}

export interface LiteratureGoldReviewImportOptions {
  completedOnly?: boolean
  expectedBatchReference?: string
  expectedRowCount?: number
}

export interface LiteratureGoldReviewImport {
  batchId: string
  batchName: string
  rows: LiteratureGoldCsvRow[]
  decisions: LiteratureGoldReviewImportDecision[]
  summary: {
    completed: number
    drafts: number
    empty: number
    totalRows: number
  }
}

function rowError(row: LiteratureGoldCsvRow, index: number, message: string): never {
  throw new Error(`CSV record ${index + 2} (PMID ${row.pmid || 'blank'}): ${message}`)
}

function reviewPayload(review: LiteratureGoldExportReview) {
  return {
    relevanceLabel: review.relevanceLabel,
    metadataSufficiency: review.metadataSufficiency,
    reviewerConfidence: review.reviewerConfidence,
    topicIds: review.topicIds,
    technologyTags: review.technologyTags,
    clinicalPurposes: review.clinicalPurposes,
    diseaseTags: review.diseaseTags,
    studyDesign: review.studyDesign,
    publicationStatus: review.publicationStatus,
    categorizationFromFullText: review.categorizationFromFullText,
    notes: review.notes,
    usedSupplementalMetadata: review.usedSupplementalMetadata,
    reviewSeconds: review.reviewSeconds,
  }
}

function parseReview(
  row: LiteratureGoldCsvRow,
  index: number,
  completed: boolean,
): LiteratureGoldReviewPayload {
  const result = (
    completed ? literatureGoldCompleteReviewSchema : literatureGoldReviewPayloadSchema
  ).safeParse(reviewPayload(row.review))
  if (result.success) return result.data

  const issue = result.error.issues[0]
  const path = issue?.path.length ? `review.${issue.path.join('.')}: ` : 'review: '
  return rowError(row, index, `${path}${issue?.message ?? 'is invalid.'}`)
}

function assertEmptyReview(row: LiteratureGoldCsvRow, index: number) {
  const review = row.review
  const containsReviewData =
    review.id !== null ||
    review.revision !== null ||
    review.relevanceLabel !== null ||
    review.metadataSufficiency !== null ||
    review.reviewerConfidence !== null ||
    review.topicIds.length > 0 ||
    review.technologyTags.length > 0 ||
    review.technologyTagStatus !== null ||
    review.clinicalPurposes.length > 0 ||
    review.diseaseTags.length > 0 ||
    review.diseaseTagStatus !== null ||
    review.studyDesign !== null ||
    review.publicationStatus !== null ||
    review.categorizationFromFullText ||
    review.notes !== '' ||
    review.usedSupplementalMetadata ||
    review.reviewSeconds !== 0 ||
    review.isBlinded !== null ||
    review.reviewerEmail !== null ||
    review.completedAt !== null ||
    review.taxonomyVersion !== null ||
    review.labelSchemaVersion !== null ||
    review.enrichmentSchemaVersion !== null ||
    review.enrichmentProvenance !== null
  if (containsReviewData) {
    rowError(row, index, 'review_source=empty cannot contain review or review-provenance data.')
  }
}

function assertUnique(
  seen: Map<string, number>,
  value: string,
  label: string,
  row: LiteratureGoldCsvRow,
  index: number,
) {
  const firstIndex = seen.get(value)
  if (firstIndex !== undefined) {
    rowError(row, index, `${label} duplicates CSV record ${firstIndex + 2}.`)
  }
  seen.set(value, index)
}

export function parseLiteratureGoldReviewImportCsv(
  input: string,
  options: LiteratureGoldReviewImportOptions = {},
): LiteratureGoldReviewImport {
  const rows = parseLiteratureGoldSetCsv(input)
  if (rows.length === 0) {
    throw new Error('The CSV import contains no gold-set rows.')
  }
  if (options.expectedRowCount !== undefined && rows.length !== options.expectedRowCount) {
    throw new Error(
      `The CSV import contains ${rows.length} rows; expected ${options.expectedRowCount}.`,
    )
  }

  const first = rows[0]
  if (!UUID_PATTERN.test(first.batchId)) {
    rowError(first, 0, 'batch_id must be a valid UUID.')
  }
  if (!BATCH_NAME_PATTERN.test(first.batchName)) {
    rowError(first, 0, 'batch_name is missing or invalid.')
  }
  if (
    options.expectedBatchReference &&
    options.expectedBatchReference !== first.batchId &&
    options.expectedBatchReference !== first.batchName
  ) {
    throw new Error(
      `CSV batch ${first.batchName} (${first.batchId}) does not match --batch ${options.expectedBatchReference}.`,
    )
  }

  const itemIds = new Map<string, number>()
  const pmids = new Map<string, number>()
  const displayOrders = new Map<string, number>()
  const reviewIds = new Map<string, number>()
  const decisions: LiteratureGoldReviewImportDecision[] = []
  let completed = 0
  let drafts = 0
  let empty = 0

  rows.forEach((row, index) => {
    if (row.batchId !== first.batchId || row.batchName !== first.batchName) {
      rowError(
        row,
        index,
        `batch identity must match ${first.batchName} (${first.batchId}) on every row.`,
      )
    }
    if (!UUID_PATTERN.test(row.itemId)) {
      rowError(row, index, 'item_id must be a valid UUID.')
    }
    if (!PMID_PATTERN.test(row.pmid)) {
      rowError(row, index, 'pmid must contain 1 to 12 decimal digits.')
    }
    assertUnique(itemIds, row.itemId, 'item_id', row, index)
    assertUnique(pmids, row.pmid, 'pmid', row, index)
    assertUnique(displayOrders, String(row.displayOrder), 'display_order', row, index)

    if (row.reviewSource === 'completed') {
      completed += 1
      if (row.reviewStatus !== 'completed') {
        rowError(row, index, 'review_source=completed requires review_status=completed.')
      }
      if (!row.sampleStratum || !row.samplingReason) {
        rowError(
          row,
          index,
          'completed rows require the post-decision sample_stratum and sampling_reason.',
        )
      }
      const sourceReviewId = row.review.id
      if (!sourceReviewId || !UUID_PATTERN.test(sourceReviewId)) {
        rowError(row, index, 'completed rows require a valid review_id UUID.')
      }
      if (row.review.revision === null) {
        rowError(row, index, 'completed rows require a positive revision.')
      }
      if (row.review.isBlinded === null) {
        rowError(row, index, 'completed rows require is_blinded=true or false.')
      }
      if (!row.review.completedAt || !completedAtSchema.safeParse(row.review.completedAt).success) {
        rowError(row, index, 'completed rows require a valid completed_at timestamp.')
      }
      assertUnique(reviewIds, sourceReviewId, 'review_id', row, index)
      decisions.push({
        batchId: row.batchId,
        itemId: row.itemId,
        pmid: row.pmid,
        reviewSource: 'completed',
        sourceReviewId,
        review: parseReview(row, index, true),
      })
      return
    }

    if (row.sampleStratum !== null || row.samplingReason !== null) {
      rowError(
        row,
        index,
        'draft and empty rows must not expose sample_stratum or sampling_reason.',
      )
    }
    if (options.completedOnly) {
      rowError(row, index, 'this import requires every row to be completed.')
    }

    if (row.reviewSource === 'draft') {
      drafts += 1
      if (row.reviewStatus !== 'in_progress' && row.reviewStatus !== 'return_later') {
        rowError(
          row,
          index,
          'review_source=draft requires review_status=in_progress or return_later.',
        )
      }
      if (
        row.review.id !== null ||
        row.review.revision !== null ||
        row.review.isBlinded !== null ||
        row.review.completedAt !== null
      ) {
        rowError(row, index, 'draft rows cannot contain completed-review provenance.')
      }
      decisions.push({
        batchId: row.batchId,
        itemId: row.itemId,
        pmid: row.pmid,
        reviewSource: 'draft',
        sourceReviewId: null,
        review: parseReview(row, index, false),
      })
      return
    }

    empty += 1
    if (row.reviewStatus === 'completed') {
      rowError(row, index, 'review_source=empty cannot use review_status=completed.')
    }
    assertEmptyReview(row, index)
  })

  if (decisions.length === 0) {
    throw new Error('The import contains no draft or completed review decisions.')
  }

  return {
    batchId: first.batchId,
    batchName: first.batchName,
    rows,
    decisions,
    summary: {
      completed,
      drafts,
      empty,
      totalRows: rows.length,
    },
  }
}
