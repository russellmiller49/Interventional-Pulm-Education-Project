import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  describeLiteratureBinding,
  isPermittedLocalRuntimeUrl,
  resolveLiteratureDedicatedBinding,
  resolveLiteratureRuntimeMode,
  type LiteratureBindingDiagnostics,
  type LiteratureDatabaseBinding,
  type LiteratureDedicatedEnvironment,
  type LiteratureRuntimeMode,
} from './dedicated-project-contract'
import {
  capabilityForWithheldOperation,
  capabilityFromBinding,
  type LiteratureCapability,
} from './runtime-capability'

/**
 * The Literature data client is bound to the dedicated `IP_Literature` Supabase project.
 *
 * It deliberately reads none of the main-project variables (`SUPABASE_URL`,
 * `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Site authentication continues to use
 * the main project through the existing auth client in `src/lib/supabase`; this module only ever
 * reaches the Literature database. When the dedicated configuration is missing, partial, or points
 * at the wrong project, the client fails closed instead of falling back to the main project.
 *
 * The contract in force is decided by `LITERATURE_SUPABASE_RUNTIME_MODE`, not by `NODE_ENV`.
 * Anything other than the exact string `local` gets the strict hosted contract, so an unset or
 * misspelled variable in a deployed environment fails safe rather than open.
 *
 * ## Activation and capability are two different gates
 *
 * The production runtime is activated (see `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION`), so a
 * correctly configured deployment now gets a real client for the dedicated project. That is the
 * first gate, and it is a source constant rather than a variable.
 *
 * The second gate is this module's own: a client is handed out **per operation**, from the closed
 * allowlist `LITERATURE_ACTIVATED_OPERATIONS`. Only schema that is attested on the dedicated
 * project is carried — foundation article reads plus the physician-reviewed overlay read. Curation
 * writes, every gold-set operation, and ingestion are withheld and return a typed capability
 * instead of a client.
 *
 * That split is what makes "the app cannot mutate the corpus" checkable rather than inferred:
 * `createLiteratureAdmin()` is the only `createClient` call for Literature in the repository, it is
 * module-private, and the exported accessor refuses to return its result for an operation that is
 * not on the list. Ingestion runs from an operator CLI against its own client, never through a web
 * request.
 */
type LiteratureDatabaseEnvironment = LiteratureDedicatedEnvironment

export interface LiteratureDatabaseConfiguration {
  url: string
  /** Privileged backend credential. Never log it, return it, or send it to the browser. */
  secretKey: string
  projectRef: string
}

/**
 * Operations the application runtime may perform against the dedicated Literature project.
 *
 * A closed enum rather than a boolean, because "may this build talk to Literature at all" is the
 * wrong question during a foundation-only bring-up. The right one is "does the schema that exists
 * support this call", and the answers differ per call site.
 */
export type LiteratureRuntimeOperation =
  /** `search_literature_v1`. Created by the foundation migration. */
  | 'article_search'
  /** Row reads from `literature_articles` and its association tables. Foundation. */
  | 'article_detail'
  /** `literature_admin_stats_v1`. Foundation. */
  | 'admin_stats'
  /** Filtered reads for the administration review queue. Foundation. */
  | 'review_queue_read'
  /** Read-only access to the physician-reviewed overlay columns. */
  | 'reviewed_overlay_read'
  /** Read-only access to isolated AI/ML shadow tables. Proposal schema; hosted access withheld. */
  | 'shadow_read'
  /** `curate_literature_article_v1`. Exists in the foundation; withheld by this build. */
  | 'article_curation'
  /** Every gold-set read. Its migrations are deferred, so the objects do not exist. */
  | 'gold_set_read'
  /** Every gold-set write. Deferred, and a mutation besides. */
  | 'gold_set_mutation'

/**
 * The operations carried against the **dedicated hosted project**. Source-controlled and closed: an
 * operation absent from this list gets no client there, whatever the environment says.
 *
 * All five are read-only against the available schema. Adding a write here is a reviewed code
 * change, deliberately not a configuration change.
 *
 * This list scopes the *strict* contract only. The local Supabase stack has every Literature
 * migration applied — gold-set tables, review RPCs, the lot — so applying a foundation-only
 * allowlist to it would break the established local curation and gold-set workflow and, worse,
 * tell a developer that a workflow sitting in their own database "is not installed". Local mode
 * therefore keeps full capability; see `literatureOperationActivated`.
 */
