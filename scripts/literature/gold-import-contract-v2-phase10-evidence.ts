import { TextDecoder } from 'node:util'

export const GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_SCHEMA_VERSION =
  'gold-import-contract-v2-phase10-evidence/1.0.0' as const

export const GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES = [
  'critic-report',
  'descendant-recovery-evidence',
  'final-pr-body',
  'full-validation-report',
  'merge-readiness-report',
  'same-user-recomputation-evidence',
  'sealed-intent-lost-ack-evidence',
  'tests-build-report',
  'trusted-operator-evidence',
] as const

export type GoldImportContractV2Phase10EvidenceName =
  (typeof GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES)[number]

export const GOLD_IMPORT_CONTRACT_V2_FULL_VALIDATION_CHECK_IDS = [
  'expected-catalog-artifact-tests',
  'expectation-generation-tests',
  'exact-expected-state-readiness-tests',
  'arbitrary-self-hash-rejection',
  'count-preserving-drift',
  'expanded-production-drift-matrix',
  'protected-tracked-superset-bundle-tests',
  'typescript-module-resolution-tests',
  'runtime-input-declaration-tests',
  'descendant-recovery-tests',
  'trusted-operator-threat-model-tests',
  'same-user-recomputation-test',
  'sealed-intent-tests',
  'lost-ack-tests',
  'startup-safety-tests',
  'focused-v2-contract-tests',
  'note-disposition-tests',
  'source-authorization-package-tests',
  'exact-package-rehearsal-tests',
  'migration-database-contract-tests',
  'all-scripts-literature-tests',
  'literature-suite',
  'complete-repository-suite',
  'typescript',
  'repository-eslint',
  'changed-file-eslint',
  'prettier',
  'git-diff-check',
  'production-build',
  'registry-scope-check',
] as const

export const GOLD_IMPORT_CONTRACT_V2_TESTS_BUILD_CHECK_IDS = [
  'all-scripts-literature-tests',
  'literature-suite',
  'complete-repository-suite',
  'typescript',
  'repository-eslint',
  'changed-file-eslint',
  'prettier',
  'git-diff-check',
  'production-build',
  'registry-scope-check',
] as const

export const GOLD_IMPORT_CONTRACT_V2_TRUST_MODEL =
  'trusted-local-operator-redundant-captures/1.0.0' as const
export const GOLD_IMPORT_CONTRACT_V2_CAPTURE_ATTESTATION =
  'I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u
const SAFE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u
const SUMMARY_FILE_NAME = 'evidence-summary.json' as const

const REQUIRED_COMPANION_FILES: Readonly<
  Record<GoldImportContractV2Phase10EvidenceName, readonly string[]>
> = Object.freeze({
  'critic-report': ['critic-report.md'],
  'descendant-recovery-evidence': ['descendant-recovery-report.md'],
  'final-pr-body': ['final-pr-body.md'],
  'full-validation-report': ['full-validation-report.md'],
  'merge-readiness-report': ['merge-readiness-report.md'],
  'same-user-recomputation-evidence': ['same-user-recomputation-report.md'],
  'sealed-intent-lost-ack-evidence': [
    'application-result-regression.json',
    'final-receipt-regression.json',
    'sealed-intent-lost-ack-report.md',
    'sealed-intent-regression.json',
  ],
  'tests-build-report': ['tests-build-report.md'],
  'trusted-operator-evidence': ['trusted-operator-report.md'],
})

export interface GoldImportContractV2Phase10RepositoryIdentity {
  branch: string
  head: string
  originMain: string
}

export interface GoldImportContractV2Phase10AuthorizationIdentity {
  disposableExpectedCatalogBindingSha256: string
  localExpectedCatalogBindingSha256: string
  protectedRuntimeBundleBindingSha256: string
}

export interface GoldImportContractV2Phase10EvidenceContext {
  authorization: GoldImportContractV2Phase10AuthorizationIdentity
  repository: GoldImportContractV2Phase10RepositoryIdentity
}

interface EvidenceFileIdentity {
  bytes: number
  path: string
  sha256: string
}

