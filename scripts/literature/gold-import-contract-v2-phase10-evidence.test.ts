import { createHash } from 'node:crypto'

import {
  GOLD_IMPORT_CONTRACT_V2_CAPTURE_ATTESTATION,
  GOLD_IMPORT_CONTRACT_V2_FULL_VALIDATION_CHECK_IDS,
  GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES,
  GOLD_IMPORT_CONTRACT_V2_TESTS_BUILD_CHECK_IDS,
  GOLD_IMPORT_CONTRACT_V2_TRUST_MODEL,
  buildGoldImportContractV2Phase10EvidenceSummary,
  serializeGoldImportContractV2Phase10EvidenceSummary,
  validateGoldImportContractV2Phase10EvidenceSummary,
  type GoldImportContractV2Phase10EvidenceContext,
  type GoldImportContractV2Phase10EvidenceName,
} from './gold-import-contract-v2-phase10-evidence'

const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')
const sha = (character: string) => character.repeat(64)

const context: GoldImportContractV2Phase10EvidenceContext = {
  authorization: {
    disposableExpectedCatalogBindingSha256: sha('a'),
    localExpectedCatalogBindingSha256: sha('b'),
    protectedRuntimeBundleBindingSha256: sha('c'),
  },
  repository: {
    branch: 'codex/ip-lit-v2-final',
    head: 'd'.repeat(40),
    originMain: 'e'.repeat(40),
  },
}

const reportFiles: Readonly<Record<GoldImportContractV2Phase10EvidenceName, string[]>> = {
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
}

function filesFor(kind: GoldImportContractV2Phase10EvidenceName): Map<string, Buffer> {
  const files = new Map(
    reportFiles[kind].map((name) => [name, Buffer.from(`${kind}/${name}\n`, 'utf8')]),
  )
  if (kind === 'sealed-intent-lost-ack-evidence') {
    const common = {
      authorization: context.authorization,
      repository: context.repository,
      scope: 'synthetic_regression',
      status: 'passed',
    }
    const intent = Buffer.from(
      `${JSON.stringify({
        ...common,
        immutable: true,
        schemaVersion: 'gold-import-contract-v2-sealed-intent-regression/1.0.0',
        sealedBeforeStaging: true,
      })}\n`,
      'utf8',
    )
    const result = Buffer.from(
      `${JSON.stringify({
        ...common,
        compensationAuthorized: false,
        importAuthorized: false,
        intentSha256: sha256(intent),
        migrationApplicationCallCount: 0,
        migrationReexecuted: false,
        schemaVersion: 'gold-import-contract-v2-application-result-regression/1.0.0',
      })}\n`,
      'utf8',
    )
    const receipt = Buffer.from(
      `${JSON.stringify({
        ...common,
        applicationResultSha256: sha256(result),
        compensationAuthorized: false,
        importAuthorized: false,
        intentSha256: sha256(intent),
        lostAcknowledgementReconciledWithoutReplay: true,
        migrationApplicationCallCount: 0,
        migrationReexecuted: false,
        receiptResultCrossBound: true,
        schemaVersion: 'gold-import-contract-v2-final-receipt-regression/1.0.0',
      })}\n`,
      'utf8',
    )
    files.set('sealed-intent-regression.json', intent)
    files.set('application-result-regression.json', result)
    files.set('final-receipt-regression.json', receipt)
  }
  return files
}

function digest(files: ReadonlyMap<string, Buffer>, name: string): string {
  return sha256(files.get(name)!)
}

function checks(ids: readonly string[]) {
  return ids.map((id) => ({ exitCode: 0, id, status: 'passed' }))
}

