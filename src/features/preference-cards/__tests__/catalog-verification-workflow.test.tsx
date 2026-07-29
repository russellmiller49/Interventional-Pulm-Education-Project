import { render, screen } from '@testing-library/react'

import { CatalogVerificationQueue } from '../components/CatalogVerificationQueue'
import { CatalogVerificationWorkspace } from '../components/CatalogVerificationWorkspace'
import {
  buildCatalogVerificationRows,
  filterCatalogVerificationRows,
  getCatalogVerificationDetail,
  getCatalogVerificationRows,
  summarizeCatalogVerificationRows,
  verificationBacklogRowSchema,
  type CatalogVerificationBuildInput,
  type CatalogVerificationProduct,
  type GudidConfirmation,
  type VerificationBacklogRow,
} from '../data/catalog-verification.server'
import { getSlotOptionProposalsForProduct } from '../data/slot-option-proposals.server'

function product(overrides: Partial<CatalogVerificationProduct> = {}): CatalogVerificationProduct {
  return {
    product_id: 'PRD-TEST-1',
    manufacturer: 'Acme Medical',
    product_name: 'Test bronchoscope',
    catalog_number: 'ABC-100',
    gtin: null,
    verification_status: 'Candidate',
    live_dropdown_status: 'Hidden until verified',
    verification_grade: 'candidate',
    visibility_state: 'hidden',
    primary_source_id: null,
    primary_source_location: null,
    ...overrides,
  }
}

function confirmation(overrides: Partial<GudidConfirmation> = {}): GudidConfirmation {
  return {
    product_id: 'PRD-TEST-1',
    manufacturer: 'Acme Medical',
    product_name: 'Test bronchoscope',
    catalog_number: 'ABC-100',
    match_strength: 'manufacturer_and_catalog_number',
    gudid_primary_di: '00123456789012',
    gudid_company: 'Acme Medical',
    gudid_brand: 'Acme Scope',
    gudid_description: 'Test device',
    gudid_distribution_status: 'In Commercial Distribution',
    gudid_gtin: '00123456789012',
    current_gtin: null,
    proposals: ['Add GTIN 00123456789012 from GUDID DI 00123456789012.'],
    ...overrides,
  }
}

function buildInput(
  overrides: Partial<CatalogVerificationBuildInput> = {},
): CatalogVerificationBuildInput {
  return {
    products: [product()],
    backlogRows: [],
    confirmations: [],
    productSources: [],
    sources: [],
    roleContexts: [],
    procedureContexts: [],
    ...overrides,
  }
}

function backlogRow(overrides: Partial<VerificationBacklogRow> = {}): VerificationBacklogRow {
  const baseline = getCatalogVerificationRows().find((row) => row.backlog)?.backlog
  if (!baseline) throw new Error('Expected a verification backlog fixture.')
  return {
    ...baseline,
    product_id: 'PRD-TEST-1',
    manufacturer: 'Acme Medical',
    product_name: 'Test bronchoscope',
    catalog_number: 'ABC-100',
    current_verification_status: 'Candidate',
    current_live_status: 'Hidden until verified',
    ...overrides,
  }
}

