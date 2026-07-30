import { TextDecoder as NodeTextDecoder } from 'node:util'

import JSZip from 'jszip'

import {
  DRESSING_SECUREMENT_SLOT_IDS,
  EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS,
  EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS,
  EXTERNAL_REVIEW_REMEDIATION_SHEETS,
  EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS,
  FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS,
  FOCUSED_DRAINAGE_UNIT_SLOT_IDS,
  OLYMPUS_180_PRODUCT_IDS,
  VIZISHOT_PRODUCT_ID,
  VIZISHOT_SLOT_IDS,
} from '@/features/preference-cards/excel/external-review-remediation-contract'
import { createExternalReviewRemediationWorkbook } from '@/features/preference-cards/excel/external-review-remediation-workbook.server'
import {
  parseOoxmlWorkbookBytes,
  type ParsedOoxmlWorksheet,
} from '@/features/preference-cards/excel/ooxml-reader.server'

Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  value: NodeTextDecoder,
})

const EXPORTED_AT = '2026-07-29T22:00:00.000Z'
const PRODUCT_WORKSHEET_PATH = 'xl/worksheets/sheet2.xml'
const SLOT_WORKSHEET_PATH = 'xl/worksheets/sheet3.xml'

function headerIndex(worksheet: ParsedOoxmlWorksheet, header: string): number {
  const headerRow = worksheet.rows.get(1)
  const match = [...(headerRow?.entries() ?? [])].find(([, cell]) => cell.value === header)
  if (!match) throw new Error(`Test helper could not find header "${header}".`)
  return match[0]
}

function valueAt(worksheet: ParsedOoxmlWorksheet, rowNumber: number, header: string): string {
  return worksheet.rows.get(rowNumber)?.get(headerIndex(worksheet, header))?.value ?? ''
}

function dataRows(worksheet: ParsedOoxmlWorksheet): number[] {
  return [...worksheet.rows.keys()].filter((rowNumber) => rowNumber > 1)
}