function resultsFor(
  kind: GoldImportContractV2Phase10EvidenceName,
  files: ReadonlyMap<string, Buffer>,
): Record<string, unknown> {
  switch (kind) {
    case 'critic-report':
      return {
        confirmedFindingCount: 0,
        questionResults: Array.from({ length: 14 }, (_value, index) => ({
          id: index + 1,
          passed: true,
        })),
        reportSha256: digest(files, 'critic-report.md'),
        terminal: 'CRITIC PASS — NO CONFIRMED BLOCKER',
      }
    case 'descendant-recovery-evidence':
      return {
        currentHeadEqualsOriginMain: true,
        databaseV2Occurrence: 1,
        documentationOnlyDescendantReconciled: true,
        exactExpectedArtifactsPreserved: true,
        exactLocalCatalogPassed: true,
        expectedArtifactDriftRejected: true,
        fullProtectedBundlePreserved: true,
        historiesDivergent: false,
        intentCommitIsAncestor: true,
        migrationApplicationCallCount: 0,
        migrationReexecuted: false,
        migrationVerifierBytesPreserved: true,
        protectedSourceDriftRejected: true,
        reportSha256: digest(files, 'descendant-recovery-report.md'),
        schemaOnlyClinicalStateUnchanged: true,
        supabaseConfigDriftRejected: true,
        tsconfigDriftRejected: true,
      }
    case 'tests-build-report':
      return {
        checks: checks(GOLD_IMPORT_CONTRACT_V2_TESTS_BUILD_CHECK_IDS),
        reportSha256: digest(files, 'tests-build-report.md'),
        testCountChangesExplained: true,
      }
    case 'full-validation-report':
      return {
        checks: checks(GOLD_IMPORT_CONTRACT_V2_FULL_VALIDATION_CHECK_IDS),
        reportSha256: digest(files, 'full-validation-report.md'),
        testCountChangesExplained: true,
        testsBuildSummarySha256: sha('1'),
      }
    case 'merge-readiness-report':
      return {
        branchClean: true,
        compensationAuthorized: false,
        criticSummarySha256: sha('2'),
        deliveryPending: true,
        draft: true,
        fullValidationSummarySha256: sha('3'),
        implementationReady: true,
        independentReviewRequired: true,
        importAuthorized: false,
        localV2MigrationApplied: false,
        mergeAuthorized: false,
        originMainAncestor: true,
        packageCanonicalManifestSha256: sha('4'),
        realLocalCaptureManifestSha256s: [sha('5'), sha('5')],
        realLocalMigrationSeparatelyRequired: true,
        reportSha256: digest(files, 'merge-readiness-report.md'),
        testsBuildSummarySha256: sha('1'),
        unmerged: true,
      }
    case 'same-user-recomputation-evidence':
      return {
        captureManifestSha256s: [sha('5'), sha('5')],
        captureReceiptSha256s: [sha('6'), sha('7')],
        honestRecomputationAccepted: true,
        maliciousSameUserOutOfScope: true,
        maliciousSameUserResistanceClaimed: false,
        namedRegressionPassed: true,
        reportSha256: digest(files, 'same-user-recomputation-report.md'),
        separateTrustRootClaimed: false,
      }
    case 'sealed-intent-lost-ack-evidence':
      return {
        applicationResultSha256: digest(files, 'application-result-regression.json'),
        backupCaptureCount: 2,
        backupInstanceIds: ['capture-a', 'capture-b'],
        compensationAuthorized: false,
        finalReceiptSha256: digest(files, 'final-receipt-regression.json'),
        importAuthorized: false,
        intentImmutable: true,
        intentSealedBeforeStaging: true,
        intentSha256: digest(files, 'sealed-intent-regression.json'),
        lostAcknowledgementReconciledWithoutReplay: true,
        migrationApplicationCallCount: 0,
        migrationReexecuted: false,
        receiptResultCrossBound: true,
        reportSha256: digest(files, 'sealed-intent-lost-ack-report.md'),
      }
    case 'trusted-operator-evidence':
      return {
        attestation: GOLD_IMPORT_CONTRACT_V2_CAPTURE_ATTESTATION,
        backupInstanceIds: ['capture-a', 'capture-b'],
        captureManifestSha256s: [sha('5'), sha('5')],
        captureReceiptSha256s: [sha('6'), sha('7')],
        executionNonces: ['nonce-a', 'nonce-b'],
        outputDirectories: ['/capture/a', '/capture/b'],
        reportSha256: digest(files, 'trusted-operator-report.md'),
        sameTrustedOperator: true,
        separateTrustRoots: false,
        trustModel: GOLD_IMPORT_CONTRACT_V2_TRUST_MODEL,
      }
    case 'final-pr-body':
      return {
        bodySha256: digest(files, 'final-pr-body.md'),
        compensationAuthorized: false,
        criticSummarySha256: sha('2'),
        fullValidationSummarySha256: sha('3'),
        mergeAuthorized: false,
        mergeReadinessSummarySha256: sha('8'),
        packageExecutionAuthorized: false,
        packageCanonicalManifestSha256: sha('4'),
        prFacts: {
          base: 'main',
          draft: true,
          expectedRemoteHeadSha: context.repository.head,
          headBranch: context.repository.branch,
          open: true,
          remoteHeadVerificationDeferred: true,
          unmerged: true,
        },
        realLocalCaptureManifestSha256s: [sha('5'), sha('5')],
        realLocalCaptureReceiptSha256s: [sha('6'), sha('7')],
        terminalState: 'implementation_ready_real_local_v2_migration_separately_required',
        testsBuildSummarySha256: sha('1'),
      }
  }
}

