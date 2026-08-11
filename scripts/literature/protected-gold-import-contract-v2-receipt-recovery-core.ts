import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import {
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_PROOF_VERSION,
  type LiteratureGoldV2SchemaOnlyTransitionProof,
} from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_DEFECT,
  PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES,
  PROTECTED_V2_RECEIPT_RECOVERY_REASON,
  buildProtectedV2ReceiptRecoveryAmendment,
  canonicalProtectedV2ReceiptRecoveryJson,
  protectedV2ReceiptRecoverySha256,
  validateProtectedV2ReceiptRecoveryBundle,
  type ProtectedV2ReceiptRecoveryAmendment,
  type ProtectedV2ReceiptRecoveryBundle,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'

export const PROTECTED_V2_RECEIPT_RECOVERY_RESULT_SCHEMA_VERSION =
  'literature-gold-protected-v2-receipt-recovery-result/1.0.0' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_EXECUTION_SCHEMA_VERSION =
  'literature-gold-protected-v2-receipt-recovery-execution/1.0.0' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_FINALIZED_DIRECTORY = 'finalized' as const

const INTENT_FILES = [
  'application-intent.json',
  'application-intent.md',
  'intent-checksum-manifest.sha256',
] as const
const FINALIZED_FILES = [
  'application-result.json',
  'application-result.md',
  'checksum-manifest.sha256',
  'execution-receipt.json',
] as const
const CAPTURE_FILES = [
  'checksum-manifest.sha256',
  'development-database-seed.json',
  'execution-receipt.json',
  'pre-application-report.json',
  'pre-application-report.md',
  'protected-migration-ledger.json',
  'state-hashes.json',
] as const
const CAPTURE_MANIFEST_FILES = [
  'development-database-seed.json',
  'pre-application-report.json',
  'pre-application-report.md',
  'protected-migration-ledger.json',
  'state-hashes.json',
] as const
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u

type CaptureFileName = (typeof CAPTURE_FILES)[number]

export interface ProtectedV2ReceiptRecoveryCapturePackage {
  declaredDirectory: string
  files: Readonly<Record<CaptureFileName, string>>
}

export type ProtectedV2ReceiptRecoveryTransitionProof = LiteratureGoldV2SchemaOnlyTransitionProof

export type ProtectedV2ReceiptRecoveryTransitionValidator = (
  input: unknown,
) => ProtectedV2ReceiptRecoveryTransitionProof | Promise<ProtectedV2ReceiptRecoveryTransitionProof>

export interface ProtectedV2ReceiptRecoveryPostEvidence {
  catalog: {
    auditIdentitySha256: string
    bindingSha256: string
    fullAuditIdentitySha256: string
  }
  ledger: {
    v1MigrationSha256: string
    v1Occurrence: number
    v2MigrationSha256: string
    v2Occurrence: number
    v2VerifierSha256: string
  }
  mutationEvidence: {
    actionMutationCount: number
    compensationCallCount: number
    compensationMutationCount: number
    importCallCount: number
    importMutationCount: number
    operationMutationCount: number
    pointerMutationCount: number
    reviewMutationCount: number
    revealMutationCount: number
  }
  safety: {
    contradictoryPartialFinalization: false
    finalizedAbsentAtEvidenceCollection: boolean
    heldOutIdentitiesAccessed: false
    originalCapturesModified: false
    originalIntentModified: false
    readOnly: true
    remoteDatabaseAccessed: false
    repeatableRead: true
  }
  state: ProtectedV2ReceiptRecoveryAmendment['stateAuthority']['post']
}

export interface ProtectedV2ReceiptRecoveryRepositoryEvidence {
  branch: 'main'
  head: string
  intentCommitIsAncestor: true
  originMain: string
  primaryCheckout: true
  statusCleanIncludingUntracked: true
}

export interface ProtectedV2ReceiptRecoveryInput {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  applicationOutputDirectory: string
  authorizationBytes: string
  captures: readonly [
    ProtectedV2ReceiptRecoveryCapturePackage,
    ProtectedV2ReceiptRecoveryCapturePackage,
  ]
  currentRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
  expectedAmendmentIdentitySha256: string
  historicalOperatorBundle: unknown
  incidentEvidenceFiles: Readonly<Record<string, string>>
  postEvidence: ProtectedV2ReceiptRecoveryPostEvidence
  recoveryRepository: ProtectedV2ReceiptRecoveryRepositoryEvidence
  transitionInput: unknown
}

export interface ProtectedV2ReceiptRecoveryDependencies {
  validateSchemaOnlyTransition: ProtectedV2ReceiptRecoveryTransitionValidator
}

export interface ProtectedV2ReceiptRecoveryResultContent {
  currentRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
  defectIdentifier: typeof PROTECTED_V2_RECEIPT_RECOVERY_DEFECT
  defectReason: typeof PROTECTED_V2_RECEIPT_RECOVERY_REASON
  expectedCatalog: ProtectedV2ReceiptRecoveryPostEvidence['catalog']
  historicalOperatorBundle: ProtectedV2ReceiptRecoveryAmendment['historicalOperatorBundle']
  migration: {
    migrationApplied: true
    migrationApplicationCallCount: 0
    migrationReexecuted: false
    migrationStagingCallCount: 0
    v1MigrationSha256: string
    v1Occurrence: 1
    v2MigrationSha256: string
    v2Occurrence: 1
    v2VerifierSha256: string
  }
  mutationEvidence: ProtectedV2ReceiptRecoveryPostEvidence['mutationEvidence']
  originalIntent: {
    authorizationContentSha256: string
    intentManifestSha256: string
    intentSha256: string
    outputDirectory: string
    repositoryHead: string
  }
  prohibitedCapabilities: typeof PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES
  receiptReconciled: true
  recoveryAmendmentIdentitySha256: string
  recoveryRepositoryHead: string
  safety: {
    compensationAuthorized: false
    heldOutIdentitiesAccessed: false
    importAuthorized: false
    originalIntentRewritten: false
    remoteDatabaseAccessed: false
  }
  schemaVersion: typeof PROTECTED_V2_RECEIPT_RECOVERY_RESULT_SCHEMA_VERSION
  sharedTransitionProofIdentitySha256: string
  state: 'application_receipt_finalized_by_historical_recovery'
  stateIdentities: ProtectedV2ReceiptRecoveryAmendment['stateAuthority']
  status: 'protected_v2_migration_applied_exactly_once_receipt_recovered'
}

export interface ProtectedV2ReceiptRecoveryResult extends ProtectedV2ReceiptRecoveryResultContent {
  contentSha256: string
}

export interface ProtectedV2ReceiptRecoveryExecutionReceiptContent {
  canonicalManifestSha256: string
  compensationAuthorized: false
  currentRecoveryToolBundleSha256: string
  importAuthorized: false
  migrationApplicationCallCount: 0
  migrationReexecuted: false
  migrationStagingCallCount: 0
  originalIntentSha256: string
  outputDirectory: string
  receiptReconciled: true
  recoveryAmendmentIdentitySha256: string
  resultSha256: string
  schemaVersion: typeof PROTECTED_V2_RECEIPT_RECOVERY_EXECUTION_SCHEMA_VERSION
}

