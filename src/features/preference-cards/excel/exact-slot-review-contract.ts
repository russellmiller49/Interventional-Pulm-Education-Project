export const EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION = '1' as const
export const EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION = 1 as const

export const EXACT_SLOT_REVIEW_SHEETS = [
  'Instructions',
  'Exact Slot Review',
  'Review Summary',
  'Decision Definitions',
  'Lookups',
] as const

export type ExactSlotReviewSheetName = (typeof EXACT_SLOT_REVIEW_SHEETS)[number]

export const EXACT_SLOT_REVIEW_DECISIONS = [
  {
    value: 'candidate_for_canonical_option',
    label: 'Candidate for canonical option',
    definition:
      'The product appears clinically appropriate for this exact slot based on available evidence. This is a recommendation for later governed application and does not modify canonical options.',
  },
  {
    value: 'reject_exact_slot',
    label: 'Reject for this exact slot',
    definition:
      'The broad product role may remain valid, but this product should not be offered for this particular slot.',
  },
  {
    value: 'needs_more_evidence',
    label: 'Needs more evidence',
    definition:
      'Additional IFU, dimensional, platform, kit, package, or configuration evidence is required.',
  },
  {
    value: 'product_role_mapping_issue',
    label: 'Product-role mapping issue',
    definition:
      'The broader product-to-role classification may be incorrect and needs separate review.',
  },
  {
    value: 'hospital_local_or_custom_only',
    label: 'Hospital-local or custom only',
    definition:
      'The requirement is better represented as a local resource, supply, protocol, service, or formulary item.',
  },
  {
    value: 'unable_to_determine',
    label: 'Unable to determine',
    definition: 'The reviewer cannot reach a more specific conclusion from the available evidence.',
  },
] as const

export type ExactSlotReviewDecisionValue = (typeof EXACT_SLOT_REVIEW_DECISIONS)[number]['value']
export type ExactSlotReviewDecisionLabel = (typeof EXACT_SLOT_REVIEW_DECISIONS)[number]['label']

export const EXACT_SLOT_REVIEW_CONFIDENCES = [
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
] as const

export type ExactSlotReviewConfidence = (typeof EXACT_SLOT_REVIEW_CONFIDENCES)[number]['value']

export const EXACT_SLOT_REVIEW_YES_NO = ['Yes', 'No'] as const

export interface ExactSlotReviewColumn {
  key: keyof ExactSlotReviewWorkbookRow
  header: string
  editable: boolean
  identifier?: boolean
  width: number
}

