import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2 } from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import type { GoldImportCompensationV2ReadyAudit } from './audit-gold-import-compensation-v2'
import {
  parseProtectedV2ApplicationExecutionReceipt,
  parseProtectedV2ApplicationIntent,
  parseProtectedV2ApplicationResult,
} from './protected-gold-import-contract-v2-evidence'
import {
  loadProtectedV2FinalizedReceiptRecovery,
  type ProtectedV2FinalizedRecoveryReceiptAuthority,
  type ProtectedV2FinalizedRecoveryReceiptReference,
} from './protected-gold-import-contract-v2-receipt-recovery-core'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  parseImmutableProtectedV2ReceiptRecoveryCommittedAmendment,
} from './protected-gold-import-contract-v2-receipt-recovery-authority'

export const GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION =
  'gold-import-compensation-v2-finalized-migration-receipt-gate/1.0.0' as const
export const GOLD_IMPORT_COMPENSATION_V2_RECOVERY_RECEIPT_AUTHORITY_SCHEMA_VERSION =
  'gold-import-compensation-v2-finalized-recovery-receipt-authority/1.0.0' as const
export const PROTECTED_V2_FINALIZED_RECOVERY_RECEIPT_AUTHORITY_PATH =
  'scripts/literature/contracts/protected-v2-finalized-receipt-recovery-authority-v1.json' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const sha256Schema = z.string().regex(SHA256_PATTERN)
const uuidSchema = z.string().uuid()
const issuedMigrationReceiptGates = new WeakSet<object>()
const CANONICAL_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CANONICAL_PROTECTED_V2_RECEIPT_ROOT = resolve(
  CANONICAL_REPOSITORY_ROOT,
  'local-data/literature/protected-v2-application-receipts',
)

const migrationSchema = z
  .object({
    id: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
    sha256: sha256Schema,
    v1Occurrence: z.literal(1),
    v2Occurrence: z.literal(1),
  })
  .strict()

const catalogSchema = z
  .object({
    completeCatalogAuditIdentitySha256: sha256Schema,
    expectedCatalogBindingSha256: sha256Schema,
  })
  .strict()

const preImportStateSchema = z
  .object({
    developmentMembershipSha256: sha256Schema,
    developmentPlanningStateSha256: sha256Schema,
    effectiveStateSha256: sha256Schema,
    physicalStateSha256: sha256Schema,
  })
  .strict()

const normalReceiptSourceSchema = z
  .object({
    executionReceiptSha256: sha256Schema,
    finalManifestSha256: sha256Schema,
    intentManifestSha256: sha256Schema,
    operatorBundleSha256: sha256Schema,
    originalIntentSha256: sha256Schema,
    outputDirectory: z.string().min(1),
    receiptKind: z.literal('normal_application'),
    resultSha256: sha256Schema,
  })
  .strict()

const recoveryReceiptSourceSchema = z
  .object({
    executionReceiptSha256: sha256Schema,
    finalManifestSha256: sha256Schema,
    originalIntentSha256: sha256Schema,
    outputDirectory: z.string().min(1),
    receiptKind: z.literal('historical_recovery'),
    recoveryAmendmentIdentitySha256: sha256Schema,
    recoveryToolBundleSha256: sha256Schema,
    resultSha256: sha256Schema,
  })
  .strict()

const disposableSourceSchema = z
  .object({
    auditIdentitySha256: sha256Schema,
    receiptKind: z.literal('disposable_rehearsal'),
  })
  .strict()

const commonGateShape = {
  batchId: uuidSchema,
  catalog: catalogSchema,
  compensationAuthorized: z.literal(false),
  gateIdentitySha256: sha256Schema,
  importAuthorized: z.literal(false),
  migration: migrationSchema,
  migrationReceiptComplete: z.literal(true),
  preImportState: preImportStateSchema,
  schemaVersion: z.literal(GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION),
} as const

const localMigrationReceiptGateSchema = z
  .object({
    ...commonGateShape,
    auditTarget: z.literal('local'),
    kind: z.literal('finalized_migration_receipt'),
    productionUseAllowed: z.literal(true),
    source: z.discriminatedUnion('receiptKind', [
      normalReceiptSourceSchema,
      recoveryReceiptSourceSchema,
    ]),
  })
  .strict()

