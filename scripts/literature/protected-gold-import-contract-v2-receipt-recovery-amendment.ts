import { createHash } from 'node:crypto'

export const PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_SCHEMA_VERSION =
  'literature-gold-protected-v2-receipt-recovery-amendment/1.0.0' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_BUNDLE_SCHEMA_VERSION =
  'literature-gold-protected-v2-receipt-recovery-bundle/1.0.0' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_DEFECT =
  'protected_v2_schema_sensitive_physical_equality_finalization_defect_v1' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_REASON =
  'schema_derived_v1_physical_projection_transition' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_HISTORICAL_INTENT_SHA256 =
  'deeedb1e93921d0e0e8a01009a6a1ed5c67114f53f94ea5cac277d99f113d8f4' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256 =
  '896e0d7d5f1d0161661b453ff1c5af1cebe34167483ce1e93ae734d64577fc31' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES = [
  'stage_migration',
  'apply_migration',
  'apply_import',
  'apply_compensation',
  'mutate_clinical_state',
] as const

export interface ProtectedV2ReceiptRecoveryBundleFile {
  gitMode: '100644' | '100755'
  path: string
  sha256: string
}

export interface ProtectedV2ReceiptRecoveryBundle {
  aggregateSha256: string
  files: readonly ProtectedV2ReceiptRecoveryBundleFile[]
  schemaVersion: typeof PROTECTED_V2_RECEIPT_RECOVERY_BUNDLE_SCHEMA_VERSION
}

export interface ProtectedV2ReceiptRecoveryCaptureAuthority {
  backupInstanceId: string
  canonicalManifestSha256: string
  directory: string
  executionNonce: string
  executionReceiptSha256: string
}

export interface ProtectedV2ReceiptRecoveryAmendmentContent {
  correctedRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
  correctedTransitionPolicyIdentitySha256: string
  defectIdentifier: typeof PROTECTED_V2_RECEIPT_RECOVERY_DEFECT
  expectedCatalog: {
    bindingSha256: string
    fullAuditIdentitySha256: string
  }
  historicalIncident: {
    authorizationContentSha256: string
    authorizationFileSha256: string
    backupCaptures: readonly [
      ProtectedV2ReceiptRecoveryCaptureAuthority,
      ProtectedV2ReceiptRecoveryCaptureAuthority,
    ]
    confirmation: string
    incidentEvidenceRoot: string
    incidentEvidenceSha256: Readonly<Record<string, string>>
    intentCreatedAt: string
    intentManifestSha256: string
    intentMarkdownSha256: string
    intentOutputDirectory: string
    intentSha256: string
    operatorIdentity: string
    repositoryHead: string
    separateCaptureAttestation: string
  }
  historicalOperatorBundle: {
    aggregateSha256: string
    bindingSha256: string
    runtimeInputDeclarationSha256: string
    trackedFileCount: number
    trackedFileInventorySha256: string
  }
  permittedHistoricalIntentSchemaVersions: readonly string[]
  permittedReason: typeof PROTECTED_V2_RECEIPT_RECOVERY_REASON
  pinnedSources: {
    v1MigrationSha256: string
    v2MigrationSha256: string
    v2VerifierSha256: string
  }
  prohibitedCapabilities: typeof PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES
  schemaVersion: typeof PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_SCHEMA_VERSION
  stateAuthority: {
    batchId: string
    post: {
      developmentMembershipSha256: string
      effectiveV1Sha256: string
      effectiveV2Sha256: string
      eventStateSha256: string
      physicalV1Sha256: string
      physicalV2Sha256: string
      planningSha256: string
      pointerStateSha256: string
      revealStateSha256: string
      reviewStateSha256: string
      schemaNeutralHistorySha256: string
    }
    pre: {
      developmentMembershipSha256: string
      effectiveV1Sha256: string
      physicalV1Sha256: string
      planningSha256: string
      schemaNeutralHistorySha256: string
    }
  }
}

