import { createHash } from 'node:crypto'

import { canonicalJson } from './gold-import-compensation-migration-operations'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  type PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION,
  type ProtectedV2CatalogExpectedArtifact,
  type ProtectedV2ExpectedCatalogComponentName,
  type ProtectedV2ExpectedCatalogProfileId,
  type ProtectedV2ExpectedCatalogTarget,
} from './gold-import-contract-v2-catalog-expectations'
import {
  PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION,
  isSafeProtectedV2RepositoryPath,
} from './protected-gold-import-contract-v2-module-resolution'
import {
  PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES,
  PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
  validateProtectedV2OperatorBundle,
  type ProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS,
  PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION,
  PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SHA256,
} from './protected-gold-import-contract-v2-runtime-inputs'

export const PROTECTED_V2_EXPECTED_CATALOG_BINDING_SCHEMA_VERSION =
  'literature-gold-protected-v2-expected-catalog-binding/1.0.0' as const
export const PROTECTED_V2_RUNTIME_BUNDLE_BINDING_SCHEMA_VERSION =
  'literature-gold-protected-v2-runtime-bundle-binding/1.0.0' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u

const EXPECTED_CATALOG_ARTIFACT_FILES = {
  local_supabase_postgres_owner_v1: {
    fileSha256: 'd74db10540442590670e5e309f5812426f2441a9b0b97cbcbcb02e33a45337f6',
    path: 'scripts/literature/contracts/protected-v2-complete-catalog/local_supabase_postgres_owner_v1.json',
  },
  supabase_admin_owner_v1: {
    fileSha256: '297a98e4b90718737c7fd59c5b380f38c231e151e8b39122ebb6555eb90146ac',
    path: 'scripts/literature/contracts/protected-v2-complete-catalog/supabase_admin_owner_v1.json',
  },
} as const