const disposableMigrationReceiptGateSchema = z
  .object({
    ...commonGateShape,
    auditTarget: z.literal('disposable_clone'),
    kind: z.literal('disposable_rehearsal'),
    productionUseAllowed: z.literal(false),
    source: disposableSourceSchema,
  })
  .strict()

export const goldImportCompensationV2MigrationReceiptGateSchema = z.discriminatedUnion(
  'auditTarget',
  [localMigrationReceiptGateSchema, disposableMigrationReceiptGateSchema],
)

export type GoldImportCompensationV2MigrationReceiptGate = z.infer<
  typeof goldImportCompensationV2MigrationReceiptGateSchema
>
export type GoldImportCompensationV2LocalMigrationReceiptGate = z.infer<
  typeof localMigrationReceiptGateSchema
>
export type GoldImportCompensationV2DisposableMigrationReceiptGate = z.infer<
  typeof disposableMigrationReceiptGateSchema
>

export interface GoldImportCompensationV2MigrationReceiptAuditBinding {
  auditTarget: 'disposable_clone' | 'local'
  batchId: string
  completeCatalogAuditIdentitySha256: string
  developmentMembershipSha256: string
  developmentPlanningStateSha256: string
  expectedCatalogBindingSha256: string
  migrationId: typeof GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2
  migrationSha256: string
  preImportEffectiveStateSha256: string
  preImportPhysicalStateSha256: string
  v1Occurrence: number
  v2Occurrence: number
}

