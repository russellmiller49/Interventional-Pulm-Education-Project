import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  assertExactGeneratedPackageReferenceV2,
  assertMigrationEquivalentPostV2SeedIdentity,
  controlledFaultTransactionSql,
  renderOwnerFirstFunctionRawAclV2,
  v2StateSql,
} from './execute-exact-gold-import-compensation-package-v2'
import {
  GOLD_IMPORT_PRE_V1_BACKUP_PHYSICAL_STATE_SHA256_V2,
  V2_REHEARSAL_TASK_BRANCH,
  authenticateV2RehearsalRepositoryHead,
  assertAuthenticatedPreV1BackupIdentityV2,
  assertV2RehearsalRepositoryUnchanged,
  executeCompleteV2Rehearsal,
  runExactPackageRehearsalV2Cli,
} from './rehearse-exact-gold-import-compensation-package-v2'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import type { V2DisposablePathResult } from './rehearse-gold-import-compensation-db-v2'
import type { V2CanonicalAuthorizationBindings } from './gold-import-compensation-rehearsal-evidence-v2'
import type { DisposableContainerCleanupOutcome } from './rehearse-exact-gold-import-compensation-package-v1'
import { buildProtectedV2OperatorBundle } from './protected-gold-import-contract-v2-recovery-bundle'
import {
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  expectedObservedAuditIdentityFromArtifact,
} from './gold-import-contract-v2-catalog-expectations'
import { validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile } from './gold-import-contract-v2-catalog-audit'

let AUTHORIZATION_BINDINGS: V2CanonicalAuthorizationBindings

function cleanup(): DisposableContainerCleanupOutcome {
  return {
    absenceChecks: [
      { identifier: 'owned', kind: 'exact_name', present: false },
      { identifier: 'a'.repeat(64), kind: 'container_id', present: false },
    ],
    absenceVerification: 'verified_absent',
    attempted: true,
    containerId: 'a'.repeat(64),
    containerName: 'owned',
    errors: [],
    outcome: 'removed_and_verified_absent',
    removalCommandSucceeded: true,
  }
}

function result(path: 'fresh' | 'upgrade'): V2DisposablePathResult {
  const evidence = Buffer.from(`${path}-canonical-evidence\n`)
  return {
    canonicalArtifacts: new Map([
      ['canonical-manifest.sha256', Buffer.from(`${'a'.repeat(64)}  evidence\n`)],
      ['v2-rehearsal-evidence.json', evidence],
    ]),
    cleanup: cleanup(),
    evidenceAuthority: 'canonical_delivery_evidence',
    migrationPath: path,
    migrationSha256: 'b'.repeat(64),
    rawReceipt: {},
    schemaOnlyTransition: {} as V2DisposablePathResult['schemaOnlyTransition'],
  }
}

