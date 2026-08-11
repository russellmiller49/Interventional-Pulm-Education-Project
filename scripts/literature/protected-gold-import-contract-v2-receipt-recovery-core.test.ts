/** @jest-environment node */

import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import {
  PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_SCHEMA_VERSION,
  PROTECTED_V2_RECEIPT_RECOVERY_DEFECT,
  PROTECTED_V2_RECEIPT_RECOVERY_HISTORICAL_INTENT_SHA256,
  PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES,
  PROTECTED_V2_RECEIPT_RECOVERY_REASON,
  PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256,
  buildProtectedV2ReceiptRecoveryAmendment,
  buildProtectedV2ReceiptRecoveryBundle,
  buildProtectedV2ReceiptRecoveryIncidentAmendment,
  canonicalProtectedV2ReceiptRecoveryJson,
  protectedV2ReceiptRecoverySha256,
  type ProtectedV2ReceiptRecoveryAmendmentContent,
  type ProtectedV2ReceiptRecoveryCaptureAuthority,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import {
  assertProtectedV2FinalizedRecoveryReceiptGate,
  loadProtectedV2FinalizedReceiptRecovery,
  parseProtectedV2ReceiptRecoveryExecutionReceipt,
  parseProtectedV2ReceiptRecoveryHistoricalCaptureExecution,
  parseProtectedV2ReceiptRecoveryResult,
  recoverProtectedV2HistoricalReceipt,
  type ProtectedV2ReceiptRecoveryCapturePackage,
  type ProtectedV2ReceiptRecoveryInput,
  type ProtectedV2ReceiptRecoveryTransitionProof,
} from './protected-gold-import-contract-v2-receipt-recovery-core'

function sha(value: string): string {
  return protectedV2ReceiptRecoverySha256(value)
}

const sourceIdentities = {
  v1MigrationSha256: sha('v1 migration'),
  v2MigrationSha256: sha('v2 migration'),
  v2VerifierSha256: sha('v2 verifier'),
}

const preState = {
  developmentMembershipSha256: sha('membership'),
  effectiveV1Sha256: sha('effective v1'),
  physicalV1Sha256: sha('physical v1 before'),
  planningSha256: sha('planning'),
  schemaNeutralHistorySha256: sha('neutral history'),
}

const postState = {
  developmentMembershipSha256: preState.developmentMembershipSha256,
  effectiveV1Sha256: preState.effectiveV1Sha256,
  effectiveV2Sha256: sha('effective v2'),
  eventStateSha256: sha('events'),
  physicalV1Sha256: sha('physical v1 schema-derived after'),
  physicalV2Sha256: sha('physical v2'),
  planningSha256: preState.planningSha256,
  pointerStateSha256: sha('pointers'),
  revealStateSha256: sha('reveals'),
  reviewStateSha256: sha('reviews'),
  schemaNeutralHistorySha256: preState.schemaNeutralHistorySha256,
}

interface Fixture {
  cleanup: () => Promise<void>
  input: ProtectedV2ReceiptRecoveryInput
  proof: ProtectedV2ReceiptRecoveryTransitionProof
  root: string
}

async function buildCapture(input: {
  batchId: string
  index: number
  repositoryHead: string
}): Promise<{
  authority: ProtectedV2ReceiptRecoveryCaptureAuthority
  capture: ProtectedV2ReceiptRecoveryCapturePackage
}> {
  const canonicalFiles = {
    'development-database-seed.json': canonicalProtectedV2ReceiptRecoveryJson({
      fixture: `seed-${input.index}`,
    }),
    'pre-application-report.json': canonicalProtectedV2ReceiptRecoveryJson({
      fixture: `report-${input.index}`,
    }),
    'pre-application-report.md': `# capture ${input.index}\n`,
    'protected-migration-ledger.json': canonicalProtectedV2ReceiptRecoveryJson({
      fixture: `ledger-${input.index}`,
    }),
    'state-hashes.json': canonicalProtectedV2ReceiptRecoveryJson({
      fixture: `state-${input.index}`,
    }),
  }
  const manifest = Object.entries(canonicalFiles)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, bytes]) => `${sha(bytes)}  ${name}\n`)
    .join('')
  const backupInstanceId = sha(`backup ${input.index}`)
  const executionNonce = sha(`nonce ${input.index}`)
  const executionContent = {
    backupInstanceId,
    backupRoot: '/fixture',
    canonicalManifestSha256: sha(manifest),
    database: {
      batchId: input.batchId,
      datasetSplit: 'development',
      developmentMembershipSha256: preState.developmentMembershipSha256,
      developmentPlanningStateSha256: preState.planningSha256,
      effectiveStateSha256: preState.effectiveV1Sha256,
      physicalStateSha256: preState.physicalV1Sha256,
    },
    executedAt: `2026-08-11T04:03:4${input.index}.000Z`,
    executionNonce,
    expectedCatalog: { fixture: 'catalog' },
    migrationLedger: {
      sha256: sha('ledger'),
      v1: {
        filename: 'v1.sql',
        migrationName: 'v1',
        occurrence: 1,
        sha256: sourceIdentities.v1MigrationSha256,
        version: '1',
      },
      v2: {
        filename: 'v2.sql',
        id: 'v2',
        migrationName: 'v2',
        occurrence: 0,
        sha256: sourceIdentities.v2MigrationSha256,
        version: '2',
      },
    },
    operatorBundleBinding: { fixture: 'old bundle binding' },
    outputDirectory: `/fixture/capture-${input.index}`,
    repositoryCommitSha: input.repositoryHead,
    safety: {
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: 'gold-import-contract-v2-preapplication-execution/2.0.0',
  }
  const execution = canonicalProtectedV2ReceiptRecoveryJson({
    ...executionContent,
    contentSha256: sha(canonicalProtectedV2ReceiptRecoveryJson(executionContent)),
  })
  const declaredDirectory = `/fixture/capture-${input.index}`
  return {
    authority: {
      backupInstanceId,
      canonicalManifestSha256: sha(manifest),
      directory: declaredDirectory,
      executionNonce,
      executionReceiptSha256: sha(execution),
    },
    capture: {
      declaredDirectory,
      files: {
        'checksum-manifest.sha256': manifest,
        ...canonicalFiles,
        'execution-receipt.json': execution,
      },
    },
  }
}

