import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  REQUIRED_RECONCILIATION_RPCS,
  TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
  reconciliationCanonicalJson,
  reconciliationIdentitySha256,
  type DeploymentProfileEvidence,
  type EnrichedRpcMetadata,
  type RoleSecurityAttributes,
} from './gold-import-compensation-contract-reconciliation'
import {
  normalizePostgresDefinition,
  validateSchemaSecurityDefinitionIdentity,
  type SchemaSecurityDefinitionIdentity,
  type SchemaSecurityDefinitionRecord,
} from './gold-import-compensation-rehearsal-evidence'

export const EXPECTED_SCHEMA_SECURITY_IDENTITY_FIXTURE =
  'scripts/literature/fixtures/post-migration-schema-security-definition-identity.json' as const

export const TRUSTED_LOCAL_SUPABASE_POSTGRES_OWNER_ROLE_INVENTORY_SHA256 =
  TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256

export const TRUSTED_LOCAL_SUPABASE_ROLE_NAMES = [
  'anon',
  'authenticated',
  'postgres',
  'service_role',
  'supabase_admin',
] as const

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function expectedFunctionRecord(
  identity: SchemaSecurityDefinitionIdentity,
  name: string,
): SchemaSecurityDefinitionRecord {
  const matches = identity.records.filter(
    (entry) => entry.objectType === 'function' && entry.objectName === name,
  )
  if (matches.length !== 1) throw new Error(`Expected identity has no unique function ${name}.`)
  return matches[0] as SchemaSecurityDefinitionRecord
}

function expectedFunctionGrants(
  identity: SchemaSecurityDefinitionIdentity,
  name: string,
): EnrichedRpcMetadata['explicitGrants'] {
  return identity.records
    .filter((entry) => entry.objectType === 'function_acl' && entry.objectName === name)
    .map((entry) => {
      const state = record(entry.state, `${name} ACL state`)
      return {
        grantee: string(state.grantee, `${name} ACL grantee`),
        grantor: string(state.grantor, `${name} ACL grantor`),
        isGrantable: boolean(state.isGrantable, `${name} ACL grantable`),
        privilegeType: string(state.privilegeType, `${name} ACL privilege`),
      }
    })
}

function argumentsWithDefaults(definition: string, name: string): string {
  const prefix = `CREATE OR REPLACE FUNCTION public.${name}(`
  const start = definition.indexOf(prefix)
  const end = definition.indexOf(') RETURNS jsonb', start + prefix.length)
  if (start !== 0 || end < 0) {
    throw new Error(`Expected normalized definition for ${name} has an unsupported signature.`)
  }
  return definition.slice(prefix.length, end)
}

/** Build enriched expected RPC evidence exclusively from the checksum-pinned semantic fixture. */
export function buildExpectedContractRpcs(
  identityInput: SchemaSecurityDefinitionIdentity,
): EnrichedRpcMetadata[] {
  const identity = validateSchemaSecurityDefinitionIdentity(identityInput)
  return REQUIRED_RECONCILIATION_RPCS.map((name) => {
    const functionRecord = expectedFunctionRecord(identity, name)
    const state = record(functionRecord.state, `${name} function state`)
    const identityArguments = string(state.identityArguments, `${name} identity arguments`)
    const normalizedDefinition = normalizePostgresDefinition(functionRecord.normalizedDefinition)
    const explicitGrants = expectedFunctionGrants(identity, name)
    const rawAcl = `{${explicitGrants
      .map(({ grantee, grantor }) => `${grantee}=X/${grantor}`)
      .join(',')}}`
    const rawDefinition = normalizedDefinition
    const rawDefinitionSha256 = createHash('sha256').update(rawDefinition).digest('hex')
    return {
      argumentsWithDefaults: argumentsWithDefaults(normalizedDefinition, name),
      configuration: ['search_path=pg_catalog, public, extensions'],
      definitionSha256: functionRecord.definitionSha256,
      dependencies: [
        {
          dependencyType: 'n',
          referencedClass: 'pg_language',
          referencedIdentity: 'language plpgsql',
        },
        {
          dependencyType: 'n',
          referencedClass: 'pg_namespace',
          referencedIdentity: 'schema public',
        },
      ],
      effectiveExecute: {
        PUBLIC: false,
        anon: false,
        authenticated: false,
        service_role: true,
      },
      explicitGrants,
      identityArguments,
      language: 'plpgsql',
      name,
      normalizedDefinition,
      objectIdentity: `public.${name}(${identityArguments})`,
      overloadCount: 1,
      owner: 'supabase_admin',
      parallelSafety: 'unsafe',
      rawAcl,
      rawDefinition,
      rawDefinitionSha256,
      resultType: string(state.resultType, `${name} result type`),
      routineKind: 'function',
      schema: 'public',
      searchPath: {
        actual: 'pg_catalog, public, extensions',
        entries: ['search_path=pg_catalog, public, extensions'],
        expected: 'pg_catalog, public, extensions',
        matchesExpected: true,
      },
      securityDefiner: boolean(state.securityDefiner, `${name} security definer`),
      securityMode: 'definer',
      volatility: string(state.volatility, `${name} volatility`) === 's' ? 'stable' : 'volatile',
    }
  })
}

export async function loadExpectedSchemaSecurityIdentity(
  repositoryRoot: string,
): Promise<SchemaSecurityDefinitionIdentity> {
  const bytes = await readFile(resolve(repositoryRoot, EXPECTED_SCHEMA_SECURITY_IDENTITY_FIXTURE))
  return validateSchemaSecurityDefinitionIdentity(JSON.parse(bytes.toString('utf8')) as unknown)
}

export function trustedLocalDeploymentProfileEvidence(
  roles: readonly RoleSecurityAttributes[],
): DeploymentProfileEvidence {
  const roleInventory = JSON.parse(reconciliationCanonicalJson(roles)) as unknown
  if (!Array.isArray(roleInventory)) {
    throw new Error('Local Supabase role inventory must be a JSON array.')
  }
  const roleNames = roleInventory.map((role) =>
    role && typeof role === 'object' && !Array.isArray(role)
      ? (role as Record<string, unknown>).roleName
      : null,
  )
  if (
    reconciliationCanonicalJson(roleNames) !==
    reconciliationCanonicalJson(TRUSTED_LOCAL_SUPABASE_ROLE_NAMES)
  ) {
    throw new Error(
      `Local Supabase role inventory must contain exactly ${TRUSTED_LOCAL_SUPABASE_ROLE_NAMES.join(', ')} in deterministic order.`,
    )
  }
  const actualSha256 = reconciliationIdentitySha256(roleInventory)
  if (actualSha256 !== TRUSTED_LOCAL_SUPABASE_POSTGRES_OWNER_ROLE_INVENTORY_SHA256) {
    throw new Error(
      `Local Supabase role inventory differs from the trusted profile: ${actualSha256}.`,
    )
  }
  return {
    profileId: 'local_supabase_postgres_owner_v1',
    roleInventory: roleInventory as RoleSecurityAttributes[],
    target: 'local',
  }
}
