import { createHash } from 'node:crypto'

import {
  normalizePostgresDefinition,
  validateSchemaSecurityDefinitionIdentity,
  type SchemaSecurityDefinitionIdentity,
  type SchemaSecurityDefinitionRecord,
} from './gold-import-compensation-rehearsal-evidence'

export const GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION =
  'gold-import-compensation-contract-reconciliation/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_INVARIANT_IDENTITY_SCHEMA_VERSION =
  'gold-import-compensation-contract-invariant-identity/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_PROFILE_IDENTITY_SCHEMA_VERSION =
  'gold-import-compensation-deployment-profile-identity/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_FULL_INVENTORY_IDENTITY_SCHEMA_VERSION =
  'gold-import-compensation-full-environment-inventory-identity/1.0.0' as const

export const CONTRACT_RECONCILIATION_CLASSIFICATIONS = [
  'identical',
  'environment_representation_only',
  'explicitly_supported_local_profile',
  'missing_expected_object',
  'unexpected_object',
  'semantic_contract_difference',
  'security_contract_difference',
  'audit_expectation_defect',
] as const

export type ContractReconciliationClassification =
  (typeof CONTRACT_RECONCILIATION_CLASSIFICATIONS)[number]

export const REQUIRED_RECONCILIATION_RPCS = [
  'apply_literature_gold_import_v1',
  'compensate_literature_gold_import_v1',
  'reconcile_literature_gold_review_operation_v1',
] as const

export type ReconciliationRpcName = (typeof REQUIRED_RECONCILIATION_RPCS)[number]

export type DeploymentProfileId = 'local_supabase_postgres_owner_v1' | 'supabase_admin_owner_v1'

export type DeploymentTarget = 'disposable' | 'local' | 'remote'

export interface RoleAttributes {
  bypassRls: boolean
  canLogin: boolean
  connectionLimit: number
  createDb: boolean
  createRole: boolean
  inherit: boolean
  replication: boolean
  superuser: boolean
  validUntil: string | null
}

export interface RoleMembership {
  adminOption: boolean
  grantor: string
  inheritOption: boolean
  roleName: string
  setOption: boolean
}

export interface RoleMember {
  adminOption: boolean
  grantor: string
  inheritOption: boolean
  memberName: string
  setOption: boolean
}

/** Structurally identical to the read-only diagnostics role record. */
export interface RoleSecurityAttributes {
  attributes: RoleAttributes | null
  effectiveMemberships: readonly string[]
  exists: boolean
  memberOf: readonly RoleMembership[]
  members: readonly RoleMember[]
  roleName: string
}

export interface SupportedDeploymentProfile {
  profileId: DeploymentProfileId
  target: Exclude<DeploymentTarget, 'remote'>
  sourceOwner: 'supabase_admin'
  owner: 'postgres' | 'supabase_admin'
  ownerRoleAttributes: RoleAttributes & { roleName: string }
  roleInventorySha256: string
}

const TRUSTED_MIGRATION_OWNER_ATTRIBUTES = {
  bypassRls: true,
  canLogin: true,
  connectionLimit: -1,
  createDb: true,
  createRole: true,
  inherit: true,
  replication: true,
  validUntil: null,
} as const

/**
 * Exact canonical role inventory observed for the pinned Supabase deployment runtime. The digest
 * covers every scoped role's attributes, direct members, direct memberships, and transitive
 * effective memberships. Both owner profiles use the same platform-role contract; only the
 * migration-object owner and allowed target differ.
 */
export const TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256 =
  'bc6e3022cf9bf086c63ef30cb1f35c19b9a5c93928d0db561cb92770a8599418' as const

export const SUPPORTED_DEPLOYMENT_PROFILES: Readonly<
  Record<DeploymentProfileId, SupportedDeploymentProfile>
> = {
  local_supabase_postgres_owner_v1: {
    profileId: 'local_supabase_postgres_owner_v1',
    target: 'local',
    sourceOwner: 'supabase_admin',
    owner: 'postgres',
    ownerRoleAttributes: {
      ...TRUSTED_MIGRATION_OWNER_ATTRIBUTES,
      superuser: false,
      roleName: 'postgres',
    },
    roleInventorySha256: TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
  },
  supabase_admin_owner_v1: {
    profileId: 'supabase_admin_owner_v1',
    target: 'disposable',
    sourceOwner: 'supabase_admin',
    owner: 'supabase_admin',
    ownerRoleAttributes: {
      ...TRUSTED_MIGRATION_OWNER_ATTRIBUTES,
      superuser: true,
      roleName: 'supabase_admin',
    },
    roleInventorySha256: TRUSTED_SUPABASE_DEPLOYMENT_ROLE_INVENTORY_SHA256,
  },
}

export interface DeploymentProfileEvidence {
  profileId: DeploymentProfileId
  target: DeploymentTarget
  roleInventory: readonly RoleSecurityAttributes[]
}

export interface RpcAclEntry {
  grantee: string
  grantor: string
  privilegeType: string
  isGrantable: boolean
}

export interface RpcDependencyMetadata {
  dependencyType: string
  referencedClass: string
  referencedIdentity: string
}

export interface RpcSearchPathMetadata {
  actual: string | null
  entries: readonly string[]
  expected: string
  matchesExpected: boolean
}

/** Structurally compatible with ContractFunctionDiagnostic from the read-only collector. */
export interface EnrichedRpcMetadata {
  argumentsWithDefaults: string
  configuration: readonly string[]
  definitionSha256: string
  dependencies: readonly RpcDependencyMetadata[]
  effectiveExecute: {
    PUBLIC: boolean
    anon: boolean
    authenticated: boolean
    service_role: boolean
  }
  explicitGrants: readonly RpcAclEntry[]
  identityArguments: string
  language: string
  name: string
  normalizedDefinition: string
  objectIdentity: string
  overloadCount: number
  owner: string
  parallelSafety: 'restricted' | 'safe' | 'unsafe'
  rawAcl: string | null
  rawDefinition: string
  rawDefinitionSha256: string
  resultType: string
  routineKind: 'aggregate' | 'function' | 'procedure' | 'window'
  schema: string
  searchPath: RpcSearchPathMetadata
  securityDefiner: boolean
  securityMode: 'definer' | 'invoker'
  volatility: 'immutable' | 'stable' | 'volatile'
}

export interface AuditExpectationDefect {
  objectIdentity: string
  reason: string
}

export interface ContractInvariantRecord {
  schemaName: string
  objectType: string
  objectName: string
  objectIdentity: string
  parentObjectName: string | null
  relevantRoles: readonly string[]
  normalizedDefinition: string
  definitionSha256: string
  state: Readonly<Record<string, unknown>>
}

export interface ContractInvariantIdentity {
  schemaVersion: typeof GOLD_IMPORT_COMPENSATION_INVARIANT_IDENTITY_SCHEMA_VERSION
  records: readonly ContractInvariantRecord[]
  rpcs: readonly Readonly<Record<string, unknown>>[]
}

export interface DeploymentProfileIdentity {
  schemaVersion: typeof GOLD_IMPORT_COMPENSATION_PROFILE_IDENTITY_SCHEMA_VERSION
  profileId: DeploymentProfileId
  target: DeploymentTarget
  roleInventory: readonly RoleSecurityAttributes[]
  objectOwners: readonly {
    objectIdentity: string
    owner: string
  }[]
  aclRecords: readonly SchemaSecurityDefinitionRecord[]
  effectivePrivilegeRecords: readonly SchemaSecurityDefinitionRecord[]
  rpcExecutionProfiles: readonly Readonly<Record<string, unknown>>[]
}

export interface FullEnvironmentInventoryIdentity {
  schemaVersion: typeof GOLD_IMPORT_COMPENSATION_FULL_INVENTORY_IDENTITY_SCHEMA_VERSION
  schemaSecurityDefinitionIdentity: SchemaSecurityDefinitionIdentity
  rpcs: readonly EnrichedRpcMetadata[]
  deploymentProfile: DeploymentProfileEvidence
}

export interface IdentityWithSha256<T> {
  identity: T
  sha256: string
}

