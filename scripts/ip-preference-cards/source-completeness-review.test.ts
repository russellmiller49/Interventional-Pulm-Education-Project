import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { parseCsvRecords } from './brochure-intake'
import {
  SOURCE_COMPLETENESS_DISPOSITIONS,
  SOURCE_COMPLETENESS_REVIEW,
  sourceCompletenessCount,
} from './source-completeness-intake'

const REVIEW_DIRECTORY = 'docs/ip-preference-cards/source-completeness/2026-08-20'

function csvRows(filename: string): Record<string, string>[] {
  const [header, ...rows] = parseCsvRecords(
    readFileSync(path.join(REVIEW_DIRECTORY, filename), 'utf8'),
  )
  return rows.map((row) => Object.fromEntries(header.map((column, index) => [column, row[index]])))
}

function hash(filename: string): string {
  return createHash('sha256').update(readFileSync(filename)).digest('hex')
}

describe('source-completeness review package', () => {
  test('contains the complete required deterministic artifact set and no raw source files', () => {
    expect(readdirSync(REVIEW_DIRECTORY).sort()).toEqual(
      [
        'README.md',
        'duplicate-analysis.csv',
        'existing-product-matches.csv',
        'irrelevant-products.csv',
        'manufacturer-summary.csv',
        'missing-from-original-csv.csv',
        'new-product-additions.csv',
        'old-corpus-multipage-document-scan.csv',
        'old-corpus-table-page-coverage.csv',
        'owner-supplied-products.csv',
        'source-manifest.json',
        'source-product-discovery.csv',
        'unresolved-relevant-products.csv',
      ].sort(),
    )
  })

  test('reconciles every discovery candidate into exactly one controlled disposition', () => {
    const discovery = csvRows('source-product-discovery.csv')
    expect(discovery).toHaveLength(sourceCompletenessCount('discovery_rows'))
    expect(new Set(discovery.map((row) => row.candidate_id)).size).toBe(discovery.length)
    const dispositions = new Set(SOURCE_COMPLETENESS_DISPOSITIONS)
    for (const row of discovery) expect(dispositions.has(row.disposition as never)).toBe(true)
    expect(
      discovery.filter((row) => row.disposition === 'new_exact_product_candidate'),
    ).toHaveLength(sourceCompletenessCount('new_exact_products'))
    expect(discovery.filter((row) => row.disposition.startsWith('existing_'))).toHaveLength(4)
    expect(discovery.filter((row) => row.disposition === 'needs_owner_review')).toHaveLength(5)
    expect(
      discovery.filter((row) => row.disposition === 'source_evidence_conflicted'),
    ).toHaveLength(sourceCompletenessCount('shiley_controlled_conflicts'))
    expect(
      discovery.filter((row) => row.disposition === 'irrelevant_to_current_scope'),
    ).toHaveLength(9)
  })

  test('pins all review-subset counts and distinguishes CSV absence from acceptance', () => {
    expect(csvRows('missing-from-original-csv.csv')).toHaveLength(80)
    expect(csvRows('owner-supplied-products.csv')).toHaveLength(40)
    expect(csvRows('new-product-additions.csv')).toHaveLength(
      sourceCompletenessCount('new_exact_products'),
    )
    expect(csvRows('existing-product-matches.csv')).toHaveLength(4)
    expect(csvRows('unresolved-relevant-products.csv')).toHaveLength(7)
    expect(csvRows('irrelevant-products.csv')).toHaveLength(9)
    expect(csvRows('duplicate-analysis.csv')).toHaveLength(69)
    expect(csvRows('manufacturer-summary.csv')).toHaveLength(9)
    expect(csvRows('old-corpus-table-page-coverage.csv')).toHaveLength(2)
    expect(csvRows('old-corpus-multipage-document-scan.csv')).toHaveLength(
      sourceCompletenessCount('corpus_wide_multi_page_table_documents'),
    )
  })

  test('carries the unchanged old corpus plus every newly used hashed evidence artifact', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(REVIEW_DIRECTORY, 'source-manifest.json'), 'utf8'),
    ) as {
      source_count: number
      old_corpus_source_count: number
      new_evidence_count: number
      new_owner_pdf_count: number
      new_official_web_evidence_count: number
      runtime_governed_source_count: number
      pdf_count: number
      html_count: number
      markdown_count: number
      total_pdf_pages: number
      old_corpus_pdf_count: number
      old_corpus_html_count: number
      old_corpus_markdown_count: number
      old_corpus_total_pdf_pages: number
      new_evidence_pdf_count: number
      new_evidence_html_count: number
      new_evidence_total_pdf_pages: number
      prior_source_hash_mismatches: number
      prior_sources_missing: number
      prior_sources_added: number
      sources: {
        sha256: string
        evidence_id?: string
        evidence_scope?: string
        governed_source_ids?: string[]
        canonical_additions_supported?: { catalog_number: string }[]
      }[]
    }
    expect(manifest).toMatchObject({
      source_count: 158,
      old_corpus_source_count: 125,
      new_evidence_count: 33,
      new_owner_pdf_count: 1,
      new_official_web_evidence_count: 32,
      runtime_governed_source_count: 16,
      pdf_count: 122,
      html_count: 33,
      markdown_count: 3,
      total_pdf_pages: 2654,
      old_corpus_pdf_count: 115,
      old_corpus_html_count: 7,
      old_corpus_markdown_count: 3,
      old_corpus_total_pdf_pages: 2609,
      new_evidence_pdf_count: 7,
      new_evidence_html_count: 26,
      new_evidence_total_pdf_pages: 45,
      prior_source_hash_mismatches: 0,
      prior_sources_missing: 0,
      prior_sources_added: 0,
    })
    expect(manifest.sources).toHaveLength(158)
    for (const source of manifest.sources) expect(source.sha256).toMatch(/^[a-f0-9]{64}$/u)

    const shiley = manifest.sources.find((source) => source.governed_source_ids?.includes('SRC083'))
    expect(
      shiley?.canonical_additions_supported?.filter(({ catalog_number }) =>
        catalog_number.endsWith('R'),
      ),
    ).toHaveLength(sourceCompletenessCount('shiley_products_added'))

    const hugeMedExact = manifest.sources.find((source) => source.evidence_id === 'EVID-SC-021')
    const clrExact = manifest.sources.find((source) => source.evidence_id === 'EVID-SC-033')
    expect(hugeMedExact?.canonical_additions_supported?.map((row) => row.catalog_number)).toEqual([
      'BR-M22',
    ])
    expect(clrExact?.canonical_additions_supported?.map((row) => row.catalog_number)).toEqual([
      'S012-01-015',
    ])

    for (const source of manifest.sources.filter((row) => row.evidence_id)) {
      const reviewed = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.find(
        (row) => row.evidenceId === source.evidence_id,
      )
      expect(source.canonical_additions_supported?.map((row) => row.catalog_number)).toEqual(
        reviewed?.supportedCatalogNumbers,
      )
      expect(source.evidence_scope).toBe(reviewed?.scope)
    }
  })

  test('pins source-derived page counts and family-level claim restraint', () => {
    const byId = new Map(
      SOURCE_COMPLETENESS_REVIEW.evidence_manifest.map((source) => [source.evidenceId, source]),
    )
    expect(byId.get('EVID-SC-004')?.pageCount).toBe(2)
    expect(byId.get('EVID-SC-005')?.pageCount).toBe(4)
    expect(byId.get('EVID-SC-007')?.pageCount).toBe(9)
    expect(byId.get('EVID-SC-009')?.pageCount).toBe(11)
    expect(byId.get('EVID-SC-010')?.pageCount).toBe(2)
    expect(byId.get('EVID-SC-011')?.pageCount).toBe(10)
    expect(byId.get('EVID-SC-006')?.scope).toBe('family_level')
    expect(byId.get('EVID-SC-011')?.scope).toBe('family_level')
  })

  test('does not rewrite the prior review package or published release artifacts', () => {
    expect(hash('docs/ip-preference-cards/brochure-intake/2026-08-19/source-manifest.json')).toBe(
      '7cdc492ad5042197df294ed4787bbf70b2e5136a7b277ee8d75b38cd08abedba',
    )
    expect(hash('docs/ip-preference-cards/brochure-intake/2026-08-19/row-reconciliation.csv')).toBe(
      '7d2618eb59eba532d0cd795f7d3261225a767133a7089c605b13f2a66e3ebb99',
    )
    expect(hash('data/ip-preference-cards/generated/release-bundles.json')).toBe(
      '0eb2610c01bf65db5ce140252d7a9d09e075dda3538d1ff458c7116e9eed829f',
    )
    expect(hash('data/ip-preference-cards/seed/release-bundles.json')).toBe(
      '892780cb38695b71b8c6d258ca4915ae5bf74062e8e976dff050aa0ced9cdde2',
    )
    expect(hash('data/ip-preference-cards/generated/catalog-release-manifests.json')).toBe(
      '8e2766e2d742f3a5c98c6a2de6c83649738974fed9dcb985a9cbee83c9359e41',
    )
  })
})
