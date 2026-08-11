import { createHash } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

import localSupabasePostgresOwnerV1Json from './contracts/protected-v2-complete-catalog/local_supabase_postgres_owner_v1.json'
import supabaseAdminOwnerV1Json from './contracts/protected-v2-complete-catalog/supabase_admin_owner_v1.json'
import { protectedV2CapabilityFreeCanonicalJson as canonicalJson } from './protected-gold-import-contract-v2-capability-free-canonical'
import {
  buildContractInvariantIdentity,
  reconciliationIdentitySha256,
} from './gold-import-compensation-contract-reconciliation'

export const PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION =
  'literature-gold-protected-v2-complete-catalog-expectation/1.0.0' as const
export const PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_SCHEMA_VERSION =
  'literature-gold-protected-v2-complete-catalog-normalized-inventory/1.0.0' as const
export const PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_ENCODING =
  'canonical-json+deflate-raw+base64' as const

export const PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS = [
  'local_supabase_postgres_owner_v1',
  'supabase_admin_owner_v1',
] as const
export type ProtectedV2ExpectedCatalogProfileId =
  (typeof PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS)[number]
export type ProtectedV2ExpectedCatalogTarget = 'disposable' | 'local'

export const PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES = [
  'columns',
  'constraints',
  'functionsRpcsDependencies',
  'indexes',
  'rlsPolicies',
  'tableAclEffectivePrivileges',
  'triggers',
] as const
export type ProtectedV2ExpectedCatalogComponentName =
  (typeof PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES)[number]

/**
 * Model-independent reviewed bindings for the two authorized catalogs. The audit model hashes
 * these values before its own identity and full-audit identities are derived, keeping the graph
 * acyclic while making a committed-artifact substitution change the authorization model.
 */
export const PROTECTED_V2_EXPECTED_CATALOG_AUTHORIZATION_BINDINGS = {
  local_supabase_postgres_owner_v1: {
    componentIdentities: {
      columns: '700aa97d7bec584e9e9f975083d0bc53284a0a31e94ba638cab532de85182c43',
      constraints: 'f243c78d60a074c5602f7621d755187f1af66f965825664d407c9d109a187188',
      functionsRpcsDependencies: 'aae185e74d29416f6e4e9b8f71e9f2f1cde58450057ac6d07262e5bf277dae65',
      indexes: 'ccdf4abd29905bb269c331601d8fa6f59d643892a441475f8626a6cb964aad68',
      rlsPolicies: '0effe15249e2e1962024c193ceeea6c4853272d13fc4534dd3abf183aeeb262c',
      tableAclEffectivePrivileges:
        'b5c79830a1839654039978f6b13e1a9ee52ad032a53a7885d876ae0a8fc96b0f',
      triggers: 'd136915f80a20e060ce89c3ecd8126675212234f6506570b46e46241c195e7dc',
    },
    expectedDeploymentProfileIdentitySha256:
      'a127394a5d2e488957ea5f23e879cf004da2c2297fd14a722a3eb664dbdb9b23',
    fullEnvironmentInventoryIdentitySha256:
      '780241e4b3821972827c3fb4a49ab24131b317a689a589fa688074b761ac2ea1',
    fullEnvironmentInventoryRecordCount: 730,
    normalizedInventoryCanonicalJsonSha256:
      '047412ef2a35a036f4f09c381c088c034397ff3ecac463d43b143e0194b1b4ce',
    profileId: 'local_supabase_postgres_owner_v1',
    target: 'local',
  },
  supabase_admin_owner_v1: {
    componentIdentities: {
      columns: 'd4b6e4db11a015aaf6274658881bed087426fabcf13d3812d3295b1657326b87',
      constraints: '760f8799b028752d519deb7640d630b5fb40aae591c2f1c1dfc60464e0f6ea62',
      functionsRpcsDependencies: 'cb3dfba2d73b771a9c05e156ced7ac44f9e034750c283977fb05d5841e7e2987',
      indexes: 'e2c734ffd7dbf5d56f9a72753be37c43cda5ae8cbc57ba7c1d07005a203bf725',
      rlsPolicies: 'cd5f61bed19fadf2a2b371cb22f22068df7af4d0ddd0930fa30f0cf7fab069ab',
      tableAclEffectivePrivileges:
        '767e8c115b9ec05bda90991ea70dba90f4933c6364ca8c7eeea55256c427eeb0',
      triggers: '41427ecae3177575d78bb8b9cea6dfd00eccf1aa583526737d118a7571536887',
    },
    expectedDeploymentProfileIdentitySha256:
      '4553a3eb6767aa9a9a0456f23d80a350bdacca79ab136b1782946a22bc3944c0',
    fullEnvironmentInventoryIdentitySha256:
      'd7ff00e59059e7695f332cd2b152face4eb0d76ac16cca26a2dd6252d91587c2',
    fullEnvironmentInventoryRecordCount: 823,
    normalizedInventoryCanonicalJsonSha256:
      '5230a1613c7c14301d3783f05f4613409d2ac06ff25ce69ad0c71e49be144844',
    profileId: 'supabase_admin_owner_v1',
    target: 'disposable',
  },
} as const

export const PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY = {
  filename: '20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
  id: '20260809231651_add_literature_gold_import_compensation_contract_v2',
  sha256: '3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1',
  version: '20260809231651',
} as const