export interface SchemaSecurityRecordDiff {
  expectedObjectIdentity: string | null
  projectedExpectedObjectIdentity: string | null
  actualObjectIdentity: string | null
  objectType: string
  classification: ContractReconciliationClassification
  changedPaths: readonly string[]
  explanation: string
  expected: SchemaSecurityDefinitionRecord | null
  actual: SchemaSecurityDefinitionRecord | null
}

export interface RpcMetadataDiff {
  rpcName: string
  expectedFunctionIdentity: string | null
  actualFunctionIdentity: string | null
  classification: ContractReconciliationClassification
  changedPaths: readonly string[]
  explanation: string
  expected: EnrichedRpcMetadata | null
  actual: EnrichedRpcMetadata | null
}

export interface DeploymentProfileEvidenceDiff {
  evidenceIdentity: string
  classification: ContractReconciliationClassification
  changedPaths: readonly string[]
  explanation: string
  expected: unknown
  actual: unknown
}

export interface DeploymentProfileValidation {
  passed: boolean
  violations: readonly string[]
  expectedIdentity: IdentityWithSha256<DeploymentProfileIdentity>
  actualIdentity: IdentityWithSha256<DeploymentProfileIdentity>
}

export interface OwnerRepresentationExplanation {
  expectedRecordCount: number
  actualRecordCount: number
  recordCountDelta: number
  projectedExpectedRecordCount: number
  collapsedExpectedRecordCount: number
  collapsedByObjectType: Readonly<Record<string, number>>
  projectionExactlyMatchesActual: boolean
  isExact763To683OwnerRepresentation: boolean
  explanation: string
}

export interface ReconciliationIdentitySet {
  expected: {
    contractInvariant: IdentityWithSha256<ContractInvariantIdentity>
    deploymentProfile: IdentityWithSha256<DeploymentProfileIdentity>
    fullEnvironmentInventory: IdentityWithSha256<FullEnvironmentInventoryIdentity>
  }
  actual: {
    contractInvariant: IdentityWithSha256<ContractInvariantIdentity>
    deploymentProfile: IdentityWithSha256<DeploymentProfileIdentity>
    fullEnvironmentInventory: IdentityWithSha256<FullEnvironmentInventoryIdentity>
  }
}

export interface GoldImportCompensationContractReconciliationInput {
  expectedIdentity: SchemaSecurityDefinitionIdentity
  actualIdentity: SchemaSecurityDefinitionIdentity
  expectedRpcs: readonly EnrichedRpcMetadata[]
  actualRpcs: readonly EnrichedRpcMetadata[]
  expectedProfile: DeploymentProfileEvidence
  actualProfile: DeploymentProfileEvidence
  auditExpectationDefects?: readonly AuditExpectationDefect[]
}

export interface GoldImportCompensationContractReconciliation {
  schemaVersion: typeof GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION
  ready: boolean
  readinessBlockers: readonly string[]
  identities: ReconciliationIdentitySet
  invariantIdentityMatches: boolean
  deploymentProfile: DeploymentProfileValidation
  fullEnvironmentInventoryMatches: boolean
  recordDiffs: readonly SchemaSecurityRecordDiff[]
  rpcDiffs: readonly RpcMetadataDiff[]
  profileDiffs: readonly DeploymentProfileEvidenceDiff[]
  classificationCounts: Readonly<Record<ContractReconciliationClassification, number>>
  completeness: {
    expectedRecordCount: number
    actualRecordCount: number
    expectedRecordsAccountedFor: number
    actualRecordsAccountedFor: number
    complete: boolean
  }
  ownerRepresentation: OwnerRepresentationExplanation
}

const ACL_OBJECT_TYPES = new Set(['column_acl', 'function_acl', 'schema_acl', 'table_acl'])
const CONTRACT_EXECUTION_ROLES = ['PUBLIC', 'anon', 'authenticated', 'service_role'] as const
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry))
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => [key, canonicalValue(entry)]),
  )
}

export function reconciliationCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function reconciliationIdentitySha256(value: unknown): string {
  return sha256(reconciliationCanonicalJson(value))
}

function identityWithSha256<T>(identity: T): IdentityWithSha256<T> {
  return { identity, sha256: reconciliationIdentitySha256(identity) }
}

function requireNonempty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function uniqueSorted(values: readonly string[], label: string): string[] {
  const result = values.map((value, index) => requireNonempty(value, `${label}[${index}]`))
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicates.`)
  return result.sort(compareCodeUnits)
}

function requireBoolean(value: boolean, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function requireInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer.`)
  return value
}

function canonicalMemberships(
  memberships: readonly RoleMembership[],
  label: string,
): RoleMembership[] {
  const canonical = memberships.map((membership, index) => ({
    adminOption: requireBoolean(membership.adminOption, `${label}[${index}].adminOption`),
    grantor: requireNonempty(membership.grantor, `${label}[${index}].grantor`),
    inheritOption: requireBoolean(membership.inheritOption, `${label}[${index}].inheritOption`),
    roleName: requireNonempty(membership.roleName, `${label}[${index}].roleName`),
    setOption: requireBoolean(membership.setOption, `${label}[${index}].setOption`),
  }))
  canonical.sort((left, right) =>
    compareCodeUnits(`${left.roleName}\0${left.grantor}`, `${right.roleName}\0${right.grantor}`),
  )
  if (
    new Set(canonical.map((entry) => reconciliationCanonicalJson(entry))).size !== canonical.length
  ) {
    throw new Error(`${label} contains duplicates.`)
  }
  return canonical
}

function canonicalMembers(members: readonly RoleMember[], label: string): RoleMember[] {
  const canonical = members.map((member, index) => ({
    adminOption: requireBoolean(member.adminOption, `${label}[${index}].adminOption`),
    grantor: requireNonempty(member.grantor, `${label}[${index}].grantor`),
    inheritOption: requireBoolean(member.inheritOption, `${label}[${index}].inheritOption`),
    memberName: requireNonempty(member.memberName, `${label}[${index}].memberName`),
    setOption: requireBoolean(member.setOption, `${label}[${index}].setOption`),
  }))
  canonical.sort((left, right) =>
    compareCodeUnits(
      `${left.memberName}\0${left.grantor}`,
      `${right.memberName}\0${right.grantor}`,
    ),
  )
  if (
    new Set(canonical.map((entry) => reconciliationCanonicalJson(entry))).size !== canonical.length
  ) {
    throw new Error(`${label} contains duplicates.`)
  }
  return canonical
}

function canonicalRoleAttributes(attributes: RoleAttributes, label: string): RoleAttributes {
  return {
    bypassRls: requireBoolean(attributes.bypassRls, `${label}.bypassRls`),
    canLogin: requireBoolean(attributes.canLogin, `${label}.canLogin`),
    connectionLimit: requireInteger(attributes.connectionLimit, `${label}.connectionLimit`),
    createDb: requireBoolean(attributes.createDb, `${label}.createDb`),
    createRole: requireBoolean(attributes.createRole, `${label}.createRole`),
    inherit: requireBoolean(attributes.inherit, `${label}.inherit`),
    replication: requireBoolean(attributes.replication, `${label}.replication`),
    superuser: requireBoolean(attributes.superuser, `${label}.superuser`),
    validUntil:
      attributes.validUntil === null
        ? null
        : requireNonempty(attributes.validUntil, `${label}.validUntil`),
  }
}

function canonicalRoleInventory(
  roles: readonly RoleSecurityAttributes[],
  label: string,
): RoleSecurityAttributes[] {
  const canonical = roles.map((role, index) => {
    const roleName = requireNonempty(role.roleName, `${label}[${index}].roleName`)
    const exists = requireBoolean(role.exists, `${label}[${index}].exists`)
    if (exists !== (role.attributes !== null)) {
      throw new Error(`${label}[${index}].attributes must be present exactly when the role exists.`)
    }
    const memberOf = canonicalMemberships(role.memberOf, `${label}[${index}].memberOf`)
    const members = canonicalMembers(role.members, `${label}[${index}].members`)
    const effectiveMemberships = uniqueSorted(
      role.effectiveMemberships,
      `${label}[${index}].effectiveMemberships`,
    )
    if (!exists && (memberOf.length > 0 || members.length > 0 || effectiveMemberships.length > 0)) {
      throw new Error(`${label}[${index}] cannot have memberships when the role is absent.`)
    }
    return {
      attributes:
        role.attributes === null
          ? null
          : canonicalRoleAttributes(role.attributes, `${label}[${index}].attributes`),
      effectiveMemberships,
      exists,
      memberOf,
      members,
      roleName,
    }
  })
  if (new Set(canonical.map(({ roleName }) => roleName)).size !== canonical.length) {
    throw new Error(`${label} contains duplicate role names.`)
  }
  return canonical.sort((left, right) => compareCodeUnits(left.roleName, right.roleName))
}

