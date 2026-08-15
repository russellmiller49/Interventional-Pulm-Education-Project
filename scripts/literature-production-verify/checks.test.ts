/** @jest-environment node */

/**
 * The distinctions this tool exists to make.
 *
 * Every test here supplies observations directly. That is the design paying off: "the count RPC
 * failed" and "the table is empty" are two different inputs, and a test can hand over both and
 * assert the verdicts differ. In a design where the checks did their own reading, the failing case
 * would need a broken database to reproduce, and so it would never be tested.
 */

import {
  checkApplicationRuntime,
  checkBatchReconciliation,
  checkCanaryCount,
  checkCanaryIdempotency,
  checkCatalogInventory,
  checkFoundationEmpty,
  checkFoundationPopulated,
  checkFullCorpus,
  checkGoldWorkflowUnavailable,
  checkMigrationHistory,
  checkNoDuplicatePmids,
  checkProjectIdentity,
  checkPublicExclusion,
  checkReceiptConsistency,
  checkSchemaPresence,
  checkSearchBehaviour,
  checkSearchVectors,
  checkSitemapExclusion,
  hasAmbiguousBatch,
  resolveSchemaPresence,
  type BatchReconciliation,
  type CatalogAttestation,
  type CheckResult,
  type MigrationHistoryEntry,
} from './lib/checks'
import type { BatchReceipt } from './lib/collect'
import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANARY_RECORD_COUNT,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_FOUNDATION_TRIGGERS,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
  LITERATURE_PRODUCTION_CATALOG_TOTALS,
  LITERATURE_PRODUCTION_MIGRATION,
} from './lib/identity'
import { failed, observed, skipped, unavailable, type Observation } from './lib/observation'

function outcomeOf(results: readonly CheckResult[], id: string): CheckResult['outcome'] {
  const match = results.find((result) => result.id === id)
  if (!match) throw new Error(`no check produced ${id}`)
  return match.outcome
}

function tableCounts(value: (table: string) => Observation<number>) {
  return Object.fromEntries(LITERATURE_FOUNDATION_TABLES.map((table) => [table, value(table)]))
}

const ALL_EMPTY = tableCounts(() => observed(0))
const ALL_ABSENT = tableCounts(() => unavailable<number>('PGRST205'))
const ALL_BROKEN = tableCounts(() => failed<number>('http_500', 'gateway error'))

/* ------------------------------------------------------------------------------------------- */

describe('a missing schema is not an empty schema', () => {
  it('reports every table absent as a missing foundation, not as emptiness', () => {
    const presence = resolveSchemaPresence(ALL_ABSENT)
    expect(presence.state).toBe('absent')
    const result = checkSchemaPresence(presence)
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/has not been applied/u)
  })

  it('reports every table present-and-empty as a ready foundation', () => {
    const presence = resolveSchemaPresence(ALL_EMPTY)
    expect(presence.state).toBe('present')
    expect(checkSchemaPresence(presence).outcome).toBe('pass')
    expect(checkFoundationEmpty(ALL_EMPTY).outcome).toBe('pass')
  })

  it('gives the two cases different verdicts from the same check', () => {
    // The whole point, stated as one assertion: an operator reading "0 rows" must be able to tell
    // whether the tables exist.
    expect(checkSchemaPresence(resolveSchemaPresence(ALL_ABSENT)).outcome).not.toBe(
      checkSchemaPresence(resolveSchemaPresence(ALL_EMPTY)).outcome,
    )
  })

  it('refuses to call a half-applied foundation either present or absent', () => {
    const half = tableCounts((table) =>
      table === LITERATURE_FOUNDATION_TABLES[0] ? observed(0) : unavailable<number>('PGRST205'),
    )
    const presence = resolveSchemaPresence(half)
    expect(presence.state).toBe('partial')
    expect(checkSchemaPresence(presence).outcome).toBe('fail')
  })
})

