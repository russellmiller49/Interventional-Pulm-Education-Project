import { z } from 'zod'

import { immutableShadowValue, sha256ShadowValue } from './canonical'

export const SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION =
  'literature-shadow-development-scope/1.0.0' as const
export const LITERATURE_DEVELOPMENT_MEMBERSHIP_PROJECTION_VERSION =
  'literature-gold-development-membership-v1' as const
export const LITERATURE_DEVELOPMENT_COHORT_SIZE = 630 as const
export const PINNED_DEVELOPMENT_MEMBERSHIP_SHA256 =
  '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c' as const

// This authority exists only so unit tests can exercise the same 630-row cryptographic boundary
// without reading or committing any real development identity.
export const SYNTHETIC_DEVELOPMENT_MEMBERSHIP_SHA256 =
  'b66459a0e79ad9d192f5e73a52bb8bb80756dbd77a33aa0537753ed574cda22a' as const

const SCOPE_BRAND: unique symbol = Symbol('authorized-development-shadow-scope')
const authorizedMembership = new WeakMap<object, ReadonlySet<string>>()

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const pmidSchema = z.string().regex(/^[0-9]{1,12}$/u)
const canonicalUuidSchema = z
  .string()
  .uuid()
  .refine((value) => value === value.toLowerCase(), 'Item UUIDs must be canonical lowercase text.')

export const developmentMembershipProjectionSchema = z
  .object({
    projectionVersion: z.literal(LITERATURE_DEVELOPMENT_MEMBERSHIP_PROJECTION_VERSION),
    datasetSplit: z.literal('development'),
    items: z
      .array(
        z
          .object({
            itemId: canonicalUuidSchema,
            pmid: pmidSchema,
          })
          .strict(),
      )
      .length(LITERATURE_DEVELOPMENT_COHORT_SIZE),
  })
  .strict()

const authoritySchema = z
  .object({
    authorityId: z.enum([
      'gold-v2-development-membership-v1',
      'shadow-core-synthetic-test-membership-v1',
    ]),
    membershipSha256: sha256Schema,
  })
  .strict()

const developmentScopeRequestSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION),
    purpose: z.literal('development_only_shadow_r_and_d'),
    datasetSplit: z.literal('development'),
    queue: z.literal('development'),
    membershipSelection: z.literal('exact_checksum_bound_projection'),
    complementDerived: z.literal(false),
    heldOutIdentityInputCount: z.literal(0),
    testQueueInspected: z.literal(false),
    allQueueInspected: z.literal(false),
    authority: authoritySchema,
    membership: developmentMembershipProjectionSchema,
  })
  .strict()

export interface DevelopmentShadowScopeDescriptor {
  schemaVersion: typeof SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION
  purpose: 'development_only_shadow_r_and_d'
  datasetSplit: 'development'
  queue: 'development'
  membershipSelection: 'exact_checksum_bound_projection'
  developmentCohortSize: typeof LITERATURE_DEVELOPMENT_COHORT_SIZE
  developmentMembershipSha256: string
  membershipAuthorityId:
    'gold-v2-development-membership-v1' | 'shadow-core-synthetic-test-membership-v1'
  authorityClass: 'real_development_membership' | 'synthetic_fixture'
  experimentEligible: boolean
  fullDevelopmentCohortClaimAuthorized: boolean
  heldOutIdentityInputCount: 0
  heldOutAccessed: false
  complementDerived: false
  testQueueInspected: false
  allQueueInspected: false
}

/**
 * Opaque at compile time and authenticated by a private WeakMap at runtime. A copied or
 * structurally forged descriptor is never accepted as a scope capability.
 */
export interface AuthorizedDevelopmentShadowScope extends DevelopmentShadowScopeDescriptor {
  readonly [SCOPE_BRAND]: typeof SCOPE_BRAND
}

function expectedAuthoritySha256(
  authorityId: z.infer<typeof authoritySchema>['authorityId'],
): string {
  return authorityId === 'gold-v2-development-membership-v1'
    ? PINNED_DEVELOPMENT_MEMBERSHIP_SHA256
    : SYNTHETIC_DEVELOPMENT_MEMBERSHIP_SHA256
}