export interface GoldImportContractV2Phase10EvidenceSummary {
  authorization: GoldImportContractV2Phase10AuthorizationIdentity
  files: EvidenceFileIdentity[]
  kind: GoldImportContractV2Phase10EvidenceName
  repository: GoldImportContractV2Phase10RepositoryIdentity
  results: Record<string, unknown>
  safety: {
    databaseAccessed: false
    databaseMutationCount: 0
    heldOutIdentitiesAccessed: false
    realCompensationExecuted: false
    realImportExecuted: false
    realLocalV2Applied: false
    remoteDatabaseAccessed: false
  }
  schemaVersion: typeof GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_SCHEMA_VERSION
  scope:
    | 'draft_pr_delivery'
    | 'read_only_evidence'
    | 'read_only_review'
    | 'synthetic_regression'
    | 'validation'
  status: 'passed'
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} key topology drifted.`)
  }
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, canonicalValue(child)]),
  )
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T
}

function sha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256.`)
  }
  return value
}

function commit(value: unknown, label: string): string {
  if (typeof value !== 'string' || !COMMIT_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase commit SHA.`)
  }
  return value
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array.`)
  }
  return [...value]
}

function exactTwoDistinctStrings(value: unknown, label: string): string[] {
  const parsed = strings(value, label)
  if (parsed.length !== 2 || new Set(parsed).size !== 2 || parsed.some((entry) => !entry)) {
    throw new Error(`${label} must contain exactly two distinct nonempty values.`)
  }
  return parsed
}

function exactTwoDistinctShas(value: unknown, label: string): string[] {
  const parsed = exactTwoDistinctStrings(value, label)
  parsed.forEach((entry, index) => sha(entry, `${label}[${index}]`))
  return parsed
}

function exactTwoShas(value: unknown, label: string): string[] {
  const parsed = strings(value, label)
  if (parsed.length !== 2) throw new Error(`${label} must contain exactly two SHA-256 values.`)
  parsed.forEach((entry, index) => sha(entry, `${label}[${index}]`))
  return parsed
}

function fileSha(summary: GoldImportContractV2Phase10EvidenceSummary, path: string): string {
  const matches = summary.files.filter((entry) => entry.path === path)
  if (matches.length !== 1) throw new Error(`Phase-10 evidence omitted exact companion ${path}.`)
  return matches[0].sha256
}

function parseJsonCompanion(
  files: ReadonlyMap<string, Uint8Array>,
  path: string,
  label: string,
): Record<string, unknown> {
  const bytes = files.get(path)
  if (!bytes) throw new Error(`${label} is absent.`)
  try {
    return record(JSON.parse(new TextDecoder().decode(bytes)), label)
  } catch (error) {
    throw new Error(`${label} is not strict JSON.`, { cause: error })
  }
}

function validateSealedIntentCompanions(input: {
  files: ReadonlyMap<string, Uint8Array>
  sha256Bytes: (value: Uint8Array) => string
  summary: GoldImportContractV2Phase10EvidenceSummary
}): void {
  const intent = parseJsonCompanion(
    input.files,
    'sealed-intent-regression.json',
    'Sealed-intent regression artifact',
  )
  const result = parseJsonCompanion(
    input.files,
    'application-result-regression.json',
    'Application-result regression artifact',
  )
  const receipt = parseJsonCompanion(
    input.files,
    'final-receipt-regression.json',
    'Final-receipt regression artifact',
  )
  exactKeys(
    intent,
    [
      'authorization',
      'immutable',
      'repository',
      'schemaVersion',
      'scope',
      'sealedBeforeStaging',
      'status',
    ],
    'Sealed-intent regression artifact',
  )
  exactKeys(
    result,
    [
      'authorization',
      'compensationAuthorized',
      'importAuthorized',
      'intentSha256',
      'migrationApplicationCallCount',
      'migrationReexecuted',
      'repository',
      'schemaVersion',
      'scope',
      'status',
    ],
    'Application-result regression artifact',
  )
  exactKeys(
    receipt,
    [
      'applicationResultSha256',
      'authorization',
      'compensationAuthorized',
      'importAuthorized',
      'intentSha256',
      'lostAcknowledgementReconciledWithoutReplay',
      'migrationApplicationCallCount',
      'migrationReexecuted',
      'receiptResultCrossBound',
      'repository',
      'schemaVersion',
      'scope',
      'status',
    ],
    'Final-receipt regression artifact',
  )
  const intentSha256 = input.sha256Bytes(input.files.get('sealed-intent-regression.json')!)
  const resultSha256 = input.sha256Bytes(input.files.get('application-result-regression.json')!)
  const exactCommon = (artifact: Record<string, unknown>) =>
    canonicalJson(artifact.authorization) === canonicalJson(input.summary.authorization) &&
    canonicalJson(artifact.repository) === canonicalJson(input.summary.repository) &&
    artifact.scope === 'synthetic_regression' &&
    artifact.status === 'passed'
  if (
    intent.schemaVersion !== 'gold-import-contract-v2-sealed-intent-regression/1.0.0' ||
    intent.sealedBeforeStaging !== true ||
    intent.immutable !== true ||
    !exactCommon(intent) ||
    result.schemaVersion !== 'gold-import-contract-v2-application-result-regression/1.0.0' ||
    result.intentSha256 !== intentSha256 ||
    result.migrationApplicationCallCount !== 0 ||
    result.migrationReexecuted !== false ||
    result.importAuthorized !== false ||
    result.compensationAuthorized !== false ||
    !exactCommon(result) ||
    receipt.schemaVersion !== 'gold-import-contract-v2-final-receipt-regression/1.0.0' ||
    receipt.intentSha256 !== intentSha256 ||
    receipt.applicationResultSha256 !== resultSha256 ||
    receipt.receiptResultCrossBound !== true ||
    receipt.lostAcknowledgementReconciledWithoutReplay !== true ||
    receipt.migrationApplicationCallCount !== 0 ||
    receipt.migrationReexecuted !== false ||
    receipt.importAuthorized !== false ||
    receipt.compensationAuthorized !== false ||
    !exactCommon(receipt)
  ) {
    throw new Error(
      'Sealed-intent/result/receipt regression artifacts are not exactly cross-bound.',
    )
  }
}

