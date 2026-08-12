/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2 } from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION,
  GOLD_IMPORT_COMPENSATION_V2_RECOVERY_RECEIPT_AUTHORITY_SCHEMA_VERSION,
  PROTECTED_V2_FINALIZED_RECOVERY_RECEIPT_AUTHORITY_PATH,
  buildInternalDisposableMigrationReceiptGate,
  loadCommittedProtectedV2RecoveryReceiptAuthority,
  migrationReceiptGateArtifactBytes,
  parseCommittedProtectedV2RecoveryReceiptAuthority,
  requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit,
  validateGoldImportCompensationV2MigrationReceiptGate,
  validateGoldImportCompensationV2MigrationReceiptGateForAudit,
} from './gold-import-compensation-v2-migration-receipt-gate'
import { LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256 } from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  parseProtectedV2ReceiptRecoveryCommittedAmendment,
} from './protected-gold-import-contract-v2-receipt-recovery-authority'
import { buildCurrentProtectedV2ReceiptRecoveryToolBundle } from './protected-gold-import-contract-v2-receipt-recovery-tool-bundle'
import type { GoldImportCompensationV2ReadyAudit } from './audit-gold-import-compensation-v2'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)
const SHA_D = 'd'.repeat(64)
const SHA_E = 'e'.repeat(64)
const SHA_F = 'f'.repeat(64)
const BATCH_ID = '10000000-0000-4000-8000-000000000001'

function audit(): GoldImportCompensationV2ReadyAudit {
  return {
    completeCatalogAudit: { fullAuditIdentitySha256: SHA_A } as never,
    database: {
      batchId: BATCH_ID,
      developmentMembershipSha256: SHA_B,
      developmentPlanningStateSha256: SHA_C,
      effectiveStateSha256: SHA_D,
      physicalStateSha256: SHA_E,
    },
    expectedCatalog: { bindingSha256: SHA_F } as never,
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: SHA_A,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
    target: 'disposable_clone',
    v2PreImportState: {
      effectiveStateSha256: SHA_D,
      physicalStateSha256: SHA_E,
    },
  } as unknown as GoldImportCompensationV2ReadyAudit
}

function reboundGate(
  gate: ReturnType<typeof buildInternalDisposableMigrationReceiptGate>,
  update: Record<string, unknown>,
) {
  const { gateIdentitySha256, ...content } = { ...gate, ...update }
  void gateIdentitySha256
  return { ...content, gateIdentitySha256: sha256Canonical(content) }
}