async function fixture(): Promise<Fixture> {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'protected-v2-receipt-recovery-')))
  const outputDirectory = resolve(root, 'application-output')
  await mkdir(outputDirectory)
  const batchId = '11111111-1111-4111-8111-111111111111'
  const repositoryHead = '1234567890abcdef1234567890abcdef12345678'
  const policyIdentity = sha('shared transition policy')
  const currentRecoveryToolBundle = buildProtectedV2ReceiptRecoveryBundle([
    {
      gitMode: '100644',
      path: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
      sha256: sha('reviewed core bytes'),
    },
    {
      gitMode: '100644',
      path: 'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
      sha256: sha('reviewed cli bytes'),
    },
  ])
  const historicalOperatorBundle = {
    aggregateSha256: sha('old aggregate'),
    files: [{ gitMode: '100644', path: 'old-operator.ts', sha256: sha('old bytes') }],
    fixture: 'exact historical tree bundle',
  }
  const oldBundleBinding = {
    bindingSha256: sha('old binding'),
    runtimeInputDeclarationSha256: sha('old declaration'),
    trackedFileCount: 1,
    trackedFileInventorySha256: sha('old inventory'),
  }
  const catalog = {
    auditIdentitySha256: sha('full audit'),
    bindingSha256: sha('catalog binding'),
    fullAuditIdentitySha256: sha('full audit'),
  }
  const [capture1, capture2] = await Promise.all([
    buildCapture({ batchId, index: 1, repositoryHead }),
    buildCapture({ batchId, index: 2, repositoryHead }),
  ])
  const authorizationContent = {
    authorizedCapability: 'apply_protected_contract_v2_migration_exactly_once',
    confirmation: 'EXACT FIXTURE CONFIRMATION',
    context: { fixture: true },
    operator: 'fixture-operator',
    requestedAt: '2026-08-11T04:06:16.474Z',
    separateCaptureAttestation: 'EXACT FIXTURE CAPTURE ATTESTATION',
  }
  const authorization = {
    ...authorizationContent,
    contentSha256: sha(canonicalProtectedV2ReceiptRecoveryJson(authorizationContent)),
  }
  const authorizationBytes = canonicalProtectedV2ReceiptRecoveryJson(authorization)
  const intent = {
    authorization,
    authorizationSha256: authorization.contentSha256,
    authorizedCapability: 'apply_protected_contract_v2_migration_exactly_once',
    backupInstances: [capture1.authority, capture2.authority],
    before: {
      batchId,
      developmentMembershipSha256: preState.developmentMembershipSha256,
      developmentPlanningStateSha256: preState.planningSha256,
      effectiveStateSha256: preState.effectiveV1Sha256,
      physicalStateSha256: preState.physicalV1Sha256,
      v1Occurrence: 1,
      v2Occurrence: 0,
    },
    confirmation: authorizationContent.confirmation,
    createdAt: authorizationContent.requestedAt,
    expectedCatalog: {
      bindingSha256: catalog.bindingSha256,
      fullAuditIdentitySha256: catalog.fullAuditIdentitySha256,
    },
    migration: { sha256: sourceIdentities.v2MigrationSha256 },
    operator: authorizationContent.operator,
    operatorBundle: historicalOperatorBundle,
    operatorBundleBinding: {
      aggregateSha256: historicalOperatorBundle.aggregateSha256,
      ...oldBundleBinding,
    },
    outputDirectory,
    repository: {
      branch: 'main',
      head: repositoryHead,
      operatorBundle: historicalOperatorBundle,
      operatorBundleBinding: {
        aggregateSha256: historicalOperatorBundle.aggregateSha256,
        ...oldBundleBinding,
      },
      originMain: repositoryHead,
      statusCleanIncludingUntracked: true,
    },
    safety: {
      compensationAuthorized: false,
      finalReceiptComplete: false,
      importAuthorized: false,
      migrationApplied: false,
    },
    schemaVersion: 'literature-gold-protected-v2-application-intent/2.0.0',
    separateCaptureAttestation: authorizationContent.separateCaptureAttestation,
    state: 'application_intent_sealed',
  }
  const intentBytes = canonicalProtectedV2ReceiptRecoveryJson(intent)
  const intentMarkdown = '# fixture historical intent\n'
  const intentManifest = [
    `${sha(intentBytes)}  application-intent.json\n`,
    `${sha(intentMarkdown)}  application-intent.md\n`,
  ].join('')
  await Promise.all([
    writeFile(resolve(outputDirectory, 'application-intent.json'), intentBytes),
    writeFile(resolve(outputDirectory, 'application-intent.md'), intentMarkdown),
    writeFile(resolve(outputDirectory, 'intent-checksum-manifest.sha256'), intentManifest),
  ])
  const incidentEvidenceFiles = {
    'evidence/catalog.json': canonicalProtectedV2ReceiptRecoveryJson({ catalog: 'exact' }),
    'evidence/diagnostic.json': canonicalProtectedV2ReceiptRecoveryJson({ diagnostic: 'exact' }),
  }
  const amendmentContent: ProtectedV2ReceiptRecoveryAmendmentContent = {
    correctedRecoveryToolBundle: currentRecoveryToolBundle,
    correctedTransitionPolicyIdentitySha256: policyIdentity,
    defectIdentifier: PROTECTED_V2_RECEIPT_RECOVERY_DEFECT,
    expectedCatalog: {
      bindingSha256: catalog.bindingSha256,
      fullAuditIdentitySha256: catalog.fullAuditIdentitySha256,
    },
    historicalIncident: {
      authorizationContentSha256: authorization.contentSha256,
      authorizationFileSha256: sha(authorizationBytes),
      backupCaptures: [capture1.authority, capture2.authority],
      confirmation: authorizationContent.confirmation,
      incidentEvidenceRoot: '/fixture/immutable-incident-copy',
      incidentEvidenceSha256: Object.fromEntries(
        Object.entries(incidentEvidenceFiles).map(([path, bytes]) => [path, sha(bytes)]),
      ),
      intentCreatedAt: authorizationContent.requestedAt,
      intentManifestSha256: sha(intentManifest),
      intentMarkdownSha256: sha(intentMarkdown),
      intentOutputDirectory: outputDirectory,
      intentSha256: sha(intentBytes),
      operatorIdentity: authorizationContent.operator,
      repositoryHead,
      separateCaptureAttestation: authorizationContent.separateCaptureAttestation,
    },
    historicalOperatorBundle: {
      aggregateSha256: historicalOperatorBundle.aggregateSha256,
      bindingSha256: oldBundleBinding.bindingSha256,
      runtimeInputDeclarationSha256: oldBundleBinding.runtimeInputDeclarationSha256,
      trackedFileCount: oldBundleBinding.trackedFileCount,
      trackedFileInventorySha256: oldBundleBinding.trackedFileInventorySha256,
    },
    permittedHistoricalIntentSchemaVersions: [
      'literature-gold-protected-v2-application-intent/2.0.0',
    ],
    permittedReason: PROTECTED_V2_RECEIPT_RECOVERY_REASON,
    pinnedSources: sourceIdentities,
    prohibitedCapabilities: PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES,
    schemaVersion: PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_SCHEMA_VERSION,
    stateAuthority: { batchId, post: postState, pre: preState },
  }
  const amendment = buildProtectedV2ReceiptRecoveryAmendment(amendmentContent)
  const mutationEvidence = {
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
  const proof: ProtectedV2ReceiptRecoveryTransitionProof = {
    accepted: true,
    batchId,
    migration: {
      v1MigrationSha256: sourceIdentities.v1MigrationSha256,
      v1OccurrenceAfter: 1,
      v1OccurrenceBefore: 1,
      v2MigrationSha256: sourceIdentities.v2MigrationSha256,
      v2OccurrenceAfter: 1,
      v2OccurrenceBefore: 0,
      v2VerifierSha256: sourceIdentities.v2VerifierSha256,
    },
    post: {
      catalogAuditIdentitySha256: catalog.auditIdentitySha256,
      effectiveStateSha256V2: postState.effectiveV2Sha256,
      expectedSchemaDerivedPhysicalStateSha256V1: postState.physicalV1Sha256,
      physicalStateSha256V1: postState.physicalV1Sha256,
      physicalStateSha256V2: postState.physicalV2Sha256,
      schemaNeutralHistorySha256: postState.schemaNeutralHistorySha256,
    },
    pre: {
      physicalStateSha256V1: preState.physicalV1Sha256,
      schemaNeutralHistorySha256: preState.schemaNeutralHistorySha256,
    },
    reasonCode: PROTECTED_V2_RECEIPT_RECOVERY_REASON,
    schemaVersion: 'fixture-shared-transition-proof/1.0.0',
    sourceAuthorizationSha256: authorization.contentSha256,
    transitionPolicyIdentitySha256: policyIdentity,
    zeroMutationEvidence: mutationEvidence,
  }
  const input: ProtectedV2ReceiptRecoveryInput = {
    amendment,
    applicationOutputDirectory: outputDirectory,
    authorizationBytes,
    captures: [capture1.capture, capture2.capture],
    currentRecoveryToolBundle,
    expectedAmendmentIdentitySha256: amendment.amendmentIdentitySha256,
    historicalOperatorBundle,
    incidentEvidenceFiles,
    postEvidence: {
      catalog,
      ledger: {
        v1MigrationSha256: sourceIdentities.v1MigrationSha256,
        v1Occurrence: 1,
        v2MigrationSha256: sourceIdentities.v2MigrationSha256,
        v2Occurrence: 1,
        v2VerifierSha256: sourceIdentities.v2VerifierSha256,
      },
      mutationEvidence,
      safety: {
        contradictoryPartialFinalization: false,
        finalizedAbsentAtEvidenceCollection: true,
        heldOutIdentitiesAccessed: false,
        originalCapturesModified: false,
        originalIntentModified: false,
        readOnly: true,
        remoteDatabaseAccessed: false,
        repeatableRead: true,
      },
      state: postState,
    },
    recoveryRepository: {
      branch: 'main',
      head: 'abcdef1234567890abcdef1234567890abcdef12',
      intentCommitIsAncestor: true,
      originMain: 'abcdef1234567890abcdef1234567890abcdef12',
      primaryCheckout: true,
      statusCleanIncludingUntracked: true,
    },
    transitionInput: { fixture: 'shared validator input' },
  }
  return {
    cleanup: () => rm(root, { force: true, recursive: true }),
    input,
    proof,
    root,
  }
}

