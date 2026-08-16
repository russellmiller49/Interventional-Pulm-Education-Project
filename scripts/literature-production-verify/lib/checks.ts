/**
 * Every judgement this tool makes, as pure functions over plain data.
 *
 * Nothing here performs I/O, reads an environment variable, or knows what HTTP is. A check takes
 * observations and returns a verdict, which is what makes the interesting cases testable: "the
 * count RPC failed" and "the table is empty" are two different inputs, and the tests can supply
 * both and assert the verdicts differ. That distinction is unreachable in a design where the
 * checks do their own reading.
 *
 * ## Three outcomes, and why there is no fourth
 *
 *   - `pass` — the evidence was observed and matches what was expected.
 *   - `fail` — the evidence was observed and contradicts what was expected.
 *   - `indeterminate` — the evidence was not observed, or was observed only in part.
 *
 * `indeterminate` is not a soft `pass`. It never contributes to a `verified` verdict, and a run
 * with a single indeterminate check reports `indeterminate` overall. That is the honest answer to
 * "did we prove it?" when the read failed, and it is why no check needs a default value.
 *
 * ## Check identifiers
 *
 * `V##`, deliberately outside the `P##`/`E##`/`Q##` space the dedicated-Supabase preflight and
 * postflight use. Those identifiers are pinned by `docs-consistency.test.ts` against the evaluators
 * that produce them; a `V` prefix keeps the two families from being confused in a runbook.
 */

import {
  LITERATURE_AMBIGUOUS_BATCH_STATUS,
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANARY_RECORD_COUNT,
  LITERATURE_CANARY_RELEVANCE_STATE,
  LITERATURE_CANARY_VISIBILITY_STATE,
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_TABLES,
  LITERATURE_FOUNDATION_TRIGGERS,
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
  LITERATURE_PRODUCTION_CATALOG_TOTALS,
  LITERATURE_PRODUCTION_MIGRATION,
  LITERATURE_PUBLICLY_VISIBLE_STATE,
  LITERATURE_RELEVANCE_STATES,
  LITERATURE_UNPRIVILEGED_ROLES,
  LITERATURE_VISIBILITY_STATES,
} from './identity'
import { ingestReceiptChecksumMatches, type IngestReceipt } from './ingest-receipt'
import { describeObservation, isObserved, type Observation } from './observation'
/*
 * The binding contract, imported rather than restated.
 *
 * This is the one place the verification package reaches into the ingestion package for judgment,
 * and it is deliberate: two independently-written definitions of "the receipt agrees with the row"
 * were exactly the defect, because whichever was weaker decided the verdict. The receipt's checksum
 * is still recomputed here against this package's own canonicalizer, which is the independence that
 * actually matters.
 */
import {
  STABLE_FINAL_REPORT_KEYS,
  classifyStoredBatchState,
  describeAmbiguousBatch,
  evaluateReceiptBinding,
  type BindingFindingCode,
} from '../../literature-production-ingest/receipt-binding'
import type {
  ApplicationObservations,
  ApplicationProbe,
  ArticleSummary,
  BatchReceipt,
  DatabaseObservations,
  SourceRow,
} from './collect'

export type CheckOutcome = 'pass' | 'fail' | 'indeterminate'

export interface CheckResult {
  readonly id: string
  readonly title: string
  readonly outcome: CheckOutcome
  readonly detail: string
  /** Non-sensitive supporting numbers, scrubbed again at the reporting boundary. */
  readonly evidence?: Readonly<Record<string, unknown>>
}

function pass(
  id: string,
  title: string,
  detail: string,
  evidence?: Record<string, unknown>,
): CheckResult {
  return { id, title, outcome: 'pass', detail, ...(evidence ? { evidence } : {}) }
}

function fail(
  id: string,
  title: string,
  detail: string,
  evidence?: Record<string, unknown>,
): CheckResult {
  return { id, title, outcome: 'fail', detail, ...(evidence ? { evidence } : {}) }
}

function indeterminate(id: string, title: string, detail: string): CheckResult {
  return { id, title, outcome: 'indeterminate', detail }
}

/**
 * The single bridge from an observation to a check.
 *
 * Every check that consumes an observation goes through this, so there is exactly one place where
 * a non-observed value could have become a `pass` — and it does not.
 */
function fromObservation<T>(
  id: string,
  title: string,
  observation: Observation<T>,
  judge: (value: T) => CheckResult,
): CheckResult {
  if (!isObserved(observation)) {
    return indeterminate(
      id,
      title,
      `No verdict: ${describeObservation(observation)}. An unobserved value is never treated as ` +
        'zero, empty, or absent.',
    )
  }
  return judge(observation.value)
}

/* ------------------------------------------------------------------------------------------- *
 * Target identity
 * ------------------------------------------------------------------------------------------- */

export interface TargetFacts {
  readonly projectRef: string
  readonly url: string
  readonly canonicalUrl: string
}

export function checkProjectIdentity(facts: TargetFacts): CheckResult[] {
  const results: CheckResult[] = []
  const title = 'the target is the approved dedicated Literature project'

  if (facts.projectRef === LITERATURE_MAIN_APPLICATION_PROJECT_REF) {
    results.push(
      fail(
        'V01-project-ref',
        title,
        `The target is ${facts.projectRef}, the main application project. Literature data must ` +
          'never be read from or written to it.',
      ),
    )
  } else if (facts.projectRef === LITERATURE_APPROVED_PRODUCTION_PROJECT_REF) {
    results.push(
      pass('V01-project-ref', title, `Project ref is ${facts.projectRef}.`, {
        projectRef: facts.projectRef,
      }),
    )
  } else {
    results.push(
      fail(
        'V01-project-ref',
        title,
        `Project ref ${facts.projectRef || '(none resolved)'} is not the approved dedicated ` +
          `project ${LITERATURE_APPROVED_PRODUCTION_PROJECT_REF}.`,
      ),
    )
  }

  results.push(
    facts.url === facts.canonicalUrl
      ? pass('V02-canonical-url', 'the project URL is the canonical byte sequence', 'Exact match.')
      : fail(
          'V02-canonical-url',
          'the project URL is the canonical byte sequence',
          'The configured URL is not byte-for-byte the canonical production URL. The trailing ' +
            'slash, the scheme case, and any port or path are all part of the comparison.',
        ),
  )
  return results
}

/* ------------------------------------------------------------------------------------------- *
 * Migration identity
 * ------------------------------------------------------------------------------------------- */

export interface MigrationHistoryEntry {
  readonly version: string
  readonly name?: string
}

/**
 * Migration history, from the provider's `list_migrations` operation.
 *
 * Never from SQL and never hand-typed: `supabase_migrations.schema_migrations` is not exposed
 * through PostgREST, and the manifest is explicit that identity comes from the provider. When no
 * attestation is supplied the checks are `indeterminate`, which is the correct answer — not a pass
 * on the strength of a file the operator could have written by hand.
 */
export function checkMigrationHistory(
  history: Observation<readonly MigrationHistoryEntry[]>,
): CheckResult[] {
  const countTitle = 'exactly one migration is recorded'
  const identityTitle = 'the recorded migration is the Literature foundation migration'

  const countResult = fromObservation('V10-migration-count', countTitle, history, (entries) =>
    entries.length === LITERATURE_PRODUCTION_MIGRATION.expectedCount
      ? pass('V10-migration-count', countTitle, `${entries.length} migration recorded.`, {
          count: entries.length,
        })
      : fail(
          'V10-migration-count',
          countTitle,
          `${entries.length} migrations are recorded; exactly ` +
            `${LITERATURE_PRODUCTION_MIGRATION.expectedCount} is expected. A foundation-only ` +
            'rollout applies one migration and no other.',
          { count: entries.length, versions: entries.map((entry) => entry.version) },
        ),
  )

  const identityResult = fromObservation(
    'V11-migration-identity',
    identityTitle,
    history,
    (entries) => {
      const match = entries.find(
        (entry) => entry.version === LITERATURE_PRODUCTION_MIGRATION.version,
      )
      if (!match) {
        return fail(
          'V11-migration-identity',
          identityTitle,
          `No migration with version ${LITERATURE_PRODUCTION_MIGRATION.version} is recorded. ` +
            `Recorded: ${entries.map((entry) => entry.version).join(', ') || '(none)'}. The ` +
            'version is provider-assigned, so a mismatch means either a different application ' +
            'event or a different project — investigate before proceeding, and never repair ' +
            'migration history to make this pass.',
          { expected: LITERATURE_PRODUCTION_MIGRATION.version },
        )
      }
      if (match.name !== undefined && match.name !== LITERATURE_PRODUCTION_MIGRATION.name) {
        return fail(
          'V11-migration-identity',
          identityTitle,
          `The recorded migration name is ${match.name}, not ` +
            `${LITERATURE_PRODUCTION_MIGRATION.name}.`,
        )
      }
      return pass(
        'V11-migration-identity',
        identityTitle,
        `Version ${match.version} (${LITERATURE_PRODUCTION_MIGRATION.name}) is recorded.`,
        { version: match.version, name: LITERATURE_PRODUCTION_MIGRATION.name },
      )
    },
  )

  return [countResult, identityResult]
}

/* ------------------------------------------------------------------------------------------- *
 * Schema presence — the distinction between "no schema" and "empty schema"
 * ------------------------------------------------------------------------------------------- */

export type SchemaState = 'absent' | 'partial' | 'present'

export interface SchemaPresence {
  readonly state: SchemaState
  readonly reachableTables: readonly string[]
  readonly missingTables: readonly string[]
  readonly unreadableTables: readonly string[]
}

/**
 * Decide whether the schema is there, from per-table counted reads.
 *
 * The three-way split is the point. A table that answers a counted read exists, whatever the count
 * says; a table that answers `PGRST205` (no such relation) does not exist; a table whose read
 * *broke* is unknown, and being unknown it can make the schema neither present nor absent. So:
 *
 *   - every table reachable        → `present`
 *   - every table missing          → `absent`
 *   - anything else, including any unreadable table → `partial`
 *
 * `partial` is never a pass. A half-applied foundation is the state that most needs a human.
 */
