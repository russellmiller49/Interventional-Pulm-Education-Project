import { stableId } from './catalog-utils'
import {
  expandSourceCompletenessProducts,
  SOURCE_COMPLETENESS_DISPOSITIONS,
  SOURCE_COMPLETENESS_REVIEW,
  sourceCompletenessCount,
} from './source-completeness-intake'

describe('source-first completeness reviewed intake', () => {
  const products = expandSourceCompletenessProducts()

  test('pins the unchanged prior corpus inventory instead of treating the CSV as exhaustive', () => {
    expect(SOURCE_COMPLETENESS_REVIEW.corpus_audit).toMatchObject({
      current_total_files: 127,
      supported_source_files: 125,
      pdf_files: 115,
      html_files: 7,
      markdown_files: 3,
      total_pdf_pages: 2609,
      present_in_prior_manifest: 125,
      added_since_prior_manifest: 0,
      missing_since_prior_manifest: 0,
      hash_mismatches: 0,
      unreferenced_files_with_relevant_exact_products: 0,
      old_corpus_exact_products_absent_from_original_csv: 184,
    })
    expect(SOURCE_COMPLETENESS_REVIEW.corpus_audit.previously_unreferenced_files).toHaveLength(4)
  })

  test('reconciles the complete reviewed discovery cohort with one controlled disposition each', () => {
    const candidates = [
      ...products,
      ...SOURCE_COMPLETENESS_REVIEW.existing_matches,
      ...SOURCE_COMPLETENESS_REVIEW.non_addition_candidates,
    ]
    expect(candidates).toHaveLength(sourceCompletenessCount('discovery_rows'))
    const allowed = new Set(SOURCE_COMPLETENESS_DISPOSITIONS)
    for (const candidate of SOURCE_COMPLETENESS_REVIEW.non_addition_candidates) {
      expect(allowed.has(candidate.disposition)).toBe(true)
    }
    expect(products.every((product) => product.disposition === 'new_exact_product_candidate')).toBe(
      true,
    )
  })

  test('emits the single reviewed count contract across all three origins', () => {
    expect(products).toHaveLength(sourceCompletenessCount('new_exact_products'))
    expect(products.filter((product) => product.origin === 'owner_pdf')).toHaveLength(
      sourceCompletenessCount('owner_pdf_products'),
    )
    expect(products.filter((product) => product.origin === 'official_web_follow_up')).toHaveLength(
      sourceCompletenessCount('official_web_products'),
    )
    expect(products.filter((product) => product.origin === 'old_corpus')).toHaveLength(
      sourceCompletenessCount('old_corpus_products'),
    )
    expect(new Set(products.map((product) => product.catalogNumber)).size).toBe(products.length)
    expect(
      new Set(
        products.map((product) =>
          stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
        ),
      ).size,
    ).toBe(products.length)
  })

  test('covers every required owner and known-Medtronic sentinel without adding duplicates', () => {
    const accepted = new Set(products.map((product) => product.catalogNumber))
    const existing = new Set(
      SOURCE_COMPLETENESS_REVIEW.existing_matches.flatMap((match) => [
        match.catalogNumber,
        match.alternateId,
      ]),
    )
    const held = new Set(
      SOURCE_COMPLETENESS_REVIEW.non_addition_candidates
        .map((candidate) => candidate.catalogNumber)
        .filter(Boolean),
    )
    const required = [
      '1899200',
      '1899076',
      '1884035HRE',
      '1884033HRE',
      '1884033',
      '1884032',
      '10040001',
      '20030001',
      '30030000',
      '30030001',
      '41010000',
      '30030303',
      '30030010',
      '00020019',
      '31010008',
      'ENDO-BV-22G-Kit-O',
      'ENDO-FR-22G-Kit-O',
      'MCB-1000-Kit',
      'MCB-1000-4',
      'CC-1000-4',
      'TRD1-06030',
      'TRD1-07030',
      'TRD1-08030',
      'TRD1-09030',
      'TRD1-10030',
      'TRD1-12040',
      'TRD1-14540',
      'TRD1-16040',
      'TRD1-18040',
      'BR-M22',
      'BR-M32',
      'BR-M40',
      'BR-M50',
      'BR-M58',
      'BR-M40H',
      'BR-M52H',
      'BR-M58H',
      'S012-01-200',
      'S012-01-100',
      'S012-01-019',
      'S012-01-016',
      'S012-01-015',
      'G34281',
      'G34279',
      'G34282',
      'G34280',
      '4CN65R',
      '5CN70R',
      '6CN75R',
      '7CN75R',
      '8CN85R',
      '9CN90R',
      '10CN10R',
      '4UN65R',
      '5UN70R',
      '6UN75R',
      '7UN80R',
      '8UN85R',
      '9UN90R',
      '10UN10R',
      '50XLTCP',
      '60XLTCP',
      '70XLTCP',
      '80XLTCP',
      '50XLTUP',
      '60XLTUP',
      '70XLTUP',
      '80XLTUP',
    ]
    for (const sentinel of required) {
      expect(accepted.has(sentinel) || existing.has(sentinel) || held.has(sentinel)).toBe(true)
    }
    expect(accepted.has('00020019')).toBe(false)
    expect(existing.size).toBe(8)
  })

  test('preserves legal-manufacturer/distributor identity and exact package distinctions', () => {
    const byCatalog = new Map(products.map((product) => [product.catalogNumber, product]))
    expect(byCatalog.get('10040001')).toMatchObject({
      manufacturer: 'Axess Vision Technology S.A.S.',
      distributor: 'TSC Life US',
    })
    expect(byCatalog.get('MCB-1000-4')).toMatchObject({
      manufacturer: 'Serpex Medical',
      distributor: 'Thoracent',
    })
    expect(byCatalog.get('BR-M50')).toMatchObject({
      manufacturer: 'Shenzhen HugeMed Medical Technical Development Co., Ltd.',
      distributor: 'EndoTherapeutics',
      gtin: '06970462546085',
    })
    expect(byCatalog.get('30030000')?.gtin ?? null).toBeNull()
    expect(byCatalog.get('30030001')?.gtin).toBe('03664977030032')
    expect(byCatalog.get('ENDO-BV-22G-Kit-O')).toMatchObject({
      alternateIds: 'ENDO-BV-22G-O; Primary DI 00850081350033',
      gtin: '10850081350030',
    })
  })

  test('hashes every newly used owner, manufacturer, and FDA evidence artifact', () => {
    expect(SOURCE_COMPLETENESS_REVIEW.sources).toHaveLength(18)
    expect(SOURCE_COMPLETENESS_REVIEW.evidence_manifest).toHaveLength(33)
    expect(
      new Set(SOURCE_COMPLETENESS_REVIEW.evidence_manifest.map((row) => row.evidenceId)).size,
    ).toBe(33)
    for (const evidence of SOURCE_COMPLETENESS_REVIEW.evidence_manifest) {
      expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/u)
      expect(evidence.retrievedOn).toBe('2026-08-20')
      expect(evidence.supportedCatalogNumbers.length).toBeGreaterThan(0)
      expect(new Set(evidence.supportedCatalogNumbers).size).toBe(
        evidence.supportedCatalogNumbers.length,
      )
    }
  })

  test('reconciles all 14 Shiley R-series rows and preserves the 7CN source conflict', () => {
    const accepted = products
      .filter((product) => product.origin === 'old_corpus' && product.catalogNumber.endsWith('R'))
      .map((product) => product.catalogNumber)
    const conflict = SOURCE_COMPLETENESS_REVIEW.non_addition_candidates.find(
      (candidate) => candidate.catalogNumber === '7CN75R',
    )
    expect(accepted).toHaveLength(sourceCompletenessCount('shiley_products_added'))
    expect(accepted).not.toContain('7CN75R')
    expect(accepted).not.toContain('7CN80R')
    expect(conflict).toMatchObject({
      disposition: 'source_evidence_conflicted',
      ownerReviewRequired: true,
    })
    expect(accepted.length + (conflict ? 1 : 0)).toBe(
      sourceCompletenessCount('shiley_candidates_reconciled'),
    )
  })

  test('preserves corrected clinical facts and restrained evidence scopes', () => {
    const byCatalog = new Map(products.map((product) => [product.catalogNumber, product]))
    expect(byCatalog.get('MCB-1000-4')).toMatchObject({
      alternateIds: 'MCB-1000',
      sterileStatus: 'Sterile',
    })
    expect(byCatalog.get('MCB-1000-Kit')?.alternateIds ?? null).toBeNull()
    expect(byCatalog.get('MCB-1000-Kit')?.sterileStatus ?? null).toBeNull()
    expect(byCatalog.get('CC-1000-4')?.sterileStatus).toBe('Nonsterile')
    expect(byCatalog.get('S012-01-015')?.productName).toBe('CLR Port Cap')
    expect(byCatalog.get('41010000')?.packageUom).toBe('Box of 10')
    for (const catalogNumber of ['30030303', '30030010', '31010008']) {
      expect(byCatalog.get(catalogNumber)?.packageUom ?? null).toBeNull()
    }
    expect(byCatalog.get('1899200')?.roleCode).toBe('RIGID_BRONCH_SHAVER')
    expect(byCatalog.get('1899200')?.notes).not.toMatch(/exact airway blade cohort/iu)

    const praxis = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.find(
      (source) => source.evidenceId === 'EVID-SC-006',
    )
    const hugeMed = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.find(
      (source) => source.evidenceId === 'EVID-SC-010',
    )
    expect(praxis?.scope).toBe('family_level')
    expect(hugeMed?.supportedCatalogNumbers).toEqual([
      'BR-M22',
      'BR-M32',
      'BR-M40',
      'BR-M50',
      'BR-M58',
    ])
  })

  test('keeps five exact candidates in owner review and nine ENT-only products out of scope', () => {
    const review = SOURCE_COMPLETENESS_REVIEW.non_addition_candidates.filter(
      (candidate) => candidate.disposition === 'needs_owner_review',
    )
    const irrelevant = SOURCE_COMPLETENESS_REVIEW.non_addition_candidates.filter(
      (candidate) => candidate.disposition === 'irrelevant_to_current_scope',
    )
    expect(review.map((candidate) => candidate.catalogNumber).sort()).toEqual(
      ['00020019', '1882924HRE', '1883524', '1884024', '1884031'].sort(),
    )
    expect(irrelevant).toHaveLength(9)
  })
})
