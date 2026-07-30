import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import type { CatalogRecord } from './catalog-utils'
import {
  applyExternalReviewRemediation,
  readExternalReviewCorrections,
  type ExternalReviewCorrectionsFile,
} from './apply-external-review-remediation'

const execFileAsync = promisify(execFile)
let preRemediationBaseline: Record<string, CatalogRecord[]> | null = null
let temporaryOutputDirectory: string | null = null

beforeAll(async () => {
  temporaryOutputDirectory = await mkdtemp(
    path.join(tmpdir(), 'ip-cards-external-review-baseline-'),
  )
  const script = [
    "import { importCatalog } from './scripts/ip-preference-cards/import-catalog.ts'",
    `(async () => { await importCatalog({ outputDirectory: ${JSON.stringify(temporaryOutputDirectory)}, applyExternalReview: false }) })().catch((error) => { console.error(error); process.exitCode = 1 })`,
  ].join('; ')
  await execFileAsync(path.join(process.cwd(), 'node_modules/.bin/tsx'), ['-e', script], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  })

  const readGenerated = async (filename: string): Promise<CatalogRecord[]> =>
    JSON.parse(
      await readFile(path.join(temporaryOutputDirectory!, filename), 'utf8'),
    ) as CatalogRecord[]
  const [
    products,
    productRoles,
    procedureSlots,
    slotProductOptions,
    roles,
    compatibility,
    sources,
    productSources,
  ] = await Promise.all([
    readGenerated('catalog-products.json'),
    readGenerated('product-roles.json'),
    readGenerated('procedure-slots.json'),
    readGenerated('slot-product-options.json'),
    readGenerated('roles.json'),
    readGenerated('compatibility-raw.json'),
    readGenerated('sources.json'),
    readGenerated('product-sources.json'),
  ])
  preRemediationBaseline = {
    Products: products,
    Product_Roles: productRoles,
    Procedure_Slots: procedureSlots,
    Slot_Product_Options: slotProductOptions,
    Roles: roles,
    Compatibility: compatibility,
    Sources: sources,
    Product_Sources: productSources,
  }
}, 120_000)