function cloneInput(value: ProtectedV2ReceiptRecoveryInput): ProtectedV2ReceiptRecoveryInput {
  return structuredClone(value)
}

describe('protected V2 historical receipt recovery core', () => {
  const cleanup: Array<() => Promise<void>> = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((fn) => fn()))
  })

  async function setup(): Promise<Fixture> {
    const built = await fixture()
    cleanup.push(built.cleanup)
    return built
  }

  it('builds the incident amendment deterministically and rejects another policy', () => {
    const bundle = buildProtectedV2ReceiptRecoveryBundle([
      {
        gitMode: '100644',
        path: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
        sha256: sha('core'),
      },
      {
        gitMode: '100644',
        path: 'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
        sha256: sha('cli'),
      },
    ])
    const first = buildProtectedV2ReceiptRecoveryIncidentAmendment({
      correctedRecoveryToolBundle: bundle,
      correctedTransitionPolicyIdentitySha256:
        PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256,
    })
    const repeated = buildProtectedV2ReceiptRecoveryIncidentAmendment({
      correctedRecoveryToolBundle: bundle,
      correctedTransitionPolicyIdentitySha256:
        PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256,
    })
    expect(repeated).toEqual(first)
    expect(first.historicalIncident.intentSha256).toBe(
      PROTECTED_V2_RECEIPT_RECOVERY_HISTORICAL_INTENT_SHA256,
    )
    expect(() =>
      buildProtectedV2ReceiptRecoveryIncidentAmendment({
        correctedRecoveryToolBundle: bundle,
        correctedTransitionPolicyIdentitySha256: sha('different policy'),
      }),
    ).toThrow('reviewed shared transition-policy identity')
  })

  it('reproduces the old physical-equality failure, then finalizes with no replay capability', async () => {
    const built = await setup()
    const calls = { apply: 0, compensate: 0, import: 0, stage: 0, transition: 0 }
    const reproduceOldOperator = () => {
      calls.apply += 1
      if (preState.physicalV1Sha256 !== postState.physicalV1Sha256) {
        throw new Error('old operator requires physical equality')
      }
    }
    expect(reproduceOldOperator).toThrow('old operator requires physical equality')
    expect(calls.apply).toBe(1)

    const beforeIntent = await readFile(
      resolve(built.input.applicationOutputDirectory, 'application-intent.json'),
    )
    const outcome = await recoverProtectedV2HistoricalReceipt(built.input, {
      validateSchemaOnlyTransition: (input) => {
        calls.transition += 1
        expect(input).toEqual({ fixture: 'shared validator input' })
        return built.proof
      },
    })
    const afterIntent = await readFile(
      resolve(built.input.applicationOutputDirectory, 'application-intent.json'),
    )

    expect(outcome.state).toBe('finalized_atomically')
    expect(outcome.wroteFinalization).toBe(true)
    expect(afterIntent).toEqual(beforeIntent)
    expect(calls).toEqual({ apply: 1, compensate: 0, import: 0, stage: 0, transition: 1 })
    expect(outcome.result).toMatchObject({
      migration: {
        migrationApplied: true,
        migrationApplicationCallCount: 0,
        migrationReexecuted: false,
        migrationStagingCallCount: 0,
      },
      receiptReconciled: true,
      safety: { compensationAuthorized: false, importAuthorized: false },
    })
    expect(
      assertProtectedV2FinalizedRecoveryReceiptGate(outcome.result, {
        amendment: built.input.amendment,
        amendmentIdentitySha256: built.input.amendment.amendmentIdentitySha256,
        originalIntentSha256: built.input.amendment.historicalIncident.intentSha256,
        recoveryToolBundleSha256: built.input.amendment.correctedRecoveryToolBundle.aggregateSha256,
      }),
    ).toEqual({
      compensationAuthorized: false,
      importAuthorized: false,
      migrationReceiptComplete: true,
    })
  })

  it('verifies a completed receipt idempotently without rewriting bytes or rerunning validation', async () => {
    const built = await setup()
    const validator = jest.fn(() => built.proof)
    await recoverProtectedV2HistoricalReceipt(built.input, {
      validateSchemaOnlyTransition: validator,
    })
    const finalized = resolve(built.input.applicationOutputDirectory, 'finalized')
    const names = (await readdir(finalized)).sort()
    const first = await Promise.all(names.map((name) => readFile(resolve(finalized, name))))
    built.input.postEvidence.safety.finalizedAbsentAtEvidenceCollection = false
    const repeated = await recoverProtectedV2HistoricalReceipt(built.input, {
      validateSchemaOnlyTransition: validator,
    })
    const second = await Promise.all(names.map((name) => readFile(resolve(finalized, name))))

    expect(repeated.state).toBe('already_finalized_verified')
    expect(repeated.wroteFinalization).toBe(false)
    expect(second).toEqual(first)
    expect(validator).toHaveBeenCalledTimes(1)
  })

  it('verifies the exact winner of a concurrent atomic-finalization race', async () => {
    const built = await setup()
    const outcomes = await Promise.all([
      recoverProtectedV2HistoricalReceipt(built.input, {
        validateSchemaOnlyTransition: () => built.proof,
      }),
      recoverProtectedV2HistoricalReceipt(built.input, {
        validateSchemaOnlyTransition: () => built.proof,
      }),
    ])
    expect(outcomes.filter(({ wroteFinalization }) => wroteFinalization)).toHaveLength(1)
    expect(outcomes[0].result).toEqual(outcomes[1].result)
  })

  it.each([
    [
      'V2 absent',
      (input: ProtectedV2ReceiptRecoveryInput) => (input.postEvidence.ledger.v2Occurrence = 0),
    ],
    [
      'V2 duplicated',
      (input: ProtectedV2ReceiptRecoveryInput) => (input.postEvidence.ledger.v2Occurrence = 2),
    ],
    [
      'wrong migration pair',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.postEvidence.ledger.v2MigrationSha256 = sha('wrong migration')),
    ],
    [
      'changed current recovery bundle',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.currentRecoveryToolBundle = buildProtectedV2ReceiptRecoveryBundle([
          {
            gitMode: '100644',
            path: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
            sha256: sha('changed core'),
          },
        ])),
    ],
    [
      'changed historical bundle',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.historicalOperatorBundle = { changed: true }),
    ],
    [
      'changed post catalog',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.postEvidence.catalog.fullAuditIdentitySha256 = sha('changed audit')),
    ],
    [
      'changed schema-neutral history',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.postEvidence.state.schemaNeutralHistorySha256 = sha('changed history')),
    ],
    [
      'arbitrary physical transition',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.postEvidence.state.physicalV1Sha256 = sha('arbitrary physical')),
    ],
    [
      'review mutation',
      (input: ProtectedV2ReceiptRecoveryInput) =>
        (input.postEvidence.mutationEvidence.reviewMutationCount = 1),
    ],
  ])('fails closed for %s', async (_label, mutate) => {
    const built = await setup()
    const changed = cloneInput(built.input)
    mutate(changed)
    await expect(
      recoverProtectedV2HistoricalReceipt(changed, {
        validateSchemaOnlyTransition: () => built.proof,
      }),
    ).rejects.toThrow()
    await expect(readdir(changed.applicationOutputDirectory)).resolves.not.toContain('finalized')
  })

  it('rejects a changed amendment even when it is internally rehashed', async () => {
    const built = await setup()
    const changed = cloneInput(built.input)
    const content = structuredClone(changed.amendment)
    delete (content as { amendmentIdentitySha256?: string }).amendmentIdentitySha256
    changed.amendment = buildProtectedV2ReceiptRecoveryAmendment({
      ...(content as ProtectedV2ReceiptRecoveryAmendmentContent),
      historicalIncident: {
        ...content.historicalIncident,
        operatorIdentity: 'different-operator',
      },
    })
    await expect(
      recoverProtectedV2HistoricalReceipt(changed, {
        validateSchemaOnlyTransition: () => built.proof,
      }),
    ).rejects.toThrow('explicitly authorized')
  })

  it('rejects changed intent, authorization, manifest, capture, and incident evidence', async () => {
    for (const kind of ['intent', 'authorization', 'manifest', 'capture', 'incident'] as const) {
      const built = await setup()
      const changed = cloneInput(built.input)
      if (kind === 'intent') {
        await writeFile(
          resolve(changed.applicationOutputDirectory, 'application-intent.json'),
          canonicalProtectedV2ReceiptRecoveryJson({ changed: true }),
        )
      } else if (kind === 'authorization') {
        changed.authorizationBytes = canonicalProtectedV2ReceiptRecoveryJson({ changed: true })
      } else if (kind === 'manifest') {
        await writeFile(
          resolve(changed.applicationOutputDirectory, 'intent-checksum-manifest.sha256'),
          `${sha('changed')}  application-intent.json\n${sha('changed')}  application-intent.md\n`,
        )
      } else if (kind === 'capture') {
        const first = changed.captures[0]
        changed.captures = [
          {
            ...first,
            files: { ...first.files, 'state-hashes.json': '{"changed":true}\n' },
          },
          changed.captures[1],
        ]
      } else {
        changed.incidentEvidenceFiles = {
          ...changed.incidentEvidenceFiles,
          'evidence/catalog.json': '{"changed":true}\n',
        }
      }
      await expect(
        recoverProtectedV2HistoricalReceipt(changed, {
          validateSchemaOnlyTransition: () => built.proof,
        }),
      ).rejects.toThrow()
    }
  })

  it('rejects self-consistent manifest re-signing for an arbitrary replacement intent', async () => {
    const built = await setup()
    const intentPath = resolve(built.input.applicationOutputDirectory, 'application-intent.json')
    const markdownPath = resolve(built.input.applicationOutputDirectory, 'application-intent.md')
    const manifestPath = resolve(
      built.input.applicationOutputDirectory,
      'intent-checksum-manifest.sha256',
    )
    const replacement = JSON.parse(await readFile(intentPath, 'utf8')) as Record<string, unknown>
    replacement.operator = 'arbitrary-second-intent'
    const replacementBytes = canonicalProtectedV2ReceiptRecoveryJson(replacement)
    const markdownBytes = await readFile(markdownPath, 'utf8')
    await writeFile(intentPath, replacementBytes)
    await writeFile(
      manifestPath,
      `${sha(replacementBytes)}  application-intent.json\n${sha(markdownBytes)}  application-intent.md\n`,
    )
    await expect(
      recoverProtectedV2HistoricalReceipt(built.input, {
        validateSchemaOnlyTransition: () => built.proof,
      }),
    ).rejects.toThrow('bytes changed')
  })

  it('rejects contradictory partial finalization', async () => {
    const built = await setup()
    const finalized = resolve(built.input.applicationOutputDirectory, 'finalized')
    await mkdir(finalized)
    await writeFile(resolve(finalized, 'application-result.json'), '{}\n')
    await expect(
      recoverProtectedV2HistoricalReceipt(built.input, {
        validateSchemaOnlyTransition: () => built.proof,
      }),
    ).rejects.toThrow('partial or contradictory')
  })

  it('exposes no migration, import, or compensation capability in its dependency boundary', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
      ),
      'utf8',
    )
    expect(source).not.toMatch(/from ['"]\.\/apply-protected-gold-import-contract-v2['"]/u)
    expect(source).not.toMatch(/from ['"]\.\/local-supabase['"]/u)
    expect(source).not.toMatch(/from ['"]\.\/import-gold-reviews['"]/u)
    expect(source).not.toMatch(/from ['"]\.\/execute-exact-gold-import-compensation/u)

    const built = await setup()
    await expect(
      recoverProtectedV2HistoricalReceipt(built.input, {
        validateSchemaOnlyTransition: () => built.proof,
        stageMigration: () => {
          throw new Error('must remain unreachable')
        },
      } as never),
    ).rejects.toThrow('only the shared transition validator')
  })

  it('loads a finalized receipt as migration evidence without granting import authorization', async () => {
    const built = await setup()
    await recoverProtectedV2HistoricalReceipt(built.input, {
      validateSchemaOnlyTransition: () => built.proof,
    })
    const loaded = await loadProtectedV2FinalizedReceiptRecovery({
      authority: {
        amendment: built.input.amendment,
        amendmentIdentitySha256: built.input.amendment.amendmentIdentitySha256,
        originalIntentSha256: built.input.amendment.historicalIncident.intentSha256,
        recoveryToolBundleSha256: built.input.amendment.correctedRecoveryToolBundle.aggregateSha256,
      },
      outputDirectory: built.input.applicationOutputDirectory,
    })
    expect(
      assertProtectedV2FinalizedRecoveryReceiptGate(loaded.result, {
        amendment: built.input.amendment,
        amendmentIdentitySha256: built.input.amendment.amendmentIdentitySha256,
        originalIntentSha256: built.input.amendment.historicalIncident.intentSha256,
        recoveryToolBundleSha256: built.input.amendment.correctedRecoveryToolBundle.aggregateSha256,
      }),
    ).toEqual({
      compensationAuthorized: false,
      importAuthorized: false,
      migrationReceiptComplete: true,
    })
    expect(await readdir(resolve(built.input.applicationOutputDirectory, 'finalized'))).toEqual(
      expect.arrayContaining([
        'application-result.json',
        'application-result.md',
        'checksum-manifest.sha256',
        'execution-receipt.json',
      ]),
    )
    expect(() =>
      assertProtectedV2FinalizedRecoveryReceiptGate(loaded.result, {
        amendment: built.input.amendment,
        amendmentIdentitySha256: sha('arbitrary amendment'),
        originalIntentSha256: built.input.amendment.historicalIncident.intentSha256,
        recoveryToolBundleSha256: built.input.amendment.correctedRecoveryToolBundle.aggregateSha256,
      }),
    ).toThrow('non-authorizing migration receipt')
  })

  it('rejects a fully rehashed finalized package with attacker-chosen nested evidence', async () => {
    const built = await setup()
    await recoverProtectedV2HistoricalReceipt(built.input, {
      validateSchemaOnlyTransition: () => built.proof,
    })
    const finalized = resolve(built.input.applicationOutputDirectory, 'finalized')
    const resultPath = resolve(finalized, 'application-result.json')
    const markdownPath = resolve(finalized, 'application-result.md')
    const manifestPath = resolve(finalized, 'checksum-manifest.sha256')
    const executionPath = resolve(finalized, 'execution-receipt.json')
    const result = JSON.parse(await readFile(resultPath, 'utf8')) as Record<string, unknown>
    result.expectedCatalog = { attackerChosen: true }
    const { contentSha256: ignoredResultSha256, ...resultContent } = result
    void ignoredResultSha256
    result.contentSha256 = sha(canonicalProtectedV2ReceiptRecoveryJson(resultContent))
    const resultBytes = canonicalProtectedV2ReceiptRecoveryJson(result)
    const markdownBytes = await readFile(markdownPath, 'utf8')
    const manifestBytes = `${sha(resultBytes)}  application-result.json\n${sha(markdownBytes)}  application-result.md\n`
    const execution = JSON.parse(await readFile(executionPath, 'utf8')) as Record<string, unknown>
    execution.resultSha256 = sha(resultBytes)
    execution.canonicalManifestSha256 = sha(manifestBytes)
    const { contentSha256: ignoredExecutionSha256, ...executionContent } = execution
    void ignoredExecutionSha256
    execution.contentSha256 = sha(canonicalProtectedV2ReceiptRecoveryJson(executionContent))
    await Promise.all([
      writeFile(resultPath, resultBytes),
      writeFile(manifestPath, manifestBytes),
      writeFile(executionPath, canonicalProtectedV2ReceiptRecoveryJson(execution)),
    ])

    await expect(
      loadProtectedV2FinalizedReceiptRecovery({
        authority: {
          amendment: built.input.amendment,
          amendmentIdentitySha256: built.input.amendment.amendmentIdentitySha256,
          originalIntentSha256: built.input.amendment.historicalIncident.intentSha256,
          recoveryToolBundleSha256:
            built.input.amendment.correctedRecoveryToolBundle.aggregateSha256,
        },
        outputDirectory: built.input.applicationOutputDirectory,
      }),
    ).rejects.toThrow('non-authorizing migration receipt')
  })

  it('rejects extra fields in capture, result, and execution receipt schemas', async () => {
    const built = await setup()
    const captureBytes = built.input.captures[0].files['execution-receipt.json']
    expect(parseProtectedV2ReceiptRecoveryHistoricalCaptureExecution(captureBytes)).toBeTruthy()

    const addExtraAndRehash = (bytes: string): string => {
      const parsed = JSON.parse(bytes) as Record<string, unknown>
      delete parsed.contentSha256
      parsed.unexpected = true
      return canonicalProtectedV2ReceiptRecoveryJson({
        ...parsed,
        contentSha256: sha(canonicalProtectedV2ReceiptRecoveryJson(parsed)),
      })
    }
    expect(() =>
      parseProtectedV2ReceiptRecoveryHistoricalCaptureExecution(addExtraAndRehash(captureBytes)),
    ).toThrow('inventory drifted')

    await recoverProtectedV2HistoricalReceipt(built.input, {
      validateSchemaOnlyTransition: () => built.proof,
    })
    const finalized = resolve(built.input.applicationOutputDirectory, 'finalized')
    const resultBytes = await readFile(resolve(finalized, 'application-result.json'), 'utf8')
    const executionBytes = await readFile(resolve(finalized, 'execution-receipt.json'), 'utf8')
    expect(() => parseProtectedV2ReceiptRecoveryResult(addExtraAndRehash(resultBytes))).toThrow(
      'inventory drifted',
    )
    expect(() =>
      parseProtectedV2ReceiptRecoveryExecutionReceipt(addExtraAndRehash(executionBytes)),
    ).toThrow('inventory drifted')
  })
})
