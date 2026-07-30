import { createHash } from 'node:crypto'

import {
  EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS,
  EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS,
  EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS,
  EXTERNAL_REVIEW_REMEDIATION_SHEETS,
  EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS,
  EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION,
  type ExternalReviewRemediationColumn,
  type ExternalReviewRemediationProductRow,
  type ExternalReviewRemediationSlotRow,
  type ExternalReviewRemediationWorkbookMetadata,
} from '@/features/preference-cards/excel/external-review-remediation-contract'
import {
  getExternalReviewRemediationReviewData,
  type ExternalReviewRemediationReviewData,
} from '@/features/preference-cards/excel/external-review-remediation-data.server'
import {
  parseOoxmlWorkbookBytes,
  type ParsedOoxmlCell,
  type ParsedOoxmlWorksheet,
} from '@/features/preference-cards/excel/ooxml-reader.server'

export const EXTERNAL_REVIEW_REMEDIATION_DECISION_FORMAT_VERSION = 1 as const

export const EXTERNAL_REVIEW_REMEDIATION_DECISION_VALUES = [
  'approve_as_proposed',
  'approve_with_modification',
  'needs_clinician_review',
  'needs_more_evidence',
  'defer',
  'reject',
] as const

export type ExternalReviewRemediationDecisionValue =
  (typeof EXTERNAL_REVIEW_REMEDIATION_DECISION_VALUES)[number]

export type ExternalReviewRemediationReviewSheet = 'Product Role Review' | 'Exact Slot Review'

export interface ExternalReviewRemediationImportOptions {
  fileName: string
  currentReviewData?: ExternalReviewRemediationReviewData
}

export interface ExternalReviewRemediationIssue {
  severity: 'error' | 'warning'
  code:
    | 'duplicate_review_key'
    | 'formula_not_allowed'
    | 'identifier_not_text'
    | 'invalid_decision'
    | 'local_path_not_allowed'
    | 'missing_approval_rationale'
    | 'missing_decision'
    | 'missing_required_rationale'
    | 'missing_review_key'
    | 'patient_like_data'
    | 'protected_field_changed'
    | 'review_text_too_long'
    | 'row_count_mismatch'
    | 'unexpected_hyperlink'
    | 'unknown_review_key'
  message: string
  sheetName: ExternalReviewRemediationReviewSheet
  rowNumber: number | null
  reviewKey: string | null
  field: string | null
}

interface ExternalReviewRemediationDecisionBase {
  sourceSheet: ExternalReviewRemediationReviewSheet
  sourceRow: number
  reviewKey: string
  reviewCohort: string
  reviewerDecision: ExternalReviewRemediationDecisionValue | null
  reviewerDecisionLabel: string
  rationale: string
  valid: boolean
}

export interface ExternalReviewRemediationProductDecision extends ExternalReviewRemediationDecisionBase {
  recordType: 'product_role'
  productId: string
  currentRoleCode: string
  proposedRoleCode: string
}

export interface ExternalReviewRemediationSlotDecision extends ExternalReviewRemediationDecisionBase {
  recordType: 'exact_slot'
  procedureCode: string
  slotId: string
  productId: string | null
  currentRoleCode: string
  proposedRoleCode: string
}

export type ExternalReviewRemediationDecision =
  | ExternalReviewRemediationProductDecision
  | ExternalReviewRemediationSlotDecision

export interface ExternalReviewRemediationDecisionArtifact {
  formatVersion: typeof EXTERNAL_REVIEW_REMEDIATION_DECISION_FORMAT_VERSION
  reviewId: string
  normalizedCorrectionsSha256: string
  sourceWorkbook: {
    fileName: string
    sha256: string
    exportedAt: string
    applicationBaseUrl: string
    locale: string
  }
  readyToApply: boolean
  summary: {
    productReviewRows: number
    exactSlotReviewRows: number
    normalizedDecisions: number
    validDecisions: number
    invalidDecisions: number
    errors: number
    warnings: number
    decisionsByValue: Record<ExternalReviewRemediationDecisionValue, number>
    issuesByCode: Record<string, number>
  }
  issues: ExternalReviewRemediationIssue[]
  decisions: ExternalReviewRemediationDecision[]
}

