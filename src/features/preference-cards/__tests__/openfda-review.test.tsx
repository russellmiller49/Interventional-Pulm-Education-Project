import { render, screen } from '@testing-library/react'

import { OpenFdaReviewQueue } from '../components/OpenFdaReviewQueue'
import {
  buildOpenFdaReviewData,
  getOpenFdaReviewData,
  type OpenFdaReviewRow,
} from '../data/openfda-proposals.server'
import type {
  OpenFdaClassification,
  OpenFdaEnrichmentProposal,
} from '../../../../scripts/ip-preference-cards/openfda/types'

const classifications: OpenFdaClassification[] = [
  'high_confidence_candidate',
  'review_required',
  'unmatched',
  'insufficient_identifiers',
  'query_error',
]

function reviewRow(classification: OpenFdaClassification, index: number): OpenFdaReviewRow {
  return {
    productId: `PRD-TEST-${index}`,
    manufacturer: 'Acme Medical',
    productName: `Test product ${index}`,
    catalogNumber: `CAT-${index}`,
    classification,
    candidateDi: classification === 'unmatched' ? null : `0000000000000${index}`,
    candidateCatalogNumber: `CAT-${index}`,
    candidateManufacturer: 'Acme Medical',
    candidateModel: `MODEL-${index}`,
    distributionStatus: 'In Commercial Distribution',
    reasonCodes: ['test_reason'],
    backlogComparison: 'not_previously_evaluated',
    backlogConflict: false,
    publicVersionDate: '2026-07-27',
    procedures: 'TEST_PROCEDURE',
    roles: 'TEST_ROLE',
  }
}

describe('openFDA admin review queue', () => {
  it('renders every classification in the read-only queue', () => {
    const rows = classifications.map(reviewRow)
    const counts = Object.fromEntries(
      classifications.map((classification) => [classification, 1]),
    ) as Record<OpenFdaClassification, number>
    render(<OpenFdaReviewQueue status="available" rows={rows} counts={counts} />)
    expect(screen.getByText('High-confidence candidate')).toBeInTheDocument()
    expect(screen.getByText('Human review required')).toBeInTheDocument()
    expect(screen.getAllByText('Unmatched').length).toBeGreaterThan(0)
    expect(screen.getByText('Insufficient identifiers')).toBeInTheDocument()
    expect(screen.getByText('Query error')).toBeInTheDocument()
  })

  it('renders a clear empty state when no enrichment run exists', () => {
    const counts = Object.fromEntries(
      classifications.map((classification) => [classification, 0]),
    ) as Record<OpenFdaClassification, number>
    render(<OpenFdaReviewQueue status="missing" rows={[]} counts={counts} />)
    expect(screen.getByText('No openFDA enrichment run is available')).toBeInTheDocument()
  })

  it('returns the missing state for an absent proposal file', async () => {
    const data = await getOpenFdaReviewData('/definitely/missing/openfda-proposals.json')
    expect(data.status).toBe('missing')
    expect(data.rows).toEqual([])
  })

  it('joins procedures and roles without exposing raw cache references', () => {
    const base = {
      format_version: 1,
      product_id: 'PRD-TEST-1',
      manufacturer: 'Acme Medical',
      product_name: 'Test product',
      catalog_number: 'CAT-1',
      classification: 'review_required',
      reason_codes: ['test_reason'],
      query_attempts: [],
      candidate_count: 0,
      selected_candidate: null,
      proposed_fields: {
        primary_di: null,
        additional_identifiers: [],
        brand_name: null,
        company_name: null,
        version_or_model_number: null,
        device_description: null,
        device_count_in_base_package: null,
        device_sizes: [],
        commercial_distribution_status: null,
        commercial_distribution_end_date: null,
        is_kit: null,
        is_single_use: null,
        sterilization: null,
        storage: [],
        product_codes: [],
        premarket_submissions: [],
        public_version_date: null,
        record_status: null,
      },
      backlog_comparison: 'not_previously_evaluated',
      retrieved_at: null,
      raw_cache_reference: 'openfda-cache:secret-path.json',
      decision: 'pending_review',
    } satisfies OpenFdaEnrichmentProposal
    const data = buildOpenFdaReviewData(
      [base],
      [{ product_id: 'PRD-TEST-1', role_code: 'ROLE_FROM_LINK' }],
      [{ product_id: 'PRD-TEST-1', procedures: 'PROC-1', roles: null }],
    )
    expect(data.rows[0]).toMatchObject({
      procedures: 'PROC-1',
      roles: 'ROLE_FROM_LINK',
    })
    expect(JSON.stringify(data.rows[0])).not.toContain('secret-path')
  })
})