function canonicalProfileEvidence(
  evidence: DeploymentProfileEvidence,
  label: string,
): DeploymentProfileEvidence {
  if (!Object.hasOwn(SUPPORTED_DEPLOYMENT_PROFILES, evidence.profileId)) {
    throw new Error(`${label}.profileId is not supported.`)
  }
  if (!['disposable', 'local', 'remote'].includes(evidence.target)) {
    throw new Error(`${label}.target is not supported.`)
  }
  return {
    profileId: evidence.profileId,
    target: evidence.target,
    roleInventory: canonicalRoleInventory(evidence.roleInventory, `${label}.roleInventory`),
  }
}

function canonicalAclEntries(entries: readonly RpcAclEntry[], label: string): RpcAclEntry[] {
  const canonical = entries.map((entry, index) => ({
    grantee: requireNonempty(entry.grantee, `${label}[${index}].grantee`),
    grantor: requireNonempty(entry.grantor, `${label}[${index}].grantor`),
    privilegeType: requireNonempty(entry.privilegeType, `${label}[${index}].privilegeType`),
    isGrantable: entry.isGrantable,
  }))
  canonical.forEach((entry, index) => {
    if (typeof entry.isGrantable !== 'boolean') {
      throw new Error(`${label}[${index}].isGrantable must be boolean.`)
    }
  })
  canonical.sort((left, right) =>
    compareCodeUnits(
      `${left.grantee}\0${left.grantor}\0${left.privilegeType}\0${String(left.isGrantable)}`,
      `${right.grantee}\0${right.grantor}\0${right.privilegeType}\0${String(right.isGrantable)}`,
    ),
  )
  const identities = canonical.map((entry) => reconciliationCanonicalJson(entry))
  if (new Set(identities).size !== identities.length)
    throw new Error(`${label} contains duplicates.`)
  return canonical
}

function canonicalRpcMetadata(value: EnrichedRpcMetadata, label: string): EnrichedRpcMetadata {
  const schema = requireNonempty(value.schema, `${label}.schema`)
  const name = requireNonempty(value.name, `${label}.name`)
  const identityArguments = value.identityArguments
  if (typeof identityArguments !== 'string')
    throw new Error(`${label}.identityArguments must be text.`)
  const objectIdentity = requireNonempty(value.objectIdentity, `${label}.objectIdentity`)
  if (objectIdentity !== `${schema}.${name}(${identityArguments})`) {
    throw new Error(`${label}.objectIdentity does not match its schema/name/identity arguments.`)
  }
  const normalizedDefinition = requireNonempty(
    value.normalizedDefinition,
    `${label}.normalizedDefinition`,
  )
  if (normalizePostgresDefinition(normalizedDefinition) !== normalizedDefinition) {
    throw new Error(`${label}.normalizedDefinition is not canonical.`)
  }
  if (!SHA256_PATTERN.test(value.definitionSha256)) {
    throw new Error(`${label}.definitionSha256 must be a lowercase SHA-256 digest.`)
  }
  if (sha256(normalizedDefinition) !== value.definitionSha256) {
    throw new Error(`${label}.definitionSha256 does not match normalizedDefinition.`)
  }
  const rawDefinition = requireNonempty(value.rawDefinition, `${label}.rawDefinition`)
  if (!SHA256_PATTERN.test(value.rawDefinitionSha256)) {
    throw new Error(`${label}.rawDefinitionSha256 must be a lowercase SHA-256 digest.`)
  }
  if (sha256(rawDefinition) !== value.rawDefinitionSha256) {
    throw new Error(`${label}.rawDefinitionSha256 does not match rawDefinition.`)
  }
  if (normalizePostgresDefinition(rawDefinition) !== normalizedDefinition) {
    throw new Error(`${label}.rawDefinition does not produce normalizedDefinition.`)
  }
  const effectiveKeys = Object.keys(value.effectiveExecute).sort(compareCodeUnits)
  if (
    reconciliationCanonicalJson(effectiveKeys) !==
    reconciliationCanonicalJson([...CONTRACT_EXECUTION_ROLES].sort(compareCodeUnits))
  ) {
    throw new Error(`${label}.effectiveExecute must contain exactly the contract roles.`)
  }
  const effectiveExecute = {
    PUBLIC: requireBoolean(value.effectiveExecute.PUBLIC, `${label}.effectiveExecute.PUBLIC`),
    anon: requireBoolean(value.effectiveExecute.anon, `${label}.effectiveExecute.anon`),
    authenticated: requireBoolean(
      value.effectiveExecute.authenticated,
      `${label}.effectiveExecute.authenticated`,
    ),
    service_role: requireBoolean(
      value.effectiveExecute.service_role,
      `${label}.effectiveExecute.service_role`,
    ),
  }
  const dependencies = value.dependencies.map((dependency, index) => ({
    dependencyType: requireNonempty(
      dependency.dependencyType,
      `${label}.dependencies[${index}].dependencyType`,
    ),
    referencedClass: requireNonempty(
      dependency.referencedClass,
      `${label}.dependencies[${index}].referencedClass`,
    ),
    referencedIdentity: requireNonempty(
      dependency.referencedIdentity,
      `${label}.dependencies[${index}].referencedIdentity`,
    ),
  }))
  dependencies.sort((left, right) =>
    compareCodeUnits(
      `${left.referencedClass}\0${left.referencedIdentity}\0${left.dependencyType}`,
      `${right.referencedClass}\0${right.referencedIdentity}\0${right.dependencyType}`,
    ),
  )
  if (
    new Set(dependencies.map((entry) => reconciliationCanonicalJson(entry))).size !==
    dependencies.length
  ) {
    throw new Error(`${label}.dependencies contains duplicates.`)
  }
  const volatility = value.volatility
  if (!['immutable', 'stable', 'volatile'].includes(volatility)) {
    throw new Error(`${label}.volatility is unsupported.`)
  }
  const parallelSafety = value.parallelSafety
  if (!['restricted', 'safe', 'unsafe'].includes(parallelSafety)) {
    throw new Error(`${label}.parallelSafety is unsupported.`)
  }
  const routineKind = value.routineKind
  if (!['aggregate', 'function', 'procedure', 'window'].includes(routineKind)) {
    throw new Error(`${label}.routineKind is unsupported.`)
  }
  const securityDefiner = requireBoolean(value.securityDefiner, `${label}.securityDefiner`)
  if ((value.securityMode === 'definer') !== securityDefiner) {
    throw new Error(`${label}.securityMode does not match securityDefiner.`)
  }
  const searchPath = {
    actual:
      value.searchPath.actual === null
        ? null
        : requireNonempty(value.searchPath.actual, `${label}.searchPath.actual`),
    entries: uniqueSorted(value.searchPath.entries, `${label}.searchPath.entries`),
    expected: requireNonempty(value.searchPath.expected, `${label}.searchPath.expected`),
    matchesExpected: requireBoolean(
      value.searchPath.matchesExpected,
      `${label}.searchPath.matchesExpected`,
    ),
  }
  if (searchPath.matchesExpected !== (searchPath.actual === searchPath.expected)) {
    throw new Error(`${label}.searchPath.matchesExpected is inconsistent.`)
  }
  return {
    argumentsWithDefaults: requireNonempty(
      value.argumentsWithDefaults,
      `${label}.argumentsWithDefaults`,
    ),
    configuration: uniqueSorted(value.configuration, `${label}.configuration`),
    definitionSha256: value.definitionSha256,
    dependencies,
    effectiveExecute,
    explicitGrants: canonicalAclEntries(value.explicitGrants, `${label}.explicitGrants`),
    identityArguments,
    language: requireNonempty(value.language, `${label}.language`),
    name,
    normalizedDefinition,
    objectIdentity,
    overloadCount: requireInteger(value.overloadCount, `${label}.overloadCount`),
    owner: requireNonempty(value.owner, `${label}.owner`),
    parallelSafety,
    rawAcl: value.rawAcl,
    rawDefinition,
    rawDefinitionSha256: value.rawDefinitionSha256,
    resultType: requireNonempty(value.resultType, `${label}.resultType`),
    routineKind,
    schema,
    searchPath,
    securityDefiner,
    securityMode: value.securityMode,
    volatility,
  }
}

