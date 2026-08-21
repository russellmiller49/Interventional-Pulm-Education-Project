import { stableId } from './catalog-utils'
import {
  expandSourceCompletenessProducts,
  SOURCE_COMPLETENESS_DISPOSITIONS,
  SOURCE_COMPLETENESS_REVIEW,
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
      old_corpus_exact_products_absent_from_original_csv: 0,
    })
    expect(SOURCE_COMPLETENESS_REVIEW.corpus_audit.previously_unreferenced_files).toHaveLength(4)
  })

  test('reconciles the complete 63-row discovery cohort with one controlled disposition each', () => {
    const candidates = [
      ...products,
      ...SOURCE_COMPLETENESS_REVIEW.existing_matches,
      ...SOURCE_COMPLETENESS_REVIEW.non_addition_candidates,
    ]
    expect(candidates).toHaveLength(63)
    const allowed = new Set(SOURCE_COMPLETENESS_DISPOSITIONS)
    for (const candidate of SOURCE_COMPLETENESS_REVIEW.non_addition_candidates) {
      expect(allowed.has(candidate.disposition)).toBe(true)
    }
    expect(products.every((product) => product.disposition === 'new_exact_product_candidate')).toBe(
      true,
    )
  })

  test('emits exactly 44 deterministic exact additions: 35 owner-supplied and 9 web-follow-up', () => {
    expect(products).toHaveLength(44)
    expect(products.filter((product) => product.origin === 'owner_pdf')).toHaveLength(35)
    expect(products.filter((product) => product.origin === 'official_web_follow_up')).toHaveLength(
      9,
    )
    expect(new Set(products.map((product) => product.catalogNumber)).size).toBe(44)
    expect(
      new Set(
        products.map((product) =>
          stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
        ),
      ).size,
    ).toBe(44)
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
    expect(SOURCE_COMPLETENESS_REVIEW.sources).toHaveLength(16)
    expect(SOURCE_COMPLETENESS_REVIEW.evidence_manifest).toHaveLength(33)
    expect(
      new Set(SOURCE_COMPLETENESS_REVIEW.evidence_manifest.map((row) => row.evidenceId)).size,
    ).toBe(33)
    for (const evidence of SOURCE_COMPLETENESS_REVIEW.evidence_manifest) {
      expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/u)
      expect(evidence.retrievedOn).toBe('2026-08-20')
    }
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
