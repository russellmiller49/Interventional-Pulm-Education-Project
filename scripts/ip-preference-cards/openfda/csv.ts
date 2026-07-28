import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { openFdaEnrichmentProposalsSchema } from './schemas'
import { stableSortOpenFdaProposals } from './proposals'
import type { OpenFdaEnrichmentProposal } from './types'

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const display = typeof value === 'string' ? value : String(value)
  return /[",\r\n]/.test(display) ? `"${display.replace(/"/g, '""')}"` : display
}

const CSV_COLUMNS = [
  'product_id',
  'manufacturer',
  'product_name',
  'canonical_catalog_number',
  'classification',
  'reason_codes',
  'candidate_count',
  'candidate_primary_di',
  'candidate_catalog_number',
  'candidate_company_name',
  'candidate_model_number',
  'commercial_distribution_status',
  'public_version_date',
  'backlog_comparison',
  'decision',
] as const

function csvRow(
  proposal: OpenFdaEnrichmentProposal,
): Record<(typeof CSV_COLUMNS)[number], unknown> {
  return {
    product_id: proposal.product_id,
    manufacturer: proposal.manufacturer,
    product_name: proposal.product_name,
    canonical_catalog_number: proposal.catalog_number,
    classification: proposal.classification,
    reason_codes: proposal.reason_codes.join('|'),
    candidate_count: proposal.candidate_count,
    candidate_primary_di: proposal.proposed_fields.primary_di,
    candidate_catalog_number: proposal.selected_candidate?.catalog_number,
    candidate_company_name: proposal.selected_candidate?.company_name,
    candidate_model_number: proposal.selected_candidate?.version_or_model_number,
    commercial_distribution_status: proposal.proposed_fields.commercial_distribution_status,
    public_version_date: proposal.proposed_fields.public_version_date,
    backlog_comparison: proposal.backlog_comparison,
    decision: proposal.decision,
  }
}

export function openFdaProposalsToCsv(proposals: OpenFdaEnrichmentProposal[]): string {
  const rows = stableSortOpenFdaProposals(proposals).map(csvRow)
  return (
    [
      CSV_COLUMNS.map(escapeCsvValue).join(','),
      ...rows.map((row) => CSV_COLUMNS.map((column) => escapeCsvValue(row[column])).join(',')),
    ].join('\n') + '\n'
  )
}

export async function writeOpenFdaCsvReports(
  proposalsInput: OpenFdaEnrichmentProposal[],
  outputDirectory: string,
): Promise<void> {
  const proposals = stableSortOpenFdaProposals(
    openFdaEnrichmentProposalsSchema.parse(proposalsInput),
  )
  await mkdir(outputDirectory, { recursive: true })
  const reports: Array<[string, OpenFdaEnrichmentProposal[]]> = [
    [
      'high-confidence-candidates.csv',
      proposals.filter((proposal) => proposal.classification === 'high_confidence_candidate'),
    ],
    [
      'review-required.csv',
      proposals.filter((proposal) => proposal.classification === 'review_required'),
    ],
    [
      'unmatched-products.csv',
      proposals.filter((proposal) =>
        ['unmatched', 'insufficient_identifiers'].includes(proposal.classification),
      ),
    ],
    ['query-errors.csv', proposals.filter((proposal) => proposal.classification === 'query_error')],
  ]
  await Promise.all(
    reports.map(([filename, rows]) =>
      writeFile(path.join(outputDirectory, filename), openFdaProposalsToCsv(rows), 'utf8'),
    ),
  )
}
