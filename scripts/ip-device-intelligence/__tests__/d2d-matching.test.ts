import type { RegulatoryMatchLevel } from '@/features/device-intelligence/domain/product-regulatory'

import { proposeRegulatoryMatch } from '../d2d/matching'
import type { AcquisitionManifest, PilotCohortArtifact } from '../d2d/schemas'

type Result = AcquisitionManifest['results'][number]
type Candidate = Result['candidates'][number]

const emptyCandidate: Candidate = {
  record_key: 'RK-1',
  primary_di: null,
  package_dis: [],
  company_name: null,
  brand_name: null,
  catalog_number: null,
  model_number: null,
  device_name: null,
  k_number: null,
  pma_number: null,
  decision_code: null,
  decision_date: null,
  product_code: null,
  regulation_number: null,
  commercial_distribution_status: null,
  publish_date: null,
}

function result(
  candidates: Candidate[],
  purpose: Result['purpose'] = 'exact_identity',
  complete = true,
): Result {
  return {
    query_id: `D2D-Q-TEST-${purpose.toUpperCase().replace('_', '-')}`,
    product_id: 'PRD-2632FFBF07',
    dataset: 'udi',
    endpoint: 'https://api.fda.gov/device/udi.json',
    api_schema_version: 'fixture-v1',
    normalization_method_version: 'd2d-acquisition-candidate-normalization-v1',
    response_content_type: 'application/json',
    query: 'fixture:"value"',
    purpose,
    expected_scope: 'exact',
    dataset_last_updated: null,
    retrieved_at: ['2026-08-24T00:00:00.000Z'],
    response_sha256s: ['a'.repeat(64)],
    raw_cache_references: [
      `local-data/ip-device-intelligence/d2d/2026-08-24/openfda/udi/${'b'.repeat(64)}.json`,
    ],
    result_total: candidates.length,
    result_count: candidates.length,
    complete,
    http_statuses: [candidates.length ? 200 : 404],
    pages: [],
    candidates,
  }
}

const aliases: PilotCohortArtifact['manufacturer_aliases'] = [
  {
    manufacturer_id: 'MFR-AXESSVISION',
    canonical_name: 'Axess Vision Technology',
    aliases: ['AXESS VISION TECHNOLOGY', 'TSC Life / Axess Vision Technology'],
  },
]

const identity = {
  manufacturer_id: 'MFR-AXESSVISION',
  manufacturer: 'Axess Vision Technology',
  catalog_number: '0010040001-X',
  gtin: '03664977000103',
}

function match(results: Result[]): RegulatoryMatchLevel {
  return proposeRegulatoryMatch({ identity, results, aliases }).match_level
}

describe('D2D-A deterministic regulatory matching', () => {
  it('requires an exact DI and catalog/model token for the highest-precedence match', () => {
    const candidate = {
      ...emptyCandidate,
      primary_di: '03664977000103',
      model_number: '0010040001-X',
      company_name: 'AXESS VISION TECHNOLOGY',
    }
    const proposal = proposeRegulatoryMatch({ identity, results: [result([candidate])], aliases })
    expect(proposal).toMatchObject({
      match_level: 'exact_udi_catalog_match',
      confidence: 'high',
      conflict_state: 'none',
    })
  })

  it('normalizes punctuation and case but preserves leading zeroes and suffixes', () => {
    expect(
      match([
        result([
          {
            ...emptyCandidate,
            model_number: '0010040001 x',
            company_name: 'Axess Vision Technology',
          },
        ]),
      ]),
    ).toBe('exact_model_manufacturer_match')

    expect(
      match([
        result([
          {
            ...emptyCandidate,
            model_number: '10040001-X',
            company_name: 'Axess Vision Technology',
          },
        ]),
      ]),
    ).toBe('ambiguous')
    expect(
      match([
        result([
          {
            ...emptyCandidate,
            model_number: '0010040001',
            company_name: 'Axess Vision Technology',
          },
        ]),
      ]),
    ).toBe('ambiguous')
  })

  it('fails closed on a material manufacturer conflict', () => {
    const proposal = proposeRegulatoryMatch({
      identity,
      aliases,
      results: [
        result([
          {
            ...emptyCandidate,
            primary_di: identity.gtin,
            model_number: identity.catalog_number,
            company_name: 'Different Legal Manufacturer LLC',
          },
        ]),
      ],
    })
    expect(proposal).toMatchObject({
      match_level: 'ambiguous',
      confidence: 'unresolved',
      conflict_state: 'manufacturer_mismatch',
    })
  })

  it('distinguishes exact premarket, family, and product-code-only candidates', () => {
    expect(
      match([
        result([
          {
            ...emptyCandidate,
            model_number: identity.catalog_number,
            company_name: 'Axess Vision Technology',
            k_number: 'K261068',
          },
        ]),
      ]),
    ).toBe('exact_premarket_submission_match')

    expect(
      match([
        result(
          [
            {
              ...emptyCandidate,
              company_name: 'Axess Vision Technology',
              k_number: 'K261068',
            },
          ],
          'premarket',
        ),
      ]),
    ).toBe('family_level_match')

    expect(match([result([{ ...emptyCandidate, product_code: 'GEH' }], 'classification')])).toBe(
      'product_code_only',
    )
  })

  it('uses no-exact only after every configured official search purpose completed', () => {
    const completeSearch = [
      result([], 'exact_identity'),
      result([], 'premarket'),
      result([], 'classification'),
      result([], 'registration_listing'),
    ]
    expect(match(completeSearch)).toBe('no_exact_record_found')
    expect(match(completeSearch.slice(0, 3))).toBe('ambiguous')
    expect(match([])).toBe('not_searched')
  })

  it('marks distinct duplicate exact records ambiguous instead of choosing one', () => {
    const candidates = ['RK-ONE', 'RK-TWO'].map((recordKey) => ({
      ...emptyCandidate,
      record_key: recordKey,
      primary_di: identity.gtin,
      model_number: identity.catalog_number,
      company_name: 'Axess Vision Technology',
    }))
    expect(
      proposeRegulatoryMatch({ identity, results: [result(candidates)], aliases }),
    ).toMatchObject({
      match_level: 'ambiguous',
      conflict_state: 'conflicting_exact_records',
    })
  })
})
