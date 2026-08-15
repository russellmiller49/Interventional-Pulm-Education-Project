/**
 * The eight states this tool can be asked to verify, and what each one actually claims.
 *
 * A scenario is not a filter over a list of checks — it is a claim, and the checks are what make
 * the claim true. That distinction shows up in the two places it matters:
 *
 *   - Scenarios disagree about what a given observation *means*. With the Railway variables absent,
 *     a 503 from the search API is the pass condition for `runtime-not-configured` and a failure
 *     for every scenario after it. Same observation, opposite verdict.
 *   - Some scenarios refuse to conclude in the presence of a condition their checks would
 *     otherwise be happy with. An import batch with no receipt makes every count downstream of it
 *     unreliable, so the populated, canary, and full-corpus scenarios stop rather than reporting a
 *     total they cannot stand behind.
 *
 * The order is the order of the bring-up: nothing configured, foundation present and empty,
 * foundation populated, and so on. Running them in order is how an operator finds out *which* step
 * broke rather than that something did.
 */

import {
  checkApplicationAccessControl,
  checkApplicationRuntime,
  checkArticleDetail,
  checkBatchReconciliation,
  checkCanaryCount,
  checkCanaryIdempotency,
  checkCatalogInventory,
  checkDistributions,
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
  checkSourceProvenance,
  hasAmbiguousBatch,
  resolveSchemaPresence,
  type CheckResult,
  type VerificationInput,
} from './checks'
import { mapObservation } from './observation'

export type ScenarioId =
  | 'runtime-not-configured'
  | 'foundation-empty'
  | 'foundation-populated'
  | 'gold-unavailable'
  | 'canary'
  | 'full-corpus'
  | 'public-exclusion'
  | 'batch-reconciliation'

export interface Scenario {
  readonly id: ScenarioId
  readonly title: string
  /** What a `verified` verdict from this scenario licenses, and what it does not. */
  readonly claim: string
  readonly run: (input: VerificationInput) => CheckResult[]
  /**
   * Whether an import batch with no receipt stops this scenario outright. True wherever the
   * scenario's claim rests on a count that an unreconciled batch could have moved.
   */
  readonly stopsOnAmbiguousBatch: boolean
}