describe('catalog verification aggregation', () => {
  it('covers the effective catalog, including every post-workbook addition', () => {
    const rows = getCatalogVerificationRows()
    const summary = summarizeCatalogVerificationRows(rows)

    expect(summary).toMatchObject({
      totalProducts: 1474,
      workbookBacklogProducts: 1221,
      additionsAfterWorkbook: 253,
      strongIdentityCandidates: 718,
      withoutStrongIdentityCandidate: 756,
      gtinConflicts: 99,
    })
    expect(new Set(rows.map((row) => row.productId)).size).toBe(rows.length)
  })

  it('never promotes weak cross-manufacturer matches into identity or distribution evidence', () => {
    const rows = buildCatalogVerificationRows(
      buildInput({
        confirmations: [
          confirmation({
            match_strength: 'catalog_number_only',
            gudid_company: 'Unrelated Manufacturer',
            gudid_distribution_status: 'Not in Commercial Distribution',
            proposals: [
              'GTIN mismatch: catalog has 00000000000001, GUDID publishes 00123456789012.',
            ],
          }),
        ],
      }),
    )

    expect(rows[0]).toMatchObject({
      identityEvidence: 'weak_candidate_only',
      distributionEvidence: 'unknown',
      strongMatchCount: 0,
      weakMatchCount: 1,
      hasGtinMismatchProposal: false,
      hasReleaseCandidateProposal: false,
    })
  })

  it('surfaces conflicting strong distribution records and multiple GTINs', () => {
    const rows = buildCatalogVerificationRows(
      buildInput({
        confirmations: [
          confirmation({
            proposals: [
              'GUDID reports in commercial distribution. Review visibility only after independent source verification.',
            ],
          }),
          confirmation({
            gudid_primary_di: '00999999999999',
            gudid_gtin: '00999999999999',
            gudid_distribution_status: 'Not in Commercial Distribution',
            proposals: [],
          }),
        ],
      }),
    )

    expect(rows[0]).toMatchObject({
      identityEvidence: 'strong_candidate',
      distributionEvidence: 'conflicting',
      uniqueStrongDiCount: 2,
      uniqueStrongGtinCount: 2,
      hasReleaseCandidateProposal: false,
    })
  })

  it('fails closed when recognized and unrecognized strong distribution states are mixed', () => {
    const rows = buildCatalogVerificationRows(
      buildInput({
        confirmations: [
          confirmation(),
          confirmation({
            gudid_primary_di: '00999999999999',
            gudid_distribution_status: 'Future distribution state',
          }),
        ],
      }),
    )

    expect(rows[0].distributionEvidence).toBe('conflicting')
  })

  it('tracks workbook DI drift against current strong candidates', () => {
    const agreed = buildCatalogVerificationRows(
      buildInput({
        backlogRows: [backlogRow({ suggested_primary_di: '00123456789012' })],
        confirmations: [confirmation()],
      }),
    )
    const different = buildCatalogVerificationRows(
      buildInput({
        backlogRows: [backlogRow({ suggested_primary_di: '00999999999999' })],
        confirmations: [confirmation()],
      }),
    )
    const noCurrentStrong = buildCatalogVerificationRows(
      buildInput({
        backlogRows: [backlogRow({ suggested_primary_di: '00999999999999' })],
        confirmations: [],
      }),
    )

    expect(agreed[0].backlogGudidAlignment).toBe('agrees')
    expect(different[0].backlogGudidAlignment).toBe('different_current_strong')
    expect(noCurrentStrong[0].backlogGudidAlignment).toBe('no_current_strong')
    expect(filterCatalogVerificationRows(different, { signal: 'backlog_drift' })).toHaveLength(1)
  })

  it('filters actionable evidence signals without changing the source rows', () => {
    const rows = getCatalogVerificationRows()
    const weakOnly = filterCatalogVerificationRows(rows, { signal: 'weak_only' })
    const additions = filterCatalogVerificationRows(rows, { signal: 'not_in_backlog' })
    const conflicts = filterCatalogVerificationRows(rows, { signal: 'distribution_alert' })
    const notDistributed = filterCatalogVerificationRows(rows, {
      distribution: 'not_in_distribution',
    })

    expect(weakOnly.length).toBeGreaterThan(0)
    expect(weakOnly.every((row) => row.identityEvidence === 'weak_candidate_only')).toBe(true)
    expect(additions).toHaveLength(253)
    expect(conflicts.length).toBeGreaterThan(0)
    expect(notDistributed.every((row) => row.distributionEvidence === 'not_in_distribution')).toBe(
      true,
    )
    expect(getCatalogVerificationRows()).toHaveLength(1474)
  })

  it('searches current GUDID candidate DIs rather than only workbook suggestions', () => {
    const rows = buildCatalogVerificationRows(
      buildInput({
        confirmations: [confirmation({ gudid_primary_di: '07331791009235' })],
      }),
    )

    expect(filterCatalogVerificationRows(rows, { q: '07331791009235' })).toHaveLength(1)
    expect(filterCatalogVerificationRows(rows, { q: 'missing-di' })).toHaveLength(0)
  })

  it('filters post-workbook products through current role and procedure context', () => {
    const rows = buildCatalogVerificationRows(
      buildInput({
        roleContexts: [
          {
            productId: 'PRD-TEST-1',
            roleCode: 'FLEX_SCOPE_THERAPEUTIC',
            roleName: 'Therapeutic flexible bronchoscope',
            roleFit: 'Compatible',
          },
        ],
        procedureContexts: [
          {
            productId: 'PRD-TEST-1',
            procedureCode: 'EBV',
            procedureName: 'Endobronchial valve placement',
            source: 'proposal',
          },
        ],
      }),
    )

    expect(rows[0].backlog).toBeNull()
    expect(filterCatalogVerificationRows(rows, { role: 'therapeutic' })).toHaveLength(1)
    expect(filterCatalogVerificationRows(rows, { procedure: 'EBV' })).toHaveLength(1)
    expect(rows[0].proposedProcedures[0].source).toBe('proposal')
  })

  it('fails closed on broken product-source relationships', () => {
    expect(() =>
      buildCatalogVerificationRows(
        buildInput({
          productSources: [
            {
              product_id: 'PRD-TEST-1',
              source_id: 'SRC-MISSING',
              source_location: null,
              claim_type: null,
              verification_status: null,
              notes: null,
            },
          ],
        }),
      ),
    ).toThrow('unknown source_id')
  })

  it('strictly rejects undeclared workbook-backlog fields', () => {
    const backlog = getCatalogVerificationRows().find((row) => row.backlog)?.backlog
    expect(backlog).not.toBeNull()
    expect(
      verificationBacklogRowSchema.safeParse({
        ...backlog,
        undeclared_approval: true,
      }).success,
    ).toBe(false)
  })

  it('carries distribution and source use-policy evidence into product detail', () => {
    const row = getCatalogVerificationRows().find(
      (candidate) => candidate.distributionEvidence === 'not_in_distribution',
    )
    expect(row).toBeDefined()
    const detail = getCatalogVerificationDetail(row!.productId)

    expect(detail?.productDetail.distributionStatus).toBe('not_in_distribution')
    expect(
      detail?.productDetail.sources.some(
        (source) => source.usePolicy || source.sourceNotes || source.linkNotes,
      ),
    ).toBe(true)
  })
})