export const LITERATURE_ACTIVATED_OPERATIONS = [
  'article_search',
  'article_detail',
  'admin_stats',
  'review_queue_read',
  'reviewed_overlay_read',
] as const satisfies readonly LiteratureRuntimeOperation[]

export type LiteratureActivatedOperation = (typeof LITERATURE_ACTIVATED_OPERATIONS)[number]
export type LiteratureWithheldOperation = Exclude<
  LiteratureRuntimeOperation,
  LiteratureActivatedOperation
>

/**
 * Why each withheld operation is withheld, and whether a migration would change that.
 *
 * Exhaustive by construction: the key type is every operation *not* on the activated list, so
 * adding a `LiteratureRuntimeOperation` without deciding its status fails the type check rather
 * than silently defaulting one way.
 */
const WITHHELD_OPERATIONS: Readonly<
  Record<
    LiteratureWithheldOperation,
    {
      state:
        | 'gold_workflow_unavailable'
        | 'shadow_workflow_unavailable'
        | 'write_capability_withheld'
      detail: string
    }
  >
> = {
  shadow_read: {
    state: 'shadow_workflow_unavailable',
    detail:
      'The AI/ML shadow schema is a rehearsal-only proposal and is not installed or activated on ' +
      'the dedicated hosted Literature project. Canonical and physician-reviewed fields remain ' +
      'unchanged.',
  },
  article_curation: {
    state: 'write_capability_withheld',
    detail:
      'Literature curation writes are not carried by this build. The dedicated project holds the ' +
      'foundation schema for review and verification only; enabling curation is a separate ' +
      'reviewed change, not a configuration change.',
  },
  gold_set_read: {
    state: 'gold_workflow_unavailable',
    detail:
      'The gold-set review workflow is not installed in the dedicated Literature project. Its ' +
      'migrations are deliberately deferred, so its tables and functions do not exist there.',
  },
  gold_set_mutation: {
    state: 'gold_workflow_unavailable',
    detail:
      'The gold-set review workflow is not installed in the dedicated Literature project, and ' +
      'this build carries no Literature write path in any case.',
  },
}

const ACTIVATED_OPERATION_SET: ReadonlySet<LiteratureRuntimeOperation> = new Set(
  LITERATURE_ACTIVATED_OPERATIONS,
)

export function literatureRuntimeMode(
  environment: LiteratureDatabaseEnvironment = process.env as LiteratureDatabaseEnvironment,
): LiteratureRuntimeMode {
  return resolveLiteratureRuntimeMode(environment)
}

/**
 * Resolve the dedicated Literature binding as a typed result.
 *
 * Callers that need to tell "not configured" from "wrong project" from "database unavailable"
 * should use this, or the capability helpers in `./runtime-capability`, rather than the nullable
 * client accessor below, which collapses every failure to `null`.
 */
export function resolveLiteratureDatabaseBinding(
  environment: LiteratureDatabaseEnvironment = process.env as LiteratureDatabaseEnvironment,
): LiteratureDatabaseBinding {
  return resolveLiteratureDedicatedBinding(environment, literatureRuntimeMode(environment))
}

/** A redacted, log-safe view of the current binding. Never contains a credential. */
export function describeLiteratureDatabaseBinding(
  environment: LiteratureDatabaseEnvironment = process.env as LiteratureDatabaseEnvironment,
): LiteratureBindingDiagnostics {
  return describeLiteratureBinding(resolveLiteratureDatabaseBinding(environment))
}

/**
 * The connectable configuration, or `null`.
 *
 * Only a `bound` binding yields one. Use `describeLiteratureDatabaseBinding()` when you need to
 * tell "valid but withheld" from "misconfigured".
 */
export function resolveLiteratureDatabaseConfiguration(
  environment: LiteratureDatabaseEnvironment = process.env as LiteratureDatabaseEnvironment,
): LiteratureDatabaseConfiguration | null {
  const binding = resolveLiteratureDatabaseBinding(environment)
  if (binding.status !== 'bound') {
    return null
  }
  return {
    url: binding.url,
    secretKey: binding.secretKey,
    projectRef: binding.projectRef,
  }
}

/**
 * The dedicated Literature secret is server-only.
 *
 * The load-bearing guarantee is naming: Next.js only inlines `NEXT_PUBLIC_*` into client bundles,
 * and none of the dedicated variables carries that prefix — a production bundle scan asserts the
 * secret variable appears in server chunks only. This guard is defence in depth on top of that, so
 * an accidental client import fails loudly instead of shipping.
 */
function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'The Literature database client is server-only and must never be imported into client code.',
    )
  }
}

