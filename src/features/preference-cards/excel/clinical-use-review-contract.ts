export const CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION = '1' as const
export const CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION = 1 as const

export const CLINICAL_USE_REVIEW_SHEETS = [
  'Instructions',
  'Catalog Products',
  'Product Role Review',
  'Current Slot Review',
  'Review Summary',
  'Decision Definitions',
  'Lookups',
] as const

export type ClinicalUseReviewSheetName = (typeof CLINICAL_USE_REVIEW_SHEETS)[number]
export type ClinicalUseReviewRecordType = 'product_role' | 'slot_product'

export const CLINICAL_USE_PRODUCT_ROLE_DECISIONS = [
  {
    value: 'confirm_current_mapping',
    label: 'Confirm current mapping',
    definition:
      'The current product-to-role mapping appears clinically appropriate based on the available evidence.',
  },
  {
    value: 'remove_current_mapping',
    label: 'Remove current mapping',
    definition:
      'The product should not remain classified under this broad clinical or equipment role.',
  },
  {
    value: 'replace_with_different_role',
    label: 'Replace with different role',
    definition:
      'The current role appears incorrect and should be replaced with the suggested role in a later governed workflow.',
  },
  {
    value: 'add_another_role',
    label: 'Add another role',
    definition:
      'The current role may remain, but the product should also be reviewed for the suggested additional role.',
  },
  {
    value: 'needs_more_evidence',
    label: 'Needs more evidence',
    definition:
      'Additional IFU, dimensional, platform, kit, package, or configuration evidence is required.',
  },
  {
    value: 'hospital_local_or_custom_only',
    label: 'Hospital-local or custom only',
    definition:
      'The item is better represented as a local resource, supply, protocol, service, or formulary item.',
  },
  {
    value: 'unable_to_determine',
    label: 'Unable to determine',
    definition: 'The reviewer cannot reach a more specific conclusion from the available evidence.',
  },
] as const

