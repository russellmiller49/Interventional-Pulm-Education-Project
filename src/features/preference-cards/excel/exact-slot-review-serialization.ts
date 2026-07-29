import {
  EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION,
  type ExactSlotReviewExport,
  type ExactSlotReviewImportPreview,
} from '@/features/preference-cards/excel/exact-slot-review-contract'

export function createExactSlotReviewNormalizedExport(
  preview: ExactSlotReviewImportPreview,
  staleArtifactAcknowledged: boolean,
): ExactSlotReviewExport {
  if (!preview.canExportNormalized) {
    throw new Error('The workbook contains blocking validation errors.')
  }
  if (preview.staleArtifact && !staleArtifactAcknowledged) {
    throw new Error('A stale proposal artifact must be explicitly acknowledged before export.')
  }
  return {
    formatVersion: EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION,
    importedAt: preview.importedAt,
    workbookFileName: preview.workbookFileName,
    workbookSha256: preview.workbookSha256,
    proposalArtifactSha256: preview.workbookMetadata.proposal_artifact_sha256,
    staleArtifactAcknowledged: preview.staleArtifact ? staleArtifactAcknowledged : false,
    decisions: [...preview.decisions].sort((left, right) =>
      left.proposalKey.localeCompare(right.proposalKey),
    ),
  }
}

export function serializeExactSlotReviewJson(reviewExport: ExactSlotReviewExport): string {
  return `${JSON.stringify(reviewExport, null, 2)}\n`
}

function formulaSafeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function escapeCsvValue(value: unknown): string {
  const text = formulaSafeCsvValue(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function serializeExactSlotReviewCsv(reviewExport: ExactSlotReviewExport): string {
  const columns = [
    'format_version',
    'imported_at',
    'workbook_file_name',
    'workbook_sha256',
    'proposal_artifact_sha256',
    'stale_artifact_acknowledged',
    'proposal_key',
    'slot_id',
    'procedure_code',
    'product_id',
    'role_code',
    'decision',
    'rationale',
    'evidence_needed',
    'reviewer_name',
    'reviewer_confidence',
    'review_date',
    'follow_up_notes',
    'ready_for_second_review',
    'second_reviewer',
    'second_review_comments',
  ] as const
  const decisions = reviewExport.decisions.length > 0 ? reviewExport.decisions : [null]
  const rows = decisions.map((decision) => ({
    format_version: reviewExport.formatVersion,
    imported_at: reviewExport.importedAt,
    workbook_file_name: reviewExport.workbookFileName,
    workbook_sha256: reviewExport.workbookSha256,
    proposal_artifact_sha256: reviewExport.proposalArtifactSha256,
    stale_artifact_acknowledged: reviewExport.staleArtifactAcknowledged,
    proposal_key: decision?.proposalKey ?? '',
    slot_id: decision?.slotId ?? '',
    procedure_code: decision?.procedureCode ?? '',
    product_id: decision?.productId ?? '',
    role_code: decision?.roleCode ?? '',
    decision: decision?.decision ?? '',
    rationale: decision?.rationale ?? '',
    evidence_needed: decision?.evidenceNeeded ?? '',
    reviewer_name: decision?.reviewerName ?? '',
    reviewer_confidence: decision?.reviewerConfidence ?? '',
    review_date: decision?.reviewDate ?? '',
    follow_up_notes: decision?.followUpNotes ?? '',
    ready_for_second_review: decision?.readyForSecondReview ?? '',
    second_reviewer: decision?.secondReviewer ?? '',
    second_review_comments: decision?.secondReviewComments ?? '',
  }))
  return (
    [
      columns.join(','),
      ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(',')),
    ].join('\r\n') + '\r\n'
  )
}

export function exactSlotReviewDecisionFilename(
  format: 'json' | 'csv',
  date = new Date().toISOString().slice(0, 10),
): string {
  return `IP_Exact_Slot_Review_Decisions_${date}.${format}`
}