function sha256(value: string): string {
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

function requiredSha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256.`)
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function canonicalFrozenClone<T>(value: T): T {
  return deepFreeze(JSON.parse(canonicalJson(value)) as T)
}

export interface ProtectedV2ExpectedCatalogBinding {
  artifact: {
    contentSha256: string
    fileSha256: string
    path: string
    schemaVersion: typeof PROTECTED_V2_CATALOG_EXPECTATION_SCHEMA_VERSION
  }
  auditMethod: string
  auditModel: string
  auditModelIdentitySha256: string
  bindingSha256: string
  componentIdentities: Record<ProtectedV2ExpectedCatalogComponentName, string>
  environmentInvariantIdentitySha256: string
  expectedDeploymentProfileIdentitySha256: string
  fullAuditIdentitySha256: string
  fullEnvironmentInventoryIdentitySha256: string
  fullEnvironmentInventoryRecordCount: number
  migration: ProtectedV2CatalogExpectedArtifact['migration']
  normalizedInventoryCanonicalJsonSha256: string
  observedAuditSchemaVersion: string
  profileId: ProtectedV2ExpectedCatalogProfileId
  schemaVersion: typeof PROTECTED_V2_EXPECTED_CATALOG_BINDING_SCHEMA_VERSION
  target: ProtectedV2ExpectedCatalogTarget
  verifier: ProtectedV2CatalogExpectedArtifact['verifier']
  verifierExecuted: false
}

function expectedCatalogBindingContent(
  profileId: ProtectedV2ExpectedCatalogProfileId,
  target: ProtectedV2ExpectedCatalogTarget,
): Omit<ProtectedV2ExpectedCatalogBinding, 'bindingSha256'> {
  const artifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(profileId, target)
  const file = EXPECTED_CATALOG_ARTIFACT_FILES[profileId]
  return {
    artifact: {
      contentSha256: artifact.artifactContentSha256,
      fileSha256: file.fileSha256,
      path: file.path,
      schemaVersion: artifact.artifactSchemaVersion,
    },
    auditMethod: artifact.auditMethod,
    auditModel: artifact.auditModel,
    auditModelIdentitySha256: artifact.auditModelIdentitySha256,
    componentIdentities: { ...artifact.componentIdentities },
    environmentInvariantIdentitySha256: artifact.environmentInvariantIdentitySha256,
    expectedDeploymentProfileIdentitySha256: artifact.expectedDeploymentProfileIdentitySha256,
    fullAuditIdentitySha256: artifact.fullAuditIdentitySha256,
    fullEnvironmentInventoryIdentitySha256: artifact.fullEnvironmentInventoryIdentitySha256,
    fullEnvironmentInventoryRecordCount: artifact.fullEnvironmentInventoryRecordCount,
    migration: artifact.migration,
    normalizedInventoryCanonicalJsonSha256: artifact.normalizedInventory.canonicalJsonSha256,
    observedAuditSchemaVersion: artifact.observedAuditSchemaVersion,
    profileId,
    schemaVersion: PROTECTED_V2_EXPECTED_CATALOG_BINDING_SCHEMA_VERSION,
    target,
    verifier: artifact.verifier,
    verifierExecuted: false,
  }
}

export function buildProtectedV2ExpectedCatalogBinding(
  profileId: ProtectedV2ExpectedCatalogProfileId,
  target: ProtectedV2ExpectedCatalogTarget,
): ProtectedV2ExpectedCatalogBinding {
  const content = expectedCatalogBindingContent(profileId, target)
  return canonicalFrozenClone({ ...content, bindingSha256: sha256(canonicalJson(content)) })
}

export function validateProtectedV2ExpectedCatalogBinding(
  input: unknown,
  profileId: ProtectedV2ExpectedCatalogProfileId,
  target: ProtectedV2ExpectedCatalogTarget,
): ProtectedV2ExpectedCatalogBinding {
  const expected = buildProtectedV2ExpectedCatalogBinding(profileId, target)
  if (canonicalJson(input) !== canonicalJson(expected)) {
    throw new Error(
      `Protected V2 expected catalog binding does not match exact ${profileId}/${target} contract.`,
    )
  }
  return expected
}

export interface ProtectedV2RuntimeBundleBinding {
  aggregateSha256: string
  bindingSha256: string
  explicitRoots: string[]
  finalRoots: string[]
  moduleResolutionAuditSchemaVersion: typeof PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION
  moduleResolutionAuditSha256: string
  operatorBundleSchemaVersion: typeof PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION
  protectedDirectories: string[]
  runtimeInputAuditSha256: string
  runtimeInputAuditSchemaVersion: typeof PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION
  runtimeInputDeclarationSha256: string
  schemaVersion: typeof PROTECTED_V2_RUNTIME_BUNDLE_BINDING_SCHEMA_VERSION
  trackedFileCount: number
  trackedFileInventorySha256: string
}

function runtimeBundleBindingContent(
  input: ProtectedV2OperatorBundle,
): Omit<ProtectedV2RuntimeBundleBinding, 'bindingSha256'> {
  const bundle = validateAndFreezeProtectedV2OperatorBundle(input)
  return {
    aggregateSha256: bundle.aggregateSha256,
    explicitRoots: [...PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS].sort(compareCodeUnits),
    finalRoots: [...bundle.roots],
    moduleResolutionAuditSchemaVersion: bundle.moduleResolutionAudit.schemaVersion,
    moduleResolutionAuditSha256: bundle.moduleResolutionAudit.sha256,
    operatorBundleSchemaVersion: PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
    protectedDirectories: [...bundle.protectedDirectories],
    runtimeInputAuditSha256: bundle.runtimeInputAudit.sha256,
    runtimeInputAuditSchemaVersion: bundle.runtimeInputAudit.schemaVersion,
    runtimeInputDeclarationSha256: bundle.runtimeInputAudit.declarationSha256,
    schemaVersion: PROTECTED_V2_RUNTIME_BUNDLE_BINDING_SCHEMA_VERSION,
    trackedFileCount: bundle.files.length,
    trackedFileInventorySha256: sha256(canonicalJson(bundle.files)),
  }
}

export function validateAndFreezeProtectedV2OperatorBundle(
  input: ProtectedV2OperatorBundle,
): ProtectedV2OperatorBundle {
  return canonicalFrozenClone(validateProtectedV2OperatorBundle(input))
}

export function buildProtectedV2RuntimeBundleBinding(
  input: ProtectedV2OperatorBundle,
): ProtectedV2RuntimeBundleBinding {
  const content = runtimeBundleBindingContent(input)
  return canonicalFrozenClone({ ...content, bindingSha256: sha256(canonicalJson(content)) })
}

export function parseProtectedV2RuntimeBundleBinding(
  input: unknown,
): ProtectedV2RuntimeBundleBinding {
  const binding = record(input, 'Protected V2 runtime-bundle binding')
  const expectedKeys = [
    'aggregateSha256',
    'bindingSha256',
    'explicitRoots',
    'finalRoots',
    'moduleResolutionAuditSchemaVersion',
    'moduleResolutionAuditSha256',
    'operatorBundleSchemaVersion',
    'protectedDirectories',
    'runtimeInputAuditSha256',
    'runtimeInputAuditSchemaVersion',
    'runtimeInputDeclarationSha256',
    'schemaVersion',
    'trackedFileCount',
    'trackedFileInventorySha256',
  ].sort(compareCodeUnits)
  if (
    canonicalJson(Object.keys(binding).sort(compareCodeUnits)) !== canonicalJson(expectedKeys) ||
    binding.schemaVersion !== PROTECTED_V2_RUNTIME_BUNDLE_BINDING_SCHEMA_VERSION ||
    binding.operatorBundleSchemaVersion !== PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION ||
    binding.moduleResolutionAuditSchemaVersion !==
      PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION ||
    binding.runtimeInputAuditSchemaVersion !== PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION ||
    !Array.isArray(binding.explicitRoots) ||
    !Array.isArray(binding.finalRoots) ||
    !Array.isArray(binding.protectedDirectories) ||
    !Number.isSafeInteger(binding.trackedFileCount) ||
    (binding.trackedFileCount as number) <= 0
  ) {
    throw new Error('Protected V2 runtime-bundle binding shape or schema drifted.')
  }
  if (
    [...binding.explicitRoots, ...binding.finalRoots, ...binding.protectedDirectories].some(
      (value) => typeof value !== 'string' || !isSafeProtectedV2RepositoryPath(value),
    )
  ) {
    throw new Error('Protected V2 runtime-bundle binding contains a non-string path.')
  }
  const explicitRoots = binding.explicitRoots as string[]
  const finalRoots = binding.finalRoots as string[]
  const protectedDirectories = binding.protectedDirectories as string[]
  if (
    canonicalJson(explicitRoots) !==
      canonicalJson([...PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS].sort(compareCodeUnits)) ||
    canonicalJson(protectedDirectories) !==
      canonicalJson([...PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES].sort(compareCodeUnits)) ||
    canonicalJson(finalRoots) !== canonicalJson([...new Set(finalRoots)].sort(compareCodeUnits)) ||
    explicitRoots.some((path) => !finalRoots.includes(path))
  ) {
    throw new Error('Protected V2 runtime-bundle binding root inventory drifted.')
  }
  for (const [label, value] of Object.entries({
    aggregateSha256: binding.aggregateSha256,
    bindingSha256: binding.bindingSha256,
    moduleResolutionAuditSha256: binding.moduleResolutionAuditSha256,
    runtimeInputAuditSha256: binding.runtimeInputAuditSha256,
    runtimeInputDeclarationSha256: binding.runtimeInputDeclarationSha256,
    trackedFileInventorySha256: binding.trackedFileInventorySha256,
  })) {
    requiredSha256(value, `runtime-bundle binding ${label}`)
  }
  if (binding.runtimeInputDeclarationSha256 !== PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SHA256) {
    throw new Error('Protected V2 runtime-input declaration binding drifted.')
  }
  const { bindingSha256, ...content } = binding
  if (sha256(canonicalJson(content)) !== bindingSha256) {
    throw new Error('Protected V2 runtime-bundle binding checksum is invalid.')
  }
  return canonicalFrozenClone(binding as unknown as ProtectedV2RuntimeBundleBinding)
}

export function validateProtectedV2RuntimeBundleBinding(
  input: unknown,
  bundle: ProtectedV2OperatorBundle,
): ProtectedV2RuntimeBundleBinding {
  const parsed = parseProtectedV2RuntimeBundleBinding(input)
  const expected = buildProtectedV2RuntimeBundleBinding(bundle)
  if (canonicalJson(parsed) !== canonicalJson(expected)) {
    throw new Error('Protected V2 runtime-bundle binding does not match its sealed bundle.')
  }
  return expected
}

export function assertProtectedV2ExpectedCatalogArtifactSealed(input: {
  binding: ProtectedV2ExpectedCatalogBinding
  bundle: ProtectedV2OperatorBundle
  profileId: ProtectedV2ExpectedCatalogProfileId
  target: ProtectedV2ExpectedCatalogTarget
}): void {
  const binding = validateProtectedV2ExpectedCatalogBinding(
    input.binding,
    input.profileId,
    input.target,
  )
  const bundle = validateProtectedV2OperatorBundle(input.bundle)
  const artifact = bundle.files.filter(({ path }) => path === binding.artifact.path)
  if (artifact.length !== 1 || artifact[0]?.sha256 !== binding.artifact.fileSha256) {
    throw new Error('Protected V2 expected catalog artifact is not exact inside the sealed bundle.')
  }
}
