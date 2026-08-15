/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import {
  classifyLiteratureRollout,
  resolveLostAcknowledgement,
  type LiteratureRolloutObservation,
} from './lib/reconciliation'

const ROOT = process.cwd()

function observation(
  overrides: Partial<LiteratureRolloutObservation> = {},
): LiteratureRolloutObservation {
  return {
    observationComplete: true,
    recordedMigrationVersions: ['20260727032621'],
    presentTables: [...LITERATURE_FOUNDATION_TABLES],
    presentFunctions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    expectedTables: [...LITERATURE_FOUNDATION_TABLES],
    expectedFunctions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    unexpectedLiteratureObjects: [],
    totalRowCount: 0,
    securityChecksPassed: true,
    ...overrides,
  }
}

describe('no reachable success verdict while Layer 3 is absent (B-1/M-3)', () => {
  it('classifies even a perfect observation as provider_attestation_required / stop', () => {
    const verdict = classifyLiteratureRollout(observation())
    expect(verdict.classification).toBe('provider_attestation_required')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    expect(verdict.contentAssessment).toBe('catalog_matches_expected_nonauthoritative')
    expect(verdict.findings[0]).toMatch(/not implemented/u)
  })

  it('never emits applied_correct or proceed for any observation shape', () => {
    const variants: Partial<LiteratureRolloutObservation>[] = [
      {},
      { observationComplete: false },
      { recordedMigrationVersions: [] },
      { recordedMigrationVersions: ['a', 'b'] },
      { presentTables: [] },
      { presentFunctions: [] },
      { totalRowCount: 5 },
      { totalRowCount: null },
      { securityChecksPassed: false },
      { unexpectedLiteratureObjects: ['v:literature_articles_view'] },
    ]
    for (const variant of variants) {
      const verdict = classifyLiteratureRollout(observation(variant))
      expect(verdict.classification).toBe('provider_attestation_required')
      expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
      const serialized = JSON.stringify(verdict)
      expect(serialized).not.toContain('applied_correct')
      expect(serialized).not.toContain('"proceed"')
      expect(serialized).not.toContain('ready_to_apply')
    }
  })

  it('ignores forged attestation-shaped fields smuggled into the observation', () => {
    // The prior design accepted a targetAttestation input; a forged {status:'attested'} then
    // produced applied_correct/proceed. The input type no longer has such a field, and a cast
    // cannot bring the behavior back.
    const forged = {
      ...observation(),
      targetAttestation: { status: 'attested' },
      attested: true,
      authoritative: true,
    } as never
    const verdict = classifyLiteratureRollout(forged)
    expect(verdict.classification).toBe('provider_attestation_required')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    expect(JSON.stringify(verdict)).not.toContain('applied_correct')
  })
})

describe('non-authoritative content assessment', () => {
  it('assesses a byte-perfect content match, explicitly nonauthoritatively', () => {
    const verdict = classifyLiteratureRollout(observation())
    expect(verdict.contentAssessment).toBe('catalog_matches_expected_nonauthoritative')
    expect(verdict.findings.join(' ')).toMatch(/statement about a document/u)
  })

  it('does not require the recorded version to equal the filename version (H-5)', () => {
    const verdict = classifyLiteratureRollout(
      observation({ recordedMigrationVersions: ['20990101000000'] }),
    )
    expect(verdict.contentAssessment).toBe('catalog_matches_expected_nonauthoritative')
  })

  it('assesses absent history and absent objects as content-absent', () => {
    const verdict = classifyLiteratureRollout(
      observation({ recordedMigrationVersions: [], presentTables: [], presentFunctions: [] }),
    )
    expect(verdict.contentAssessment).toBe('content_absent_nonauthoritative')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
  })

  it('assesses an incomplete observation as incomplete and stops', () => {
    for (const variant of [
      { observationComplete: false },
      { recordedMigrationVersions: null },
      { presentTables: null },
      { presentFunctions: null },
    ] as const) {
      const verdict = classifyLiteratureRollout(observation(variant))
      expect(verdict.contentAssessment).toBe('content_observation_incomplete_nonauthoritative')
      expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    }
  })

  it('assesses omitted objects as a partial incident', () => {
    const verdict = classifyLiteratureRollout(
      observation({
        presentTables: LITERATURE_FOUNDATION_TABLES.filter(
          (table) => table !== 'literature_import_errors',
        ),
      }),
    )
    expect(verdict.contentAssessment).toBe('content_partial_incident_nonauthoritative')
    expect(verdict.findings.join(' ')).toMatch(/literature_import_errors/u)
  })

  it('assesses more than one recorded migration as a partial incident', () => {
    const verdict = classifyLiteratureRollout(
      observation({ recordedMigrationVersions: ['20260727032621', '20260727032622'] }),
    )
    expect(verdict.contentAssessment).toBe('content_partial_incident_nonauthoritative')
  })

  it('assesses drift: unexpected objects, failed security checks, or data present', () => {
    for (const variant of [
      { unexpectedLiteratureObjects: ['v:literature_articles_view'] },
      { securityChecksPassed: false },
      { securityChecksPassed: null },
      { totalRowCount: 12 },
      { totalRowCount: null },
      { totalRowCount: -1 },
      { totalRowCount: 0.5 },
    ] as const) {
      const verdict = classifyLiteratureRollout(observation(variant))
      expect(verdict.contentAssessment).toBe('content_drifted_nonauthoritative')
      expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    }
  })

  it('never permits retry, reapplication, compensation, or history edits in any assessment', () => {
    const variants: Partial<LiteratureRolloutObservation>[] = [
      {},
      { observationComplete: false },
      { recordedMigrationVersions: [] },
      { presentTables: [] },
      { totalRowCount: 3 },
      { securityChecksPassed: false },
    ]
    for (const variant of variants) {
      const verdict = classifyLiteratureRollout(observation(variant))
      expect(verdict.automaticRetryPermitted).toBe(false)
      expect(verdict.automaticReapplicationPermitted).toBe(false)
      expect(verdict.automaticCompensationPermitted).toBe(false)
      expect(verdict.migrationHistoryEditPermitted).toBe(false)
    }
  })

  it('resolves a lost acknowledgement to read-only reconciliation, never a retry', () => {
    const resolution = resolveLostAcknowledgement()
    expect(resolution.nextAction).toBe('stop_read_only_reconciliation')
    expect(resolution.automaticRetryPermitted).toBe(false)
    expect(resolution.instruction).toMatch(/provider_attestation_required/u)
  })
})

describe('reconciliation capability boundaries', () => {
  it('cannot reach a database or spawn a process', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/lib/reconciliation.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/child_process|spawn|exec|psql|createClient|fetch\(/u)
  })

  it('contains no success verdict member at all', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/lib/reconciliation.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/'applied_correct'/u)
    expect(source).not.toMatch(/'proceed'/u)
    expect(source).not.toMatch(/'attested'/u)
  })

  it('the postflight never applies, retries, reapplies, or repairs', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/postflight.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/runCommand\(\s*['"]supabase['"]/u)
    expect(source).not.toMatch(/spawn|execFile/u)
    expect(source).not.toMatch(/migration\s+repair/iu)
    expect(source).not.toMatch(/'applied_correct'|'proceed'/u)
  })

  it('the postflight exit status is unconditionally nonzero while Layer 3 is absent', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/postflight.ts'),
      'utf8',
    )
    expect(source).toMatch(/process\.exitCode = 1/u)
    expect(source).not.toMatch(/process\.exitCode = 0/u)
  })
})