function validateChecks(value: unknown, expectedIds: readonly string[], label: string): void {
  if (!Array.isArray(value) || value.length !== expectedIds.length) {
    throw new Error(`${label} check inventory drifted.`)
  }
  value.forEach((candidate, index) => {
    const check = record(candidate, `${label}[${index}]`)
    exactKeys(check, ['exitCode', 'id', 'status'], `${label}[${index}]`)
    if (check.id !== expectedIds[index] || check.exitCode !== 0 || check.status !== 'passed') {
      throw new Error(`${label}[${index}] did not pass the exact required check.`)
    }
  })
}

function validateResults(summary: GoldImportContractV2Phase10EvidenceSummary): void {
  const results = record(summary.results, `${summary.kind} results`)
  switch (summary.kind) {
    case 'critic-report': {
      exactKeys(
        results,
        ['confirmedFindingCount', 'questionResults', 'reportSha256', 'terminal'],
        'Critic results',
      )
      const questionResults = Array.isArray(results.questionResults) ? results.questionResults : []
      if (questionResults.length !== 14) throw new Error('Critic must answer all 14 questions.')
      questionResults.forEach((candidate, index) => {
        const question = record(candidate, `Critic question ${index + 1}`)
        exactKeys(question, ['id', 'passed'], `Critic question ${index + 1}`)
        if (question.id !== index + 1 || question.passed !== true) {
          throw new Error(`Critic question ${index + 1} did not pass.`)
        }
      })
      if (
        results.terminal !== 'CRITIC PASS — NO CONFIRMED BLOCKER' ||
        results.confirmedFindingCount !== 0 ||
        results.reportSha256 !== fileSha(summary, 'critic-report.md')
      ) {
        throw new Error('Critic terminal evidence is not an exact pass.')
      }
      return
    }
    case 'descendant-recovery-evidence': {
      exactKeys(
        results,
        [
          'currentHeadEqualsOriginMain',
          'databaseV2Occurrence',
          'documentationOnlyDescendantReconciled',
          'exactExpectedArtifactsPreserved',
          'exactLocalCatalogPassed',
          'expectedArtifactDriftRejected',
          'fullProtectedBundlePreserved',
          'historiesDivergent',
          'intentCommitIsAncestor',
          'migrationApplicationCallCount',
          'migrationReexecuted',
          'migrationVerifierBytesPreserved',
          'protectedSourceDriftRejected',
          'reportSha256',
          'schemaOnlyClinicalStateUnchanged',
          'supabaseConfigDriftRejected',
          'tsconfigDriftRejected',
        ],
        'Descendant recovery results',
      )
      if (
        results.intentCommitIsAncestor !== true ||
        results.currentHeadEqualsOriginMain !== true ||
        results.databaseV2Occurrence !== 1 ||
        results.historiesDivergent !== false ||
        results.exactExpectedArtifactsPreserved !== true ||
        results.fullProtectedBundlePreserved !== true ||
        results.migrationVerifierBytesPreserved !== true ||
        results.exactLocalCatalogPassed !== true ||
        results.documentationOnlyDescendantReconciled !== true ||
        results.tsconfigDriftRejected !== true ||
        results.supabaseConfigDriftRejected !== true ||
        results.protectedSourceDriftRejected !== true ||
        results.expectedArtifactDriftRejected !== true ||
        results.schemaOnlyClinicalStateUnchanged !== true ||
        results.migrationApplicationCallCount !== 0 ||
        results.migrationReexecuted !== false ||
        results.reportSha256 !== fileSha(summary, 'descendant-recovery-report.md')
      ) {
        throw new Error('Descendant-recovery regression claims are incomplete.')
      }
      return
    }
    case 'tests-build-report':
    case 'full-validation-report': {
      const isFull = summary.kind === 'full-validation-report'
      exactKeys(
        results,
        isFull
          ? ['checks', 'reportSha256', 'testCountChangesExplained', 'testsBuildSummarySha256']
          : ['checks', 'reportSha256', 'testCountChangesExplained'],
        `${summary.kind} results`,
      )
      validateChecks(
        results.checks,
        isFull
          ? GOLD_IMPORT_CONTRACT_V2_FULL_VALIDATION_CHECK_IDS
          : GOLD_IMPORT_CONTRACT_V2_TESTS_BUILD_CHECK_IDS,
        summary.kind,
      )
      if (
        results.testCountChangesExplained !== true ||
        results.reportSha256 !==
          fileSha(summary, isFull ? 'full-validation-report.md' : 'tests-build-report.md') ||
        (isFull && !SHA256_PATTERN.test(String(results.testsBuildSummarySha256)))
      ) {
        throw new Error(`${summary.kind} did not preserve an exact passed validation report.`)
      }
      return
    }
    case 'merge-readiness-report': {
      exactKeys(
        results,
        [
          'branchClean',
          'compensationAuthorized',
          'criticSummarySha256',
          'deliveryPending',
          'draft',
          'fullValidationSummarySha256',
          'implementationReady',
          'independentReviewRequired',
          'importAuthorized',
          'localV2MigrationApplied',
          'mergeAuthorized',
          'originMainAncestor',
          'packageCanonicalManifestSha256',
          'realLocalCaptureManifestSha256s',
          'realLocalMigrationSeparatelyRequired',
          'reportSha256',
          'testsBuildSummarySha256',
          'unmerged',
        ],
        'Merge-readiness results',
      )
      ;[
        'criticSummarySha256',
        'fullValidationSummarySha256',
        'packageCanonicalManifestSha256',
        'testsBuildSummarySha256',
      ].forEach((key) => sha(results[key], `Merge-readiness ${key}`))
      exactTwoShas(results.realLocalCaptureManifestSha256s, 'Merge-readiness capture manifests')
      if (
        results.branchClean !== true ||
        results.originMainAncestor !== true ||
        results.implementationReady !== true ||
        results.draft !== true ||
        results.unmerged !== true ||
        results.independentReviewRequired !== true ||
        results.mergeAuthorized !== false ||
        results.deliveryPending !== true ||
        results.realLocalMigrationSeparatelyRequired !== true ||
        results.localV2MigrationApplied !== false ||
        results.importAuthorized !== false ||
        results.compensationAuthorized !== false ||
        results.reportSha256 !== fileSha(summary, 'merge-readiness-report.md')
      ) {
        throw new Error('Merge-readiness evidence overclaims execution or is incomplete.')
      }
      return
    }
    case 'same-user-recomputation-evidence': {
      exactKeys(
        results,
        [
          'captureManifestSha256s',
          'captureReceiptSha256s',
          'honestRecomputationAccepted',
          'maliciousSameUserOutOfScope',
          'maliciousSameUserResistanceClaimed',
          'namedRegressionPassed',
          'reportSha256',
          'separateTrustRootClaimed',
        ],
        'Same-user recomputation results',
      )
      exactTwoShas(results.captureManifestSha256s, 'Same-user capture manifests')
      exactTwoDistinctShas(results.captureReceiptSha256s, 'Same-user capture receipts')
      if (
        results.honestRecomputationAccepted !== true ||
        results.namedRegressionPassed !== true ||
        results.maliciousSameUserResistanceClaimed !== false ||
        results.maliciousSameUserOutOfScope !== true ||
        results.separateTrustRootClaimed !== false ||
        results.reportSha256 !== fileSha(summary, 'same-user-recomputation-report.md')
      ) {
        throw new Error('Same-user recomputation evidence overclaims its trust boundary.')
      }
      return
    }
    case 'sealed-intent-lost-ack-evidence': {
      exactKeys(
        results,
        [
          'applicationResultSha256',
          'backupCaptureCount',
          'backupInstanceIds',
          'compensationAuthorized',
          'finalReceiptSha256',
          'importAuthorized',
          'intentImmutable',
          'intentSealedBeforeStaging',
          'intentSha256',
          'lostAcknowledgementReconciledWithoutReplay',
          'migrationApplicationCallCount',
          'migrationReexecuted',
          'receiptResultCrossBound',
          'reportSha256',
        ],
        'Sealed-intent results',
      )
      exactTwoDistinctStrings(results.backupInstanceIds, 'Sealed-intent backup instance IDs')
      if (
        results.intentSha256 !== fileSha(summary, 'sealed-intent-regression.json') ||
        results.applicationResultSha256 !==
          fileSha(summary, 'application-result-regression.json') ||
        results.finalReceiptSha256 !== fileSha(summary, 'final-receipt-regression.json') ||
        results.reportSha256 !== fileSha(summary, 'sealed-intent-lost-ack-report.md') ||
        results.intentSealedBeforeStaging !== true ||
        results.intentImmutable !== true ||
        results.backupCaptureCount !== 2 ||
        results.receiptResultCrossBound !== true ||
        results.lostAcknowledgementReconciledWithoutReplay !== true ||
        results.migrationApplicationCallCount !== 0 ||
        results.migrationReexecuted !== false ||
        results.importAuthorized !== false ||
        results.compensationAuthorized !== false
      ) {
        throw new Error('Sealed-intent/lost-ack evidence is incomplete or replay-capable.')
      }
      return
    }
    case 'trusted-operator-evidence': {
      exactKeys(
        results,
        [
          'attestation',
          'backupInstanceIds',
          'captureManifestSha256s',
          'captureReceiptSha256s',
          'executionNonces',
          'outputDirectories',
          'reportSha256',
          'sameTrustedOperator',
          'separateTrustRoots',
          'trustModel',
        ],
        'Trusted-operator results',
      )
      exactTwoDistinctStrings(results.backupInstanceIds, 'Trusted-operator instance IDs')
      exactTwoDistinctStrings(results.executionNonces, 'Trusted-operator execution nonces')
      exactTwoDistinctStrings(results.outputDirectories, 'Trusted-operator output directories')
      exactTwoShas(results.captureManifestSha256s, 'Trusted-operator capture manifests')
      exactTwoDistinctShas(results.captureReceiptSha256s, 'Trusted-operator capture receipts')
      if (
        results.trustModel !== GOLD_IMPORT_CONTRACT_V2_TRUST_MODEL ||
        results.attestation !== GOLD_IMPORT_CONTRACT_V2_CAPTURE_ATTESTATION ||
        results.sameTrustedOperator !== true ||
        results.separateTrustRoots !== false ||
        results.reportSha256 !== fileSha(summary, 'trusted-operator-report.md')
      ) {
        throw new Error('Trusted-operator evidence changed or overclaimed the trust model.')
      }
      return
    }
    case 'final-pr-body': {
      exactKeys(
        results,
        [
          'bodySha256',
          'compensationAuthorized',
          'criticSummarySha256',
          'fullValidationSummarySha256',
          'mergeAuthorized',
          'mergeReadinessSummarySha256',
          'packageExecutionAuthorized',
          'packageCanonicalManifestSha256',
          'prFacts',
          'realLocalCaptureManifestSha256s',
          'realLocalCaptureReceiptSha256s',
          'terminalState',
          'testsBuildSummarySha256',
        ],
        'Final PR-body results',
      )
      const facts = record(results.prFacts, 'Final PR facts')
      exactKeys(
        facts,
        [
          'base',
          'draft',
          'expectedRemoteHeadSha',
          'headBranch',
          'open',
          'remoteHeadVerificationDeferred',
          'unmerged',
        ],
        'Final PR facts',
      )
      ;[
        'criticSummarySha256',
        'fullValidationSummarySha256',
        'mergeReadinessSummarySha256',
        'packageCanonicalManifestSha256',
        'testsBuildSummarySha256',
      ].forEach((key) => sha(results[key], `Final PR-body ${key}`))
      exactTwoShas(results.realLocalCaptureManifestSha256s, 'Final PR-body capture manifests')
      exactTwoDistinctShas(results.realLocalCaptureReceiptSha256s, 'Final PR-body capture receipts')
      if (
        results.bodySha256 !== fileSha(summary, 'final-pr-body.md') ||
        facts.base !== 'main' ||
        facts.draft !== true ||
        facts.open !== true ||
        facts.unmerged !== true ||
        facts.headBranch !== summary.repository.branch ||
        facts.expectedRemoteHeadSha !== summary.repository.head ||
        facts.remoteHeadVerificationDeferred !== true ||
        results.terminalState !==
          'implementation_ready_real_local_v2_migration_separately_required' ||
        results.mergeAuthorized !== false ||
        results.packageExecutionAuthorized !== false ||
        results.compensationAuthorized !== false
      ) {
        throw new Error('Final PR-body evidence changed draft/open/no-execution state.')
      }
      return
    }
  }
}