/**
 * The privileged Literature client, or `null`. **Module-private on purpose.**
 *
 * Two conditions must hold before `createClient` is reached:
 *
 *   1. the binding resolved to `bound` — which in strict mode requires the byte-exact canonical
 *      URL, the single approved project ref, an `sb_secret_…` credential, and the activation
 *      constant set by a reviewed change;
 *   2. in local mode only, the URL is additionally on the canonical local-host allowlist
 *      (`localhost`, `127.0.0.1`, `[::1]`) — never a wildcard bind address such as `0.0.0.0`, and
 *      never an alias spelling such as `127.1` or `2130706433` that only URL normalization would
 *      have made acceptable.
 *
 * Callers reach this only through `literatureClientForOperation`, which additionally requires the
 * operation to be on the activated allowlist. Exporting this directly would let a future call site
 * acquire a client for a withheld operation by importing one function instead of the other, which
 * is exactly the kind of drift the split exists to prevent.
 */
function createLiteratureAdmin(): SupabaseClient | null {
  assertServerOnly()

  const binding = resolveLiteratureDatabaseBinding()
  if (binding.status !== 'bound') {
    return null
  }
  if (binding.mode === 'local' && !isPermittedLocalRuntimeUrl(binding.url)) {
    return null
  }

  return createClient(binding.url, binding.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** A client for the requested operation, or the typed reason there is none. */
export type LiteratureClientResult =
  | { client: SupabaseClient; capability: null; projectRef: string }
  | { client: null; capability: LiteratureCapability }

/**
 * Whether this build carries the operation against the currently selected target.
 *
 * Synchronous and connectionless, so a surface can decide whether to *offer* an action without a
 * round trip: the administration page uses it to hide the gold-set entry point and the curation
 * form, because an action whose only possible outcome is an error is worse than an absent one.
 *
 * Mode-aware on purpose. The allowlist describes what the *dedicated hosted project* supports
 * under its foundation-only schema; the local stack has every migration and keeps every operation.
 */
export function literatureOperationActivated(
  operation: LiteratureRuntimeOperation,
  environment: LiteratureDatabaseEnvironment = process.env as LiteratureDatabaseEnvironment,
): boolean {
  // Judged on the resolved binding, not on the mode string.
  //
  // Testing `literatureRuntimeMode(...) === 'local'` was enough to widen this: a deployed
  // environment that set LITERATURE_SUPABASE_RUNTIME_MODE=local alongside the production URL
  // reported every operation as carried, so the page offered the gold-set button and the curation
  // form — while `literatureClientForOperation` correctly refused the same configuration, because
  // local mode never binds to a remote host. That is exactly the always-failing control this
  // function exists to prevent. Local mode widens capability only when it actually bound to a
  // local target.
  const binding = resolveLiteratureDedicatedBinding(environment, literatureRuntimeMode(environment))
  if (binding.status === 'bound' && binding.mode === 'local') return true
  return ACTIVATED_OPERATION_SET.has(operation)
}

/**
 * The single way application code obtains a Literature client.
 *
 * The **binding is judged first**, then the operation. That order matters for the message an
 * operator reads: telling an unconfigured deployment that "the gold-set workflow is not installed
 * in this project" names a cause that does not exist and sends them to look at a database instead
 * of at their variables. Only a deployment that genuinely reached a project is told which of that
 * project's capabilities are withheld.
 */
export function literatureClientForOperation(
  operation: LiteratureRuntimeOperation,
): LiteratureClientResult {
  const binding = resolveLiteratureDatabaseBinding()

  // The binding is judged first. Reporting "the gold-set workflow is not installed in this
  // project" to a deployment that has no project configured at all would name a cause that does
  // not exist and send an operator looking at a database instead of at their variables.
  if (binding.status !== 'bound') {
    return { client: null, capability: capabilityFromBinding(describeLiteratureBinding(binding)) }
  }

  if (binding.mode !== 'local' && !ACTIVATED_OPERATION_SET.has(operation)) {
    const withheld = WITHHELD_OPERATIONS[operation as LiteratureWithheldOperation]
    return {
      client: null,
      capability: capabilityForWithheldOperation(
        binding.projectRef,
        withheld.state,
        withheld.detail,
      ),
    }
  }

  const client = createLiteratureAdmin()
  if (!client) {
    return { client: null, capability: capabilityFromBinding(describeLiteratureBinding(binding)) }
  }
  return { client, capability: null, projectRef: binding.projectRef }
}