describe('focused external-review remediation workbook', () => {
  it('exports every bounded product, role, lifecycle, slot, ViziShot, and drainage row', async () => {
    const workbook = await createExternalReviewRemediationWorkbook(
      'https://example.test',
      'en',
      EXPORTED_AT,
    )
    const parsed = await parseOoxmlWorkbookBytes(workbook.bytes)
    const productSheet = parsed.sheets.get('Product Role Review')
    const slotSheet = parsed.sheets.get('Exact Slot Review')

    expect(parsed.sheetNames).toEqual(EXTERNAL_REVIEW_REMEDIATION_SHEETS)
    expect(productSheet?.maxRow).toBe(
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows + 1,
    )
    expect(slotSheet?.maxRow).toBe(
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows + 1,
    )

    const productRows = dataRows(productSheet!)
    const productIds = productRows.map((row) => valueAt(productSheet!, row, 'Product ID'))
    const productCohorts = productRows.map((row) => valueAt(productSheet!, row, 'Review Cohort'))
    expect(new Set(productIds).size).toBe(
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows,
    )
    expect(
      productIds.filter((productId) =>
        OLYMPUS_180_PRODUCT_IDS.includes(productId as (typeof OLYMPUS_180_PRODUCT_IDS)[number]),
      ),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.olympus180Products)
    expect(
      productCohorts.filter((cohort) => cohort === 'Original TBNA_NEEDLE cohort'),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.originalTbnaProducts)
    expect(
      productCohorts.filter((cohort) => cohort === 'Original GUIDING_DEVICE cohort'),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.originalGuidingDeviceProducts)
    expect(productIds).toEqual(expect.arrayContaining(['PRD-FDAC925AF1', 'PRD-58DE7D49C4']))
    for (const row of productRows.filter(
      (row) => valueAt(productSheet!, row, 'Review Cohort') === 'Original TBNA_NEEDLE cohort',
    )) {
      expect(valueAt(productSheet!, row, 'Current Role Code')).toBe('TBNA_NEEDLE')
    }
    for (const row of productRows.filter(
      (row) => valueAt(productSheet!, row, 'Review Cohort') === 'Original GUIDING_DEVICE cohort',
    )) {
      expect(valueAt(productSheet!, row, 'Current Role Code')).toBe('GUIDING_DEVICE')
    }

    const slotRows = dataRows(slotSheet!)
    const slotCohorts = slotRows.map((row) => valueAt(slotSheet!, row, 'Review Cohort'))
    expect(
      slotCohorts.filter((cohort) => cohort === 'Olympus 180 installed-base exact-slot policy'),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.scopeSlotPolicyRows)
    for (const row of slotRows.filter(
      (row) =>
        valueAt(slotSheet!, row, 'Review Cohort') ===
        'Olympus 180 installed-base exact-slot policy',
    )) {
      expect(valueAt(slotSheet!, row, 'Current State')).toBe(
        'No authored exact-slot option (pre-remediation external-review state).',
      )
    }
    expect(
      slotCohorts.filter((cohort) => cohort === 'Dressing and securement slot semantics'),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.dressingSecurementSlotRows)
    expect(
      slotCohorts.filter((cohort) => cohort === 'ViziShot hidden/default invariant'),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.viziShotSlotRows)
    expect(
      slotCohorts.filter((cohort) => cohort === 'Focused GENERIC_DRAINAGE_UNIT proposal subset'),
    ).toHaveLength(EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.focusedDrainageUnitSlotRows)

    const dressingRows = slotRows.filter((row) =>
      DRESSING_SECUREMENT_SLOT_IDS.includes(
        valueAt(slotSheet!, row, 'Slot ID') as (typeof DRESSING_SECUREMENT_SLOT_IDS)[number],
      ),
    )
    expect(dressingRows.map((row) => valueAt(slotSheet!, row, 'Slot ID')).sort()).toEqual(
      [...DRESSING_SECUREMENT_SLOT_IDS].sort(),
    )
    for (const row of dressingRows) {
      expect(valueAt(slotSheet!, row, 'Current Role Code')).toBe('GENERIC_SPECIMEN')
      expect(valueAt(slotSheet!, row, 'Proposed Role Code')).toBe('DRESSING_SECUREMENT')
    }

    const viziShotRows = slotRows.filter(
      (row) => valueAt(slotSheet!, row, 'Product ID') === VIZISHOT_PRODUCT_ID,
    )
    expect(viziShotRows.map((row) => valueAt(slotSheet!, row, 'Slot ID')).sort()).toEqual(
      [...VIZISHOT_SLOT_IDS].sort(),
    )
    for (const row of viziShotRows) {
      expect(valueAt(slotSheet!, row, 'Current State')).toContain('visible_by_default=Yes')
      expect(valueAt(slotSheet!, row, 'Current State')).toContain('selectable=No')
      expect(valueAt(slotSheet!, row, 'Proposed State')).toContain('visible_by_default=No')
      expect(valueAt(slotSheet!, row, 'Proposed State')).toContain('selectable=No')
    }

    const drainageRows = slotRows.filter(
      (row) =>
        valueAt(slotSheet!, row, 'Review Cohort') ===
        'Focused GENERIC_DRAINAGE_UNIT proposal subset',
    )
    for (const productId of FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS) {
      expect(
        drainageRows.filter((row) => valueAt(slotSheet!, row, 'Product ID') === productId),
      ).toHaveLength(FOCUSED_DRAINAGE_UNIT_SLOT_IDS.length)
    }
    for (const slotId of FOCUSED_DRAINAGE_UNIT_SLOT_IDS) {
      expect(
        drainageRows.filter((row) => valueAt(slotSheet!, row, 'Slot ID') === slotId),
      ).toHaveLength(FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS.length)
    }
    for (const row of drainageRows) {
      expect(valueAt(slotSheet!, row, 'Current State')).toContain('proposal_status=unreviewed')
      expect(valueAt(slotSheet!, row, 'Current State')).toContain('selectable=No')
      expect(valueAt(slotSheet!, row, 'Proposed State')).toContain('recommendation_only=Yes')
    }
  })

  it('keeps required columns, identifiers as text, and every reviewer cell blank', async () => {
    const workbook = await createExternalReviewRemediationWorkbook(
      'https://example.test',
      'en',
      EXPORTED_AT,
    )
    const parsed = await parseOoxmlWorkbookBytes(workbook.bytes)
    const productSheet = parsed.sheets.get('Product Role Review')!
    const slotSheet = parsed.sheets.get('Exact Slot Review')!
    const requiredHeaders = [
      'Current State',
      'Proposed State',
      'Reason',
      'Lifecycle Context',
      'Slotting Scope',
      'Role Decision',
      'Exact-slot Decision',
      'Reviewer Decision',
      'Rationale',
    ]

    for (const sheet of [productSheet, slotSheet]) {
      for (const header of requiredHeaders) {
        expect(headerIndex(sheet, header)).toBeGreaterThan(0)
      }
      for (const rowNumber of dataRows(sheet)) {
        expect(valueAt(sheet, rowNumber, 'Reviewer Decision')).toBe('')
        expect(valueAt(sheet, rowNumber, 'Rationale')).toBe('')
      }
    }

    for (const [index, column] of EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS.entries()) {
      if (!('identifier' in column) || !column.identifier) continue
      for (const rowNumber of dataRows(productSheet)) {
        expect(productSheet.rows.get(rowNumber)?.get(index + 1)?.type).toBe('inlineStr')
      }
    }
    for (const [index, column] of EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS.entries()) {
      if (!('identifier' in column) || !column.identifier) continue
      for (const rowNumber of dataRows(slotSheet)) {
        expect(slotSheet.rows.get(rowNumber)?.get(index + 1)?.type).toBe('inlineStr')
      }
    }
  })

  it('adds filters, frozen panes, protected references, and reviewer dropdowns to both review sheets', async () => {
    const workbook = await createExternalReviewRemediationWorkbook(
      'https://example.test',
      'en',
      EXPORTED_AT,
    )
    const zip = await JSZip.loadAsync(workbook.bytes)
    const [productXml, slotXml, stylesXml] = await Promise.all([
      zip.file(PRODUCT_WORKSHEET_PATH)!.async('string'),
      zip.file(SLOT_WORKSHEET_PATH)!.async('string'),
      zip.file('xl/styles.xml')!.async('string'),
    ])

    for (const worksheetXml of [productXml, slotXml]) {
      expect(worksheetXml).toContain('<autoFilter ref=')
      expect(worksheetXml).toContain('state="frozen"')
      expect(worksheetXml).toContain('<sheetProtection ')
      expect(worksheetXml).toContain('<dataValidations count="1">')
      expect(worksheetXml).toContain('<formula1>ReviewerDecisionOptions</formula1>')
    }
    expect(stylesXml).toContain('<protection locked="0"/>')
    expect(
      Object.keys(zip.files).some((name) => /vbaProject|externalLinks|\.bin$/i.test(name)),
    ).toBe(false)
  })
})
