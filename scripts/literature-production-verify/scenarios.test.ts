/** @jest-environment node */

/**
 * Scenario-level behaviour: how checks reduce to a verdict, and when a scenario refuses to reach
 * one at all.
 *
 * Two properties carry the weight. `verified` requires every check to pass — there is no threshold
 * and no partial credit, because "23 of 25 checks passed" is not an answer to "is the canary
 * good?". And a scenario whose claim rests on counts stops outright when a batch has no receipt,
 * rather than reporting a total it cannot stand behind.
 */

import { SCENARIOS, runScenario, scenarioById, type ScenarioId } from './lib/scenarios'
import type { VerificationInput } from './lib/checks'
import type { BatchReceipt } from './lib/collect'
import {
  LITERATURE_CANARY_RECORD_COUNT,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_RELEVANCE_STATES,
  LITERATURE_VISIBILITY_STATES,
} from './lib/identity'
import { batchRowForReceipt, ingestReceiptFixture } from './lib/ingest-receipt-fixture'
import { failed, observed, skipped, unavailable, type Observation } from './lib/observation'

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

/** A canary-populated target where everything is exactly as it should be. */
function healthyCanaryInput(overrides: Partial<VerificationInput> = {}): VerificationInput {
  const pmids = Array.from({ length: LITERATURE_CANARY_RECORD_COUNT }, (_, index) =>
    String(40_000_000 + index),
  )
  /*
   * A healthy canary now includes the ingestion receipt.
   *
   * Without it the scenario is `indeterminate` rather than `verified`, and that is deliberate:
   * the claim "exactly twenty-five unreviewed drafts are present" is satisfied by ANY twenty-five
   * unreviewed drafts, from any run, of any manifest. The receipt is what turns a statement about
   * a shape into a statement about an operation.
   */
  const receipt = ingestReceiptFixture({
    pmids,
    afterArticleCount: pmids.length,
    // The fixture supplies a baseline and an identical current snapshot, so it models the
    // second run. `idempotent-replay` is what the engine writes when it recognises the repeat.
    outcome: 'idempotent-replay',
  })
  const originalReceipt = ingestReceiptFixture({ pmids, afterArticleCount: pmids.length })
  const denied = observed({ status: 401, denied: true, rowsReturned: null })

  return {
    target: {
      projectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
      url: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
      canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
    },
    database: {
      tableReachability: Object.fromEntries(
        LITERATURE_FOUNDATION_TABLES.map((table) => [
          table,
          observed(table === 'literature_articles' ? LITERATURE_CANARY_RECORD_COUNT : 0),
        ]),
      ),
      totalArticles: observed(LITERATURE_CANARY_RECORD_COUNT),
      relevanceDistribution: Object.fromEntries(
        LITERATURE_RELEVANCE_STATES.map((state) => [
          state,
          observed(state === 'unreviewed' ? LITERATURE_CANARY_RECORD_COUNT : 0),
        ]),
      ),
      visibilityDistribution: Object.fromEntries(
        LITERATURE_VISIBILITY_STATES.map((state) => [
          state,
          observed(state === 'draft' ? LITERATURE_CANARY_RECORD_COUNT : 0),
        ]),
      ),
      searchVectorPopulated: observed(LITERATURE_CANARY_RECORD_COUNT),
      sourceRowCount: observed(LITERATURE_CANARY_RECORD_COUNT),
      canaryStateCount: observed(LITERATURE_CANARY_RECORD_COUNT),
      publiclyVisibleCount: observed(0),
      // The row the FIRST run left. A replay does not rewrite it, so it still carries the
      // original operation's counters — which is why V56 must not compare them to a replay.
      batches: observed([batchRowForReceipt(originalReceipt)]),
      sources: observed(
        pmids.map((pmid) => ({
          pmid,
          batch_id: receipt.importBatchId as string,
          source_kind: 'all_pubmed_discovery',
          source_filename: `literature-production-ingest/${receipt.mode}`,
        })),
      ),
      importErrors: observed(0),
      adminStats: observed({ total_articles: LITERATURE_CANARY_RECORD_COUNT }),
      blankAdminPreview: observed(pmids.map((pmid) => ({ pmid }))),
      keywordSearch: observed([{ pmid: pmids[0], total_count: 1 }]),
      publicSearch: observed([]),
      articleDetail: observed([
        { pmid: pmids[0], relevance_state: 'unreviewed', visibility_state: 'draft' },
      ]),
      resolvedDetailPmid: pmids[0],
      goldWorkflow: unavailable('the target reports no such database object (PostgREST PGRST202)'),
      anonymousTableRead: denied,
      anonymousRpcRead: denied,
    },
    application: {
      anonymousAdminPage: observed({
        status: 307,
        errorCode: null,
        body: '',
        location: '/en/login?next=%2Fadmin%2Fliterature',
      }),
      anonymousSearchApi: observed({
        status: 401,
        errorCode: 'LITERATURE_ACCESS_DENIED',
        body: {},
        location: null,
      }),
      adminSearchApi: observed({ status: 200, errorCode: null, body: {}, location: null }),
      adminBlankPreviewApi: observed({ status: 200, errorCode: null, body: {}, location: null }),
      adminKeywordApi: observed({ status: 200, errorCode: null, body: {}, location: null }),
      adminArticleApi: observed({ status: 200, errorCode: null, body: {}, location: null }),
      goldSetExportApi: observed({
        status: 404,
        errorCode: 'LITERATURE_GOLD_SET_EXPORT_FAILED',
        body: {},
        location: null,
      }),
      sitemap: observed('<?xml version="1.0"?><urlset></urlset>'),
    },
    migrationHistory: observed([{ version: '20260815223259', name: 'add_literature_explorer' }]),
    catalogAttestation: skipped('no catalog attestation was supplied'),
    corpusExpectation: skipped('no corpus expectation was supplied'),
    // The engine's replay path writes nothing to the database, so the two snapshots are identical
    // and the receipt is what evidences the second run. The old fixture modelled a `--force`
    // replay, which moved `started_at` — a trace this engine never produces.
    ingestReceipt: observed(receipt),
    baselineSnapshot: observed({
      totalArticles: LITERATURE_CANARY_RECORD_COUNT,
      batchCount: 1,
      insertedTotal: LITERATURE_CANARY_RECORD_COUNT,
      updatedTotal: 0,
      duplicateTotal: 0,
      latestBatchStartedAt: '2026-08-15T00:00:00.000Z',
    }),
    currentSnapshot: observed({
      totalArticles: LITERATURE_CANARY_RECORD_COUNT,
      batchCount: 1,
      insertedTotal: LITERATURE_CANARY_RECORD_COUNT,
      updatedTotal: 0,
      duplicateTotal: 0,
      latestBatchStartedAt: '2026-08-15T00:00:00.000Z',
    }),
    detailPmid: pmids[0],
    ...overrides,
  }
}