describe('target-discriminated finalized migration receipt gate', () => {
  it('builds only a complete, non-authorizing, non-production disposable proof', () => {
    const readyAudit = audit()
    const gate = buildInternalDisposableMigrationReceiptGate(readyAudit)
    expect(gate).toMatchObject({
      auditTarget: 'disposable_clone',
      compensationAuthorized: false,
      importAuthorized: false,
      kind: 'disposable_rehearsal',
      migrationReceiptComplete: true,
      productionUseAllowed: false,
      schemaVersion: GOLD_IMPORT_COMPENSATION_V2_MIGRATION_RECEIPT_GATE_SCHEMA_VERSION,
      source: { receiptKind: 'disposable_rehearsal' },
    })
    expect(validateGoldImportCompensationV2MigrationReceiptGateForAudit(gate, readyAudit)).toEqual(
      gate,
    )
    expect(migrationReceiptGateArtifactBytes(gate).toString('utf8')).toBe(
      `${JSON.stringify(JSON.parse(canonicalJson(gate)), null, 2)}\n`,
    )
  })

  it('fails closed for target, catalog, state, authorization, and extra-field drift', () => {
    const readyAudit = audit()
    const gate = buildInternalDisposableMigrationReceiptGate(readyAudit)
    expect(() =>
      validateGoldImportCompensationV2MigrationReceiptGateForAudit(
        reboundGate(gate, { batchId: '20000000-0000-4000-8000-000000000002' }),
        readyAudit,
      ),
    ).toThrow('does not match the authenticated package audit')
    expect(() =>
      validateGoldImportCompensationV2MigrationReceiptGate({
        ...gate,
        importAuthorized: true,
      }),
    ).toThrow()
    expect(() =>
      validateGoldImportCompensationV2MigrationReceiptGate({ ...gate, bypass: true }),
    ).toThrow()
    expect(() =>
      validateGoldImportCompensationV2MigrationReceiptGate({
        ...gate,
        gateIdentitySha256: SHA_F,
      }),
    ).toThrow('identity is invalid')
  })

  it('does not treat a publicly reproducible self-hash as loader-issued provenance', () => {
    const readyAudit = audit()
    const issued = buildInternalDisposableMigrationReceiptGate(readyAudit)
    const forgedCanonicalClone = JSON.parse(JSON.stringify(issued)) as unknown
    expect(
      validateGoldImportCompensationV2MigrationReceiptGateForAudit(
        forgedCanonicalClone,
        readyAudit,
      ),
    ).toEqual(issued)
    expect(() =>
      requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit(
        forgedCanonicalClone,
        readyAudit,
      ),
    ).toThrow('not issued by a strict finalized-receipt loader')
    expect(
      requireIssuedGoldImportCompensationV2MigrationReceiptGateForAudit(issued, readyAudit),
    ).toEqual(issued)
  })

  it('parses only a canonical committed three-hash recovery authority', () => {
    const authority = {
      amendmentIdentitySha256: SHA_A,
      originalIntentSha256: SHA_B,
      recoveryToolBundleSha256: SHA_C,
    }
    const document = {
      authority,
      authorityIdentitySha256: sha256Canonical(authority),
      schemaVersion: GOLD_IMPORT_COMPENSATION_V2_RECOVERY_RECEIPT_AUTHORITY_SCHEMA_VERSION,
    }
    const bytes = `${JSON.stringify(JSON.parse(canonicalJson(document)), null, 2)}\n`
    expect(parseCommittedProtectedV2RecoveryReceiptAuthority(bytes)).toEqual(document)
    expect(() => parseCommittedProtectedV2RecoveryReceiptAuthority(bytes.trim())).toThrow(
      'noncanonical or stale',
    )
    expect(() =>
      parseCommittedProtectedV2RecoveryReceiptAuthority(
        `${JSON.stringify({ ...document, authorityIdentitySha256: SHA_D }, null, 2)}\n`,
      ),
    ).toThrow('noncanonical or stale')
  })

  it('binds the committed recovery amendment and receipt authority to the exact current closure', async () => {
    const repositoryRoot = process.cwd()
    const [incidentAuthorityBytes, amendmentBytes, receiptAuthorityBytes] = await Promise.all([
      readFile(
        resolve(repositoryRoot, PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH),
        'utf8',
      ),
      readFile(
        resolve(repositoryRoot, PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH),
        'utf8',
      ),
      readFile(
        resolve(repositoryRoot, PROTECTED_V2_FINALIZED_RECOVERY_RECEIPT_AUTHORITY_PATH),
        'utf8',
      ),
    ])
    const currentRecoveryToolBundle = await buildCurrentProtectedV2ReceiptRecoveryToolBundle({
      cwd: repositoryRoot,
    })
    const amendment = parseProtectedV2ReceiptRecoveryCommittedAmendment({
      amendmentBytes,
      authorityBytes: incidentAuthorityBytes,
      correctedRecoveryToolBundle: currentRecoveryToolBundle,
      correctedTransitionPolicyIdentitySha256:
        LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
    })
    expect(amendment.correctedRecoveryToolBundle).toEqual(currentRecoveryToolBundle)

    const receiptAuthority =
      parseCommittedProtectedV2RecoveryReceiptAuthority(receiptAuthorityBytes)
    const expectedReference = {
      amendmentIdentitySha256: amendment.amendmentIdentitySha256,
      originalIntentSha256: amendment.historicalIncident.intentSha256,
      recoveryToolBundleSha256: currentRecoveryToolBundle.aggregateSha256,
    }
    expect(receiptAuthority.authority).toEqual(expectedReference)
    expect(await loadCommittedProtectedV2RecoveryReceiptAuthority(repositoryRoot)).toEqual({
      ...expectedReference,
      amendment,
    })
  })

  it('does not confuse canonical gate identity with artifact-byte identity', () => {
    const gate = buildInternalDisposableMigrationReceiptGate(audit())
    expect(gate.gateIdentitySha256).toBe(
      sha256Canonical(
        Object.fromEntries(Object.entries(gate).filter(([key]) => key !== 'gateIdentitySha256')),
      ),
    )
    expect(gate.gateIdentitySha256).not.toBe(
      createHash('sha256').update(migrationReceiptGateArtifactBytes(gate)).digest('hex'),
    )
  })

  it('keeps local gate issuance bound to the module-owned repository and authority loaders', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
      ),
      'utf8',
    )
    expect(source).not.toContain('loadRecoveryAuthority?:')
    expect(source).not.toContain('receiptRoot: string\n}): Promise<GoldImportCompensationV2Local')
    expect(source).toMatch(
      /authority:\s+await loadCommittedProtectedV2RecoveryReceiptAuthority\(CANONICAL_REPOSITORY_ROOT\)/u,
    )
    expect(source).toContain('receiptRoot: CANONICAL_PROTECTED_V2_RECEIPT_ROOT')
  })
})
