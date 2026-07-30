import path from 'node:path'

import {
  loadOoxmlWorkbook,
  normalizeExcelDate,
  normalizeGtin,
  normalizeSelectionMode,
  normalizeSlotOptionVisibility,
  normalizeVisibility,
  readTabularSheet,
} from './catalog-utils'

const workbookPath = path.resolve(
  process.cwd(),
  'Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx',
)

describe('IP preference-card catalog import utilities', () => {
  let workbook: Awaited<ReturnType<typeof loadOoxmlWorkbook>>

  beforeAll(async () => {
    workbook = await loadOoxmlWorkbook(workbookPath)
  })

  it('recognizes headers on Excel row 4 and skips title rows', () => {
    const products = readTabularSheet(workbook, 'Products')
    expect(products.headers.slice(0, 4)).toEqual([
      'product_id',
      'manufacturer_id',
      'manufacturer',
      'distributor',
    ])
    expect(products.records).toHaveLength(1221)
    expect(products.records[0].product_id).toMatch(/^PRD-/)
  })

  it('preserves exact workbook identifiers and leading-zero catalog numbers', () => {
    const products = readTabularSheet(workbook, 'Products').records
    const leadingZeroCatalog = products.find((record) => record.catalog_number === '02841S')
    expect(leadingZeroCatalog).toMatchObject({
      product_id: 'PRD-7C4A3CE094',
      catalog_number: '02841S',
    })
  })

  it('round-trips the known EBUS FNB GTIN as text', () => {
    const products = readTabularSheet(workbook, 'Products').records
    const product = products.find((record) => record.product_id === 'PRD-EB513BCB63')
    expect(product?.gtin).toBe('08714729986225')
    expect(normalizeGtin(product?.gtin).normalized).toBe('08714729986225')
  })

  it('zero-pads 13-digit GTINs and flags invalid lengths without truncation', () => {
    expect(normalizeGtin('8714729986225')).toEqual({
      raw: '8714729986225',
      normalized: '08714729986225',
      warning: null,
    })
    expect(normalizeGtin('1234567890123456')).toEqual({
      raw: '1234567890123456',
      normalized: '1234567890123456',
      warning: 'GTIN "1234567890123456" does not normalize to exactly 14 digits.',
    })
  })

  it('converts Excel date serials while preserving year-only source dates', () => {
    expect(normalizeExcelDate('45567')).toBe('2024-10-02')
    expect(normalizeExcelDate('2025')).toBe('2025')
    expect(normalizeExcelDate('2025-07-25')).toBe('2025-07-25')
  })

  it('normalizes both single-selection spellings', () => {
    expect(normalizeSelectionMode('Single')).toBe('single')
    expect(normalizeSelectionMode('Single select')).toBe('single')
    expect(normalizeSelectionMode('Multiple')).toBe('multiple')
  })

  it('fails closed for unrecognized visibility text', () => {
    expect(normalizeVisibility('Unknown new status')).toBe('hidden')
    expect(normalizeVisibility('Prototype visible - reverify before production')).toBe(
      'prototype_visible',
    )
  })

  it.each([
    ['prototype_visible', false, false, false, false, false],
    ['prototype_visible', false, true, false, true, false],
    ['prototype_visible', true, false, false, false, true],
    ['prototype_visible', true, true, true, true, false],
    ['hidden', false, false, false, false, false],
    ['hidden', false, true, false, false, true],
    ['hidden', true, false, false, false, true],
    ['hidden', true, true, false, false, true],
  ] as const)(
    'normalizes slot visibility for %s with authored default %s and selectability %s',
    (
      productVisibility,
      authoredDefault,
      authoredSelectable,
      visibleByDefault,
      selectable,
      conflict,
    ) => {
      expect(
        normalizeSlotOptionVisibility(productVisibility, authoredDefault, authoredSelectable),
      ).toEqual({
        productVisibility,
        visibleByDefault,
        selectable,
        authoredVisibilityConflict: conflict,
      })
    },
  )

  it('preserves unresolved compatibility strings as raw evidence', () => {
    const compatibility = readTabularSheet(workbook, 'Compatibility').records
    expect(compatibility.some((record) => record.target_product_or_role === 'ERBE APC/VIO')).toBe(
      true,
    )
    expect(compatibility).toHaveLength(179)
  })
})