export interface ProtectedV2ReceiptRecoveryAmendment extends ProtectedV2ReceiptRecoveryAmendmentContent {
  amendmentIdentitySha256: string
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SAFE_REPOSITORY_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Recovery amendment rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (typeof value !== 'object') {
    throw new Error(`Recovery amendment rejects ${typeof value}.`)
  }
  const object = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(object)
      .sort(compareCodeUnits)
      .map((key) => {
        if (object[key] === undefined) {
          throw new Error(`Recovery amendment rejects undefined at ${key}.`)
        }
        return [key, canonicalValue(object[key])]
      }),
  )
}

export function canonicalProtectedV2ReceiptRecoveryJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`
}

export function protectedV2ReceiptRecoverySha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a lowercase SHA-256.`)
}

export function buildProtectedV2ReceiptRecoveryBundle(
  files: readonly ProtectedV2ReceiptRecoveryBundleFile[],
): ProtectedV2ReceiptRecoveryBundle {
  const normalized = files
    .map((file) => ({ ...file }))
    .sort((left, right) => compareCodeUnits(left.path, right.path))
  if (
    normalized.length === 0 ||
    new Set(normalized.map(({ path }) => path)).size !== normalized.length
  ) {
    throw new Error('Recovery-tool bundle inventory must be nonempty and unique.')
  }
  for (const file of normalized) {
    if (
      !SAFE_REPOSITORY_PATH.test(file.path) ||
      (file.gitMode !== '100644' && file.gitMode !== '100755')
    ) {
      throw new Error(`Recovery-tool bundle contains an unsafe file: ${file.path}`)
    }
    assertSha256(file.sha256, `Recovery-tool bundle file ${file.path}`)
  }
  const content = {
    files: normalized,
    schemaVersion: PROTECTED_V2_RECEIPT_RECOVERY_BUNDLE_SCHEMA_VERSION,
  }
  return {
    ...content,
    aggregateSha256: protectedV2ReceiptRecoverySha256(
      canonicalProtectedV2ReceiptRecoveryJson(content),
    ),
  }
}

export function validateProtectedV2ReceiptRecoveryBundle(
  bundle: ProtectedV2ReceiptRecoveryBundle,
): ProtectedV2ReceiptRecoveryBundle {
  const rebuilt = buildProtectedV2ReceiptRecoveryBundle(bundle.files)
  if (
    bundle.schemaVersion !== PROTECTED_V2_RECEIPT_RECOVERY_BUNDLE_SCHEMA_VERSION ||
    canonicalProtectedV2ReceiptRecoveryJson(rebuilt) !==
      canonicalProtectedV2ReceiptRecoveryJson(bundle)
  ) {
    throw new Error('Recovery-tool bundle identity is invalid.')
  }
  return rebuilt
}