type ReviewRow = ExternalReviewRemediationProductRow | ExternalReviewRemediationSlotRow
type ReviewColumn =
  | ExternalReviewRemediationColumn<ExternalReviewRemediationProductRow>
  | ExternalReviewRemediationColumn<ExternalReviewRemediationSlotRow>

const PRODUCT_SHEET = 'Product Role Review' as const
const SLOT_SHEET = 'Exact Slot Review' as const
const LOOKUPS_SHEET = 'Lookups' as const
const MAX_REVIEW_TEXT_CHARACTERS = 12_000

const DECISION_VALUE_BY_LABEL = new Map<string, ExternalReviewRemediationDecisionValue>([
  ['Approve as proposed', 'approve_as_proposed'],
  ['Approve with modification', 'approve_with_modification'],
  ['Needs clinician review', 'needs_clinician_review'],
  ['Needs more evidence', 'needs_more_evidence'],
  ['Defer', 'defer'],
  ['Reject', 'reject'],
])

const REQUIRED_RATIONALE_DECISIONS = new Set<ExternalReviewRemediationDecisionValue>([
  'approve_with_modification',
  'needs_more_evidence',
  'defer',
  'reject',
])

const LOCAL_PATH_PATTERN =
  /(?:file:\/\/|(?:^|[\s("'`])(?:\/Users\/|\/home\/|\/Volumes\/|~\/|[A-Za-z]:[\\/]|\\\\[^\\\s]+\\))/i
const PATIENT_LIKE_DATA_PATTERN =
  /\b(?:MRN|medical record (?:number|no\.?)|patient (?:name|id|identifier)|date of birth|DOB|encounter (?:id|number)|accession (?:id|number|no\.?)|CSN)\s*[:#=-]\s*[A-Za-z0-9][A-Za-z0-9._-]{2,}/i

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function normalizedBaseUrl(rawBaseUrl: string): string {
  const parsed = new URL(rawBaseUrl)
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.origin !== rawBaseUrl
  ) {
    throw new Error(
      'Workbook application base URL must be an HTTP(S) origin without credentials or a path.',
    )
  }
  return parsed.origin
}

function worksheetCell(
  worksheet: ParsedOoxmlWorksheet,
  rowNumber: number,
  columnNumber: number,
): ParsedOoxmlCell {
  return (
    worksheet.rows.get(rowNumber)?.get(columnNumber) ?? {
      value: '',
      type: '',
      style: null,
      hasFormula: false,
    }
  )
}

function requiredWorksheet(
  sheets: Map<string, ParsedOoxmlWorksheet>,
  sheetName: string,
): ParsedOoxmlWorksheet {
  const worksheet = sheets.get(sheetName)
  if (!worksheet) throw new Error(`Required workbook sheet "${sheetName}" is missing.`)
  return worksheet
}

function validateWorkbookFileName(fileName: string) {
  if (
    !fileName ||
    fileName.length > 255 ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    !/\.xlsx$/i.test(fileName) ||
    PATIENT_LIKE_DATA_PATTERN.test(fileName)
  ) {
    throw new Error(
      'Workbook fileName must be a local-path-free, patient-data-free .xlsx basename.',
    )
  }
}

function validateStaticWorksheet(worksheet: ParsedOoxmlWorksheet, sheetName: string) {
  for (const [rowNumber, row] of worksheet.rows) {
    for (const [columnNumber, cell] of row) {
      if (cell.hasFormula) {
        throw new Error(
          `${sheetName} cell ${columnNumber}:${rowNumber} contains an unsupported formula.`,
        )
      }
    }
  }
  if (worksheet.hyperlinks.size > 0) {
    throw new Error(`${sheetName} must not contain hyperlinks.`)
  }
}

function validateHeaders(
  worksheet: ParsedOoxmlWorksheet,
  sheetName: ExternalReviewRemediationReviewSheet,
  columns: readonly ReviewColumn[],
) {
  const expectedHeaders = columns.map((column) => column.header)
  if (worksheet.maxColumn > expectedHeaders.length) {
    throw new Error(
      `${sheetName} contains unsupported cells beyond column ${expectedHeaders.length}.`,
    )
  }
  expectedHeaders.forEach((expectedHeader, index) => {
    const cell = worksheetCell(worksheet, 1, index + 1)
    if (cell.hasFormula) {
      throw new Error(`${sheetName} headers must not contain formulas.`)
    }
    if (cell.value.trim() !== expectedHeader) {
      throw new Error(
        `${sheetName} column ${index + 1} must be "${expectedHeader}", not "${
          cell.value.trim() || '(blank)'
        }".`,
      )
    }
  })
}

function readWorkbookMetadata(
  worksheet: ParsedOoxmlWorksheet,
): ExternalReviewRemediationWorkbookMetadata {
  const expectedHeaders = ['Reviewer Decision Values', 'Metadata Field', 'Metadata Value']
  if (worksheet.maxColumn > expectedHeaders.length) {
    throw new Error('Lookups contains unsupported cells beyond column 3.')
  }
  expectedHeaders.forEach((header, index) => {
    const cell = worksheetCell(worksheet, 1, index + 1)
    if (cell.hasFormula || cell.value.trim() !== header) {
      throw new Error(`Lookups column ${index + 1} must be "${header}".`)
    }
  })

  EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS.forEach((decision, index) => {
    const cell = worksheetCell(worksheet, index + 2, 1)
    if (cell.hasFormula || cell.value.trim() !== decision) {
      throw new Error('Workbook reviewer-decision lookup values do not match the export contract.')
    }
  })
  for (
    let rowNumber = EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS.length + 2;
    rowNumber <= worksheet.maxRow;
    rowNumber += 1
  ) {
    const cell = worksheetCell(worksheet, rowNumber, 1)
    if (cell.hasFormula || cell.value.trim()) {
      throw new Error('Lookups contains an unsupported reviewer-decision lookup value.')
    }
  }

  const metadata = new Map<string, string>()
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    const keyCell = worksheetCell(worksheet, rowNumber, 2)
    const valueCell = worksheetCell(worksheet, rowNumber, 3)
    if (keyCell.hasFormula || valueCell.hasFormula) {
      throw new Error('Workbook provenance metadata must not contain formulas.')
    }
    const key = keyCell.value.trim()
    if (!key) {
      if (valueCell.value.trim()) {
        throw new Error('Workbook provenance metadata contains a value without a field name.')
      }
      continue
    }
    if (metadata.has(key)) throw new Error(`Workbook metadata field "${key}" is duplicated.`)
    metadata.set(key, valueCell.value.trim())
  }

  const requiredKeys = [
    'format_version',
    'review_id',
    'exported_at',
    'normalized_corrections_sha256',
    'product_review_count',
    'exact_slot_review_count',
    'application_base_url',
    'locale',
  ] as const
  for (const key of requiredKeys) {
    if (!metadata.has(key)) throw new Error(`Required workbook metadata "${key}" is missing.`)
  }
  const unexpectedKeys = [...metadata.keys()].filter(
    (key) => !requiredKeys.includes(key as (typeof requiredKeys)[number]),
  )
  if (unexpectedKeys.length > 0) {
    throw new Error(`Workbook contains unsupported metadata: ${unexpectedKeys.join(', ')}.`)
  }
  if (metadata.get('format_version') !== EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION) {
    throw new Error(
      `Workbook format version must be ${EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION}.`,
    )
  }
  const normalizedCorrectionsSha256 = metadata.get('normalized_corrections_sha256') ?? ''
  if (!/^[a-f0-9]{64}$/i.test(normalizedCorrectionsSha256)) {
    throw new Error('Workbook normalized corrections SHA-256 is invalid.')
  }
  const exportedAt = metadata.get('exported_at') ?? ''
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new Error('Workbook export timestamp is invalid.')
  }
  const productReviewCount = metadata.get('product_review_count') ?? ''
  const exactSlotReviewCount = metadata.get('exact_slot_review_count') ?? ''
  if (!/^\d{1,4}$/.test(productReviewCount) || !/^\d{1,4}$/.test(exactSlotReviewCount)) {
    throw new Error('Workbook review row counts are invalid.')
  }
  const locale = metadata.get('locale') ?? ''
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
    throw new Error('Workbook locale is invalid.')
  }

  return {
    format_version: EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION,
    review_id: metadata.get('review_id') ?? '',
    exported_at: exportedAt,
    normalized_corrections_sha256: normalizedCorrectionsSha256.toLocaleLowerCase(),
    product_review_count: productReviewCount,
    exact_slot_review_count: exactSlotReviewCount,
    application_base_url: normalizedBaseUrl(metadata.get('application_base_url') ?? ''),
    locale,
  }
}

function issue(
  severity: ExternalReviewRemediationIssue['severity'],
  code: ExternalReviewRemediationIssue['code'],
  message: string,
  sheetName: ExternalReviewRemediationReviewSheet,
  rowNumber: number | null,
  reviewKey: string | null,
  field: string | null,
): ExternalReviewRemediationIssue {
  return { severity, code, message, sheetName, rowNumber, reviewKey, field }
}

function rowHasAnyValue(
  worksheet: ParsedOoxmlWorksheet,
  rowNumber: number,
  columns: readonly ReviewColumn[],
): boolean {
  return columns.some((_, index) => worksheetCell(worksheet, rowNumber, index + 1).value.trim())
}

function privacyIssueCodes(value: string): Array<'local_path_not_allowed' | 'patient_like_data'> {
  return [
    ...(LOCAL_PATH_PATTERN.test(value) ? (['local_path_not_allowed'] as const) : []),
    ...(PATIENT_LIKE_DATA_PATTERN.test(value) ? (['patient_like_data'] as const) : []),
  ]
}

function compareIssues(
  left: ExternalReviewRemediationIssue,
  right: ExternalReviewRemediationIssue,
): number {
  const sheetOrder = (sheetName: ExternalReviewRemediationReviewSheet) =>
    sheetName === PRODUCT_SHEET ? 0 : 1
  return (
    sheetOrder(left.sheetName) - sheetOrder(right.sheetName) ||
    (left.rowNumber ?? Number.MAX_SAFE_INTEGER) - (right.rowNumber ?? Number.MAX_SAFE_INTEGER) ||
    left.code.localeCompare(right.code) ||
    (left.reviewKey ?? '').localeCompare(right.reviewKey ?? '')
  )
}

interface ProcessedSheet {
  decisions: ExternalReviewRemediationDecision[]
  issues: ExternalReviewRemediationIssue[]
}

function processReviewSheet(
  worksheet: ParsedOoxmlWorksheet,
  sheetName: ExternalReviewRemediationReviewSheet,
  columns: readonly ReviewColumn[],
  expectedRows: readonly ReviewRow[],
): ProcessedSheet {
  const expectedByKey = new Map(expectedRows.map((row) => [row.reviewKey, row]))
  const importedRows: Array<{
    rowNumber: number
    cells: Record<string, ParsedOoxmlCell>
    reviewKey: string
  }> = []
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    if (!rowHasAnyValue(worksheet, rowNumber, columns)) continue
    const cells = Object.fromEntries(
      columns.map((column, index) => [
        String(column.key),
        worksheetCell(worksheet, rowNumber, index + 1),
      ]),
    )
    importedRows.push({
      rowNumber,
      cells,
      reviewKey: cells.reviewKey.value.trim(),
    })
  }

  const issues: ExternalReviewRemediationIssue[] = []
  if (importedRows.length !== expectedRows.length) {
    issues.push(
      issue(
        'error',
        'row_count_mismatch',
        `${sheetName} must contain exactly ${expectedRows.length} review rows.`,
        sheetName,
        null,
        null,
        null,
      ),
    )
  }

  const rowNumbersByKey = new Map<string, number[]>()
  for (const imported of importedRows) {
    if (!imported.reviewKey) continue
    rowNumbersByKey.set(imported.reviewKey, [
      ...(rowNumbersByKey.get(imported.reviewKey) ?? []),
      imported.rowNumber,
    ])
  }
  const duplicateKeys = new Set(
    [...rowNumbersByKey].filter(([, rows]) => rows.length > 1).map(([reviewKey]) => reviewKey),
  )
  const workbookKeys = new Set(rowNumbersByKey.keys())
  for (const expected of expectedRows) {
    if (workbookKeys.has(expected.reviewKey)) continue
    issues.push(
      issue(
        'error',
        'missing_review_key',
        'An expected review key is missing from the workbook.',
        sheetName,
        null,
        expected.reviewKey,
        'Review Key',
      ),
    )
  }

  const decisions: ExternalReviewRemediationDecision[] = []
  for (const imported of importedRows) {
    const { cells, reviewKey, rowNumber } = imported
    const rowIssues: ExternalReviewRemediationIssue[] = []
    const expected = expectedByKey.get(reviewKey)

    for (const column of columns) {
      const cell = cells[String(column.key)]
      if (cell.hasFormula) {
        rowIssues.push(
          issue(
            'error',
            'formula_not_allowed',
            `${column.header} contains a formula. Formula results are not trusted as review input.`,
            sheetName,
            rowNumber,
            reviewKey || null,
            column.header,
          ),
        )
      }
      if (
        'identifier' in column &&
        column.identifier &&
        cell.value.trim() &&
        !['inlineStr', 's', 'str'].includes(cell.type)
      ) {
        rowIssues.push(
          issue(
            'error',
            'identifier_not_text',
            `${column.header} must remain an Excel text value.`,
            sheetName,
            rowNumber,
            reviewKey || null,
            column.header,
          ),
        )
      }
    }

    if (!reviewKey) {
      rowIssues.push(
        issue(
          'error',
          'missing_review_key',
          'Review Key is required.',
          sheetName,
          rowNumber,
          null,
          'Review Key',
        ),
      )
    } else if (!expected) {
      rowIssues.push(
        issue(
          'error',
          'unknown_review_key',
          'Review Key does not exist in the current focused-remediation export.',
          sheetName,
          rowNumber,
          reviewKey,
          'Review Key',
        ),
      )
    }
    if (reviewKey && duplicateKeys.has(reviewKey)) {
      rowIssues.push(
        issue(
          'error',
          'duplicate_review_key',
          'Review Key appears more than once in the workbook.',
          sheetName,
          rowNumber,
          reviewKey,
          'Review Key',
        ),
      )
    }

    if (expected) {
      for (const column of columns) {
        if (column.editable) continue
        const workbookValue = cells[String(column.key)].value
        const currentValue = String(
          (expected as unknown as Record<string, string>)[String(column.key)] ?? '',
        )
        if (workbookValue !== currentValue) {
          rowIssues.push(
            issue(
              'error',
              'protected_field_changed',
              `${column.header} differs from current authoritative review data.`,
              sheetName,
              rowNumber,
              reviewKey,
              column.header,
            ),
          )
        }
      }
    }
    for (const [reference, target] of worksheet.hyperlinks) {
      const referenceRow = Number(reference.match(/(\d+)$/)?.[1])
      if (referenceRow !== rowNumber) continue
      rowIssues.push(
        issue(
          'error',
          'unexpected_hyperlink',
          `Review rows must not contain hyperlinks (${target.startsWith('http') ? 'external target' : 'non-external target'}).`,
          sheetName,
          rowNumber,
          reviewKey || null,
          null,
        ),
      )
    }

    const rawReviewerDecisionLabel = cells.reviewerDecision.value.trim()
    const reviewerDecision = cells.reviewerDecision.hasFormula
      ? null
      : (DECISION_VALUE_BY_LABEL.get(rawReviewerDecisionLabel) ?? null)
    const reviewerDecisionLabel = reviewerDecision ? rawReviewerDecisionLabel : ''
    const rawRationale = cells.rationale.value.trim()
    const privacyCodes = privacyIssueCodes(rawRationale)
    if (!rawReviewerDecisionLabel) {
      rowIssues.push(
        issue(
          'error',
          'missing_decision',
          'Every row in a completed remediation workbook requires a reviewer decision.',
          sheetName,
          rowNumber,
          reviewKey || null,
          'Reviewer Decision',
        ),
      )
    } else if (!reviewerDecision && !cells.reviewerDecision.hasFormula) {
      rowIssues.push(
        issue(
          'error',
          'invalid_decision',
          'Reviewer Decision must be one of the allowed dropdown values.',
          sheetName,
          rowNumber,
          reviewKey || null,
          'Reviewer Decision',
        ),
      )
    }
    if (rawRationale.length > MAX_REVIEW_TEXT_CHARACTERS) {
      rowIssues.push(
        issue(
          'error',
          'review_text_too_long',
          `Rationale exceeds the accepted ${MAX_REVIEW_TEXT_CHARACTERS}-character limit.`,
          sheetName,
          rowNumber,
          reviewKey || null,
          'Rationale',
        ),
      )
    }
    if (reviewerDecision && REQUIRED_RATIONALE_DECISIONS.has(reviewerDecision) && !rawRationale) {
      rowIssues.push(
        issue(
          'error',
          'missing_required_rationale',
          'This reviewer decision requires a rationale.',
          sheetName,
          rowNumber,
          reviewKey || null,
          'Rationale',
        ),
      )
    } else if (reviewerDecision === 'approve_as_proposed' && !rawRationale) {
      rowIssues.push(
        issue(
          'warning',
          'missing_approval_rationale',
          'Approval was returned without a rationale; the blank is preserved for audit.',
          sheetName,
          rowNumber,
          reviewKey || null,
          'Rationale',
        ),
      )
    }
    for (const privacyCode of privacyCodes) {
      rowIssues.push(
        issue(
          'error',
          privacyCode,
          privacyCode === 'local_path_not_allowed'
            ? 'Reviewer input contains a local filesystem path.'
            : 'Reviewer input resembles patient-identifying data.',
          sheetName,
          rowNumber,
          reviewKey || null,
          'Rationale',
        ),
      )
    }

    issues.push(...rowIssues)
    if (!expected) continue
    const valid = !rowIssues.some((candidate) => candidate.severity === 'error')
    const safeRationale =
      privacyCodes.length > 0 ||
      cells.rationale.hasFormula ||
      rawRationale.length > MAX_REVIEW_TEXT_CHARACTERS
        ? ''
        : rawRationale
    if (sheetName === PRODUCT_SHEET) {
      const product = expected as ExternalReviewRemediationProductRow
      decisions.push({
        recordType: 'product_role',
        sourceSheet: sheetName,
        sourceRow: rowNumber,
        reviewKey: product.reviewKey,
        reviewCohort: product.reviewCohort,
        productId: product.productId,
        currentRoleCode: product.currentRoleCode,
        proposedRoleCode: product.proposedRoleCode,
        reviewerDecision,
        reviewerDecisionLabel,
        rationale: safeRationale,
        valid,
      })
    } else {
      const slot = expected as ExternalReviewRemediationSlotRow
      decisions.push({
        recordType: 'exact_slot',
        sourceSheet: sheetName,
        sourceRow: rowNumber,
        reviewKey: slot.reviewKey,
        reviewCohort: slot.reviewCohort,
        procedureCode: slot.procedureCode,
        slotId: slot.slotId,
        productId: slot.productId || null,
        currentRoleCode: slot.currentRoleCode,
        proposedRoleCode: slot.proposedRoleCode,
        reviewerDecision,
        reviewerDecisionLabel,
        rationale: safeRationale,
        valid,
      })
    }
  }

  return { decisions, issues }
}

