import { createClient } from '@supabase/supabase-js'

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
 * ## No production client is constructed in this PR
 *
 * `createLiteratureAdmin()` is the only place in the repository that calls `createClient` for
 * Literature, and while the production runtime is not activated it can only reach that call for an
 * exact local-mode loopback target. Strict mode never resolves to `bound` (see
 * `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION`), and two further guards here refuse anything that is
 * not `mode === 'local'` with a URL on the canonical local-host allowlist (`localhost`,
 * `127.0.0.1`, `[::1]` — never a wildcard bind address, and never an alias spelling such as
 * `127.1` or `2130706433` that only URL normalization would have made acceptable). So the existing
 * list, detail, curation, and gold-set callers receive `null` in every deployed configuration —
 * the same "not configured" path they already handle — and no privileged remote RPC is reachable.
 * Setting the documented Railway variables changes none of that; only the future
 * capability-gating / cutover PR can.
 */
type LiteratureDatabaseEnvironment = LiteratureDedicatedEnvironment

export interface LiteratureDatabaseConfiguration {
  url: string
  /** Privileged backend credential. Never log it, return it, or send it to the browser. */
  secretKey: string
  projectRef: string
}

export function literatureRuntimeMode(
  environment: LiteratureDatabaseEnvironment = process.env as LiteratureDatabaseEnvironment,
): LiteratureRuntimeMode {
  return resolveLiteratureRuntimeMode(environment)
}

/**
 * Resolve the dedicated Literature binding as a typed result.
 *
 * Callers that need to tell "not configured" from "wrong project" from "database unavailable" —
 * the later unavailable-versus-empty UI work — should use this rather than the nullable helpers
 * below, which collapse every failure to `null`.
 *
 * Current consumers (`server/queries.ts`, `server/gold-set.ts`) still use the nullable
 * `createLiteratureAdmin()`. Adopting this typed result is the job of the separate capability
 * gating / unavailable-versus-empty package; it is deliberately not done here.
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
 * Only a `bound` binding yields one, so in strict mode this returns `null` for *every* input while
 * the production runtime is not activated — including an exactly valid production configuration,
 * which resolves to `not_activated`. Use `describeLiteratureDatabaseBinding()` when you need to
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
 * The privileged Literature client, or `null`.
 *
 * Three independent conditions must all hold before `createClient` is reached, and no environment
 * variable can satisfy the first one outside local development:
 *
 *   1. the binding resolved to `bound` — impossible in strict mode while the production runtime is
 *      not activated, because strict resolves to `not_activated` instead;
 *   2. the resolved mode is exactly `local`;
 *   3. the URL is on the explicit canonical local-host allowlist (`localhost`, `127.0.0.1`,
 *      `[::1]`) both as raw text and after parsing — `0.0.0.0` is a wildcard bind address and is
 *      refused, and so is any alias spelling the URL parser would have normalized onto the list.
 *
 * Callers already treat `null` as "the literature database is not configured", so a deployed
 * environment degrades to that honest state rather than to a remote client.
 */
export function createLiteratureAdmin() {
  assertServerOnly()

  const binding = resolveLiteratureDatabaseBinding()
  if (binding.status !== 'bound') {
    return null
  }
  if (binding.mode !== 'local' || !isPermittedLocalRuntimeUrl(binding.url)) {
    return null
  }

  return createClient(binding.url, binding.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