export function buildProtectedV2ReceiptRecoveryAmendment(
  content: ProtectedV2ReceiptRecoveryAmendmentContent,
): ProtectedV2ReceiptRecoveryAmendment {
  validateProtectedV2ReceiptRecoveryBundle(content.correctedRecoveryToolBundle)
  assertSha256(
    content.correctedTransitionPolicyIdentitySha256,
    'Corrected transition-policy identity',
  )
  if (
    content.schemaVersion !== PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_SCHEMA_VERSION ||
    content.defectIdentifier !== PROTECTED_V2_RECEIPT_RECOVERY_DEFECT ||
    content.permittedReason !== PROTECTED_V2_RECEIPT_RECOVERY_REASON ||
    canonicalProtectedV2ReceiptRecoveryJson(content.prohibitedCapabilities) !==
      canonicalProtectedV2ReceiptRecoveryJson(
        PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES,
      ) ||
    content.permittedHistoricalIntentSchemaVersions.length === 0
  ) {
    throw new Error('Recovery amendment scope is malformed or overbroad.')
  }
  for (const [label, identity] of Object.entries({
    authorizationContentSha256: content.historicalIncident.authorizationContentSha256,
    authorizationFileSha256: content.historicalIncident.authorizationFileSha256,
    catalogBindingSha256: content.expectedCatalog.bindingSha256,
    catalogFullAuditSha256: content.expectedCatalog.fullAuditIdentitySha256,
    historicalBundleAggregateSha256: content.historicalOperatorBundle.aggregateSha256,
    historicalBundleBindingSha256: content.historicalOperatorBundle.bindingSha256,
    historicalBundleInventorySha256: content.historicalOperatorBundle.trackedFileInventorySha256,
    historicalRuntimeDeclarationSha256:
      content.historicalOperatorBundle.runtimeInputDeclarationSha256,
    intentManifestSha256: content.historicalIncident.intentManifestSha256,
    intentMarkdownSha256: content.historicalIncident.intentMarkdownSha256,
    intentSha256: content.historicalIncident.intentSha256,
    v1MigrationSha256: content.pinnedSources.v1MigrationSha256,
    v2MigrationSha256: content.pinnedSources.v2MigrationSha256,
    v2VerifierSha256: content.pinnedSources.v2VerifierSha256,
  })) {
    assertSha256(identity, label)
  }
  for (const [path, identity] of Object.entries(
    content.historicalIncident.incidentEvidenceSha256,
  )) {
    if (!SAFE_REPOSITORY_PATH.test(path)) {
      throw new Error(`Recovery amendment contains an unsafe incident evidence path: ${path}`)
    }
    assertSha256(identity, `Incident evidence ${path}`)
  }
  return {
    ...content,
    amendmentIdentitySha256: protectedV2ReceiptRecoverySha256(
      canonicalProtectedV2ReceiptRecoveryJson(content),
    ),
  }
}