export const PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY = {
  filename: '20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
  sha256: '2570f0885ed646247df7dd3e375b835c7591f2750bc190d63845191cd0426eeb',
} as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const MAX_COMPRESSED_INVENTORY_BYTES = 8 * 1024 * 1024
const MAX_CANONICAL_INVENTORY_BYTES = 32 * 1024 * 1024

export interface ProtectedV2CatalogNormalizedInventories {
  componentInputs: Record<ProtectedV2ExpectedCatalogComponentName, unknown>
  deploymentProfileIdentity: unknown
  fullEnvironmentInventory: unknown
  profileId: ProtectedV2ExpectedCatalogProfileId
  schemaVersion: typeof PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_SCHEMA_VERSION
  target: ProtectedV2ExpectedCatalogTarget
}

export interface ProtectedV2CatalogObservedAuditIdentity {
  auditMethod: string
  auditModel: string
  auditModelIdentitySha256: string
  componentIdentities: Record<ProtectedV2ExpectedCatalogComponentName, string>
  environmentInvariantIdentitySha256: string
  fullAuditIdentitySha256: string
  fullEnvironmentInventoryIdentitySha256: string
  fullEnvironmentInventoryRecordCount: number
  localPostgresOwnerProfileIdentitySha256: string
  schemaVersion: string
  verifierExecuted: false
}

export interface ProtectedV2CatalogObservationForExpectation {
  identity: ProtectedV2CatalogObservedAuditIdentity
  normalizedInventories: ProtectedV2CatalogNormalizedInventories
  profileId: ProtectedV2ExpectedCatalogProfileId
  target: ProtectedV2ExpectedCatalogTarget
}

export interface ProtectedV2CatalogExpectedArtifact {
  artifactContentSha256: string
  artifactSchemaVersion: typeof PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION
  auditMethod: string
  auditModel: string
  auditModelIdentitySha256: string
  componentIdentities: Record<ProtectedV2ExpectedCatalogComponentName, string>
  componentRecordCounts: Record<ProtectedV2ExpectedCatalogComponentName, number>
  environmentInvariantIdentitySha256: string
  expectedDeploymentProfileIdentitySha256: string
  fullAuditIdentitySha256: string
  fullEnvironmentInventoryIdentitySha256: string
  fullEnvironmentInventoryRecordCount: number
  migration: typeof PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY
  normalizedInventory: {
    canonicalJsonByteCount: number
    canonicalJsonSha256: string
    compressedBase64: string
    encoding: typeof PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_ENCODING
    recordCount: number
  }
  observedAuditSchemaVersion: string
  profileId: ProtectedV2ExpectedCatalogProfileId
  target: ProtectedV2ExpectedCatalogTarget
  verifier: typeof PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY
  verifierExecuted: false
}

export type ProtectedV2CatalogDifferenceKind =
  | 'changed_record'
  | 'missing_expected_record'
  | 'unexpected_record'

export interface ProtectedV2CatalogRecordDifference {
  actual: unknown | null
  component:
    | ProtectedV2ExpectedCatalogComponentName
    | 'auditIdentity'
    | 'deploymentProfile'
    | 'fullEnvironmentInventory'
  expected: unknown | null
  firstDifferingField: string | null
  kind: ProtectedV2CatalogDifferenceKind
  recordKey: string
  source: string
}

export interface ProtectedV2CatalogExpectationComparison {
  differences: ProtectedV2CatalogRecordDifference[]
  expectedArtifactContentSha256: string
  passed: boolean
  profileId: ProtectedV2ExpectedCatalogProfileId
  target: ProtectedV2ExpectedCatalogTarget
}

interface NormalizedRecordEnvelope {
  component: ProtectedV2CatalogRecordDifference['component']
  recordKey: string
  source: string
  value: unknown
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort(compareCodeUnits)
  const wanted = [...expected].sort(compareCodeUnits)
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label} has unexpected or missing keys.`)
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function requiredSha256(value: unknown, label: string): string {
  const parsed = requiredString(value, label)
  if (!SHA256_PATTERN.test(parsed)) throw new Error(`${label} must be a lowercase SHA-256.`)
  return parsed
}

function requiredInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`)
  }
  return value
}

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

function expectedProfileTarget(
  profileId: ProtectedV2ExpectedCatalogProfileId,
): ProtectedV2ExpectedCatalogTarget {
  switch (profileId) {
    case 'local_supabase_postgres_owner_v1':
      return 'local'
    case 'supabase_admin_owner_v1':
      return 'disposable'
  }
}

function parseProfileId(value: unknown, label: string): ProtectedV2ExpectedCatalogProfileId {
  if (value === 'local_supabase_postgres_owner_v1' || value === 'supabase_admin_owner_v1') {
    return value
  }
  throw new Error(`${label} is not a supported exact catalog profile.`)
}

function parseTarget(value: unknown, label: string): ProtectedV2ExpectedCatalogTarget {
  if (value === 'disposable' || value === 'local') return value
  throw new Error(`${label} is not a supported exact catalog target.`)
}

function parseComponentHashes(
  value: unknown,
  label: string,
): Record<ProtectedV2ExpectedCatalogComponentName, string> {
  const input = record(value, label)
  exactKeys(input, PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES, label)
  return Object.fromEntries(
    PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES.map((name) => [
      name,
      requiredSha256(input[name], `${label}.${name}`),
    ]),
  ) as Record<ProtectedV2ExpectedCatalogComponentName, string>
}