function normalizedProjection(
  membership: z.infer<typeof developmentMembershipProjectionSchema>,
): z.infer<typeof developmentMembershipProjectionSchema> {
  const itemIds = new Set<string>()
  const pmids = new Set<string>()
  for (const item of membership.items) {
    if (itemIds.has(item.itemId)) throw new Error(`Duplicate development item UUID ${item.itemId}.`)
    if (pmids.has(item.pmid)) throw new Error(`Duplicate development PMID ${item.pmid}.`)
    itemIds.add(item.itemId)
    pmids.add(item.pmid)
  }

  return {
    ...membership,
    items: [...membership.items].sort((left, right) =>
      left.itemId.localeCompare(right.itemId, 'en'),
    ),
  }
}

export function authorizeDevelopmentShadowScope(
  rawRequest: unknown,
): AuthorizedDevelopmentShadowScope {
  const request = developmentScopeRequestSchema.parse(rawRequest)
  const projection = normalizedProjection(request.membership)
  const projectionSha256 = sha256ShadowValue(projection)
  const expectedSha256 = expectedAuthoritySha256(request.authority.authorityId)

  if (request.authority.membershipSha256 !== expectedSha256) {
    throw new Error('Development membership authority is not an approved exact authority.')
  }
  if (projectionSha256 !== request.authority.membershipSha256) {
    throw new Error(
      'Development membership projection does not match its approved exact authority; test, all, complement, or substituted membership is forbidden.',
    )
  }

  const descriptor: DevelopmentShadowScopeDescriptor = {
    schemaVersion: SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
    purpose: 'development_only_shadow_r_and_d',
    datasetSplit: 'development',
    queue: 'development',
    membershipSelection: 'exact_checksum_bound_projection',
    developmentCohortSize: LITERATURE_DEVELOPMENT_COHORT_SIZE,
    developmentMembershipSha256: projectionSha256,
    membershipAuthorityId: request.authority.authorityId,
    authorityClass:
      request.authority.authorityId === 'gold-v2-development-membership-v1'
        ? 'real_development_membership'
        : 'synthetic_fixture',
    experimentEligible: request.authority.authorityId === 'gold-v2-development-membership-v1',
    fullDevelopmentCohortClaimAuthorized:
      request.authority.authorityId === 'gold-v2-development-membership-v1',
    heldOutIdentityInputCount: 0,
    heldOutAccessed: false,
    complementDerived: false,
    testQueueInspected: false,
    allQueueInspected: false,
  }
  const scope = { ...immutableShadowValue(descriptor) } as AuthorizedDevelopmentShadowScope
  Object.defineProperty(scope, SCOPE_BRAND, { value: SCOPE_BRAND })
  authorizedMembership.set(scope, new Set(projection.items.map((item) => item.pmid)))
  return Object.freeze(scope)
}

export function developmentShadowScopeDescriptor(
  scope: AuthorizedDevelopmentShadowScope,
): Readonly<DevelopmentShadowScopeDescriptor> {
  assertAuthorizedDevelopmentShadowScope(scope)
  return immutableShadowValue({ ...scope }) as Readonly<DevelopmentShadowScopeDescriptor>
}

export function assertAuthorizedDevelopmentShadowScope(
  scope: AuthorizedDevelopmentShadowScope,
): void {
  if (!authorizedMembership.has(scope) || scope[SCOPE_BRAND] !== SCOPE_BRAND) {
    throw new Error('A structurally forged or copied development shadow scope is not authorized.')
  }
}

export function assertDevelopmentArticleAuthorized(
  scope: AuthorizedDevelopmentShadowScope,
  pmid: string,
): void {
  assertAuthorizedDevelopmentShadowScope(scope)
  const parsedPmid = pmidSchema.parse(pmid)
  if (!authorizedMembership.get(scope)?.has(parsedPmid)) {
    throw new Error('Article is not an exact member of the authorized development projection.')
  }
}
