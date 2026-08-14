/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_FUNCTIONS,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import {
  classifyLiteratureRollout,
  resolveLostAcknowledgement,
  type LiteratureRolloutObservation,
} from './lib/reconciliation'

const ROOT = process.cwd()
const EXPECTED_TABLES = [...LITERATURE_FOUNDATION_TABLES]
const EXPECTED_FUNCTIONS = [...new Set(LITERATURE_FOUNDATION_FUNCTIONS.map((fn) => fn.name))]

function observation(
  overrides: Partial<LiteratureRolloutObservation> = {},
): LiteratureRolloutObservation {
  return {
    observationComplete: true,
    recordedMigrationVersions: ['20260727032621'],
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

describe('literature rollout reconciliation', () => {
  it('classifies a correct application', () => {
    const verdict = classifyLiteratureRollout(observation())
    expect(verdict.classification).toBe('applied_correct')
    expect(verdict.nextAction).toBe('proceed')
  })

  it('classifies a target where nothing was applied', () => {
    const verdict = classifyLiteratureRollout(
      observation({
        recordedMigrationVersions: [],
        presentTables: [],
        presentFunctions: [],
      }),
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

  it('detects an omitted object as a partial incident rather than a clean result', () => {
    const verdict = classifyLiteratureRollout(
      observation({ presentTables: EXPECTED_TABLES.slice(0, 4) }),
    )
    expect(verdict.classification).toBe('partial_incident')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    expect(verdict.findings.join(' ')).toMatch(/Missing tables/u)
  })

  it('detects an omitted function', () => {
    const verdict = classifyLiteratureRollout(
      observation({ presentFunctions: EXPECTED_FUNCTIONS.slice(0, 2) }),
    )
    expect(verdict.classification).toBe('partial_incident')
    expect(verdict.findings.join(' ')).toMatch(/Missing functions/u)
  })

  it('detects objects present with no recorded migration history', () => {
    const verdict = classifyLiteratureRollout(observation({ recordedMigrationVersions: [] }))
    expect(verdict.classification).toBe('partial_incident')
  })

  it('detects a substituted or drifted object set', () => {
    const verdict = classifyLiteratureRollout(
      observation({ unexpectedLiteratureObjects: ['table:literature_shadow'] }),
    )
    expect(verdict.classification).toBe('applied_drifted')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
  })

  it('detects a failed security check as drift', () => {
    const verdict = classifyLiteratureRollout(observation({ securityChecksPassed: false }))
    expect(verdict.classification).toBe('applied_drifted')
  })

  it('detects data present after a foundation-only rollout', () => {
    const verdict = classifyLiteratureRollout(observation({ totalRowCount: 1 }))
    expect(verdict.classification).toBe('applied_drifted')
    expect(verdict.findings.join(' ')).toMatch(/imports no data/u)
  })

  it('detects a wrong recorded migration version', () => {
    const verdict = classifyLiteratureRollout(
      observation({ recordedMigrationVersions: ['20260809231651'] }),
    )
    expect(verdict.classification).toBe('applied_drifted')
  })

  it('never permits retry, reapplication, compensation, or history edits in any classification', () => {
    const cases: Partial<LiteratureRolloutObservation>[] = [
      {},
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
  })
})

describe('reconciliation and postflight capability boundaries', () => {
  it('the reconciliation module cannot reach a database or spawn a process', async () => {
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

  it('the preflight never applies anything', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/preflight.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/apply_migration|db\s+push|migration\s+repair/u)
  })

  it('no dedicated-supabase module reaches a package, import, or compensation operation', async () => {
    for (const file of [
      'scripts/literature-dedicated-supabase/preflight.ts',
      'scripts/literature-dedicated-supabase/postflight.ts',
      'scripts/literature-dedicated-supabase/rehearse-foundation.ts',
      'scripts/literature-dedicated-supabase/lib/reconciliation.ts',
      'scripts/literature-dedicated-supabase/lib/preflight-rules.ts',
      'scripts/literature-dedicated-supabase/lib/foundation-catalog.ts',
      'scripts/literature-dedicated-supabase/lib/target-observation.ts',
      'scripts/literature-dedicated-supabase/lib/disposable-target.ts',
    ]) {
      const source = await readFile(resolve(ROOT, file), 'utf8')
      expect(source).not.toMatch(
        /apply_literature_gold_import_v2|compensate_literature_gold_import/u,
      )
      expect(source).not.toMatch(/generate-gold-import-compensation-package/u)
      expect(source).not.toMatch(/held[-_]?out/iu)
    }
  })
})