function parseComponentCounts(
  value: unknown,
  label: string,
): Record<ProtectedV2ExpectedCatalogComponentName, number> {
  const input = record(value, label)
  exactKeys(input, PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES, label)
  return Object.fromEntries(
    PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES.map((name) => [
      name,
      requiredInteger(input[name], `${label}.${name}`),
    ]),
  ) as Record<ProtectedV2ExpectedCatalogComponentName, number>
}

function parsePinnedMigration(value: unknown): typeof PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY {
  const parsed = record(value, 'Expected catalog migration identity')
  if (canonicalJson(parsed) !== canonicalJson(PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY)) {
    throw new Error('Expected catalog artifact migration identity drifted.')
  }
  return PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY
}

function parsePinnedVerifier(value: unknown): typeof PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY {
  const parsed = record(value, 'Expected catalog verifier identity')
  if (canonicalJson(parsed) !== canonicalJson(PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY)) {
    throw new Error('Expected catalog artifact verifier identity drifted.')
  }
  return PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY
}

function decodeNormalizedInventories(input: {
  canonicalJsonByteCount: number
  canonicalJsonSha256: string
  compressedBase64: string
  encoding: typeof PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_ENCODING
  recordCount: number
}): ProtectedV2CatalogNormalizedInventories {
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(input.compressedBase64)) {
    throw new Error('Expected catalog normalized inventory is not canonical base64.')
  }
  const compressed = Buffer.from(input.compressedBase64, 'base64')
  if (compressed.toString('base64') !== input.compressedBase64) {
    throw new Error('Expected catalog normalized inventory is not canonical base64.')
  }
  if (compressed.length === 0 || compressed.length > MAX_COMPRESSED_INVENTORY_BYTES) {
    throw new Error('Expected catalog compressed inventory size is invalid.')
  }
  const inflated = inflateRawSync(compressed, { maxOutputLength: MAX_CANONICAL_INVENTORY_BYTES })
  if (
    inflated.length !== input.canonicalJsonByteCount ||
    sha256(inflated) !== input.canonicalJsonSha256
  ) {
    throw new Error('Expected catalog normalized inventory bytes drifted.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(inflated.toString('utf8')) as unknown
  } catch {
    throw new Error('Expected catalog normalized inventory is not canonical JSON.')
  }
  if (canonicalJson(parsed) !== inflated.toString('utf8')) {
    throw new Error('Expected catalog normalized inventory JSON is not canonical.')
  }
  const inventory = record(parsed, 'Expected catalog normalized inventory')
  exactKeys(
    inventory,
    [
      'componentInputs',
      'deploymentProfileIdentity',
      'fullEnvironmentInventory',
      'profileId',
      'schemaVersion',
      'target',
    ],
    'Expected catalog normalized inventory',
  )
  const profileId = parseProfileId(inventory.profileId, 'Expected inventory profileId')
  const target = parseTarget(inventory.target, 'Expected inventory target')
  if (
    inventory.schemaVersion !== PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_SCHEMA_VERSION ||
    target !== expectedProfileTarget(profileId)
  ) {
    throw new Error('Expected catalog normalized inventory profile or schema drifted.')
  }
  const componentInputs = record(inventory.componentInputs, 'Expected component inputs')
  exactKeys(
    componentInputs,
    PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES,
    'Expected component inputs',
  )
  return canonicalClone({
    componentInputs,
    deploymentProfileIdentity: inventory.deploymentProfileIdentity,
    fullEnvironmentInventory: inventory.fullEnvironmentInventory,
    profileId,
    schemaVersion: PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_SCHEMA_VERSION,
    target,
  }) as ProtectedV2CatalogNormalizedInventories
}

function encodedInventory(value: unknown) {
  const parsed = record(value, 'Expected catalog normalizedInventory')
  exactKeys(
    parsed,
    [
      'canonicalJsonByteCount',
      'canonicalJsonSha256',
      'compressedBase64',
      'encoding',
      'recordCount',
    ],
    'Expected catalog normalizedInventory',
  )
  if (parsed.encoding !== PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_ENCODING) {
    throw new Error('Expected catalog normalized inventory encoding drifted.')
  }
  return {
    canonicalJsonByteCount: requiredInteger(
      parsed.canonicalJsonByteCount,
      'Expected inventory canonicalJsonByteCount',
    ),
    canonicalJsonSha256: requiredSha256(
      parsed.canonicalJsonSha256,
      'Expected inventory canonicalJsonSha256',
    ),
    compressedBase64: requiredString(
      parsed.compressedBase64,
      'Expected inventory compressedBase64',
    ),
    encoding: PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_ENCODING,
    recordCount: requiredInteger(parsed.recordCount, 'Expected inventory recordCount'),
  }
}

function schemaSecurityRecords(fullInventoryInput: unknown): unknown[] {
  const fullInventory = record(fullInventoryInput, 'Expected full environment inventory')
  const schemaIdentity = record(
    fullInventory.schemaSecurityDefinitionIdentity,
    'Expected schema/security identity',
  )
  if (!Array.isArray(schemaIdentity.records)) {
    throw new Error('Expected schema/security identity records must be an array.')
  }
  return schemaIdentity.records
}