function expectedScope(
  kind: GoldImportContractV2Phase10EvidenceName,
): GoldImportContractV2Phase10EvidenceSummary['scope'] {
  if (
    [
      'descendant-recovery-evidence',
      'same-user-recomputation-evidence',
      'sealed-intent-lost-ack-evidence',
    ].includes(kind)
  ) {
    return 'synthetic_regression'
  }
  if (kind === 'critic-report') return 'read_only_review'
  if (kind === 'trusted-operator-evidence') return 'read_only_evidence'
  if (kind === 'final-pr-body' || kind === 'merge-readiness-report') return 'draft_pr_delivery'
  return 'validation'
}

function validateContext(context: GoldImportContractV2Phase10EvidenceContext): void {
  commit(context.repository.head, 'Phase-10 final HEAD')
  commit(context.repository.originMain, 'Phase-10 origin/main HEAD')
  if (!context.repository.branch) throw new Error('Phase-10 repository branch is absent.')
  sha(
    context.authorization.localExpectedCatalogBindingSha256,
    'Phase-10 local expected-catalog binding',
  )
  sha(
    context.authorization.disposableExpectedCatalogBindingSha256,
    'Phase-10 disposable expected-catalog binding',
  )
  sha(context.authorization.protectedRuntimeBundleBindingSha256, 'Phase-10 runtime-bundle binding')
}

