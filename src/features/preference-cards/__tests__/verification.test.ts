import {
  catalogVerificationTier,
  isCatalogVerified,
  isUsStatusPending,
} from '../domain/verification'

// Status strings below are copied verbatim from data/ip-preference-cards/generated/catalog-products.json.
describe('catalog verification tiers', () => {
  it('treats a sourced product as verified', () => {
    const product = {
      verification_grade: 'verified_source',
      visibility_state: 'prototype_visible',
      verification_status: 'Verified - manufacturer catalog',
    }
    expect(catalogVerificationTier(product)).toBe('verified')
    expect(isCatalogVerified(product)).toBe(true)
    expect(isUsStatusPending(product)).toBe(false)
  })

  it('treats a user-seeded product as a candidate', () => {
    const product = {
      verification_grade: 'candidate',
      visibility_state: 'hidden',
      verification_status: 'Candidate - user seed; primary source required',
    }
    expect(catalogVerificationTier(product)).toBe('candidate')
    expect(isCatalogVerified(product)).toBe(false)
  })

  it('flags sourced-but-hidden products as pending U.S. status rather than unverified', () => {
    const product = {
      verification_grade: 'verified_source',
      visibility_state: 'hidden',
      verification_status: 'Verified - manufacturer catalog; current U.S. status pending',
    }
    expect(catalogVerificationTier(product)).toBe('verified')
    expect(isUsStatusPending(product)).toBe(true)
  })

  it('does not flag U.S. status pending for unsourced hidden products', () => {
    expect(isUsStatusPending({ verification_grade: 'candidate', visibility_state: 'hidden' })).toBe(
      false,
    )
  })

  it('falls back to unknown for missing or unexpected grades', () => {
    expect(catalogVerificationTier({})).toBe('unknown')
    expect(catalogVerificationTier({ verification_grade: null })).toBe('unknown')
    expect(catalogVerificationTier({ verification_grade: 'something-new' })).toBe('unknown')
  })
})