function canonicalRpcs(
  values: readonly EnrichedRpcMetadata[],
  label: string,
): EnrichedRpcMetadata[] {
  const canonical = values.map((value, index) => canonicalRpcMetadata(value, `${label}[${index}]`))
  if (new Set(canonical.map(({ name }) => name)).size !== canonical.length) {
    throw new Error(`${label} contains duplicate RPC names.`)
  }
  return canonical.sort((left, right) => compareCodeUnits(left.name, right.name))
}

function replaceRoleInValue(value: unknown, sourceOwner: string, owner: string): unknown {
  if (value === sourceOwner) return owner
  if (Array.isArray(value)) {
    return value.map((entry) => replaceRoleInValue(entry, sourceOwner, owner))
  }
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      replaceRoleInValue(entry, sourceOwner, owner),
    ]),
  )
}

function profileDefinition(
  definition: string,
  objectType: string,
  sourceOwner: string,
  owner: string,
): string {
  if (
    sourceOwner === owner ||
    (!ACL_OBJECT_TYPES.has(objectType) &&
      objectType !== 'table' &&
      objectType !== 'effective_schema_create_privilege')
  ) {
    return definition
  }
  return normalizePostgresDefinition(definition.replaceAll(sourceOwner, owner))
}

function profileRecord(
  record: SchemaSecurityDefinitionRecord,
  profile: SupportedDeploymentProfile,
): SchemaSecurityDefinitionRecord {
  const mapsOwner = profile.sourceOwner !== profile.owner
  const objectIdentity =
    mapsOwner && ACL_OBJECT_TYPES.has(record.objectType)
      ? record.objectIdentity.replaceAll(profile.sourceOwner, profile.owner)
      : record.objectIdentity
  const normalizedDefinition = profileDefinition(
    record.normalizedDefinition,
    record.objectType,
    profile.sourceOwner,
    profile.owner,
  )
  return {
    ...record,
    objectIdentity,
    owner: record.owner === profile.sourceOwner ? profile.owner : record.owner,
    relevantRoles: [
      ...new Set(
        record.relevantRoles.map((role) => (role === profile.sourceOwner ? profile.owner : role)),
      ),
    ].sort(compareCodeUnits),
    normalizedDefinition,
    definitionSha256: sha256(normalizedDefinition),
    state: canonicalValue(
      replaceRoleInValue(record.state, profile.sourceOwner, profile.owner),
    ) as Record<string, unknown>,
  }
}

interface ProjectedIdentityDetails {
  identity: SchemaSecurityDefinitionIdentity
  sourceRecordsByProjectedIdentity: ReadonlyMap<string, readonly SchemaSecurityDefinitionRecord[]>
}

function projectedIdentityDetails(
  identityInput: SchemaSecurityDefinitionIdentity,
  profileId: DeploymentProfileId,
): ProjectedIdentityDetails {
  const identity = validateSchemaSecurityDefinitionIdentity(identityInput)
  const profile = SUPPORTED_DEPLOYMENT_PROFILES[profileId]
  const projectedRecords = new Map<string, SchemaSecurityDefinitionRecord>()
  const sources = new Map<string, SchemaSecurityDefinitionRecord[]>()
  for (const record of identity.records) {
    const projected = profileRecord(record, profile)
    const existing = projectedRecords.get(projected.objectIdentity)
    if (
      existing &&
      reconciliationCanonicalJson(existing) !== reconciliationCanonicalJson(projected)
    ) {
      throw new Error(
        `Deployment-profile projection collision changed semantics for ${projected.objectIdentity}.`,
      )
    }
    projectedRecords.set(projected.objectIdentity, projected)
    sources.set(projected.objectIdentity, [
      ...(sources.get(projected.objectIdentity) ?? []),
      record,
    ])
  }
  return {
    identity: validateSchemaSecurityDefinitionIdentity({
      schemaVersion: identity.schemaVersion,
      records: [...projectedRecords.values()],
    }),
    sourceRecordsByProjectedIdentity: sources,
  }
}

export function projectSchemaSecurityIdentityForDeploymentProfile(
  identity: SchemaSecurityDefinitionIdentity,
  profileId: DeploymentProfileId,
): SchemaSecurityDefinitionIdentity {
  return projectedIdentityDetails(identity, profileId).identity
}

function mapProfileRole(role: string, profile: SupportedDeploymentProfile): string {
  return role === profile.sourceOwner ? profile.owner : role
}

function projectRawAcl(rawAcl: string | null, profile: SupportedDeploymentProfile): string | null {
  if (rawAcl === null) return null
  const projected = rawAcl.replaceAll(profile.sourceOwner, profile.owner)
  if (!projected.startsWith('{') || !projected.endsWith('}')) return projected
  const entries = projected.slice(1, -1).split(',').filter(Boolean)
  return `{${[...new Set(entries)].join(',')}}`
}

export function projectRpcMetadataForDeploymentProfile(
  rpcInput: EnrichedRpcMetadata,
  profileId: DeploymentProfileId,
): EnrichedRpcMetadata {
  const rpc = canonicalRpcMetadata(rpcInput, 'rpc')
  const profile = SUPPORTED_DEPLOYMENT_PROFILES[profileId]
  const rawAcl = projectRawAcl(rpc.rawAcl, profile)
  const explicitGrantMap = new Map<string, RpcAclEntry>()
  for (const entry of rpc.explicitGrants) {
    const projected = {
      ...entry,
      grantee: mapProfileRole(entry.grantee, profile),
      grantor: mapProfileRole(entry.grantor, profile),
    }
    explicitGrantMap.set(reconciliationCanonicalJson(projected), projected)
  }
  return canonicalRpcMetadata(
    {
      ...rpc,
      owner: mapProfileRole(rpc.owner, profile),
      rawAcl,
      explicitGrants: [...explicitGrantMap.values()],
    },
    'projected rpc',
  )
}

function withoutOwner(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => withoutOwner(entry))
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'owner')
      .map(([key, entry]) => [key, withoutOwner(entry)]),
  )
}

function contractInvariantRecord(
  record: SchemaSecurityDefinitionRecord,
): ContractInvariantRecord | null {
  if (ACL_OBJECT_TYPES.has(record.objectType)) return null
  const state = canonicalValue(withoutOwner(record.state)) as Record<string, unknown>
  const definition =
    record.objectType === 'table' || record.objectType === 'effective_schema_create_privilege'
      ? reconciliationCanonicalJson(state)
      : record.normalizedDefinition
  const relevantRoles =
    record.objectType === 'function' ? [] : [...record.relevantRoles].sort(compareCodeUnits)
  return {
    schemaName: record.schemaName,
    objectType: record.objectType,
    objectName: record.objectName,
    objectIdentity: record.objectIdentity,
    parentObjectName: record.parentObjectName,
    relevantRoles,
    normalizedDefinition: definition,
    definitionSha256: sha256(definition),
    state,
  }
}

function rpcInvariant(rpc: EnrichedRpcMetadata): Readonly<Record<string, unknown>> {
  const contractRoleExecute = Object.fromEntries(
    CONTRACT_EXECUTION_ROLES.map((role) => [role, rpc.effectiveExecute[role] ?? null]),
  )
  return canonicalValue({
    argumentsWithDefaults: rpc.argumentsWithDefaults,
    configuration: rpc.configuration,
    schema: rpc.schema,
    name: rpc.name,
    objectIdentity: rpc.objectIdentity,
    overloadCount: rpc.overloadCount,
    identityArguments: rpc.identityArguments,
    language: rpc.language,
    volatility: rpc.volatility,
    parallelSafety: rpc.parallelSafety,
    routineKind: rpc.routineKind,
    securityDefiner: rpc.securityDefiner,
    securityMode: rpc.securityMode,
    normalizedDefinition: rpc.normalizedDefinition,
    searchPath: rpc.searchPath,
    resultType: rpc.resultType,
    contractRoleExecute,
    intendedContractExecuteGrants: rpc.explicitGrants
      .filter(
        ({ grantee, privilegeType }) =>
          privilegeType.toLocaleUpperCase('en-US') === 'EXECUTE' &&
          CONTRACT_EXECUTION_ROLES.includes(grantee as (typeof CONTRACT_EXECUTION_ROLES)[number]),
      )
      .map(({ grantee, isGrantable, privilegeType }) => ({
        grantee,
        isGrantable,
        privilegeType,
      })),
    dependencies: rpc.dependencies,
    definitionSha256: rpc.definitionSha256,
  }) as Readonly<Record<string, unknown>>
}

