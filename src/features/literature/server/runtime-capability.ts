/**
 * Typed capability model for the Literature runtime.
 *
 * The defect this exists for is small and very easy to ship: a failed aggregate call returns no
 * data, the caller writes `?? 0`, and the administration page reports "0 articles" for a database
 * it could not read. "We have no articles" and "we could not ask" then look identical, and the
 * second one is the state that matters during a production bring-up — it is what an unapplied
 * migration, an unset Railway variable, and a transient outage all look like.
 *
 * So availability is a value here, not an absence. Every Literature server call resolves to exactly
 * one `LiteratureCapabilityState`, and the surfaces render that state rather than inferring one
 * from a nullish count.
 *
 * Everything in this module is pure: no environment reads, no Supabase client, no network. The
 * runtime binding is resolved in `./database-client`; what arrives here is already-classified
 * evidence.
 */

import type {
  LiteratureBindingDiagnostics,
  LiteratureBindingFailureReason,
  LiteratureBindingWithheldReason,
} from './dedicated-project-contract'

/**
 * What the Literature runtime can currently do.
 *
 * The three "cannot answer" members are deliberately distinct. They have different operator
 * remedies — apply the migration, set the Railway variables, wait and retry — and collapsing them
 * into a single "unavailable" was how the bring-up sequence lost its most useful signal.
 */
export const LITERATURE_CAPABILITY_STATES = [
  /** No usable dedicated binding: unset, partial, or pointing somewhere the contract refuses. */
  'not_configured',
  /** The client reached the project, and the foundation relations or functions are not there. */
  'foundation_missing',
  /** The foundation is present and holds no articles. A real, legitimate zero. */
  'foundation_ready_empty',
  /** The foundation is present and holds articles. */
  'foundation_ready_populated',
  /**
   * The foundation answered a **filtered** read. Counts are real for that filter, and nothing is
   * claimed about the size of the corpus as a whole.
   */
  'foundation_ready_filtered',
  /** The gold-set review workflow's deferred schema and RPCs are absent from this project. */
  'gold_workflow_unavailable',
  /** The isolated AI/ML shadow proposal is not installed or activated on this project. */
  'shadow_workflow_unavailable',
  /**
   * The operation is withheld by this build rather than by the target's schema.
   *
   * Distinct from `gold_workflow_unavailable` on purpose: the object a curation write needs
   * (`curate_literature_article_v1`) *is* part of the foundation migration and would be present.
   * It is this build's activation contract that does not carry the write, so labelling that
   * "workflow not installed" would be an untrue statement about the database.
   */
  'write_capability_withheld',
  /** The project answered, but not with an answer. Never rendered as a count. */
  'temporarily_unavailable',
  /**
   * The database was never asked, because the request was rejected before it got there.
   *
   * A rejected filter is a statement about the request, not about the corpus. Reporting it as an
   * empty result would invent a measurement, and reporting it as an outage would send an operator
   * to look at a healthy project — so it gets its own state and renders as unavailable.
   */
  'not_observed',
] as const

export type LiteratureCapabilityState = (typeof LITERATURE_CAPABILITY_STATES)[number]

/** Capability states in which a numeric answer is real. Everything else renders as unavailable. */
const COUNT_BEARING_STATES: ReadonlySet<LiteratureCapabilityState> = new Set([
  'foundation_ready_empty',
  'foundation_ready_populated',
  'foundation_ready_filtered',
])

/**
 * Whether a number reported alongside this state is a measurement rather than a fallback.
 *
 * The single rule the surfaces apply: render digits only when this is true, and render the
 * unavailable marker otherwise. A caller that has no number for a count-bearing state has a bug,
 * not a zero.
 */
export function capabilityCarriesCounts(state: LiteratureCapabilityState): boolean {
  return COUNT_BEARING_STATES.has(state)
}

/**
 * Render a count, or the caller's unavailable marker.
 *
 * This is the whole fix for the misleading-zero defect, in one place so it cannot be reintroduced
 * one call site at a time. The ordering is the point: the capability is consulted *first*, and only
 * a state that carries counts is allowed to fall back to zero for a missing key. Writing
 * `value ?? 0` at a call site inverts that and turns every failure into a corpus of zero.
 */