describe('a failed read never becomes zero', () => {
  it('reports an unknown schema state when the reads broke', () => {
    const presence = resolveSchemaPresence(ALL_BROKEN)
    // Not `absent`: a 500 proves nothing about whether the table is there.
    expect(presence.state).toBe('partial')
    expect(checkSchemaPresence(presence).outcome).toBe('indeterminate')
  })

  it('does not report an empty foundation when the counts failed', () => {
    const result = checkFoundationEmpty(ALL_BROKEN)
    expect(result.outcome).toBe('indeterminate')
    expect(result.detail).toMatch(/is not zero/u)
  })

  it('does not report an empty corpus when the count failed', () => {
    expect(checkFoundationPopulated(failed('http_500', 'boom')).outcome).toBe('indeterminate')
  })

  it('does not certify public exclusion when the search RPC failed', () => {
    // The dangerous case: a failed search read must not be reported as "0 results, nothing is
    // public". That would certify the strongest safety claim in the package from a broken request.
    const results = checkPublicExclusion(
      failed('http_500', 'boom'),
      failed('count_absent', 'no exact total'),
      failed('network_error', 'ECONNRESET'),
      failed('network_error', 'ECONNRESET'),
    )
    expect(results.every((result) => result.outcome === 'indeterminate')).toBe(true)
    expect(results.some((result) => result.outcome === 'pass')).toBe(false)
  })

  it('does not certify the canary count when the corpus read failed', () => {
    const [exact] = checkCanaryCount(failed('count_absent', 'no exact total'), observed(25))
    expect(exact.outcome).toBe('indeterminate')
  })

  it('distinguishes an unattempted read from a failed one', () => {
    const notAttempted = checkFoundationPopulated(skipped('no credential'))
    expect(notAttempted.outcome).toBe('indeterminate')
    expect(notAttempted.detail).toMatch(/not attempted/u)
  })
})

describe('empty and populated are different verdicts', () => {
  it('fails the populated check on an empty corpus', () => {
    const result = checkFoundationPopulated(observed(0))
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/valid \*empty\* foundation/u)
  })

  it('passes the populated check on a non-empty corpus', () => {
    expect(checkFoundationPopulated(observed(25)).outcome).toBe('pass')
  })

  it('fails the empty check once rows exist', () => {
    const withRows = { ...ALL_EMPTY, literature_articles: observed(25) }
    expect(checkFoundationEmpty(withRows).outcome).toBe('fail')
  })
})

describe('the canary is exactly twenty-five', () => {
  it.each([
    [LITERATURE_CANARY_RECORD_COUNT, 'pass'],
    [24, 'fail'],
    [26, 'fail'],
    [0, 'fail'],
    [250, 'fail'],
  ])('a corpus of %i is %s', (total, expected) => {
    const [exact] = checkCanaryCount(observed(total), observed(total))
    expect(exact.outcome).toBe(expected)
  })

  it('explains a near miss as a failure rather than as nearly right', () => {
    const [exact] = checkCanaryCount(observed(24), observed(24))
    expect(exact.detail).toMatch(/Short by 1/u)
    expect(exact.detail).toMatch(/failed canary, not a nearly-successful one/u)
  })

  it('fails when some records are not unreviewed drafts', () => {
    // 25 rows, but 3 of them curated: the count is right and the canary is not.
    const [, state] = checkCanaryCount(observed(25), observed(22))
    expect(state.outcome).toBe('fail')
  })
})

describe('canary idempotency compares two runs', () => {
  const baseline = observed({
    totalArticles: 25,
    batchCount: 1,
    insertedTotal: 25,
    updatedTotal: 0,
    duplicateTotal: 0,
  })

  it('passes when a second run inserted nothing and the corpus did not move', () => {
    const current = observed({
      totalArticles: 25,
      batchCount: 2,
      insertedTotal: 25,
      updatedTotal: 25,
      duplicateTotal: 25,
    })
    expect(checkCanaryIdempotency(baseline, current).outcome).toBe('pass')
  })

  it('fails when the second run inserted rows', () => {
    const current = observed({
      totalArticles: 50,
      batchCount: 2,
      insertedTotal: 50,
      updatedTotal: 0,
      duplicateTotal: 0,
    })
    const result = checkCanaryIdempotency(baseline, current)
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/inserted 25 row/u)
  })

  it('fails when no second run is evidenced rather than passing vacuously', () => {
    // Same numbers as the baseline and no new batch: nothing ran, so nothing was proven, and a
    // check that passed here would certify idempotency from a single run.
    const result = checkCanaryIdempotency(baseline, baseline)
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/no new batch was recorded/u)
  })

  it('is indeterminate without a baseline', () => {
    expect(checkCanaryIdempotency(skipped('no baseline supplied'), baseline).outcome).toBe(
      'indeterminate',
    )
  })
})

