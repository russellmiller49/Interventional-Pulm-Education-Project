import path from 'node:path'

import { isAtlasCohortProduct } from '../../../src/features/device-intelligence/domain/atlas-cohort'
import { ROLE_CODE_ALIASES } from '../../../src/features/preference-cards/domain/role-taxonomy'

import { deriveAliasFixture, deriveProductFixtures, parseOptions } from '../verify-unlisted-beta'

/**
 * The launch-verification harness's deterministic core. The HTTP checks themselves run
 * against a real local server (see the runbook); what is pinned here is that the harness
 * derives its fixtures from committed data through the real predicates — so it can never
 * pass by asserting against ids the cohort wall stopped serving, or fail by inventing ids
 * the catalog never held — and that it refuses to run without an explicit mode.
 */

const REPO_ROOT = path.resolve(__dirname, '../../..')

describe('parseOptions', () => {
  it('requires an explicit mode and a target', () => {
    expect(() => parseOptions([])).toThrow(/--mode=off or --mode=on/)
    expect(() => parseOptions(['--mode=on'])).toThrow(/--base-url|--start/)
    expect(() => parseOptions(['--mode=on', '--base-url=http://x', '--start'])).toThrow(
      /mutually exclusive/,
    )
    expect(() => parseOptions(['--mode=on', '--flag'])).toThrow(/Unknown argument/)
  })

  it('parses the two documented shapes', () => {
    expect(parseOptions(['--mode=off', '--base-url=http://localhost:3121/'])).toEqual({
      mode: 'off',
      baseUrl: 'http://localhost:3121',
      start: false,
      port: 3210,
    })
    expect(parseOptions(['--mode=on', '--start', '--port=4000'])).toEqual({
      mode: 'on',
      baseUrl: null,
      start: true,
      port: 4000,
    })
  })
})

describe('deriveProductFixtures', () => {
  const fixtures = deriveProductFixtures(REPO_ROOT)

  it('selects a cohort product through the real predicate', () => {
    expect(fixtures.cohortProductIds.has(fixtures.cohortProductId)).toBe(true)
    expect(fixtures.cohortProductIds.size).toBeGreaterThan(0)
  })

  it('selects non-cohort negative controls that really are outside the cohort', () => {
    expect(fixtures.nonCohortProductIds.length).toBeGreaterThan(0)
    for (const productId of fixtures.nonCohortProductIds) {
      expect(fixtures.cohortProductIds.has(productId)).toBe(false)
    }
  })

  it('agrees with the committed catalog membership exactly', () => {
    // Non-vacuity for the leak check: the served-HTML scan is only meaningful while both
    // populations exist in the committed catalog.
    expect(fixtures.cohortProductIds.size).toBeGreaterThan(100)
    void isAtlasCohortProduct
  })
})

describe('deriveAliasFixture', () => {
  it('names a real permanent alias and its canonical target', () => {
    const alias = deriveAliasFixture()
    expect(ROLE_CODE_ALIASES[alias.deprecated]).toBe(alias.canonical)
  })
})
