import { createClient } from '@supabase/supabase-js'

import {
  describeLiteratureBinding,
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

export function createLiteratureAdmin() {
  assertServerOnly()

  const configuration = resolveLiteratureDatabaseConfiguration()
  if (!configuration) {
    return null
  }

  return createClient(configuration.url, configuration.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
