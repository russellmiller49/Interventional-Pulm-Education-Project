/**
 * Where this tool gets its target, and the gates it must clear first.
 *
 * The validation is not re-implemented here. `resolveLiteratureDedicatedBinding` — the same
 * function the Next.js runtime calls — judges the environment, so the verification tool and the
 * application agree byte for byte about what a valid production configuration is. A noncanonical
 * URL, the wrong project ref, a publishable key, the legacy variable name: every one of those
 * stops this tool for the same reason and with the same message it would stop the runtime.
 *
 * Two states are accepted as "the configuration is valid":
 *
 *   - `not_activated`, which is what a correct strict configuration resolves to today, because
 *     `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` is a source constant set to `not_activated`; and
 *   - `bound`, which only the future reviewed cutover can produce.
 *
 * Accepting `not_activated` is the entire reason this tool can be useful before the cutover: the
 * configuration is provably correct, the *application* is deliberately not using it, and an
 * operator still needs to see the database. Note what this does **not** do — it does not construct
 * a Supabase client, it does not import `createLiteratureAdmin`, and it changes nothing about
 * whether the deployed application can reach the project. It reads the same environment through
 * the same rules and then issues `GET` requests of its own.
 *
 * The credential is read from `process.env` directly, never from the binding: the `not_activated`
 * result has no `secretKey` field precisely so that no caller can lift a credential out of it.
 * Reading the variable in an operator script is a different act from the runtime binding one, and
 * keeping them separate is what lets the runtime's guarantee stay exactly as strong as it was.
 */

import {
  describeLiteratureBinding,
  resolveLiteratureDedicatedBinding,
  type LiteratureBindingDiagnostics,
  type LiteratureDedicatedEnvironment,
} from '../../../src/features/literature/server/dedicated-project-contract'
import { LITERATURE_CANONICAL_PRODUCTION_URL_EXACT } from './identity'
import { registerSecret } from './redaction'

/** Every variable this tool reads. Credentials appear here and on no command line. */
export interface LiteratureVerificationEnvironment extends LiteratureDedicatedEnvironment {
  /** Base URL of the deployed application, for the application-layer probes. */
  LITERATURE_VERIFY_APP_BASE_URL?: string
  /** A site-admin session cookie header, for the authenticated application probes. */
  LITERATURE_VERIFY_ADMIN_COOKIE?: string
  /** A publishable/anon key, used only to prove that an anonymous caller is refused. */
  LITERATURE_VERIFY_ANON_KEY?: string
}

export type ConfigurationRefusalReason =
  | 'credential_on_command_line'
  | 'binding_invalid'
  | 'credential_variable_absent'

export interface ConfigurationRefusal {
  readonly status: 'refused'
  readonly reason: ConfigurationRefusalReason
  readonly message: string
  /** Redacted binding diagnostics, when the refusal came from the shared contract. */
  readonly diagnostics: LiteratureBindingDiagnostics | null
}

export interface DatabaseTarget {
  /** Byte-exact canonical origin, as the contract requires it be written. */
  readonly url: string
  readonly projectRef: string
  /**
   * The privileged credential.
   *
   * Deliberately not spread into logs, receipts, or JSON: it is registered for redaction at
   * construction, and `describeTarget` below is the only sanctioned way to describe a target.
   */
  readonly credential: string
}

export interface ResolvedConfiguration {
  readonly status: 'resolved'
  /** `not_activated` (valid, runtime deliberately off) or `bound` (post-cutover). */
  readonly bindingStatus: 'not_activated' | 'bound'
  readonly diagnostics: LiteratureBindingDiagnostics
  readonly database: DatabaseTarget
  readonly applicationBaseUrl: string | null
  readonly adminCookie: string | null
  readonly anonymousKey: string | null
}

export type ConfigurationResult = ResolvedConfiguration | ConfigurationRefusal

function refuse(
  reason: ConfigurationRefusalReason,
  message: string,
  diagnostics: LiteratureBindingDiagnostics | null,
): ConfigurationRefusal {
  return { status: 'refused', reason, message, diagnostics }
}

/**
 * Resolve the verification target from the environment.
 *
 * The environment is the only source. The matching `credential_on_command_line` refusal is raised
 * by the CLI via `assertNoCredentialInArgument` before this function is reached, so a credential
 * passed as an argument stops the run before any environment is read and before any request is
 * built.
 */
export function resolveVerificationConfiguration(
  environment: LiteratureVerificationEnvironment,
): ConfigurationResult {
  // Registered first, before anything can fail and produce a message.
  //
  // The shared contract is careful never to echo a credential, and the shape patterns in `redact`
  // would catch a well-formed key anyway. But a *malformed* credential — the one most likely to be
  // in a message that quotes what it refused — matches no shape, so the only thing that would
  // scrub it is having registered the literal. Registering before the first refusal branch closes
  // that window, and registering something that turns out not to be a valid credential costs
  // nothing.
  registerSecret(environment.LITERATURE_SUPABASE_SECRET_KEY)
  registerSecret(environment.LITERATURE_SUPABASE_SERVICE_ROLE_KEY)
  registerSecret(environment.LITERATURE_VERIFY_ADMIN_COOKIE)
  registerSecret(environment.LITERATURE_VERIFY_ANON_KEY)

  const binding = resolveLiteratureDedicatedBinding(environment)
  const diagnostics = describeLiteratureBinding(binding)

  if (binding.status === 'unbound') {
    return refuse(
      'binding_invalid',
      `The Literature configuration is not usable: ${binding.message}`,
      diagnostics,
    )
  }

  // Read the credential from the environment, not from the binding: `not_activated` withholds it
  // on purpose, and this tool must not be the thing that erodes that.
  const credential = environment.LITERATURE_SUPABASE_SECRET_KEY?.trim()
  if (!credential) {
    return refuse(
      'credential_variable_absent',
      'LITERATURE_SUPABASE_SECRET_KEY is required to read the Literature project.',
      diagnostics,
    )
  }

  return {
    status: 'resolved',
    bindingStatus: binding.status,
    diagnostics,
    database: {
      // The binding already proved this equals the canonical value byte for byte in strict mode.
      // Using the constant rather than the environment string keeps a local-mode run from
      // silently pointing the transport somewhere else.
      url:
        binding.mode === 'production_strict'
          ? LITERATURE_CANONICAL_PRODUCTION_URL_EXACT
          : (environment.LITERATURE_SUPABASE_URL ?? LITERATURE_CANONICAL_PRODUCTION_URL_EXACT),
      projectRef: diagnostics.projectRef ?? '',
      credential,
    },
    applicationBaseUrl: normalizeBaseUrl(environment.LITERATURE_VERIFY_APP_BASE_URL),
    adminCookie: environment.LITERATURE_VERIFY_ADMIN_COOKIE?.trim() || null,
    anonymousKey: environment.LITERATURE_VERIFY_ANON_KEY?.trim() || null,
  }
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.origin
  } catch {
    return null
  }
}

/** The only sanctioned description of a target. Structurally cannot carry the credential. */
export function describeTarget(target: DatabaseTarget): {
  url: string
  projectRef: string
  credentialPresent: boolean
} {
  return {
    url: target.url,
    projectRef: target.projectRef,
    credentialPresent: target.credential.length > 0,
  }
}