export interface GoldImportCompensationV2CommittedRecoveryReceiptAuthority {
  authority: ProtectedV2FinalizedRecoveryReceiptReference
  authorityIdentitySha256: string
  schemaVersion: typeof GOLD_IMPORT_COMPENSATION_V2_RECOVERY_RECEIPT_AUTHORITY_SCHEMA_VERSION
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalPretty(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`
}

function canonicalFrozenClone<T>(value: T): T {
  const clone = JSON.parse(canonicalJson(value)) as T
  const freeze = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object' || Object.isFrozen(candidate)) return
    for (const child of Object.values(candidate as Record<string, unknown>)) freeze(child)
    Object.freeze(candidate)
  }
  freeze(clone)
  return clone
}

function gateContent(
  gate: GoldImportCompensationV2MigrationReceiptGate,
): Omit<GoldImportCompensationV2MigrationReceiptGate, 'gateIdentitySha256'> {
  const { gateIdentitySha256, ...content } = gate
  void gateIdentitySha256
  return content
}

export function validateGoldImportCompensationV2MigrationReceiptGate(
  input: unknown,
): GoldImportCompensationV2MigrationReceiptGate {
  const issued =
    typeof input === 'object' && input !== null && issuedMigrationReceiptGates.has(input)
  const gate = goldImportCompensationV2MigrationReceiptGateSchema.parse(input)
  if (gate.gateIdentitySha256 !== sha256Canonical(gateContent(gate))) {
    throw new Error('V2 migration receipt gate identity is invalid.')
  }
  const validated = canonicalFrozenClone(gate)
  if (issued) issuedMigrationReceiptGates.add(validated)
  return validated
}

function buildGate<
  T extends Omit<GoldImportCompensationV2MigrationReceiptGate, 'gateIdentitySha256'>,
>(content: T): GoldImportCompensationV2MigrationReceiptGate {
  const gate = validateGoldImportCompensationV2MigrationReceiptGate({
    ...content,
    gateIdentitySha256: sha256Canonical(content),
  })
  issuedMigrationReceiptGates.add(gate)
  return gate
}

export function migrationReceiptGateArtifactBytes(
  gate: GoldImportCompensationV2MigrationReceiptGate,
): Buffer {
  return Buffer.from(canonicalPretty(validateGoldImportCompensationV2MigrationReceiptGate(gate)))
}

export function migrationReceiptGateArtifactSha256(
  gate: GoldImportCompensationV2MigrationReceiptGate,
): string {
  return sha256Bytes(migrationReceiptGateArtifactBytes(gate))
}

export function migrationReceiptAuditBindingFromReadyAudit(
  audit: GoldImportCompensationV2ReadyAudit,
): GoldImportCompensationV2MigrationReceiptAuditBinding {
  return {
    auditTarget: audit.target,
    batchId: audit.database.batchId,
    completeCatalogAuditIdentitySha256: audit.completeCatalogAudit.fullAuditIdentitySha256,
    developmentMembershipSha256: audit.database.developmentMembershipSha256,
    developmentPlanningStateSha256: audit.database.developmentPlanningStateSha256,
    expectedCatalogBindingSha256: audit.expectedCatalog.bindingSha256,
    migrationId: audit.migration.id,
    migrationSha256: audit.migration.sha256,
    preImportEffectiveStateSha256: audit.v2PreImportState.effectiveStateSha256,
    preImportPhysicalStateSha256: audit.v2PreImportState.physicalStateSha256,
    v1Occurrence: audit.migration.v1Occurrence,
    v2Occurrence: audit.migration.v2Occurrence,
  }
}

export function validateGoldImportCompensationV2MigrationReceiptGateForBinding(
  input: unknown,
  binding: GoldImportCompensationV2MigrationReceiptAuditBinding,
): GoldImportCompensationV2MigrationReceiptGate {
  const gate = validateGoldImportCompensationV2MigrationReceiptGate(input)
  if (
    gate.auditTarget !== binding.auditTarget ||
    gate.batchId !== binding.batchId ||
    gate.catalog.completeCatalogAuditIdentitySha256 !==
      binding.completeCatalogAuditIdentitySha256 ||
    gate.catalog.expectedCatalogBindingSha256 !== binding.expectedCatalogBindingSha256 ||
    gate.migration.id !== binding.migrationId ||
    gate.migration.sha256 !== binding.migrationSha256 ||
    gate.migration.v1Occurrence !== binding.v1Occurrence ||
    gate.migration.v2Occurrence !== binding.v2Occurrence ||
    gate.preImportState.developmentMembershipSha256 !== binding.developmentMembershipSha256 ||
    gate.preImportState.developmentPlanningStateSha256 !== binding.developmentPlanningStateSha256 ||
    gate.preImportState.effectiveStateSha256 !== binding.preImportEffectiveStateSha256 ||
    gate.preImportState.physicalStateSha256 !== binding.preImportPhysicalStateSha256
  ) {
    throw new Error('V2 migration receipt gate does not match the authenticated package audit.')
  }
  return gate
}

export function validateGoldImportCompensationV2MigrationReceiptGateForAudit(
  input: unknown,
  audit: GoldImportCompensationV2ReadyAudit,
): GoldImportCompensationV2MigrationReceiptGate {
  return validateGoldImportCompensationV2MigrationReceiptGateForBinding(
    input,
    migrationReceiptAuditBindingFromReadyAudit(audit),
  )
}

/**
 * Generation and execution boundaries require provenance issued by this module's strict
 * filesystem loader (local) or its private disposable builder. A canonical self-hash remains
 * useful for package verification, but it is deliberately not an issuance capability.
 */
export function requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit(
  input: unknown,
  audit: GoldImportCompensationV2ReadyAudit,
): GoldImportCompensationV2MigrationReceiptGate {
  const gate = validateGoldImportCompensationV2MigrationReceiptGateForAudit(input, audit)
  if (!issuedMigrationReceiptGates.has(gate)) {
    throw new Error(
      'V2 migration receipt gate was not issued by a strict finalized-receipt loader.',
    )
  }
  return gate
}

export function requireIssuedGoldImportCompensationV2MigrationReceiptGateForBinding(
  input: unknown,
  binding: GoldImportCompensationV2MigrationReceiptAuditBinding,
): GoldImportCompensationV2MigrationReceiptGate {
  const gate = validateGoldImportCompensationV2MigrationReceiptGateForBinding(input, binding)
  if (!issuedMigrationReceiptGates.has(gate)) {
    throw new Error(
      'V2 migration receipt gate was not issued by a strict finalized-receipt loader.',
    )
  }
  return gate
}

export function buildInternalDisposableMigrationReceiptGate(
  audit: GoldImportCompensationV2ReadyAudit,
): GoldImportCompensationV2DisposableMigrationReceiptGate {
  if (audit.target !== 'disposable_clone') {
    throw new Error('Disposable migration receipt proof requires a disposable-clone audit.')
  }
  const binding = migrationReceiptAuditBindingFromReadyAudit(audit)
  const gate = buildGate({
    auditTarget: 'disposable_clone',
    batchId: binding.batchId,
    catalog: {
      completeCatalogAuditIdentitySha256: binding.completeCatalogAuditIdentitySha256,
      expectedCatalogBindingSha256: binding.expectedCatalogBindingSha256,
    },
    compensationAuthorized: false,
    importAuthorized: false,
    kind: 'disposable_rehearsal',
    migration: {
      id: binding.migrationId,
      sha256: binding.migrationSha256,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
    migrationReceiptComplete: true,
    preImportState: {
      developmentMembershipSha256: binding.developmentMembershipSha256,
      developmentPlanningStateSha256: binding.developmentPlanningStateSha256,
      effectiveStateSha256: binding.preImportEffectiveStateSha256,
      physicalStateSha256: binding.preImportPhysicalStateSha256,
    },
    productionUseAllowed: false,
    schemaVersion: GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION,
    source: {
      auditIdentitySha256: sha256Canonical({
        auditTarget: binding.auditTarget,
        batchId: binding.batchId,
        catalog: {
          completeCatalogAuditIdentitySha256: binding.completeCatalogAuditIdentitySha256,
          expectedCatalogBindingSha256: binding.expectedCatalogBindingSha256,
        },
        migration: {
          id: binding.migrationId,
          sha256: binding.migrationSha256,
          v1Occurrence: binding.v1Occurrence,
          v2Occurrence: binding.v2Occurrence,
        },
        preImportState: {
          developmentMembershipSha256: binding.developmentMembershipSha256,
          developmentPlanningStateSha256: binding.developmentPlanningStateSha256,
          effectiveStateSha256: binding.preImportEffectiveStateSha256,
          physicalStateSha256: binding.preImportPhysicalStateSha256,
        },
      }),
      receiptKind: 'disposable_rehearsal',
    },
  })
  return validateGoldImportCompensationV2MigrationReceiptGateForBinding(
    gate,
    binding,
  ) as GoldImportCompensationV2DisposableMigrationReceiptGate
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

async function assertRegularNonSymlink(path: string, label: string): Promise<void> {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  if ((await realpath(path)) !== path) {
    throw new Error(`${label} resolves through an unsafe filesystem path.`)
  }
}

function parseManifest(input: {
  bytes: string
  expectedNames: readonly string[]
  label: string
}): Map<string, string> {
  const entries = input.bytes
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = /^([a-f0-9]{64})  ([a-z0-9][a-z0-9.-]*)$/u.exec(line)
      if (!match) throw new Error(`${input.label} contains a malformed line.`)
      return [match[2]!, match[1]!] as const
    })
  if (
    canonicalJson(entries.map(([name]) => name)) !== canonicalJson([...input.expectedNames].sort())
  ) {
    throw new Error(`${input.label} inventory drifted.`)
  }
  return new Map(entries)
}

interface LoadedReceiptFiles {
  executionBytes: string
  finalManifestBytes: string
  intentBytes: string
  intentManifestBytes: string
  outputDirectory: string
  resultBytes: string
}

async function loadStrictReceiptFiles(input: {
  outputDirectory: string
  receiptRoot: string
}): Promise<LoadedReceiptFiles> {
  const requestedRoot = resolve(input.receiptRoot)
  const requestedOutput = resolve(input.outputDirectory)
  const root = await realpath(requestedRoot)
  const outputDirectory = await realpath(requestedOutput)
  if (
    root !== requestedRoot ||
    outputDirectory !== requestedOutput ||
    !isWithin(root, outputDirectory) ||
    outputDirectory === root
  ) {
    throw new Error('V2 migration receipt output escaped its exact local receipt root.')
  }
  const outputStat = await lstat(outputDirectory)
  if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) {
    throw new Error('V2 migration receipt output must be a real directory.')
  }
  const expectedRootNames = [
    'application-intent.json',
    'application-intent.md',
    'finalized',
    'intent-checksum-manifest.sha256',
  ].sort()
  if (canonicalJson((await readdir(outputDirectory)).sort()) !== canonicalJson(expectedRootNames)) {
    throw new Error('V2 migration receipt package is incomplete or contradictory.')
  }
  const finalizedDirectory = resolve(outputDirectory, 'finalized')
  const finalizedStat = await lstat(finalizedDirectory)
  if (!finalizedStat.isDirectory() || finalizedStat.isSymbolicLink()) {
    throw new Error('V2 migration receipt finalized path must be a real directory.')
  }
  const expectedFinalNames = [
    'application-result.json',
    'application-result.md',
    'checksum-manifest.sha256',
    'execution-receipt.json',
  ].sort()
  if (
    canonicalJson((await readdir(finalizedDirectory)).sort()) !== canonicalJson(expectedFinalNames)
  ) {
    throw new Error('V2 migration receipt finalized inventory is incomplete or contradictory.')
  }
  for (const name of [
    'application-intent.json',
    'application-intent.md',
    'intent-checksum-manifest.sha256',
  ]) {
    await assertRegularNonSymlink(resolve(outputDirectory, name), `V2 receipt ${name}`)
  }
  for (const name of expectedFinalNames) {
    await assertRegularNonSymlink(resolve(finalizedDirectory, name), `V2 receipt finalized/${name}`)
  }
  const [
    intentBytes,
    intentMarkdownBytes,
    intentManifestBytes,
    resultBytes,
    resultMarkdownBytes,
    finalManifestBytes,
    executionBytes,
  ] = await Promise.all([
    readFile(resolve(outputDirectory, 'application-intent.json'), 'utf8'),
    readFile(resolve(outputDirectory, 'application-intent.md'), 'utf8'),
    readFile(resolve(outputDirectory, 'intent-checksum-manifest.sha256'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'application-result.json'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'application-result.md'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'checksum-manifest.sha256'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'execution-receipt.json'), 'utf8'),
  ])
  const intentManifest = parseManifest({
    bytes: intentManifestBytes,
    expectedNames: ['application-intent.json', 'application-intent.md'],
    label: 'V2 receipt intent checksum manifest',
  })
  const finalManifest = parseManifest({
    bytes: finalManifestBytes,
    expectedNames: ['application-result.json', 'application-result.md'],
    label: 'V2 receipt final checksum manifest',
  })
  if (
    intentManifest.get('application-intent.json') !== sha256Bytes(intentBytes) ||
    intentManifest.get('application-intent.md') !== sha256Bytes(intentMarkdownBytes) ||
    finalManifest.get('application-result.json') !== sha256Bytes(resultBytes) ||
    finalManifest.get('application-result.md') !== sha256Bytes(resultMarkdownBytes)
  ) {
    throw new Error('V2 migration receipt checksum manifest does not match its exact bytes.')
  }
  return {
    executionBytes,
    finalManifestBytes,
    intentBytes,
    intentManifestBytes,
    outputDirectory,
    resultBytes,
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requiredSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256.`)
  }
  return value
}