export const EXACT_SLOT_REVIEW_COLUMNS = [
  { key: 'proposalKey', header: 'Proposal Key', editable: false, identifier: true, width: 34 },
  {
    key: 'procedureCode',
    header: 'Procedure Code',
    editable: false,
    identifier: true,
    width: 20,
  },
  { key: 'procedure', header: 'Procedure', editable: false, width: 30 },
  { key: 'slotId', header: 'Slot ID', editable: false, identifier: true, width: 22 },
  { key: 'slotLabel', header: 'Slot Label', editable: false, width: 36 },
  { key: 'requiredness', header: 'Requiredness', editable: false, width: 16 },
  { key: 'roleCode', header: 'Role Code', editable: false, identifier: true, width: 28 },
  { key: 'productId', header: 'Product ID', editable: false, identifier: true, width: 22 },
  { key: 'manufacturer', header: 'Manufacturer', editable: false, width: 28 },
  { key: 'productName', header: 'Product Name', editable: false, width: 42 },
  {
    key: 'catalogNumber',
    header: 'Catalog Number',
    editable: false,
    identifier: true,
    width: 22,
  },
  {
    key: 'deviceIdentifier',
    header: 'GTIN / DI',
    editable: false,
    identifier: true,
    width: 24,
  },
  { key: 'roleFit', header: 'Role Fit', editable: false, width: 18 },
  { key: 'verificationGrade', header: 'Verification Grade', editable: false, width: 22 },
  { key: 'verificationStatus', header: 'Verification Status', editable: false, width: 28 },
  { key: 'distributionStatus', header: 'Distribution Status', editable: false, width: 24 },
  { key: 'visibilityState', header: 'Visibility State', editable: false, width: 22 },
  { key: 'evidenceSignal', header: 'Evidence Signal', editable: false, width: 30 },
  { key: 'proposalReason', header: 'Proposal Reason', editable: false, width: 54 },
  { key: 'sourceId', header: 'Source ID', editable: false, identifier: true, width: 18 },
  { key: 'sourceLocation', header: 'Source Location', editable: false, width: 42 },
  { key: 'evidencePageUrl', header: 'Evidence Page URL', editable: false, width: 50 },
  {
    key: 'proposalArtifactHash',
    header: 'Proposal Artifact Hash',
    editable: false,
    identifier: true,
    width: 68,
  },
  { key: 'decision', header: 'Decision', editable: true, width: 34 },
  { key: 'rationale', header: 'Rationale', editable: true, width: 52 },
  { key: 'evidenceNeeded', header: 'Evidence Needed', editable: true, width: 42 },
  { key: 'reviewerName', header: 'Reviewer Name', editable: true, width: 24 },
  {
    key: 'reviewerConfidence',
    header: 'Reviewer Confidence',
    editable: true,
    width: 22,
  },
  { key: 'reviewDate', header: 'Review Date', editable: true, width: 18 },
  { key: 'followUpNotes', header: 'Follow-up Notes', editable: true, width: 42 },
  {
    key: 'readyForSecondReview',
    header: 'Ready for Second Review',
    editable: true,
    width: 26,
  },
  { key: 'secondReviewer', header: 'Second Reviewer', editable: true, width: 24 },
  {
    key: 'secondReviewComments',
    header: 'Second-review Comments',
    editable: true,
    width: 44,
  },
] as const satisfies readonly ExactSlotReviewColumn[]

export const EXACT_SLOT_REVIEW_REFERENCE_COLUMNS = EXACT_SLOT_REVIEW_COLUMNS.filter(
  (column) => !column.editable,
)
export const EXACT_SLOT_REVIEW_EDITABLE_COLUMNS = EXACT_SLOT_REVIEW_COLUMNS.filter(
  (column) => column.editable,
)
export const EXACT_SLOT_REVIEW_IDENTIFIER_HEADERS = new Set(
  EXACT_SLOT_REVIEW_COLUMNS.filter((column) => 'identifier' in column && column.identifier).map(
    (column) => column.header,
  ),
)

export interface ExactSlotReviewWorkbookMetadata {
  format_version: typeof EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION
  exported_at: string
  proposal_artifact_sha256: string
  proposal_count: string
  application_base_url: string
  source_branch: string
  source_commit: string
  locale: string
}

export interface ExactSlotReviewWorkbookRow {
  proposalKey: string
  procedureCode: string
  procedure: string
  slotId: string
  slotLabel: string
  requiredness: string
  roleCode: string
  productId: string
  manufacturer: string
  productName: string
  catalogNumber: string
  deviceIdentifier: string
  roleFit: string
  verificationGrade: string
  verificationStatus: string
  distributionStatus: string
  visibilityState: string
  evidenceSignal: string
  proposalReason: string
  sourceId: string
  sourceLocation: string
  evidencePageUrl: string
  proposalArtifactHash: string
  decision: string
  rationale: string
  evidenceNeeded: string
  reviewerName: string
  reviewerConfidence: string
  reviewDate: string
  followUpNotes: string
  readyForSecondReview: string
  secondReviewer: string
  secondReviewComments: string
}

export interface ExactSlotReviewDecision {
  proposalKey: string
  slotId: string
  procedureCode: string
  productId: string
  roleCode: string
  decision: ExactSlotReviewDecisionValue
  rationale: string
  evidenceNeeded: string | null
  reviewerName: string | null
  reviewerConfidence: ExactSlotReviewConfidence | null
  reviewDate: string | null
  followUpNotes: string | null
  readyForSecondReview: boolean | null
  secondReviewer: string | null
  secondReviewComments: string | null
}

export interface ExactSlotReviewExport {
  formatVersion: typeof EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION
  importedAt: string
  workbookFileName: string
  workbookSha256: string
  proposalArtifactSha256: string
  staleArtifactAcknowledged: boolean
  decisions: ExactSlotReviewDecision[]
}