export function buildContractInvariantIdentity(
  identityInput: SchemaSecurityDefinitionIdentity,
  rpcsInput: readonly EnrichedRpcMetadata[],
): ContractInvariantIdentity {
  const identity = validateSchemaSecurityDefinitionIdentity(identityInput)
  const rpcs = canonicalRpcs(rpcsInput, 'rpcs')
  return {
    schemaVersion: GOLD_IMPORT_COMPENSATION_INVARIANT_IDENTITY_SCHEMA_VERSION,
    records: identity.records
      .map((record) => contractInvariantRecord(record))
      .filter((record): record is ContractInvariantRecord => record !== null),
    rpcs: rpcs.map((rpc) => rpcInvariant(rpc)),
  }
}

function rpcExecutionProfile(rpc: EnrichedRpcMetadata): Readonly<Record<string, unknown>> {
  return canonicalValue({
    objectIdentity: rpc.objectIdentity,
    owner: rpc.owner,
    normalizedAcl: rpc.explicitGrants,
    effectiveExecuteByRole: rpc.effectiveExecute,
  }) as Readonly<Record<string, unknown>>
}

function rpcProfileComparable(rpc: EnrichedRpcMetadata): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(rpc).filter(
      ([key]) => !['rawAcl', 'rawDefinition', 'rawDefinitionSha256'].includes(key),
    ),
  )
}

export function buildDeploymentProfileIdentity(
  identityInput: SchemaSecurityDefinitionIdentity,
  rpcsInput: readonly EnrichedRpcMetadata[],
  profileInput: DeploymentProfileEvidence,
): DeploymentProfileIdentity {
  const identity = validateSchemaSecurityDefinitionIdentity(identityInput)
  const rpcs = canonicalRpcs(rpcsInput, 'rpcs')
  const profile = canonicalProfileEvidence(profileInput, 'deploymentProfile')
  return {
    schemaVersion: GOLD_IMPORT_COMPENSATION_PROFILE_IDENTITY_SCHEMA_VERSION,
    profileId: profile.profileId,
    target: profile.target,
    roleInventory: profile.roleInventory,
    objectOwners: identity.records
      .filter((record): record is SchemaSecurityDefinitionRecord & { owner: string } =>
        Boolean(record.owner),
      )
      .map(({ objectIdentity, owner }) => ({ objectIdentity, owner })),
    aclRecords: identity.records.filter((record) => ACL_OBJECT_TYPES.has(record.objectType)),
    effectivePrivilegeRecords: identity.records.filter((record) =>
      ['column', 'effective_schema_create_privilege', 'effective_table_privilege'].includes(
        record.objectType,
      ),
    ),
    rpcExecutionProfiles: rpcs.map((rpc) => rpcExecutionProfile(rpc)),
  }
}

export function buildFullEnvironmentInventoryIdentity(
  identityInput: SchemaSecurityDefinitionIdentity,
  rpcsInput: readonly EnrichedRpcMetadata[],
  profileInput: DeploymentProfileEvidence,
): FullEnvironmentInventoryIdentity {
  return {
    schemaVersion: GOLD_IMPORT_COMPENSATION_FULL_INVENTORY_IDENTITY_SCHEMA_VERSION,
    schemaSecurityDefinitionIdentity: validateSchemaSecurityDefinitionIdentity(identityInput),
    rpcs: canonicalRpcs(rpcsInput, 'rpcs'),
    deploymentProfile: canonicalProfileEvidence(profileInput, 'deploymentProfile'),
  }
}

function referencedRoles(identity: SchemaSecurityDefinitionIdentity): Set<string> {
  return new Set(
    identity.records.flatMap((record) => record.relevantRoles).filter((role) => role !== 'PUBLIC'),
  )
}

function ownerRoleAttributeDifferences(
  expected: SupportedDeploymentProfile['ownerRoleAttributes'],
  actual: RoleSecurityAttributes,
): string[] {
  if (!actual.exists || actual.attributes === null) return ['exists']
  const { roleName, ...expectedAttributes } = expected
  return [
    ...(actual.roleName === roleName ? [] : ['roleName']),
    ...Object.keys(expectedAttributes).filter(
      (key) =>
        expectedAttributes[key as keyof RoleAttributes] !==
        actual.attributes?.[key as keyof RoleAttributes],
    ),
  ].sort(compareCodeUnits)
}

function rpcSafetyViolations(
  rpcs: readonly EnrichedRpcMetadata[],
  profile: SupportedDeploymentProfile,
  declaredRoles: ReadonlySet<string>,
): string[] {
  const violations: string[] = []
  const actualNames = rpcs.map(({ name }) => name).sort(compareCodeUnits)
  if (
    reconciliationCanonicalJson(actualNames) !==
    reconciliationCanonicalJson(REQUIRED_RECONCILIATION_RPCS)
  ) {
    violations.push('Transition RPC set does not contain exactly the three required RPC names.')
  }
  for (const rpc of rpcs) {
    const label = rpc.objectIdentity
    if (rpc.owner !== profile.owner)
      violations.push(`${label} has owner ${rpc.owner}, not ${profile.owner}.`)
    if (!rpc.securityDefiner) violations.push(`${label} is not SECURITY DEFINER.`)
    if (
      rpc.searchPath.actual !== 'pg_catalog, public, extensions' ||
      !rpc.searchPath.matchesExpected
    ) {
      violations.push(`${label} does not use the exact safe search_path.`)
    }
    const effectiveKeys = Object.keys(rpc.effectiveExecute).sort(compareCodeUnits)
    const expectedKeys = [...CONTRACT_EXECUTION_ROLES].sort(compareCodeUnits)
    if (reconciliationCanonicalJson(effectiveKeys) !== reconciliationCanonicalJson(expectedKeys)) {
      violations.push(`${label} has an undeclared effective-execute role.`)
    }
    if (
      rpc.effectiveExecute.PUBLIC !== false ||
      rpc.effectiveExecute.anon !== false ||
      rpc.effectiveExecute.authenticated !== false
    ) {
      violations.push(`${label} grants effective execution to PUBLIC, anon, or authenticated.`)
    }
    if (rpc.effectiveExecute.service_role !== true) {
      violations.push(`${label} does not grant the intended service_role execution boundary.`)
    }
    if (
      !rpc.explicitGrants.some(
        ({ grantee, privilegeType }) =>
          grantee === 'service_role' && privilegeType.toLocaleUpperCase('en-US') === 'EXECUTE',
      )
    ) {
      violations.push(`${label} lacks an explicit service_role execute grant.`)
    }
    if (
      rpc.explicitGrants.some(
        ({ grantee, privilegeType }) =>
          ['PUBLIC', 'anon', 'authenticated', 'public'].includes(grantee) &&
          privilegeType.toLocaleUpperCase('en-US') === 'EXECUTE',
      )
    ) {
      violations.push(`${label} explicitly grants execute to an ordinary role.`)
    }
    for (const acl of rpc.explicitGrants) {
      if (
        ['PUBLIC', 'public', 'anon', 'authenticated'].includes(acl.grantee) &&
        acl.privilegeType.toLocaleUpperCase('en-US') === 'EXECUTE'
      ) {
        violations.push(`${label} contains a forbidden normalized execute ACL.`)
      }
      for (const role of [acl.grantee, acl.grantor]) {
        if (role !== 'PUBLIC' && !declaredRoles.has(role)) {
          violations.push(`${label} ACL references undeclared role ${role}.`)
        }
      }
    }
  }
  return violations
}