// The caller supplies the complete reviewed recovery-tool bundle, including this module and the
// CLI entry point. Keeping file identities outside this source avoids a cryptographic
// self-reference. The exact amendment identity is then an external operator confirmation. The
// shared transition policy remains a separate authority pinned by its semantic policy identity.
export function buildProtectedV2ReceiptRecoveryIncidentAmendment(input: {
  correctedRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
  correctedTransitionPolicyIdentitySha256: string
}): ProtectedV2ReceiptRecoveryAmendment {
  if (
    input.correctedTransitionPolicyIdentitySha256 !==
    PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256
  ) {
    throw new Error('Incident amendment requires the reviewed shared transition-policy identity.')
  }
  return buildProtectedV2ReceiptRecoveryAmendment({
    correctedRecoveryToolBundle: input.correctedRecoveryToolBundle,
    correctedTransitionPolicyIdentitySha256: input.correctedTransitionPolicyIdentitySha256,
    defectIdentifier: PROTECTED_V2_RECEIPT_RECOVERY_DEFECT,
    expectedCatalog: {
      bindingSha256: 'cd2295c1c69fbefa5920c82c429f0ce10bcc6ac6d0b4714c479f108bf7b2f900',
      fullAuditIdentitySha256: 'd0a5d56bcc88b1cf7fa642d25d16c75031dc4a14b349229959389b0dbf0c5783',
    },
    historicalIncident: {
      authorizationContentSha256:
        '7c2cf470924ed90a00a31669ede18359fab1e5eae0c32b3fb5766eeaea1a3338',
      authorizationFileSha256: 'e8afacf3b0c5c47af102e7e810a8bf21958d67feb598412762adf471ec9cafeb',
      backupCaptures: [
        {
          backupInstanceId: 'af3ae6a36e532bfcf416b94077339d1134da7182f4dc9ba6195a2913ec2abcbf',
          canonicalManifestSha256:
            'e6ca4efe96adc50f207c2335578937aa798d3c72c66a85bfc4dfb1a6d6c40a9c',
          directory:
            '/Users/russellmiller/Documents/Interventional-Pulm-Education-Data-Backups/gold-import-contract-v2-real-local-application-99ad5991-20260811T040330Z-capture-1',
          executionNonce: 'd07a694670c4c83e306d78c1c4ef978a92513eb9c9879fa9a9c86a1845da30c1',
          executionReceiptSha256:
            'cb3a972728be03c993d406d6a083df001fe157a0806f1e028dd2657896503ec8',
        },
        {
          backupInstanceId: '359d51dcb5dd564d5c866c5317a50bb2e488e29b7900b0d36737de4c83f2798b',
          canonicalManifestSha256:
            'e6ca4efe96adc50f207c2335578937aa798d3c72c66a85bfc4dfb1a6d6c40a9c',
          directory:
            '/Users/russellmiller/Documents/Interventional-Pulm-Education-Data-Backups/gold-import-contract-v2-real-local-application-99ad5991-20260811T040330Z-capture-2',
          executionNonce: '7b0cdf719ead26dd885dfde75a75c6c749bfbadc6f1ca7f606c317a753ddcd9f',
          executionReceiptSha256:
            '5767a5b10e73ad68e89a50a6071f880046d4cade570fab5bd2ade75382c77c3c',
        },
      ],
      confirmation: 'APPLY PROTECTED LITERATURE GOLD IMPORT CONTRACT V2 EXACTLY ONCE',
      incidentEvidenceRoot:
        '/Users/russellmiller/Documents/Interventional-Pulm-Education-Data-Backups/protected-v2-receipt-finalization-incident-20260811T135912Z',
      incidentEvidenceSha256: {
        'checksum-manifest.sha256':
          '80f5bf7abea92bd7b3cbda74812f79352862d38b78a8014c5f5da112c9444cc6',
        'evidence/application-intent.json':
          'deeedb1e93921d0e0e8a01009a6a1ed5c67114f53f94ea5cac277d99f113d8f4',
        'evidence/catalog-audit-evidence.json':
          'c39a1c821506579dd6e3fb09f539396e6e93ab16c57dd1c2e2890688a4517c39',
        'evidence/git-evidence.json':
          '45dc97a8dbfa06758f4f568b2b6cae0b70087ef6004c4f6a586aad5b7c86b9ae',
        'evidence/migration-ledger-evidence.json':
          'aa342a910c3db2e16902c20422b4fd72bd4fe5c43c68f2f081db4114b001146e',
        'evidence/original-authorization.json':
          'e8afacf3b0c5c47af102e7e810a8bf21958d67feb598412762adf471ec9cafeb',
        'evidence/post-application-database-snapshot.json':
          'dc87e386fb0860f1e4dc92e8a7c58a5249f047a4b4df75c85338d460a65b9646',
        'evidence/post-application-diagnostic.json':
          '725e581d42fc3510b15580243d287999e4c5a4c36d1799e06d48f0ff6ae438e9',
        'evidence/schema-neutral-history-projection.json':
          '5469be890970ad79ccef977ff9db55f454edd6cc010b6394e20f4ce733e8cddb',
        'evidence/source-identities.json':
          '1af00e43bca08eefa40c07e3a343ad2f880ab39cad9c083f1f9a3ad01a201f64',
        'evidence/state-identities.json':
          '54088da8314a524ff0ff22dad0f04db0b2a9e0d6de72482fb2f6c6faaded04e7',
        'evidence/intent-checksum-manifest.sha256':
          '62b210f5b5262a2389ba085d18ba51924083cbe7425277f41f3349113075a6fb',
        'incident-manifest.json':
          '4171b59b091698c0e38fec4401a80a3f57d44e3e6b21a4afdaf37ba062a50523',
        'receipt.json': 'a9b6fb62964c7debfd06b9210105f35d3928a72da926ef1c765a707cbcd4fe3d',
      },
      intentCreatedAt: '2026-08-11T04:06:16.474Z',
      intentManifestSha256: '62b210f5b5262a2389ba085d18ba51924083cbe7425277f41f3349113075a6fb',
      intentMarkdownSha256: 'e8df09d3779f75040c84abce2d3a3b7b1a74cddf26b20a6463f3c9b3fdc48a88',
      intentOutputDirectory:
        '/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/local-data/literature/protected-v2-application-receipts/real-local-v2-99ad5991-20260811T040330Z',
      intentSha256: PROTECTED_V2_RECEIPT_RECOVERY_HISTORICAL_INTENT_SHA256,
      operatorIdentity: 'codex',
      repositoryHead: '99ad59915b9e475f6397864e86e28d6816510f88',
      separateCaptureAttestation: 'I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES',
    },
    historicalOperatorBundle: {
      aggregateSha256: '967a50a7b133f4b7828a059b288bb2c7d60f6dace8057743004c5dba9c4e03b3',
      bindingSha256: '8d1a1729e446e8feaa4f39b33b7dad64f2b3b1fcc04023266d9234fa36f490d4',
      runtimeInputDeclarationSha256:
        '95356fbf962c64ec15c58c1eae9eef4cc89dd9aa01458d39931907789c8ad30f',
      trackedFileCount: 167,
      trackedFileInventorySha256:
        'defc67a62f76eee7061ffddb4d93415917b9eb2b7b6f2deb99d0d5c0a91ed3ac',
    },
    permittedHistoricalIntentSchemaVersions: [
      'literature-gold-protected-v2-application-intent/2.0.0',
    ],
    permittedReason: PROTECTED_V2_RECEIPT_RECOVERY_REASON,
    pinnedSources: {
      v1MigrationSha256: 'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
      v2MigrationSha256: '3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1',
      v2VerifierSha256: '2570f0885ed646247df7dd3e375b835c7591f2750bc190d63845191cd0426eeb',
    },
    prohibitedCapabilities: PROTECTED_V2_RECEIPT_RECOVERY_PROHIBITED_CAPABILITIES,
    schemaVersion: PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_SCHEMA_VERSION,
    stateAuthority: {
      batchId: 'fff41ba3-811d-4d28-ba73-9302db3a942a',
      post: {
        developmentMembershipSha256:
          '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c',
        effectiveV1Sha256: '8b4f46720b980ec5337edfa448f7d998ddfa6498ec32a8fce5a941589a746a23',
        effectiveV2Sha256: 'f79b825c70f0032642cd877ffa06238b6965dec479c6855105e45ee64bd01f4c',
        eventStateSha256: '7fa274b562b56b48bb0f4c7bd113640c0811616afa2024a44a806c73176fec93',
        physicalV1Sha256: 'dab46b9df0c32e5ac98558495988d07f2be7474a61ed1d85fb8af9b5e6bff5fb',
        physicalV2Sha256: 'afce1a294fd5343a9127d86f6d210baabe8888ee9dc77b3ee3fcb3559d6741dd',
        planningSha256: '84743faccffca532d3fe6e03bd2d29a44f96790f0004c40ff0c9ed6bba881be5',
        pointerStateSha256: '5b0c8db42b8ae204e940d495a7411f64cb3290cf86bd9afb2710eae30884c567',
        revealStateSha256: '5c68b4af5b2d4b4630ce865e3dca5736d5d1544a80a8fe1be7d4580faa8948b5',
        reviewStateSha256: '7e8297939763a92e170074a69256f21e5db4e6c684947697e7523b7ca81f194c',
        schemaNeutralHistorySha256:
          '5469be890970ad79ccef977ff9db55f454edd6cc010b6394e20f4ce733e8cddb',
      },
      pre: {
        developmentMembershipSha256:
          '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c',
        effectiveV1Sha256: '8b4f46720b980ec5337edfa448f7d998ddfa6498ec32a8fce5a941589a746a23',
        physicalV1Sha256: '3986852c329bb66abf293d499655f2f278ae881801291756c9c1f75cc0351c70',
        planningSha256: '84743faccffca532d3fe6e03bd2d29a44f96790f0004c40ff0c9ed6bba881be5',
        schemaNeutralHistorySha256:
          '5469be890970ad79ccef977ff9db55f454edd6cc010b6394e20f4ce733e8cddb',
      },
    },
  })
}
