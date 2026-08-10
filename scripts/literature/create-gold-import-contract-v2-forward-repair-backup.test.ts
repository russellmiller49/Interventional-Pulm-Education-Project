import { createHash } from 'node:crypto'

import {
  bindImportPlanV2,
  parseImportPlanV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256,
  GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION,
  GOLD_IMPORT_CONTRACT_V2_BRANCH,
  REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES,
  parseGoldImportContractV2BackupArguments,
  validateGoldImportContractV2BackupSemanticEvidenceForTest,
  type RequiredEvidenceName,
} from './create-gold-import-contract-v2-forward-repair-backup'
import { canonicalJson } from './gold-import-compensation-migration-operations'
import { verifyGoldImportCompensationPackageV2IntrinsicFiles } from './generate-gold-import-compensation-package-v2'
import {
  buildForwardBackupSemanticFixture,
  type ForwardBackupSemanticFixture,
} from './gold-import-contract-v2-forward-backup-test-fixture'
import { buildProtectedV2BackupExecutionReceipt } from './protected-gold-import-contract-v2-evidence'

const REQUIRED_EVIDENCE_ARGUMENTS = REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.flatMap(
  (name) => ['--evidence', `${name}=/tmp/${name}`],
)

const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalJson(value), 'utf8')
}