describe('drafts stay out of public reach', () => {
  const denied = observed({ status: 401, denied: true, rowsReturned: null })

  it('passes when the default search returns an observed empty result', () => {
    const results = checkPublicExclusion(observed([]), observed(0), denied, denied)
    expect(results.every((result) => result.outcome === 'pass')).toBe(true)
  })

  it('fails when the default search returns anything', () => {
    const results = checkPublicExclusion(observed([{ pmid: '1' }]), observed(1), denied, denied)
    expect(outcomeOf(results, 'V80-public-search-empty')).toBe('fail')
    expect(outcomeOf(results, 'V81-nothing-published')).toBe('fail')
  })

  it('fails when an anonymous caller gets rows', () => {
    const enumerated = observed({ status: 200, denied: false, rowsReturned: 11 })
    const results = checkPublicExclusion(observed([]), observed(0), enumerated, denied)
    const check = results.find((result) => result.id === 'V82-anonymous-table')
    expect(check?.outcome).toBe('fail')
    expect(check?.detail).toMatch(/treat it as an exposure/u)
  })

  it('fails when an anonymous caller gets a 200 with zero rows', () => {
    // Zero rows today is not a guarantee about tomorrow: reachability is the finding.
    const reachable = observed({ status: 200, denied: false, rowsReturned: 0 })
    const results = checkPublicExclusion(observed([]), observed(0), reachable, denied)
    expect(outcomeOf(results, 'V82-anonymous-table')).toBe('fail')
  })

  it('passes the sitemap check when no Literature URL is listed', () => {
    const sitemap =
      '<?xml version="1.0"?><urlset><url><loc>https://example.test/en/about</loc></url></urlset>'
    expect(checkSitemapExclusion(observed(sitemap)).outcome).toBe('pass')
  })

  it('fails the sitemap check when a draft article URL is listed', () => {
    const sitemap =
      '<?xml version="1.0"?><urlset><url>' +
      '<loc>https://example.test/en/literature/article/40123456</loc></url></urlset>'
    expect(checkSitemapExclusion(observed(sitemap)).outcome).toBe('fail')
  })

  it('is indeterminate when the sitemap could not be fetched', () => {
    expect(checkSitemapExclusion(failed('http_500', 'boom')).outcome).toBe('indeterminate')
  })
})

describe('migration identity', () => {
  const applied: MigrationHistoryEntry[] = [
    {
      version: LITERATURE_PRODUCTION_MIGRATION.version,
      name: LITERATURE_PRODUCTION_MIGRATION.name,
    },
  ]

  it('passes on the applied production identity', () => {
    const results = checkMigrationHistory(observed(applied))
    expect(outcomeOf(results, 'V10-migration-count')).toBe('pass')
    expect(outcomeOf(results, 'V11-migration-identity')).toBe('pass')
  })

  it('fails on a different version', () => {
    // The filename version is the classic wrong answer here: the manifest says outright that the
    // recorded version is provider-assigned and the filename version must not be assumed.
    const results = checkMigrationHistory(
      observed([{ version: '20260727032621', name: 'add_literature_explorer' }]),
    )
    expect(outcomeOf(results, 'V11-migration-identity')).toBe('fail')
  })

  it('refuses to suggest repairing migration history', () => {
    const results = checkMigrationHistory(observed([{ version: '19990101000000' }]))
    const identity = results.find((result) => result.id === 'V11-migration-identity')
    expect(identity?.detail).toMatch(/never repair\s+migration history/u)
  })

  it('fails when a second migration has been applied', () => {
    const results = checkMigrationHistory(
      observed([...applied, { version: '20260901000000', name: 'add_literature_gold_set' }]),
    )
    expect(outcomeOf(results, 'V10-migration-count')).toBe('fail')
  })

  it('is indeterminate with no provider attestation', () => {
    const results = checkMigrationHistory(skipped('no migration history file was supplied'))
    expect(results.every((result) => result.outcome === 'indeterminate')).toBe(true)
  })
})

describe('project identity', () => {
  it('passes for the approved project', () => {
    const results = checkProjectIdentity({
      projectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
      url: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
      canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
    })
    expect(results.every((result) => result.outcome === 'pass')).toBe(true)
  })

  it('names the main application project specifically when it is the target', () => {
    const results = checkProjectIdentity({
      projectRef: LITERATURE_MAIN_APPLICATION_PROJECT_REF,
      url: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
      canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
    })
    const identity = results.find((result) => result.id === 'V01-project-ref')
    expect(identity?.outcome).toBe('fail')
    expect(identity?.detail).toMatch(/main application project/u)
  })

  it('fails a URL that differs from the canonical bytes', () => {
    const results = checkProjectIdentity({
      projectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
      url: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT.replace(/\/$/u, ''),
      canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
    })
    expect(outcomeOf(results, 'V02-canonical-url')).toBe('fail')
  })
})

