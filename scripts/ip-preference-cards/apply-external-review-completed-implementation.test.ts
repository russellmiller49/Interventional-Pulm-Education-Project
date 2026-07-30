import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import type { ExternalReviewRemediationDecisionArtifact } from '@/features/preference-cards/excel/external-review-remediation-import.server'

import type { CatalogRecord } from './catalog-utils'
import {
  applyExternalReviewCompletedImplementation,
  readExternalReviewCompletedImplementation,
  readExternalReviewRemediationDecisionArtifact,
  type ExternalReviewCompletedImplementationFile,
} from './apply-external-review-completed-implementation'

const execFileAsync = promisify(execFile)
let proposalRemediatedBaseline: Record<string, CatalogRecord[]> | null = null
let temporaryOutputDirectory: string | null = null

beforeAll(async () => {
  temporaryOutputDirectory = await mkdtemp(
    path.join(tmpdir(), 'ip-cards-completed-external-review-baseline-'),
  )
  const script = [
    "import { importCatalog } from './scripts/ip-preference-cards/import-catalog.ts'",
    `(async () => { await importCatalog({ outputDirectory: ${JSON.stringify(temporaryOutputDirectory)}, applyCompletedExternalReview: false }) })().catch((error) => { console.error(error); process.exitCode = 1 })`,
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
    manufacturers,
    sources,
    productSources,
  ] = await Promise.all([
    readGenerated('catalog-products.json'),
    readGenerated('product-roles.json'),
    readGenerated('procedure-slots.json'),
    readGenerated('slot-product-options.json'),
    readGenerated('roles.json'),
    readGenerated('compatibility-raw.json'),
    readGenerated('manufacturers.json'),
    readGenerated('sources.json'),
    readGenerated('product-sources.json'),
  ])
  proposalRemediatedBaseline = {
    Products: products,
    Product_Roles: productRoles,
    Procedure_Slots: procedureSlots,
    Slot_Product_Options: slotProductOptions,
    Roles: roles,
    Compatibility: compatibility,
    Manufacturers: manufacturers,
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

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

async function loadInputs(): Promise<{
  normalized: Record<string, CatalogRecord[]>
  implementation: ExternalReviewCompletedImplementationFile
  decisions: ExternalReviewRemediationDecisionArtifact
}> {
  if (!proposalRemediatedBaseline) {
    throw new Error('Proposal-remediated catalog baseline was not initialized.')
  }
  const [implementation, decisions] = await Promise.all([
    readExternalReviewCompletedImplementation(),
    readExternalReviewRemediationDecisionArtifact(),
  ])
  if (!implementation || !decisions) {
    throw new Error('Completed external-review artifacts were not initialized.')
  }
  return {
    normalized: clone(proposalRemediatedBaseline),
    implementation: clone(implementation),
    decisions: clone(decisions),
  }
}

describe('completed external-review implementation', () => {
  it('applies every compiled reviewer delta with exact report counts', async () => {
    const { normalized, implementation, decisions } = await loadInputs()
    const before = clone(normalized)

    const report = applyExternalReviewCompletedImplementation(normalized, implementation, decisions)

    expect(report).toMatchObject({
      applied: true,
      implementation_id: 'external-review-remediation-v0.1-completed',
      review_id: 'external-review-remediation-v0.1',
      adds: {
        roles: 5,
        product_roles: 1,
        slot_product_options: 18,
        compatibility_rules: 7,
      },
      removes: {
        slot_product_options: 4,
      },
      updates: {
        product_roles: 6,
      },
      verified_absent_slot_product_options: 4,
      decision_evidence: {
        referenced_review_keys: 24,
        normalized_decisions: 97,
        errors: 0,
        warnings: 6,
      },
      errors: [],
    })
    expect(normalized.Roles).toHaveLength(before.Roles.length + 5)
    expect(normalized.Product_Roles).toHaveLength(before.Product_Roles.length + 1)
    expect(normalized.Slot_Product_Options).toHaveLength(
      before.Slot_Product_Options.length - 4 + 18,
    )
    expect(normalized.Compatibility).toHaveLength(before.Compatibility.length + 7)
  })

  it('implements the reviewer-specific role taxonomy without weakening the approved BF-P180 slot', async () => {
    const { normalized, implementation, decisions } = await loadInputs()

    expect(
      applyExternalReviewCompletedImplementation(normalized, implementation, decisions).applied,
    ).toBe(true)

    const rolesFor = (productId: string) =>
      normalized.Product_Roles.filter((row) => row.product_id === productId).map((row) => ({
        roleCode: String(row.role_code),
        roleFit: row.role_fit,
      }))

    expect(rolesFor('PRD-57DAB5ECAE')).toEqual(
      expect.arrayContaining([
        { roleCode: 'FLEX_SCOPE_THIN', roleFit: 'Primary' },
        { roleCode: 'FLEX_SCOPE_DIAGNOSTIC', roleFit: 'Compatible' },
      ]),
    )
    expect(
      normalized.Slot_Product_Options.find(
        (option) => option.slot_id === 'SLOT-34A46FFBA2' && option.product_id === 'PRD-57DAB5ECAE',
      ),
    ).toMatchObject({
      role_code: 'FLEX_SCOPE_DIAGNOSTIC',
      visible_by_default: false,
      selectable: true,
      review_status: 'reviewed',
      slotting_scope: 'installed_base',
    })

    expect(rolesFor('PRD-2F1A67DE53')).toContainEqual({
      roleCode: 'RIGID_BRONCH_ASPIRATION_BIOPSY_NEEDLE',
      roleFit: 'Exact',
    })
    expect(rolesFor('PRD-934DA56D92')).toContainEqual({
      roleCode: 'RIGID_BRONCH_PUNCTURE_NEEDLE',
      roleFit: 'Exact',
    })
    expect(rolesFor('PRD-DF989CBDCB')).toContainEqual({
      roleCode: 'RIGID_BRONCH_ASPIRATION_BIOPSY_NEEDLE',
      roleFit: 'Exact',
    })
    expect(rolesFor('PRD-48C48C68BA')).toContainEqual({
      roleCode: 'ROBOTIC_CATHETER',
      roleFit: 'Primary',
    })
    expect(rolesFor('PRD-FDAC925AF1')).toContainEqual({
      roleCode: 'ENDOSCOPY_PROCESSOR_MOUNT_ACCESSORY',
      roleFit: 'Primary',
    })

    const excludedProducts = [
      'PRD-2F1A67DE53',
      'PRD-934DA56D92',
      'PRD-DF989CBDCB',
      'PRD-48C48C68BA',
      'PRD-FDAC925AF1',
    ]
    expect(
      normalized.Slot_Product_Options.filter((option) =>
        excludedProducts.includes(String(option.product_id)),
      ).filter((option) =>
        [
          'SLOT-9363E589C4',
          'SLOT-09EF760638',
          'SLOT-763A2D63F1',
          'SLOT-B6ED05FBC7',
          'SLOT-BC6864D752',
          'SLOT-DD40010751',
        ].includes(String(option.slot_id)),
      ),
    ).toHaveLength(0)
  })

  it('authors exactly the 18 reviewed, selectable, non-default drainage options', async () => {
    const { normalized, implementation, decisions } = await loadInputs()
    const beforePairs = new Set(
      normalized.Slot_Product_Options.map(
        (option) => `${String(option.slot_id)}\u0000${String(option.product_id)}`,
      ),
    )

    expect(
      applyExternalReviewCompletedImplementation(normalized, implementation, decisions).applied,
    ).toBe(true)

    const added = normalized.Slot_Product_Options.filter(
      (option) => !beforePairs.has(`${String(option.slot_id)}\u0000${String(option.product_id)}`),
    )
    expect(added).toHaveLength(18)
    expect(new Set(added.map((option) => option.slot_id))).toEqual(
      new Set(['SLOT-022D0D3DC6', 'SLOT-3631C94D7A', 'SLOT-AA3C2EAA6D']),
    )
    expect(new Set(added.map((option) => option.product_id))).toEqual(
      new Set([
        'PRD-2F1DF55F3C',
        'PRD-94C61697D9',
        'PRD-A31173136E',
        'PRD-9336231788',
        'PRD-925F0C99C6',
        'PRD-8CBA34433F',
      ]),
    )
    for (const option of added) {
      expect(option).toMatchObject({
        role_code: 'GENERIC_DRAINAGE_UNIT',
        visible_by_default: false,
        selectable: true,
        review_status: 'reviewed',
        slotting_scope: 'standard',
      })
      expect(Object.prototype.hasOwnProperty.call(option, 'preferred')).toBe(false)
    }
    expect(
      normalized.Products.find((product) => product.product_id === 'PRD-8CBA34433F'),
    ).toMatchObject({
      adult_peds: 'Pediatric',
      visibility_state: 'prototype_visible',
    })
  })

  it('adds the exact reviewer-requested product compatibility relationships', async () => {
    const { normalized, implementation, decisions } = await loadInputs()

    expect(
      applyExternalReviewCompletedImplementation(normalized, implementation, decisions).applied,
    ).toBe(true)

    const relationships = normalized.Compatibility.filter((rule) =>
      [
        'CMP-96CEB218E5',
        'CMP-239F37772D',
        'CMP-3712F5462E',
        'CMP-B102667F8B',
        'CMP-D28A978526',
        'CMP-E56428C687',
        'CMP-6DCB3DAE38',
      ].includes(String(rule.rule_id)),
    )
    expect(relationships).toHaveLength(7)
    expect(sorted(relationships.map((rule) => String(rule.target_product_or_role)))).toEqual(
      sorted([
        'PRD-1C70287572',
        'PRD-EC45CB0F5D',
        'PRD-6707AC67D1',
        'PRD-D273A067EA',
        'PRD-5D0F775ADC',
        'PRD-DF917ECDBF',
        'PRD-9BB524F077',
      ]),
    )
    for (const relationship of relationships) {
      expect(relationship).toMatchObject({
        resolved_source_type: 'product',
        resolved_target_type: 'product',
        verification_grade: 'verified_source',
      })
    }
  })

  it('preserves source catalog products, manufacturers, sources, and product provenance', async () => {
    const { normalized, implementation, decisions } = await loadInputs()
    const preserved = {
      Products: clone(normalized.Products),
      Manufacturers: clone(normalized.Manufacturers),
      Sources: clone(normalized.Sources),
      Product_Sources: clone(normalized.Product_Sources),
      Procedure_Slots: clone(normalized.Procedure_Slots),
    }

    expect(
      applyExternalReviewCompletedImplementation(normalized, implementation, decisions).applied,
    ).toBe(true)

    expect(normalized.Products).toEqual(preserved.Products)
    expect(normalized.Manufacturers).toEqual(preserved.Manufacturers)
    expect(normalized.Sources).toEqual(preserved.Sources)
    expect(normalized.Product_Sources).toEqual(preserved.Product_Sources)
    expect(normalized.Procedure_Slots).toEqual(preserved.Procedure_Slots)
  })

  it('binds the implementation to the immutable proposal hash and completed decision artifact', async () => {
    const { normalized, implementation, decisions } = await loadInputs()
    const corrections = JSON.parse(
      await readFile(
        path.join(
          process.cwd(),
          'data/ip-preference-cards/reviewed/external-review-corrections.json',
        ),
        'utf8',
      ),
    ) as unknown
    expect(createHash('sha256').update(JSON.stringify(corrections)).digest('hex')).toBe(
      implementation.proposalCorrectionsSha256,
    )
    expect(decisions.normalizedCorrectionsSha256).toBe(implementation.proposalCorrectionsSha256)
    expect(decisions.sourceWorkbook.sha256).toBe(implementation.sourceWorkbookSha256)

    decisions.readyToApply = false
    const before = clone(normalized)
    const report = applyExternalReviewCompletedImplementation(normalized, implementation, decisions)
    expect(report.applied).toBe(false)
    expect(report.errors.join('\n')).toContain('is not ready to apply')
    expect(normalized).toEqual(before)
  })

  it('fails closed and leaves all arrays unchanged when an old-state guard drifts', async () => {
    const { normalized, implementation, decisions } = await loadInputs()
    const ionRole = normalized.Product_Roles.find(
      (role) => role.product_id === 'PRD-48C48C68BA' && role.role_code === 'NAV_CATHETER_GUIDE',
    )!
    ionRole.role_fit = 'Compatible'
    const before = clone(normalized)

    const report = applyExternalReviewCompletedImplementation(normalized, implementation, decisions)

    expect(report.applied).toBe(false)
    expect(report.errors.join('\n')).toContain('expected role_fit Primary')
    expect(normalized).toEqual(before)
  })

  it('is deterministic for identical governed inputs', async () => {
    const { normalized, implementation, decisions } = await loadInputs()
    const left = clone(normalized)
    const right = clone(normalized)

    const leftReport = applyExternalReviewCompletedImplementation(
      left,
      clone(implementation),
      clone(decisions),
    )
    const rightReport = applyExternalReviewCompletedImplementation(
      right,
      clone(implementation),
      clone(decisions),
    )

    expect(leftReport).toEqual(rightReport)
    expect(left).toEqual(right)
  })
})