function manifestBytes(files: ReadonlyMap<string, Buffer>): Buffer {
  return Buffer.from(
    `${[...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
}

function cloneFixture(input: ForwardBackupSemanticFixture): ForwardBackupSemanticFixture {
  const files = new Map<RequiredEvidenceName, ReadonlyMap<string, Buffer>>()
  for (const [name, group] of input.files) {
    files.set(name, new Map([...group].map(([path, bytes]) => [path, Buffer.from(bytes)])))
  }
  const clone: ForwardBackupSemanticFixture = {
    ...input,
    documents: new Map(),
    fileNames: new Map(),
    files,
    repository: { ...input.repository },
  }
  for (const name of REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES) {
    refreshGroup(clone, name)
  }
  return clone
}

function mutableGroup(
  input: ForwardBackupSemanticFixture,
  name: RequiredEvidenceName,
): Map<string, Buffer> {
  const group = new Map(input.files.get(name) ?? [])
  input.files.set(name, group)
  return group
}

function refreshGroup(input: ForwardBackupSemanticFixture, name: RequiredEvidenceName): void {
  const group = input.files.get(name) ?? new Map()
  input.fileNames.set(name, [...group.keys()])
  input.documents.set(
    name,
    [...group]
      .filter(([path]) => path.endsWith('.json'))
      .map(([, bytes]) => JSON.parse(bytes.toString('utf8')) as unknown),
  )
}

function validateFixture(input: ForwardBackupSemanticFixture) {
  return validateGoldImportContractV2BackupSemanticEvidenceForTest({
    authorization: input.authorization,
    documents: input.documents,
    files: input.files,
    fileNames: input.fileNames,
    operatorBundle: input.operatorBundle,
    repository: input.repository,
  })
}

function rebuildCanonicalPackageManifest(group: Map<string, Buffer>): void {
  const names = [
    'disposable-v2-catalog-drift-matrix.json',
    'disposable-v2-complete-catalog-audit.json',
    'disposable-v2-exact-catalog-binding.json',
    'disposable-v2-ready-audit.json',
    'exact-package-rehearsal-report-v2.json',
    'fresh-v2-rehearsal-evidence.json',
    'protected-v2-runtime-bundle-binding.json',
    'upgrade-v2-rehearsal-evidence.json',
  ]
  group.set(
    'canonical-manifest-v2.sha256',
    manifestBytes(new Map(names.map((name) => [name, group.get(name)!]))),
  )
}

function rebuildExactPackageManifest(group: Map<string, Buffer>): void {
  const prefix = 'exact-package-v2/'
  const descriptorPath = `${prefix}package-descriptor-v2.json`
  const descriptor = JSON.parse(group.get(descriptorPath)!.toString('utf8')) as {
    artifacts: Record<string, string>
  }
  descriptor.artifacts['proposed-commands-v2.txt'] = sha256(
    group.get(`${prefix}proposed-commands-v2.txt`)!,
  )
  group.set(descriptorPath, canonicalBytes(descriptor))
  group.set(
    `${prefix}checksum-manifest-v2.sha256`,
    manifestBytes(
      new Map(
        [...group]
          .filter(
            ([name]) => name.startsWith(prefix) && name !== `${prefix}checksum-manifest-v2.sha256`,
          )
          .map(([name, bytes]) => [name.slice(prefix.length), bytes]),
      ),
    ),
  )
}

function exactPackageFiles(input: ForwardBackupSemanticFixture): Map<string, Buffer> {
  const prefix = 'exact-package-v2/'
  return new Map(
    [...input.files.get('package-rehearsal-evidence')!]
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, bytes]) => [name.slice(prefix.length), Buffer.from(bytes)]),
  )
}

describe('gold import contract V2 forward-repair backup', () => {
  let fixture: ForwardBackupSemanticFixture

  beforeAll(async () => {
    fixture = await buildForwardBackupSemanticFixture()
  })

  it('parses an explicit additive output and uniquely named evidence inputs', () => {
    expect(
      parseGoldImportContractV2BackupArguments([
        '--output-root',
        '/backup-root',
        '--output',
        '/backup-root/gold-import-contract-v2-forward-repair-v1-deadbeef',
        ...REQUIRED_EVIDENCE_ARGUMENTS,
      ]),
    ).toEqual({
      evidence: REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.map((name) => ({
        name,
        source: `/tmp/${name}`,
      })),
      output: '/backup-root/gold-import-contract-v2-forward-repair-v1-deadbeef',
      outputRoot: '/backup-root',
    })
  })

  it.each([
    ['missing evidence', ['--output-root', '/root', '--output', '/root/result']],
    [
      'duplicate evidence names',
      [
        '--output-root',
        '/root',
        '--output',
        '/root/result',
        '--evidence',
        'report=/tmp/a',
        '--evidence',
        'report=/tmp/b',
      ],
    ],
    [
      'unsafe evidence name',
      ['--output-root', '/root', '--output', '/root/result', '--evidence', '../escape=/tmp/a'],
    ],
    [
      'unknown option',
      [
        '--output-root',
        '/root',
        '--output',
        '/root/result',
        '--evidence',
        'report=/tmp/a',
        '--database-url',
        'postgresql://forbidden',
      ],
    ],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseGoldImportContractV2BackupArguments(argv)).toThrow()
  })

  it('pins the task branch, backup schema, historical V1 bytes, and exact Phase-10 inventory', () => {
    expect(GOLD_IMPORT_CONTRACT_V2_BRANCH).toBe(
      'codex/ip-literature-import-contract-v2-forward-repair-v1',
    )
    expect(GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-forward-repair-backup/2.0.0',
    )
    expect(GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256).toBe(
      'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
    )
    expect(REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES).toEqual([
      'catalog-drift-matrix',
      'catalog-expectations-and-ready-inventories',
      'critic-report',
      'descendant-recovery-evidence',
      'final-pr-body',
      'full-validation-report',
      'merge-readiness-report',
      'module-resolution-evidence',
      'package-rehearsal-evidence',
      'protected-bundle-inventory',
      'real-local-read-only-report',
      'runtime-input-evidence',
      'same-user-recomputation-evidence',
      'sealed-intent-lost-ack-evidence',
      'tests-build-report',
      'trusted-operator-evidence',
    ])
  })

  it('accepts one complete production-shaped Phase-10 evidence set', () => {
    const validation = validateFixture(fixture)

    expect(validation).toMatchObject({
      disposableExpectedCatalogBindingSha256:
        fixture.authorization.disposableExpectedCatalog.bindingSha256,
      exactCatalogArtifactProfiles: ['local_supabase_postgres_owner_v1', 'supabase_admin_owner_v1'],
      localExpectedCatalogBindingSha256: fixture.authorization.localExpectedCatalog.bindingSha256,
      protectedRuntimeBundleBindingSha256:
        fixture.authorization.protectedRuntimeBundle.bindingSha256,
      transientDeliveryAuthorityRejected: true,
    })
    expect(Object.keys(validation.phase10EvidenceSummarySha256).sort()).toEqual(
      [
        'critic-report',
        'descendant-recovery-evidence',
        'final-pr-body',
        'full-validation-report',
        'merge-readiness-report',
        'same-user-recomputation-evidence',
        'sealed-intent-lost-ack-evidence',
        'tests-build-report',
        'trusted-operator-evidence',
      ].sort(),
    )
  })

  it('rejects a rehashed deterministic package artifact through the shared intrinsic verifier', () => {
    const mutated = cloneFixture(fixture)
    const group = mutableGroup(mutated, 'package-rehearsal-evidence')
    group.set(
      'exact-package-v2/proposed-commands-v2.txt',
      Buffer.from('UNSAFE REPLACEMENT COMMAND\n', 'utf8'),
    )
    rebuildExactPackageManifest(group)
    refreshGroup(mutated, 'package-rehearsal-evidence')
    expect(() => validateFixture(mutated)).toThrow(
      'deterministic package artifact is stale or unsafe: proposed-commands-v2.txt',
    )
  })

  it('returns detached immutable intrinsic package evidence instead of caller-owned authority', () => {
    const files = exactPackageFiles(fixture)
    const verified = verifyGoldImportCompensationPackageV2IntrinsicFiles(files)
    const originalPlanBytes = verified.files.get('immutable-atomic-import-plan-v2.json')!
    files.set('immutable-atomic-import-plan-v2.json', Buffer.from('{}\n', 'utf8'))
    const exposed = verified.files.get('immutable-atomic-import-plan-v2.json')!
    exposed.fill(0)

    expect(verified.files).not.toBe(files)
    expect(verified.files.get('immutable-atomic-import-plan-v2.json')).not.toBe(originalPlanBytes)
    expect(verified.files.get('immutable-atomic-import-plan-v2.json')).toEqual(originalPlanBytes)
    expect(Object.isFrozen(verified.importPlan)).toBe(true)
    expect(Object.isFrozen(verified.importPlan.actions)).toBe(true)
    expect(Object.isFrozen(verified.sourceAuthorizationSet)).toBe(true)
  })

  it('binds the plan to the post-migration V2 state without conflating it with the V1 snapshot', () => {
    const verified = verifyGoldImportCompensationPackageV2IntrinsicFiles(exactPackageFiles(fixture))

    expect(verified.importPlan.expectedEffectiveStateSha256).toBe(
      verified.sourceAuthorizationSet.v2PreImportState.effectiveStateSha256,
    )
    expect(verified.importPlan.expectedPhysicalStateSha256).toBe(
      verified.sourceAuthorizationSet.v2PreImportState.physicalStateSha256,
    )
    expect(verified.sourceAuthorizationSet.v2PreImportState).not.toEqual({
      effectiveStateSha256: verified.sourceAuthorizationSet.currentDatabase.effectiveStateSha256,
      physicalStateSha256: verified.sourceAuthorizationSet.currentDatabase.physicalStateSha256,
    })
  })

  it('rejects a repaired source/plan/descriptor migration envelope against the committed catalog', () => {
    const files = exactPackageFiles(fixture)
    const source = JSON.parse(files.get('source-authorization-set-v4.json')!.toString('utf8')) as {
      migration: { id: string; sha256: string }
    }
    source.migration.sha256 = '0'.repeat(64)
    const sourceBytes = canonicalBytes(source)
    files.set('source-authorization-set-v4.json', sourceBytes)

    const parsedPlan = parseImportPlanV2(
      JSON.parse(files.get('immutable-atomic-import-plan-v2.json')!.toString('utf8')) as unknown,
    )
    const { binding: _binding, ...planContent } = parsedPlan
    void _binding
    const plan = bindImportPlanV2({
      ...planContent,
      sourceAuthorizationSetSha256: sha256(sourceBytes),
    })
    const planBytes = canonicalBytes(plan)
    files.set('immutable-atomic-import-plan-v2.json', planBytes)

    const descriptor = JSON.parse(files.get('package-descriptor-v2.json')!.toString('utf8')) as {
      artifacts: Record<string, string>
      importPlanSha256: string
      migration: { id: string; sha256: string }
      sourceAuthorizationSetSha256: string
    }
    descriptor.migration = { id: source.migration.id, sha256: source.migration.sha256 }
    descriptor.importPlanSha256 = plan.binding.contentSha256
    descriptor.sourceAuthorizationSetSha256 = sha256(sourceBytes)
    descriptor.artifacts['source-authorization-set-v4.json'] = sha256(sourceBytes)
    descriptor.artifacts['immutable-atomic-import-plan-v2.json'] = sha256(planBytes)
    files.set('package-descriptor-v2.json', canonicalBytes(descriptor))
    const withoutManifest = new Map(files)
    withoutManifest.delete('checksum-manifest-v2.sha256')
    files.set('checksum-manifest-v2.sha256', manifestBytes(withoutManifest))

    expect(() => verifyGoldImportCompensationPackageV2IntrinsicFiles(files)).toThrow(
      'exact catalog artifact, source authorization, descriptor, or returned bindings differ',
    )
  })

  it('rejects a rehashed outer report that substitutes the pinned pre-V1 backup identity', () => {
    const mutated = cloneFixture(fixture)
    const group = mutableGroup(mutated, 'package-rehearsal-evidence')
    const report = JSON.parse(
      group.get('exact-package-rehearsal-report-v2.json')!.toString('utf8'),
    ) as { backup: { manifestSha256: string } }
    report.backup.manifestSha256 = '0'.repeat(64)
    group.set('exact-package-rehearsal-report-v2.json', canonicalBytes(report))
    rebuildCanonicalPackageManifest(group)
    refreshGroup(mutated, 'package-rehearsal-evidence')
    expect(() => validateFixture(mutated)).toThrow(
      'Exact package rehearsal report is incomplete or cross-bound incorrectly',
    )
  })

  it('requires the volatile four-run execution receipt and distinct cleanup identities', () => {
    const missing = cloneFixture(fixture)
    const missingGroup = mutableGroup(missing, 'package-rehearsal-evidence')
    missingGroup.delete('execution-receipt-v2.json')
    refreshGroup(missing, 'package-rehearsal-evidence')
    expect(() => validateFixture(missing)).toThrow('execution-receipt-v2.json')

    const duplicated = cloneFixture(fixture)
    const duplicatedGroup = mutableGroup(duplicated, 'package-rehearsal-evidence')
    const receipt = JSON.parse(
      duplicatedGroup.get('execution-receipt-v2.json')!.toString('utf8'),
    ) as {
      fresh: Array<{
        cleanup: {
          absenceChecks: Array<{ identifier: string; kind: string }>
          containerId: string
          containerName: string
        }
        rawReceipt: { disposableRuntime: { containerId: string; containerName: string } }
      }>
    }
    receipt.fresh[1].cleanup.containerId = receipt.fresh[0].cleanup.containerId
    receipt.fresh[1].cleanup.containerName = receipt.fresh[0].cleanup.containerName
    receipt.fresh[1].cleanup.absenceChecks.forEach((check) => {
      check.identifier =
        check.kind === 'container_id'
          ? receipt.fresh[0].cleanup.containerId
          : receipt.fresh[0].cleanup.containerName
    })
    receipt.fresh[1].rawReceipt.disposableRuntime.containerId = receipt.fresh[0].cleanup.containerId
    receipt.fresh[1].rawReceipt.disposableRuntime.containerName =
      receipt.fresh[0].cleanup.containerName
    duplicatedGroup.set('execution-receipt-v2.json', canonicalBytes(receipt))
    refreshGroup(duplicated, 'package-rehearsal-evidence')
    expect(() => validateFixture(duplicated)).toThrow('did not use four distinct containers')
  })

  it('rejects stale final-HEAD evidence even when exact A/B identities are unchanged', () => {
    const stale = cloneFixture(fixture)
    stale.repository.head = 'f'.repeat(40)
    expect(() => validateFixture(stale)).toThrow()
  })

  it('rejects a rehashed fresh snapshot that contradicts the upgrade bracket', () => {
    const mutated = cloneFixture(fixture)
    const group = mutableGroup(mutated, 'package-rehearsal-evidence')
    const fresh = JSON.parse(group.get('fresh-v2-rehearsal-evidence.json')!.toString('utf8')) as {
      verifierEvidence: { postV2SeedProjection: { snapshot: { itemRowsSha256: string } } }
    }
    fresh.verifierEvidence.postV2SeedProjection.snapshot.itemRowsSha256 = 'f'.repeat(64)
    const freshBytes = canonicalBytes(fresh)
    group.set('fresh-v2-rehearsal-evidence.json', freshBytes)
    const report = JSON.parse(
      group.get('exact-package-rehearsal-report-v2.json')!.toString('utf8'),
    ) as { rehearsals: { fresh: { canonicalEvidenceSha256: string } } }
    report.rehearsals.fresh.canonicalEvidenceSha256 = sha256(freshBytes)
    group.set('exact-package-rehearsal-report-v2.json', canonicalBytes(report))
    rebuildCanonicalPackageManifest(group)
    refreshGroup(mutated, 'package-rehearsal-evidence')
    expect(() => validateFixture(mutated)).toThrow(
      'Canonical fresh/upgrade cohort evidence differs from the exact import plan',
    )
  })

  it('rejects missing capture manifests and a fully rehashed multi-field stale receipt', () => {
    const missing = cloneFixture(fixture)
    const missingGroup = mutableGroup(missing, 'real-local-read-only-report')
    missingGroup.delete('capture-2/checksum-manifest.sha256')
    refreshGroup(missing, 'real-local-read-only-report')
    expect(() => validateFixture(missing)).toThrow(
      'Real-local capture has an incomplete or unexpected seven-file inventory',
    )

    const rehashed = cloneFixture(fixture)
    const rehashedGroup = mutableGroup(rehashed, 'real-local-read-only-report')
    const supplied = JSON.parse(
      rehashedGroup.get('capture-2/execution-receipt.json')!.toString('utf8'),
    ) as ReturnType<typeof buildProtectedV2BackupExecutionReceipt>
    const {
      backupInstanceId: _backupInstanceId,
      contentSha256: _contentSha256,
      ...projection
    } = supplied
    void _backupInstanceId
    void _contentSha256
    const rebuilt = buildProtectedV2BackupExecutionReceipt(
      {
        ...projection,
        backupRoot: '/synthetic-read-only/attacker-root',
        executedAt: '2026-08-10T12:10:00.000Z',
        outputDirectory: '/synthetic-read-only/attacker-output',
        repositoryCommitSha: 'f'.repeat(40),
      },
      { operatorBundle: rehashed.operatorBundle },
    )
    rehashedGroup.set('capture-2/execution-receipt.json', canonicalBytes(rebuilt))
    refreshGroup(rehashed, 'real-local-read-only-report')
    expect(() => validateFixture(rehashed)).toThrow(
      'Real-local capture is not the exact current read-only Phase-8 state',
    )
  })

  it('rejects placeholder Phase-10 evidence even when every required group name exists', () => {
    const mutated = cloneFixture(fixture)
    const group = mutableGroup(mutated, 'critic-report')
    group.set('evidence-summary.json', canonicalBytes({}))
    refreshGroup(mutated, 'critic-report')
    expect(() => validateFixture(mutated)).toThrow()
  })
})