function componentArrays(componentInput: unknown): Array<{ source: string; values: unknown[] }> {
  const input = record(componentInput, 'Normalized component input')
  const arrays: Array<{ source: string; values: unknown[] }> = []
  for (const [source, value] of Object.entries(input).sort(([left], [right]) =>
    compareCodeUnits(left, right),
  )) {
    if (Array.isArray(value)) {
      arrays.push({ source, values: value })
      continue
    }
    if (!value || typeof value !== 'object') continue
    for (const [nestedSource, nestedValue] of Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => compareCodeUnits(left, right),
    )) {
      if (Array.isArray(nestedValue)) {
        arrays.push({ source: `${source}.${nestedSource}`, values: nestedValue })
      }
    }
  }
  return arrays
}

function optionalField(value: Record<string, unknown>, ...names: string[]): string | null {
  for (const name of names) {
    const field = value[name]
    if (typeof field === 'string') return field
    if (typeof field === 'number' || typeof field === 'boolean') return String(field)
  }
  return null
}

function naturalRecordKey(input: {
  component: ProtectedV2CatalogRecordDifference['component']
  index: number
  source: string
  value: unknown
}): string {
  if (!input.value || typeof input.value !== 'object' || Array.isArray(input.value)) {
    return `${input.source}:index:${input.index}`
  }
  const value = input.value as Record<string, unknown>
  if (input.source.endsWith('records')) {
    const objectType = optionalField(value, 'objectType')
    const objectIdentity = optionalField(value, 'objectIdentity')
    if (objectType && objectIdentity) return `${input.source}:${objectType}:${objectIdentity}`
  }
  if (input.source === 'rpcMetadata' || input.source === 'rpcs' || input.source.endsWith('.rpcs')) {
    const name = optionalField(value, 'name')
    const arguments_ = optionalField(value, 'identityArguments')
    if (name && arguments_ !== null) return `${input.source}:${name}(${arguments_})`
  }
  const table = optionalField(value, 'table_name', 'tableName')
  const candidates = [
    optionalField(value, 'column_name', 'columnName'),
    optionalField(value, 'constraint_name', 'constraintName'),
    optionalField(value, 'index_name', 'indexName'),
    optionalField(value, 'policy_name', 'policyName'),
    optionalField(value, 'trigger_name', 'triggerName'),
  ]
  const namedObject = candidates.find((candidate) => candidate !== null)
  if (table && namedObject) return `${input.source}:${table}:${namedObject}`
  const functionName = optionalField(value, 'function_name', 'functionName')
  const identityArguments = optionalField(value, 'identity_arguments', 'identityArguments')
  if (functionName && identityArguments !== null) {
    const dependencyIdentity = [
      optionalField(value, 'referenced_class', 'referencedClass'),
      optionalField(value, 'referenced_identity', 'referencedIdentity'),
      optionalField(value, 'dependency_type', 'dependencyType'),
    ].filter((entry): entry is string => entry !== null)
    return `${input.source}:${functionName}(${identityArguments})${
      dependencyIdentity.length > 0 ? `:${dependencyIdentity.join(':')}` : ''
    }`
  }
  const role = optionalField(value, 'role_name', 'roleName', 'grantee')
  const privilege = optionalField(value, 'privilege_name', 'privilegeName', 'privilegeType')
  if (table && role && privilege) return `${input.source}:${table}:${role}:${privilege}`
  if (table) return `${input.source}:${table}`
  const roleName = optionalField(value, 'roleName')
  if (roleName) return `${input.source}:${roleName}`
  const profileId = optionalField(value, 'profileId')
  if (profileId) return `${input.source}:${profileId}`
  return `${input.source}:index:${input.index}`
}

function componentRecordEnvelopes(
  componentInputs: Record<ProtectedV2ExpectedCatalogComponentName, unknown>,
): NormalizedRecordEnvelope[] {
  const output: NormalizedRecordEnvelope[] = []
  for (const component of PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES) {
    for (const { source, values } of componentArrays(componentInputs[component])) {
      values.forEach((value, index) => {
        output.push({
          component,
          recordKey: naturalRecordKey({ component, index, source, value }),
          source,
          value: canonicalClone(value),
        })
      })
    }
  }
  assertUniqueRecordKeys(output)
  return output.sort(compareRecordEnvelopes)
}

function fullInventoryRecordEnvelopes(
  inventories: ProtectedV2CatalogNormalizedInventories,
): NormalizedRecordEnvelope[] {
  const full = record(inventories.fullEnvironmentInventory, 'Full environment inventory')
  const schemaIdentity = record(
    full.schemaSecurityDefinitionIdentity,
    'Full environment schema identity',
  )
  const arrays = [
    { source: 'schemaSecurityDefinitionIdentity.records', values: schemaIdentity.records },
    { source: 'rpcs', values: full.rpcs },
    {
      source: 'deploymentProfile.roleInventory',
      values: record(full.deploymentProfile, 'Full environment deployment profile').roleInventory,
    },
  ]
  const output: NormalizedRecordEnvelope[] = []
  for (const { source, values } of arrays) {
    if (!Array.isArray(values)) throw new Error(`Normalized ${source} must be an array.`)
    values.forEach((value, index) => {
      output.push({
        component: 'fullEnvironmentInventory',
        recordKey: naturalRecordKey({
          component: 'fullEnvironmentInventory',
          index,
          source,
          value,
        }),
        source,
        value: canonicalClone(value),
      })
    })
  }
  output.push({
    component: 'deploymentProfile',
    recordKey: 'deploymentProfile:identity',
    source: 'deploymentProfileIdentity',
    value: canonicalClone(inventories.deploymentProfileIdentity),
  })
  assertUniqueRecordKeys(output)
  return output.sort(compareRecordEnvelopes)
}

