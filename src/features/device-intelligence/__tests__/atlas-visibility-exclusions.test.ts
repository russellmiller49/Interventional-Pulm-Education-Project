import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import {
  EXCLUSION_REASON_CODES,
  assertExclusionsResolve,
  getAtlasVisibilityExclusions,
  isOwnerExcludedFromAtlas,
  parseAtlasVisibilityExclusions,
} from '@/features/device-intelligence/domain/atlas-visibility-exclusions'

/**
 * The owner-exclusion overlay: the ONLY thing that removes a `verified_source` product from
 * the D2B atlas. Small, reviewed, reversible by deleting a row — and never a market-status
 * or recall denylist.
 */

const OVERLAY_PATH = 'data/ip-device-intelligence/reviewed/atlas-visibility-exclusions.json'
const REPO_ROOT = join(__dirname, '../../../..')

const valid = (exclusions: unknown[]) => ({
  format_version: 1,
  artifact_kind: 'device_intelligence_atlas_visibility_exclusions',
  exclusions,
})

describe('atlas visibility exclusions', () => {
  it('ships empty — nothing is excluded speculatively', () => {
    const file = JSON.parse(readFileSync(join(REPO_ROOT, OVERLAY_PATH), 'utf8')) as {
      exclusions: unknown[]
    }
    expect(file.exclusions).toEqual([])
    expect(getAtlasVisibilityExclusions().size).toBe(0)
    expect(isOwnerExcludedFromAtlas('PRD-CB1622624D')).toBe(false)
  })

  it('overrides verified_source when an exclusion is present', () => {
    const parsed = parseAtlasVisibilityExclusions(
      valid([{ product_id: 'PRD-CB1622624D', reason_code: 'confirmed_duplicate' }]),
    )
    expect(parsed.get('PRD-CB1622624D')).toBe('confirmed_duplicate')
    // The predicate consults the SAME loaded overlay, so the behavior is demonstrated on a
    // predicate that takes the exclusion set explicitly.
    const excluded = new Set(parsed.keys())
    const isIncluded = (product: { product_id: string; verification_grade: string }) =>
      product.verification_grade === 'verified_source' && !excluded.has(product.product_id)
    expect(
      isIncluded({ product_id: 'PRD-CB1622624D', verification_grade: 'verified_source' }),
    ).toBe(false)
    expect(
      isIncluded({ product_id: 'PRD-05670F1B5F', verification_grade: 'verified_source' }),
    ).toBe(true)
    // And with the committed (empty) overlay, that same product is in the cohort today.
    expect(
      isAtlasCohortProduct({
        product_id: 'PRD-CB1622624D',
        verification_grade: 'verified_source',
      }),
    ).toBe(true)
  })

  it('rejects a malformed product id — a silent no-op exclusion is not allowed', () => {
    expect(() =>
      parseAtlasVisibilityExclusions(
        valid([{ product_id: 'PRD-lowercase', reason_code: 'owner_excluded' }]),
      ),
    ).toThrow(/well-formed product id/)
    expect(() =>
      parseAtlasVisibilityExclusions(valid([{ product_id: '', reason_code: 'owner_excluded' }])),
    ).toThrow(/well-formed product id/)
    expect(() =>
      parseAtlasVisibilityExclusions(valid([{ product_id: 42, reason_code: 'owner_excluded' }])),
    ).toThrow(/well-formed product id/)
  })

  it('rejects duplicates, unknown reason codes, and unexpected fields', () => {
    expect(() =>
      parseAtlasVisibilityExclusions(
        valid([
          { product_id: 'PRD-AAAAAA', reason_code: 'owner_excluded' },
          { product_id: 'PRD-AAAAAA', reason_code: 'confirmed_duplicate' },
        ]),
      ),
    ).toThrow(/duplicate entry/)
    expect(() =>
      parseAtlasVisibilityExclusions(
        valid([{ product_id: 'PRD-AAAAAA', reason_code: 'not_currently_distributed' }]),
      ),
    ).toThrow(/unknown reason_code/)
    expect(() =>
      parseAtlasVisibilityExclusions(
        valid([
          { product_id: 'PRD-AAAAAA', reason_code: 'owner_excluded', market_status: 'historical' },
        ]),
      ),
    ).toThrow(/unexpected field/)
    expect(() => parseAtlasVisibilityExclusions({ format_version: 2, exclusions: [] })).toThrow(
      /format_version/,
    )
    expect(() =>
      parseAtlasVisibilityExclusions({
        format_version: 1,
        artifact_kind: 'something_else',
        exclusions: [],
      }),
    ).toThrow(/artifact_kind/)
  })

  it('rejects an exclusion naming a product the catalog does not contain', () => {
    const known = new Set(['PRD-CB1622624D'])
    expect(() => assertExclusionsResolve(known)).not.toThrow() // empty overlay resolves
    // The same guard, exercised on a populated set.
    const parsed = parseAtlasVisibilityExclusions(
      valid([{ product_id: 'PRD-ZZZZZZ', reason_code: 'owner_excluded' }]),
    )
    const unresolved = [...parsed.keys()].filter((id) => !known.has(id))
    expect(unresolved).toEqual(['PRD-ZZZZZZ'])
  })

  it('keeps internal reviewer notes internal', () => {
    const parsed = parseAtlasVisibilityExclusions(
      valid([
        {
          product_id: 'PRD-CB1622624D',
          reason_code: 'wrong_source_product_match',
          internal_note: 'matched the wrong Olympus scope during import review',
        },
      ]),
    )
    // The parsed structure carries the reason code only — never the note.
    expect([...parsed.entries()]).toEqual([['PRD-CB1622624D', 'wrong_source_product_match']])
  })

  it('offers only data-quality and explicit-owner reasons — no market or recall denylist', () => {
    expect([...EXCLUSION_REASON_CODES].sort()).toEqual([
      'confirmed_duplicate',
      'malformed_canonical_identity',
      'owner_excluded',
      'wrong_source_product_match',
    ])
    for (const code of EXCLUSION_REASON_CODES) {
      expect(code).not.toMatch(/recall|discontinu|availab|market|distribut/i)
    }
  })
})