function built(kind: GoldImportContractV2Phase10EvidenceName) {
  const files = filesFor(kind)
  const summary = buildGoldImportContractV2Phase10EvidenceSummary({
    context,
    files,
    kind,
    results: resultsFor(kind, files),
    sha256Bytes: sha256,
  })
  return { files, summary }
}

describe('gold import contract V2 Phase-10 evidence summaries', () => {
  it.each(GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES)(
    'builds and validates a frozen canonical %s summary',
    (kind) => {
      const { files, summary } = built(kind)
      const serialized = serializeGoldImportContractV2Phase10EvidenceSummary(summary)
      const validationFiles = new Map(files)
      validationFiles.set('evidence-summary.json', Buffer.from(serialized, 'utf8'))
      const validated = validateGoldImportContractV2Phase10EvidenceSummary({
        context,
        files: validationFiles,
        kind,
        sha256Bytes: sha256,
        summary: JSON.parse(serialized),
      })
      expect(validated).toEqual(summary)
      expect(Object.isFrozen(validated)).toBe(true)
      expect(Object.isFrozen(validated.files)).toBe(true)
      expect(Object.isFrozen(validated.results)).toBe(true)
    },
  )

  it.each([
    ['placeholder', () => ({})],
    ['wrong group', (summary: Record<string, unknown>) => ({ ...summary, kind: 'final-pr-body' })],
    [
      'wrong final HEAD',
      (summary: Record<string, unknown>) => ({
        ...summary,
        repository: { ...context.repository, head: 'f'.repeat(40) },
      }),
    ],
    [
      'wrong exact binding',
      (summary: Record<string, unknown>) => ({
        ...summary,
        authorization: {
          ...context.authorization,
          localExpectedCatalogBindingSha256: sha('9'),
        },
      }),
    ],
    [
      'failed safety claim',
      (summary: Record<string, unknown>) => ({
        ...summary,
        safety: {
          databaseAccessed: false,
          databaseMutationCount: 0,
          heldOutIdentitiesAccessed: false,
          realCompensationExecuted: false,
          realImportExecuted: false,
          realLocalV2Applied: true,
          remoteDatabaseAccessed: false,
        },
      }),
    ],
  ])('rejects a %s summary', (_label, mutate) => {
    const { files, summary } = built('critic-report')
    const invalid = mutate({ ...summary })
    const validationFiles = new Map(files)
    validationFiles.set(
      'evidence-summary.json',
      Buffer.from(`${JSON.stringify(invalid, null, 2)}\n`, 'utf8'),
    )
    expect(() =>
      validateGoldImportContractV2Phase10EvidenceSummary({
        context,
        files: validationFiles,
        kind: 'critic-report',
        sha256Bytes: sha256,
        summary: invalid,
      }),
    ).toThrow()
  })
})