export function literatureCountDisplay<TUnavailable>(
  state: LiteratureCapabilityState,
  value: number | undefined,
  unavailable: TUnavailable,
): number | TUnavailable {
  return capabilityCarriesCounts(state) ? (value ?? 0) : unavailable
}

/** Why a capability resolved as it did. Operator-facing; never carries a credential. */
export interface LiteratureCapability {
  state: LiteratureCapabilityState
  /**
   * The binding reason when the runtime never reached the project, the failure classification when
   * it did, or `null` when the capability is a healthy one.
   */
  reason:
    | LiteratureBindingFailureReason
    | LiteratureBindingWithheldReason
    | LiteratureFailureKind
    | null
  /** One sentence an operator can act on. Names variables, hosts, and refs — never secrets. */
  message: string
  /** The dedicated project actually resolved, when one was. */
  projectRef: string | null
}

/**
 * How a Supabase call failed, as far as the response allows us to tell.
 *
 * `missing_relation` and `missing_function` are the two that carry real information during a
 * bring-up: they mean the SQL object this call needs was never created in this project, which is
 * exactly the foundation-missing / gold-workflow-unavailable distinction the surfaces need.
 */
export type LiteratureFailureKind =
  | 'missing_relation'
  | 'missing_function'
  | 'permission_denied'
  | 'unclassified_failure'

/**
 * PostgREST and PostgreSQL codes for "that object does not exist".
 *
 * Both layers are listed because both can surface: PostgREST answers from its schema cache
 * (`PGRST205` / `PGRST202`) while a call that reaches the database raises the SQLSTATE
 * (`42P01` undefined_table, `42883` undefined_function). During a foundation-only bring-up the
 * PostgREST codes are the ones actually seen, and the SQLSTATEs are the fallback for a stale cache.
 */
const MISSING_RELATION_CODES: ReadonlySet<string> = new Set(['PGRST205', '42P01'])
const MISSING_FUNCTION_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883'])
const PERMISSION_DENIED_CODES: ReadonlySet<string> = new Set(['42501', 'PGRST301'])

/** The shape of a `PostgrestError` we depend on, narrowed so no client type is imported here. */
export interface LiteratureQueryFailure {
  code?: string | null
  message?: string | null
}

/**
 * Classify a failed Supabase call.
 *
 * Deliberately total and code-driven: an unrecognized failure classifies as
 * `unclassified_failure`, which resolves to `temporarily_unavailable` — never to a zero and never
 * to "the migration is missing". Guessing "missing" from an unclassified error would tell an
 * operator to apply a migration in response to, say, a network blip.
 */
export function classifyLiteratureQueryFailure(
  failure: LiteratureQueryFailure | null | undefined,
): LiteratureFailureKind {
  const code = typeof failure?.code === 'string' ? failure.code.trim().toUpperCase() : ''
  if (MISSING_RELATION_CODES.has(code)) return 'missing_relation'
  if (MISSING_FUNCTION_CODES.has(code)) return 'missing_function'
  if (PERMISSION_DENIED_CODES.has(code)) return 'permission_denied'
  return 'unclassified_failure'
}

const FAILURE_MESSAGES: Record<LiteratureFailureKind, string> = {
  missing_relation:
    'The dedicated Literature project does not contain the foundation tables. Apply the ' +
    'foundation migration before expecting data.',
  missing_function:
    'The dedicated Literature project does not contain the function this view needs. Apply the ' +
    'foundation migration before expecting data.',
  permission_denied:
    'The dedicated Literature project answered and refused the request. Check that the configured ' +
    'credential is the backend secret key for that project.',
  unclassified_failure:
    'The dedicated Literature project did not answer this request. This is not a report of zero ' +
    'records; retry, and check the project status if it persists.',
}

/**
 * Resolve the capability for a call that failed.
 *
 * The two "missing object" kinds resolve differently depending on which surface asked: a foundation
 * table or function that is absent is `foundation_missing`, while the gold-set workflow's own
 * deferred objects being absent is the expected, non-alarming `gold_workflow_unavailable`.
 */
