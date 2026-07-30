export const EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION = '1' as const

export const EXTERNAL_REVIEW_REMEDIATION_SHEETS = [
  'Instructions',
  'Product Role Review',
  'Exact Slot Review',
  'Lookups',
] as const

export const EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS = [
  'Approve as proposed',
  'Approve with modification',
  'Needs clinician review',
  'Needs more evidence',
  'Defer',
  'Reject',
] as const

export const OLYMPUS_180_PRODUCT_IDS = [
  'PRD-88E003F12B',
  'PRD-815B93A920',
  'PRD-57DAB5ECAE',
  'PRD-7240BD99DA',
  'PRD-FB075DFB2D',
  'PRD-F586C51621',
] as const

export const DRESSING_SECUREMENT_SLOT_IDS = [
  'SLOT-01010CB364',
  'SLOT-126F71E1BD',
  'SLOT-23A6DA3B89',
  'SLOT-4BE1D79D6C',
] as const

export const VIZISHOT_PRODUCT_ID = 'PRD-0D6E4DB711' as const

export const VIZISHOT_SLOT_IDS = ['SLOT-B83EBD2FBB', 'SLOT-1AF4BEFE3B'] as const

export const FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS = [
  'PRD-2F1DF55F3C',
  'PRD-94C61697D9',
  'PRD-A31173136E',
  'PRD-9336231788',
  'PRD-925F0C99C6',
  'PRD-8CBA34433F',
] as const

export const FOCUSED_DRAINAGE_UNIT_SLOT_IDS = [
  'SLOT-022D0D3DC6',
  'SLOT-3631C94D7A',
  'SLOT-AA3C2EAA6D',
] as const

export const EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS = {
  olympus180Products: 6,
  originalTbnaProducts: 21,
  originalGuidingDeviceProducts: 34,
  targetedRoleCorrections: 2,
  productReviewRows: 63,
  dressingSecurementSlotRows: 4,
  viziShotSlotRows: 2,
  allDrainageUnitProposalRows: 63,
  allDrainageUnitProposalProducts: 21,
  focusedDrainageUnitProducts: 6,
  focusedDrainageUnitSlotRows: 18,
  scopeSlotPolicyRows: 10,
  exactSlotReviewRows: 34,
} as const

export interface ExternalReviewRemediationColumn<Row> {
  key: keyof Row
  header: string
  editable: boolean
  identifier?: boolean
  width: number
}

export interface ExternalReviewRemediationProductRow {
  reviewKey: string
  reviewCohort: string
  productId: string
  manufacturer: string
  productName: string
  catalogNumber: string
  currentRoleCode: string
  proposedRoleCode: string
  currentState: string
  proposedState: string
  reason: string
  lifecycleContext: string
  slottingScope: string
  roleDecision: string
  exactSlotDecision: string
  distributionEvidence: string
  visibilityState: string
  verificationGrade: string
  sourceId: string
  sourceLocation: string
  evidencePageUrl: string
  reviewerDecision: string
  rationale: string
}

export interface ExternalReviewRemediationSlotRow {
  reviewKey: string
  reviewCohort: string
  procedureCode: string
  slotId: string
  slotLabel: string
  requiredness: string
  productId: string
  manufacturer: string
  productName: string
  catalogNumber: string
  currentRoleCode: string
  proposedRoleCode: string
  currentState: string
  proposedState: string
  reason: string
  lifecycleContext: string
  slottingScope: string
  roleDecision: string
  exactSlotDecision: string
  evidencePageUrl: string
  reviewerDecision: string
  rationale: string
}

export const EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS = [
  { key: 'reviewKey', header: 'Review Key', editable: false, identifier: true, width: 30 },
  { key: 'reviewCohort', header: 'Review Cohort', editable: false, width: 28 },
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
    key: 'currentRoleCode',
    header: 'Current Role Code',
    editable: false,
    identifier: true,
    width: 30,
  },
  {
    key: 'proposedRoleCode',
    header: 'Proposed Role Code',
    editable: false,
    identifier: true,
    width: 32,
  },
  { key: 'currentState', header: 'Current State', editable: false, width: 54 },
  { key: 'proposedState', header: 'Proposed State', editable: false, width: 58 },
  { key: 'reason', header: 'Reason', editable: false, width: 58 },
  { key: 'lifecycleContext', header: 'Lifecycle Context', editable: false, width: 30 },
  { key: 'slottingScope', header: 'Slotting Scope', editable: false, width: 24 },
  { key: 'roleDecision', header: 'Role Decision', editable: false, width: 48 },
  { key: 'exactSlotDecision', header: 'Exact-slot Decision', editable: false, width: 54 },
  {
    key: 'distributionEvidence',
    header: 'Distribution Evidence',
    editable: false,
    width: 26,
  },
  { key: 'visibilityState', header: 'Visibility State', editable: false, width: 22 },
  { key: 'verificationGrade', header: 'Verification Grade', editable: false, width: 22 },
  { key: 'sourceId', header: 'Source ID', editable: false, identifier: true, width: 18 },
  { key: 'sourceLocation', header: 'Source Location', editable: false, width: 42 },
  { key: 'evidencePageUrl', header: 'Evidence Page URL', editable: false, width: 54 },
  { key: 'reviewerDecision', header: 'Reviewer Decision', editable: true, width: 30 },
  { key: 'rationale', header: 'Rationale', editable: true, width: 54 },
] as const satisfies readonly ExternalReviewRemediationColumn<ExternalReviewRemediationProductRow>[]

export const EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS = [
  { key: 'reviewKey', header: 'Review Key', editable: false, identifier: true, width: 42 },
  { key: 'reviewCohort', header: 'Review Cohort', editable: false, width: 28 },
  {
    key: 'procedureCode',
    header: 'Procedure Code',
    editable: false,
    identifier: true,
    width: 22,
  },
  { key: 'slotId', header: 'Slot ID', editable: false, identifier: true, width: 22 },
  { key: 'slotLabel', header: 'Slot Label', editable: false, width: 42 },
  { key: 'requiredness', header: 'Requiredness', editable: false, width: 18 },
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
    key: 'currentRoleCode',
    header: 'Current Role Code',
    editable: false,
    identifier: true,
    width: 30,
  },
  {
    key: 'proposedRoleCode',
    header: 'Proposed Role Code',
    editable: false,
    identifier: true,
    width: 32,
  },
  { key: 'currentState', header: 'Current State', editable: false, width: 54 },
  { key: 'proposedState', header: 'Proposed State', editable: false, width: 58 },
  { key: 'reason', header: 'Reason', editable: false, width: 58 },
  { key: 'lifecycleContext', header: 'Lifecycle Context', editable: false, width: 30 },
  { key: 'slottingScope', header: 'Slotting Scope', editable: false, width: 24 },
  { key: 'roleDecision', header: 'Role Decision', editable: false, width: 48 },
  { key: 'exactSlotDecision', header: 'Exact-slot Decision', editable: false, width: 58 },
  { key: 'evidencePageUrl', header: 'Evidence Page URL', editable: false, width: 54 },
  { key: 'reviewerDecision', header: 'Reviewer Decision', editable: true, width: 30 },
  { key: 'rationale', header: 'Rationale', editable: true, width: 54 },
] as const satisfies readonly ExternalReviewRemediationColumn<ExternalReviewRemediationSlotRow>[]

export interface ExternalReviewRemediationWorkbookMetadata {
  format_version: typeof EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION
  review_id: string
  exported_at: string
  normalized_corrections_sha256: string
  product_review_count: string
  exact_slot_review_count: string
  application_base_url: string
  locale: string
}