function outcomeOfCheck(checks: readonly { id: string; outcome: string }[], id: string) {
  return checks.find((check) => check.id === id)?.outcome
}

function runById(id: ScenarioId, input: VerificationInput) {
  const scenario = scenarioById(id)
  if (!scenario) throw new Error(`no scenario ${id}`)
  return runScenario(scenario, input)
}

describe('the scenario catalogue', () => {
  it('covers the eight documented bring-up states', () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'runtime-not-configured',
      'foundation-empty',
      'foundation-populated',
      'gold-unavailable',
      'canary',
      'full-corpus',
      'public-exclusion',
      'batch-reconciliation',
    ])
  })

  it('states what a verified verdict does and does not license', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.claim.length).toBeGreaterThan(60)
    }
  })

  it('returns null for an unknown id rather than a default scenario', () => {
    expect(scenarioById('everything')).toBeNull()
  })
})

describe('a healthy canary verifies', () => {
  it('reaches verified with no failure and no unknown', () => {
    const run = runById('canary', healthyCanaryInput())
    expect(run.summary.fail).toBe(0)
    expect(run.summary.indeterminate).toBe(0)
    expect(run.verdict).toBe('verified')
  })
})

describe('one failure is enough to withhold a verdict', () => {
  it('reports not_verified when a single check fails', () => {
    const input = healthyCanaryInput()
    const run = runById('canary', {
      ...input,
      database: { ...input.database, totalArticles: observed(24), canaryStateCount: observed(24) },
    })
    expect(run.verdict).toBe('not_verified')
  })

  it('reports indeterminate when a single read failed, never verified', () => {
    const input = healthyCanaryInput()
    const run = runById('canary', {
      ...input,
      database: {
        ...input.database,
        publicSearch: failed('http_500', 'gateway error'),
      },
    })
    expect(run.verdict).toBe('indeterminate')
    expect(run.summary.indeterminate).toBeGreaterThan(0)
  })

  it('prefers not_verified over indeterminate when both are present', () => {
    // A known failure outranks an unknown: an operator needs to see the thing that is wrong.
    const input = healthyCanaryInput()
    const run = runById('canary', {
      ...input,
      database: {
        ...input.database,
        totalArticles: observed(24),
        publicSearch: failed('http_500', 'gateway error'),
      },
    })
    expect(run.verdict).toBe('not_verified')
  })
})