/** Checks every scenario runs first: you are talking to the project you think you are. */
function identityChecks(input: VerificationInput): CheckResult[] {
  return checkProjectIdentity(input.target)
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'runtime-not-configured',
    title: 'Runtime not configured',
    claim:
      'The deployment is reachable and truthfully reports that the Literature database is not ' +
      'configured, with a structured refusal rather than an error page. This says nothing about ' +
      'the database, which is not read.',
    stopsOnAmbiguousBatch: false,
    run: (input) => [
      ...checkApplicationAccessControl(
        input.application.anonymousAdminPage,
        input.application.anonymousSearchApi,
      ),
      checkApplicationRuntime(input.application.adminSearchApi, 'not_configured'),
      checkSitemapExclusion(input.application.sitemap),
    ],
  },
  {
    id: 'foundation-empty',
    title: 'Foundation ready and empty',
    claim:
      'The approved project holds the foundation schema, exactly one recorded migration, and zero ' +
      'rows. This is the expected state immediately after the migration and before any import.',
    stopsOnAmbiguousBatch: false,
    run: (input) => [
      ...identityChecks(input),
      ...checkMigrationHistory(input.migrationHistory),
      checkSchemaPresence(resolveSchemaPresence(input.database.tableReachability)),
      ...checkCatalogInventory(input.catalogAttestation),
      checkFoundationEmpty(input.database.tableReachability),
      ...checkSearchBehaviour(
        input.database.blankAdminPreview,
        input.database.keywordSearch,
        input.database.adminStats,
        input.database.totalArticles,
      ),
    ],
  },
  {
    id: 'foundation-populated',
    title: 'Foundation ready and populated',
    claim:
      'The foundation schema is present, the corpus is non-empty, every article is internally ' +
      'consistent (states, search vectors, provenance), and every batch that wrote it left a ' +
      'receipt.',
    stopsOnAmbiguousBatch: true,
    run: (input) => [
      ...identityChecks(input),
      ...checkMigrationHistory(input.migrationHistory),
      checkSchemaPresence(resolveSchemaPresence(input.database.tableReachability)),
      checkFoundationPopulated(input.database.totalArticles),
      ...checkDistributions(
        input.database.relevanceDistribution,
        input.database.visibilityDistribution,
        input.database.totalArticles,
      ),
      checkSearchVectors(input.database.searchVectorPopulated, input.database.totalArticles),
      ...checkSearchBehaviour(
        input.database.blankAdminPreview,
        input.database.keywordSearch,
        input.database.adminStats,
        input.database.totalArticles,
      ),
      checkArticleDetail(input.database.articleDetail, input.database.resolvedDetailPmid),
      ...checkBatchReconciliation(input.database.batches),
      checkReceiptConsistency(input.database.batches, input.database.totalArticles),
      ...checkSourceProvenance(
        input.database.sources,
        input.database.batches,
        input.database.totalArticles,
      ),
      checkNoDuplicatePmids(input.database.totalArticles, distinctPmidObservation(input)),
    ],
  },
  {
    id: 'gold-unavailable',
    title: 'Gold workflow unavailable',
    claim:
      'The gold-set review workflow is absent from the dedicated project — its migrations were ' +
      'deliberately not applied — and the application declines with a structured error rather ' +
      'than surfacing a database failure.',
    stopsOnAmbiguousBatch: false,
    run: (input) => [
      ...identityChecks(input),
      ...checkGoldWorkflowUnavailable(
        input.database.goldWorkflow,
        input.application.goldSetExportApi,
      ),
    ],
  },
  {
    id: 'canary',
    title: 'Canary verification',
    claim:
      'Exactly twenty-five articles are present, all of them unreviewed drafts, every one ' +
      'accounted for by a batch receipt, none of them publicly reachable — and, when a baseline ' +
      'from a prior run is supplied, a second identical import added nothing.',
    stopsOnAmbiguousBatch: true,
    run: (input) => [
      ...identityChecks(input),
      checkSchemaPresence(resolveSchemaPresence(input.database.tableReachability)),
      ...checkCanaryCount(input.database.totalArticles, input.database.canaryStateCount),
      ...checkBatchReconciliation(input.database.batches),
      checkReceiptConsistency(input.database.batches, input.database.totalArticles),
      ...checkSourceProvenance(
        input.database.sources,
        input.database.batches,
        input.database.totalArticles,
      ),
      checkNoDuplicatePmids(input.database.totalArticles, distinctPmidObservation(input)),
      checkSearchVectors(input.database.searchVectorPopulated, input.database.totalArticles),
      ...checkSearchBehaviour(
        input.database.blankAdminPreview,
        input.database.keywordSearch,
        input.database.adminStats,
        input.database.totalArticles,
      ),
      checkArticleDetail(input.database.articleDetail, input.database.resolvedDetailPmid),
      ...checkPublicExclusion(
        input.database.publicSearch,
        input.database.publiclyVisibleCount,
        input.database.anonymousTableRead,
        input.database.anonymousRpcRead,
      ),
      checkCanaryIdempotency(input.baselineSnapshot, input.currentSnapshot),
    ],
  },
  {
    id: 'full-corpus',
    title: 'Full-corpus verification',
    claim:
      'Every declared source file has a batch with a matching checksum, the receipts read the ' +
      'declared number of records, and the destination holds the declared number of distinct ' +
      'PMIDs — source and destination reconcile.',
    stopsOnAmbiguousBatch: true,
    run: (input) => [
      ...identityChecks(input),
      checkSchemaPresence(resolveSchemaPresence(input.database.tableReachability)),
      ...checkBatchReconciliation(input.database.batches),
      ...checkFullCorpus(
        input.corpusExpectation,
        input.database.batches,
        input.database.totalArticles,
      ),
      checkReceiptConsistency(input.database.batches, input.database.totalArticles),
      ...checkSourceProvenance(
        input.database.sources,
        input.database.batches,
        input.database.totalArticles,
      ),
      checkNoDuplicatePmids(input.database.totalArticles, distinctPmidObservation(input)),
      checkSearchVectors(input.database.searchVectorPopulated, input.database.totalArticles),
      ...checkDistributions(
        input.database.relevanceDistribution,
        input.database.visibilityDistribution,
        input.database.totalArticles,
      ),
    ],
  },
  {
    id: 'public-exclusion',
    title: 'Public-exclusion verification',
    claim:
      'No draft record is reachable by any unauthenticated path: not through the default search, ' +
      'not through PostgREST, not through the sitemap, and not by opening the page.',
    stopsOnAmbiguousBatch: false,
    run: (input) => [
      ...identityChecks(input),
      ...checkPublicExclusion(
        input.database.publicSearch,
        input.database.publiclyVisibleCount,
        input.database.anonymousTableRead,
        input.database.anonymousRpcRead,
      ),
      checkSitemapExclusion(input.application.sitemap),
      ...checkApplicationAccessControl(
        input.application.anonymousAdminPage,
        input.application.anonymousSearchApi,
      ),
    ],
  },
  {
    id: 'batch-reconciliation',
    title: 'Lost / ambiguous batch reconciliation',
    claim:
      'Every import batch left a receipt, no batch failed, and the receipts account for exactly ' +
      'the rows in the destination. This scenario is the one to run *after* an import was ' +
      'interrupted — it is designed to report the ambiguity rather than resolve it.',
    // Not a stop: reporting the ambiguity is this scenario's entire job, and its own checks fail
    // on it. Suppressing them here would hide the finding the operator came for.
    stopsOnAmbiguousBatch: false,
    run: (input) => [
      ...identityChecks(input),
      ...checkBatchReconciliation(input.database.batches),
      checkReceiptConsistency(input.database.batches, input.database.totalArticles),
      ...checkSourceProvenance(
        input.database.sources,
        input.database.batches,
        input.database.totalArticles,
      ),
      checkNoDuplicatePmids(input.database.totalArticles, distinctPmidObservation(input)),
    ],
  },
]