export type ExactSlotReviewIssueSeverity = 'error' | 'warning'

export interface ExactSlotReviewIssue {
  severity: ExactSlotReviewIssueSeverity
  code:
    | 'duplicate_proposal_key'
    | 'formula_not_allowed'
    | 'identifier_not_text'
    | 'incomplete_decision'
    | 'invalid_confidence'
    | 'invalid_date'
    | 'invalid_decision'
    | 'invalid_yes_no'
    | 'missing_rationale'
    | 'preview_details_omitted'
    | 'protected_field_changed'
    | 'unknown_proposal_key'
  message: string
  rowNumber: number
  proposalKey: string | null
  field: string | null
}

export interface ExactSlotReviewImportRowPreview {
  rowNumber: number
  proposalKey: string | null
  status: 'valid_completed' | 'incomplete' | 'unreviewed' | 'invalid' | 'unknown'
  protectedFieldDifferences: Array<{
    field: string
    workbookValue: string
    currentValue: string
  }>
  issues: ExactSlotReviewIssue[]
  decision: ExactSlotReviewDecision | null
}

export interface ExactSlotReviewImportSummary {
  validCompletedDecisions: number
  incompleteDecisions: number
  rowsWithoutDecision: number
  invalidDecisionValues: number
  missingRationales: number
  unknownProposalKeys: number
  staleProposalKeys: number
  protectedFieldDifferences: number
  duplicateRows: number
  unchangedProtectedRows: number
  changedProtectedRows: number
  missingCurrentProposals: number
  matchedProposalKeys: number
}

export interface ExactSlotReviewImportPreview {
  formatVersion: typeof EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION
  importedAt: string
  workbookFileName: string
  workbookSha256: string
  workbookMetadata: ExactSlotReviewWorkbookMetadata
  currentProposalArtifactSha256: string
  staleArtifact: boolean
  staleWarning: string | null
  canExportNormalized: boolean
  exportBlockers: string[]
  summary: ExactSlotReviewImportSummary
  missingCurrentProposalKeys: string[]
  unknownWorkbookProposalKeys: string[]
  duplicateProposalKeys: string[]
  changedProposalKeys: string[]
  reviewedProposalKeys: string[]
  decisions: ExactSlotReviewDecision[]
  rows: ExactSlotReviewImportRowPreview[]
}

export type ExactSlotReviewExportScope = 'filtered' | 'all' | 'required' | 'unreviewed' | 'product'

export interface ExactSlotReviewWorkbookExportRequest {
  scope: ExactSlotReviewExportScope
  locale: string
  filters?: {
    q?: string
    procedure?: string
    role?: string
    requiredness?: string
    manufacturer?: string
    distribution?: string
    verification?: string
    visibility?: string
  }
  reviewedProposalKeys?: string[]
  productId?: string
}

export function exactSlotProposalKey(slotId: string, productId: string): string {
  return `${slotId}:${productId}`
}

const decisionValueByLabel = new Map<string, ExactSlotReviewDecisionValue>(
  EXACT_SLOT_REVIEW_DECISIONS.map((decision) => [decision.label, decision.value]),
)
const decisionLabelByValue = new Map<ExactSlotReviewDecisionValue, ExactSlotReviewDecisionLabel>(
  EXACT_SLOT_REVIEW_DECISIONS.map((decision) => [decision.value, decision.label]),
)
const confidenceValueByLabel = new Map<string, ExactSlotReviewConfidence>(
  EXACT_SLOT_REVIEW_CONFIDENCES.map((confidence) => [confidence.label, confidence.value]),
)

export function normalizeExactSlotDecision(
  value: string,
): ExactSlotReviewDecisionValue | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  return decisionValueByLabel.get(trimmed)
}

export function exactSlotDecisionLabel(value: ExactSlotReviewDecisionValue): string {
  return decisionLabelByValue.get(value) ?? value
}

export function normalizeExactSlotConfidence(
  value: string,
): ExactSlotReviewConfidence | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  return confidenceValueByLabel.get(trimmed)
}

export function nullableTrimmed(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