function compareRecordEnvelopes(left: NormalizedRecordEnvelope, right: NormalizedRecordEnvelope) {
  return compareCodeUnits(
    `${left.component}\0${left.source}\0${left.recordKey}`,
    `${right.component}\0${right.source}\0${right.recordKey}`,
  )
}

function assertUniqueRecordKeys(records: readonly NormalizedRecordEnvelope[]): void {
  const seen = new Set<string>()
  for (const entry of records) {
    const key = `${entry.component}\0${entry.source}\0${entry.recordKey}`
    if (seen.has(key)) {
      throw new Error(`Normalized catalog record key collided: ${entry.recordKey}.`)
    }
    seen.add(key)
  }
}

function componentRecordCounts(
  inventories: ProtectedV2CatalogNormalizedInventories,
): Record<ProtectedV2ExpectedCatalogComponentName, number> {
  const records = componentRecordEnvelopes(inventories.componentInputs)
  return Object.fromEntries(
    PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES.map((component) => [
      component,
      records.filter((entry) => entry.component === component).length,
    ]),
  ) as Record<ProtectedV2ExpectedCatalogComponentName, number>
}

function normalizedRecordCount(inventories: ProtectedV2CatalogNormalizedInventories): number {
  return (
    componentRecordEnvelopes(inventories.componentInputs).length +
    fullInventoryRecordEnvelopes(inventories).length
  )
}

export function expectedObservedAuditIdentityFromArtifact(
  artifact: ProtectedV2CatalogExpectedArtifact,
): ProtectedV2CatalogObservedAuditIdentity {
  const content = {
    auditMethod: artifact.auditMethod,
    auditModel: artifact.auditModel,
    auditModelIdentitySha256: artifact.auditModelIdentitySha256,
    componentIdentities: artifact.componentIdentities,
    environmentInvariantIdentitySha256: artifact.environmentInvariantIdentitySha256,
    fullEnvironmentInventoryIdentitySha256: artifact.fullEnvironmentInventoryIdentitySha256,
    fullEnvironmentInventoryRecordCount: artifact.fullEnvironmentInventoryRecordCount,
    localPostgresOwnerProfileIdentitySha256: artifact.expectedDeploymentProfileIdentitySha256,
    schemaVersion: artifact.observedAuditSchemaVersion,
    verifierExecuted: false as const,
  }
  return {
    ...content,
    fullAuditIdentitySha256: reconciliationIdentitySha256(content),
  }
}