describe('an ambiguous batch stops the scenarios that depend on counts', () => {
  /*
   * Interrupt the operation the rest of the fixture already describes, rather than substituting a
   * different batch row.
   *
   * Replacing the batch outright also broke the provenance link — the fixture's source rows name
   * the operation's batch id — so the run failed on provenance instead of stopping on the
   * ambiguity, and a genuine failure now outranks `stopped`. Mutating status in place keeps every
   * other relationship intact so the ambiguity is the only thing wrong.
   */
  const ambiguous = (input: VerificationInput): VerificationInput => ({
    ...input,
    database: {
      ...input.database,
      batches:
        input.database.batches.status === 'observed'
          ? observed(
              input.database.batches.value.map((row) => ({
                ...row,
                status: 'started',
                completed_at: null,
              })),
            )
          : input.database.batches,
    },
    // An interrupted operation never wrote a receipt, so there is none to supply.
    ingestReceipt: skipped('an interrupted operation writes no receipt'),
  })

  it.each<[ScenarioId]>([['foundation-populated'], ['canary'], ['full-corpus']])(
    '%s stops instead of reporting a total',
    (id) => {
      const run = runById(id, ambiguous(healthyCanaryInput()))
      expect(run.verdict).toBe('stopped')
      expect(run.stopReason).toMatch(/no receipt/u)
      expect(run.stopReason).toMatch(/batch-reconciliation scenario/u)
    },
  )

  it('does not stop the reconciliation scenario, whose job is to report the ambiguity', () => {
    const run = runById('batch-reconciliation', ambiguous(healthyCanaryInput()))
    expect(run.verdict).toBe('not_verified')
    expect(run.checks.some((check) => check.id === 'V60-no-ambiguous-batch')).toBe(true)
    expect(run.checks.find((check) => check.id === 'V60-no-ambiguous-batch')?.outcome).toBe('fail')
  })

  it('lets a separate failure outrank the stop, so an exposure is not buried', () => {
    // An interrupted import and an anonymous caller reading rows are two independent facts. The
    // stop exists so an untrustworthy *count* is not reported; it was never meant to demote the
    // one finding that needs acting on immediately.
    const input = ambiguous(healthyCanaryInput())
    const run = runById('canary', {
      ...input,
      database: {
        ...input.database,
        anonymousTableRead: observed({ status: 200, denied: false, rowsReturned: 11 }),
      },
    })
    expect(run.verdict).toBe('not_verified')
    expect(outcomeOfCheck(run.checks, 'V82-anonymous-table')).toBe('fail')
    // The ambiguity is still reported alongside it rather than replaced by it.
    expect(run.stopReason).toMatch(/no receipt/u)
  })

  it('does not stop scenarios whose claim does not rest on a count', () => {
    // Public exclusion is about reachability, not totals, and an unreconciled batch does not make
    // "an anonymous caller was refused" any less true.
    expect(runById('public-exclusion', ambiguous(healthyCanaryInput())).verdict).toBe('verified')
    expect(runById('gold-unavailable', ambiguous(healthyCanaryInput())).verdict).toBe('verified')
  })

  it('never reports verified for a stopped scenario, even with every check passing', () => {
    const run = runById('canary', ambiguous(healthyCanaryInput()))
    expect(run.verdict).not.toBe('verified')
  })
})