export interface ProtectedV2ReceiptRecoveryExecutionReceipt extends ProtectedV2ReceiptRecoveryExecutionReceiptContent {
  contentSha256: string
}

export interface ProtectedV2FinalizedReceiptRecovery {
  executionReceipt: ProtectedV2ReceiptRecoveryExecutionReceipt
  manifestSha256: string
  result: ProtectedV2ReceiptRecoveryResult
  resultSha256: string
}

export interface ProtectedV2FinalizedRecoveryReceiptReference {
  amendmentIdentitySha256: string
  originalIntentSha256: string
  recoveryToolBundleSha256: string
}

export interface ProtectedV2FinalizedRecoveryReceiptAuthority extends ProtectedV2FinalizedRecoveryReceiptReference {
  amendment: ProtectedV2ReceiptRecoveryAmendment
}

export interface ProtectedV2ReceiptRecoveryOutcome extends ProtectedV2FinalizedReceiptRecovery {
  state: 'already_finalized_verified' | 'finalized_atomically'
  wroteFinalization: boolean
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function parseCanonicalObject(bytes: string, label: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(bytes) as unknown
  } catch (error) {
    throw new Error(
      `${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (canonicalProtectedV2ReceiptRecoveryJson(value) !== bytes) {
    throw new Error(`${label} is not canonical JSON.`)
  }
  return record(value, label)
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (
    canonicalProtectedV2ReceiptRecoveryJson(Object.keys(value).sort()) !==
    canonicalProtectedV2ReceiptRecoveryJson([...expected].sort())
  ) {
    throw new Error(`${label} inventory drifted.`)
  }
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256.`)
  }
}

function parseManifest(input: {
  bytes: string
  expectedNames: readonly string[]
  label: string
}): ReadonlyMap<string, string> {
  const entries = input.bytes
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})  ([a-z0-9][a-z0-9.-]*)$/u)
      if (!match) throw new Error(`${input.label} has a malformed line: ${line}`)
      return { name: match[2]!, sha256: match[1]! }
    })
  if (
    new Set(entries.map(({ name }) => name)).size !== entries.length ||
    canonicalProtectedV2ReceiptRecoveryJson(entries.map(({ name }) => name)) !==
      canonicalProtectedV2ReceiptRecoveryJson([...input.expectedNames].sort())
  ) {
    throw new Error(`${input.label} inventory drifted.`)
  }
  return new Map(entries.map(({ name, sha256 }) => [name, sha256]))
}

function checksumManifest(files: ReadonlyMap<string, string>): string {
  return [...files.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, bytes]) => `${protectedV2ReceiptRecoverySha256(bytes)}  ${name}\n`)
    .join('')
}