/**
 * Distinct PMIDs, derived from the provenance rows rather than counted separately.
 *
 * Derived through `mapObservation`, so a failed provenance read stays failed and the duplicate
 * check reports `indeterminate` instead of comparing against a number nobody observed.
 */
function distinctPmidObservation(input: VerificationInput) {
  return mapObservation(input.database.sources, (rows) => new Set(rows.map((row) => row.pmid)).size)
}

export function scenarioById(id: string): Scenario | null {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null
}

export type RunVerdict = 'verified' | 'not_verified' | 'indeterminate' | 'stopped'

export interface ScenarioRun {
  readonly scenario: ScenarioId
  readonly title: string
  readonly claim: string
  readonly verdict: RunVerdict
  readonly checks: readonly CheckResult[]
  readonly summary: { pass: number; fail: number; indeterminate: number }
  /**
   * Set whenever an unreceipted batch was observed in a scenario that stops on one — including
   * when the verdict is `not_verified`, because the ambiguity is still the thing to fix first
   * even when something else failed alongside it.
   */
  readonly stopReason: string | null
}

/**
 * Checks that *are* the ambiguity, rather than consequences of it.
 *
 * The distinction decides whether an unreceipted batch reads as `stopped` or as `not_verified`.
 * `V60` failing is the ambiguity restated, so a run whose only failure is `V60` is a stop. Any
 * other failure is a separate finding that must be the headline — an anonymous caller reading
 * draft rows does not become less urgent because an import was also left half-finished.
 */
const AMBIGUITY_CHECK_IDS: readonly string[] = ['V60-no-ambiguous-batch']

/**
 * Run one scenario and reduce its checks to a verdict.
 *
 * The reduction is deliberately unforgiving. `verified` requires every check to pass; one failure
 * makes the run `not_verified`, and one unobserved value makes it `indeterminate`. There is no
 * threshold and no "mostly passed", because the question an operator is asking before a conference
 * demo is not how many checks passed.
 */
export function runScenario(scenario: Scenario, input: VerificationInput): ScenarioRun {
  const checks = scenario.run(input)
  const summary = {
    pass: checks.filter((check) => check.outcome === 'pass').length,
    fail: checks.filter((check) => check.outcome === 'fail').length,
    indeterminate: checks.filter((check) => check.outcome === 'indeterminate').length,
  }

  const stopped = scenario.stopsOnAmbiguousBatch && hasAmbiguousBatch(input.database.batches)
  const failuresBeyondTheAmbiguity = checks.filter(
    (check) => check.outcome === 'fail' && !AMBIGUITY_CHECK_IDS.includes(check.id),
  ).length

  const verdict: RunVerdict =
    failuresBeyondTheAmbiguity > 0
      ? 'not_verified'
      : stopped
        ? 'stopped'
        : summary.fail > 0
          ? 'not_verified'
          : summary.indeterminate > 0
            ? 'indeterminate'
            : 'verified'

  return {
    scenario: scenario.id,
    title: scenario.title,
    claim: scenario.claim,
    verdict,
    checks,
    summary,
    stopReason: stopped
      ? 'At least one import batch has no receipt. Every count this scenario would report ' +
        'depends on batches whose outcome was never recorded, so no count is reported. Run the ' +
        'batch-reconciliation scenario, resolve the batch by hand, and only then re-run this one.'
      : null,
  }
}