export function validateDeploymentProfile(input: {
  expectedIdentity: SchemaSecurityDefinitionIdentity
  actualIdentity: SchemaSecurityDefinitionIdentity
  expectedRpcs: readonly EnrichedRpcMetadata[]
  actualRpcs: readonly EnrichedRpcMetadata[]
  expectedProfile: DeploymentProfileEvidence
  actualProfile: DeploymentProfileEvidence
}): DeploymentProfileValidation {
  const expectedProfile = canonicalProfileEvidence(input.expectedProfile, 'expectedProfile')
  const actualProfile = canonicalProfileEvidence(input.actualProfile, 'actualProfile')
  const profile = SUPPORTED_DEPLOYMENT_PROFILES[expectedProfile.profileId]
  const projectedExpectedIdentity = projectSchemaSecurityIdentityForDeploymentProfile(
    input.expectedIdentity,
    expectedProfile.profileId,
  )
  const expectedRpcs = canonicalRpcs(input.expectedRpcs, 'expectedRpcs').map((rpc) =>
    projectRpcMetadataForDeploymentProfile(rpc, expectedProfile.profileId),
  )
  const actualIdentity = validateSchemaSecurityDefinitionIdentity(input.actualIdentity)
  const actualRpcs = canonicalRpcs(input.actualRpcs, 'actualRpcs')
  const expectedProfileIdentity = identityWithSha256(
    buildDeploymentProfileIdentity(projectedExpectedIdentity, expectedRpcs, expectedProfile),
  )
  const actualProfileIdentity = identityWithSha256(
    buildDeploymentProfileIdentity(actualIdentity, actualRpcs, actualProfile),
  )
  const violations: string[] = []
  if (actualProfile.profileId !== expectedProfile.profileId) {
    violations.push('Actual deployment profile ID differs from the expected profile ID.')
  }
  if (expectedProfile.target !== profile.target || actualProfile.target !== profile.target) {
    violations.push(
      `${profile.profileId} is permitted only for target=${profile.target}; remote and cross-target use is forbidden.`,
    )
  }
  if (
    reconciliationCanonicalJson(expectedProfile.roleInventory) !==
    reconciliationCanonicalJson(actualProfile.roleInventory)
  ) {
    violations.push('Actual role inventory or role attributes differ from the declared profile.')
  }
  const expectedRoleInventorySha256 = reconciliationIdentitySha256(expectedProfile.roleInventory)
  const actualRoleInventorySha256 = reconciliationIdentitySha256(actualProfile.roleInventory)
  if (
    expectedRoleInventorySha256 !== profile.roleInventorySha256 ||
    actualRoleInventorySha256 !== profile.roleInventorySha256
  ) {
    violations.push(
      `${profile.profileId} requires the exact checksum-pinned Supabase role inventory; expected/actual role inventory SHA-256 values were ${expectedRoleInventorySha256}/${actualRoleInventorySha256}.`,
    )
  }
  const expectedOwnerRole = expectedProfile.roleInventory.find(
    ({ roleName }) => roleName === profile.owner,
  )
  const actualOwnerRole = actualProfile.roleInventory.find(
    ({ roleName }) => roleName === profile.owner,
  )
  if (!expectedOwnerRole || !actualOwnerRole) {
    violations.push(
      `Trusted owner role ${profile.owner} is absent from the profile role inventory.`,
    )
  } else {
    const expectedAttributeDifferences = ownerRoleAttributeDifferences(
      profile.ownerRoleAttributes,
      expectedOwnerRole,
    )
    const actualAttributeDifferences = ownerRoleAttributeDifferences(
      profile.ownerRoleAttributes,
      actualOwnerRole,
    )
    if (expectedAttributeDifferences.length > 0 || actualAttributeDifferences.length > 0) {
      violations.push(
        `Trusted owner role ${profile.owner} has unexpected security attributes: ${[
          ...new Set([...expectedAttributeDifferences, ...actualAttributeDifferences]),
        ].join(', ')}.`,
      )
    }
  }
  const declaredRoles = new Set([
    ...actualProfile.roleInventory.map(({ roleName }) => roleName),
    ...referencedRoles(projectedExpectedIdentity),
  ])
  for (const role of referencedRoles(actualIdentity)) {
    if (role !== 'public' && !declaredRoles.has(role)) {
      violations.push(`Schema/security inventory references undeclared role ${role}.`)
    }
  }
  violations.push(...rpcSafetyViolations(actualRpcs, profile, declaredRoles))
  if (expectedProfileIdentity.sha256 !== actualProfileIdentity.sha256) {
    violations.push('Actual owner/ACL/effective-privilege profile identity is not exact.')
  }
  return {
    passed: violations.length === 0,
    violations: [...new Set(violations)].sort(compareCodeUnits),
    expectedIdentity: expectedProfileIdentity,
    actualIdentity: actualProfileIdentity,
  }
}

