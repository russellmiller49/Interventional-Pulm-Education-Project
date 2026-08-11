/** @jest-environment node */

import { createHash } from 'node:crypto'

import { canonicalJson } from './gold-import-compensation-migration-operations'
import { reconciliationIdentitySha256 } from './gold-import-compensation-contract-reconciliation'
import {
  PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES,
  assertProtectedV2CatalogObservationMatchesExpectedArtifact,
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  committedProtectedV2CatalogExpectedArtifacts,
  compareProtectedV2CatalogObservationToExpectedArtifact,
  decodeProtectedV2CatalogExpectedInventories,
  expectedObservedAuditIdentityFromArtifact,
  parseProtectedV2CatalogExpectedArtifact,
  rawCommittedProtectedV2CatalogExpectedArtifact,
  type ProtectedV2CatalogExpectedArtifact,
  type ProtectedV2CatalogNormalizedInventories,
  type ProtectedV2CatalogObservationForExpectation,
} from './gold-import-contract-v2-catalog-expectations'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function observation(
  artifact: ProtectedV2CatalogExpectedArtifact,
): ProtectedV2CatalogObservationForExpectation {
  return {
    identity: expectedObservedAuditIdentityFromArtifact(artifact),
    normalizedInventories: decodeProtectedV2CatalogExpectedInventories(artifact),
    profileId: artifact.profileId,
    target: artifact.target,
  }
}

function recomputeObservationIdentity(
  base: ProtectedV2CatalogObservationForExpectation,
  normalizedInventories: ProtectedV2CatalogNormalizedInventories,
): ProtectedV2CatalogObservationForExpectation {
  const fullInventory = normalizedInventories.fullEnvironmentInventory as {
    schemaSecurityDefinitionIdentity: { records: unknown[] }
  }
  const content = {
    ...base.identity,
    componentIdentities: Object.fromEntries(
      PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES.map((name) => [
        name,
        reconciliationIdentitySha256(normalizedInventories.componentInputs[name]),
      ]),
    ),
    fullEnvironmentInventoryIdentitySha256: reconciliationIdentitySha256(
      normalizedInventories.fullEnvironmentInventory,
    ),
    fullEnvironmentInventoryRecordCount:
      fullInventory.schemaSecurityDefinitionIdentity.records.length,
    localPostgresOwnerProfileIdentitySha256: reconciliationIdentitySha256(
      normalizedInventories.deploymentProfileIdentity,
    ),
  }
  const identityContent = { ...content }
  delete (identityContent as { fullAuditIdentitySha256?: string }).fullAuditIdentitySha256
  return {
    ...base,
    identity: {
      ...identityContent,
      fullAuditIdentitySha256: reconciliationIdentitySha256(identityContent),
    } as typeof base.identity,
    normalizedInventories,
  }
}

function repairArtifactEnvelope(
  artifactInput: ProtectedV2CatalogExpectedArtifact,
): ProtectedV2CatalogExpectedArtifact {
  const artifact = clone(artifactInput)
  artifact.fullAuditIdentitySha256 =
    expectedObservedAuditIdentityFromArtifact(artifact).fullAuditIdentitySha256
  const content = { ...artifact }
  delete (content as { artifactContentSha256?: string }).artifactContentSha256
  artifact.artifactContentSha256 = sha256(canonicalJson(content))
  return artifact
}

function reverseTopLevelRecordArrays(inventories: ProtectedV2CatalogNormalizedInventories): void {
  for (const component of Object.values(inventories.componentInputs)) {
    for (const value of Object.values(component as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        value.reverse()
      } else if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) if (Array.isArray(nested)) nested.reverse()
      }
    }
  }
  const full = inventories.fullEnvironmentInventory as {
    deploymentProfile: { roleInventory: unknown[] }
    rpcs: unknown[]
    schemaSecurityDefinitionIdentity: { records: unknown[] }
  }
  full.rpcs.reverse()
  full.schemaSecurityDefinitionIdentity.records.reverse()
  full.deploymentProfile.roleInventory.reverse()
}