async function assertRegularFile(path: string, label: string): Promise<void> {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} is unsafe.`)
}

async function readIntentPackage(outputDirectory: string): Promise<{
  intent: Record<string, unknown>
  intentBytes: string
  intentManifestBytes: string
  intentMarkdownBytes: string
}> {
  const outputStat = await lstat(outputDirectory)
  if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) {
    throw new Error('Historical application output must be a real directory.')
  }
  if ((await realpath(outputDirectory)) !== outputDirectory) {
    throw new Error('Historical application output must use its canonical absolute path.')
  }
  const names = (await readdir(outputDirectory)).sort()
  const incomplete = [...INTENT_FILES].sort()
  const complete = [...INTENT_FILES, PROTECTED_V2_RECEIPT_RECOVERY_FINALIZED_DIRECTORY].sort()
  if (
    canonicalProtectedV2ReceiptRecoveryJson(names) !==
      canonicalProtectedV2ReceiptRecoveryJson(incomplete) &&
    canonicalProtectedV2ReceiptRecoveryJson(names) !==
      canonicalProtectedV2ReceiptRecoveryJson(complete)
  ) {
    throw new Error('Historical application package has contradictory or unexpected artifacts.')
  }
  for (const name of INTENT_FILES) {
    await assertRegularFile(resolve(outputDirectory, name), `Historical intent file ${name}`)
  }
  const [intentBytes, intentMarkdownBytes, intentManifestBytes] = await Promise.all([
    readFile(resolve(outputDirectory, 'application-intent.json'), 'utf8'),
    readFile(resolve(outputDirectory, 'application-intent.md'), 'utf8'),
    readFile(resolve(outputDirectory, 'intent-checksum-manifest.sha256'), 'utf8'),
  ])
  const manifest = parseManifest({
    bytes: intentManifestBytes,
    expectedNames: ['application-intent.json', 'application-intent.md'],
    label: 'Historical intent checksum manifest',
  })
  for (const [name, bytes] of [
    ['application-intent.json', intentBytes],
    ['application-intent.md', intentMarkdownBytes],
  ] as const) {
    if (manifest.get(name) !== protectedV2ReceiptRecoverySha256(bytes)) {
      throw new Error(`Historical intent checksum mismatch for ${name}.`)
    }
  }
  return {
    intent: parseCanonicalObject(intentBytes, 'Historical application intent'),
    intentBytes,
    intentManifestBytes,
    intentMarkdownBytes,
  }
}

function authenticateAmendment(input: ProtectedV2ReceiptRecoveryInput): void {
  assertSha256(input.expectedAmendmentIdentitySha256, 'Expected recovery amendment identity')
  const { amendmentIdentitySha256, ...content } = input.amendment
  const rebuilt = buildProtectedV2ReceiptRecoveryAmendment(content)
  if (
    amendmentIdentitySha256 !== input.expectedAmendmentIdentitySha256 ||
    canonicalProtectedV2ReceiptRecoveryJson(rebuilt) !==
      canonicalProtectedV2ReceiptRecoveryJson(input.amendment)
  ) {
    throw new Error('Recovery amendment identity changed or is not the explicitly authorized one.')
  }
  const currentBundle = validateProtectedV2ReceiptRecoveryBundle(input.currentRecoveryToolBundle)
  if (
    canonicalProtectedV2ReceiptRecoveryJson(currentBundle) !==
    canonicalProtectedV2ReceiptRecoveryJson(input.amendment.correctedRecoveryToolBundle)
  ) {
    throw new Error('Current recovery-tool bundle differs from the reviewed amendment.')
  }
}

function authenticateIncidentEvidence(input: ProtectedV2ReceiptRecoveryInput): void {
  const expected = input.amendment.historicalIncident.incidentEvidenceSha256
  if (
    canonicalProtectedV2ReceiptRecoveryJson(Object.keys(input.incidentEvidenceFiles).sort()) !==
    canonicalProtectedV2ReceiptRecoveryJson(Object.keys(expected).sort())
  ) {
    throw new Error('Incident evidence inventory changed.')
  }
  for (const [path, expectedSha256] of Object.entries(expected)) {
    if (protectedV2ReceiptRecoverySha256(input.incidentEvidenceFiles[path]!) !== expectedSha256) {
      throw new Error(`Incident evidence changed: ${path}`)
    }
  }
}

function authenticateHistoricalIntent(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  authorizationBytes: string
  historicalOperatorBundle: unknown
  intent: Record<string, unknown>
  intentBytes: string
  intentManifestBytes: string
  intentMarkdownBytes: string
  outputDirectory: string
}): void {
  const authority = input.amendment.historicalIncident
  if (
    protectedV2ReceiptRecoverySha256(input.intentBytes) !== authority.intentSha256 ||
    protectedV2ReceiptRecoverySha256(input.intentMarkdownBytes) !==
      authority.intentMarkdownSha256 ||
    protectedV2ReceiptRecoverySha256(input.intentManifestBytes) !==
      authority.intentManifestSha256 ||
    protectedV2ReceiptRecoverySha256(input.authorizationBytes) !== authority.authorizationFileSha256
  ) {
    throw new Error('Historical intent, markdown, manifest, or authorization bytes changed.')
  }
  const intent = input.intent
  const authorization = record(intent.authorization, 'Historical embedded authorization')
  const repository = record(intent.repository, 'Historical intent repository')
  const operatorBundle = record(intent.operatorBundle, 'Historical operator bundle')
  const operatorBundleBinding = record(
    intent.operatorBundleBinding,
    'Historical operator bundle binding',
  )
  const before = record(intent.before, 'Historical pre-application evidence')
  const expectedCatalog = record(intent.expectedCatalog, 'Historical expected catalog')
  const migration = record(intent.migration, 'Historical intent migration')
  const safety = record(intent.safety, 'Historical intent safety')
  const backupInstances = intent.backupInstances
  if (
    !input.amendment.permittedHistoricalIntentSchemaVersions.includes(
      String(intent.schemaVersion ?? ''),
    ) ||
    intent.state !== 'application_intent_sealed' ||
    intent.authorizedCapability !== 'apply_protected_contract_v2_migration_exactly_once' ||
    intent.outputDirectory !== authority.intentOutputDirectory ||
    input.outputDirectory !== authority.intentOutputDirectory ||
    intent.createdAt !== authority.intentCreatedAt ||
    intent.operator !== authority.operatorIdentity ||
    intent.confirmation !== authority.confirmation ||
    intent.separateCaptureAttestation !== authority.separateCaptureAttestation ||
    safety.finalReceiptComplete !== false ||
    safety.migrationApplied !== false ||
    safety.importAuthorized !== false ||
    safety.compensationAuthorized !== false ||
    repository.head !== authority.repositoryHead ||
    repository.originMain !== authority.repositoryHead ||
    repository.branch !== 'main' ||
    operatorBundle.aggregateSha256 !== input.amendment.historicalOperatorBundle.aggregateSha256 ||
    operatorBundleBinding.bindingSha256 !==
      input.amendment.historicalOperatorBundle.bindingSha256 ||
    operatorBundleBinding.trackedFileInventorySha256 !==
      input.amendment.historicalOperatorBundle.trackedFileInventorySha256 ||
    operatorBundleBinding.runtimeInputDeclarationSha256 !==
      input.amendment.historicalOperatorBundle.runtimeInputDeclarationSha256 ||
    operatorBundleBinding.trackedFileCount !==
      input.amendment.historicalOperatorBundle.trackedFileCount ||
    expectedCatalog.bindingSha256 !== input.amendment.expectedCatalog.bindingSha256 ||
    expectedCatalog.fullAuditIdentitySha256 !==
      input.amendment.expectedCatalog.fullAuditIdentitySha256 ||
    migration.sha256 !== input.amendment.pinnedSources.v2MigrationSha256 ||
    !Array.isArray(backupInstances) ||
    backupInstances.length !== 2 ||
    before.v1Occurrence !== 1 ||
    before.v2Occurrence !== 0 ||
    before.batchId !== input.amendment.stateAuthority.batchId ||
    before.developmentMembershipSha256 !==
      input.amendment.stateAuthority.pre.developmentMembershipSha256 ||
    before.effectiveStateSha256 !== input.amendment.stateAuthority.pre.effectiveV1Sha256 ||
    before.physicalStateSha256 !== input.amendment.stateAuthority.pre.physicalV1Sha256 ||
    before.developmentPlanningStateSha256 !== input.amendment.stateAuthority.pre.planningSha256 ||
    canonicalProtectedV2ReceiptRecoveryJson(input.historicalOperatorBundle) !==
      canonicalProtectedV2ReceiptRecoveryJson(intent.operatorBundle)
  ) {
    throw new Error('Historical intent does not match the incident-specific recovery authority.')
  }
  for (const [index, value] of backupInstances.entries()) {
    const backup = record(value, `Historical intent backup ${index + 1}`)
    const expected = input.amendment.historicalIncident.backupCaptures[index]!
    if (
      backup.backupInstanceId !== expected.backupInstanceId ||
      backup.canonicalManifestSha256 !== expected.canonicalManifestSha256 ||
      backup.directory !== expected.directory ||
      backup.executionNonce !== expected.executionNonce ||
      backup.executionReceiptSha256 !== expected.executionReceiptSha256
    ) {
      throw new Error(`Historical intent backup ${index + 1} binding changed.`)
    }
  }
  const parsedAuthorization = parseCanonicalObject(
    input.authorizationBytes,
    'Historical authorization evidence',
  )
  if (
    canonicalProtectedV2ReceiptRecoveryJson(parsedAuthorization) !==
      canonicalProtectedV2ReceiptRecoveryJson(authorization) ||
    authorization.contentSha256 !== authority.authorizationContentSha256 ||
    intent.authorizationSha256 !== authority.authorizationContentSha256
  ) {
    throw new Error('Historical authorization bytes or intent binding changed.')
  }
  const { contentSha256, ...authorizationContent } = authorization
  if (
    contentSha256 !==
    protectedV2ReceiptRecoverySha256(canonicalProtectedV2ReceiptRecoveryJson(authorizationContent))
  ) {
    throw new Error('Historical authorization content checksum is invalid.')
  }
}

export function parseProtectedV2ReceiptRecoveryHistoricalCaptureExecution(
  bytes: string,
  label = 'Historical capture execution receipt',
): Record<string, unknown> {
  const execution = parseCanonicalObject(bytes, label)
  exactKeys(
    execution,
    [
      'backupInstanceId',
      'backupRoot',
      'canonicalManifestSha256',
      'contentSha256',
      'database',
      'executedAt',
      'executionNonce',
      'expectedCatalog',
      'migrationLedger',
      'operatorBundleBinding',
      'outputDirectory',
      'repositoryCommitSha',
      'safety',
      'schemaVersion',
    ],
    label,
  )
  const contentSha256 = execution.contentSha256
  assertSha256(contentSha256, `${label} contentSha256`)
  const content = { ...execution }
  delete content.contentSha256
  if (
    protectedV2ReceiptRecoverySha256(canonicalProtectedV2ReceiptRecoveryJson(content)) !==
    contentSha256
  ) {
    throw new Error(`${label} content checksum is invalid.`)
  }
  const database = record(execution.database, `${label} database`)
  const ledger = record(execution.migrationLedger, `${label} migrationLedger`)
  const v1 = record(ledger.v1, `${label} V1`)
  const v2 = record(ledger.v2, `${label} V2`)
  exactKeys(
    database,
    [
      'batchId',
      'datasetSplit',
      'developmentMembershipSha256',
      'developmentPlanningStateSha256',
      'effectiveStateSha256',
      'physicalStateSha256',
    ],
    `${label} database`,
  )
  exactKeys(ledger, ['sha256', 'v1', 'v2'], `${label} migrationLedger`)
  exactKeys(v1, ['filename', 'migrationName', 'occurrence', 'sha256', 'version'], `${label} V1`)
  exactKeys(
    v2,
    ['filename', 'id', 'migrationName', 'occurrence', 'sha256', 'version'],
    `${label} V2`,
  )
  return execution
}

function authenticateCaptures(input: ProtectedV2ReceiptRecoveryInput): void {
  for (const [index, capture] of input.captures.entries()) {
    const authority = input.amendment.historicalIncident.backupCaptures[index]!
    if (
      capture.declaredDirectory !== authority.directory ||
      canonicalProtectedV2ReceiptRecoveryJson(Object.keys(capture.files).sort()) !==
        canonicalProtectedV2ReceiptRecoveryJson([...CAPTURE_FILES].sort())
    ) {
      throw new Error(`Historical capture ${index + 1} path or inventory changed.`)
    }
    const manifestBytes = capture.files['checksum-manifest.sha256']
    if (protectedV2ReceiptRecoverySha256(manifestBytes) !== authority.canonicalManifestSha256) {
      throw new Error(`Historical capture ${index + 1} manifest changed.`)
    }
    const manifest = parseManifest({
      bytes: manifestBytes,
      expectedNames: CAPTURE_MANIFEST_FILES,
      label: `Historical capture ${index + 1} manifest`,
    })
    for (const name of CAPTURE_MANIFEST_FILES) {
      if (manifest.get(name) !== protectedV2ReceiptRecoverySha256(capture.files[name])) {
        throw new Error(`Historical capture ${index + 1} changed: ${name}`)
      }
    }
    const executionBytes = capture.files['execution-receipt.json']
    if (protectedV2ReceiptRecoverySha256(executionBytes) !== authority.executionReceiptSha256) {
      throw new Error(`Historical capture ${index + 1} execution receipt changed.`)
    }
    const execution = parseProtectedV2ReceiptRecoveryHistoricalCaptureExecution(
      executionBytes,
      `Historical capture ${index + 1} execution receipt`,
    )
    const database = record(execution.database, `Historical capture ${index + 1} database`)
    const ledger = record(execution.migrationLedger, `Historical capture ${index + 1} ledger`)
    const v1 = record(ledger.v1, `Historical capture ${index + 1} V1`)
    const v2 = record(ledger.v2, `Historical capture ${index + 1} V2`)
    if (
      execution.backupInstanceId !== authority.backupInstanceId ||
      execution.executionNonce !== authority.executionNonce ||
      execution.canonicalManifestSha256 !== authority.canonicalManifestSha256 ||
      execution.repositoryCommitSha !== input.amendment.historicalIncident.repositoryHead ||
      database.batchId !== input.amendment.stateAuthority.batchId ||
      database.developmentMembershipSha256 !==
        input.amendment.stateAuthority.pre.developmentMembershipSha256 ||
      database.effectiveStateSha256 !== input.amendment.stateAuthority.pre.effectiveV1Sha256 ||
      database.physicalStateSha256 !== input.amendment.stateAuthority.pre.physicalV1Sha256 ||
      database.developmentPlanningStateSha256 !==
        input.amendment.stateAuthority.pre.planningSha256 ||
      v1.occurrence !== 1 ||
      v1.sha256 !== input.amendment.pinnedSources.v1MigrationSha256 ||
      v2.occurrence !== 0 ||
      v2.sha256 !== input.amendment.pinnedSources.v2MigrationSha256
    ) {
      throw new Error(`Historical capture ${index + 1} identity or pre-state changed.`)
    }
  }
}

function authenticateRepositoryAndPostEvidence(
  input: ProtectedV2ReceiptRecoveryInput,
  finalizedExists: boolean,
): void {
  exactKeys(
    record(input.recoveryRepository, 'Recovery repository evidence'),
    [
      'branch',
      'head',
      'intentCommitIsAncestor',
      'originMain',
      'primaryCheckout',
      'statusCleanIncludingUntracked',
    ],
    'Recovery repository evidence',
  )
  exactKeys(
    record(input.postEvidence, 'Post-application recovery evidence'),
    ['catalog', 'ledger', 'mutationEvidence', 'safety', 'state'],
    'Post-application recovery evidence',
  )
  exactKeys(
    record(input.postEvidence.catalog, 'Post-application catalog evidence'),
    ['auditIdentitySha256', 'bindingSha256', 'fullAuditIdentitySha256'],
    'Post-application catalog evidence',
  )
  exactKeys(
    record(input.postEvidence.ledger, 'Post-application migration ledger'),
    ['v1MigrationSha256', 'v1Occurrence', 'v2MigrationSha256', 'v2Occurrence', 'v2VerifierSha256'],
    'Post-application migration ledger',
  )
  exactKeys(
    record(input.postEvidence.mutationEvidence, 'Post-application mutation evidence'),
    [
      'actionMutationCount',
      'compensationCallCount',
      'compensationMutationCount',
      'importCallCount',
      'importMutationCount',
      'operationMutationCount',
      'pointerMutationCount',
      'reviewMutationCount',
      'revealMutationCount',
    ],
    'Post-application mutation evidence',
  )
  exactKeys(
    record(input.postEvidence.safety, 'Post-application safety evidence'),
    [
      'contradictoryPartialFinalization',
      'finalizedAbsentAtEvidenceCollection',
      'heldOutIdentitiesAccessed',
      'originalCapturesModified',
      'originalIntentModified',
      'readOnly',
      'remoteDatabaseAccessed',
      'repeatableRead',
    ],
    'Post-application safety evidence',
  )
  const repository = input.recoveryRepository
  const post = input.postEvidence
  const authority = input.amendment
  if (
    repository.primaryCheckout !== true ||
    repository.branch !== 'main' ||
    repository.head !== repository.originMain ||
    !COMMIT_PATTERN.test(repository.head) ||
    repository.statusCleanIncludingUntracked !== true ||
    repository.intentCommitIsAncestor !== true
  ) {
    throw new Error(
      'Recovery requires clean primary main at exact origin/main and intent ancestry.',
    )
  }
  if (
    post.ledger.v1Occurrence !== 1 ||
    post.ledger.v2Occurrence !== 1 ||
    post.ledger.v1MigrationSha256 !== authority.pinnedSources.v1MigrationSha256 ||
    post.ledger.v2MigrationSha256 !== authority.pinnedSources.v2MigrationSha256 ||
    post.ledger.v2VerifierSha256 !== authority.pinnedSources.v2VerifierSha256 ||
    post.catalog.bindingSha256 !== authority.expectedCatalog.bindingSha256 ||
    post.catalog.fullAuditIdentitySha256 !== authority.expectedCatalog.fullAuditIdentitySha256 ||
    post.catalog.auditIdentitySha256 !== authority.expectedCatalog.fullAuditIdentitySha256 ||
    canonicalProtectedV2ReceiptRecoveryJson(post.state) !==
      canonicalProtectedV2ReceiptRecoveryJson(authority.stateAuthority.post) ||
    Object.values(post.mutationEvidence).some((count) => count !== 0) ||
    post.safety.finalizedAbsentAtEvidenceCollection !== !finalizedExists ||
    post.safety.contradictoryPartialFinalization !== false ||
    post.safety.readOnly !== true ||
    post.safety.repeatableRead !== true ||
    post.safety.heldOutIdentitiesAccessed !== false ||
    post.safety.remoteDatabaseAccessed !== false ||
    post.safety.originalIntentModified !== false ||
    post.safety.originalCapturesModified !== false
  ) {
    throw new Error('Post-application recovery evidence drifted or is unsafe.')
  }
}

function expectedTransitionProof(
  amendment: ProtectedV2ReceiptRecoveryAmendment,
): ProtectedV2ReceiptRecoveryTransitionProof {
  if (
    amendment.correctedTransitionPolicyIdentitySha256 !==
    LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256
  ) {
    throw new Error('Recovery amendment does not bind the live shared transition policy.')
  }
  return {
    accepted: true,
    batchId: amendment.stateAuthority.batchId,
    migration: {
      v1MigrationSha256: amendment.pinnedSources.v1MigrationSha256,
      v1OccurrenceAfter: 1,
      v1OccurrenceBefore: 1,
      v2MigrationSha256: amendment.pinnedSources.v2MigrationSha256,
      v2OccurrenceAfter: 1,
      v2OccurrenceBefore: 0,
      v2VerifierSha256: amendment.pinnedSources.v2VerifierSha256,
    },
    physicalTransitionChanged: true,
    post: {
      catalogAuditIdentitySha256: amendment.expectedCatalog.fullAuditIdentitySha256,
      effectiveStateSha256V2: amendment.stateAuthority.post.effectiveV2Sha256,
      expectedSchemaDerivedPhysicalStateSha256V1: amendment.stateAuthority.post.physicalV1Sha256,
      physicalStateSha256V1: amendment.stateAuthority.post.physicalV1Sha256,
      physicalStateSha256V2: amendment.stateAuthority.post.physicalV2Sha256,
      schemaNeutralHistorySha256: amendment.stateAuthority.post.schemaNeutralHistorySha256,
    },
    pre: {
      physicalStateSha256V1: amendment.stateAuthority.pre.physicalV1Sha256,
      schemaNeutralHistorySha256: amendment.stateAuthority.pre.schemaNeutralHistorySha256,
    },
    reasonCode: amendment.permittedReason,
    schemaVersion: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_PROOF_VERSION,
    sourceAuthorizationSha256: amendment.historicalIncident.authorizationContentSha256,
    transitionPolicyIdentitySha256:
      LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
    zeroMutationEvidence: {
      actions: 0,
      events: 0,
      pointers: 0,
      reveals: 0,
      reviews: 0,
    },
  }
}

function authenticateTransitionProof(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  postEvidence: ProtectedV2ReceiptRecoveryPostEvidence
  proof: ProtectedV2ReceiptRecoveryTransitionProof
}): string {
  const { amendment, postEvidence, proof } = input
  const expected = expectedTransitionProof(amendment)
  if (
    proof.post.catalogAuditIdentitySha256 !== postEvidence.catalog.auditIdentitySha256 ||
    canonicalProtectedV2ReceiptRecoveryJson(proof) !==
      canonicalProtectedV2ReceiptRecoveryJson(expected)
  ) {
    throw new Error('Shared schema-only transition proof does not authorize this incident.')
  }
  return protectedV2ReceiptRecoverySha256(canonicalProtectedV2ReceiptRecoveryJson(proof))
}

function buildResult(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  postEvidence: ProtectedV2ReceiptRecoveryPostEvidence
  recoveryRepositoryHead: string
  transitionProofSha256: string
}): ProtectedV2ReceiptRecoveryResult {
  const content: ProtectedV2ReceiptRecoveryResultContent = {
    currentRecoveryToolBundle: input.amendment.correctedRecoveryToolBundle,
    defectIdentifier: PROTECTED_V2_RECEIPT_RECOVERY_DEFECT,
    defectReason: PROTECTED_V2_RECEIPT_RECOVERY_REASON,
    expectedCatalog: {
      auditIdentitySha256: input.amendment.expectedCatalog.fullAuditIdentitySha256,
      bindingSha256: input.amendment.expectedCatalog.bindingSha256,
      fullAuditIdentitySha256: input.amendment.expectedCatalog.fullAuditIdentitySha256,
    },
    historicalOperatorBundle: input.amendment.historicalOperatorBundle,
    migration: {
      migrationApplied: true,
      migrationApplicationCallCount: 0,
      migrationReexecuted: false,
      migrationStagingCallCount: 0,
      v1MigrationSha256: input.amendment.pinnedSources.v1MigrationSha256,
      v1Occurrence: 1,
      v2MigrationSha256: input.amendment.pinnedSources.v2MigrationSha256,
      v2Occurrence: 1,
      v2VerifierSha256: input.amendment.pinnedSources.v2VerifierSha256,
    },
    mutationEvidence: {
      actionMutationCount: 0,
      compensationCallCount: 0,
      compensationMutationCount: 0,
      importCallCount: 0,
      importMutationCount: 0,
      operationMutationCount: 0,
      pointerMutationCount: 0,
      reviewMutationCount: 0,
      revealMutationCount: 0,
    },
    originalIntent: {
      authorizationContentSha256: input.amendment.historicalIncident.authorizationContentSha256,
      intentManifestSha256: input.amendment.historicalIncident.intentManifestSha256,
      intentSha256: input.amendment.historicalIncident.intentSha256,
      outputDirectory: input.amendment.historicalIncident.intentOutputDirectory,
      repositoryHead: input.amendment.historicalIncident.repositoryHead,
    },
    prohibitedCapabilities: PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES,
    receiptReconciled: true,
    recoveryAmendmentIdentitySha256: input.amendment.amendmentIdentitySha256,
    recoveryRepositoryHead: input.recoveryRepositoryHead,
    safety: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      originalIntentRewritten: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: PROTECTED_V2_RECEIPT_RECOVERY_RESULT_SCHEMA_VERSION,
    sharedTransitionProofIdentitySha256: input.transitionProofSha256,
    state: 'application_receipt_finalized_by_historical_recovery',
    stateIdentities: input.amendment.stateAuthority,
    status: 'protected_v2_migration_applied_exactly_once_receipt_recovered',
  }
  return {
    ...content,
    contentSha256: protectedV2ReceiptRecoverySha256(
      canonicalProtectedV2ReceiptRecoveryJson(content),
    ),
  }
}

export function parseProtectedV2ReceiptRecoveryResult(
  bytes: string,
): ProtectedV2ReceiptRecoveryResult {
  const parsed = parseCanonicalObject(bytes, 'Protected V2 receipt recovery result')
  exactKeys(
    parsed,
    [
      'contentSha256',
      'currentRecoveryToolBundle',
      'defectIdentifier',
      'defectReason',
      'expectedCatalog',
      'historicalOperatorBundle',
      'migration',
      'mutationEvidence',
      'originalIntent',
      'prohibitedCapabilities',
      'receiptReconciled',
      'recoveryAmendmentIdentitySha256',
      'recoveryRepositoryHead',
      'safety',
      'schemaVersion',
      'sharedTransitionProofIdentitySha256',
      'state',
      'stateIdentities',
      'status',
    ],
    'Protected V2 receipt recovery result',
  )
  const contentSha256 = parsed.contentSha256
  assertSha256(contentSha256, 'Recovery result contentSha256')
  const content = { ...parsed }
  delete content.contentSha256
  if (
    content.schemaVersion !== PROTECTED_V2_RECEIPT_RECOVERY_RESULT_SCHEMA_VERSION ||
    content.state !== 'application_receipt_finalized_by_historical_recovery' ||
    content.status !== 'protected_v2_migration_applied_exactly_once_receipt_recovered' ||
    content.receiptReconciled !== true ||
    protectedV2ReceiptRecoverySha256(canonicalProtectedV2ReceiptRecoveryJson(content)) !==
      contentSha256
  ) {
    throw new Error('Protected V2 receipt recovery result is incomplete or invalid.')
  }
  const migration = record(content.migration, 'Recovery result migration')
  const safety = record(content.safety, 'Recovery result safety')
  const mutationEvidence = record(content.mutationEvidence, 'Recovery result mutation evidence')
  exactKeys(
    migration,
    [
      'migrationApplied',
      'migrationApplicationCallCount',
      'migrationReexecuted',
      'migrationStagingCallCount',
      'v1MigrationSha256',
      'v1Occurrence',
      'v2MigrationSha256',
      'v2Occurrence',
      'v2VerifierSha256',
    ],
    'Recovery result migration',
  )
  exactKeys(
    safety,
    [
      'compensationAuthorized',
      'heldOutIdentitiesAccessed',
      'importAuthorized',
      'originalIntentRewritten',
      'remoteDatabaseAccessed',
    ],
    'Recovery result safety',
  )
  exactKeys(
    mutationEvidence,
    [
      'actionMutationCount',
      'compensationCallCount',
      'compensationMutationCount',
      'importCallCount',
      'importMutationCount',
      'operationMutationCount',
      'pointerMutationCount',
      'reviewMutationCount',
      'revealMutationCount',
    ],
    'Recovery result mutation evidence',
  )
  validateProtectedV2ReceiptRecoveryBundle(
    content.currentRecoveryToolBundle as ProtectedV2ReceiptRecoveryBundle,
  )
  if (
    migration.migrationApplied !== true ||
    migration.migrationReexecuted !== false ||
    migration.migrationStagingCallCount !== 0 ||
    migration.migrationApplicationCallCount !== 0 ||
    migration.v1Occurrence !== 1 ||
    migration.v2Occurrence !== 1 ||
    safety.importAuthorized !== false ||
    safety.compensationAuthorized !== false ||
    safety.originalIntentRewritten !== false ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.remoteDatabaseAccessed !== false ||
    Object.values(mutationEvidence).some((count) => count !== 0) ||
    canonicalProtectedV2ReceiptRecoveryJson(content.prohibitedCapabilities) !==
      canonicalProtectedV2ReceiptRecoveryJson(PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES)
  ) {
    throw new Error('Protected V2 receipt recovery result grants a forbidden capability.')
  }
  return parsed as unknown as ProtectedV2ReceiptRecoveryResult
}

function buildExecutionReceipt(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  manifestSha256: string
  outputDirectory: string
  resultSha256: string
}): ProtectedV2ReceiptRecoveryExecutionReceipt {
  const content: ProtectedV2ReceiptRecoveryExecutionReceiptContent = {
    canonicalManifestSha256: input.manifestSha256,
    compensationAuthorized: false,
    currentRecoveryToolBundleSha256: input.amendment.correctedRecoveryToolBundle.aggregateSha256,
    importAuthorized: false,
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    migrationStagingCallCount: 0,
    originalIntentSha256: input.amendment.historicalIncident.intentSha256,
    outputDirectory: input.outputDirectory,
    receiptReconciled: true,
    recoveryAmendmentIdentitySha256: input.amendment.amendmentIdentitySha256,
    resultSha256: input.resultSha256,
    schemaVersion: PROTECTED_V2_RECEIPT_RECOVERY_EXECUTION_SCHEMA_VERSION,
  }
  return {
    ...content,
    contentSha256: protectedV2ReceiptRecoverySha256(
      canonicalProtectedV2ReceiptRecoveryJson(content),
    ),
  }
}

export function parseProtectedV2ReceiptRecoveryExecutionReceipt(
  bytes: string,
): ProtectedV2ReceiptRecoveryExecutionReceipt {
  const parsed = parseCanonicalObject(bytes, 'Protected V2 receipt recovery execution receipt')
  exactKeys(
    parsed,
    [
      'canonicalManifestSha256',
      'compensationAuthorized',
      'contentSha256',
      'currentRecoveryToolBundleSha256',
      'importAuthorized',
      'migrationApplicationCallCount',
      'migrationReexecuted',
      'migrationStagingCallCount',
      'originalIntentSha256',
      'outputDirectory',
      'receiptReconciled',
      'recoveryAmendmentIdentitySha256',
      'resultSha256',
      'schemaVersion',
    ],
    'Protected V2 receipt recovery execution receipt',
  )
  const contentSha256 = parsed.contentSha256
  assertSha256(contentSha256, 'Recovery execution contentSha256')
  const content = { ...parsed }
  delete content.contentSha256
  if (
    content.schemaVersion !== PROTECTED_V2_RECEIPT_RECOVERY_EXECUTION_SCHEMA_VERSION ||
    content.receiptReconciled !== true ||
    content.migrationStagingCallCount !== 0 ||
    content.migrationApplicationCallCount !== 0 ||
    content.migrationReexecuted !== false ||
    content.importAuthorized !== false ||
    content.compensationAuthorized !== false ||
    protectedV2ReceiptRecoverySha256(canonicalProtectedV2ReceiptRecoveryJson(content)) !==
      contentSha256
  ) {
    throw new Error('Protected V2 receipt recovery execution receipt is invalid or overbroad.')
  }
  return parsed as unknown as ProtectedV2ReceiptRecoveryExecutionReceipt
}

export function assertProtectedV2FinalizedRecoveryReceiptGate(
  result: ProtectedV2ReceiptRecoveryResult,
  authority: ProtectedV2FinalizedRecoveryReceiptAuthority,
): {
  compensationAuthorized: false
  importAuthorized: false
  migrationReceiptComplete: true
} {
  const reparsed = parseProtectedV2ReceiptRecoveryResult(
    canonicalProtectedV2ReceiptRecoveryJson(result),
  )
  const { amendmentIdentitySha256: suppliedAmendmentIdentity, ...amendmentContent } =
    authority.amendment
  const amendment = buildProtectedV2ReceiptRecoveryAmendment(amendmentContent)
  const expectedCatalog = {
    auditIdentitySha256: amendment.expectedCatalog.fullAuditIdentitySha256,
    bindingSha256: amendment.expectedCatalog.bindingSha256,
    fullAuditIdentitySha256: amendment.expectedCatalog.fullAuditIdentitySha256,
  }
  const expectedMigration = {
    migrationApplied: true,
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    migrationStagingCallCount: 0,
    v1MigrationSha256: amendment.pinnedSources.v1MigrationSha256,
    v1Occurrence: 1,
    v2MigrationSha256: amendment.pinnedSources.v2MigrationSha256,
    v2Occurrence: 1,
    v2VerifierSha256: amendment.pinnedSources.v2VerifierSha256,
  }
  const expectedOriginalIntent = {
    authorizationContentSha256: amendment.historicalIncident.authorizationContentSha256,
    intentManifestSha256: amendment.historicalIncident.intentManifestSha256,
    intentSha256: amendment.historicalIncident.intentSha256,
    outputDirectory: amendment.historicalIncident.intentOutputDirectory,
    repositoryHead: amendment.historicalIncident.repositoryHead,
  }
  const expectedMutationEvidence = {
    actionMutationCount: 0,
    compensationCallCount: 0,
    compensationMutationCount: 0,
    importCallCount: 0,
    importMutationCount: 0,
    operationMutationCount: 0,
    pointerMutationCount: 0,
    reviewMutationCount: 0,
    revealMutationCount: 0,
  }
  const expectedSafety = {
    compensationAuthorized: false,
    heldOutIdentitiesAccessed: false,
    importAuthorized: false,
    originalIntentRewritten: false,
    remoteDatabaseAccessed: false,
  }
  if (
    amendment.amendmentIdentitySha256 !== suppliedAmendmentIdentity ||
    amendment.amendmentIdentitySha256 !== authority.amendmentIdentitySha256 ||
    amendment.historicalIncident.intentSha256 !== authority.originalIntentSha256 ||
    amendment.correctedRecoveryToolBundle.aggregateSha256 !== authority.recoveryToolBundleSha256 ||
    reparsed.receiptReconciled !== true ||
    reparsed.safety.importAuthorized !== false ||
    reparsed.safety.compensationAuthorized !== false ||
    reparsed.recoveryAmendmentIdentitySha256 !== authority.amendmentIdentitySha256 ||
    reparsed.originalIntent.intentSha256 !== authority.originalIntentSha256 ||
    reparsed.currentRecoveryToolBundle.aggregateSha256 !== authority.recoveryToolBundleSha256 ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.currentRecoveryToolBundle) !==
      canonicalProtectedV2ReceiptRecoveryJson(amendment.correctedRecoveryToolBundle) ||
    reparsed.defectIdentifier !== amendment.defectIdentifier ||
    reparsed.defectReason !== amendment.permittedReason ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.expectedCatalog) !==
      canonicalProtectedV2ReceiptRecoveryJson(expectedCatalog) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.historicalOperatorBundle) !==
      canonicalProtectedV2ReceiptRecoveryJson(amendment.historicalOperatorBundle) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.migration) !==
      canonicalProtectedV2ReceiptRecoveryJson(expectedMigration) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.mutationEvidence) !==
      canonicalProtectedV2ReceiptRecoveryJson(expectedMutationEvidence) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.originalIntent) !==
      canonicalProtectedV2ReceiptRecoveryJson(expectedOriginalIntent) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.prohibitedCapabilities) !==
      canonicalProtectedV2ReceiptRecoveryJson(amendment.prohibitedCapabilities) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.safety) !==
      canonicalProtectedV2ReceiptRecoveryJson(expectedSafety) ||
    canonicalProtectedV2ReceiptRecoveryJson(reparsed.stateIdentities) !==
      canonicalProtectedV2ReceiptRecoveryJson(amendment.stateAuthority) ||
    !COMMIT_PATTERN.test(reparsed.recoveryRepositoryHead) ||
    reparsed.sharedTransitionProofIdentitySha256 !==
      protectedV2ReceiptRecoverySha256(
        canonicalProtectedV2ReceiptRecoveryJson(expectedTransitionProof(amendment)),
      )
  ) {
    throw new Error('Historical recovery is not a complete, non-authorizing migration receipt.')
  }
  return {
    compensationAuthorized: false,
    importAuthorized: false,
    migrationReceiptComplete: true,
  }
}

export async function loadProtectedV2FinalizedReceiptRecovery(input: {
  authority: ProtectedV2FinalizedRecoveryReceiptAuthority
  outputDirectory: string
}): Promise<ProtectedV2FinalizedReceiptRecovery> {
  const finalizedDirectory = resolve(
    input.outputDirectory,
    PROTECTED_V2_RECEIPT_RECOVERY_FINALIZED_DIRECTORY,
  )
  const stat = await lstat(finalizedDirectory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Protected V2 recovery finalized directory is unsafe.')
  }
  const names = (await readdir(finalizedDirectory)).sort()
  if (
    canonicalProtectedV2ReceiptRecoveryJson(names) !==
    canonicalProtectedV2ReceiptRecoveryJson([...FINALIZED_FILES].sort())
  ) {
    throw new Error('Protected V2 recovery finalized inventory is partial or contradictory.')
  }
  for (const name of FINALIZED_FILES) {
    await assertRegularFile(resolve(finalizedDirectory, name), `Recovery final file ${name}`)
  }
  const [resultBytes, markdownBytes, manifestBytes, executionBytes] = await Promise.all([
    readFile(resolve(finalizedDirectory, 'application-result.json'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'application-result.md'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'checksum-manifest.sha256'), 'utf8'),
    readFile(resolve(finalizedDirectory, 'execution-receipt.json'), 'utf8'),
  ])
  const manifest = parseManifest({
    bytes: manifestBytes,
    expectedNames: ['application-result.json', 'application-result.md'],
    label: 'Recovery final checksum manifest',
  })
  if (
    manifest.get('application-result.json') !== protectedV2ReceiptRecoverySha256(resultBytes) ||
    manifest.get('application-result.md') !== protectedV2ReceiptRecoverySha256(markdownBytes)
  ) {
    throw new Error('Recovery final checksum manifest does not match finalized bytes.')
  }
  const result = parseProtectedV2ReceiptRecoveryResult(resultBytes)
  const executionReceipt = parseProtectedV2ReceiptRecoveryExecutionReceipt(executionBytes)
  const resultSha256 = protectedV2ReceiptRecoverySha256(resultBytes)
  const manifestSha256 = protectedV2ReceiptRecoverySha256(manifestBytes)
  if (
    executionReceipt.resultSha256 !== resultSha256 ||
    executionReceipt.canonicalManifestSha256 !== manifestSha256 ||
    executionReceipt.outputDirectory !== input.outputDirectory ||
    executionReceipt.recoveryAmendmentIdentitySha256 !== result.recoveryAmendmentIdentitySha256 ||
    executionReceipt.currentRecoveryToolBundleSha256 !==
      result.currentRecoveryToolBundle.aggregateSha256 ||
    executionReceipt.originalIntentSha256 !== result.originalIntent.intentSha256 ||
    result.recoveryAmendmentIdentitySha256 !== input.authority.amendmentIdentitySha256 ||
    result.originalIntent.intentSha256 !== input.authority.originalIntentSha256 ||
    result.currentRecoveryToolBundle.aggregateSha256 !== input.authority.recoveryToolBundleSha256
  ) {
    throw new Error('Recovery finalized result and execution receipt bindings disagree.')
  }
  assertProtectedV2FinalizedRecoveryReceiptGate(result, input.authority)
  return { executionReceipt, manifestSha256, result, resultSha256 }
}

function recoveryMarkdown(result: ProtectedV2ReceiptRecoveryResult): string {
  return `# Protected Literature gold import contract V2 historical receipt recovery