describe('catalog and privilege drift', () => {
  const clean: CatalogAttestation = {
    tables: [...LITERATURE_FOUNDATION_TABLES],
    functions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    indexes: [...LITERATURE_FOUNDATION_INDEXES],
    triggers: LITERATURE_FOUNDATION_TRIGGERS.map((entry) => entry.trigger),
    policies: [],
    rlsEnabledTables: [...LITERATURE_FOUNDATION_TABLES],
    columnCount: LITERATURE_PRODUCTION_CATALOG_TOTALS.columns,
    constraintCount: LITERATURE_PRODUCTION_CATALOG_TOTALS.constraints,
    tablePrivileges: [
      { table: 'literature_articles', role: 'service_role', privilege: 'SELECT', granted: true },
      { table: 'literature_articles', role: 'anon', privilege: 'SELECT', granted: false },
    ],
  }

  it('passes on the applied foundation', () => {
    const results = checkCatalogInventory(observed(clean))
    expect(results.filter((result) => result.outcome !== 'pass')).toEqual([])
  })

  it('detects an extra table', () => {
    const results = checkCatalogInventory(
      observed({ ...clean, tables: [...clean.tables, 'literature_gold_batches'] }),
    )
    expect(outcomeOf(results, 'V21-table-inventory')).toBe('fail')
  })

  it('detects a missing index', () => {
    const results = checkCatalogInventory(observed({ ...clean, indexes: clean.indexes.slice(1) }))
    expect(outcomeOf(results, 'V23-index-inventory')).toBe('fail')
  })

  it('detects privilege drift toward an unprivileged role', () => {
    const results = checkCatalogInventory(
      observed({
        ...clean,
        tablePrivileges: [
          ...(clean.tablePrivileges ?? []),
          { table: 'literature_articles', role: 'anon', privilege: 'SELECT', granted: true },
        ],
      }),
    )
    const drift = results.find((result) => result.id === 'V26-privilege-grid')
    expect(drift?.outcome).toBe('fail')
    expect(drift?.detail).toMatch(/anon has SELECT on literature_articles/u)
  })

  it('treats a policy as drift rather than as an improvement', () => {
    const results = checkCatalogInventory(observed({ ...clean, policies: [{ name: 'read_own' }] }))
    const rls = results.find((result) => result.id === 'V25-rls-enabled')
    expect(rls?.outcome).toBe('fail')
    expect(rls?.detail).toMatch(/drift rather than an improvement/u)
  })

  it('fails when RLS is off on any table', () => {
    const results = checkCatalogInventory(
      observed({ ...clean, rlsEnabledTables: clean.rlsEnabledTables.slice(1) }),
    )
    expect(outcomeOf(results, 'V25-rls-enabled')).toBe('fail')
  })

  it('is indeterminate with no attestation rather than assuming a clean catalog', () => {
    const results = checkCatalogInventory(skipped('no catalog attestation was supplied'))
    expect(results.every((result) => result.outcome === 'indeterminate')).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------- */

function batch(overrides: Partial<BatchReceipt> = {}): BatchReceipt {
  return {
    id: 'b1',
    status: 'completed',
    source_filename: 'canary.nbib',
    source_file_sha256: 'a'.repeat(64),
    source_kind: 'core_journal',
    records_read: 25,
    unique_pmids: 25,
    inserted_count: 25,
    updated_count: 0,
    duplicate_count: 0,
    error_count: 0,
    started_at: '2026-08-15T00:00:00.000Z',
    completed_at: '2026-08-15T00:01:00.000Z',
    ...overrides,
  }
}

describe('an ambiguous batch stops rather than guesses', () => {
  const ambiguous = observed([batch({ status: 'started', completed_at: null })])

  it('flags a started batch with no completion', () => {
    const results = checkBatchReconciliation(ambiguous)
    const check = results.find((result) => result.id === 'V60-no-ambiguous-batch')
    expect(check?.outcome).toBe('fail')
    expect(check?.detail).toMatch(/Do\s+not re-import over an ambiguous batch/u)
  })

  it('flags a completed batch that never recorded a completion time', () => {
    // The status says done and the receipt says otherwise. Believing the status is how a short
    // corpus gets certified.
    expect(hasAmbiguousBatch(observed([batch({ completed_at: null })]))).toBe(true)
  })

  it('does not flag a skipped batch, which legitimately never completes', () => {
    expect(hasAmbiguousBatch(observed([batch({ status: 'skipped', completed_at: null })]))).toBe(
      false,
    )
  })

  it('refuses to reconcile receipts against a corpus while a batch is ambiguous', () => {
    // The inserted totals it would compare against are the very thing in doubt.
    const result = checkReceiptConsistency(ambiguous, observed(25))
    expect(result.outcome).toBe('indeterminate')
    expect(result.detail).toMatch(/not trustworthy inputs/u)
  })

  it('reports no ambiguity when every batch has a receipt', () => {
    expect(hasAmbiguousBatch(observed([batch()]))).toBe(false)
    expect(outcomeOf(checkBatchReconciliation(observed([batch()])), 'V60-no-ambiguous-batch')).toBe(
      'pass',
    )
  })

  it('does not claim ambiguity when the batch list could not be read', () => {
    expect(hasAmbiguousBatch(failed('http_500', 'boom'))).toBe(false)
    expect(
      outcomeOf(checkBatchReconciliation(failed('http_500', 'boom')), 'V60-no-ambiguous-batch'),
    ).toBe('indeterminate')
  })
})

describe('receipts must account for the corpus', () => {
  it('passes when inserts equal the corpus', () => {
    expect(checkReceiptConsistency(observed([batch()]), observed(25)).outcome).toBe('pass')
  })

  it('fails on a surplus of rows over receipts', () => {
    const result = checkReceiptConsistency(observed([batch({ inserted_count: 20 })]), observed(25))
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/wrote no receipt/u)
  })

  it('fails on a shortfall of rows against receipts', () => {
    const result = checkReceiptConsistency(observed([batch()]), observed(20))
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/are not there/u)
  })
})

describe('duplicate PMIDs', () => {
  it('passes when the row count equals the distinct-PMID count', () => {
    expect(checkNoDuplicatePmids(observed(25), observed(25)).outcome).toBe('pass')
  })

  it('fails, and points at the primary key, when they disagree', () => {
    const result = checkNoDuplicatePmids(observed(26), observed(25))
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/primary\s+key/u)
  })
})

describe('full-corpus reconciliation', () => {
  const expectation = observed({
    sourceRecordCount: 25,
    sourceDistinctPmidCount: 25,
    sourceFiles: [{ filename: 'canary.nbib', sha256: 'a'.repeat(64), recordCount: 25 }],
  })

  it('passes when source and destination agree', () => {
    const results = checkFullCorpus(expectation, observed([batch()]), observed(25))
    expect(results.every((result) => result.outcome === 'pass')).toBe(true)
  })

  it('fails when the destination is short', () => {
    const results = checkFullCorpus(expectation, observed([batch()]), observed(24))
    expect(outcomeOf(results, 'V70-corpus-counts')).toBe('fail')
  })

  it('matches files by checksum, not by filename', () => {
    // A re-exported file with the same name is a different file, and the reverse is also true.
    const renamed = observed([batch({ source_filename: 'renamed.nbib' })])
    expect(outcomeOf(checkFullCorpus(expectation, renamed, observed(25)), 'V71-corpus-files')).toBe(
      'pass',
    )
    const rewritten = observed([batch({ source_file_sha256: 'b'.repeat(64) })])
    expect(
      outcomeOf(checkFullCorpus(expectation, rewritten, observed(25)), 'V71-corpus-files'),
    ).toBe('fail')
  })

  it('is indeterminate without a declared expectation', () => {
    const results = checkFullCorpus(
      skipped('no corpus expectation was supplied'),
      observed([batch()]),
      observed(25),
    )
    expect(results.every((result) => result.outcome === 'indeterminate')).toBe(true)
  })
})

describe('search behaviour', () => {
  it('treats an empty admin preview as a successful read, not an error', () => {
    const results = checkSearchBehaviour(
      observed([]),
      observed([]),
      observed({ total_articles: 0 }),
      observed(0),
    )
    expect(outcomeOf(results, 'V40-blank-admin-preview')).toBe('pass')
  })

  it('fails when stats and the counted corpus disagree', () => {
    const results = checkSearchBehaviour(
      observed([]),
      observed([]),
      observed({ total_articles: 25 }),
      observed(20),
    )
    expect(outcomeOf(results, 'V42-admin-stats')).toBe('fail')
  })

  it('passes when stats report exactly the canary count', () => {
    const results = checkSearchBehaviour(
      observed([]),
      observed([]),
      observed({ total_articles: 25 }),
      observed(25),
    )
    expect(outcomeOf(results, 'V42-admin-stats')).toBe('pass')
  })

  it('fails when keyword search returns more rows than the corpus holds', () => {
    const results = checkSearchBehaviour(
      observed([]),
      observed([{}, {}, {}]),
      observed({ total_articles: 2 }),
      observed(2),
    )
    expect(outcomeOf(results, 'V41-keyword-search')).toBe('fail')
  })

  it('flags an article missing its search vector', () => {
    const result = checkSearchVectors(observed(20), observed(25))
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/invisible to keyword search/u)
  })
})

