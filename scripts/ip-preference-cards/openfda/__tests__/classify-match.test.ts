import { classifyOpenFdaMatch } from '../classify-match'
import {
  acmeAliasGroup,
  catalogProduct,
  matchedCandidate,
  openFdaRecord,
  verificationBacklog,
} from './fixtures'

describe('openFDA match classification safety rules', () => {
  it('classifies one exact canonical DI match as high confidence', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ gtin: '00012345678901' }),
      aliasGroup: acmeAliasGroup,
      candidates: [matchedCandidate(openFdaRecord(), ['primary_di'])],
    })
    expect(result.classification).toBe('high_confidence_candidate')
    expect(result.reasonCodes).toContain('exact_existing_di_match')
  })

  it('demotes an exact DI when the explicit manufacturer alias does not agree', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ gtin: '00012345678901' }),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(openFdaRecord({ company_name: 'Adjacent Manufacturer Incorporated' }), [
          'primary_di',
        ]),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        'high_confidence_invariant_failed',
        'high_confidence_invariant_manufacturer_alias_mismatch',
      ]),
    )
  })

  it('demotes an exact DI when the candidate catalog number is an adjacent SKU', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ gtin: '00012345678901' }),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(
          openFdaRecord({
            catalog_number: 'CAT-002',
            version_or_model_number: 'CAT-001',
          }),
          ['primary_di'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        'high_confidence_invariant_catalog_mismatch',
        'high_confidence_invariant_adjacent_sku',
      ]),
    )
  })

  it('demotes a DI hit when another eligible package configuration shares the catalog', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ gtin: '00012345678901' }),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(openFdaRecord({ public_device_record_key: 'record-each' }), [
          'primary_di',
          'catalog_number',
        ]),
        matchedCandidate(
          openFdaRecord({
            public_device_record_key: 'record-box',
            identifiers: [
              { id: '00012345678902', type: 'Primary', issuing_agency: 'GS1' },
              {
                id: '00012345678903',
                type: 'Package',
                issuing_agency: 'GS1',
                package_type: 'Box',
              },
            ],
            device_count_in_base_package: 5,
          }),
          ['catalog_number'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        'high_confidence_invariant_failed',
        'high_confidence_invariant_non_unique_eligible_candidate',
        'high_confidence_invariant_package_level_ambiguity',
      ]),
    )
  })

  it('demotes a package DI hit when it disagrees with the record Primary DI', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ gtin: '00012345678999' }),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(
          openFdaRecord({
            identifiers: [
              { id: '00012345678901', type: 'Primary', issuing_agency: 'GS1' },
              { id: '00012345678999', type: 'Package', issuing_agency: 'GS1' },
            ],
          }),
          ['primary_di'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('high_confidence_invariant_existing_di_mismatch')
  })

  it('requires review when an exact DI record contradicts model/configuration evidence', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ gtin: '00012345678901' }),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(openFdaRecord({ version_or_model_number: 'CONFLICTING-MODEL' }), [
          'primary_di',
        ]),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('model_or_configuration_conflict')
  })

  it('classifies unique exact catalog plus approved manufacturer alias as high confidence', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      candidates: [matchedCandidate()],
    })
    expect(result.classification).toBe('high_confidence_candidate')
    expect(result.reasonCodes).toContain('exact_catalog_and_approved_manufacturer_alias')
  })

  it('requires review for exact catalog with manufacturer conflict', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      candidates: [matchedCandidate(openFdaRecord({ company_name: 'Different Medical LLC' }))],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('catalog_match_manufacturer_conflict')
  })

  it('requires review when multiple records share the exact catalog', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(openFdaRecord({ public_device_record_key: 'record-001' })),
        matchedCandidate(openFdaRecord({ public_device_record_key: 'record-002' })),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('multiple_candidate_records')
  })

  it('requires review for a model-only match', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(
          openFdaRecord({ catalog_number: 'OTHER', version_or_model_number: 'CAT-001' }),
          ['model_number'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('model_only_match')
  })

  it('requires review when only an alternate identifier matches', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct({ alternate_ids: 'ALT-001' }),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(
          openFdaRecord({
            catalog_number: 'OTHER',
            version_or_model_number: 'ALT-001',
          }),
          ['alternate_identifier'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('alternate_identifier_only_match')
  })

  it('never promotes product-family/name-only evidence to high confidence', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      candidates: [
        matchedCandidate(
          openFdaRecord({
            catalog_number: 'OTHER',
            version_or_model_number: 'OTHER',
            brand_name: 'Acme Biopsy Device',
          }),
          ['brand_fallback'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('product_family_fallback_only')
  })

  it('surfaces and demotes an existing backlog DI conflict', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      backlog: verificationBacklog({ suggested_primary_di: '00012345678999' }),
      candidates: [matchedCandidate()],
    })
    expect(result.classification).toBe('review_required')
    expect(result.backlogComparison).toBe('conflicts_with_existing_di')
    expect(result.reasonCodes).toContain('existing_backlog_di_conflict')
  })

  it('uses an exact backlog DI to rank same-catalog package records without promoting them', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      backlog: verificationBacklog({
        suggested_primary_di: '00012345678902',
        distribution_status: 'In Commercial Distribution',
      }),
      candidates: [
        matchedCandidate(
          openFdaRecord({
            public_device_record_key: 'record-old',
            identifiers: [{ id: '00012345678901', type: 'Primary' }],
            commercial_distribution_status: 'Not in Commercial Distribution',
          }),
          ['catalog_number'],
        ),
        matchedCandidate(
          openFdaRecord({
            public_device_record_key: 'record-current',
            identifiers: [{ id: '00012345678902', type: 'Primary' }],
          }),
          ['primary_di', 'catalog_number'],
        ),
      ],
    })
    expect(result.classification).toBe('review_required')
    expect(result.selectedCandidateSummary?.primary_di).toBe('00012345678902')
    expect(result.backlogComparison).toBe('agrees_with_existing_backlog')
    expect(result.reasonCodes).toContain('multiple_candidate_records')
  })

  it('requires review when distribution status is missing', () => {
    const result = classifyOpenFdaMatch({
      product: catalogProduct(),
      aliasGroup: acmeAliasGroup,
      candidates: [matchedCandidate(openFdaRecord({ commercial_distribution_status: null }))],
    })
    expect(result.classification).toBe('review_required')
    expect(result.reasonCodes).toContain('distribution_status_unclear')
  })
})