- State: \`${result.state}\`
- Original intent SHA-256: \`${result.originalIntent.intentSha256}\`
- Recovery amendment SHA-256: \`${result.recoveryAmendmentIdentitySha256}\`
- Defect reason: \`${result.defectReason}\`
- Migration applied: \`true\`
- Migration reexecuted: \`false\`
- Migration staging calls: \`0\`
- Migration application calls: \`0\`
- Import authorized: \`false\`
- Compensation authorized: \`false\`
`
}

async function atomicallyWriteFinalization(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  outputDirectory: string
  result: ProtectedV2ReceiptRecoveryResult
}): Promise<boolean> {
  const resultBytes = canonicalProtectedV2ReceiptRecoveryJson(input.result)
  const markdownBytes = recoveryMarkdown(input.result)
  const manifestBytes = checksumManifest(
    new Map([
      ['application-result.json', resultBytes],
      ['application-result.md', markdownBytes],
    ]),
  )
  const execution = buildExecutionReceipt({
    amendment: input.amendment,
    manifestSha256: protectedV2ReceiptRecoverySha256(manifestBytes),
    outputDirectory: input.outputDirectory,
    resultSha256: protectedV2ReceiptRecoverySha256(resultBytes),
  })
  const parent = dirname(input.outputDirectory)
  const temporaryDirectory = await mkdtemp(
    resolve(parent, `.${basename(input.outputDirectory)}.recovery-finalized-`),
  )
  try {
    for (const [name, bytes] of [
      ['application-result.json', resultBytes],
      ['application-result.md', markdownBytes],
      ['checksum-manifest.sha256', manifestBytes],
      ['execution-receipt.json', canonicalProtectedV2ReceiptRecoveryJson(execution)],
    ] as const) {
      await writeFile(resolve(temporaryDirectory, name), bytes, { flag: 'wx', mode: 0o600 })
    }
    await rename(
      temporaryDirectory,
      resolve(input.outputDirectory, PROTECTED_V2_RECEIPT_RECOVERY_FINALIZED_DIRECTORY),
    )
    return true
  } catch (error) {
    await rm(temporaryDirectory, { force: true, recursive: true })
    if (
      (error as NodeJS.ErrnoException).code === 'EEXIST' ||
      (error as NodeJS.ErrnoException).code === 'ENOTEMPTY'
    ) {
      return false
    }
    throw error
  }
}