describe('the gold workflow declines rather than breaks', () => {
  it('passes when the database reports the RPC absent and the API declines cleanly', () => {
    const results = checkGoldWorkflowUnavailable(
      unavailable('the target reports no such database object (PostgREST PGRST202)'),
      observed({ status: 404, errorCode: 'LITERATURE_GOLD_SET_EXPORT_FAILED', body: {} }),
    )
    expect(results.every((result) => result.outcome === 'pass')).toBe(true)
  })

  it('fails when the API leaks a raw failure with no error envelope', () => {
    const results = checkGoldWorkflowUnavailable(
      unavailable('PGRST202'),
      observed({ status: 500, errorCode: null, body: 'PGRST202: could not find the function' }),
    )
    const application = results.find((result) => result.id === 'V96-gold-declines-cleanly')
    expect(application?.outcome).toBe('fail')
    expect(application?.detail).toMatch(/leaking a raw failure/u)
  })

  it('fails when the gold RPC unexpectedly exists', () => {
    const results = checkGoldWorkflowUnavailable(
      observed([]),
      observed({
        status: 404,
        errorCode: 'LITERATURE_GOLD_SET_EXPORT_FAILED',
        body: {},
      }),
    )
    expect(outcomeOf(results, 'V95-gold-absent-in-database')).toBe('fail')
  })

  it('is indeterminate when the probe itself failed', () => {
    const results = checkGoldWorkflowUnavailable(
      failed('network_error', 'ECONNRESET'),
      skipped('no application base URL'),
    )
    expect(results.every((result) => result.outcome === 'indeterminate')).toBe(true)
  })
})

