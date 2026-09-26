import {
  SHADOW_AUTONOMY_POLICY_VERSION,
  SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
  SYNTHETIC_DEVELOPMENT_MEMBERSHIP_SHA256,
  assertAuthorizedDevelopmentShadowScope,
  assertDevelopmentArticleAuthorized,
  authorizeDevelopmentShadowScope,
  developmentShadowScopeDescriptor,
  resolveShadowAutonomyPolicy,
  type AuthorizedDevelopmentShadowScope,
} from '../shadow-classifier'

import {
  syntheticDevelopmentMembership,
  syntheticDevelopmentScope,
} from './shadow-classifier-fixtures'

function request(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
    purpose: 'development_only_shadow_r_and_d',
    datasetSplit: 'development',
    queue: 'development',
    membershipSelection: 'exact_checksum_bound_projection',
    complementDerived: false,
    heldOutIdentityInputCount: 0,
    testQueueInspected: false,
    allQueueInspected: false,
    authority: {
      authorityId: 'shadow-core-synthetic-test-membership-v1',
      membershipSha256: SYNTHETIC_DEVELOPMENT_MEMBERSHIP_SHA256,
    },
    membership: syntheticDevelopmentMembership(),
    ...overrides,
  }
}

describe('shadow classifier held-out boundary', () => {
  it.each([
    ['test dataset split', { datasetSplit: 'test' }],
    ['test queue', { queue: 'test' }],
    ['all queue', { queue: 'all' }],
    ['complement selection', { complementDerived: true }],
    ['held-out identity input', { heldOutIdentityInputCount: 1 }],
    ['test queue inspection', { testQueueInspected: true }],
    ['all queue inspection', { allQueueInspected: true }],
  ])('rejects %s before issuing a capability', (_name, overrides) => {
    expect(() => authorizeDevelopmentShadowScope(request(overrides))).toThrow()
  })

  it('requires exactly 630 unique numeric identities bound to an approved checksum', () => {
    const missing = syntheticDevelopmentMembership()
    missing.items.pop()
    expect(() => authorizeDevelopmentShadowScope(request({ membership: missing }))).toThrow()

    const duplicate = syntheticDevelopmentMembership()
    duplicate.items[1].pmid = duplicate.items[0].pmid
    expect(() => authorizeDevelopmentShadowScope(request({ membership: duplicate }))).toThrow(
      /Duplicate development PMID/u,
    )

    const substituted = syntheticDevelopmentMembership()
    substituted.items[0].pmid = '99999999'
    expect(() => authorizeDevelopmentShadowScope(request({ membership: substituted }))).toThrow(
      /does not match/u,
    )
  })

  it('issues an opaque runtime-authenticated capability and rejects structural copies', () => {
    const scope = syntheticDevelopmentScope()
    expect(() => assertAuthorizedDevelopmentShadowScope(scope)).not.toThrow()
    expect(() => assertDevelopmentArticleAuthorized(scope, '10000000')).not.toThrow()
    expect(() => assertDevelopmentArticleAuthorized(scope, '99999999')).toThrow(
      /not an exact member/u,
    )

    const forged = { ...scope } as AuthorizedDevelopmentShadowScope
    expect(() => assertAuthorizedDevelopmentShadowScope(forged)).toThrow(/forged or copied/u)
  })

  it('permanently labels the synthetic fixture as experiment-ineligible', () => {
    expect(developmentShadowScopeDescriptor(syntheticDevelopmentScope())).toMatchObject({
      authorityClass: 'synthetic_fixture',
      experimentEligible: false,
      fullDevelopmentCohortClaimAuthorized: false,
      heldOutAccessed: false,
    })
  })

  it('caps runtime autonomy at level one and rejects every claimed production effect', () => {
    const base = {
      schemaVersion: SHADOW_AUTONOMY_POLICY_VERSION,
      requestedLevel: 1,
      developmentOnly: true,
      productionEnabled: false,
      automaticEffects: {
        publish: false,
        hide: false,
        exclude: false,
        changeRelevance: false,
        changeVisibility: false,
        changeGoldLabel: false,
        moveCurrentReviewPointer: false,
        revealSupplementalMetadata: false,
        revealAutomatedSignals: false,
        unlockTestData: false,
        writeDatabase: false,
      },
    }
    expect(resolveShadowAutonomyPolicy(base).configuredLevel).toBe(1)
    expect(() => resolveShadowAutonomyPolicy({ ...base, requestedLevel: 2 })).toThrow(/capped/u)
    expect(() =>
      resolveShadowAutonomyPolicy({
        ...base,
        automaticEffects: { ...base.automaticEffects, exclude: true },
      }),
    ).toThrow()
  })
})