describe('protected V2 exact catalog expectations', () => {
  const adminArtifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
    'supabase_admin_owner_v1',
    'disposable',
  )

  it('parses both committed artifacts and recomputes their complete hash graph', () => {
    for (const artifact of committedProtectedV2CatalogExpectedArtifacts()) {
      expect(parseProtectedV2CatalogExpectedArtifact(artifact)).toEqual(artifact)
      expect(
        assertProtectedV2CatalogObservationMatchesExpectedArtifact(observation(artifact), artifact),
      ).toMatchObject({ passed: true, differences: [] })
    }
  })

  it('rejects component and profile tampering even after enclosing hashes are recomputed', () => {
    const componentTamper = clone(adminArtifact)
    componentTamper.componentIdentities.columns = 'a'.repeat(64)
    expect(() =>
      parseProtectedV2CatalogExpectedArtifact(repairArtifactEnvelope(componentTamper)),
    ).toThrow('identities do not match normalized inventories')

    const profileTamper = clone(adminArtifact)
    profileTamper.expectedDeploymentProfileIdentitySha256 = 'b'.repeat(64)
    expect(() =>
      parseProtectedV2CatalogExpectedArtifact(repairArtifactEnvelope(profileTamper)),
    ).toThrow('identities do not match normalized inventories')
  })

  it('rejects encoded inventory and artifact-self-identity tampering', () => {
    const inventoryTamper = clone(adminArtifact)
    inventoryTamper.normalizedInventory.compressedBase64 = `${inventoryTamper.normalizedInventory.compressedBase64.slice(0, -4)}AAAA`
    expect(() =>
      parseProtectedV2CatalogExpectedArtifact(repairArtifactEnvelope(inventoryTamper)),
    ).toThrow()

    const selfTamper = clone(adminArtifact)
    selfTamper.artifactContentSha256 = 'c'.repeat(64)
    expect(() => parseProtectedV2CatalogExpectedArtifact(selfTamper)).toThrow(
      'artifact content identity drifted',
    )
  })

  it('rejects non-canonical base64 even after the artifact self-identity is repaired', () => {
    const nonCanonicalBase64 = clone(adminArtifact)
    nonCanonicalBase64.normalizedInventory.compressedBase64 =
      nonCanonicalBase64.normalizedInventory.compressedBase64.replace(/=+$/u, '')
    expect(() =>
      parseProtectedV2CatalogExpectedArtifact(repairArtifactEnvelope(nonCanonicalBase64)),
    ).toThrow('normalized inventory is not canonical base64')
  })

  it('derives the invariant from normalized inventory and rejects a repaired envelope', () => {
    const invariantTamper = clone(adminArtifact)
    invariantTamper.environmentInvariantIdentitySha256 = 'd'.repeat(64)
    expect(() =>
      parseProtectedV2CatalogExpectedArtifact(repairArtifactEnvelope(invariantTamper)),
    ).toThrow('identities do not match normalized inventories')
  })

  it('uses map-based record comparison independent of array order', () => {
    const actual = observation(adminArtifact)
    const reordered = clone(actual.normalizedInventories)
    reverseTopLevelRecordArrays(reordered)
    const comparison = compareProtectedV2CatalogObservationToExpectedArtifact(
      { ...actual, normalizedInventories: reordered },
      adminArtifact,
    )
    expect(comparison).toMatchObject({ passed: true, differences: [] })
  })

  it('reports a stable changed record and first normalized field for same-key drift', () => {
    const expected = observation(adminArtifact)
    const inventories = clone(expected.normalizedInventories)
    const tables = (
      inventories.componentInputs.rlsPolicies as {
        details: { tables: Array<{ owner: string; table_name: string }> }
      }
    ).details.tables
    const changed = tables[0]!
    changed.owner = 'postgres'
    const actual = recomputeObservationIdentity(expected, inventories)
    const comparison = compareProtectedV2CatalogObservationToExpectedArtifact(actual, adminArtifact)
    expect(comparison.passed).toBe(false)
    expect(comparison.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'rlsPolicies',
          firstDifferingField: '$.owner',
          kind: 'changed_record',
          recordKey: `details.tables:${changed.table_name}`,
          source: 'details.tables',
        }),
      ]),
    )
  })

  it('reports a missing record field without attempting to canonicalize undefined', () => {
    const expected = observation(adminArtifact)
    const inventories = clone(expected.normalizedInventories)
    const columns = (
      inventories.componentInputs.columns as {
        details: Array<{ column_name: string; not_null?: boolean; table_name: string }>
      }
    ).details
    const changed = columns[0]!
    delete changed.not_null
    const comparison = compareProtectedV2CatalogObservationToExpectedArtifact(
      recomputeObservationIdentity(expected, inventories),
      adminArtifact,
    )
    expect(comparison.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'columns',
          firstDifferingField: '$.not_null',
          kind: 'changed_record',
          recordKey: `details:${changed.table_name}:${changed.column_name}`,
        }),
      ]),
    )
  })

  it('reports a natural-key substitution as one missing and one unexpected record', () => {
    const expected = observation(adminArtifact)
    const inventories = clone(expected.normalizedInventories)
    const columns = (
      inventories.componentInputs.columns as {
        details: Array<{ column_name: string; table_name: string }>
      }
    ).details
    const changed = columns[0]!
    const expectedKey = `details:${changed.table_name}:${changed.column_name}`
    changed.column_name = `${changed.column_name}_substituted`
    const actualKey = `details:${changed.table_name}:${changed.column_name}`
    const comparison = compareProtectedV2CatalogObservationToExpectedArtifact(
      recomputeObservationIdentity(expected, inventories),
      adminArtifact,
    )
    expect(comparison.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'missing_expected_record', recordKey: expectedKey }),
        expect.objectContaining({ kind: 'unexpected_record', recordKey: actualKey }),
      ]),
    )
  })

  it('fails closed on colliding natural record identities', () => {
    const expected = observation(adminArtifact)
    const inventories = clone(expected.normalizedInventories)
    const columns = (inventories.componentInputs.columns as { details: unknown[] }).details
    columns.push(clone(columns[0]))
    expect(() =>
      compareProtectedV2CatalogObservationToExpectedArtifact(
        recomputeObservationIdentity(expected, inventories),
        adminArtifact,
      ),
    ).toThrow('record key collided')
  })

  it('selects statically by validated profile/target with no cross-profile fallback', () => {
    expect(() =>
      committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
        'local_supabase_postgres_owner_v1',
        'disposable',
      ),
    ).toThrow('cannot be used for this target')
    expect(() =>
      committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
        'supabase_admin_owner_v1',
        'local',
      ),
    ).toThrow('cannot be used for this target')
  })

  it('deep-freezes selected artifacts and never exposes imported JSON references', () => {
    expect(Object.isFrozen(adminArtifact)).toBe(true)
    expect(Object.isFrozen(adminArtifact.componentIdentities)).toBe(true)
    const first = rawCommittedProtectedV2CatalogExpectedArtifact('supabase_admin_owner_v1') as {
      profileId: string
    }
    first.profileId = 'mutated-by-caller'
    const second = rawCommittedProtectedV2CatalogExpectedArtifact('supabase_admin_owner_v1') as {
      profileId: string
    }
    expect(second.profileId).toBe('supabase_admin_owner_v1')
  })
})