export function resolveSchemaPresence(
  tableObservations: Readonly<Record<string, Observation<number>>>,
): SchemaPresence {
  const reachable: string[] = []
  const missing: string[] = []
  const unreadable: string[] = []

  for (const table of LITERATURE_FOUNDATION_TABLES) {
    const observation = tableObservations[table]
    if (observation === undefined) {
      unreadable.push(table)
    } else if (observation.status === 'observed') {
      reachable.push(table)
    } else if (observation.status === 'unavailable') {
      missing.push(table)
    } else {
      unreadable.push(table)
    }
  }

  const state: SchemaState =
    unreadable.length > 0
      ? 'partial'
      : reachable.length === LITERATURE_FOUNDATION_TABLES.length
        ? 'present'
        : missing.length === LITERATURE_FOUNDATION_TABLES.length
          ? 'absent'
          : 'partial'

  return {
    state,
    reachableTables: reachable,
    missingTables: missing,
    unreadableTables: unreadable,
  }
}

export function checkSchemaPresence(presence: SchemaPresence): CheckResult {
  const id = 'V20-schema-present'
  const title = 'every foundation table exists and is reachable'
  if (presence.unreadableTables.length > 0) {
    return indeterminate(
      id,
      title,
      `No verdict: ${presence.unreadableTables.length} table read(s) failed ` +
        `(${presence.unreadableTables.join(', ')}). A failed read proves neither presence nor ` +
        'absence, so the schema state is unknown rather than empty.',
    )
  }
  if (presence.state === 'present') {
    return pass(id, title, `All ${presence.reachableTables.length} foundation tables answered.`, {
      tables: presence.reachableTables.length,
    })
  }
  if (presence.state === 'absent') {
    return fail(
      id,
      title,
      'No foundation table exists in this project. The foundation migration has not been ' +
        'applied here — this is a missing schema, which is a different condition from an empty ' +
        'one and is not fixed by importing data.',
      { missing: presence.missingTables.length },
    )
  }
  return fail(
    id,
    title,
    `The foundation is half present: ${presence.reachableTables.length} table(s) exist and ` +
      `${presence.missingTables.length} are absent (${presence.missingTables.join(', ')}). Stop ` +
      'and reconcile; do not apply anything on top of a partial schema.',
  )
}

/* ------------------------------------------------------------------------------------------- *
 * Catalog inventory — exact when a connector attestation is supplied
 * ------------------------------------------------------------------------------------------- */

export interface CatalogAttestation {
  readonly tables: readonly string[]
  readonly functions: readonly string[]
  readonly indexes: readonly string[]
  readonly triggers: readonly string[]
  readonly policies: readonly unknown[]
  readonly rlsEnabledTables: readonly string[]
  readonly columnCount?: number
  readonly constraintCount?: number
  /** (table, role, privilege) triples the target actually grants. */
  readonly tablePrivileges?: readonly {
    table: string
    role: string
    privilege: string
    granted: boolean
  }[]
}

function compareNames(
  id: string,
  title: string,
  expected: readonly string[],
  actual: readonly string[],
): CheckResult {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  const missing = expected.filter((name) => !actualSet.has(name))
  const unexpected = actual.filter((name) => !expectedSet.has(name))
  if (missing.length === 0 && unexpected.length === 0) {
    return pass(id, title, `${expected.length} expected, ${actual.length} present, no drift.`, {
      count: actual.length,
    })
  }
  return fail(
    id,
    title,
    `Drift: ${missing.length} missing (${missing.join(', ') || 'none'}), ${unexpected.length} ` +
      `unexpected (${unexpected.join(', ') || 'none'}).`,
    { missing, unexpected },
  )
}

export function checkCatalogInventory(attestation: Observation<CatalogAttestation>): CheckResult[] {
  const definitions: {
    id: string
    title: string
    read: (value: CatalogAttestation) => CheckResult
  }[] = [
    {
      id: 'V21-table-inventory',
      title: 'the table inventory matches the foundation exactly',
      read: (value) =>
        compareNames(
          'V21-table-inventory',
          'the table inventory matches the foundation exactly',
          LITERATURE_FOUNDATION_TABLES,
          value.tables,
        ),
    },
    {
      id: 'V22-function-inventory',
      title: 'the function inventory matches the foundation exactly',
      read: (value) =>
        compareNames(
          'V22-function-inventory',
          'the function inventory matches the foundation exactly',
          LITERATURE_FOUNDATION_FUNCTION_NAMES,
          value.functions,
        ),
    },
    {
      id: 'V23-index-inventory',
      title: 'the index inventory matches the foundation exactly',
      read: (value) =>
        compareNames(
          'V23-index-inventory',
          'the index inventory matches the foundation exactly',
          LITERATURE_FOUNDATION_INDEXES,
          value.indexes,
        ),
    },
    {
      id: 'V24-trigger-inventory',
      title: 'the enabled trigger inventory matches the foundation exactly',
      read: (value) =>
        compareNames(
          'V24-trigger-inventory',
          'the enabled trigger inventory matches the foundation exactly',
          LITERATURE_FOUNDATION_TRIGGERS.map((entry) => entry.trigger),
          value.triggers,
        ),
    },
    {
      id: 'V25-rls-enabled',
      title: 'row-level security is enabled on every foundation table, with no policy',
      read: (value) => {
        const rlsGap = LITERATURE_FOUNDATION_TABLES.filter(
          (table) => !value.rlsEnabledTables.includes(table),
        )
        if (rlsGap.length > 0) {
          return fail(
            'V25-rls-enabled',
            'row-level security is enabled on every foundation table, with no policy',
            `RLS is not enabled on: ${rlsGap.join(', ')}.`,
            { withoutRls: rlsGap },
          )
        }
        if (value.policies.length > 0) {
          return fail(
            'V25-rls-enabled',
            'row-level security is enabled on every foundation table, with no policy',
            `${value.policies.length} policy/policies exist. The foundation posture is RLS ` +
              'enabled with zero policies: `service_role` reaches the data by bypassing RLS, ' +
              'and a policy is drift rather than an improvement.',
            { policies: value.policies.length },
          )
        }
        return pass(
          'V25-rls-enabled',
          'row-level security is enabled on every foundation table, with no policy',
          `RLS on all ${LITERATURE_FOUNDATION_TABLES.length} tables; 0 policies.`,
        )
      },
    },
    {
      id: 'V26-privilege-grid',
      title: 'no unprivileged role holds any table privilege',
      read: (value) => {
        if (!value.tablePrivileges) {
          return indeterminate(
            'V26-privilege-grid',
            'no unprivileged role holds any table privilege',
            'No verdict: the attestation carried no privilege grid.',
          )
        }
        const drift = value.tablePrivileges.filter(
          (entry) => entry.granted && LITERATURE_UNPRIVILEGED_ROLES.includes(entry.role),
        )
        return drift.length === 0
          ? pass(
              'V26-privilege-grid',
              'no unprivileged role holds any table privilege',
              `${LITERATURE_UNPRIVILEGED_ROLES.join(', ')} hold nothing on any Literature table.`,
            )
          : fail(
              'V26-privilege-grid',
              'no unprivileged role holds any table privilege',
              `Privilege drift: ${drift
                .map((entry) => `${entry.role} has ${entry.privilege} on ${entry.table}`)
                .join('; ')}.`,
              { drift: drift.length },
            )
      },
    },
    {
      id: 'V27-catalog-totals',
      title: 'the column and constraint totals match the applied foundation',
      read: (value) => {
        const columns = value.columnCount
        const constraints = value.constraintCount
        if (columns === undefined || constraints === undefined) {
          return indeterminate(
            'V27-catalog-totals',
            'the column and constraint totals match the applied foundation',
            'No verdict: the attestation carried no column or constraint total.',
          )
        }
        const problems: string[] = []
        if (columns !== LITERATURE_PRODUCTION_CATALOG_TOTALS.columns) {
          problems.push(
            `${columns} columns, expected ${LITERATURE_PRODUCTION_CATALOG_TOTALS.columns}`,
          )
        }
        if (constraints !== LITERATURE_PRODUCTION_CATALOG_TOTALS.constraints) {
          problems.push(
            `${constraints} constraints, expected ` +
              `${LITERATURE_PRODUCTION_CATALOG_TOTALS.constraints}`,
          )
        }
        return problems.length === 0
          ? pass(
              'V27-catalog-totals',
              'the column and constraint totals match the applied foundation',
              `${columns} columns, ${constraints} constraints.`,
              { columns, constraints },
            )
          : fail(
              'V27-catalog-totals',
              'the column and constraint totals match the applied foundation',
              problems.join('; '),
              { columns, constraints },
            )
      },
    },
  ]

  return definitions.map((definition) =>
    fromObservation(definition.id, definition.title, attestation, definition.read),
  )
}

/* ------------------------------------------------------------------------------------------- *
 * Emptiness and population
 * ------------------------------------------------------------------------------------------- */

export function checkFoundationEmpty(
  tableObservations: Readonly<Record<string, Observation<number>>>,
): CheckResult {
  const id = 'V30-foundation-empty'
  const title = 'every foundation table holds zero rows'
  const nonEmpty: string[] = []
  const unknown: string[] = []

  for (const table of LITERATURE_FOUNDATION_TABLES) {
    const observation = tableObservations[table]
    if (observation === undefined || !isObserved(observation)) {
      unknown.push(table)
      continue
    }
    if (observation.value !== 0) nonEmpty.push(`${table}=${observation.value}`)
  }

  if (unknown.length > 0) {
    return indeterminate(
      id,
      title,
      `No verdict: ${unknown.length} table count(s) were not observed (${unknown.join(', ')}). ` +
        'An unobserved count is not zero.',
    )
  }
  return nonEmpty.length === 0
    ? pass(id, title, `All ${LITERATURE_FOUNDATION_TABLES.length} tables are empty.`)
    : fail(id, title, `Rows present: ${nonEmpty.join(', ')}.`, { nonEmpty })
}

export function checkFoundationPopulated(totalArticles: Observation<number>): CheckResult {
  const id = 'V31-foundation-populated'
  const title = 'the article corpus is populated'
  return fromObservation(id, title, totalArticles, (total) =>
    total > 0
      ? pass(id, title, `${total} article(s) present.`, { total })
      : fail(
          id,
          title,
          'The corpus holds zero articles. That is a valid *empty* foundation, but it is not a ' +
            'populated one — this check distinguishes the two rather than treating empty as a ' +
            'lesser form of populated.',
          { total },
        ),
  )
}