function v2AfterState(result: ReturnType<typeof parseProtectedV2ApplicationResult>) {
  const after = record(result.after, 'Protected V2 normal receipt after state')
  return {
    developmentMembershipSha256: requiredSha(
      after.developmentMembershipSha256,
      'normal receipt development membership',
    ),
    developmentPlanningStateSha256: requiredSha(
      after.developmentPlanningStateSha256,
      'normal receipt development planning state',
    ),
    effectiveStateSha256: requiredSha(
      after.effectiveStateSha256V2 ?? after.effectiveStateSha256,
      'normal receipt V2 effective state',
    ),
    physicalStateSha256: requiredSha(
      after.physicalStateSha256V2 ?? after.physicalStateSha256,
      'normal receipt V2 physical state',
    ),
  }
}

function normalReceiptGate(input: {
  audit: GoldImportCompensationV2ReadyAudit
  files: LoadedReceiptFiles
}): GoldImportCompensationV2LocalMigrationReceiptGate {
  const intent = parseProtectedV2ApplicationIntent(input.files.intentBytes)
  const result = parseProtectedV2ApplicationResult(input.files.resultBytes)
  const execution = parseProtectedV2ApplicationExecutionReceipt(input.files.executionBytes)
  const intentSha256 = sha256Bytes(input.files.intentBytes)
  const resultSha256 = sha256Bytes(input.files.resultBytes)
  const finalManifestSha256 = sha256Bytes(input.files.finalManifestBytes)
  const afterState = v2AfterState(result)
  if (
    intent.outputDirectory !== input.files.outputDirectory ||
    result.originalIntentSha256 !== intentSha256 ||
    result.operatorAuthorizationSha256 !== intent.authorizationSha256 ||
    canonicalJson(result.before) !== canonicalJson(intent.before) ||
    canonicalJson(result.backupInstances) !== canonicalJson(intent.backupInstances) ||
    result.intentRepositoryHead !== intent.repository.head ||
    canonicalJson(result.expectedCatalog) !== canonicalJson(intent.expectedCatalog) ||
    result.operatorBundleSha256 !== intent.operatorBundle.aggregateSha256 ||
    canonicalJson(result.operatorBundleBinding) !== canonicalJson(intent.operatorBundleBinding) ||
    result.recoveryRepositoryHead !== result.repository.head ||
    execution.originalIntentSha256 !== intentSha256 ||
    execution.operatorAuthorizationSha256 !== intent.authorizationSha256 ||
    execution.postApplicationAuditSha256 !== result.postApplicationAudit.auditIdentitySha256 ||
    execution.resultSha256 !== resultSha256 ||
    execution.canonicalManifestSha256 !== finalManifestSha256 ||
    execution.outputDirectory !== input.files.outputDirectory ||
    execution.intentRepositoryHead !== intent.repository.head ||
    execution.intentCommitIsAncestor !== true ||
    execution.operatorBundleSha256 !== intent.operatorBundle.aggregateSha256 ||
    canonicalJson(execution.operatorBundleBinding) !==
      canonicalJson(intent.operatorBundleBinding) ||
    execution.operatorBundleUnchanged !== true ||
    canonicalJson(execution.expectedCatalog) !== canonicalJson(intent.expectedCatalog) ||
    execution.recoveryRepositoryHead !== result.repository.head ||
    execution.repositoryCommitSha !== result.repository.head ||
    canonicalJson(execution.backupCaptureIds) !==
      canonicalJson(intent.backupInstances.map(({ backupInstanceId }) => backupInstanceId)) ||
    execution.postApplicationCatalogAuditIdentitySha256 !==
      result.postApplicationAudit.catalogAudit.fullAuditIdentitySha256 ||
    canonicalJson(execution.postApplicationComponentIdentities) !==
      canonicalJson(result.postApplicationAudit.catalogAudit.componentIdentities) ||
    execution.receiptReconciled !== result.receiptReconciled ||
    execution.migrationApplicationCallCount !== result.migrationApplicationCallCount ||
    execution.reconciliationReason !== result.reconciliationReason ||
    result.safety.importAuthorized !== false ||
    result.safety.compensationAuthorized !== false ||
    execution.importAuthorized !== false ||
    execution.compensationAuthorized !== false ||
    result.migrationApplied !== true ||
    result.migrationReexecuted !== false ||
    result.after.v1Occurrence !== 1 ||
    result.after.v2Occurrence !== 1 ||
    result.migration.id !== input.audit.migration.id ||
    result.migration.sha256 !== input.audit.migration.sha256 ||
    result.after.batchId !== input.audit.database.batchId ||
    canonicalJson(result.expectedCatalog) !== canonicalJson(input.audit.expectedCatalog) ||
    result.postApplicationAudit.catalogAudit.fullAuditIdentitySha256 !==
      input.audit.completeCatalogAudit.fullAuditIdentitySha256 ||
    afterState.developmentMembershipSha256 !== input.audit.database.developmentMembershipSha256 ||
    afterState.developmentPlanningStateSha256 !==
      input.audit.database.developmentPlanningStateSha256 ||
    afterState.effectiveStateSha256 !== input.audit.v2PreImportState.effectiveStateSha256 ||
    afterState.physicalStateSha256 !== input.audit.v2PreImportState.physicalStateSha256
  ) {
    throw new Error('Normal protected V2 finalized receipt does not match the ready audit.')
  }
  return buildGate({
    auditTarget: 'local',
    batchId: result.after.batchId,
    catalog: {
      completeCatalogAuditIdentitySha256:
        result.postApplicationAudit.catalogAudit.fullAuditIdentitySha256,
      expectedCatalogBindingSha256: result.expectedCatalog.bindingSha256,
    },
    compensationAuthorized: false,
    importAuthorized: false,
    kind: 'finalized_migration_receipt',
    migration: {
      id: result.migration.id,
      sha256: result.migration.sha256,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
    migrationReceiptComplete: true,
    preImportState: afterState,
    productionUseAllowed: true,
    schemaVersion: GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION,
    source: {
      executionReceiptSha256: sha256Bytes(input.files.executionBytes),
      finalManifestSha256,
      intentManifestSha256: sha256Bytes(input.files.intentManifestBytes),
      operatorBundleSha256: result.operatorBundleSha256,
      originalIntentSha256: intentSha256,
      outputDirectory: input.files.outputDirectory,
      receiptKind: 'normal_application',
      resultSha256,
    },
  }) as GoldImportCompensationV2LocalMigrationReceiptGate
}

async function recoveryReceiptGate(input: {
  audit: GoldImportCompensationV2ReadyAudit
  authority: ProtectedV2FinalizedRecoveryReceiptAuthority
  files: LoadedReceiptFiles
}): Promise<GoldImportCompensationV2LocalMigrationReceiptGate> {
  const loaded = await loadProtectedV2FinalizedReceiptRecovery({
    authority: input.authority,
    outputDirectory: input.files.outputDirectory,
  })
  const result = loaded.result
  const post = result.stateIdentities.post
  if (
    sha256Bytes(input.files.intentBytes) !== result.originalIntent.intentSha256 ||
    result.originalIntent.outputDirectory !== input.files.outputDirectory ||
    result.migration.v1Occurrence !== 1 ||
    result.migration.v2Occurrence !== 1 ||
    result.migration.v2MigrationSha256 !== input.audit.migration.sha256 ||
    result.expectedCatalog.bindingSha256 !== input.audit.expectedCatalog.bindingSha256 ||
    result.expectedCatalog.fullAuditIdentitySha256 !==
      input.audit.completeCatalogAudit.fullAuditIdentitySha256 ||
    result.stateIdentities.batchId !== input.audit.database.batchId ||
    post.developmentMembershipSha256 !== input.audit.database.developmentMembershipSha256 ||
    post.planningSha256 !== input.audit.database.developmentPlanningStateSha256 ||
    post.effectiveV2Sha256 !== input.audit.v2PreImportState.effectiveStateSha256 ||
    post.physicalV2Sha256 !== input.audit.v2PreImportState.physicalStateSha256 ||
    result.safety.importAuthorized !== false ||
    result.safety.compensationAuthorized !== false ||
    loaded.executionReceipt.importAuthorized !== false ||
    loaded.executionReceipt.compensationAuthorized !== false
  ) {
    throw new Error('Historical protected V2 recovery receipt does not match the ready audit.')
  }
  return buildGate({
    auditTarget: 'local',
    batchId: result.stateIdentities.batchId,
    catalog: {
      completeCatalogAuditIdentitySha256: result.expectedCatalog.fullAuditIdentitySha256,
      expectedCatalogBindingSha256: result.expectedCatalog.bindingSha256,
    },
    compensationAuthorized: false,
    importAuthorized: false,
    kind: 'finalized_migration_receipt',
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: result.migration.v2MigrationSha256,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
    migrationReceiptComplete: true,
    preImportState: {
      developmentMembershipSha256: post.developmentMembershipSha256,
      developmentPlanningStateSha256: post.planningSha256,
      effectiveStateSha256: post.effectiveV2Sha256,
      physicalStateSha256: post.physicalV2Sha256,
    },
    productionUseAllowed: true,
    schemaVersion: GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION,
    source: {
      executionReceiptSha256: sha256Bytes(input.files.executionBytes),
      finalManifestSha256: loaded.manifestSha256,
      originalIntentSha256: result.originalIntent.intentSha256,
      outputDirectory: input.files.outputDirectory,
      receiptKind: 'historical_recovery',
      recoveryAmendmentIdentitySha256: result.recoveryAmendmentIdentitySha256,
      recoveryToolBundleSha256: result.currentRecoveryToolBundle.aggregateSha256,
      resultSha256: loaded.resultSha256,
    },
  }) as GoldImportCompensationV2LocalMigrationReceiptGate
}

export async function loadGoldImportCompensationV2LocalMigrationReceiptGate(input: {
  audit: GoldImportCompensationV2ReadyAudit
  outputDirectory: string
}): Promise<GoldImportCompensationV2LocalMigrationReceiptGate> {
  if (input.audit.target !== 'local') {
    throw new Error('Filesystem migration receipt gates are restricted to the local audit target.')
  }
  const files = await loadStrictReceiptFiles({
    outputDirectory: input.outputDirectory,
    receiptRoot: CANONICAL_PROTECTED_V2_RECEIPT_ROOT,
  })
  let rawResult: unknown
  try {
    rawResult = JSON.parse(files.resultBytes) as unknown
  } catch {
    throw new Error('V2 migration receipt result is invalid JSON.')
  }
  const resultRecord = record(rawResult, 'V2 migration receipt result')
  const isRecovery =
    resultRecord.schemaVersion === 'literature-gold-protected-v2-receipt-recovery-result/1.0.0'
  const gate = isRecovery
    ? await recoveryReceiptGate({
        audit: input.audit,
        authority:
          await loadCommittedProtectedV2RecoveryReceiptAuthority(CANONICAL_REPOSITORY_ROOT),
        files,
      })
    : normalReceiptGate({ audit: input.audit, files })
  return validateGoldImportCompensationV2MigrationReceiptGateForAudit(
    gate,
    input.audit,
  ) as GoldImportCompensationV2LocalMigrationReceiptGate
}

const recoveryAuthorityFileSchema = z
  .object({
    authority: z
      .object({
        amendmentIdentitySha256: sha256Schema,
        originalIntentSha256: sha256Schema,
        recoveryToolBundleSha256: sha256Schema,
      })
      .strict(),
    authorityIdentitySha256: sha256Schema,
    schemaVersion: z.literal(GOLD_IMPORT_COMPENSATION_V2_RECOVERY_RECEIPT_AUTHORITY_SCHEMA_VERSION),
  })
  .strict()

export function parseCommittedProtectedV2RecoveryReceiptAuthority(
  bytes: string,
): GoldImportCompensationV2CommittedRecoveryReceiptAuthority {
  let raw: unknown
  try {
    raw = JSON.parse(bytes) as unknown
  } catch {
    throw new Error('Committed protected V2 recovery receipt authority is invalid JSON.')
  }
  const parsed = recoveryAuthorityFileSchema.parse(raw)
  if (
    bytes !== canonicalPretty(parsed) ||
    parsed.authorityIdentitySha256 !== sha256Canonical(parsed.authority)
  ) {
    throw new Error('Committed protected V2 recovery receipt authority is noncanonical or stale.')
  }
  return canonicalFrozenClone(parsed)
}

export async function loadCommittedProtectedV2RecoveryReceiptAuthority(
  repositoryRoot: string,
): Promise<ProtectedV2FinalizedRecoveryReceiptAuthority> {
  const root = await realpath(resolve(repositoryRoot))
  const path = resolve(root, PROTECTED_V2_FINALIZED_RECOVERY_RECEIPT_AUTHORITY_PATH)
  if (!isWithin(root, path))
    throw new Error('Recovery receipt authority path escaped the repository.')
  await assertRegularNonSymlink(path, 'Committed protected V2 recovery receipt authority')
  const reference = parseCommittedProtectedV2RecoveryReceiptAuthority(
    await readFile(path, 'utf8'),
  ).authority
  const incidentAuthorityPath = resolve(root, PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH)
  const amendmentPath = resolve(root, PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH)
  await assertRegularNonSymlink(
    incidentAuthorityPath,
    'Committed protected V2 recovery incident authority',
  )
  await assertRegularNonSymlink(amendmentPath, 'Committed protected V2 recovery amendment')
  const amendment = parseImmutableProtectedV2ReceiptRecoveryCommittedAmendment({
    amendmentBytes: await readFile(amendmentPath, 'utf8'),
    authorityBytes: await readFile(incidentAuthorityPath, 'utf8'),
  })
  if (
    reference.amendmentIdentitySha256 !== amendment.amendmentIdentitySha256 ||
    reference.originalIntentSha256 !== amendment.historicalIncident.intentSha256 ||
    reference.recoveryToolBundleSha256 !== amendment.correctedRecoveryToolBundle.aggregateSha256
  ) {
    throw new Error('Committed recovery receipt authority does not match the full amendment.')
  }
  return { ...reference, amendment }
}
