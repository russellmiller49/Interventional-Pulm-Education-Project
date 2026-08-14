import { createClient } from '@supabase/supabase-js'

import {
  describeLiteratureBinding,
  resolveLiteratureDedicatedBinding,
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
 */
interface LiteratureDatabaseEnvironment extends LiteratureDedicatedEnvironment {
  NODE_ENV?: string
}

export interface LiteratureDatabaseConfiguration {
  url: string
  /** Privileged backend credential. Never log it, return it, or send it to the browser. */
  secretKey: string
  projectRef: string
}

export function literatureRuntimeMode(
  environment: Pick<LiteratureDatabaseEnvironment, 'NODE_ENV'> = process.env,
): LiteratureRuntimeMode {
  return environment.NODE_ENV === 'production' ? 'production' : 'non_production'
}

/**
 * Resolve the dedicated Literature binding as a typed result.
 *
 * Callers that need to tell "not configured" from "wrong project" from "database unavailable" —
 * the later unavailable-versus-empty UI work — should use this rather than the nullable helpers
 * below, which collapse every failure to `null`.
 */
export function resolveLiteratureDatabaseBinding(
  environment: LiteratureDatabaseEnvironment = process.env,
): LiteratureDatabaseBinding {
  return resolveLiteratureDedicatedBinding(environment, literatureRuntimeMode(environment))
}

/** A redacted, log-safe view of the current binding. Never contains a credential. */
export function describeLiteratureDatabaseBinding(
  environment: LiteratureDatabaseEnvironment = process.env,
): LiteratureBindingDiagnostics {
  return describeLiteratureBinding(resolveLiteratureDatabaseBinding(environment))
}

export function resolveLiteratureDatabaseConfiguration(
  environment: LiteratureDatabaseEnvironment = process.env,
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
 * The dedicated Literature secret is server-only. This module is imported exclusively from server
 * code, and the guard makes an accidental client import fail loudly instead of shipping the
 * credential in a browser bundle.
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