export function parseProtectedV2CatalogExpectedArtifact(
  input: unknown,
): ProtectedV2CatalogExpectedArtifact {
  const parsed = record(input, 'Protected V2 expected catalog artifact')
  exactKeys(
    parsed,
    [
      'artifactContentSha256',
      'artifactSchemaVersion',
      'auditMethod',
      'auditModel',
      'auditModelIdentitySha256',
      'componentIdentities',
      'componentRecordCounts',
      'environmentInvariantIdentitySha256',
      'expectedDeploymentProfileIdentitySha256',
      'fullAuditIdentitySha256',
      'fullEnvironmentInventoryIdentitySha256',
      'fullEnvironmentInventoryRecordCount',
      'migration',
      'normalizedInventory',
      'observedAuditSchemaVersion',
      'profileId',
      'target',
      'verifier',
      'verifierExecuted',
    ],
    'Protected V2 expected catalog artifact',
  )
  const artifactContentSha256 = requiredSha256(
    parsed.artifactContentSha256,
    'Expected artifact content SHA-256',
  )
  const content = { ...parsed }
  delete content.artifactContentSha256
  if (
    parsed.artifactSchemaVersion !== PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION ||
    parsed.verifierExecuted !== false ||
    sha256(canonicalJson(content)) !== artifactContentSha256
  ) {
    throw new Error('Protected V2 expected catalog artifact content identity drifted.')
  }
  const profileId = parseProfileId(parsed.profileId, 'Expected artifact profileId')
  const target = parseTarget(parsed.target, 'Expected artifact target')
  if (target !== expectedProfileTarget(profileId)) {
    throw new Error('Expected catalog artifact profile and target do not match.')
  }
  const normalizedInventory = encodedInventory(parsed.normalizedInventory)
  const inventories = decodeNormalizedInventories(normalizedInventory)
  if (inventories.profileId !== profileId || inventories.target !== target) {
    throw new Error('Expected artifact and normalized inventory profiles differ.')
  }
  const componentIdentities = parseComponentHashes(
    parsed.componentIdentities,
    'Expected component identities',
  )
  const componentRecordCountValues = parseComponentCounts(
    parsed.componentRecordCounts,
    'Expected component record counts',
  )
  const derivedComponentIdentities = Object.fromEntries(
    PROTECTED_V2_EXPECTED_CATALOG_COMPONENT_NAMES.map((name) => [
      name,
      reconciliationIdentitySha256(inventories.componentInputs[name]),
    ]),
  )
  const derivedComponentRecordCounts = componentRecordCounts(inventories)
  const derivedFullInventorySha256 = reconciliationIdentitySha256(
    inventories.fullEnvironmentInventory,
  )
  const derivedProfileSha256 = reconciliationIdentitySha256(inventories.deploymentProfileIdentity)
  const fullEnvironmentInventory = record(
    inventories.fullEnvironmentInventory,
    'Expected full environment inventory',
  )
  if (!Array.isArray(fullEnvironmentInventory.rpcs)) {
    throw new Error('Expected full environment inventory RPCs must be an array.')
  }
  const derivedInvariantSha256 = reconciliationIdentitySha256(
    buildContractInvariantIdentity(
      fullEnvironmentInventory.schemaSecurityDefinitionIdentity as Parameters<
        typeof buildContractInvariantIdentity
      >[0],
      fullEnvironmentInventory.rpcs as Parameters<typeof buildContractInvariantIdentity>[1],
    ),
  )
  const derivedFullInventoryCount = schemaSecurityRecords(
    inventories.fullEnvironmentInventory,
  ).length
  if (
    canonicalJson(componentIdentities) !== canonicalJson(derivedComponentIdentities) ||
    canonicalJson(componentRecordCountValues) !== canonicalJson(derivedComponentRecordCounts) ||
    normalizedInventory.recordCount !== normalizedRecordCount(inventories) ||
    parsed.fullEnvironmentInventoryIdentitySha256 !== derivedFullInventorySha256 ||
    parsed.expectedDeploymentProfileIdentitySha256 !== derivedProfileSha256 ||
    parsed.environmentInvariantIdentitySha256 !== derivedInvariantSha256 ||
    parsed.fullEnvironmentInventoryRecordCount !== derivedFullInventoryCount
  ) {
    throw new Error('Expected catalog artifact identities do not match normalized inventories.')
  }
  const artifact: ProtectedV2CatalogExpectedArtifact = {
    artifactContentSha256,
    artifactSchemaVersion: PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION,
    auditMethod: requiredString(parsed.auditMethod, 'Expected auditMethod'),
    auditModel: requiredString(parsed.auditModel, 'Expected auditModel'),
    auditModelIdentitySha256: requiredSha256(
      parsed.auditModelIdentitySha256,
      'Expected audit-model identity',
    ),
    componentIdentities,
    componentRecordCounts: componentRecordCountValues,
    environmentInvariantIdentitySha256: requiredSha256(
      parsed.environmentInvariantIdentitySha256,
      'Expected invariant identity',
    ),
    expectedDeploymentProfileIdentitySha256: requiredSha256(
      parsed.expectedDeploymentProfileIdentitySha256,
      'Expected deployment-profile identity',
    ),
    fullAuditIdentitySha256: requiredSha256(
      parsed.fullAuditIdentitySha256,
      'Expected full-audit identity',
    ),
    fullEnvironmentInventoryIdentitySha256: requiredSha256(
      parsed.fullEnvironmentInventoryIdentitySha256,
      'Expected full-inventory identity',
    ),
    fullEnvironmentInventoryRecordCount: requiredInteger(
      parsed.fullEnvironmentInventoryRecordCount,
      'Expected full-inventory record count',
    ),
    migration: parsePinnedMigration(parsed.migration),
    normalizedInventory,
    observedAuditSchemaVersion: requiredString(
      parsed.observedAuditSchemaVersion,
      'Expected observed-audit schemaVersion',
    ),
    profileId,
    target,
    verifier: parsePinnedVerifier(parsed.verifier),
    verifierExecuted: false,
  }
  const expectedAudit = expectedObservedAuditIdentityFromArtifact(artifact)
  if (expectedAudit.fullAuditIdentitySha256 !== artifact.fullAuditIdentitySha256) {
    throw new Error('Expected catalog artifact full-audit identity is stale.')
  }
  return artifact
}

export function decodeProtectedV2CatalogExpectedInventories(
  artifact: ProtectedV2CatalogExpectedArtifact,
): ProtectedV2CatalogNormalizedInventories {
  return decodeNormalizedInventories(artifact.normalizedInventory)
}

export function buildProtectedV2CatalogExpectedArtifact(input: {
  migrationSha256: string
  observation: ProtectedV2CatalogObservationForExpectation
  verifierSha256: string
}): ProtectedV2CatalogExpectedArtifact {
  if (
    input.migrationSha256 !== PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY.sha256 ||
    input.verifierSha256 !== PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY.sha256
  ) {
    throw new Error('Catalog expectation proposal used unpinned migration or verifier bytes.')
  }
  if (
    input.observation.profileId !== input.observation.normalizedInventories.profileId ||
    input.observation.target !== input.observation.normalizedInventories.target ||
    input.observation.target !== expectedProfileTarget(input.observation.profileId)
  ) {
    throw new Error('Catalog expectation proposal profile evidence is inconsistent.')
  }
  const normalizedInventories = canonicalClone(input.observation.normalizedInventories)
  const canonicalInventory = Buffer.from(canonicalJson(normalizedInventories), 'utf8')
  const compressed = deflateRawSync(canonicalInventory, { level: 9 })
  const normalizedInventory = {
    canonicalJsonByteCount: canonicalInventory.length,
    canonicalJsonSha256: sha256(canonicalInventory),
    compressedBase64: compressed.toString('base64'),
    encoding: PROTECTED_V2_CATALOG_NORMALIZED_INVENTORY_ENCODING,
    recordCount: normalizedRecordCount(normalizedInventories),
  } as const
  const identity = input.observation.identity
  const content = {
    artifactSchemaVersion: PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION,
    auditMethod: identity.auditMethod,
    auditModel: identity.auditModel,
    auditModelIdentitySha256: identity.auditModelIdentitySha256,
    componentIdentities: identity.componentIdentities,
    componentRecordCounts: componentRecordCounts(normalizedInventories),
    environmentInvariantIdentitySha256: identity.environmentInvariantIdentitySha256,
    expectedDeploymentProfileIdentitySha256: identity.localPostgresOwnerProfileIdentitySha256,
    fullAuditIdentitySha256: identity.fullAuditIdentitySha256,
    fullEnvironmentInventoryIdentitySha256: identity.fullEnvironmentInventoryIdentitySha256,
    fullEnvironmentInventoryRecordCount: identity.fullEnvironmentInventoryRecordCount,
    migration: PROTECTED_V2_EXPECTED_MIGRATION_IDENTITY,
    normalizedInventory,
    observedAuditSchemaVersion: identity.schemaVersion,
    profileId: input.observation.profileId,
    target: input.observation.target,
    verifier: PROTECTED_V2_EXPECTED_VERIFIER_IDENTITY,
    verifierExecuted: false as const,
  }
  return parseProtectedV2CatalogExpectedArtifact({
    ...content,
    artifactContentSha256: sha256(canonicalJson(content)),
  })
}