afterAll(async () => {
  if (temporaryOutputDirectory) {
    await rm(temporaryOutputDirectory, { recursive: true, force: true })
  }
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function loadBaseline(): Promise<Record<string, CatalogRecord[]>> {
  if (!preRemediationBaseline) {
    throw new Error('Pre-remediation catalog baseline was not initialized.')
  }
  return clone(preRemediationBaseline)
}

function stringField(record: CatalogRecord, field: string): string {
  return String(record[field])
}

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function changedProductRoles(corrections: ExternalReviewCorrectionsFile): {
  productId: string
  expectRoleCode: string
  setRoleCode: string
}[] {
  return [
    ...corrections.productRoleSplits.flatMap((split) =>
      split.groups.flatMap((group) =>
        group.productIds.map((productId) => ({
          productId,
          expectRoleCode: split.expectRoleCode,
          setRoleCode: group.setRoleCode,
        })),
      ),
    ),
    ...corrections.productRoleReclassifications,
  ]
}

describe('external-review catalog remediation', () => {
  it('applies every governed correction with exact report counts', async () => {
    const corrections = await readExternalReviewCorrections()
    expect(corrections).not.toBeNull()
    const baseline = await loadBaseline()
    const normalized = clone(baseline)

    const report = applyExternalReviewRemediation(normalized, corrections)

    expect(report).toMatchObject({
      applied: true,
      review_id: 'external-review-remediation-v0.1',
      adds: {
        roles: 13,
        slot_product_options: 10,
        compatibility_rules: 1,
      },
      removes: {
        slot_product_options: 31,
      },
      updates: {
        product_roles: 57,
        procedure_slots: 6,
        slot_product_options: 13,
      },
      product_governance_entries: 6,
      deprecated_role_aliases_preserved: 2,
      errors: [],
    })
    expect(normalized.Roles).toHaveLength(baseline.Roles.length + 13)
    expect(normalized.Product_Roles).toHaveLength(baseline.Product_Roles.length)
    expect(normalized.Procedure_Slots).toHaveLength(baseline.Procedure_Slots.length)
    expect(normalized.Slot_Product_Options).toHaveLength(
      baseline.Slot_Product_Options.length - 31 + 10,
    )
    expect(normalized.Compatibility).toHaveLength(baseline.Compatibility.length + 1)
    expect(report.details.added_roles).toHaveLength(report.adds.roles)
    expect(report.details.added_slot_product_options).toHaveLength(report.adds.slot_product_options)
    expect(report.details.removed_slot_product_options).toHaveLength(
      report.removes.slot_product_options,
    )
    expect(report.details.updated_product_roles).toHaveLength(report.updates.product_roles)
  })

  it('creates the exact TBNA and guiding-device role splits without bulk slotting children', async () => {
    const corrections = (await readExternalReviewCorrections())!
    const normalized = await loadBaseline()

    expect(applyExternalReviewRemediation(normalized, corrections).applied).toBe(true)

    for (const split of corrections.productRoleSplits) {
      const splitProductIds = new Set(split.groups.flatMap((group) => group.productIds))
      expect(
        normalized.Product_Roles.filter((record) => record.role_code === split.expectRoleCode),
      ).toHaveLength(0)
      for (const group of split.groups) {
        const actual = normalized.Product_Roles.filter(
          (record) =>
            record.role_code === group.setRoleCode &&
            splitProductIds.has(stringField(record, 'product_id')),
        ).map((record) => stringField(record, 'product_id'))
        expect(sorted(actual)).toEqual(sorted(group.productIds))
      }
    }

    const guidingSplit = corrections.productRoleSplits.find(
      (split) => split.expectRoleCode === 'GUIDING_DEVICE',
    )!
    expect(new Set(guidingSplit.groups.map((group) => group.setRoleCode)).size).toBe(8)

    const conventionalIds = corrections.productRoleSplits
      .find((split) => split.expectRoleCode === 'TBNA_NEEDLE')!
      .groups.find((group) => group.setRoleCode === 'TBNA_NEEDLE_CONVENTIONAL')!.productIds
    const conventionalOptions = normalized.Slot_Product_Options.filter(
      (option) => option.slot_id === 'SLOT-9363E589C4',
    )
    expect(sorted(conventionalOptions.map((option) => stringField(option, 'product_id')))).toEqual(
      sorted(conventionalIds),
    )
    expect(new Set(conventionalOptions.map((option) => option.role_code))).toEqual(
      new Set(['TBNA_NEEDLE_CONVENTIONAL']),
    )

    const disposableGuideOptions = normalized.Slot_Product_Options.filter(
      (option) => option.slot_id === 'SLOT-09EF760638',
    )
    expect(
      sorted(disposableGuideOptions.map((option) => stringField(option, 'product_id'))),
    ).toEqual(['PRD-48C48C68BA', 'PRD-707B8A1974'])
    expect(new Set(disposableGuideOptions.map((option) => option.role_code))).toEqual(
      new Set(['NAV_CATHETER_GUIDE']),
    )

    const capitalProductIds = new Set(
      normalized.Products.filter((product) =>
        String(product.product_kind ?? '')
          .toLowerCase()
          .includes('capital'),
      ).map((product) => stringField(product, 'product_id')),
    )
    expect(
      disposableGuideOptions.some((option) =>
        capitalProductIds.has(stringField(option, 'product_id')),
      ),
    ).toBe(false)
    expect(disposableGuideOptions.some((option) => option.product_id === 'PRD-29E98A6ED6')).toBe(
      false,
    )
  })

  it('separates Hot biopsy forceps, Scivita platform hardware, and dressing slots', async () => {
    const corrections = (await readExternalReviewCorrections())!
    const normalized = await loadBaseline()

    expect(applyExternalReviewRemediation(normalized, corrections).applied).toBe(true)

    expect(
      normalized.Product_Roles.find((record) => record.product_id === 'PRD-58DE7D49C4')?.role_code,
    ).toBe('BIOPSY_FORCEPS_ENERGY_ENABLED')
    expect(
      normalized.Slot_Product_Options.filter((option) => option.product_id === 'PRD-58DE7D49C4'),
    ).toHaveLength(0)
    expect(
      normalized.Compatibility.find((rule) => rule.rule_id === 'CMP-58DE7D49C4'),
    ).toMatchObject({
      source_product_or_role: 'PRD-58DE7D49C4',
      target_product_or_role: 'GENERIC_ENERGY_PLATFORM',
      resolved_source_type: 'product',
      resolved_target_type: 'role',
      verification_grade: 'candidate',
    })

    expect(
      normalized.Product_Roles.find((record) => record.product_id === 'PRD-FDAC925AF1')?.role_code,
    ).toBe('NAV_PLATFORM_ACCESSORY')
    expect(
      normalized.Slot_Product_Options.filter((option) => option.product_id === 'PRD-FDAC925AF1'),
    ).toHaveLength(0)

    const dressingSlotIds = [
      'SLOT-01010CB364',
      'SLOT-126F71E1BD',
      'SLOT-23A6DA3B89',
      'SLOT-4BE1D79D6C',
    ]
    expect(
      normalized.Procedure_Slots.filter((slot) =>
        dressingSlotIds.includes(stringField(slot, 'slot_id')),
      ).map((slot) => ({ roleCode: slot.role_code, allowCustom: slot.allow_custom })),
    ).toEqual([
      { roleCode: 'DRESSING_SECUREMENT', allowCustom: true },
      { roleCode: 'DRESSING_SECUREMENT', allowCustom: true },
      { roleCode: 'DRESSING_SECUREMENT', allowCustom: true },
      { roleCode: 'DRESSING_SECUREMENT', allowCustom: true },
    ])
  })

  it('adds only reviewed, nonpreferred Olympus installed-base exact options', async () => {
    const corrections = (await readExternalReviewCorrections())!
    const baseline = await loadBaseline()
    const normalized = clone(baseline)

    expect(applyExternalReviewRemediation(normalized, corrections).applied).toBe(true)

    expect(corrections.productGovernance).toHaveLength(6)
    for (const entry of corrections.productGovernance) {
      expect(sorted(Object.keys(entry))).toEqual(
        sorted([
          'productId',
          'catalogLifecycleContext',
          'slottingScope',
          'preferredNewPurchase',
          'installedBaseExactSlotIds',
          'lifecycleNote',
        ]),
      )
      expect(entry).toMatchObject({
        catalogLifecycleContext: 'legacy_active_installed_base',
        slottingScope: 'installed_base',
        preferredNewPurchase: false,
      })
    }

    const governedProductIds = new Set(
      corrections.productGovernance.map((entry) => entry.productId),
    )
    const baselinePairs = new Set(
      baseline.Slot_Product_Options.map((option) =>
        [stringField(option, 'slot_id'), stringField(option, 'product_id')].join('\u0000'),
      ),
    )
    const installedBaseOptions = normalized.Slot_Product_Options.filter(
      (option) =>
        governedProductIds.has(stringField(option, 'product_id')) &&
        !baselinePairs.has(
          [stringField(option, 'slot_id'), stringField(option, 'product_id')].join('\u0000'),
        ),
    )
    const governedPairs = corrections.productGovernance.flatMap((entry) =>
      entry.installedBaseExactSlotIds.map((slotId) => `${slotId}\u0000${entry.productId}`),
    )
    expect(
      sorted(
        installedBaseOptions.map(
          (option) => `${String(option.slot_id)}\u0000${String(option.product_id)}`,
        ),
      ),
    ).toEqual(sorted(governedPairs))
    expect(installedBaseOptions).toHaveLength(10)
    for (const option of installedBaseOptions) {
      expect(option).toMatchObject({
        visible_by_default: false,
        selectable: true,
        review_status: 'reviewed',
        slotting_scope: 'installed_base',
      })
      expect(Object.prototype.hasOwnProperty.call(option, 'preferred')).toBe(false)
    }
  })

  it('preserves product identifiers, provenance, and all non-role Product_Roles fields', async () => {
    const corrections = (await readExternalReviewCorrections())!
    const baseline = await loadBaseline()
    const normalized = clone(baseline)
    const productsBefore = clone(baseline.Products)
    const productSourcesBefore = clone(baseline.Product_Sources)

    expect(applyExternalReviewRemediation(normalized, corrections).applied).toBe(true)

    expect(normalized.Products).toEqual(productsBefore)
    expect(normalized.Product_Sources).toEqual(productSourcesBefore)
    expect(
      sorted(normalized.Products.map((product) => stringField(product, 'product_id'))),
    ).toEqual(sorted(productsBefore.map((product) => stringField(product, 'product_id'))))

    for (const change of changedProductRoles(corrections)) {
      const before = baseline.Product_Roles.find(
        (record) =>
          record.product_id === change.productId && record.role_code === change.expectRoleCode,
      )!
      const after = normalized.Product_Roles.find(
        (record) =>
          record.product_id === change.productId && record.role_code === change.setRoleCode,
      )!
      expect({ ...after, role_code: change.expectRoleCode }).toEqual(before)
    }

    for (const alias of corrections.deprecatedRoleAliases) {
      expect(normalized.Roles.some((role) => role.role_code === alias.roleCode)).toBe(true)
    }
  })

  it('fails closed and leaves every input array unchanged when an old-state guard drifts', async () => {
    const corrections = (await readExternalReviewCorrections())!
    const normalized = await loadBaseline()
    const drifted = normalized.Product_Roles.find(
      (record) => record.product_id === 'PRD-DCF0AFE654' && record.role_code === 'TBNA_NEEDLE',
    )!
    drifted.role_code = 'UNEXPECTED_REFRESH_ROLE'
    const before = clone(normalized)

    const report = applyExternalReviewRemediation(normalized, corrections)

    expect(report.applied).toBe(false)
    expect(report.errors.join('\n')).toContain('Product_Roles cohort TBNA_NEEDLE')
    expect(report.adds.roles).toBe(0)
    expect(report.removes.slot_product_options).toBe(0)
    expect(report.updates.product_roles).toBe(0)
    expect(normalized).toEqual(before)
  })

  it('is deterministic for identical governed inputs', async () => {
    const corrections = (await readExternalReviewCorrections())!
    const baseline = await loadBaseline()
    const left = clone(baseline)
    const right = clone(baseline)

    const leftReport = applyExternalReviewRemediation(left, corrections)
    const rightReport = applyExternalReviewRemediation(right, corrections)

    expect(leftReport).toEqual(rightReport)
    expect(left).toEqual(right)
  })
})
