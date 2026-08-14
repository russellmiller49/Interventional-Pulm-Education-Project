/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import { LITERATURE_FOUNDATION_MIGRATION } from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import type { LiteratureAttestationVerdict } from '../../src/features/literature/dedicated-supabase/attestation'
import {
  classifyLiteratureRollout,
  resolveLostAcknowledgement,
  type LiteratureRolloutObservation,
} from './lib/reconciliation'

const ROOT = process.cwd()
const EXPECTED_TABLES = [...LITERATURE_FOUNDATION_TABLES]
const EXPECTED_FUNCTIONS = [...LITERATURE_FOUNDATION_FUNCTION_NAMES]

const ATTESTED: LiteratureAttestationVerdict = {
  status: 'attested',
  attestation: {
    mechanism: 'supabase_project_scoped_read_only_mcp_v1',
    providerProjectRef: 'itcttmkxdxvwmwcmzmey',
    providerProjectUrl: 'https://itcttmkxdxvwmwcmzmey.supabase.co',
    queryBundleSha256: 'a'.repeat(64),
    repositoryCommit: 'b'.repeat(40),
    migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    capturedAt: '2026-08-14T12:00:00.000Z',
    contentSha256: 'c'.repeat(64),
    completeness: 'complete',
  },
}

const UNATTESTED: LiteratureAttestationVerdict = {
  status: 'rejected',
  reason: 'provider_attestation_required',
  detail: 'no provider adapter',
}

function observation(
  overrides: Partial<LiteratureRolloutObservation> = {},
): LiteratureRolloutObservation {
  return {
    targetAttestation: ATTESTED,
    observationComplete: true,
    recordedMigrationVersions: ['20260814120000'],
    presentTables: EXPECTED_TABLES,
    presentFunctions: EXPECTED_FUNCTIONS,
    expectedTables: EXPECTED_TABLES,
    expectedFunctions: EXPECTED_FUNCTIONS,
    unexpectedLiteratureObjects: [],
    totalRowCount: 0,
    securityChecksPassed: true,
    ...overrides,
  }
}

describe('target identity is checked first (M-3)', () => {
  it('never emits applied_correct for an unproven target, however perfect the catalog', () => {
    const verdict = classifyLiteratureRollout(observation({ targetAttestation: UNATTESTED }))
    expect(verdict.classification).toBe('provider_attestation_required')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    expect(verdict.classification).not.toBe('applied_correct')
    expect(verdict.nextAction).not.toBe('proceed')
  })

  it.each([
    ['wrong project ref', 'wrong_project_ref'],
    ['stale evidence', 'stale_attestation'],
    ['wrong query bundle', 'wrong_query_bundle'],
    ['wrong commit', 'wrong_repository_commit'],
    ['incomplete capture', 'incomplete_capture'],
  ])('stops on %s', (_label, reason) => {
    const verdict = classifyLiteratureRollout(
      observation({
        targetAttestation: {
          status: 'rejected',
          reason: reason as 'wrong_project_ref',
          detail: 'x',
        },
      }),
    )
    expect(verdict.classification).toBe('provider_attestation_required')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
  })

  it('reports the attestation reason in its findings', () => {
    const verdict = classifyLiteratureRollout(observation({ targetAttestation: UNATTESTED }))
    expect(verdict.findings.join(' ')).toMatch(/provider_attestation_required/u)
    expect(verdict.findings.join(' ')).toMatch(/non-authoritative/iu)
  })
})