export function checkDistributions(
  relevance: Readonly<Record<string, Observation<number>>>,
  visibility: Readonly<Record<string, Observation<number>>>,
  totalArticles: Observation<number>,
): CheckResult[] {
  const results: CheckResult[] = []

  for (const [id, title, distribution, vocabulary] of [
    [
      'V32-relevance-distribution',
      'the relevance-state distribution sums to the corpus',
      relevance,
      LITERATURE_RELEVANCE_STATES,
    ],
    [
      'V33-visibility-distribution',
      'the visibility-state distribution sums to the corpus',
      visibility,
      LITERATURE_VISIBILITY_STATES,
    ],
  ] as const) {
    const entries = Object.entries(distribution)
    // Judged against the documented vocabulary rather than whatever keys arrived. Summing the
    // keys handed in would make the check agree with itself: a caller that supplied three of the
    // four relevance states would produce a sum that matched, and the missing state's rows would
    // simply never be counted on either side.
    const missingStates = vocabulary.filter((state: string) => !(state in distribution))
    if (missingStates.length > 0) {
      results.push(
        indeterminate(
          id,
          title,
          `No verdict: no count was taken for ${missingStates.join(', ')}. The sum can only be ` +
            'compared against the corpus when every documented state was counted.',
        ),
      )
      continue
    }
    // Narrowed once, up front. Summing over `observedEntries` means there is no branch in this
    // function where a non-observed count could contribute a `0` to the total — the arithmetic
    // below simply cannot see one.
    const observedEntries = entries.flatMap(([state, value]) =>
      isObserved(value) ? [[state, value.value] as const] : [],
    )
    const unobserved = entries.filter(([, value]) => !isObserved(value)).map(([state]) => state)
    if (unobserved.length > 0 || !isObserved(totalArticles)) {
      results.push(
        indeterminate(
          id,
          title,
          'No verdict: ' +
            (unobserved.length > 0
              ? `state count(s) not observed (${unobserved.join(', ')}). `
              : '') +
            (isObserved(totalArticles)
              ? ''
              : `corpus total ${describeObservation(totalArticles)}.`),
        ),
      )
      continue
    }
    const counts = Object.fromEntries(observedEntries)
    const sum = observedEntries.reduce((accumulator, [, value]) => accumulator + value, 0)
    results.push(
      sum === totalArticles.value
        ? pass(id, title, `${sum} across ${entries.length} states.`, counts)
        : fail(
            id,
            title,
            `The state counts sum to ${sum} but the corpus holds ${totalArticles.value}. A gap ` +
              'means a value outside the documented vocabulary, or a read taken mid-write.',
            counts,
          ),
    )
  }

  return results
}

export function checkSearchVectors(
  searchVectorPopulated: Observation<number>,
  totalArticles: Observation<number>,
): CheckResult {
  const id = 'V34-search-vectors'
  const title = 'every article has a populated search vector'
  if (!isObserved(searchVectorPopulated) || !isObserved(totalArticles)) {
    return indeterminate(
      id,
      title,
      `No verdict: populated=${describeObservation(searchVectorPopulated)}, ` +
        `total=${describeObservation(totalArticles)}.`,
    )
  }
  return searchVectorPopulated.value === totalArticles.value
    ? pass(id, title, `${searchVectorPopulated.value} of ${totalArticles.value} populated.`, {
        populated: searchVectorPopulated.value,
        total: totalArticles.value,
      })
    : fail(
        id,
        title,
        `${searchVectorPopulated.value} of ${totalArticles.value} articles carry a search ` +
          'vector. The trigger populates it on insert and update, so a gap means rows were ' +
          'written by a path that bypassed it — those articles are invisible to keyword search.',
        { populated: searchVectorPopulated.value, total: totalArticles.value },
      )
}

/* ------------------------------------------------------------------------------------------- *
 * Search behaviour
 * ------------------------------------------------------------------------------------------- */

function rowCount(rows: unknown): number | null {
  return Array.isArray(rows) ? rows.length : null
}

/**
 * The window count `search_literature_v1` puts on every row it returns.
 *
 * Zero rows legitimately means zero matches — that is the one case where an empty page *is* the
 * answer. Any other shape returns `null`, and the caller reports missing evidence rather than
 * falling back to the page length.
 */
