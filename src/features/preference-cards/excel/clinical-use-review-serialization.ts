import {
  CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION,
  type ClinicalUseReviewDecision,
  type ClinicalUseReviewExport,
  type ClinicalUseReviewImportPreview,
} from '@/features/preference-cards/excel/clinical-use-review-contract'

function compareDecisions(
  left: ClinicalUseReviewDecision,
  right: ClinicalUseReviewDecision,
): number {
  return (
    left.recordType.localeCompare(right.recordType) || left.reviewKey.localeCompare(right.reviewKey)
  )
}

export function createClinicalUseReviewNormalizedExport(
  preview: ClinicalUseReviewImportPreview,
  staleArtifactAcknowledged: boolean,
): ClinicalUseReviewExport {
  if (!preview.canExportNormalized) {
    throw new Error('The workbook contains blocking validation errors.')
  }
  if (preview.staleArtifact && !staleArtifactAcknowledged) {
    throw new Error('A stale clinical-use artifact must be explicitly acknowledged before export.')
  }
  return {
    formatVersion: CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION,
    importedAt: preview.importedAt,
    workbookFileName: preview.workbookFileName,
    workbookSha256: preview.workbookSha256,
    clinicalUseManifestSha256: preview.workbookMetadata.clinical_use_manifest_sha256,
    staleArtifactAcknowledged: preview.staleArtifact ? staleArtifactAcknowledged : false,
    decisions: [...preview.decisions].sort(compareDecisions),
  }
}

export function serializeClinicalUseReviewJson(reviewExport: ClinicalUseReviewExport): string {
  return `${JSON.stringify(
    {
      ...reviewExport,
      decisions: [...reviewExport.decisions].sort(compareDecisions),
    },
    null,
    2,
  )}\n`
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

export function serializeClinicalUseReviewCsv(reviewExport: ClinicalUseReviewExport): string {
  const columns = [
    'format_version',
    'imported_at',
    'workbook_file_name',
    'workbook_sha256',
    'clinical_use_manifest_sha256',
    'stale_artifact_acknowledged',
    'record_type',
    'review_key',
    'product_id',
    'role_code',
    'slot_id',
    'procedure_code',
    'decision',
    'suggested_role_code',
    'suggested_slot_id',
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
  const decisions =
    reviewExport.decisions.length > 0 ? [...reviewExport.decisions].sort(compareDecisions) : [null]
  const rows = decisions.map((decision) => ({
    format_version: reviewExport.formatVersion,
    imported_at: reviewExport.importedAt,
    workbook_file_name: reviewExport.workbookFileName,
    workbook_sha256: reviewExport.workbookSha256,
    clinical_use_manifest_sha256: reviewExport.clinicalUseManifestSha256,
    stale_artifact_acknowledged: reviewExport.staleArtifactAcknowledged,
    record_type: decision?.recordType ?? '',
    review_key: decision?.reviewKey ?? '',
    product_id: decision?.productId ?? '',
    role_code: decision?.roleCode ?? '',
    slot_id: decision?.recordType === 'slot_product' ? decision.slotId : '',
    procedure_code: decision?.recordType === 'slot_product' ? decision.procedureCode : '',
    decision: decision?.decision ?? '',
    suggested_role_code:
      decision?.recordType === 'product_role' ? (decision.suggestedRoleCode ?? '') : '',
    suggested_slot_id:
      decision?.recordType === 'slot_product' ? (decision.suggestedSlotId ?? '') : '',
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

export function clinicalUseReviewDecisionFilename(
  format: 'json' | 'csv',
  date = new Date().toISOString().slice(0, 10),
): string {
  return `IP_Clinical_Use_Review_Decisions_${date}.${format}`
}