export const CLINICAL_USE_SLOT_DECISIONS = [
  {
    value: 'confirm_current_assignment',
    label: 'Confirm current assignment',
    definition:
      'The product appears appropriate as a current option for this exact procedure slot based on the available evidence.',
  },
  {
    value: 'remove_exact_slot',
    label: 'Remove from this exact slot',
    definition:
      'The broad product role may remain valid, but the product should not be offered for this exact slot.',
  },
  {
    value: 'move_to_another_exact_slot',
    label: 'Move to another exact slot',
    definition:
      'This exact-slot assignment appears incorrect and should be reviewed for the suggested slot in a later governed workflow.',
  },
  {
    value: 'product_role_mapping_issue',
    label: 'Product-role mapping issue',
    definition:
      'The broader product-to-role classification may be incorrect and needs separate review.',
  },
  {
    value: 'needs_more_evidence',
    label: 'Needs more evidence',
    definition:
      'Additional IFU, dimensional, platform, kit, package, or configuration evidence is required.',
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

export type ClinicalUseProductRoleDecisionValue =
  (typeof CLINICAL_USE_PRODUCT_ROLE_DECISIONS)[number]['value']
export type ClinicalUseProductRoleDecisionLabel =
  (typeof CLINICAL_USE_PRODUCT_ROLE_DECISIONS)[number]['label']
export type ClinicalUseSlotDecisionValue = (typeof CLINICAL_USE_SLOT_DECISIONS)[number]['value']
export type ClinicalUseSlotDecisionLabel = (typeof CLINICAL_USE_SLOT_DECISIONS)[number]['label']

export const CLINICAL_USE_REVIEW_CONFIDENCES = [
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
] as const

export type ClinicalUseReviewConfidence = (typeof CLINICAL_USE_REVIEW_CONFIDENCES)[number]['value']

export const CLINICAL_USE_REVIEW_YES_NO = ['Yes', 'No'] as const

export interface ClinicalUseReviewColumn<Row> {
  key: keyof Row
  header: string
  editable: boolean
  identifier?: boolean
  width: number
}

export interface ClinicalUseCatalogProductWorkbookRow {
  productId: string
  manufacturerId: string
  manufacturer: string
  productName: string
  brandFamily: string
  catalogNumber: string
  deviceIdentifier: string
  primaryCategory: string
  subcategory: string
  productKind: string
  sizeDisplay: string
  description: string
  currentRoleCodes: string
  currentRoleNames: string
  currentRoleCount: number
  canonicalSlotCount: number
  verificationGrade: string
  verificationStatus: string
  distributionStatus: string
  visibilityState: string
  evidenceSignal: string
  sourceId: string
  sourceLocation: string
  evidencePageUrl: string
}

export interface ClinicalUseProductRoleWorkbookRow {
  reviewKey: string
  productId: string
  manufacturer: string
  productName: string
  catalogNumber: string
  deviceIdentifier: string
  primaryCategory: string
  subcategory: string
  roleCode: string
  roleName: string
  roleCategory: string
  roleDescription: string
  roleSelectionGuidance: string
  roleFit: string
  roleNotes: string
  canonicalSlotCount: number
  procedureCodes: string
  procedureNames: string
  verificationGrade: string
  verificationStatus: string
  distributionStatus: string
  visibilityState: string
  evidenceSignal: string
  sourceId: string
  sourceLocation: string
  evidencePageUrl: string
  clinicalUseManifestHash: string
  decision: string
  suggestedRoleCode: string
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

export interface ClinicalUseCurrentSlotWorkbookRow {
  reviewKey: string
  slotId: string
  procedureCode: string
  procedureName: string
  slotLabel: string
  requiredness: string
  section: string
  genericRequirement: string
  roleCode: string
  roleName: string
  productId: string
  manufacturer: string
  productName: string
  catalogNumber: string
  deviceIdentifier: string
  roleFit: string
  eligibilityStatus: string
  optionReason: string
  visibleByDefault: string
  selectable: string
  verificationGrade: string
  verificationStatus: string
  distributionStatus: string
  visibilityState: string
  evidenceSignal: string
  sourceId: string
  sourceLocation: string
  evidencePageUrl: string
  clinicalUseManifestHash: string
  decision: string
  suggestedSlotId: string
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

export const CLINICAL_USE_CATALOG_PRODUCT_COLUMNS = [
  { key: 'productId', header: 'Product ID', editable: false, identifier: true, width: 22 },
  {
    key: 'manufacturerId',
    header: 'Manufacturer ID',
    editable: false,
    identifier: true,
    width: 22,
  },
  { key: 'manufacturer', header: 'Manufacturer', editable: false, width: 28 },
  { key: 'productName', header: 'Product Name', editable: false, width: 42 },
  { key: 'brandFamily', header: 'Brand Family', editable: false, width: 28 },
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
  { key: 'primaryCategory', header: 'Primary Category', editable: false, width: 28 },
  { key: 'subcategory', header: 'Subcategory', editable: false, width: 28 },
  { key: 'productKind', header: 'Product Kind', editable: false, width: 22 },
  { key: 'sizeDisplay', header: 'Size', editable: false, width: 24 },
  { key: 'description', header: 'Description', editable: false, width: 52 },
  {
    key: 'currentRoleCodes',
    header: 'Current Role Codes',
    editable: false,
    identifier: true,
    width: 44,
  },
  { key: 'currentRoleNames', header: 'Current Role Names', editable: false, width: 44 },
  { key: 'currentRoleCount', header: 'Current Role Count', editable: false, width: 20 },
  { key: 'canonicalSlotCount', header: 'Current Slot Count', editable: false, width: 20 },
  { key: 'verificationGrade', header: 'Verification Grade', editable: false, width: 22 },
  { key: 'verificationStatus', header: 'Verification Status', editable: false, width: 28 },
  { key: 'distributionStatus', header: 'Distribution Status', editable: false, width: 24 },
  { key: 'visibilityState', header: 'Visibility State', editable: false, width: 22 },
  { key: 'evidenceSignal', header: 'Evidence Signal', editable: false, width: 34 },
  { key: 'sourceId', header: 'Source ID', editable: false, identifier: true, width: 18 },
  { key: 'sourceLocation', header: 'Source Location', editable: false, width: 42 },
  { key: 'evidencePageUrl', header: 'Evidence Page URL', editable: false, width: 50 },
] as const satisfies readonly ClinicalUseReviewColumn<ClinicalUseCatalogProductWorkbookRow>[]

export const CLINICAL_USE_PRODUCT_ROLE_COLUMNS = [
  { key: 'reviewKey', header: 'Review Key', editable: false, identifier: true, width: 54 },
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
  { key: 'primaryCategory', header: 'Primary Category', editable: false, width: 28 },
  { key: 'subcategory', header: 'Subcategory', editable: false, width: 28 },
  { key: 'roleCode', header: 'Role Code', editable: false, identifier: true, width: 30 },
  { key: 'roleName', header: 'Role Name', editable: false, width: 36 },
  { key: 'roleCategory', header: 'Role Category', editable: false, width: 24 },
  { key: 'roleDescription', header: 'Role Description', editable: false, width: 48 },
  {
    key: 'roleSelectionGuidance',
    header: 'Role Selection Guidance',
    editable: false,
    width: 48,
  },
  { key: 'roleFit', header: 'Role Fit', editable: false, width: 18 },
  { key: 'roleNotes', header: 'Role Notes', editable: false, width: 42 },
  { key: 'canonicalSlotCount', header: 'Current Slot Count', editable: false, width: 20 },
  {
    key: 'procedureCodes',
    header: 'Current Procedure Codes',
    editable: false,
    identifier: true,
    width: 36,
  },
  { key: 'procedureNames', header: 'Current Procedures', editable: false, width: 44 },
  { key: 'verificationGrade', header: 'Verification Grade', editable: false, width: 22 },
  { key: 'verificationStatus', header: 'Verification Status', editable: false, width: 28 },
  { key: 'distributionStatus', header: 'Distribution Status', editable: false, width: 24 },
  { key: 'visibilityState', header: 'Visibility State', editable: false, width: 22 },
  { key: 'evidenceSignal', header: 'Evidence Signal', editable: false, width: 34 },
  { key: 'sourceId', header: 'Source ID', editable: false, identifier: true, width: 18 },
  { key: 'sourceLocation', header: 'Source Location', editable: false, width: 42 },
  { key: 'evidencePageUrl', header: 'Evidence Page URL', editable: false, width: 50 },
  {
    key: 'clinicalUseManifestHash',
    header: 'Clinical-use Manifest Hash',
    editable: false,
    identifier: true,
    width: 68,
  },
  { key: 'decision', header: 'Decision', editable: true, width: 34 },
  {
    key: 'suggestedRoleCode',
    header: 'Suggested Role Code',
    editable: true,
    identifier: true,
    width: 30,
  },
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
] as const satisfies readonly ClinicalUseReviewColumn<ClinicalUseProductRoleWorkbookRow>[]

export const CLINICAL_USE_CURRENT_SLOT_COLUMNS = [
  { key: 'reviewKey', header: 'Review Key', editable: false, identifier: true, width: 54 },
  { key: 'slotId', header: 'Slot ID', editable: false, identifier: true, width: 22 },
  {
    key: 'procedureCode',
    header: 'Procedure Code',
    editable: false,
    identifier: true,
    width: 20,
  },
  { key: 'procedureName', header: 'Procedure', editable: false, width: 30 },
  { key: 'slotLabel', header: 'Slot Label', editable: false, width: 36 },
  { key: 'requiredness', header: 'Requiredness', editable: false, width: 16 },
  { key: 'section', header: 'Section', editable: false, width: 24 },
  { key: 'genericRequirement', header: 'Generic Requirement', editable: false, width: 44 },
  { key: 'roleCode', header: 'Role Code', editable: false, identifier: true, width: 30 },
  { key: 'roleName', header: 'Role Name', editable: false, width: 36 },
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
  { key: 'eligibilityStatus', header: 'Eligibility Status', editable: false, width: 24 },
  { key: 'optionReason', header: 'Option Reason', editable: false, width: 44 },
  { key: 'visibleByDefault', header: 'Visible by Default', editable: false, width: 20 },
  { key: 'selectable', header: 'Selectable', editable: false, width: 16 },
  { key: 'verificationGrade', header: 'Verification Grade', editable: false, width: 22 },
  { key: 'verificationStatus', header: 'Verification Status', editable: false, width: 28 },
  { key: 'distributionStatus', header: 'Distribution Status', editable: false, width: 24 },
  { key: 'visibilityState', header: 'Visibility State', editable: false, width: 22 },
  { key: 'evidenceSignal', header: 'Evidence Signal', editable: false, width: 34 },
  { key: 'sourceId', header: 'Source ID', editable: false, identifier: true, width: 18 },
  { key: 'sourceLocation', header: 'Source Location', editable: false, width: 42 },
  { key: 'evidencePageUrl', header: 'Evidence Page URL', editable: false, width: 50 },
  {
    key: 'clinicalUseManifestHash',
    header: 'Clinical-use Manifest Hash',
    editable: false,
    identifier: true,
    width: 68,
  },
  { key: 'decision', header: 'Decision', editable: true, width: 34 },
  {
    key: 'suggestedSlotId',
    header: 'Suggested Slot ID',
    editable: true,
    identifier: true,
    width: 22,
  },
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
] as const satisfies readonly ClinicalUseReviewColumn<ClinicalUseCurrentSlotWorkbookRow>[]

export const CLINICAL_USE_PRODUCT_ROLE_REFERENCE_COLUMNS = CLINICAL_USE_PRODUCT_ROLE_COLUMNS.filter(
  (column) => !column.editable,
)
export const CLINICAL_USE_PRODUCT_ROLE_EDITABLE_COLUMNS = CLINICAL_USE_PRODUCT_ROLE_COLUMNS.filter(
  (column) => column.editable,
)
export const CLINICAL_USE_CURRENT_SLOT_REFERENCE_COLUMNS = CLINICAL_USE_CURRENT_SLOT_COLUMNS.filter(
  (column) => !column.editable,
)
export const CLINICAL_USE_CURRENT_SLOT_EDITABLE_COLUMNS = CLINICAL_USE_CURRENT_SLOT_COLUMNS.filter(
  (column) => column.editable,
)

function identifierHeaders<Row>(
  columns: readonly ClinicalUseReviewColumn<Row>[],
): ReadonlySet<string> {
  return new Set(
    columns
      .filter((column) => 'identifier' in column && column.identifier)
      .map((column) => column.header),
  )
}

export const CLINICAL_USE_CATALOG_PRODUCT_IDENTIFIER_HEADERS = identifierHeaders(
  CLINICAL_USE_CATALOG_PRODUCT_COLUMNS,
)
export const CLINICAL_USE_PRODUCT_ROLE_IDENTIFIER_HEADERS = identifierHeaders(
  CLINICAL_USE_PRODUCT_ROLE_COLUMNS,
)
export const CLINICAL_USE_CURRENT_SLOT_IDENTIFIER_HEADERS = identifierHeaders(
  CLINICAL_USE_CURRENT_SLOT_COLUMNS,
)

export interface ClinicalUseReviewWorkbookMetadata {
  format_version: typeof CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION
  exported_at: string
  clinical_use_manifest_sha256: string
  catalog_products_sha256: string
  product_roles_sha256: string
  roles_sha256: string
  procedures_sha256: string
  procedure_slots_sha256: string
  slot_product_options_sha256: string
  catalog_product_count: string
  product_role_count: string
  current_slot_count: string
  application_base_url: string
  source_branch: string
  source_commit: string
  locale: string
}

export interface ClinicalUseSharedDecisionFields {
  rationale: string
  evidenceNeeded: string | null
  reviewerName: string | null
  reviewerConfidence: ClinicalUseReviewConfidence | null
  reviewDate: string | null
  followUpNotes: string | null
  readyForSecondReview: boolean | null
  secondReviewer: string | null
  secondReviewComments: string | null
}

export interface ClinicalUseProductRoleDecision extends ClinicalUseSharedDecisionFields {
  recordType: 'product_role'
  reviewKey: string
  productId: string
  roleCode: string
  decision: ClinicalUseProductRoleDecisionValue
  suggestedRoleCode: string | null
}

export interface ClinicalUseSlotDecision extends ClinicalUseSharedDecisionFields {
  recordType: 'slot_product'
  reviewKey: string
  slotId: string
  procedureCode: string
  productId: string
  roleCode: string
  decision: ClinicalUseSlotDecisionValue
  suggestedSlotId: string | null
}

export type ClinicalUseReviewDecision = ClinicalUseProductRoleDecision | ClinicalUseSlotDecision

export interface ClinicalUseReviewExport {
  formatVersion: typeof CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION
  importedAt: string
  workbookFileName: string
  workbookSha256: string
  clinicalUseManifestSha256: string
  staleArtifactAcknowledged: boolean
  decisions: ClinicalUseReviewDecision[]
}

export type ClinicalUseReviewIssueSeverity = 'error' | 'warning'

export interface ClinicalUseReviewIssue {
  severity: ClinicalUseReviewIssueSeverity
  code:
    | 'duplicate_review_key'
    | 'formula_not_allowed'
    | 'identifier_not_text'
    | 'incomplete_decision'
    | 'invalid_confidence'
    | 'invalid_date'
    | 'invalid_decision'
    | 'invalid_suggested_role'
    | 'invalid_suggested_slot'
    | 'invalid_yes_no'
    | 'missing_rationale'
    | 'missing_suggested_role'
    | 'missing_suggested_slot'
    | 'preview_details_omitted'
    | 'protected_field_changed'
    | 'unknown_review_key'
  message: string
  sheetName: 'Product Role Review' | 'Current Slot Review'
  rowNumber: number
  reviewKey: string | null
  field: string | null
}

export interface ClinicalUseReviewImportRowPreview {
  sheetName: 'Product Role Review' | 'Current Slot Review'
  rowNumber: number
  recordType: ClinicalUseReviewRecordType
  reviewKey: string | null
  status: 'valid_completed' | 'incomplete' | 'unreviewed' | 'invalid' | 'unknown'
  protectedFieldDifferences: Array<{
    field: string
    workbookValue: string
    currentValue: string
  }>
  issues: ClinicalUseReviewIssue[]
  decision: ClinicalUseReviewDecision | null
}

export interface ClinicalUseReviewImportSummary {
  validCompletedDecisions: number
  productRoleDecisions: number
  currentSlotDecisions: number
  incompleteDecisions: number
  rowsWithoutDecision: number
  invalidDecisionValues: number
  missingRationales: number
  missingSuggestedRoles: number
  missingSuggestedSlots: number
  unknownReviewKeys: number
  staleReviewKeys: number
  protectedFieldDifferences: number
  duplicateRows: number
  unchangedProtectedRows: number
  changedProtectedRows: number
  missingCurrentRows: number
  matchedReviewKeys: number
}

export interface ClinicalUseReviewImportPreview {
  formatVersion: typeof CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION
  importedAt: string
  workbookFileName: string
  workbookSha256: string
  workbookMetadata: ClinicalUseReviewWorkbookMetadata
  currentClinicalUseManifestSha256: string
  staleArtifact: boolean
  staleWarning: string | null
  canExportNormalized: boolean
  exportBlockers: string[]
  summary: ClinicalUseReviewImportSummary
  missingCurrentReviewKeys: string[]
  unknownWorkbookReviewKeys: string[]
  duplicateReviewKeys: string[]
  changedReviewKeys: string[]
  reviewedReviewKeys: string[]
  decisions: ClinicalUseReviewDecision[]
  rows: ClinicalUseReviewImportRowPreview[]
}

export interface ClinicalUseReviewWorkbookExportRequest {
  locale: string
}

export function clinicalUseProductRoleKey(productId: string, roleCode: string): string {
  return `product_role:${productId}:${roleCode}`
}

export function clinicalUseSlotProductKey(slotId: string, productId: string): string {
  return `slot_product:${slotId}:${productId}`
}

const productRoleDecisionValueByLabel = new Map<string, ClinicalUseProductRoleDecisionValue>(
  CLINICAL_USE_PRODUCT_ROLE_DECISIONS.map((decision) => [decision.label, decision.value]),
)
const productRoleDecisionLabelByValue = new Map<
  ClinicalUseProductRoleDecisionValue,
  ClinicalUseProductRoleDecisionLabel
>(CLINICAL_USE_PRODUCT_ROLE_DECISIONS.map((decision) => [decision.value, decision.label]))
const slotDecisionValueByLabel = new Map<string, ClinicalUseSlotDecisionValue>(
  CLINICAL_USE_SLOT_DECISIONS.map((decision) => [decision.label, decision.value]),
)
const slotDecisionLabelByValue = new Map<
  ClinicalUseSlotDecisionValue,
  ClinicalUseSlotDecisionLabel
>(CLINICAL_USE_SLOT_DECISIONS.map((decision) => [decision.value, decision.label]))
const confidenceValueByLabel = new Map<string, ClinicalUseReviewConfidence>(
  CLINICAL_USE_REVIEW_CONFIDENCES.map((confidence) => [confidence.label, confidence.value]),
)

export function normalizeClinicalUseProductRoleDecision(
  value: string,
): ClinicalUseProductRoleDecisionValue | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  return productRoleDecisionValueByLabel.get(trimmed)
}

export function clinicalUseProductRoleDecisionLabel(
  value: ClinicalUseProductRoleDecisionValue,
): string {
  return productRoleDecisionLabelByValue.get(value) ?? value
}

export function normalizeClinicalUseSlotDecision(
  value: string,
): ClinicalUseSlotDecisionValue | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  return slotDecisionValueByLabel.get(trimmed)
}

export function clinicalUseSlotDecisionLabel(value: ClinicalUseSlotDecisionValue): string {
  return slotDecisionLabelByValue.get(value) ?? value
}

export function normalizeClinicalUseReviewConfidence(
  value: string,
): ClinicalUseReviewConfidence | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  return confidenceValueByLabel.get(trimmed)
}

export function nullableClinicalUseReviewText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