function finalizedAuthority(
  amendment: ProtectedV2ReceiptRecoveryAmendment,
): ProtectedV2FinalizedRecoveryReceiptAuthority {
  return {
    amendment,
    amendmentIdentitySha256: amendment.amendmentIdentitySha256,
    originalIntentSha256: amendment.historicalIncident.intentSha256,
    recoveryToolBundleSha256: amendment.correctedRecoveryToolBundle.aggregateSha256,
  }
}

export async function recoverProtectedV2HistoricalReceipt(
  input: ProtectedV2ReceiptRecoveryInput,
  dependencies: ProtectedV2ReceiptRecoveryDependencies,
): Promise<ProtectedV2ReceiptRecoveryOutcome> {
  if (Object.keys(dependencies).sort().join(',') !== 'validateSchemaOnlyTransition') {
    throw new Error('Recovery dependencies must expose only the shared transition validator.')
  }
  authenticateAmendment(input)
  authenticateIncidentEvidence(input)
  const intentPackage = await readIntentPackage(input.applicationOutputDirectory)
  authenticateHistoricalIntent({
    amendment: input.amendment,
    authorizationBytes: input.authorizationBytes,
    historicalOperatorBundle: input.historicalOperatorBundle,
    ...intentPackage,
    outputDirectory: input.applicationOutputDirectory,
  })
  authenticateCaptures(input)

  const finalizedPath = resolve(
    input.applicationOutputDirectory,
    PROTECTED_V2_RECEIPT_RECOVERY_FINALIZED_DIRECTORY,
  )
  let finalizedExists = false
  try {
    await lstat(finalizedPath)
    finalizedExists = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (finalizedExists) {
    const loaded = await loadProtectedV2FinalizedReceiptRecovery({
      authority: finalizedAuthority(input.amendment),
      outputDirectory: input.applicationOutputDirectory,
    })
    authenticateRepositoryAndPostEvidence(input, true)
    if (
      canonicalProtectedV2ReceiptRecoveryJson(loaded.result.currentRecoveryToolBundle) !==
        canonicalProtectedV2ReceiptRecoveryJson(input.currentRecoveryToolBundle) ||
      loaded.result.recoveryRepositoryHead !== input.recoveryRepository.head
    ) {
      throw new Error('Completed recovery receipt no longer matches the authorized recovery.')
    }
    return {
      ...loaded,
      state: 'already_finalized_verified',
      wroteFinalization: false,
    }
  }
  authenticateRepositoryAndPostEvidence(input, false)

  const proof = await dependencies.validateSchemaOnlyTransition(input.transitionInput)
  const transitionProofSha256 = authenticateTransitionProof({
    amendment: input.amendment,
    postEvidence: input.postEvidence,
    proof,
  })
  const result = buildResult({
    amendment: input.amendment,
    postEvidence: input.postEvidence,
    recoveryRepositoryHead: input.recoveryRepository.head,
    transitionProofSha256,
  })
  const wroteFinalization = await atomicallyWriteFinalization({
    amendment: input.amendment,
    outputDirectory: input.applicationOutputDirectory,
    result,
  })
  const loaded = await loadProtectedV2FinalizedReceiptRecovery({
    authority: finalizedAuthority(input.amendment),
    outputDirectory: input.applicationOutputDirectory,
  })
  if (
    canonicalProtectedV2ReceiptRecoveryJson(loaded.result) !==
    canonicalProtectedV2ReceiptRecoveryJson(result)
  ) {
    throw new Error('Concurrent recovery winner did not write the exact authorized receipt.')
  }
  return {
    ...loaded,
    state: wroteFinalization ? 'finalized_atomically' : 'already_finalized_verified',
    wroteFinalization,
  }
}