export function capabilityFromFailure(
  failure: LiteratureQueryFailure | null | undefined,
  options: {
    projectRef: string | null
    surface: 'foundation' | 'gold_workflow' | 'shadow_workflow'
  },
): LiteratureCapability {
  const kind = classifyLiteratureQueryFailure(failure)
  const missing = kind === 'missing_relation' || kind === 'missing_function'

  if (missing && options.surface === 'gold_workflow') {
    return {
      state: 'gold_workflow_unavailable',
      reason: kind,
      message:
        'The gold-set review workflow is not installed in the dedicated Literature project. Its ' +
        'migrations are deliberately deferred; this is the expected state during the foundation ' +
        'bring-up, not a fault.',
      projectRef: options.projectRef,
    }
  }

  if (missing && options.surface === 'shadow_workflow') {
    return {
      state: 'shadow_workflow_unavailable',
      reason: kind,
      message:
        'The isolated AI/ML shadow tables are not installed in the dedicated Literature project. ' +
        'Their schema remains a rehearsal-only proposal; canonical and physician-reviewed data ' +
        'are unaffected.',
      projectRef: options.projectRef,
    }
  }

  return {
    state: missing ? 'foundation_missing' : 'temporarily_unavailable',
    reason: kind,
    message: FAILURE_MESSAGES[kind],
    projectRef: options.projectRef,
  }
}

/**
 * The capability for a successful read whose row count is **filtered**.
 *
 * Zero rows from a filtered search or review queue means the filters matched nothing. It does not
 * mean the corpus is empty, and it does not mean the corpus is populated either — the query never
 * measured that. Reusing `foundation_ready_empty` or `foundation_ready_populated` here would assert
 * a corpus fact from a filtered observation, which is the `?? 0` mistake one level up.
 *
 * The state still carries counts, because the filtered total *is* a real measurement of the
 * filtered set; what it withholds is the claim about the whole corpus.
 */
export function capabilityFromFilteredRead(projectRef: string | null): LiteratureCapability {
  return {
    state: 'foundation_ready_filtered',
    reason: null,
    message:
      'The dedicated Literature project answered this query. The row count shown reflects the ' +
      'active filters, not the size of the corpus.',
    projectRef,
  }
}

/** Resolve the capability for a call that succeeded and counted `total` articles. */
export function capabilityFromArticleCount(
  total: number,
  projectRef: string | null,
): LiteratureCapability {
  const populated = Number.isFinite(total) && total > 0
  return {
    state: populated ? 'foundation_ready_populated' : 'foundation_ready_empty',
    reason: null,
    message: populated
      ? 'The dedicated Literature project holds the foundation schema and imported records.'
      : 'The dedicated Literature project holds the foundation schema and no records yet. This ' +
        'zero is a measurement, not a fallback.',
    projectRef,
  }
}

/**
 * Resolve the capability for a runtime that never produced a client.
 *
 * Every binding failure — unset, partial, wrong project, wrong credential class — and the withheld
 * state alike resolve to `not_configured`, because from a reader's point of view they are the same
 * situation: no configured Literature database to read. The specific reason travels in `reason` and
 * `message` so the operator sees which one it is.
 */
export function capabilityFromBinding(
  diagnostics: LiteratureBindingDiagnostics,
): LiteratureCapability {
  return {
    state: 'not_configured',
    reason: diagnostics.reason,
    message:
      diagnostics.message ??
      'The dedicated Literature database is not configured for this deployment.',
    projectRef: diagnostics.projectRef,
  }
}

/**
 * The capability for a request rejected before it reached the database.
 *
 * Carries the resolved project ref when there is one, so the surface can still say *which* project
 * would have been asked.
 */
export function capabilityNotObserved(
  projectRef: string | null,
  detail: string,
): LiteratureCapability {
  return { state: 'not_observed', reason: null, message: detail, projectRef }
}

/**
 * The capability for an operation this build deliberately does not perform.
 *
 * Used by the withheld operations in `./database-client`, so a caller that asks for gold-set data
 * or a curation mutation gets a typed refusal rather than a client it should not have. The state
 * distinguishes the two reasons an operation can be unavailable — the target lacks the objects, or
 * this build withholds the capability — because only the first is fixed by a migration.
 */
export function capabilityForWithheldOperation(
  projectRef: string | null,
  state: Extract<
    LiteratureCapabilityState,
    'gold_workflow_unavailable' | 'shadow_workflow_unavailable' | 'write_capability_withheld'
  >,
  detail: string,
): LiteratureCapability {
  return { state, reason: null, message: detail, projectRef }
}