const RAW_COMMITTED_ARTIFACTS: Record<ProtectedV2ExpectedCatalogProfileId, unknown> = {
  local_supabase_postgres_owner_v1: deepFreeze(canonicalClone(localSupabasePostgresOwnerV1Json)),
  supabase_admin_owner_v1: deepFreeze(canonicalClone(supabaseAdminOwnerV1Json)),
}
deepFreeze(RAW_COMMITTED_ARTIFACTS)

const parsedCommittedArtifacts = new Map<
  ProtectedV2ExpectedCatalogProfileId,
  ProtectedV2CatalogExpectedArtifact
>()

export function rawCommittedProtectedV2CatalogExpectedArtifact(
  profileId: ProtectedV2ExpectedCatalogProfileId,
): unknown {
  return canonicalClone(RAW_COMMITTED_ARTIFACTS[profileId])
}

/**
 * Authoritative selection is exhaustive and accepts no caller path or artifact bytes. Callers must
 * validate observed target/profile evidence before invoking it.
 */
export function committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
  profileId: ProtectedV2ExpectedCatalogProfileId,
  target: ProtectedV2ExpectedCatalogTarget,
): ProtectedV2CatalogExpectedArtifact {
  if (target !== expectedProfileTarget(profileId)) {
    throw new Error('Protected V2 expected catalog profile cannot be used for this target.')
  }
  const cached = parsedCommittedArtifacts.get(profileId)
  if (cached) return cached
  let raw: unknown
  switch (profileId) {
    case 'local_supabase_postgres_owner_v1':
      raw = RAW_COMMITTED_ARTIFACTS.local_supabase_postgres_owner_v1
      break
    case 'supabase_admin_owner_v1':
      raw = RAW_COMMITTED_ARTIFACTS.supabase_admin_owner_v1
      break
  }
  const parsed = deepFreeze(parseProtectedV2CatalogExpectedArtifact(raw))
  if (parsed.profileId !== profileId || parsed.target !== target) {
    throw new Error('Statically selected expected catalog artifact profile drifted.')
  }
  const binding = PROTECTED_V2_EXPECTED_CATALOG_AUTHORIZATION_BINDINGS[profileId]
  if (
    canonicalJson({
      componentIdentities: parsed.componentIdentities,
      expectedDeploymentProfileIdentitySha256: parsed.expectedDeploymentProfileIdentitySha256,
      fullEnvironmentInventoryIdentitySha256: parsed.fullEnvironmentInventoryIdentitySha256,
      fullEnvironmentInventoryRecordCount: parsed.fullEnvironmentInventoryRecordCount,
      normalizedInventoryCanonicalJsonSha256: parsed.normalizedInventory.canonicalJsonSha256,
      profileId: parsed.profileId,
      target: parsed.target,
    }) !== canonicalJson(binding)
  ) {
    throw new Error(
      'Committed expected catalog artifact lost its audit-model authorization binding.',
    )
  }
  parsedCommittedArtifacts.set(profileId, parsed)
  return parsed
}

export function committedProtectedV2CatalogExpectedArtifacts(): readonly ProtectedV2CatalogExpectedArtifact[] {
  return Object.freeze(
    PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS.map((profileId) =>
      committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
        profileId,
        expectedProfileTarget(profileId),
      ),
    ),
  )
}

function firstDifferingField(
  expected: unknown,
  actual: unknown,
  path = '$',
): { actual: unknown; expected: unknown; path: string } | null {
  if (expected === undefined || actual === undefined) {
    return expected === actual ? null : { actual, expected, path }
  }
  if (canonicalJson(expected) === canonicalJson(actual)) return null
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object' ||
    Array.isArray(expected) !== Array.isArray(actual)
  ) {
    return { actual, expected, path }
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length)
    for (let index = 0; index < length; index += 1) {
      if (index >= expected.length || index >= actual.length) {
        return { actual: actual[index], expected: expected[index], path: `${path}[${index}]` }
      }
      const difference = firstDifferingField(expected[index], actual[index], `${path}[${index}]`)
      if (difference) return difference
    }
    return null
  }
  const expectedRecord = expected as Record<string, unknown>
  const actualRecord = actual as Record<string, unknown>
  const keys = [...new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)])].sort(
    compareCodeUnits,
  )
  for (const key of keys) {
    const difference = firstDifferingField(expectedRecord[key], actualRecord[key], `${path}.${key}`)
    if (difference) return difference
  }
  return null
}