function countBy<T extends string>(values: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

export async function normalizeExternalReviewRemediationWorkbook(
  bytes: Uint8Array,
  options: ExternalReviewRemediationImportOptions,
): Promise<ExternalReviewRemediationDecisionArtifact> {
  validateWorkbookFileName(options.fileName)
  const workbook = await parseOoxmlWorkbookBytes(bytes)
  if (
    workbook.sheetNames.length !== EXTERNAL_REVIEW_REMEDIATION_SHEETS.length ||
    workbook.sheetNames.some(
      (sheetName, index) => sheetName !== EXTERNAL_REVIEW_REMEDIATION_SHEETS[index],
    )
  ) {
    throw new Error(
      `Workbook sheets must exactly match: ${EXTERNAL_REVIEW_REMEDIATION_SHEETS.join(', ')}.`,
    )
  }

  const productWorksheet = requiredWorksheet(workbook.sheets, PRODUCT_SHEET)
  const slotWorksheet = requiredWorksheet(workbook.sheets, SLOT_SHEET)
  const lookupsWorksheet = requiredWorksheet(workbook.sheets, LOOKUPS_SHEET)
  validateStaticWorksheet(requiredWorksheet(workbook.sheets, 'Instructions'), 'Instructions')
  validateHeaders(productWorksheet, PRODUCT_SHEET, EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS)
  validateHeaders(slotWorksheet, SLOT_SHEET, EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS)
  const metadata = readWorkbookMetadata(lookupsWorksheet)
  const currentReviewData =
    options.currentReviewData ??
    getExternalReviewRemediationReviewData(metadata.application_base_url, metadata.locale)

  if (metadata.review_id !== currentReviewData.reviewId) {
    throw new Error(
      `Workbook review ID "${metadata.review_id}" does not match current review "${currentReviewData.reviewId}".`,
    )
  }
  if (
    metadata.normalized_corrections_sha256 !==
    currentReviewData.normalizedCorrectionsSha256.toLocaleLowerCase()
  ) {
    throw new Error('Workbook normalized corrections SHA-256 does not match current corrections.')
  }
  if (
    Number(metadata.product_review_count) !==
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows ||
    Number(metadata.exact_slot_review_count) !==
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows
  ) {
    throw new Error('Workbook metadata must declare exactly 63 product and 34 exact-slot rows.')
  }
  if (
    currentReviewData.productRows.length !==
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows ||
    currentReviewData.slotRows.length !==
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows
  ) {
    throw new Error('Current focused-remediation data does not contain the required 63/34 rows.')
  }

  const product = processReviewSheet(
    productWorksheet,
    PRODUCT_SHEET,
    EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS,
    currentReviewData.productRows,
  )
  const slot = processReviewSheet(
    slotWorksheet,
    SLOT_SHEET,
    EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS,
    currentReviewData.slotRows,
  )
  const issues = [...product.issues, ...slot.issues].sort(compareIssues)
  const decisions = [...product.decisions, ...slot.decisions].sort((left, right) =>
    left.reviewKey.localeCompare(right.reviewKey),
  )
  const errors = issues.filter((candidate) => candidate.severity === 'error').length
  const warnings = issues.length - errors
  const decisionCounts = countBy(
    decisions.flatMap((decision) => (decision.reviewerDecision ? [decision.reviewerDecision] : [])),
  )
  const decisionsByValue = Object.fromEntries(
    EXTERNAL_REVIEW_REMEDIATION_DECISION_VALUES.map((value) => [value, decisionCounts[value] ?? 0]),
  ) as Record<ExternalReviewRemediationDecisionValue, number>

  return {
    formatVersion: EXTERNAL_REVIEW_REMEDIATION_DECISION_FORMAT_VERSION,
    reviewId: currentReviewData.reviewId,
    normalizedCorrectionsSha256: currentReviewData.normalizedCorrectionsSha256.toLocaleLowerCase(),
    sourceWorkbook: {
      fileName: options.fileName,
      sha256: sha256Bytes(bytes),
      exportedAt: metadata.exported_at,
      applicationBaseUrl: metadata.application_base_url,
      locale: metadata.locale,
    },
    readyToApply:
      errors === 0 &&
      decisions.every((decision) => decision.valid && decision.reviewerDecision) &&
      decisions.length ===
        EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows +
          EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows,
    summary: {
      productReviewRows: product.decisions.length,
      exactSlotReviewRows: slot.decisions.length,
      normalizedDecisions: decisions.length,
      validDecisions: decisions.filter((decision) => decision.valid).length,
      invalidDecisions: decisions.filter((decision) => !decision.valid).length,
      errors,
      warnings,
      decisionsByValue,
      issuesByCode: countBy(issues.map((candidate) => candidate.code)),
    },
    issues,
    decisions,
  }
}

export function serializeExternalReviewRemediationDecisionArtifact(
  artifact: ExternalReviewRemediationDecisionArtifact,
): string {
  const serialized = JSON.stringify(artifact, null, 2)
  if (LOCAL_PATH_PATTERN.test(serialized)) {
    throw new Error('Normalized remediation artifacts must not contain local filesystem paths.')
  }
  if (PATIENT_LIKE_DATA_PATTERN.test(serialized)) {
    throw new Error('Normalized remediation artifacts must not contain patient-like data.')
  }
  return `${serialized}\n`
}
