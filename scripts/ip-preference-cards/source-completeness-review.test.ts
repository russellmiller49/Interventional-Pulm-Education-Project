import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { parseCsvRecords } from './brochure-intake'
import {
  CORPUS_SCAN_DISPOSITIONS,
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
        'old-corpus-candidate-dispositions.csv',
        'old-corpus-candidate-extraction.csv',
        'old-corpus-document-summary.csv',
        'old-corpus-page-coverage.csv',
        'old-corpus-table-page-coverage.csv',
        'owner-supplied-products.csv',
        'scanner-summary.json',
        'source-manifest.json',
        'source-product-discovery.csv',
        'unresolved-relevant-products.csv',
      ].sort(),
    )
  })

  test('accounts for every scanner candidate with exactly one controlled disposition', () => {
    const extraction = csvRows('old-corpus-candidate-extraction.csv')
    const dispositions = csvRows('old-corpus-candidate-dispositions.csv')
    expect(extraction).toHaveLength(sourceCompletenessCount('corpus_scan_candidates'))
    expect(dispositions).toHaveLength(extraction.length)

    const extractionKeys = new Set(
      extraction.map((row) => `${row.source_filename} ${row.normalized_identifier}`),
    )
    const dispositionKeys = dispositions.map(
      (row) => `${row.source_filename} ${row.normalized_identifier}`,
    )
    expect(new Set(dispositionKeys).size).toBe(dispositions.length)
    for (const key of dispositionKeys) expect(extractionKeys.has(key)).toBe(true)

    const controlled = new Set<string>(CORPUS_SCAN_DISPOSITIONS)
    for (const row of dispositions) {
      expect(controlled.has(row.disposition)).toBe(true)
      expect(row.rationale.length).toBeGreaterThan(0)
    }
  })

  test('proves the review generator consumed the scanner: every accepted old-corpus product is scanner-backed', () => {
    const additions = csvRows('new-product-additions.csv').filter(
      (row) => row.origin === 'old_corpus',
    )
    expect(additions).toHaveLength(sourceCompletenessCount('old_corpus_products'))
    const acceptedByProduct = new Map<string, Record<string, string>[]>()
    for (const row of csvRows('old-corpus-candidate-dispositions.csv')) {
      if (row.disposition !== 'new_exact_product_candidate') continue
      acceptedByProduct.set(row.canonical_product_id, [
        ...(acceptedByProduct.get(row.canonical_product_id) ?? []),
        row,
      ])
    }
    for (const addition of additions) {
      const backing = acceptedByProduct.get(addition.product_id) ?? []
      expect(backing.length).toBeGreaterThan(0)
    }
  })

  test('pins the scanner summary to the frozen corpus and the reviewed contract', () => {
    const summary = JSON.parse(
      readFileSync(path.join(REVIEW_DIRECTORY, 'scanner-summary.json'), 'utf8'),
    ) as {
      pdfs_scanned: number
      pages_scanned: number
      pages_with_candidates: number
      scanner_candidates: number
      dispositions_assigned: number
      unhandled_scanner_candidates: number
      high_risk_documents: string[]
      disposition_counts: Record<string, number>
    }
    expect(summary).toMatchObject({
      pdfs_scanned: 115,
      pages_scanned: 2609,
      scanner_candidates: sourceCompletenessCount('corpus_scan_candidates'),
      dispositions_assigned: sourceCompletenessCount('corpus_scan_candidates'),
      unhandled_scanner_candidates: 0,
    })
    expect(summary.high_risk_documents).toHaveLength(
      sourceCompletenessCount('corpus_scan_high_risk_documents'),
    )
    const dispositionTotal = Object.values(summary.disposition_counts).reduce(
      (total, count) => total + count,
      0,
    )
    expect(dispositionTotal).toBe(summary.scanner_candidates)
    expect(summary.disposition_counts.new_exact_product_candidate).toBeGreaterThanOrEqual(
      sourceCompletenessCount('old_corpus_products'),
    )
  })

  test('covers all 2,609 corpus pages and all 115 documents in the coverage artifacts', () => {
    const pages = csvRows('old-corpus-page-coverage.csv')
    expect(pages).toHaveLength(2609)
    const documents = csvRows('old-corpus-document-summary.csv')
    expect(documents).toHaveLength(115)
    const dispositionColumns = [
      'accepted_new_products',
      'existing_exact',
      'existing_alias_or_format_variant',
      'previously_accounted_csv',
      'duplicate_source_occurrence',
      'needs_owner_review',
      'relevant_but_insufficient_identity',
      'relevant_family_level_only',
      'source_evidence_conflicted',
      'irrelevant_to_current_scope',
      'not_a_product_identifier',
    ]
    for (const document of documents) {
      const total = dispositionColumns.reduce((sum, column) => sum + Number(document[column]), 0)
      expect(total).toBe(Number(document.candidate_count))
    }
    const summedPages = documents.reduce((sum, document) => sum + Number(document.page_count), 0)
    expect(summedPages).toBe(2609)
  })

  test('reconciles the mandated Cook, Novatech, and Blue Rhino cohorts in the ledger', () => {
    const dispositions = csvRows('old-corpus-candidate-dispositions.csv')
    const byKey = new Map(
      dispositions.map((row) => [`${row.source_filename} ${row.normalized_identifier}`, row]),
    )
    const thalQuick = 'Thal-Quick Chest Tube Set and Tray _ Cook Medical.pdf'
    for (const [order, reference] of [
      ['G06885', 'CTQTSY1000'],
      ['G05464', 'CTQTSY1200'],
      ['G07090', 'CTQTSY1400'],
      ['G04220', 'CTQTSY2400'],
    ]) {
      expect(byKey.get(`${thalQuick} ${order}`)?.disposition).toBe('new_exact_product_candidate')
      expect(byKey.get(`${thalQuick} ${reference}`)?.disposition).toBe(
        'duplicate_source_occurrence',
      )
    }
    // Existing tray order numbers stay existing; their in-row references pair to them.
    expect(byKey.get(`${thalQuick} G05462`)?.disposition).toBe('existing_exact')
    expect(byKey.get(`${thalQuick} CTQTSY1600`)?.disposition).toBe(
      'existing_alias_or_format_variant',
    )

    const novatech = 'NOV-MR-PCA-SST_DUMON-GSS_CA001_EN.pdf'
    for (const sentinel of ['01TD1120', '01Y121010', '01ST121012', '025301S20']) {
      expect(byKey.get(`${novatech} ${sentinel}`)?.disposition).toBe('new_exact_product_candidate')
    }
    expect(byKey.get(`${novatech} 01TD1260`)?.disposition).toBe('existing_exact')
    const spanish = 'novatech__stents_pulmonares__catalogo.pdf'
    expect(byKey.get(`${spanish} 01TD1120`)?.disposition).toBe('new_exact_product_candidate')

    const blueRhino =
      'Blue Rhino® G2-Multi Percutaneous Tracheostomy Introducer Sets and Trays _ Cook Medical.pdf'
    for (const order of ['G57682', 'G57694', 'G57709', 'G57719', 'G57723']) {
      expect(byKey.get(`${blueRhino} ${order}`)?.disposition).toBe('new_exact_product_candidate')
    }
    expect(byKey.get(`${blueRhino} CPTISY100HCGNAEVAC85`)?.disposition).toBe(
      'duplicate_source_occurrence',
    )
    expect(byKey.get(`${blueRhino} G57703`)?.disposition).toBe('existing_exact')
    // The original CSV row 468 captured this reference with a wrap-artifact space
    // ("C-PTISY-100-HC-G- NA"), so normalization resolves it as CSV-accounted.
    expect(byKey.get(`${blueRhino} CPTISY100HCGNA`)?.disposition).toBe('previously_accounted_csv')
  })

  test('reconciles every product-level discovery row into exactly one controlled disposition', () => {
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
    expect(csvRows('missing-from-original-csv.csv')).toHaveLength(243)
    expect(csvRows('owner-supplied-products.csv')).toHaveLength(40)
    expect(csvRows('new-product-additions.csv')).toHaveLength(
      sourceCompletenessCount('new_exact_products'),
    )
    expect(csvRows('existing-product-matches.csv')).toHaveLength(4)
    expect(csvRows('unresolved-relevant-products.csv')).toHaveLength(22)
    expect(csvRows('irrelevant-products.csv')).toHaveLength(9)
    expect(csvRows('duplicate-analysis.csv')).toHaveLength(232)
    expect(csvRows('manufacturer-summary.csv')).toHaveLength(11)
    expect(csvRows('old-corpus-table-page-coverage.csv')).toHaveLength(6)
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
        relative_path?: string | null
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
      runtime_governed_source_count: 18,
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

    // The correction binds the frozen old-corpus ordering captures to governed sources and
    // records exactly the accepted products each one supports.
    const thalQuick = manifest.sources.find((source) =>
      (source.relative_path ?? '').endsWith(
        'Thal-Quick Chest Tube Set and Tray _ Cook Medical.pdf',
      ),
    )
    expect(thalQuick?.governed_source_ids).toContain('SRC105')
    expect(thalQuick?.canonical_additions_supported?.map((row) => row.catalog_number)).toEqual([
      'G04220',
      'G05464',
      'G06885',
      'G07090',
    ])
    const novatech = manifest.sources.find((source) =>
      (source.relative_path ?? '').endsWith('NOV-MR-PCA-SST_DUMON-GSS_CA001_EN.pdf'),
    )
    expect(novatech?.governed_source_ids).toContain('SRC106')
    expect(novatech?.canonical_additions_supported).toHaveLength(141)
    const blueRhino = manifest.sources.find((source) =>
      (source.relative_path ?? '').includes('Blue Rhino® G2-Multi'),
    )
    expect(blueRhino?.canonical_additions_supported?.map((row) => row.catalog_number)).toEqual(
      expect.arrayContaining(['G57682', 'G57694', 'G57709', 'G57719', 'G57723']),
    )

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