describe('exact V2 package rehearsal entrypoint', () => {
  beforeAll(async () => {
    const operatorBundle = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
    AUTHORIZATION_BINDINGS = {
      completeCatalogAudit: validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
        expectedObservedAuditIdentityFromArtifact(
          committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
            'supabase_admin_owner_v1',
            'disposable',
          ),
        ),
        'supabase_admin_owner_v1',
        'disposable',
      ),
      expectedCatalog: buildProtectedV2ExpectedCatalogBinding(
        'supabase_admin_owner_v1',
        'disposable',
      ),
      operatorBundle,
      operatorBundleBinding: buildProtectedV2RuntimeBundleBinding(operatorBundle),
    }
  })

  test('correlates controlled-fault post-state to the captured receipt operation', () => {
    const operationId = '00000000-0000-4000-8000-000000000001'
    const sql = v2StateSql('00000000-0000-4000-8000-000000000002', operationId)
    expect(sql).toContain("where receipt.value ->> 'operationId' = $v2_exact_")
    expect(sql).toContain(operationId)
  })

  test('keeps callback, reference, and direct-executor package aliases outside private authority', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'scripts/literature/execute-exact-gold-import-compensation-package-v2.ts',
      ),
      'utf8',
    )
    const bootstrapStart = source.indexOf(
      'export function createBootstrappedExactPackageDatabaseExecutorV2',
    )
    const directStart = source.indexOf('export function createExactPackageDatabaseExecutorV2')
    const bootstrap = source.slice(bootstrapStart, directStart)
    const direct = source.slice(directStart)

    expect(bootstrap).toContain(
      'const privatePackage = verifyGeneratedGoldImportCompensationPackageV2(generated.package)',
    )
    expect(bootstrap).toContain(
      'package: verifyGeneratedGoldImportCompensationPackageV2(privatePackage)',
    )
    expect(bootstrap).toContain(
      'return verifyGeneratedGoldImportCompensationPackageV2(referencePackage)',
    )
    expect(direct).toContain(
      'const privatePackage = verifyGeneratedGoldImportCompensationPackageV2(package_)',
    )
    expect(direct).toContain('const plan = privatePackage.importPlan')
    expect(direct).not.toContain('const plan = package_.importPlan')
    expect(direct).toContain('bindDisposableCompensation(privatePackage, imported)')
    expect(direct).toContain('verifyCompensationPayloadCopies(context, privatePackage)')
    expect(bootstrap).toContain('referenceMigrationReceiptGate')
    expect(bootstrap).toContain('migrationReceiptGate: privatePackage.migrationReceiptGate')
    const gateIndex = direct.indexOf(
      'requireIssuedGoldImportCompensationV2MigrationReceiptGateForBinding(',
    )
    const firstQueryIndex = direct.indexOf('context.queryJson(')
    const firstRpcIndex = direct.indexOf('bindDisposableImportAuthorization(plan)')
    expect(gateIndex).toBeGreaterThan(-1)
    expect(firstQueryIndex).toBeGreaterThan(gateIndex)
    expect(firstRpcIndex).toBeGreaterThan(gateIndex)
  })

  test('observes the controlled-fault journal in a command after the volatile RPC', () => {
    const operationId = '00000000-0000-4000-8000-000000000001'
    const sql = controlledFaultTransactionSql('public.apply_probe_v2()', {
      batchId: '00000000-0000-4000-8000-000000000002',
      operationId,
    })
    const receiptWrite = sql.indexOf('insert into pg_temp.v2_controlled_fault_receipt')
    const evidenceRead = sql.indexOf('select pg_catalog.jsonb_build_object')
    expect(receiptWrite).toBeGreaterThan(-1)
    expect(evidenceRead).toBeGreaterThan(receiptWrite)
    expect(sql).toContain('from pg_temp.v2_controlled_fault_receipt receipt')
    expect(sql).toContain(operationId)
    expect(sql).toContain("operation.error_sqlstate = 'P7799'")
    expect(sql).toContain('operation.post_physical_state_sha256 is not null')
    expect(sql).toContain('operation.post_effective_state_sha256 is not null')
  })

  test('renders normalized V2 ACL records in exact owner-first catalog order', () => {
    const grant = (grantee: string, grantor: string) => ({
      grantee,
      grantor,
      isGrantable: false,
      privilegeType: 'EXECUTE',
    })
    expect(
      renderOwnerFirstFunctionRawAclV2('supabase_admin', [
        grant('postgres', 'supabase_admin'),
        grant('service_role', 'supabase_admin'),
        grant('supabase_admin', 'supabase_admin'),
      ]),
    ).toBe(
      '{supabase_admin=X/supabase_admin,postgres=X/supabase_admin,service_role=X/supabase_admin}',
    )
    expect(
      renderOwnerFirstFunctionRawAclV2('postgres', [
        grant('service_role', 'postgres'),
        grant('postgres', 'postgres'),
      ]),
    ).toBe('{postgres=X/postgres,service_role=X/postgres}')
  })

  test('authenticates the pre-V1 backup physical projection before applying V1', () => {
    const accepted = {
      batchId: 'fff41ba3-811d-4d28-ba73-9302db3a942a',
      developmentMembershipSha256:
        GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256,
      effectiveStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
      physicalStateSha256: GOLD_IMPORT_PRE_V1_BACKUP_PHYSICAL_STATE_SHA256_V2,
      planningStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
      seedBatchId: 'fff41ba3-811d-4d28-ba73-9302db3a942a',
    }
    expect(() => assertAuthenticatedPreV1BackupIdentityV2(accepted)).not.toThrow()
    expect(() =>
      assertAuthenticatedPreV1BackupIdentityV2({
        ...accepted,
        physicalStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256,
      }),
    ).toThrow('accepted pre-V1')
  })

  test('binds the post-schema V1 physical identity only at the ready-audit boundary', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'scripts/literature/execute-exact-gold-import-compensation-package-v2.ts',
      ),
      'utf8',
    )
    expect(source).toContain(
      'physicalStateSha256: GOLD_IMPORT_V2_READY_STATE_IDENTITIES.physicalStateSha256',
    )
    expect(source).toContain(
      'currentPhysicalStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256',
    )
  })

  test('authenticates exact branch, clean tracked/untracked state, and origin/main ancestry', async () => {
    const repositoryGit = (overrides?: {
      branch?: string
      dirty?: boolean
      noAncestry?: boolean
    }) => ({
      run: jest.fn(async (arguments_: readonly string[]) => {
        const command = arguments_.join(' ')
        if (command === 'symbolic-ref --short HEAD') {
          return { stdout: `${overrides?.branch ?? V2_REHEARSAL_TASK_BRANCH}\n` }
        }
        if (command === 'status --porcelain=v1 --untracked-files=all') {
          return { stdout: overrides?.dirty ? '?? untracked-evidence.json\n' : '' }
        }
        if (command === 'merge-base --is-ancestor origin/main HEAD') {
          if (overrides?.noAncestry) throw new Error('not an ancestor')
          return { stdout: '' }
        }
        if (command === 'rev-parse HEAD') return { stdout: `${'1'.repeat(40)}\n` }
        throw new Error(`Unexpected git command: ${command}`)
      }),
    })

    const clean = repositoryGit()
    await expect(authenticateV2RehearsalRepositoryHead(clean)).resolves.toBe('1'.repeat(40))
    expect(clean.run).toHaveBeenCalledWith(['status', '--porcelain=v1', '--untracked-files=all'])
    await expect(
      authenticateV2RehearsalRepositoryHead(repositoryGit({ branch: 'codex/wrong' })),
    ).rejects.toThrow('exact task branch')
    await expect(
      authenticateV2RehearsalRepositoryHead(repositoryGit({ dirty: true })),
    ).rejects.toThrow('clean tracked and untracked')
    await expect(
      authenticateV2RehearsalRepositoryHead(repositoryGit({ noAncestry: true })),
    ).rejects.toThrow('origin/main')
  })

  test('re-authenticates the same clean repository HEAD after all four runs', async () => {
    await expect(
      assertV2RehearsalRepositoryUnchanged('1'.repeat(40), async () => '1'.repeat(40)),
    ).resolves.toBeUndefined()
    await expect(
      assertV2RehearsalRepositoryUnchanged('1'.repeat(40), async () => '2'.repeat(40)),
    ).rejects.toThrow('HEAD changed')
  })

  test('bootstraps upgrade first, then runs upgrade and fresh twice sequentially', async () => {
    const paths: string[] = []
    const complete = await executeCompleteV2Rehearsal({
      dependencies: {
        executePath: async ({ migrationPath }) => {
          paths.push(migrationPath)
          return result(migrationPath)
        },
      },
      evidenceBindings: AUTHORIZATION_BINDINGS,
      exactPackageExecutor: { execute: async () => ({}) as never },
      seed: {} as never,
    })
    expect(paths).toEqual(['upgrade', 'upgrade', 'fresh', 'fresh'])
    expect(complete.bootstrapUpgrade.migrationPath).toBe('upgrade')
    expect(complete.upgrade).toHaveLength(2)
    expect(complete.fresh).toHaveLength(2)
  })

  test('rejects any caller database/host/SQL target before loading a backup', async () => {
    const loadPreMigrationBackup = jest.fn()
    await expect(
      runExactPackageRehearsalV2Cli(['--database-url', 'postgresql://forbidden'], {
        loadPreMigrationBackup,
        readRepositoryHead: async () => '1'.repeat(40),
      }),
    ).rejects.toThrow('Unknown option')
    expect(loadPreMigrationBackup).not.toHaveBeenCalled()
  })

  test('rejects a rebound but byte-different action plan against the bootstrap reference', () => {
    const referencePlan = Buffer.from('{"actions":[{"action":"import_initial","sequence":1}]}\n')
    const reboundPlan = Buffer.from('{"actions":[{"action":"import_revision","sequence":1}]}\n')
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    expect(() =>
      assertExactGeneratedPackageReferenceV2(
        {
          files: new Map([['immutable-atomic-import-plan-v2.json', referencePlan]]),
          manifestSha256: digest(referencePlan),
        },
        {
          files: new Map([['immutable-atomic-import-plan-v2.json', reboundPlan]]),
          manifestSha256: digest(reboundPlan),
        },
      ),
    ).toThrow('different exact V2 packages')
  })

  test('requires fresh projected seed schema/clinical identity to equal upgraded V1 after V2', () => {
    const upgrade = {
      clinicalAndSchemaSnapshot: { reviewRowsSha256: '1'.repeat(64) },
      v2StateAndIntegrity: {
        effectiveStateSha256: '2'.repeat(64),
        physicalStateSha256: '3'.repeat(64),
      },
    }
    expect(() =>
      assertMigrationEquivalentPostV2SeedIdentity(upgrade, {
        v2StateAndIntegrity: upgrade.v2StateAndIntegrity,
        clinicalAndSchemaSnapshot: upgrade.clinicalAndSchemaSnapshot,
      }),
    ).not.toThrow()
    expect(() =>
      assertMigrationEquivalentPostV2SeedIdentity(upgrade, {
        ...upgrade,
        v2StateAndIntegrity: {
          ...upgrade.v2StateAndIntegrity,
          physicalStateSha256: '4'.repeat(64),
        },
      }),
    ).toThrow('not schema/clinical-state identical')
  })

  test('contains no caller-selectable database, remote, SQL, or held-out argument', async () => {
    const source = await readFile(
      'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
      'utf8',
    )
    for (const forbidden of [
      "'database-url'",
      "'db-url'",
      "'docker-host'",
      "'held-out'",
      "'remote'",
      "'sql'",
      "'target'",
    ]) {
      expect(source).not.toContain(forbidden)
    }
    expect(source).toContain('executeCompleteV2Rehearsal')
    expect(source).toContain("const bootstrapUpgrade = await run('upgrade')")
  })
})