function changedPaths(expected: unknown, actual: unknown, prefix = ''): string[] {
  if (reconciliationCanonicalJson(expected) === reconciliationCanonicalJson(actual)) return []
  if (!isRecord(expected) || !isRecord(actual)) return [prefix || '$']
  return [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .sort(compareCodeUnits)
    .flatMap((key) => changedPaths(expected[key], actual[key], prefix ? `${prefix}.${key}` : key))
}

function securityRecordDifference(
  expected: SchemaSecurityDefinitionRecord,
  paths: readonly string[],
): boolean {
  if (
    ACL_OBJECT_TYPES.has(expected.objectType) ||
    expected.objectType === 'effective_table_privilege' ||
    expected.objectType === 'effective_schema_create_privilege' ||
    expected.objectType === 'policy' ||
    expected.objectType === 'trigger'
  ) {
    return true
  }
  return paths.some(
    (path) =>
      path === 'owner' ||
      path.startsWith('relevantRoles') ||
      /(?:rls|privilege|securityDefiner|searchPath)/iu.test(path),
  )
}

function recordDiffs(input: {
  expected: SchemaSecurityDefinitionIdentity
  actual: SchemaSecurityDefinitionIdentity
  profileId: DeploymentProfileId
  auditExpectationDefects: ReadonlyMap<string, string>
}): {
  diffs: SchemaSecurityRecordDiff[]
  actualAccounted: ReadonlySet<string>
  projected: ProjectedIdentityDetails
} {
  const expected = validateSchemaSecurityDefinitionIdentity(input.expected)
  const actual = validateSchemaSecurityDefinitionIdentity(input.actual)
  const projected = projectedIdentityDetails(expected, input.profileId)
  const actualByIdentity = new Map(actual.records.map((record) => [record.objectIdentity, record]))
  const actualAccounted = new Set<string>()
  const diffs: SchemaSecurityRecordDiff[] = []
  for (const expectedRecord of expected.records) {
    const projectedRecord = profileRecord(
      expectedRecord,
      SUPPORTED_DEPLOYMENT_PROFILES[input.profileId],
    )
    const actualRecord = actualByIdentity.get(projectedRecord.objectIdentity) ?? null
    if (actualRecord) actualAccounted.add(actualRecord.objectIdentity)
    let classification: ContractReconciliationClassification
    let explanation: string
    const paths = actualRecord ? changedPaths(expectedRecord, actualRecord) : []
    const projectedPaths = actualRecord ? changedPaths(projectedRecord, actualRecord) : []
    const declaredDefect = input.auditExpectationDefects.get(expectedRecord.objectIdentity)
    if (!actualRecord) {
      classification = 'missing_expected_object'
      explanation = 'No actual record satisfies the expected object under the selected profile.'
    } else if (projectedPaths.length === 0) {
      if (paths.length === 0) {
        classification = 'identical'
        explanation = 'Expected and actual records are byte-for-byte canonical matches.'
      } else if (declaredDefect) {
        classification = 'audit_expectation_defect'
        explanation = declaredDefect
      } else if (ACL_OBJECT_TYPES.has(expectedRecord.objectType)) {
        classification = 'environment_representation_only'
        explanation =
          'The raw ACL row maps exactly to the selected profile; no effective privilege changed.'
      } else {
        classification = 'explicitly_supported_local_profile'
        explanation =
          'The only differences are exact owner/profile fields authorized by the selected local profile.'
      }
    } else {
      const expectedInvariant = contractInvariantRecord(expectedRecord)
      const actualInvariant = contractInvariantRecord(actualRecord)
      const invariantMatches =
        reconciliationCanonicalJson(expectedInvariant) ===
        reconciliationCanonicalJson(actualInvariant)
      if (invariantMatches || securityRecordDifference(expectedRecord, projectedPaths)) {
        classification = 'security_contract_difference'
        explanation = invariantMatches
          ? 'Owner, ACL, or privilege state is outside the exact selected deployment profile.'
          : 'A security-relevant definition or effective privilege differs.'
      } else {
        classification = 'semantic_contract_difference'
        explanation = 'The environment-invariant semantic definition differs.'
      }
    }
    diffs.push({
      expectedObjectIdentity: expectedRecord.objectIdentity,
      projectedExpectedObjectIdentity: projectedRecord.objectIdentity,
      actualObjectIdentity: actualRecord?.objectIdentity ?? null,
      objectType: expectedRecord.objectType,
      classification,
      changedPaths: paths,
      explanation,
      expected: expectedRecord,
      actual: actualRecord,
    })
  }
  const projectedIdentities = new Set(
    projected.identity.records.map(({ objectIdentity }) => objectIdentity),
  )
  for (const actualRecord of actual.records) {
    if (projectedIdentities.has(actualRecord.objectIdentity)) continue
    diffs.push({
      expectedObjectIdentity: null,
      projectedExpectedObjectIdentity: null,
      actualObjectIdentity: actualRecord.objectIdentity,
      objectType: actualRecord.objectType,
      classification: 'unexpected_object',
      changedPaths: [],
      explanation: 'The actual inventory contains an object not declared by the selected profile.',
      expected: null,
      actual: actualRecord,
    })
    actualAccounted.add(actualRecord.objectIdentity)
  }
  return { diffs, actualAccounted, projected }
}

function rpcDifferenceIsSecurity(paths: readonly string[]): boolean {
  return paths.some((path) =>
    /(?:owner|Acl|Execute|explicitGrants|effectiveExecute|securityDefiner|searchPath)/u.test(path),
  )
}

function rpcDiffs(input: {
  expected: readonly EnrichedRpcMetadata[]
  actual: readonly EnrichedRpcMetadata[]
  profileId: DeploymentProfileId
}): RpcMetadataDiff[] {
  const expected = canonicalRpcs(input.expected, 'expectedRpcs')
  const actual = canonicalRpcs(input.actual, 'actualRpcs')
  const actualByName = new Map(actual.map((rpc) => [rpc.name, rpc]))
  const expectedNames = new Set(expected.map(({ name }) => name))
  const diffs: RpcMetadataDiff[] = expected.map((expectedRpc) => {
    const projected = projectRpcMetadataForDeploymentProfile(expectedRpc, input.profileId)
    const actualRpc = actualByName.get(expectedRpc.name) ?? null
    if (!actualRpc) {
      return {
        rpcName: expectedRpc.name,
        expectedFunctionIdentity: expectedRpc.objectIdentity,
        actualFunctionIdentity: null,
        classification: 'missing_expected_object' as const,
        changedPaths: [],
        explanation: 'Required transition RPC is missing.',
        expected: expectedRpc,
        actual: null,
      }
    }
    const paths = changedPaths(expectedRpc, actualRpc)
    const projectedPaths = changedPaths(
      rpcProfileComparable(projected),
      rpcProfileComparable(actualRpc),
    )
    if (projectedPaths.length === 0) {
      const representationOnly =
        paths.length > 0 &&
        paths.every((path) => ['rawAcl', 'rawDefinition', 'rawDefinitionSha256'].includes(path))
      return {
        rpcName: expectedRpc.name,
        expectedFunctionIdentity: expectedRpc.objectIdentity,
        actualFunctionIdentity: actualRpc.objectIdentity,
        classification:
          paths.length === 0
            ? ('identical' as const)
            : representationOnly
              ? ('environment_representation_only' as const)
              : ('explicitly_supported_local_profile' as const),
        changedPaths: paths,
        explanation:
          paths.length === 0
            ? 'Expected and actual RPC metadata are exact.'
            : representationOnly
              ? 'Raw ACL serialization differs, while the normalized ACL and effective grants are exact.'
              : 'RPC owner and ACL metadata match the exact selected local profile.',
        expected: expectedRpc,
        actual: actualRpc,
      }
    }
    const invariantMatches =
      reconciliationCanonicalJson(rpcInvariant(expectedRpc)) ===
      reconciliationCanonicalJson(rpcInvariant(actualRpc))
    return {
      rpcName: expectedRpc.name,
      expectedFunctionIdentity: expectedRpc.objectIdentity,
      actualFunctionIdentity: actualRpc.objectIdentity,
      classification:
        invariantMatches || rpcDifferenceIsSecurity(projectedPaths)
          ? ('security_contract_difference' as const)
          : ('semantic_contract_difference' as const),
      changedPaths: paths,
      explanation:
        invariantMatches || rpcDifferenceIsSecurity(projectedPaths)
          ? 'RPC execution security metadata is outside the selected profile or invariant.'
          : 'RPC body, signature, language, volatility, parallel safety, defaults, result, or dependencies differ.',
      expected: expectedRpc,
      actual: actualRpc,
    }
  })
  for (const actualRpc of actual) {
    if (expectedNames.has(actualRpc.name)) continue
    diffs.push({
      rpcName: actualRpc.name,
      expectedFunctionIdentity: null,
      actualFunctionIdentity: actualRpc.objectIdentity,
      classification: 'unexpected_object',
      changedPaths: [],
      explanation: 'Unexpected transition RPC overload/name is present.',
      expected: null,
      actual: actualRpc,
    })
  }
  return diffs.sort((left, right) => compareCodeUnits(left.rpcName, right.rpcName))
}

function deploymentProfileEvidenceDiffs(
  expected: DeploymentProfileEvidence,
  actual: DeploymentProfileEvidence,
): DeploymentProfileEvidenceDiff[] {
  const selectionExpected = { profileId: expected.profileId, target: expected.target }
  const selectionActual = { profileId: actual.profileId, target: actual.target }
  const selectionPaths = changedPaths(selectionExpected, selectionActual)
  const diffs: DeploymentProfileEvidenceDiff[] = [
    {
      evidenceIdentity: 'deployment_profile.selection',
      classification: selectionPaths.length === 0 ? 'identical' : 'security_contract_difference',
      changedPaths: selectionPaths,
      explanation:
        selectionPaths.length === 0
          ? 'Deployment profile ID and target are exact.'
          : 'Deployment profile ID or target is outside the declared security profile.',
      expected: selectionExpected,
      actual: selectionActual,
    },
  ]
  const expectedRoles = new Map(expected.roleInventory.map((role) => [role.roleName, role]))
  const actualRoles = new Map(actual.roleInventory.map((role) => [role.roleName, role]))
  const roleNames = [...new Set([...expectedRoles.keys(), ...actualRoles.keys()])].sort(
    compareCodeUnits,
  )
  for (const roleName of roleNames) {
    const expectedRole = expectedRoles.get(roleName) ?? null
    const actualRole = actualRoles.get(roleName) ?? null
    const paths = expectedRole && actualRole ? changedPaths(expectedRole, actualRole) : []
    const classification: ContractReconciliationClassification = !expectedRole
      ? 'unexpected_object'
      : !actualRole
        ? 'missing_expected_object'
        : paths.length === 0
          ? 'identical'
          : 'security_contract_difference'
    diffs.push({
      evidenceIdentity: `deployment_profile.role.${roleName}`,
      classification,
      changedPaths: paths,
      explanation:
        classification === 'identical'
          ? 'Role attributes and direct/effective memberships are exact.'
          : classification === 'missing_expected_object'
            ? 'A declared deployment-profile role is missing.'
            : classification === 'unexpected_object'
              ? 'An undeclared role appears in the deployment-profile inventory.'
              : 'Role attributes or direct/effective memberships differ from the exact profile.',
      expected: expectedRole,
      actual: actualRole,
    })
  }
  return diffs
}

function ownerRepresentationExplanation(
  expected: SchemaSecurityDefinitionIdentity,
  actual: SchemaSecurityDefinitionIdentity,
  projected: ProjectedIdentityDetails,
): OwnerRepresentationExplanation {
  const collapsedByObjectType: Record<string, number> = {}
  let collapsedExpectedRecordCount = 0
  for (const sources of projected.sourceRecordsByProjectedIdentity.values()) {
    const collapsed = sources.length - 1
    if (collapsed <= 0) continue
    collapsedExpectedRecordCount += collapsed
    const objectTypes = [...new Set(sources.map(({ objectType }) => objectType))]
    const objectType = objectTypes.length === 1 ? (objectTypes[0] as string) : 'mixed'
    collapsedByObjectType[objectType] = (collapsedByObjectType[objectType] ?? 0) + collapsed
  }
  const projectionExactlyMatchesActual =
    reconciliationCanonicalJson(projected.identity) === reconciliationCanonicalJson(actual)
  const isExact763To683OwnerRepresentation =
    expected.records.length === 763 &&
    actual.records.length === 683 &&
    collapsedExpectedRecordCount === 80 &&
    collapsedByObjectType.function_acl === 24 &&
    collapsedByObjectType.table_acl === 56 &&
    projectionExactlyMatchesActual
  return {
    expectedRecordCount: expected.records.length,
    actualRecordCount: actual.records.length,
    recordCountDelta: expected.records.length - actual.records.length,
    projectedExpectedRecordCount: projected.identity.records.length,
    collapsedExpectedRecordCount,
    collapsedByObjectType: Object.fromEntries(
      Object.entries(collapsedByObjectType).sort(([left], [right]) =>
        compareCodeUnits(left, right),
      ),
    ),
    projectionExactlyMatchesActual,
    isExact763To683OwnerRepresentation,
    explanation: isExact763To683OwnerRepresentation
      ? 'The local postgres-owner profile maps all 763 records exactly to the 683-record inventory: 24 function owner ACL rows and 56 table owner ACL rows collapse into existing postgres grants, with no invariant or effective-privilege loss.'
      : 'The selected profile projection does not completely explain the expected-versus-actual record inventory.',
  }
}

function classificationCounts(
  recordDifferences: readonly SchemaSecurityRecordDiff[],
  rpcDifferences: readonly RpcMetadataDiff[],
  profileDifferences: readonly DeploymentProfileEvidenceDiff[],
): Record<ContractReconciliationClassification, number> {
  const counts = Object.fromEntries(
    CONTRACT_RECONCILIATION_CLASSIFICATIONS.map((classification) => [classification, 0]),
  ) as Record<ContractReconciliationClassification, number>
  for (const difference of [...recordDifferences, ...rpcDifferences, ...profileDifferences]) {
    counts[difference.classification] += 1
  }
  return counts
}

export function reconcileGoldImportCompensationContract(
  input: GoldImportCompensationContractReconciliationInput,
): GoldImportCompensationContractReconciliation {
  const expectedIdentity = validateSchemaSecurityDefinitionIdentity(input.expectedIdentity)
  const actualIdentity = validateSchemaSecurityDefinitionIdentity(input.actualIdentity)
  const expectedRpcs = canonicalRpcs(input.expectedRpcs, 'expectedRpcs')
  const actualRpcs = canonicalRpcs(input.actualRpcs, 'actualRpcs')
  const expectedRpcNames = expectedRpcs.map(({ name }) => name).sort(compareCodeUnits)
  if (
    reconciliationCanonicalJson(expectedRpcNames) !==
    reconciliationCanonicalJson(REQUIRED_RECONCILIATION_RPCS)
  ) {
    throw new Error('Expected RPC metadata must declare exactly the three transition RPCs.')
  }
  const expectedProfile = canonicalProfileEvidence(input.expectedProfile, 'expectedProfile')
  const actualProfile = canonicalProfileEvidence(input.actualProfile, 'actualProfile')
  const auditDefects = new Map<string, string>()
  for (const [index, defect] of (input.auditExpectationDefects ?? []).entries()) {
    const objectIdentity = requireNonempty(
      defect.objectIdentity,
      `auditExpectationDefects[${index}].objectIdentity`,
    )
    const reason = requireNonempty(defect.reason, `auditExpectationDefects[${index}].reason`)
    if (auditDefects.has(objectIdentity)) {
      throw new Error(`Duplicate audit-expectation defect for ${objectIdentity}.`)
    }
    auditDefects.set(objectIdentity, reason)
  }
  const deploymentProfile = validateDeploymentProfile({
    expectedIdentity,
    actualIdentity,
    expectedRpcs,
    actualRpcs,
    expectedProfile,
    actualProfile,
  })
  const expectedInvariant = identityWithSha256(
    buildContractInvariantIdentity(expectedIdentity, expectedRpcs),
  )
  const actualInvariant = identityWithSha256(
    buildContractInvariantIdentity(actualIdentity, actualRpcs),
  )
  const expectedFullInventory = identityWithSha256(
    buildFullEnvironmentInventoryIdentity(expectedIdentity, expectedRpcs, expectedProfile),
  )
  const actualFullInventory = identityWithSha256(
    buildFullEnvironmentInventoryIdentity(actualIdentity, actualRpcs, actualProfile),
  )
  const recordDifferenceResult = recordDiffs({
    expected: expectedIdentity,
    actual: actualIdentity,
    profileId: expectedProfile.profileId,
    auditExpectationDefects: auditDefects,
  })
  const rpcDifferences = rpcDiffs({
    expected: expectedRpcs,
    actual: actualRpcs,
    profileId: expectedProfile.profileId,
  })
  const profileDifferences = deploymentProfileEvidenceDiffs(expectedProfile, actualProfile)
  const counts = classificationCounts(
    recordDifferenceResult.diffs,
    rpcDifferences,
    profileDifferences,
  )
  const invariantIdentityMatches = expectedInvariant.sha256 === actualInvariant.sha256
  const fullEnvironmentInventoryMatches =
    expectedFullInventory.sha256 === actualFullInventory.sha256
  const blockingClassifications = [
    'missing_expected_object',
    'unexpected_object',
    'semantic_contract_difference',
    'security_contract_difference',
  ] as const
  const readinessBlockers: string[] = []
  if (!invariantIdentityMatches)
    readinessBlockers.push('Environment-invariant contract identity differs.')
  if (!deploymentProfile.passed) readinessBlockers.push(...deploymentProfile.violations)
  for (const classification of blockingClassifications) {
    if (counts[classification] > 0) {
      readinessBlockers.push(`${counts[classification]} ${classification} difference(s) remain.`)
    }
  }
  const expectedRecordsAccountedFor = recordDifferenceResult.diffs.filter(
    ({ expected }) => expected !== null,
  ).length
  const completeness = {
    expectedRecordCount: expectedIdentity.records.length,
    actualRecordCount: actualIdentity.records.length,
    expectedRecordsAccountedFor,
    actualRecordsAccountedFor: recordDifferenceResult.actualAccounted.size,
    complete:
      expectedRecordsAccountedFor === expectedIdentity.records.length &&
      recordDifferenceResult.actualAccounted.size === actualIdentity.records.length,
  }
  return {
    schemaVersion: GOLD_IMPORT_COMPENSATION_RECONCILIATION_SCHEMA_VERSION,
    ready: readinessBlockers.length === 0 && completeness.complete,
    readinessBlockers: [...new Set(readinessBlockers)].sort(compareCodeUnits),
    identities: {
      expected: {
        contractInvariant: expectedInvariant,
        deploymentProfile: deploymentProfile.expectedIdentity,
        fullEnvironmentInventory: expectedFullInventory,
      },
      actual: {
        contractInvariant: actualInvariant,
        deploymentProfile: deploymentProfile.actualIdentity,
        fullEnvironmentInventory: actualFullInventory,
      },
    },
    invariantIdentityMatches,
    deploymentProfile,
    fullEnvironmentInventoryMatches,
    recordDiffs: recordDifferenceResult.diffs,
    rpcDiffs: rpcDifferences,
    profileDiffs: profileDifferences,
    classificationCounts: counts,
    completeness,
    ownerRepresentation: ownerRepresentationExplanation(
      expectedIdentity,
      actualIdentity,
      recordDifferenceResult.projected,
    ),
  }
}