function buildFileInventory(input: {
  files: ReadonlyMap<string, Uint8Array>
  kind: GoldImportContractV2Phase10EvidenceName
  sha256Bytes: (value: Uint8Array) => string
}): EvidenceFileIdentity[] {
  if (input.files.has(SUMMARY_FILE_NAME)) {
    throw new Error('Phase-10 summary cannot checksum itself.')
  }
  const inventory = [...input.files.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([path, bytes]) => {
      if (
        !SAFE_PATH_PATTERN.test(path) ||
        path.startsWith('/') ||
        path.includes('\\') ||
        path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
      ) {
        throw new Error(`Phase-10 companion path is unsafe: ${path}.`)
      }
      const digest = input.sha256Bytes(bytes)
      sha(digest, `Phase-10 companion ${path}`)
      return { bytes: bytes.byteLength, path, sha256: digest }
    })
  for (const required of REQUIRED_COMPANION_FILES[input.kind]) {
    if (!inventory.some(({ path }) => path === required)) {
      throw new Error(`Phase-10 ${input.kind} omitted required companion ${required}.`)
    }
  }
  return inventory
}

export function buildGoldImportContractV2Phase10EvidenceSummary(input: {
  context: GoldImportContractV2Phase10EvidenceContext
  files: ReadonlyMap<string, Uint8Array>
  kind: GoldImportContractV2Phase10EvidenceName
  results: Record<string, unknown>
  sha256Bytes: (value: Uint8Array) => string
}): GoldImportContractV2Phase10EvidenceSummary {
  validateContext(input.context)
  const summary: GoldImportContractV2Phase10EvidenceSummary = {
    authorization: canonicalClone(input.context.authorization),
    files: buildFileInventory(input),
    kind: input.kind,
    repository: canonicalClone(input.context.repository),
    results: canonicalClone(input.results),
    safety: {
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      realCompensationExecuted: false,
      realImportExecuted: false,
      realLocalV2Applied: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_SCHEMA_VERSION,
    scope: expectedScope(input.kind),
    status: 'passed',
  }
  validateResults(summary)
  if (input.kind === 'sealed-intent-lost-ack-evidence') {
    validateSealedIntentCompanions({
      files: input.files,
      sha256Bytes: input.sha256Bytes,
      summary,
    })
  }
  return deepFreeze(canonicalClone(summary))
}

export function validateGoldImportContractV2Phase10EvidenceSummary(input: {
  context: GoldImportContractV2Phase10EvidenceContext
  files: ReadonlyMap<string, Uint8Array>
  kind: GoldImportContractV2Phase10EvidenceName
  sha256Bytes: (value: Uint8Array) => string
  summary: unknown
}): GoldImportContractV2Phase10EvidenceSummary {
  const source = record(input.summary, `Phase-10 ${input.kind} summary`)
  exactKeys(
    source,
    [
      'authorization',
      'files',
      'kind',
      'repository',
      'results',
      'safety',
      'schemaVersion',
      'scope',
      'status',
    ],
    `Phase-10 ${input.kind} summary`,
  )
  const authorization = record(source.authorization, `Phase-10 ${input.kind} authorization`)
  const repository = record(source.repository, `Phase-10 ${input.kind} repository`)
  const safety = record(source.safety, `Phase-10 ${input.kind} safety`)
  exactKeys(
    authorization,
    [
      'disposableExpectedCatalogBindingSha256',
      'localExpectedCatalogBindingSha256',
      'protectedRuntimeBundleBindingSha256',
    ],
    `Phase-10 ${input.kind} authorization`,
  )
  exactKeys(repository, ['branch', 'head', 'originMain'], `Phase-10 ${input.kind} repository`)
  exactKeys(
    safety,
    [
      'databaseAccessed',
      'databaseMutationCount',
      'heldOutIdentitiesAccessed',
      'realCompensationExecuted',
      'realImportExecuted',
      'realLocalV2Applied',
      'remoteDatabaseAccessed',
    ],
    `Phase-10 ${input.kind} safety`,
  )
  if (
    source.schemaVersion !== GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_SCHEMA_VERSION ||
    source.kind !== input.kind ||
    source.scope !== expectedScope(input.kind) ||
    source.status !== 'passed' ||
    canonicalJson(authorization) !== canonicalJson(input.context.authorization) ||
    canonicalJson(repository) !== canonicalJson(input.context.repository) ||
    safety.databaseAccessed !== false ||
    safety.databaseMutationCount !== 0 ||
    safety.heldOutIdentitiesAccessed !== false ||
    safety.realCompensationExecuted !== false ||
    safety.realImportExecuted !== false ||
    safety.realLocalV2Applied !== false ||
    safety.remoteDatabaseAccessed !== false
  ) {
    throw new Error(`Phase-10 ${input.kind} summary is stale, failed, or unsafe.`)
  }
  const companionFiles = new Map(input.files)
  companionFiles.delete(SUMMARY_FILE_NAME)
  const rebuilt = buildGoldImportContractV2Phase10EvidenceSummary({
    context: input.context,
    files: companionFiles,
    kind: input.kind,
    results: record(source.results, `Phase-10 ${input.kind} results`),
    sha256Bytes: input.sha256Bytes,
  })
  if (canonicalJson(source) !== canonicalJson(rebuilt)) {
    throw new Error(`Phase-10 ${input.kind} summary or companion inventory drifted.`)
  }
  return rebuilt
}

export function serializeGoldImportContractV2Phase10EvidenceSummary(
  summary: GoldImportContractV2Phase10EvidenceSummary,
): string {
  return `${JSON.stringify(canonicalValue(summary), null, 2)}\n`
}

export function isGoldImportContractV2Phase10EvidenceName(
  value: string,
): value is GoldImportContractV2Phase10EvidenceName {
  return GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES.some((name) => name === value)
}