function diffRecordEnvelopes(
  expected: readonly NormalizedRecordEnvelope[],
  actual: readonly NormalizedRecordEnvelope[],
): ProtectedV2CatalogRecordDifference[] {
  const map = (entries: readonly NormalizedRecordEnvelope[]) =>
    new Map(
      entries.map((entry) => [`${entry.component}\0${entry.source}\0${entry.recordKey}`, entry]),
    )
  const expectedByKey = map(expected)
  const actualByKey = map(actual)
  const keys = [...new Set([...expectedByKey.keys(), ...actualByKey.keys()])].sort(compareCodeUnits)
  return keys.flatMap((key): ProtectedV2CatalogRecordDifference[] => {
    const expectedEntry = expectedByKey.get(key)
    const actualEntry = actualByKey.get(key)
    const representative = expectedEntry ?? actualEntry
    if (!representative) return []
    if (!expectedEntry) {
      return [
        {
          actual: actualEntry!.value,
          component: representative.component,
          expected: null,
          firstDifferingField: null,
          kind: 'unexpected_record',
          recordKey: representative.recordKey,
          source: representative.source,
        },
      ]
    }
    if (!actualEntry) {
      return [
        {
          actual: null,
          component: representative.component,
          expected: expectedEntry.value,
          firstDifferingField: null,
          kind: 'missing_expected_record',
          recordKey: representative.recordKey,
          source: representative.source,
        },
      ]
    }
    const first = firstDifferingField(expectedEntry.value, actualEntry.value)
    return first
      ? [
          {
            actual: actualEntry.value,
            component: representative.component,
            expected: expectedEntry.value,
            firstDifferingField: first.path,
            kind: 'changed_record',
            recordKey: representative.recordKey,
            source: representative.source,
          },
        ]
      : []
  })
}

function identityDifference(
  key: string,
  expected: unknown,
  actual: unknown,
): ProtectedV2CatalogRecordDifference[] {
  const first = firstDifferingField(expected, actual)
  return first
    ? [
        {
          actual,
          component: 'auditIdentity',
          expected,
          firstDifferingField: first.path,
          kind: 'changed_record',
          recordKey: key,
          source: 'observedAuditIdentity',
        },
      ]
    : []
}

/** Pure comparator used by focused tests and the maintainer proposal report. */
export function compareProtectedV2CatalogObservationToExpectedArtifact(
  observation: ProtectedV2CatalogObservationForExpectation,
  artifactInput: unknown,
): ProtectedV2CatalogExpectationComparison {
  const artifact = parseProtectedV2CatalogExpectedArtifact(artifactInput)
  const expectedInventories = decodeProtectedV2CatalogExpectedInventories(artifact)
  const actualInventories = canonicalClone(observation.normalizedInventories)
  const expectedIdentity = expectedObservedAuditIdentityFromArtifact(artifact)
  const differences = [
    ...identityDifference('profileId', artifact.profileId, observation.profileId),
    ...identityDifference('target', artifact.target, observation.target),
    ...identityDifference('observedAuditIdentity', expectedIdentity, observation.identity),
    ...diffRecordEnvelopes(
      componentRecordEnvelopes(expectedInventories.componentInputs),
      componentRecordEnvelopes(actualInventories.componentInputs),
    ),
    ...diffRecordEnvelopes(
      fullInventoryRecordEnvelopes(expectedInventories),
      fullInventoryRecordEnvelopes(actualInventories),
    ),
  ].sort((left, right) =>
    compareCodeUnits(
      `${left.component}\0${left.source}\0${left.recordKey}\0${left.kind}`,
      `${right.component}\0${right.source}\0${right.recordKey}\0${right.kind}`,
    ),
  )
  return {
    differences,
    expectedArtifactContentSha256: artifact.artifactContentSha256,
    passed: differences.length === 0,
    profileId: artifact.profileId,
    target: artifact.target,
  }
}

export class ProtectedV2CatalogExpectationMismatchError extends Error {
  readonly comparison: ProtectedV2CatalogExpectationComparison

  constructor(comparison: ProtectedV2CatalogExpectationComparison) {
    const first =
      comparison.differences.find(({ component }) => component !== 'auditIdentity') ??
      comparison.differences[0]
    super(
      first
        ? `Protected V2 exact catalog expectation mismatch: ${first.component}/${first.source}/${first.recordKey} ${first.kind}${first.firstDifferingField ? ` at ${first.firstDifferingField}` : ''}.`
        : 'Protected V2 exact catalog expectation mismatch.',
    )
    this.name = 'ProtectedV2CatalogExpectationMismatchError'
    this.comparison = comparison
  }
}

export function assertProtectedV2CatalogObservationMatchesExpectedArtifact(
  observation: ProtectedV2CatalogObservationForExpectation,
  artifactInput: unknown,
): ProtectedV2CatalogExpectationComparison {
  const comparison = compareProtectedV2CatalogObservationToExpectedArtifact(
    observation,
    artifactInput,
  )
  if (!comparison.passed) throw new ProtectedV2CatalogExpectationMismatchError(comparison)
  return comparison
}