function reportedTotal(rows: unknown): number | null {
  if (!Array.isArray(rows)) return null
  if (rows.length === 0) return 0
  const first: unknown = rows[0]
  if (first === null || typeof first !== 'object') return null
  const raw = (first as Record<string, unknown>).total_count
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function checkSearchBehaviour(
  blankAdminPreview: Observation<unknown[]>,
  keywordSearch: Observation<unknown[]>,
  adminStats: Observation<Record<string, unknown>>,
  totalArticles: Observation<number>,
): CheckResult[] {
  const results: CheckResult[] = []

  results.push(
    fromObservation(
      'V40-blank-admin-preview',
      'the blank admin-preview search returns a valid result set',
      blankAdminPreview,
      (rows) => {
        const count = rowCount(rows)
        if (count === null) {
          return fail(
            'V40-blank-admin-preview',
            'the blank admin-preview search returns a valid result set',
            'The RPC returned a non-array payload.',
          )
        }
        return pass(
          'V40-blank-admin-preview',
          'the blank admin-preview search returns a valid result set',
          `${count} row(s) on the first page. An empty result here is a valid answer, not an ` +
            'error — the RPC succeeded.',
          { rows: count },
        )
      },
    ),
  )

  results.push(
    fromObservation(
      'V41-keyword-search',
      'keyword search executes and is a subset of the corpus',
      keywordSearch,
      (rows) => {
        const keywordId = 'V41-keyword-search'
        const keywordTitle = 'keyword search executes and is a subset of the corpus'
        const count = rowCount(rows)
        if (count === null) {
          return fail(keywordId, keywordTitle, 'The RPC returned a non-array payload.')
        }
        // The page length is not the match count. `search_literature_v1` returns at most
        // `p_page_size` rows, each carrying the window count in `total_count` — comparing the page
        // length against the corpus made the subset claim vacuous for any corpus larger than a
        // page. The reported total is what the claim is actually about.
        const matched = reportedTotal(rows)
        if (matched === null) {
          return fail(
            keywordId,
            keywordTitle,
            'The RPC returned rows without a `total_count`, so the number of matches is unknown ' +
              'and the subset claim cannot be judged from the page length alone.',
          )
        }
        if (!isObserved(totalArticles)) {
          return indeterminate(
            keywordId,
            keywordTitle,
            `No verdict: the RPC reported ${matched} match(es), but the corpus total was not ` +
              `observed (${describeObservation(totalArticles)}), so "a subset of the corpus" is ` +
              'not something this run can check.',
          )
        }
        if (matched > totalArticles.value) {
          return fail(
            keywordId,
            keywordTitle,
            `Keyword search reports ${matched} match(es) from a corpus of ` +
              `${totalArticles.value}. More matches than rows means an indexing or join defect.`,
            { matched, corpus: totalArticles.value },
          )
        }
        return pass(
          keywordId,
          keywordTitle,
          `${matched} match(es) from a corpus of ${totalArticles.value}; ${count} returned on the ` +
            'first page.',
          { matched, returned: count, corpus: totalArticles.value },
        )
      },
    ),
  )

  results.push(
    fromObservation(
      'V42-admin-stats',
      'the admin stats RPC agrees with the counted corpus',
      adminStats,
      (stats) => {
        // `typeof`, not `Number(...)`: `Number(null)` is `0` and `Number.isInteger(0)` is true, so
        // a stats payload carrying `total_articles: null` would have been read as a reported zero
        // and could "agree" with an empty corpus the RPC never actually counted.
        const raw = stats.total_articles
        const reported = typeof raw === 'number' ? raw : Number.NaN
        if (!Number.isInteger(reported)) {
          return fail(
            'V42-admin-stats',
            'the admin stats RPC agrees with the counted corpus',
            'The stats payload carried no integer `total_articles`. A null or absent value is ' +
              'reported as missing evidence, never as a count of zero.',
          )
        }
        if (!isObserved(totalArticles)) {
          return indeterminate(
            'V42-admin-stats',
            'the admin stats RPC agrees with the counted corpus',
            `No verdict: the corpus count was not observed (${describeObservation(totalArticles)}).`,
          )
        }
        return reported === totalArticles.value
          ? pass(
              'V42-admin-stats',
              'the admin stats RPC agrees with the counted corpus',
              `Stats and counted corpus both report ${reported}.`,
              { stats: reported, counted: totalArticles.value },
            )
          : fail(
              'V42-admin-stats',
              'the admin stats RPC agrees with the counted corpus',
              `Stats report ${reported}; the counted corpus holds ${totalArticles.value}.`,
              { stats: reported, counted: totalArticles.value },
            )
      },
    ),
  )

  return results
}

export function checkArticleDetail(
  detail: Observation<{ pmid: string }[]>,
  expectedPmid: string | null,
): CheckResult {
  const id = 'V43-article-detail'
  const title = 'a known article resolves by PMID'
  if (!expectedPmid) {
    return indeterminate(id, title, 'No verdict: no PMID was supplied for the spot check.')
  }
  return fromObservation(id, title, detail, (rows) =>
    rows.length === 1 && rows[0]?.pmid === expectedPmid
      ? pass(id, title, `PMID ${expectedPmid} resolved.`, { pmid: expectedPmid })
      : fail(
          id,
          title,
          `PMID ${expectedPmid} returned ${rows.length} row(s); exactly one was expected.`,
          { rows: rows.length },
        ),
  )
}

/* ------------------------------------------------------------------------------------------- *
 * Canary
 * ------------------------------------------------------------------------------------------- */

export function checkCanaryCount(
  totalArticles: Observation<number>,
  canaryStateCount: Observation<number>,
): CheckResult[] {
  const exactId = 'V50-canary-exact-count'
  const exactTitle = `the corpus holds exactly ${LITERATURE_CANARY_RECORD_COUNT} articles`
  const stateId = 'V51-canary-state'
  const stateTitle = 'every canary article is unreviewed and draft'

  const exact = fromObservation(exactId, exactTitle, totalArticles, (total) =>
    total === LITERATURE_CANARY_RECORD_COUNT
      ? pass(exactId, exactTitle, `Exactly ${total}.`, { total })
      : fail(
          exactId,
          exactTitle,
          `The corpus holds ${total}; the canary is exactly ${LITERATURE_CANARY_RECORD_COUNT}. ` +
            `${total < LITERATURE_CANARY_RECORD_COUNT ? 'Short' : 'Over'} by ` +
            `${Math.abs(total - LITERATURE_CANARY_RECORD_COUNT)}. A canary that lands near the ` +
            'target is a failed canary, not a nearly-successful one.',
          { total, expected: LITERATURE_CANARY_RECORD_COUNT },
        ),
  )

  const state = ((): CheckResult => {
    if (!isObserved(canaryStateCount) || !isObserved(totalArticles)) {
      return indeterminate(
        stateId,
        stateTitle,
        `No verdict: canary-state count=${describeObservation(canaryStateCount)}, ` +
          `corpus total=${describeObservation(totalArticles)}.`,
      )
    }
    return canaryStateCount.value === totalArticles.value
      ? pass(
          stateId,
          stateTitle,
          `All ${canaryStateCount.value} are ${LITERATURE_CANARY_RELEVANCE_STATE}/` +
            `${LITERATURE_CANARY_VISIBILITY_STATE}.`,
          { inCanaryState: canaryStateCount.value, total: totalArticles.value },
        )
      : fail(
          stateId,
          stateTitle,
          `${canaryStateCount.value} of ${totalArticles.value} articles are ` +
            `${LITERATURE_CANARY_RELEVANCE_STATE}/${LITERATURE_CANARY_VISIBILITY_STATE}. An ` +
            'import writes the foundation defaults; anything else means something curated rows.',
          { inCanaryState: canaryStateCount.value, total: totalArticles.value },
        )
  })()

  return [exact, state]
}

export interface CorpusSnapshot {
  readonly totalArticles: number
  readonly batchCount: number
  readonly insertedTotal: number
  readonly updatedTotal: number
  readonly duplicateTotal: number
  /**
   * The most recent `started_at` across all batches.
   *
   * Present because a batch *count* is not evidence that a second import ran. `import-nbib.ts`
   * skipped an identical completed file outright, writing nothing; a forced replay reset the
   * existing row in place rather than adding one. Either way the count is unchanged, so a check
   * that required it to grow would fail the documented workflow. That replay did move
   * `started_at`, which is the one observable trace there is.
   */
  readonly latestBatchStartedAt?: string | null
}

/**
 * A second run of the same import must add nothing.
 *
 * The observable signature of idempotency: the destination total is unchanged, and the newly
 * recorded batches inserted zero rows. Updates and duplicates are allowed to be non-zero — a
 * re-import legitimately touches existing rows — but an insert means a record that was not
 * recognised as already present, which is what idempotency is supposed to prevent.
 */
export function checkCanaryIdempotency(
  baseline: Observation<CorpusSnapshot>,
  current: Observation<CorpusSnapshot>,
  receipt?: Observation<IngestReceipt>,
  batches?: Observation<readonly BatchReceipt[]>,
): CheckResult {
  const id = 'V52-canary-idempotent'
  const title = 'the canary is an exact initial application or an exact deterministic replay'

  /*
   * Two valid states, not one.
   *
   * This check assumed every canary worth verifying was a *second* run, so it demanded a baseline
   * captured before another run and reported `indeterminate` without one. That made the first
   * legitimate 25-record canary — the entire point of the exercise — permanently unverifiable, and
   * because the scenario reduces one indeterminate to an indeterminate verdict, the whole canary
   * run reported no verdict and exited nonzero on a perfectly good import.
   *
   * The two states are genuinely different claims and are judged separately:
   *
   *   1. an *initial completed operation* — one completed batch, non-null `completed_at`, exact
   *      identity and counters, and the corpus holding exactly what it wrote. No baseline exists
   *      because nothing ran before it, and demanding one was a category error.
   *   2. a *deterministic replay* — the same completed operation and batch, no new batch, no
   *      timestamp movement, no duplicated rows, and a receipt that explicitly represents the
   *      read-only completed-operation short-circuit.
   *
   * Neither requires `--force`, a replacement batch, or a moved `started_at`; the engine has no
   * `--force` and never moves `started_at`.
   */
  if (receipt !== undefined && isObserved(receipt) && receipt.value.outcome === 'completed') {
    if (!isObserved(current)) {
      return indeterminate(id, title, `No verdict: current=${describeObservation(current)}.`)
    }
    if (batches === undefined || !isObserved(batches)) {
      return indeterminate(
        id,
        title,
        `No verdict: batches=${batches === undefined ? 'not supplied' : describeObservation(batches)}. ` +
          'An initial completed canary is established from the batch row it wrote.',
      )
    }
    const matched = batches.value.find((batch) => batch.id === receipt.value.importBatchId)
    if (!matched) {
      return fail(
        id,
        title,
        'The receipt reports a completed operation, but the batch it names is not in this ' +
          'project. There is no initial application to confirm.',
      )
    }
    const state = classifyStoredBatchState(matched)
    if (state.kind !== 'completed') {
      return fail(
        id,
        title,
        'The batch this receipt names is not in a resolvable completed state. ' +
          (state.kind === 'ambiguous' ? describeAmbiguousBatch(state.reason) : ''),
      )
    }
    const otherBatches = batches.value.filter((batch) => batch.id !== matched.id)
    if (otherBatches.length > 0) {
      return fail(
        id,
        title,
        `The receipt describes an initial application, but ${otherBatches.length} other import ` +
          'batch(es) exist in this project. The corpus was not written by this operation alone.',
      )
    }
    if (receipt.value.afterArticleCount !== current.value.totalArticles) {
      return fail(
        id,
        title,
        `The receipt recorded ${receipt.value.afterArticleCount} article(s); the corpus holds ` +
          `${current.value.totalArticles}.`,
      )
    }
    return pass(
      id,
      title,
      `An exact initial application: one completed batch, completed at ${state.completedAt}, and ` +
        `a corpus of exactly ${current.value.totalArticles}. There is no prior run to compare ` +
        'against because this is the first, which is not a gap in the evidence.',
      {
        total: current.value.totalArticles,
        operationId: receipt.value.operationId,
        outcome: receipt.value.outcome,
      },
    )
  }

  if (!isObserved(baseline) || !isObserved(current)) {
    return indeterminate(
      id,
      title,
      `No verdict: baseline=${describeObservation(baseline)}, ` +
        `current=${describeObservation(current)}. A replay is a comparison of two runs and ` +
        'cannot be inferred from one; an initial application is established from its completion ' +
        'receipt instead.',
    )
  }

  const problems: string[] = []
  if (current.value.totalArticles !== baseline.value.totalArticles) {
    problems.push(
      `the corpus moved from ${baseline.value.totalArticles} to ${current.value.totalArticles}`,
    )
  }
  // An *increase* means rows were inserted that the importer did not recognise as already
  // present. A decrease was normal for the previous importer, which reset the row in place, so
  // recomputed rather than accumulated.
  if (current.value.insertedTotal > baseline.value.insertedTotal) {
    problems.push(
      `inserts rose from ${baseline.value.insertedTotal} to ${current.value.insertedTotal}`,
    )
  }
  if (problems.length > 0) {
    return fail(id, title, `Not idempotent: ${problems.join('; ')}.`, {
      baseline: baseline.value,
      current: current.value,
    })
  }

  /*
   * The numbers agree. Whether they agree *because a second run happened and changed nothing* or
   * because nothing ran at all is a separate question — and against the production ingestion
   * engine the database cannot answer it at all.
   *
   * That engine derives a deterministic operation id, so a replay reuses the same
   * `literature_import_batches` row, takes a read-only short-circuit, and writes nothing: the batch
   * count never grows and `started_at` never moves. The heuristic below was written against the
   * previous importer, whose `--force` reset the row in place and did move `started_at`. The engine
   * has no `--force` at all — passing one aborts with `Unknown option`. So without other evidence
   * this check was unpassable, which made the whole canary scenario permanently indeterminate and
   * its exit status nonzero on a perfectly good replay.
   *
   * The engine's own replay receipt states the fact directly, so it is consulted first.
   */
  if (receipt !== undefined && isObserved(receipt)) {
    if (receipt.value.outcome === 'idempotent-replay') {
      /*
       * A replay receipt is a claim that nothing was written. Confirm it against the database
       * rather than accepting the outcome string: the same batch, no new batch, and no timestamp
       * movement are all independently observable, and a replay that moved any of them is not the
       * read-only short-circuit it says it is.
       */
      const replayProblems: string[] = []
      if (current.value.batchCount !== baseline.value.batchCount) {
        replayProblems.push(
          `the batch count moved from ${baseline.value.batchCount} to ${current.value.batchCount}`,
        )
      }
      if (
        current.value.latestBatchStartedAt != null &&
        baseline.value.latestBatchStartedAt != null &&
        current.value.latestBatchStartedAt !== baseline.value.latestBatchStartedAt
      ) {
        replayProblems.push('a batch start time moved')
      }
      if (batches !== undefined && isObserved(batches)) {
        const matched = batches.value.find((batch) => batch.id === receipt.value.importBatchId)
        if (!matched) {
          replayProblems.push('the batch the replay names is not in this project')
        } else if (classifyStoredBatchState(matched).kind !== 'completed') {
          replayProblems.push('the batch the replay names is not in a resolvable completed state')
        }
      }
      if (replayProblems.length > 0) {
        return fail(
          id,
          title,
          `The receipt claims a read-only replay, but ${replayProblems.join('; ')}. A replay that ` +
            'changed the database is not a replay.',
        )
      }
      return pass(
        id,
        title,
        `The engine recognised the re-run as an identical operation and wrote nothing: the same ` +
          `completed batch, no new batch, no start time moved, and the corpus still at ` +
          `${current.value.totalArticles}.`,
        {
          total: current.value.totalArticles,
          operationId: receipt.value.operationId,
          outcome: receipt.value.outcome,
        },
      )
    }
  }

  // No receipt. Fall back to the database trace, which the previous importer produced and the
  // current engine does not — so say what would settle it rather than naming a flag that no
  // longer exists.
  const replayEvidenced =
    current.value.batchCount > baseline.value.batchCount ||
    (current.value.latestBatchStartedAt != null &&
      baseline.value.latestBatchStartedAt != null &&
      current.value.latestBatchStartedAt !== baseline.value.latestBatchStartedAt)

  if (!replayEvidenced) {
    return indeterminate(
      id,
      title,
      `The corpus is unchanged at ${current.value.totalArticles} and nothing new was inserted, ` +
        'but the database shows no trace of a second run between the two captures: no new batch, ' +
        'and no batch start time moved. That is the expected and correct behaviour of the ' +
        'production ingestion engine, which recognises an identical operation and writes nothing ' +
        '— so the database cannot settle this. Pass the replay receipt the engine wrote ' +
        '(`--ingest-receipt <canary-*.replay-*.receipt.json>`) to get a verdict.',
    )
  }

  return pass(
    id,
    title,
    `A second import is evidenced and the corpus stayed at ${current.value.totalArticles} with ` +
      'no new inserts.',
    {
      total: current.value.totalArticles,
      insertedBefore: baseline.value.insertedTotal,
      insertedAfter: current.value.insertedTotal,
    },
  )
}

/* ------------------------------------------------------------------------------------------- *
 * Batches, receipts, provenance
 * ------------------------------------------------------------------------------------------- */

export interface BatchReconciliation {
  readonly ambiguous: readonly string[]
  readonly failed: readonly string[]
  readonly completed: number
  readonly insertedTotal: number
  readonly updatedTotal: number
  readonly duplicateTotal: number
  readonly errorTotal: number
  readonly recordsReadTotal: number
  /**
   * `records_read` summed over completed batches only.
   *
   * A file that failed part way and was retried leaves two receipts, both of which read the same
   * source records. Summing every batch would double-count them and report a source/destination
   * gap on a corpus that reconciles perfectly. Only the batches that completed describe what was
   * actually taken from the source.
   */
  readonly completedRecordsReadTotal: number
}

export function reconcileBatches(batches: readonly BatchReceipt[]): BatchReconciliation {
  const ambiguous = batches
    .filter(
      (batch) => batch.status === LITERATURE_AMBIGUOUS_BATCH_STATUS || batch.completed_at === null,
    )
    .filter((batch) => batch.status !== 'skipped')
    .map((batch) => batch.id)

  return {
    ambiguous,
    failed: batches.filter((batch) => batch.status === 'failed').map((batch) => batch.id),
    completed: batches.filter((batch) => batch.status === 'completed').length,
    insertedTotal: batches.reduce((sum, batch) => sum + batch.inserted_count, 0),
    updatedTotal: batches.reduce((sum, batch) => sum + batch.updated_count, 0),
    duplicateTotal: batches.reduce((sum, batch) => sum + batch.duplicate_count, 0),
    errorTotal: batches.reduce((sum, batch) => sum + batch.error_count, 0),
    recordsReadTotal: batches.reduce((sum, batch) => sum + batch.records_read, 0),
    completedRecordsReadTotal: batches
      .filter((batch) => batch.status === 'completed')
      .reduce((sum, batch) => sum + batch.records_read, 0),
  }
}

/**
 * A batch with no receipt stops the run.
 *
 * `status = 'started'` with a null `completed_at` describes an import whose outcome nobody
 * recorded. It may have written every row, some rows, or none, and the destination cannot tell
 * which — the counts it would be reconciled against are the very thing in doubt. Guessing here is
 * how a corpus ends up silently short, so the verdict is a stop, and the remedy is a human
 * reading the batch and its errors before anything else runs.
 */
export function checkBatchReconciliation(
  batches: Observation<readonly BatchReceipt[]>,
): CheckResult[] {
  const ambiguousId = 'V60-no-ambiguous-batch'
  const ambiguousTitle = 'no import batch is missing its receipt'
  const failedId = 'V61-no-failed-batch'
  const failedTitle = 'no import batch is recorded as failed'

  const ambiguous = fromObservation(ambiguousId, ambiguousTitle, batches, (rows) => {
    const reconciliation = reconcileBatches(rows)
    return reconciliation.ambiguous.length === 0
      ? pass(ambiguousId, ambiguousTitle, `${rows.length} batch(es), all with a receipt.`, {
          batches: rows.length,
        })
      : fail(
          ambiguousId,
          ambiguousTitle,
          `${reconciliation.ambiguous.length} batch(es) are still 'started' or have no ` +
            `completed_at: ${reconciliation.ambiguous.join(', ')}. Their outcome is unrecorded, ` +
            'so every count derived from them is unreliable. Stop and reconcile by hand — read ' +
            'the batch row and its literature_import_errors before running anything else. Do ' +
            'not re-import over an ambiguous batch.',
          { ambiguous: reconciliation.ambiguous },
        )
  })

  const failedCheck = fromObservation(failedId, failedTitle, batches, (rows) => {
    const reconciliation = reconcileBatches(rows)
    return reconciliation.failed.length === 0
      ? pass(failedId, failedTitle, 'No batch is in the failed state.')
      : fail(
          failedId,
          failedTitle,
          `${reconciliation.failed.length} failed batch(es): ${reconciliation.failed.join(', ')}.`,
          { failed: reconciliation.failed },
        )
  })

  return [ambiguous, failedCheck]
}

/** Whether reconciliation found a condition that must stop the run regardless of other results. */
export function hasAmbiguousBatch(batches: Observation<readonly BatchReceipt[]>): boolean {
  return isObserved(batches) && reconcileBatches(batches.value).ambiguous.length > 0
}

export function checkReceiptConsistency(
  batches: Observation<readonly BatchReceipt[]>,
  totalArticles: Observation<number>,
): CheckResult {
  const id = 'V62-receipt-consistency'
  const title = 'the batch receipts account for every article in the corpus'
  if (!isObserved(batches) || !isObserved(totalArticles)) {
    return indeterminate(
      id,
      title,
      `No verdict: batches=${describeObservation(batches)}, ` +
        `corpus=${describeObservation(totalArticles)}.`,
    )
  }
  const reconciliation = reconcileBatches(batches.value)
  if (reconciliation.ambiguous.length > 0) {
    return indeterminate(
      id,
      title,
      `No verdict: ${reconciliation.ambiguous.length} batch(es) have no receipt, so the inserted ` +
        'totals they contribute are not trustworthy inputs to this comparison.',
    )
  }
  return reconciliation.insertedTotal === totalArticles.value
    ? pass(
        id,
        title,
        `Receipts record ${reconciliation.insertedTotal} insert(s); the corpus holds ` +
          `${totalArticles.value}.`,
        { inserted: reconciliation.insertedTotal, corpus: totalArticles.value },
      )
    : fail(
        id,
        title,
        `Receipts record ${reconciliation.insertedTotal} insert(s) but the corpus holds ` +
          `${totalArticles.value}. A surplus means rows arrived by a path that wrote no receipt; ` +
          'a shortfall means rows a receipt claims were written are not there.',
        { inserted: reconciliation.insertedTotal, corpus: totalArticles.value },
      )
}

export function checkSourceProvenance(
  sources: Observation<readonly SourceRow[]>,
  batches: Observation<readonly BatchReceipt[]>,
  totalArticles: Observation<number>,
): CheckResult[] {
  const coverageId = 'V63-provenance-coverage'
  const coverageTitle = 'every article carries at least one source row'
  const batchId = 'V64-provenance-batches'
  const batchTitle = 'every source row names a batch that exists'

  const coverage = ((): CheckResult => {
    if (!isObserved(sources) || !isObserved(totalArticles)) {
      return indeterminate(
        coverageId,
        coverageTitle,
        `No verdict: sources=${describeObservation(sources)}, ` +
          `corpus=${describeObservation(totalArticles)}.`,
      )
    }
    const distinct = new Set(sources.value.map((row) => row.pmid)).size
    return distinct === totalArticles.value
      ? pass(coverageId, coverageTitle, `${distinct} article(s) have provenance.`, {
          distinctPmids: distinct,
          corpus: totalArticles.value,
        })
      : fail(
          coverageId,
          coverageTitle,
          `${distinct} distinct PMIDs have a source row but the corpus holds ` +
            `${totalArticles.value}. An article with no provenance cannot be traced to the file ` +
            'it came from.',
          { distinctPmids: distinct, corpus: totalArticles.value },
        )
  })()

  const batchLinkage = ((): CheckResult => {
    if (!isObserved(sources) || !isObserved(batches)) {
      return indeterminate(
        batchId,
        batchTitle,
        `No verdict: sources=${describeObservation(sources)}, ` +
          `batches=${describeObservation(batches)}.`,
      )
    }
    const known = new Set(batches.value.map((batch) => batch.id))
    const orphans = [...new Set(sources.value.map((row) => row.batch_id))].filter(
      (id) => !known.has(id),
    )
    return orphans.length === 0
      ? pass(batchId, batchTitle, 'Every source row resolves to a recorded batch.')
      : fail(
          batchId,
          batchTitle,
          `${orphans.length} source batch id(s) have no batch row: ${orphans.join(', ')}.`,
          { orphans },
        )
  })()

  return [coverage, batchLinkage]
}

/**
 * Duplicate PMIDs in the destination.
 *
 * `literature_articles.pmid` is the primary key, so a duplicate is structurally impossible — which
 * is exactly why the check is written as a comparison rather than as an assertion of the obvious.
 * If the counted corpus and the distinct-PMID count ever disagreed, the primary key would have to
 * be gone, and that is worth knowing loudly.
 */
export function checkNoDuplicatePmids(
  totalArticles: Observation<number>,
  distinctPmids: Observation<number>,
): CheckResult {
  const id = 'V65-no-duplicate-pmids'
  const title = 'no PMID appears twice in the corpus'
  if (!isObserved(totalArticles) || !isObserved(distinctPmids)) {
    return indeterminate(
      id,
      title,
      `No verdict: corpus=${describeObservation(totalArticles)}, ` +
        `distinct=${describeObservation(distinctPmids)}.`,
    )
  }
  return totalArticles.value === distinctPmids.value
    ? pass(id, title, `${distinctPmids.value} rows, ${distinctPmids.value} distinct PMIDs.`, {
        rows: totalArticles.value,
        distinct: distinctPmids.value,
      })
    : fail(
        id,
        title,
        `${totalArticles.value} rows but ${distinctPmids.value} distinct PMIDs. The PMID primary ` +
          'key makes this impossible, so the constraint itself is the thing to investigate.',
        { rows: totalArticles.value, distinct: distinctPmids.value },
      )
}

/* ------------------------------------------------------------------------------------------- *
 * Full-corpus reconciliation
 * ------------------------------------------------------------------------------------------- */

export interface CorpusExpectation {
  readonly sourceRecordCount: number
  readonly sourceDistinctPmidCount: number
  readonly sourceFiles: readonly { filename: string; sha256: string; recordCount: number }[]
}

export function checkFullCorpus(
  expectation: Observation<CorpusExpectation>,
  batches: Observation<readonly BatchReceipt[]>,
  totalArticles: Observation<number>,
  receipt?: Observation<IngestReceipt>,
): CheckResult[] {
  const countId = 'V70-corpus-counts'
  const countTitle = 'the destination corpus matches the declared source'
  const fileId = 'V71-corpus-files'
  const fileTitle = 'every declared source file has a batch with a matching checksum'

  const counts = ((): CheckResult => {
    if (!isObserved(expectation) || !isObserved(totalArticles) || !isObserved(batches)) {
      return indeterminate(
        countId,
        countTitle,
        `No verdict: expectation=${describeObservation(expectation)}, ` +
          `corpus=${describeObservation(totalArticles)}, batches=${describeObservation(batches)}.`,
      )
    }
    /*
     * Scoped to the declared operation when a receipt names one.
     *
     * Summing `records_read` across every completed batch double-counts the canary. The ingestion
     * engine leaves the canary's batch row `completed` forever, and the runbook's own order runs
     * the canary before the full import — so a full-corpus reconciliation over all batches
     * overshoots the declared source by exactly the canary size, and reports a failure on a corpus
     * that is exactly right. The previous importer's batches were per-file and disjoint, which is
     * the assumption that no longer holds.
     */
    const scopedBatches =
      receipt !== undefined && isObserved(receipt) && receipt.value.importBatchId !== null
        ? batches.value.filter((batch) => batch.id === receipt.value.importBatchId)
        : batches.value
    const reconciliation = reconcileBatches(scopedBatches)
    const scopeNote =
      scopedBatches.length === batches.value.length
        ? ''
        : ' (scoped to the operation named by the receipt)'
    const problems: string[] = []
    if (reconciliation.completedRecordsReadTotal !== expectation.value.sourceRecordCount) {
      problems.push(
        `completed receipts read ${reconciliation.completedRecordsReadTotal} record(s)${scopeNote}, ` +
          `the source declares ${expectation.value.sourceRecordCount}`,
      )
    }
    if (totalArticles.value !== expectation.value.sourceDistinctPmidCount) {
      problems.push(
        `the corpus holds ${totalArticles.value} article(s), the source declares ` +
          `${expectation.value.sourceDistinctPmidCount} distinct PMID(s)`,
      )
    }
    return problems.length === 0
      ? pass(
          countId,
          countTitle,
          `${totalArticles.value} article(s) from ` +
            `${reconciliation.completedRecordsReadTotal} source record(s), as declared.`,
          {
            corpus: totalArticles.value,
            recordsRead: reconciliation.completedRecordsReadTotal,
          },
        )
      : fail(countId, countTitle, problems.join('; '), {
          corpus: totalArticles.value,
          recordsRead: reconciliation.completedRecordsReadTotal,
          expected: expectation.value.sourceDistinctPmidCount,
        })
  })()

  const files = ((): CheckResult => {
    if (!isObserved(expectation) || !isObserved(batches)) {
      return indeterminate(
        fileId,
        fileTitle,
        `No verdict: expectation=${describeObservation(expectation)}, ` +
          `batches=${describeObservation(batches)}.`,
      )
    }
    const byChecksum = new Map(
      batches.value.map((batch) => [batch.source_file_sha256, batch] as const),
    )
    const missing = expectation.value.sourceFiles.filter((file) => !byChecksum.has(file.sha256))

    /*
     * `source_file_sha256` is not a file digest under the production ingestion engine.
     *
     * That engine reads a database table, not files. It synthesizes a `source_filename` and stores
     * a digest of the *mapped projection* in `source_file_sha256` — a value that changes when the
     * mapping version changes, even with byte-identical source data. An operator who prepares this
     * expectation the way the field name implies, by checksumming an exported file, gets a
     * guaranteed failure on a correct corpus.
     *
     * So when a receipt is present, the projection checksum it carries is what a declared entry
     * must match, and the message says which value is actually being compared.
     */
    if (receipt !== undefined && isObserved(receipt) && missing.length > 0) {
      const projection = receipt.value.sourceProjectionChecksum
      const declaredProjection = expectation.value.sourceFiles.some(
        (file) => file.sha256 === projection,
      )
      if (!declaredProjection) {
        return indeterminate(
          fileId,
          fileTitle,
          'No verdict: the declared source files do not include the projection checksum this ' +
            'operation actually recorded. The ingestion engine reads a table rather than files, ' +
            'so `source_file_sha256` holds a digest of the mapped projection ' +
            `(${projection.slice(0, 12)}…), not a checksum of any file on disk. Declare that ` +
            'value to make this check meaningful, or omit sourceFiles entirely.',
        )
      }
    }

    return missing.length === 0
      ? pass(
          fileId,
          fileTitle,
          `All ${expectation.value.sourceFiles.length} declared file(s) have a matching batch.`,
        )
      : fail(
          fileId,
          fileTitle,
          `${missing.length} declared file(s) have no batch with a matching SHA-256: ` +
            `${missing.map((file) => file.filename).join(', ')}. Matching is by checksum, not ` +
            'filename, so a renamed or re-exported file shows up here.',
          { missing: missing.map((file) => file.filename) },
        )
  })()

  return [counts, files]
}

/* ------------------------------------------------------------------------------------------- *
 * Ingestion receipt binding
 * ------------------------------------------------------------------------------------------- */

/**
 * Bind the corpus being read to the operation that claims to have written it.
 *
 * Without this, the canary scenario's strongest statement — "exactly twenty-five unreviewed drafts
 * are present, every one accounted for by a batch receipt" — is satisfied by *any* twenty-five
 * unreviewed drafts, written by any batch, from any manifest, in any project. It is a claim about
 * a shape, not about an operation. A canary run against a stale or unapproved manifest passes it.
 *
 * Every assertion below compares a receipt field against something read independently from the
 * database, so a receipt describing a different operation disagrees loudly instead of being
 * believed. The receipt is evidence, not authority.
 */
export function checkIngestReceiptBinding(
  receipt: Observation<IngestReceipt> | undefined,
  batches: Observation<readonly BatchReceipt[]>,
  totalArticles: Observation<number>,
  // The provenance rows, not a second article read: they already carry every PMID, are already
  // paged to the exact Content-Range total, and are already collected for every scenario.
  sources: Observation<readonly SourceRow[]>,
  // The project actually being read, and the live state of the articles. Without the first, a
  // checksum-valid receipt naming a different project bound cleanly to whatever was in front of it.
  target: TargetFacts,
  articleStates: Observation<readonly ArticleSummary[]>,
): CheckResult[] {
  const results: CheckResult[] = []
  const bindId = 'V55-receipt-binds-operation'
  const bindTitle = 'the receipt is bound to this project, this batch, and these rows'

  if (receipt === undefined || !isObserved(receipt)) {
    return [
      indeterminate(
        bindId,
        bindTitle,
        `No verdict: receipt=${receipt === undefined ? 'not supplied' : describeObservation(receipt)}. Pass the receipt the ingestion ` +
          'engine wrote with `--ingest-receipt <path>` to bind these observations to a specific ' +
          'operation. Without it the corpus checks describe a shape rather than a run.',
      ),
    ]
  }

  // An edited receipt is the failure mode that matters here: a number changed by hand to make a
  // check agree. This detects that and nothing else — it is not a signature and proves no origin.
  if (!ingestReceiptChecksumMatches(receipt.value)) {
    return [
      fail(
        bindId,
        bindTitle,
        'The receipt checksum does not match its own contents, so the file was modified after the ' +
          'engine wrote it. Nothing it claims can be relied on.',
      ),
    ]
  }

  /*
   * The shared binding contract.
   *
   * Everything V55 used to do by hand — and the six things it did not do — now comes from the one
   * function the ingestion package's own `verify` command calls. A checksum-valid receipt naming
   * Endoreels, a batch written by an unreviewed `created_by`, provenance belonging to another
   * operation, duplicate PMID claims, drifted replay counters, and a stored mode or engine version
   * that disagrees with the receipt are each a finding here rather than a silent pass.
   */
  const matchedBatch = isObserved(batches)
    ? (batches.value.find((batch) => batch.id === receipt.value.importBatchId) ?? null)
    : null
  const binding = evaluateReceiptBinding(receipt.value, {
    observedProjectRef: target.projectRef || null,
    observedUrl: target.url || null,
    batch: matchedBatch,
    batchesObserved: isObserved(batches),
    provenance: isObserved(sources) ? sources.value : null,
    articleStates: isObserved(articleStates) ? articleStates.value : null,
    totalArticles: isObserved(totalArticles) ? totalArticles.value : null,
  })
  const findingsFor = (codes: readonly BindingFindingCode[]) =>
    binding.findings.filter((entry) => codes.includes(entry.code))
  const renderFindings = (entries: readonly { subject: string; detail: string }[]) =>
    entries.map((entry) => `${entry.subject}: ${entry.detail}`).join(' ')

  /* --------------------------------------------------------------------------------------- *
   * V55 — target, writer, batch existence, and reviewed identity.
   * --------------------------------------------------------------------------------------- */

  const bindCodes: readonly BindingFindingCode[] = [
    'receipt_target_project_not_approved',
    'receipt_target_project_not_observed',
    'receipt_target_url_not_canonical',
    'receipt_target_url_not_observed',
    'receipt_engine_version_unreviewed',
    'receipt_mapping_version_unreviewed',
    'receipt_writer_identity_unreviewed',
    'receipt_source_authority_unreviewed',
    'receipt_outcome_not_bindable',
    'receipt_batch_id_absent',
    'receipt_batch_id_not_operation_id',
    'batch_absent_from_project',
    'batch_created_by_unreviewed',
    'batch_not_completed',
    'batch_completed_at_missing',
    'batch_completed_at_malformed',
  ]
  const bindFindings = findingsFor(bindCodes)
  if (bindFindings.length > 0) {
    results.push(fail(bindId, bindTitle, renderFindings(bindFindings)))
  } else if (!isObserved(batches)) {
    results.push(
      indeterminate(bindId, bindTitle, `No verdict: batches=${describeObservation(batches)}.`),
    )
  } else {
    results.push(
      pass(
        bindId,
        bindTitle,
        `The receipt binds to import batch ${matchedBatch?.id ?? '(none)'} in project ` +
          `${target.projectRef}, written by the reviewed ingestion writer.`,
        { operationId: receipt.value.operationId, batchId: matchedBatch?.id ?? null },
      ),
    )
  }

  /* --------------------------------------------------------------------------------------- *
   * V56 — counters, including the replay case the previous check left almost entirely open.
   * --------------------------------------------------------------------------------------- */

  const counterId = 'V56-receipt-counters-agree'
  const counterTitle = 'the receipt counters match the batch row'
  const counterFindings = findingsFor([
    'counter_drift',
    'replay_reported_effects',
    'error_count_nonzero',
  ])
  if (!matchedBatch) {
    results.push(
      indeterminate(
        counterId,
        counterTitle,
        'No verdict: there is no matched batch row to compare counters against.',
      ),
    )
  } else if (counterFindings.length > 0) {
    results.push(fail(counterId, counterTitle, renderFindings(counterFindings)))
  } else {
    results.push(
      pass(
        counterId,
        counterTitle,
        receipt.value.outcome === 'idempotent-replay'
          ? 'The replay wrote nothing, and every counter it carries still matches the operation ' +
              'it replayed.'
          : 'Every counter in the receipt matches the batch row it names.',
      ),
    )
  }

  /* --------------------------------------------------------------------------------------- *
   * V57 — the complete operation record the engine stamped into the row itself, which is the only
   * copy of these values that did not travel through the operator's disk.
   *
   * This check owns no comparison of its own any more. It used to add one — the batch-checksum
   * summary, guarded by `typeof stored === 'string'` — on the reasoning that the value was
   * receipt-derived and therefore outside the shared contract. Both halves of that were wrong: the
   * summary belongs to the stored report like every other field, and the type guard turned an
   * *omitted* summary into a skipped comparison, so deleting the field passed. Alongside it, five
   * stored fields were bound by neither side. The shared contract now decides all eleven, and this
   * check renders the verdict.
   * --------------------------------------------------------------------------------------- */

  const reportId = 'V57-receipt-matches-batch-report'
  const reportTitle =
    'the receipt agrees with the complete operation record stored in the batch row'
  const reportFindings = findingsFor([
    'batch_report_operation_id_drift',
    'batch_report_mode_drift',
    'batch_report_engine_version_drift',
    'batch_report_mapping_version_drift',
    'batch_report_source_checksum_drift',
    'batch_report_manifest_checksum_drift',
    'batch_report_unchanged_count_drift',
    'batch_report_before_count_drift',
    'batch_report_after_count_drift',
    'batch_report_batch_count_drift',
    'batch_report_batch_checksums_drift',
    'batch_report_field_malformed',
    'batch_report_unexpected_shape',
    'batch_report_arithmetic_impossible',
    'batch_identity_source_checksum_drift',
  ])
  const absentReport = findingsFor(['batch_report_absent'])
  if (!matchedBatch) {
    results.push(
      indeterminate(reportId, reportTitle, 'No verdict: there is no matched batch row to read.'),
    )
  } else if (absentReport.length > 0) {
    results.push(fail(reportId, reportTitle, renderFindings(absentReport)))
  } else if (reportFindings.length > 0) {
    results.push(fail(reportId, reportTitle, renderFindings(reportFindings)))
  } else {
    results.push(
      pass(
        reportId,
        reportTitle,
        `All ${STABLE_FINAL_REPORT_KEYS.length} stored report fields agree with the operation ` +
          'reconstructed from the receipt and from independently observed rows.',
      ),
    )
  }

  /* --------------------------------------------------------------------------------------- *
   * V58 — the corpus total is the one number an operator reads off the administration page.
   * --------------------------------------------------------------------------------------- */

  const totalId = 'V58-receipt-matches-corpus'
  const totalTitle = 'the corpus total matches what the receipt recorded'
  const totalFindings = findingsFor(['corpus_total_moved'])
  if (!isObserved(totalArticles)) {
    results.push(
      indeterminate(
        totalId,
        totalTitle,
        `No verdict: corpus=${describeObservation(totalArticles)}.`,
      ),
    )
  } else if (receipt.value.afterArticleCount === null) {
    results.push(
      indeterminate(
        totalId,
        totalTitle,
        'The receipt records no after-count, which is the shape a dry-run receipt has.',
      ),
    )
  } else {
    results.push(
      totalFindings.length > 0
        ? fail(totalId, totalTitle, renderFindings(totalFindings))
        : pass(
            totalId,
            totalTitle,
            `Both the receipt and the database report ${totalArticles.value} article(s).`,
          ),
    )
  }

  /* --------------------------------------------------------------------------------------- *
   * V59 — the exact claimed records, scoped to the exact batch.
   *
   * This is what turns "twenty-five drafts" into "the twenty-five the owner authorized". Three
   * things it now does that it did not: it rejects a duplicated claim before anything becomes a
   * `Set`; it compares against provenance written by *this batch* rather than by any batch; and it
   * requires every claimed article to exist and to be draft/unreviewed.
   * --------------------------------------------------------------------------------------- */

  const pmidId = 'V59-receipt-pmids-present'
  const pmidTitle =
    'every PMID the receipt claims is present, in this batch, as an unreviewed draft'
  const claimed = receipt.value.canaryPmids
  const pmidFindings = findingsFor([
    'claimed_pmids_duplicated',
    'claimed_pmids_wrong_cardinality',
    'claimed_pmids_malformed',
    'provenance_missing_for_claim',
    'provenance_extra_in_batch',
    'provenance_claim_under_other_batch',
    'article_missing_for_claim',
    'article_not_draft_unreviewed',
  ])
  if (pmidFindings.length > 0) {
    results.push(fail(pmidId, pmidTitle, renderFindings(pmidFindings)))
  } else if (receipt.value.mode === 'full') {
    results.push(
      indeterminate(
        pmidId,
        pmidTitle,
        'The receipt lists no canary PMIDs, which is expected for a full-corpus operation.',
      ),
    )
  } else if (!isObserved(sources) || !isObserved(articleStates)) {
    results.push(
      indeterminate(
        pmidId,
        pmidTitle,
        `No verdict: provenance=${describeObservation(sources)}, ` +
          `article states=${describeObservation(articleStates)}.`,
      ),
    )
  } else {
    results.push(
      pass(
        pmidId,
        pmidTitle,
        `All ${claimed?.length ?? 0} PMID(s) named by the receipt carry provenance under batch ` +
          `${receipt.value.importBatchId ?? '(none)'}, nothing else does, and every one is an ` +
          'unreviewed draft.',
        { batchScopedProvenance: binding.batchScopedProvenanceCount },
      ),
    )
  }

  // Anything the contract could not judge is reported as such rather than as agreement.
  if (binding.unobserved.length > 0) {
    results.push(
      indeterminate(
        'V55b-receipt-binding-observability',
        'every bound value was independently observed',
        `No verdict on ${binding.unobserved.length} bound value(s): ` +
          `${binding.unobserved.join('; ')}. An unobserved value is never treated as agreement.`,
      ),
    )
  }

  return results
}

/* ------------------------------------------------------------------------------------------- *
 * Public exclusion
 * ------------------------------------------------------------------------------------------- */

export function checkPublicExclusion(
  publicSearch: Observation<unknown[]>,
  publiclyVisibleCount: Observation<number>,
  anonymousTableRead: Observation<{ denied: boolean; rowsReturned: number | null; status: number }>,
  anonymousRpcRead: Observation<{ denied: boolean; rowsReturned: number | null; status: number }>,
): CheckResult[] {
  const results: CheckResult[] = []

  results.push(
    fromObservation(
      'V80-public-search-empty',
      'the default (non-admin) search returns no draft record',
      publicSearch,
      (rows) => {
        const count = rowCount(rows)
        if (count === null) {
          return fail(
            'V80-public-search-empty',
            'the default (non-admin) search returns no draft record',
            'The RPC returned a non-array payload, so nothing was proven about what it returns.',
          )
        }
        return count === 0
          ? pass(
              'V80-public-search-empty',
              'the default (non-admin) search returns no draft record',
              'The RPC executed and returned 0 rows. It ran: this is an observed empty result, ' +
                'not a failure being read as empty.',
              { rows: 0 },
            )
          : fail(
              'V80-public-search-empty',
              'the default (non-admin) search returns no draft record',
              `The default search returned ${count} row(s). With p_admin_preview false the RPC ` +
                `admits only ${LITERATURE_PUBLICLY_VISIBLE_STATE.relevanceState}/` +
                `${LITERATURE_PUBLICLY_VISIBLE_STATE.visibilityState} articles, so a non-zero ` +
                'result means records have been curated into public visibility.',
              { rows: count },
            )
      },
    ),
  )

  results.push(
    fromObservation(
      'V81-nothing-published',
      'no article is in the publicly visible state',
      publiclyVisibleCount,
      (count) =>
        count === 0
          ? pass(
              'V81-nothing-published',
              'no article is in the publicly visible state',
              `0 articles are ${LITERATURE_PUBLICLY_VISIBLE_STATE.relevanceState}/` +
                `${LITERATURE_PUBLICLY_VISIBLE_STATE.visibilityState}.`,
            )
          : fail(
              'V81-nothing-published',
              'no article is in the publicly visible state',
              `${count} article(s) are included and published. Independently of what search ` +
                'returns, those rows are the ones a public reader could reach.',
              { publiclyVisible: count },
            ),
    ),
  )

  for (const [id, title, observation, subject] of [
    [
      'V82-anonymous-table',
      'an anonymous caller cannot enumerate Literature rows',
      anonymousTableRead,
      'a table read',
    ],
    [
      'V83-anonymous-rpc',
      'an anonymous caller cannot invoke the search RPC',
      anonymousRpcRead,
      'the search RPC',
    ],
  ] as const) {
    results.push(
      fromObservation(id, title, observation, (probe) => {
        if (probe.denied) {
          return pass(id, title, `${subject} was refused with HTTP ${probe.status}.`, {
            status: probe.status,
          })
        }
        const rows = probe.rowsReturned
        return fail(
          id,
          title,
          `${subject} succeeded for an anonymous caller (HTTP ${probe.status}` +
            `${rows === null ? '' : `, ${rows} row(s)`}). RLS is enabled with no policy and the ` +
            'unprivileged roles hold no table privilege, so this should be impossible — treat it ' +
            'as an exposure and remove the Literature runtime variables before investigating.',
          { status: probe.status, rows },
        )
      }),
    )
  }

  return results
}

export function checkSitemapExclusion(sitemap: Observation<string>): CheckResult {
  const id = 'V84-sitemap-exclusion'
  const title = 'the sitemap contains no Literature article URL'
  return fromObservation(id, title, sitemap, (body) => {
    const offenders = [...body.matchAll(/<loc>([^<]*\/literature(?:\/[^<]*)?)<\/loc>/gu)].map(
      (match) => match[1],
    )
    return offenders.length === 0
      ? pass(id, title, 'No /literature URL appears in the sitemap.')
      : fail(
          id,
          title,
          `${offenders.length} Literature URL(s) are listed: ${offenders.slice(0, 5).join(', ')}` +
            `${offenders.length > 5 ? ' …' : ''}. Draft articles must never be advertised.`,
          { offenders: offenders.length },
        )
  })
}

/* ------------------------------------------------------------------------------------------- *
 * Application-layer state
 * ------------------------------------------------------------------------------------------- */

export type ApplicationRuntimeExpectation = 'not_configured' | 'configured'

/**
 * What the deployed application says about itself.
 *
 * The not-configured scenario is the one where a *refusal* is the pass: with the Railway variables
 * absent, `/api/literature/search` must answer with a structured "not configured" rather than a
 * stack trace or a 500. The same probe with the variables present and capability gating deployed
 * must answer with a result set.
 */
export function checkApplicationRuntime(
  adminSearchApi: Observation<ApplicationProbe>,
  expectation: ApplicationRuntimeExpectation,
): CheckResult {
  const id = 'V90-runtime-state'
  const title =
    expectation === 'not_configured'
      ? 'the application truthfully reports the Literature database as not configured'
      : 'the application serves Literature search'
  return fromObservation(id, title, adminSearchApi, (probe) => {
    if (expectation === 'not_configured') {
      if (probe.status === 503 && probe.errorCode === 'LITERATURE_SEARCH_UNAVAILABLE') {
        return pass(
          id,
          title,
          'HTTP 503 with LITERATURE_SEARCH_UNAVAILABLE — a structured, truthful refusal.',
          { status: probe.status, code: probe.errorCode },
        )
      }
      if (probe.status >= 500 && probe.errorCode === null) {
        return fail(
          id,
          title,
          `HTTP ${probe.status} with no error envelope. The route is failing rather than ` +
            'declining: an operator cannot tell "not configured" from "broken" here.',
          { status: probe.status },
        )
      }
      return fail(
        id,
        title,
        `HTTP ${probe.status}${probe.errorCode ? ` (${probe.errorCode})` : ''}, but a not-yet-` +
          'configured deployment must answer 503 LITERATURE_SEARCH_UNAVAILABLE.',
        { status: probe.status, code: probe.errorCode },
      )
    }
    return probe.status === 200
      ? pass(id, title, 'HTTP 200 from the search API.', { status: probe.status })
      : fail(
          id,
          title,
          `HTTP ${probe.status}${probe.errorCode ? ` (${probe.errorCode})` : ''}. With the ` +
            'variables set and capability gating deployed, this must serve results.',
          { status: probe.status, code: probe.errorCode },
        )
  })
}

export function checkApplicationAccessControl(
  anonymousAdminPage: Observation<ApplicationProbe>,
  anonymousSearchApi: Observation<ApplicationProbe>,
): CheckResult[] {
  const pageId = 'V91-anonymous-page'
  const pageTitle = 'an anonymous browser cannot open the Literature admin page'
  const apiId = 'V92-anonymous-api'
  const apiTitle = 'an anonymous request to the Literature API is refused'

  return [
    fromObservation(pageId, pageTitle, anonymousAdminPage, (probe) => {
      if (probe.status === 401 || probe.status === 403) {
        return pass(pageId, pageTitle, `HTTP ${probe.status} — refused.`, { status: probe.status })
      }
      if (probe.status === 302 || probe.status === 303 || probe.status === 307) {
        // "It redirected" is not "it redirected to sign-in". A platform access gate sends every
        // path to an SSO login and an apex domain sends everything to `www`; both would otherwise
        // certify that the Literature admin page is gated without Literature having been reached.
        const target = probe.location ?? ''
        if (/\/(?:login|sign-?in|auth)(?:[/?#]|$)/iu.test(target)) {
          return pass(pageId, pageTitle, `HTTP ${probe.status} to ${target} — the sign-in page.`, {
            status: probe.status,
            location: target,
          })
        }
        return fail(
          pageId,
          pageTitle,
          `HTTP ${probe.status} to ${target || '(no Location header)'}, which is not the ` +
            "application's sign-in page. A redirect somewhere else — a platform access gate, an " +
            'apex-to-www hop — says nothing about whether the Literature gate ran.',
          { status: probe.status, location: target },
        )
      }
      return fail(
        pageId,
        pageTitle,
        `HTTP ${probe.status}. The page is gated by both middleware and its layout, so an ` +
          'anonymous 200 means one of those gates is not running.',
        { status: probe.status },
      )
    }),
    fromObservation(apiId, apiTitle, anonymousSearchApi, (probe) =>
      probe.status === 401 && probe.errorCode === 'LITERATURE_ACCESS_DENIED'
        ? pass(apiId, apiTitle, 'HTTP 401 LITERATURE_ACCESS_DENIED.', { status: probe.status })
        : fail(
            apiId,
            apiTitle,
            `HTTP ${probe.status}${probe.errorCode ? ` (${probe.errorCode})` : ''}; 401 ` +
              'LITERATURE_ACCESS_DENIED was expected. Every Literature route, including the ones ' +
              'named public, requires a site admin.',
            { status: probe.status, code: probe.errorCode },
          ),
    ),
  ]
}

/**
 * The gold workflow must decline, not explode.
 *
 * Its RPCs live in migrations the foundation-only rollout deliberately did not apply, so the
 * database genuinely does not have them. Both layers are checked: the database must say "no such
 * function", and the application must turn that into its own error envelope rather than leaking a
 * PostgREST code or a stack trace to an admin at a conference.
 */
export function checkGoldWorkflowUnavailable(
  goldWorkflow: Observation<unknown>,
  goldSetExportApi: Observation<ApplicationProbe>,
): CheckResult[] {
  const databaseId = 'V95-gold-absent-in-database'
  const databaseTitle = 'the gold-workflow RPCs are absent from the dedicated project'
  const applicationId = 'V96-gold-declines-cleanly'
  const applicationTitle = 'the gold workflow reports unavailable rather than a raw error'

  const databaseCheck: CheckResult =
    goldWorkflow.status === 'unavailable'
      ? pass(
          databaseId,
          databaseTitle,
          `The target reports the function absent (${goldWorkflow.reason}). Its migration was ` +
            'never applied here, which is the intended state for a foundation-only project.',
        )
      : goldWorkflow.status === 'observed'
        ? fail(
            databaseId,
            databaseTitle,
            'The gold-workflow RPC responded. Its migration is not part of the approved ' +
              'foundation rollout, so its presence means more than the foundation was applied.',
          )
        : indeterminate(
            databaseId,
            databaseTitle,
            `No verdict: ${describeObservation(goldWorkflow)}.`,
          )

  const applicationCheck = fromObservation(
    applicationId,
    applicationTitle,
    goldSetExportApi,
    (probe) => {
      if (probe.errorCode !== null && probe.status >= 400 && probe.status < 600) {
        return pass(
          applicationId,
          applicationTitle,
          `HTTP ${probe.status} with the structured code ${probe.errorCode}.`,
          { status: probe.status, code: probe.errorCode },
        )
      }
      if (probe.status === 200) {
        return fail(
          applicationId,
          applicationTitle,
          'The gold-set export succeeded. The workflow is supposed to be unavailable here.',
          { status: probe.status },
        )
      }
      return fail(
        applicationId,
        applicationTitle,
        `HTTP ${probe.status} with no error envelope — the route is leaking a raw failure ` +
          'instead of declining. An admin sees a broken page rather than a clear message.',
        { status: probe.status },
      )
    },
  )

  return [databaseCheck, applicationCheck]
}

/** Everything the scenario runner hands to the check layer. */
export interface VerificationInput {
  readonly target: TargetFacts
  readonly database: DatabaseObservations
  readonly application: ApplicationObservations
  readonly migrationHistory: Observation<readonly MigrationHistoryEntry[]>
  readonly catalogAttestation: Observation<CatalogAttestation>
  readonly corpusExpectation: Observation<CorpusExpectation>
  readonly baselineSnapshot: Observation<CorpusSnapshot>
  /**
   * The receipt the ingestion engine wrote, when the operator supplied one.
   *
   * Optional evidence, exactly like the catalog attestation: absent means dependent checks
   * report no verdict, never that something failed.
   */
  readonly ingestReceipt?: Observation<IngestReceipt>
  readonly currentSnapshot: Observation<CorpusSnapshot>
  /**
   * The PMID the operator asked for, or `null`.
   *
   * The checks read `database.resolvedDetailPmid` instead, which is this value when it was given
   * and a PMID sampled from the corpus otherwise. Kept here for the receipt, so a reader can tell
   * a spot check that was directed from one that was sampled.
   */
  readonly detailPmid: string | null
}
