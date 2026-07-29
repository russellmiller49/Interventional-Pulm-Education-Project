import {
  getClinicalUseReviewArtifactManifest,
  getClinicalUseReviewCounts,
  getClinicalUseReviewData,
} from '@/features/preference-cards/data/clinical-use-review.server'
import {
  CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION,
  CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
  clinicalUseProductRoleKey,
  clinicalUseSlotProductKey,
  type ClinicalUseReviewImportPreview,
} from '@/features/preference-cards/excel/clinical-use-review-contract'
import {
  clinicalUseReviewDecisionFilename,
  createClinicalUseReviewNormalizedExport,
  serializeClinicalUseReviewCsv,
  serializeClinicalUseReviewJson,
} from '@/features/preference-cards/excel/clinical-use-review-serialization'

const MANIFEST_HASH = 'a'.repeat(64)

function importPreview(
  overrides: Partial<ClinicalUseReviewImportPreview> = {},
): ClinicalUseReviewImportPreview {
  const productRoleDecision = {
    recordType: 'product_role' as const,
    reviewKey: clinicalUseProductRoleKey('PRD-000123', 'ROLE_CURRENT'),
    productId: 'PRD-000123',
    roleCode: 'ROLE_CURRENT',
    decision: 'replace_with_different_role' as const,
    suggestedRoleCode: 'ROLE_REPLACEMENT',
    rationale: '=Formula-like rationale must remain text.',
    evidenceNeeded: null,
    reviewerName: 'Clinical Reviewer',
    reviewerConfidence: 'high' as const,
    reviewDate: '2026-07-29',
    followUpNotes: null,
    readyForSecondReview: true,
    secondReviewer: null,
    secondReviewComments: null,
  }
  const slotDecision = {
    recordType: 'slot_product' as const,
    reviewKey: clinicalUseSlotProductKey('SLOT-000456', 'PRD-000123'),
    slotId: 'SLOT-000456',
    procedureCode: 'PROC_TEST',
    productId: 'PRD-000123',
    roleCode: 'ROLE_CURRENT',
    decision: 'move_to_another_exact_slot' as const,
    suggestedSlotId: 'SLOT-000789',
    rationale: 'The product belongs in the suggested exact slot.',
    evidenceNeeded: null,
    reviewerName: '@Second Reviewer',
    reviewerConfidence: 'moderate' as const,
    reviewDate: '2026-07-30',
    followUpNotes: null,
    readyForSecondReview: false,
    secondReviewer: null,
    secondReviewComments: null,
  }
  return {
    formatVersion: CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION,
    importedAt: '2026-07-30T12:00:00.000Z',
    workbookFileName: 'completed clinical use review.xlsx',
    workbookSha256: 'b'.repeat(64),
    workbookMetadata: {
      format_version: CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
      exported_at: '2026-07-29T12:00:00.000Z',
      clinical_use_manifest_sha256: MANIFEST_HASH,
      catalog_products_sha256: '1'.repeat(64),
      product_roles_sha256: '2'.repeat(64),
      roles_sha256: '3'.repeat(64),
      procedures_sha256: '4'.repeat(64),
      procedure_slots_sha256: '5'.repeat(64),
      slot_product_options_sha256: '6'.repeat(64),
      catalog_product_count: '1474',
      product_role_count: '1566',
      current_slot_count: '2080',
      application_base_url: 'https://example.test',
      source_branch: 'codex/preference-cards/catalog-verification-workflow',
      source_commit: 'c'.repeat(40),
      locale: 'en',
    },
    currentClinicalUseManifestSha256: MANIFEST_HASH,
    staleArtifact: false,
    staleWarning: null,
    canExportNormalized: true,
    exportBlockers: [],
    summary: {
      validCompletedDecisions: 2,
      productRoleDecisions: 1,
      currentSlotDecisions: 1,
      incompleteDecisions: 0,
      rowsWithoutDecision: 3644,
      invalidDecisionValues: 0,
      missingRationales: 0,
      missingSuggestedRoles: 0,
      missingSuggestedSlots: 0,
      unknownReviewKeys: 0,
      staleReviewKeys: 0,
      protectedFieldDifferences: 0,
      duplicateRows: 0,
      unchangedProtectedRows: 3646,
      changedProtectedRows: 0,
      missingCurrentRows: 0,
      matchedReviewKeys: 3646,
    },
    missingCurrentReviewKeys: [],
    unknownWorkbookReviewKeys: [],
    duplicateReviewKeys: [],
    changedReviewKeys: [],
    reviewedReviewKeys: [productRoleDecision.reviewKey, slotDecision.reviewKey],
    decisions: [slotDecision, productRoleDecision],
    rows: [],
    ...overrides,
  }
}