describe('the application reports its own state truthfully', () => {
  it('passes the not-configured scenario on a structured 503', () => {
    const result = checkApplicationRuntime(
      observed({ status: 503, errorCode: 'LITERATURE_SEARCH_UNAVAILABLE', body: {} }),
      'not_configured',
    )
    expect(result.outcome).toBe('pass')
  })

  it('fails the not-configured scenario on a bare 500', () => {
    // "Not configured" and "broken" must not look the same to an operator.
    const result = checkApplicationRuntime(
      observed({ status: 500, errorCode: null, body: 'Internal Server Error' }),
      'not_configured',
    )
    expect(result.outcome).toBe('fail')
    expect(result.detail).toMatch(/failing rather than\s+declining/u)
  })

  it('reads the same 503 as a failure once the runtime is meant to be serving', () => {
    const probe = observed({ status: 503, errorCode: 'LITERATURE_SEARCH_UNAVAILABLE', body: {} })
    expect(checkApplicationRuntime(probe, 'not_configured').outcome).toBe('pass')
    expect(checkApplicationRuntime(probe, 'configured').outcome).toBe('fail')
  })
})

describe('every check reports through the same three outcomes', () => {
  it('produces no outcome outside the closed union', () => {
    const everything: CheckResult[] = [
      ...checkProjectIdentity({
        projectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
        url: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
        canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
      }),
      ...checkMigrationHistory(skipped('none')),
      checkSchemaPresence(resolveSchemaPresence(ALL_EMPTY)),
      ...checkCatalogInventory(skipped('none')),
      checkFoundationEmpty(ALL_EMPTY),
      checkFoundationPopulated(observed(0)),
      ...checkBatchReconciliation(observed([batch()])),
      ...checkPublicExclusion(observed([]), observed(0), skipped('x'), skipped('x')),
    ]
    for (const result of everything) {
      expect(['pass', 'fail', 'indeterminate']).toContain(result.outcome)
      expect(result.id).toMatch(/^V\d\d-/u)
    }
  })
})

/** Referenced so the exported reconciliation shape stays part of the tested surface. */
export type ReconciliationShape = BatchReconciliation