describe('catalog verification UI', () => {
  it('renders a review link and does not expose approval actions in the queue', () => {
    const allRows = getCatalogVerificationRows()
    const rows = [allRows[0], allRows.find((row) => row.backlog === null)!]
    render(
      <CatalogVerificationQueue
        rows={rows}
        summary={summarizeCatalogVerificationRows(allRows)}
        locale="en"
      />,
    )

    expect(screen.getAllByRole('link', { name: /Review evidence/i })).toHaveLength(2)
    expect(screen.getByText('Not in workbook backlog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept|approve|apply/i })).not.toBeInTheDocument()
  })

  it('shows weak GUDID evidence as non-actionable and keeps formulary review separate', () => {
    const row = getCatalogVerificationRows().find(
      (candidate) => candidate.identityEvidence === 'weak_candidate_only',
    )
    expect(row).toBeDefined()
    const detail = getCatalogVerificationDetail(row!.productId)
    expect(detail).not.toBeNull()

    render(
      <CatalogVerificationWorkspace
        detail={detail!}
        slotProposals={getSlotOptionProposalsForProduct(row!.productId)}
        locale="en"
      />,
    )

    expect(screen.getAllByText('Catalog-number-only candidate').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Separate process').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Weak match: the manufacturer did not match/i).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /accept|approve|apply/i })).not.toBeInTheDocument()
  })

  it('distinguishes nonselectable authored slots and displays role-fit context', () => {
    const detail = getCatalogVerificationRows()
      .map((row) => getCatalogVerificationDetail(row.productId))
      .find((candidate) => candidate?.productDetail.slots.some((slot) => slot.selectable === false))
    expect(detail).toBeDefined()

    render(
      <CatalogVerificationWorkspace
        detail={detail!}
        slotProposals={getSlotOptionProposalsForProduct(detail!.queueRow.productId)}
        locale="en"
      />,
    )

    expect(screen.getAllByText('Nonselectable authored option').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Role fit:/i).length).toBeGreaterThan(0)
  })
})