describe('full-catalog clinical-use review data', () => {
  it('assembles the complete effective catalog, product-role mappings, and canonical slots', () => {
    const data = getClinicalUseReviewData({
      applicationBaseUrl: 'https://example.test/some/path',
      locale: 'en',
      clinicalUseManifestHash: MANIFEST_HASH,
    })

    expect(data.counts).toEqual({
      catalogProducts: 1474,
      productRoles: 1566,
      currentSlots: 2080,
    })
    expect(getClinicalUseReviewCounts()).toEqual(data.counts)
    expect(data.roleOptions).toHaveLength(98)
    expect(data.slotOptions).toHaveLength(174)
    expect(new Set(data.catalogProducts.map((row) => row.productId)).size).toBe(1474)
    expect(new Set(data.productRoles.map((row) => row.reviewKey)).size).toBe(1566)
    expect(new Set(data.currentSlots.map((row) => row.reviewKey)).size).toBe(2080)
    expect(data.productRoles.every((row) => row.reviewKey.startsWith('product_role:'))).toBe(true)
    expect(data.currentSlots.every((row) => row.reviewKey.startsWith('slot_product:'))).toBe(true)
    expect(data.productRoles.every((row) => row.clinicalUseManifestHash === MANIFEST_HASH)).toBe(
      true,
    )
    expect(data.currentSlots.every((row) => row.clinicalUseManifestHash === MANIFEST_HASH)).toBe(
      true,
    )
    expect(
      data.catalogProducts.every(
        (row) =>
          typeof row.productId === 'string' &&
          typeof row.catalogNumber === 'string' &&
          typeof row.deviceIdentifier === 'string',
      ),
    ).toBe(true)
    expect(data.catalogProducts.some((row) => row.catalogNumber === '02841S')).toBe(true)
    expect(
      data.catalogProducts.every((row) =>
        row.evidencePageUrl.startsWith(
          'https://example.test/en/admin/preference-cards/catalog-qa/',
        ),
      ),
    ).toBe(true)
    expect(data.productRoles.some((row) => row.canonicalSlotCount === 0)).toBe(true)
  })

  it('builds a deterministic manifest from all six authoritative clinical-use artifacts', async () => {
    const first = await getClinicalUseReviewArtifactManifest()
    const second = await getClinicalUseReviewArtifactManifest()
    expect(second).toEqual(first)
    expect(first.formatVersion).toBe(1)
    for (const [key, value] of Object.entries(first)) {
      if (key === 'formatVersion') continue
      expect(value).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('rejects invalid provenance hashes before producing workbook rows', () => {
    expect(() =>
      getClinicalUseReviewData({
        applicationBaseUrl: 'https://example.test',
        locale: 'en',
        clinicalUseManifestHash: 'not-a-hash',
      }),
    ).toThrow(/manifest hash must be a SHA-256/i)
  })
})

describe('full-catalog clinical-use normalized serialization', () => {
  it('sorts the discriminated decisions and serializes deterministic JSON', () => {
    const normalized = createClinicalUseReviewNormalizedExport(importPreview(), false)
    expect(normalized.decisions.map((decision) => decision.recordType)).toEqual([
      'product_role',
      'slot_product',
    ])
    expect(normalized.staleArtifactAcknowledged).toBe(false)
    const json = serializeClinicalUseReviewJson(normalized)
    expect(json.endsWith('\n')).toBe(true)
    expect(JSON.parse(json)).toEqual(normalized)
  })

  it('emits record_type and protects formula-like CSV cells without losing booleans', () => {
    const csv = serializeClinicalUseReviewCsv(
      createClinicalUseReviewNormalizedExport(importPreview(), false),
    )
    expect(csv).toContain('record_type')
    expect(csv).toContain('product_role')
    expect(csv).toContain('slot_product')
    expect(csv).toContain("'=Formula-like rationale must remain text.")
    expect(csv).toContain("'@Second Reviewer")
    expect(csv).toContain(',false,')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('requires stale acknowledgement and preserves deterministic filenames', () => {
    const stale = importPreview({
      staleArtifact: true,
      staleWarning: 'The clinical-use artifacts changed.',
      currentClinicalUseManifestSha256: 'd'.repeat(64),
    })
    expect(() => createClinicalUseReviewNormalizedExport(stale, false)).toThrow(
      /must be explicitly acknowledged/i,
    )
    expect(createClinicalUseReviewNormalizedExport(stale, true).staleArtifactAcknowledged).toBe(
      true,
    )
    expect(clinicalUseReviewDecisionFilename('json', '2026-07-30')).toBe(
      'IP_Clinical_Use_Review_Decisions_2026-07-30.json',
    )
  })

  it('refuses normalized output while blocking validation errors remain', () => {
    expect(() =>
      createClinicalUseReviewNormalizedExport(
        importPreview({
          canExportNormalized: false,
          exportBlockers: ['Missing required rationale.'],
        }),
        false,
      ),
    ).toThrow(/blocking validation errors/i)
  })
})
