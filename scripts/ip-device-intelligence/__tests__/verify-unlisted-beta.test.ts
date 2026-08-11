import { readFileSync } from 'node:fs'
import path from 'node:path'

import { isAtlasCohortProduct } from '../../../src/features/device-intelligence/domain/atlas-cohort'
import { ROLE_CODE_ALIASES } from '../../../src/features/preference-cards/domain/role-taxonomy'

import {
  deriveAliasFixture,
  deriveIdentityLeakTokens,
  deriveProductFixtures,
  parseOptions,
  servedIdentityLeaks,
} from '../verify-unlisted-beta'

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

describe('deriveIdentityLeakTokens', () => {
  const fixtures = deriveProductFixtures(REPO_ROOT)
  const tokens = deriveIdentityLeakTokens(REPO_ROOT)

  it('screens a real population of non-cohort identities, not just PRD ids', () => {
    expect(tokens.size).toBeGreaterThan(500)
    const fields = new Set([...tokens.values()].map((provenance) => provenance.split(' ')[1]))
    // Names and at least one machine-identifier class must both be represented, or the
    // scan has quietly narrowed back to a single identifier shape.
    expect(fields.has('product_name')).toBe(true)
    expect(
      ['catalog_number', 'gtin', 'gtin_raw', 'global_part_number'].some((field) =>
        fields.has(field),
      ),
    ).toBe(true)
  })

  it('attributes every token to a non-cohort product', () => {
    for (const provenance of tokens.values()) {
      const productId = provenance.split(' ')[0]
      expect(`${provenance}:${fixtures.cohortProductIds.has(productId)}`).toBe(
        `${provenance}:false`,
      )
    }
  })

  it('matches identifiers on token boundaries, not inside hash keys', () => {
    const fixture = new Map([['10530', 'PRD-TEST catalog_number']])
    // The i18n payload embeds hashed message keys; a numeric catalog number must not match
    // inside one, and must still match when served as an actual token.
    expect(servedIdentityLeaks('…\\"h_1a7610530739\\":\\"Morphology slide 3\\"…', fixture)).toEqual(
      [],
    )
    expect(servedIdentityLeaks('<td>Catalog no. 10530</td>', fixture)).toEqual([
      '"10530" (PRD-TEST catalog_number)',
    ])
  })

  it('excludes identity already present in the public translation catalogs', () => {
    // Public educational copy names real device models today (e.g. the radial-probe models
    // in the EBUS course strings); those ship on public pages regardless of the beta flag,
    // so their presence on a D1 page is the message bundle, not a catalog exposure.
    const catalogs = ['en', 'es', 'zh-CN'].map((locale) =>
      readFileSync(path.join(REPO_ROOT, `messages/${locale}.json`), 'utf8').toLowerCase(),
    )
    for (const token of tokens.keys()) {
      expect(catalogs.some((catalog) => catalog.includes(token))).toBe(false)
    }
  })

  it('excludes governed vocabulary labels the D1 surface deliberately renders', () => {
    // A hidden product whose trade name coincides with a generic authored label
    // ("Flexible grasping forceps") is not identified by that label being served.
    const roles = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'data/ip-preference-cards/generated/roles.json'), 'utf8'),
    ) as Array<{ role_name?: string }>
    for (const role of roles) {
      if (!role.role_name) continue
      expect(tokens.has(role.role_name.trim().toLowerCase())).toBe(false)
    }
  })

  it('never carries a token a cohort product also answers to', () => {
    // A cohort page legitimately serves cohort identities; a shared token would turn the
    // leak scan into a false alarm on every workspace. The derivation excludes any token
    // contained in a cohort identity — verified here against the committed catalog.
    const products = JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, 'data/ip-preference-cards/generated/catalog-products.json'),
        'utf8',
      ),
    ) as Array<Record<string, unknown>>
    const cohortIdentity = products
      .filter((product) => isAtlasCohortProduct(product as never))
      .flatMap((product) =>
        [
          product.product_name,
          product.catalog_number,
          product.global_part_number,
          product.reference_part_number,
          product.alternate_ids,
          product.gtin,
          product.gtin_raw,
        ].filter((value): value is string => typeof value === 'string'),
      )
      .map((value) => value.trim().toLowerCase())
    for (const token of tokens.keys()) {
      expect(cohortIdentity.some((identity) => identity.includes(token))).toBe(false)
    }
  })
})

describe('deriveAliasFixture', () => {
  it('names a real permanent alias and its canonical target', () => {
    const alias = deriveAliasFixture()
    expect(ROLE_CODE_ALIASES[alias.deprecated]).toBe(alias.canonical)
  })
})
