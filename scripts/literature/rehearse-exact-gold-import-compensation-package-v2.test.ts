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
  EXACT_V2_REHEARSAL_PATH_ORDER,
  assertAuthenticatedPreV1BackupIdentityV2,
  assertV2RehearsalRepositoryEvidenceUnchanged,
  validateExactV2PackageRehearsalCliArguments,
  validateV2RehearsalCoreRepositoryEvidence,
  type V2RehearsalRepositoryEvidence,
} from './rehearse-exact-gold-import-compensation-package-v2'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'

const CORE_REPOSITORY_EVIDENCE = {
  branch: 'codex/disposable-rehearsal-test',
  cleanTrackedAndUntrackedWorktree: true,
  headSha: '2'.repeat(40),
  originMainIsAncestor: true,
  originMainSha: '1'.repeat(40),
  primaryCheckout: false,
  repositoryRoot: process.cwd(),
} satisfies V2RehearsalRepositoryEvidence

describe('exact V2 package rehearsal entrypoint', () => {
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
    expect(bootstrap).toContain('migrationReceiptGate: referenceMigrationReceiptGate')
    expect(bootstrap).toContain('referenceMigrationReceiptGate ??= generated.migrationReceiptGate')
    expect(bootstrap).toContain('migrationReceiptGate: generated.migrationReceiptGate')
    expect(bootstrap).not.toContain('migrationReceiptGate: privatePackage.migrationReceiptGate')
    const rehearsalSource = await readFile(
      resolve(
        process.cwd(),
        'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
      ),
      'utf8',
    )
    expect(rehearsalSource).toContain(
      'migrationReceiptGate: controller.referenceMigrationReceiptGate()',
    )
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

  test('keeps injected core evidence branch-agnostic and complete', () => {
    expect(validateV2RehearsalCoreRepositoryEvidence(CORE_REPOSITORY_EVIDENCE)).toEqual(
      CORE_REPOSITORY_EVIDENCE,
    )
    expect(() =>
      validateV2RehearsalCoreRepositoryEvidence({
        ...CORE_REPOSITORY_EVIDENCE,
        originMainIsAncestor: false as true,
      }),
    ).toThrow('incomplete or unsafe')
    expect(() =>
      validateV2RehearsalCoreRepositoryEvidence({
        ...CORE_REPOSITORY_EVIDENCE,
        headSha: 'not-a-commit',
      }),
    ).toThrow('incomplete or unsafe')
  })

  test('purely compares identical non-primary repository evidence', () => {
    expect(() =>
      assertV2RehearsalRepositoryEvidenceUnchanged(CORE_REPOSITORY_EVIDENCE, {
        ...CORE_REPOSITORY_EVIDENCE,
      }),
    ).not.toThrow()
    expect(() =>
      assertV2RehearsalRepositoryEvidenceUnchanged(CORE_REPOSITORY_EVIDENCE, {
        ...CORE_REPOSITORY_EVIDENCE,
        headSha: '5'.repeat(40),
      }),
    ).toThrow('Repository evidence changed')
  })

  test('publishes the immutable four-run disposable path order as pure data', () => {
    expect(EXACT_V2_REHEARSAL_PATH_ORDER).toEqual(['upgrade', 'upgrade', 'fresh', 'fresh'])
  })

  test('rejects caller database/host/SQL targets in the pure parser', () => {
    expect(() =>
      validateExactV2PackageRehearsalCliArguments(['--database-url', 'postgresql://forbidden']),
    ).toThrow('Unknown option')
    expect(validateExactV2PackageRehearsalCliArguments([])).toEqual({ help: false })
    expect(validateExactV2PackageRehearsalCliArguments(['--help'])).toEqual({ help: true })
  })

  test('authenticates repository evidence before backup/source reads and exposes no feature bypass', async () => {
    const source = await readFile(
      'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
      'utf8',
    )
    const core = source.slice(
      source.indexOf('async function runExactPackageRehearsalV2WithDependencies'),
    )
    expect(core.indexOf('validateV2RehearsalRepositoryEvidence(')).toBeGreaterThan(-1)
    expect(core.indexOf('dependencies.loadPreMigrationBackup(')).toBeGreaterThan(
      core.indexOf('validateV2RehearsalRepositoryEvidence('),
    )
    expect(source).toContain('inspectGoldImportV2PrimaryMainRepository({ cwd: REPOSITORY_ROOT })')
    expect(source).toContain("requiredArgument(arguments_, 'preimport-capture-one')")
    expect(source).toContain("requiredArgument(arguments_, 'preimport-capture-two')")
    expect(source).toContain('collectGoldImportV2PreimportFixedLocalState()')
    expect(source).toContain('assertGoldImportV2CurrentDatabaseMatchesPackageReadiness({')
    expect(source).toContain('await dependencies.assertCurrentProductionReadiness()')
    expect(source).toContain('postV2PreImportReadiness: {')
    expect(source).toContain('realLocalDatabaseMutated: false')
    expect(source).toContain('realpathSync(fileURLToPath(import.meta.url))')
    expect(source).toContain(
      "'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts'",
    )
    expect(source).toContain('EXECUTING_MODULE_PATH !== EXPECTED_PRODUCTION_MODULE_PATH')
    expect(source).toContain('realpathSync(resolve(process.argv[1])) !== EXECUTING_MODULE_PATH')
    expect(source).toContain('async function runExactPackageRehearsalV2Cli(')
    expect(source).not.toContain('export async function runExactPackageRehearsalV2Cli(')
    expect(source).not.toContain('export interface ExactV2PackageRehearsalCoreDependencies')
    expect(source).not.toContain('export interface ExactV2DisposablePackageRehearsalDependencies')
    expect(source).not.toContain('export async function runExactPackageRehearsalV2Core')
    expect(source).not.toContain('export async function executeCompleteV2Rehearsal')
    expect(source).toContain('export const EXACT_V2_REHEARSAL_PATH_ORDER')
    expect(source).not.toContain('allow-feature-branch')
    expect(source).not.toContain('ip-literature-v2-physical-hash-receipt-recovery-v1')
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
    expect(source).toContain('const bootstrapUpgrade = await run(EXACT_V2_REHEARSAL_PATH_ORDER[0])')
  })
})