describe('literature rollout reconciliation', () => {
  it('classifies a correct application against an attested target', () => {
    const verdict = classifyLiteratureRollout(observation())
    expect(verdict.classification).toBe('applied_correct')
    expect(verdict.nextAction).toBe('proceed')
  })

  it('does not require the recorded version to equal the filename version (H-5)', () => {
    // The provider assigns the version; only the count is asserted.
    for (const version of ['20260727032621', '20260814120000', 'anything']) {
      expect(
        classifyLiteratureRollout(observation({ recordedMigrationVersions: [version] }))
          .classification,
      ).toBe('applied_correct')
    }
  })

  it('classifies a target where nothing was applied', () => {
    const verdict = classifyLiteratureRollout(
      observation({ recordedMigrationVersions: [], presentTables: [], presentFunctions: [] }),
    )
    expect(verdict.classification).toBe('not_applied')
    expect(verdict.nextAction).toBe('reauthorize_from_preflight')
  })

  it('classifies an incomplete observation as ambiguous and stops', () => {
    for (const partial of [
      { observationComplete: false },
      { recordedMigrationVersions: null },
      { presentTables: null },
      { presentFunctions: null },
    ] as Partial<LiteratureRolloutObservation>[]) {
      const verdict = classifyLiteratureRollout(observation(partial))
      expect(verdict.classification).toBe('ambiguous')
      expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    }
  })

  it('detects omitted objects as a partial incident', () => {
    expect(
      classifyLiteratureRollout(observation({ presentTables: EXPECTED_TABLES.slice(0, 4) }))
        .classification,
    ).toBe('partial_incident')
    expect(
      classifyLiteratureRollout(observation({ presentFunctions: EXPECTED_FUNCTIONS.slice(0, 2) }))
        .classification,
    ).toBe('partial_incident')
    expect(
      classifyLiteratureRollout(observation({ recordedMigrationVersions: [] })).classification,
    ).toBe('partial_incident')
  })

  it('detects more than one recorded migration as a partial incident', () => {
    expect(
      classifyLiteratureRollout(observation({ recordedMigrationVersions: ['a', 'b'] }))
        .classification,
    ).toBe('partial_incident')
  })

  it('detects drift: unexpected objects, failed security checks, or data present', () => {
    expect(
      classifyLiteratureRollout(
        observation({ unexpectedLiteratureObjects: ['v:literature_shadow'] }),
      ).classification,
    ).toBe('applied_drifted')
    expect(
      classifyLiteratureRollout(observation({ securityChecksPassed: false })).classification,
    ).toBe('applied_drifted')
    expect(classifyLiteratureRollout(observation({ totalRowCount: 1 })).classification).toBe(
      'applied_drifted',
    )
  })

  describe('row count validation (L-1)', () => {
    it('stops when the row count is missing', () => {
      const verdict = classifyLiteratureRollout(observation({ totalRowCount: null }))
      expect(verdict.classification).toBe('applied_drifted')
      expect(verdict.findings.join(' ')).toMatch(/row counts could not be evaluated/u)
    })

    it('stops when the row count is non-zero', () => {
      expect(
        classifyLiteratureRollout(observation({ totalRowCount: 42 })).findings.join(' '),
      ).toMatch(/imports no data/u)
    })

    it('stops when the row count is not a non-negative integer', () => {
      for (const value of [-1, 1.5]) {
        const verdict = classifyLiteratureRollout(observation({ totalRowCount: value }))
        expect(verdict.classification).toBe('applied_drifted')
      }
    })
  })

  it('never permits retry, reapplication, compensation, or history edits in any classification', () => {
    const cases: Partial<LiteratureRolloutObservation>[] = [
      {},
      { targetAttestation: UNATTESTED },
      { observationComplete: false },
      { recordedMigrationVersions: [], presentTables: [], presentFunctions: [] },
      { presentTables: EXPECTED_TABLES.slice(0, 2) },
      { securityChecksPassed: false },
      { totalRowCount: 42 },
    ]
    for (const partial of cases) {
      const verdict = classifyLiteratureRollout(observation(partial))
      expect(verdict.automaticRetryPermitted).toBe(false)
      expect(verdict.automaticReapplicationPermitted).toBe(false)
      expect(verdict.automaticCompensationPermitted).toBe(false)
      expect(verdict.migrationHistoryEditPermitted).toBe(false)
    }
  })

  it('resolves a lost acknowledgement to read-only reconciliation, never a retry', () => {
    const resolution = resolveLostAcknowledgement()
    expect(resolution.automaticRetryPermitted).toBe(false)
    expect(resolution.nextAction).toBe('stop_read_only_reconciliation')
    expect(resolution.instruction).toMatch(/Do not resend/u)
    expect(resolution.instruction).toMatch(/provider-bound/u)
  })
})

describe('reconciliation capability boundaries', () => {
  it('cannot reach a database or spawn a process', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/lib/reconciliation.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/node:child_process|@supabase|createClient\(|docker|psql/u)
  })

  it('the postflight never applies, retries, reapplies, or repairs', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/postflight.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/child_process|apply_migration|db\s+push|migration\s+repair/u)
    expect(source).not.toMatch(/\binsert\s+into\b|\bupdate\s+\w+\s+set\b|\bdelete\s+from\b/iu)
  })

  it('the postflight exit status agrees with the classification', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/postflight.ts'),
      'utf8',
    )
    // Only applied_correct exits 0; there is no separate "warn but succeed" branch.
    expect(source).toMatch(/verdict\.classification !== 'applied_correct'/u)
  })
})