describe('the exposure checks refuse to conclude without a real anon key', () => {
  it('reports no verdict when the anonymous probe was skipped', () => {
    // The correction that matters most: a keyless request is refused by the Supabase API gateway
    // before PostgreSQL sees it, so recording that 401 as a denial would have made V82 and V83
    // pass identically on a project where `anon` had been granted select.
    const input = healthyCanaryInput()
    const run = runById('public-exclusion', {
      ...input,
      database: {
        ...input.database,
        anonymousTableRead: skipped('no publishable key was configured'),
        anonymousRpcRead: skipped('no publishable key was configured'),
      },
    })
    expect(run.verdict).toBe('indeterminate')
    expect(outcomeOfCheck(run.checks, 'V82-anonymous-table')).toBe('indeterminate')
    expect(outcomeOfCheck(run.checks, 'V83-anonymous-rpc')).toBe('indeterminate')
  })
})

describe('the not-configured scenario is its own claim', () => {
  const notConfigured = (): VerificationInput => {
    const input = healthyCanaryInput()
    return {
      ...input,
      application: {
        ...input.application,
        adminSearchApi: observed({
          status: 503,
          errorCode: 'LITERATURE_SEARCH_UNAVAILABLE',
          body: {},
          location: null,
        }),
      },
    }
  }

  it('verifies a deployment that truthfully declines', () => {
    expect(runById('runtime-not-configured', notConfigured()).verdict).toBe('verified')
  })

  it('reads the same 503 as a failure in a scenario that expects service', () => {
    const run = runById('foundation-populated', notConfigured())
    // The database checks still pass; the scenario simply does not consult the runtime probe.
    expect(run.verdict).toBe('verified')
    // But the not-configured scenario and a serving deployment disagree, which is the real point.
    const serving = healthyCanaryInput()
    expect(runById('runtime-not-configured', serving).verdict).toBe('not_verified')
  })

  it('fails when the deployment returns a bare 500 instead of declining', () => {
    const input = notConfigured()
    const run = runById('runtime-not-configured', {
      ...input,
      application: {
        ...input.application,
        adminSearchApi: observed({
          status: 500,
          errorCode: null,
          body: 'Internal Server Error',
          location: null,
        }),
      },
    })
    expect(run.verdict).toBe('not_verified')
  })
})

describe('missing optional evidence is reported, never assumed', () => {
  it('leaves the empty-foundation scenario indeterminate without a migration attestation', () => {
    const input = healthyCanaryInput()
    const empty: VerificationInput = {
      ...input,
      migrationHistory: skipped('no migration history file was supplied') as Observation<
        readonly { version: string }[]
      >,
      database: {
        ...input.database,
        tableReachability: Object.fromEntries(
          LITERATURE_FOUNDATION_TABLES.map((table) => [table, observed(0)]),
        ),
        totalArticles: observed(0),
        adminStats: observed({ total_articles: 0 }),
        blankAdminPreview: observed([]),
        keywordSearch: observed([]),
      },
    }
    const run = runById('foundation-empty', empty)
    expect(run.verdict).toBe('indeterminate')
    expect(run.summary.fail).toBe(0)
  })
})
