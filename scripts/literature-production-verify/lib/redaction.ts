/**
 * Secret handling for a tool that must hold a privileged credential and must never emit one.
 *
 * Two independent mechanisms, because either alone has a known gap:
 *
 *   1. **Registered literals.** Every credential the process actually holds is registered the
 *      moment it is read from the environment, and scrubbed by exact substring match. This catches
 *      a credential whose shape this file has never seen — a future Supabase key prefix, an
 *      operator's session cookie, a bearer token from somewhere else.
 *   2. **Shape patterns.** `sb_secret_…`, `sb_publishable_…`, JWTs, and Supabase-style cookie
 *      blobs are scrubbed whether or not they were registered. This catches a credential the
 *      process never registered because it came back *from* the target — an error body that echoes
 *      an `apikey` header, a redirect URL with a token in it.
 *
 * Redaction is applied at the single output boundary in `report.ts`, not sprinkled at call sites,
 * so there is one place to audit. `assertNoCredentialInArgument` is the other half: credentials are
 * read from the environment only, and an argument that *looks* like one stops the run before any
 * request is made — a value on `process.argv` is visible in `ps`, in shell history, and in CI logs
 * that this tool does not control and cannot retract.
 */

export const REDACTED = '[redacted]'

/**
 * Credential shapes, scrubbed regardless of registration.
 *
 * Each is deliberately greedy about the trailing character class: over-redacting a few characters
 * of an adjacent identifier is a cosmetic defect, and under-redacting is a disclosure.
 */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  // Current Supabase key model. `sb_secret_` is privileged; `sb_publishable_` is not, but a
  // published key still identifies the project and there is no reason to print it.
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/gu,
  // JWTs: the legacy service-role and anon keys, and Supabase auth session tokens.
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/gu,
  // Supabase SSR auth cookies, whose values are base64-prefixed session blobs.
  /sb-[a-z0-9]{20}-auth-token(?:\.\d+)?=[^\s;]+/gu,
  // Any `apikey`/`authorization` header or query parameter that made it into a message.
  /\b(?:apikey|authorization|access[_-]?token)\s*[:=]\s*(?:Bearer\s+)?[^\s,;"'&]+/giu,
]

/** Registered credential literals. Module-level: one process, one set of secrets. */
const registeredSecrets = new Set<string>()

/**
 * Register a credential literal for scrubbing.
 *
 * Short values are ignored on purpose. A one- or two-character "secret" would turn redaction into
 * a find-and-replace that mangles every message, and nothing that short is a credential.
 */
export function registerSecret(value: string | undefined | null): void {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (trimmed.length < 8) return
  registeredSecrets.add(trimmed)
}

/** Test seam. Never called by the CLI — a process only ever gains secrets, never sheds them. */
export function clearRegisteredSecretsForTesting(): void {
  registeredSecrets.clear()
}

/**
 * Whether a string looks like a credential.
 *
 * Used to refuse credentials on the command line, so it errs toward false positives: refusing a
 * legitimate argument costs an operator one edit, while accepting a credential writes it into the
 * process table.
 */
export function looksLikeCredential(value: string): boolean {
  if (registeredSecrets.has(value.trim())) return true
  return CREDENTIAL_PATTERNS.some((pattern) => {
    // The patterns carry /g, which makes `test` stateful via lastIndex. Reset before every use.
    pattern.lastIndex = 0
    return pattern.test(value)
  })
}

/** Scrub every registered literal and every known credential shape from a string. */
export function redact(text: string): string {
  let output = text
  // Longest first, so a secret that contains another registered secret is replaced whole.
  for (const secret of [...registeredSecrets].sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join(REDACTED)
  }
  for (const pattern of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0
    output = output.replaceAll(pattern, REDACTED)
  }
  return output
}

/**
 * Scrub a whole structure, keys included.
 *
 * Object keys are redacted as well as values: a target's error body can carry a credential in a
 * key position (`{"sb_secret_…": "duplicate key"}`), and a redactor that only walked values would
 * write it out.
 */
export function redactDeep(value: unknown): unknown {
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.map((entry) => redactDeep(entry))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        redact(key),
        redactDeep(entry),
      ]),
    )
  }
  return value
}

/** Serialize to JSON with every string scrubbed. The only JSON writer this package uses. */
export function redactedJson(value: unknown): string {
  return `${JSON.stringify(redactDeep(value), null, 2)}\n`
}

export interface CommandLineCredentialRefusal {
  readonly argumentIndex: number
  readonly message: string
}

/**
 * Refuse credentials on the command line.
 *
 * Both the bare value (`--secret sb_secret_…`) and the joined form (`--secret=sb_secret_…`) are
 * caught, because the joined form is the one a shell-history search misses. The offending value is
 * never echoed — not even redacted, since the presence of a specific index is all the operator
 * needs to fix it.
 */
export function assertNoCredentialInArgument(
  argumentValues: readonly string[],
): CommandLineCredentialRefusal | null {
  for (const [index, argument] of argumentValues.entries()) {
    const separator = argument.indexOf('=')
    const candidates =
      argument.startsWith('--') && separator > 0 ? [argument.slice(separator + 1)] : [argument]
    if (candidates.some((candidate) => looksLikeCredential(candidate))) {
      return {
        argumentIndex: index,
        message:
          `Argument ${index} looks like a credential. This tool reads credentials from the ` +
          'environment only, because a command-line value is visible in the process table, in ' +
          'shell history, and in CI logs. Unset it and export the documented variable instead.',
      }
    }
  }
  return null
}
