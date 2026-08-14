/**
 * Dedicated Literature Supabase project contract.
 *
 * The Literature corpus lives in its own Supabase project (`IP_Literature`). The main
 * application project (`Endoreels`) keeps authentication, site-admin identity, and the existing
 * non-Literature application data, and must never receive the Literature schema or corpus.
 *
 * Everything in this module is pure: no network access, no `process.env` reads, no Supabase
 * client construction. That keeps the binding rules independently testable and lets the
 * operational scripts under `scripts/literature-dedicated-supabase/` share one source of truth
 * with the runtime resolver in `./database-client`.
 *
 * No function here ever returns, embeds, or logs a credential value. Failures are reported as
 * typed reason codes plus messages that name only variables, hostnames, and project refs.
 *
 * ## Fail-strict by default
 *
 * The mode is **not** derived from `NODE_ENV`. An unset, misspelled, or unexpected `NODE_ENV`
 * previously produced permissive behaviour, which meant a deployed environment that failed to set
 * it exactly could accept a loopback target or a legacy credential. The mode is now an explicit,
 * closed, server-only opt-in: only the exact string `local` in
 * `LITERATURE_SUPABASE_RUNTIME_MODE` relaxes anything. Everything else — absent, empty,
 * `Local`, `production`, `LOCAL `, an unknown word — resolves to the strict hosted contract.
 */

/** The approved dedicated Literature production project (`IP_Literature`). */
export const LITERATURE_APPROVED_PRODUCTION_PROJECT_REF = 'itcttmkxdxvwmwcmzmey'

/** The main application project (`Endoreels`). Authentication only — never Literature data. */
export const LITERATURE_MAIN_APPLICATION_PROJECT_REF = 'tqnhxlwvkkswuckszlee'

/** The single canonical origin the strict contract accepts. */
export const LITERATURE_CANONICAL_PRODUCTION_ORIGIN = `https://${LITERATURE_APPROVED_PRODUCTION_PROJECT_REF}.supabase.co`

/** The single canonical hostname the strict contract accepts. */
export const LITERATURE_CANONICAL_PRODUCTION_HOSTNAME = `${LITERATURE_APPROVED_PRODUCTION_PROJECT_REF}.supabase.co`

/**
 * The one exact byte sequence `LITERATURE_SUPABASE_URL` may hold under the strict contract.
 *
 * H-3: the strict contract compares the **raw environment string** against this constant,
 * byte for byte, *before* any URL parsing. No trimming, no case folding, no dot-segment
 * resolution, no percent-decoding, no default-port normalization happens first — every variant
 * (`:443`, uppercase scheme, `/./`, `/%2e`, missing slash, surrounding whitespace) is refused
 * because it is a different byte sequence, not because a parser judged it equivalent. Parsing
 * runs only *after* exact equality, as a defensive secondary validation.
 */
export const LITERATURE_CANONICAL_PRODUCTION_URL_EXACT = `${LITERATURE_CANONICAL_PRODUCTION_ORIGIN}/`

/**
 * Project refs that may never be used as a Literature data target, in any mode. The main
 * application project is excluded outright rather than only in strict mode: the whole point of the
 * dedicated project is that Literature data never lands in `Endoreels`.
 */
export const LITERATURE_PROHIBITED_PROJECT_REFS: readonly string[] = [
  LITERATURE_MAIN_APPLICATION_PROJECT_REF,
]

/** Supabase project refs are exactly twenty lowercase letters. */
const PROJECT_REF_PATTERN = /^[a-z]{20}$/u

/** Hosted Supabase API hostnames carry the project ref in the leftmost label. */
const SUPABASE_HOST_PATTERN = /^([a-z]{20})\.supabase\.(?:co|in)$/u

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

/**
 * How a privileged credential is classified. Classification is structural only — it inspects the
 * documented Supabase key prefixes and the unverified JWT payload role claim. It never verifies a
 * signature and never treats a credential as valid merely because it parses.
 *
 * A `secret` classification is a *credential-class* check, not proof of authentication. The
 * credential is only ever actually accepted when the Supabase provider validates it.
 */
export type LiteratureCredentialClass =
  /** Current Supabase backend secret key (`sb_secret_…`). The only class strict mode accepts. */
  | 'secret'
  /** Current Supabase browser-safe key (`sb_publishable_…`). Never privileged. */
  | 'publishable'
  /** Legacy service-role JWT. Privileged, but not accepted in strict mode. */
  | 'legacy_service_role'
  /** Legacy anon JWT. Never privileged. */
  | 'legacy_anon'
  /** A JWT whose role claim is missing or unrecognized. Never privileged. */
  | 'unknown_jwt'
  /** Anything else, including the opaque keys a local Supabase stack emits. */
  | 'opaque'

/** Credential classes that may never act as the privileged Literature backend credential. */
const NEVER_PRIVILEGED_CREDENTIAL_CLASSES: readonly LiteratureCredentialClass[] = [
  'publishable',
  'legacy_anon',
  'unknown_jwt',
]

/**
 * The runtime contract in force. `production_strict` is the default for everything that is not an
 * affirmative local opt-in, including preview and unrecognised deployments.
 */
export type LiteratureRuntimeMode = 'production_strict' | 'local'

/** The only value that selects the relaxed local contract. Compared exactly, byte for byte. */
export const LITERATURE_LOCAL_RUNTIME_MODE_VALUE = 'local'

export interface LiteratureRuntimeModeEnvironment {
  LITERATURE_SUPABASE_RUNTIME_MODE?: string
}

/**
 * Resolve the runtime contract.
 *
 * Deliberately exact: no trimming and no case folding, so `Local`, `LOCAL`, `' local'`, and
 * `local\n` all resolve to the strict contract. Weakening validation should require typing the
 * value correctly, and every near-miss should fail safe rather than open.
 */
export function resolveLiteratureRuntimeMode(
  environment: LiteratureRuntimeModeEnvironment,
): LiteratureRuntimeMode {
  return environment.LITERATURE_SUPABASE_RUNTIME_MODE === LITERATURE_LOCAL_RUNTIME_MODE_VALUE
    ? 'local'
    : 'production_strict'
}

export type LiteratureBindingFailureReason =
  /** No dedicated Literature variable is set at all. */
  | 'not_configured'
  /** Some but not all required dedicated variables are set. */
  | 'partial_configuration'
  /** Both the new secret variable and the legacy variable are set to different values. */
  | 'ambiguous_credentials'
  /** Only the legacy service-role variable is set, and the contract is strict. */
  | 'legacy_credential_variable_not_permitted_in_production'
  /** The URL does not parse. */
  | 'invalid_url'
  /** The URL uses a scheme other than https in the strict contract. */
  | 'insecure_url_scheme'
  /** The URL carries a username or password. */
  | 'url_contains_userinfo'
  /** The URL carries a query string or fragment. */
  | 'url_contains_query_or_fragment'
  /** The URL specifies a non-default port. */
  | 'url_non_default_port'
  /** The URL carries a path other than the canonical root. */
  | 'url_unexpected_path'
  /** The strict contract requires the single canonical hosted origin. */
  | 'noncanonical_production_url'
  /** The URL is well formed but no Supabase project ref can be derived from its hostname. */
  | 'unresolvable_project_ref'
  /** The expected-ref variable is absent. */
  | 'expected_project_ref_missing'
  /** The expected-ref variable is present but is not a well-formed project ref. */
  | 'expected_project_ref_malformed'
  /** The ref derived from the URL differs from the expected ref. */
  | 'project_ref_mismatch'
  /** The target is the main application project, or another explicitly prohibited ref. */
  | 'prohibited_project_ref'
  /** The strict contract requires the single approved dedicated ref. */
  | 'unapproved_production_project_ref'
  /** A loopback or local URL was presented under the strict contract. */
  | 'loopback_not_permitted_in_production'
  /** Local mode accepts loopback only; a remote host was supplied. */
  | 'remote_host_not_permitted_in_local_mode'
  /** The credential is a publishable/anon/unclassifiable key. */
  | 'invalid_credential_class'
  /** The strict contract requires the current `sb_secret_…` model. */
  | 'production_requires_secret_key_credential'

export interface LiteratureDatabaseBindingSuccess {
  status: 'bound'
  mode: LiteratureRuntimeMode
  url: string
  /** The privileged backend credential. Never log, serialize, or return this to a client. */
  secretKey: string
  projectRef: string
  credentialClass: LiteratureCredentialClass
  /** True when the legacy variable supplied the credential (local mode only). */
  usedLegacyCredentialVariable: boolean
}

export interface LiteratureDatabaseBindingFailure {
  status: 'unbound'
  mode: LiteratureRuntimeMode
  reason: LiteratureBindingFailureReason
  /** Operator-facing text. Contains variable names, hostnames, and refs — never a credential. */
  message: string
}

export type LiteratureDatabaseBinding =
  | LiteratureDatabaseBindingSuccess
  | LiteratureDatabaseBindingFailure

/** The dedicated Literature variables. Deliberately excludes every `NEXT_PUBLIC_*` name. */
export interface LiteratureDedicatedEnvironment extends LiteratureRuntimeModeEnvironment {
  LITERATURE_SUPABASE_URL?: string
  LITERATURE_SUPABASE_SECRET_KEY?: string
  LITERATURE_SUPABASE_EXPECTED_PROJECT_REF?: string
  /** Legacy alias retained for established local workflows. Never accepted in strict mode. */
  LITERATURE_SUPABASE_SERVICE_ROLE_KEY?: string
}

function trimmed(value: string | undefined) {
  const next = value?.trim()
  return next ? next : undefined
}

function decodeBase64Url(segment: string): string | null {
  const normalized = segment.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  try {
    if (typeof globalThis.Buffer !== 'undefined') {
      return globalThis.Buffer.from(padded, 'base64').toString('utf8')
    }
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded)
    }
  } catch {
    return null
  }
  return null
}

/**
 * Classify a credential structurally. Returns `'opaque'` for anything that is neither a prefixed
 * Supabase key nor a decodable JWT — that is the shape a local Supabase stack can emit, so it stays
 * usable in local mode while never being accepted under the strict contract.
 */
export function classifyLiteratureCredential(credential: string): LiteratureCredentialClass {
  const value = credential.trim()
  if (value.startsWith('sb_secret_')) return 'secret'
  if (value.startsWith('sb_publishable_')) return 'publishable'

  const segments = value.split('.')
  if (segments.length === 3 && segments.every((segment) => segment.length > 0)) {
    const payload = decodeBase64Url(segments[1])
    if (payload === null) return 'unknown_jwt'
    try {
      const parsed: unknown = JSON.parse(payload)
      const role =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).role : undefined
      if (role === 'service_role') return 'legacy_service_role'
      if (role === 'anon') return 'legacy_anon'
      return 'unknown_jwt'
    } catch {
      return 'unknown_jwt'
    }
  }

  return 'opaque'
}

export interface ParsedLiteratureTarget {
  hostname: string
  protocol: string
  port: string
  pathname: string
  hasUserInfo: boolean
  hasQueryOrFragment: boolean
  isLoopback: boolean
  projectRef: string | null
}

/**
 * Parse a Literature target URL into the facts the contract judges. Returns `null` only when the
 * value is not a parseable absolute URL; every other defect is reported through the returned
 * fields so callers can fail closed with a specific reason.
 */
export function parseLiteratureTargetUrl(url: string): ParsedLiteratureTarget | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  const hosted = SUPABASE_HOST_PATTERN.exec(hostname)
  return {
    hostname,
    protocol: parsed.protocol,
    port: parsed.port,
    pathname: parsed.pathname,
    hasUserInfo: parsed.username !== '' || parsed.password !== '',
    hasQueryOrFragment: parsed.search !== '' || parsed.hash !== '',
    isLoopback: LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost'),
    projectRef: hosted ? hosted[1] : null,
  }
}

export function isWellFormedProjectRef(value: string): boolean {
  return PROJECT_REF_PATTERN.test(value.trim())
}

function failure(
  mode: LiteratureRuntimeMode,
  reason: LiteratureBindingFailureReason,
  message: string,
): LiteratureDatabaseBindingFailure {
  return { status: 'unbound', mode, reason, message }
}

/**
 * Validate a target under the strict contract: exactly the canonical hosted origin, nothing else.
 *
 * Returns a failure reason or `null` when the URL is canonical. Each defect gets its own reason so
 * the failure is diagnosable without echoing anything sensitive.
 */
function strictUrlFailure(
  target: ParsedLiteratureTarget,
): { reason: LiteratureBindingFailureReason; message: string } | null {
  if (target.protocol !== 'https:') {
    return {
      reason: 'insecure_url_scheme',
      message: `LITERATURE_SUPABASE_URL must use https. The strict contract refuses ${target.protocol}//.`,
    }
  }
  if (target.hasUserInfo) {
    return {
      reason: 'url_contains_userinfo',
      message: 'LITERATURE_SUPABASE_URL must not embed a username or password.',
    }
  }
  if (target.hasQueryOrFragment) {
    return {
      reason: 'url_contains_query_or_fragment',
      message: 'LITERATURE_SUPABASE_URL must not carry a query string or fragment.',
    }
  }
  if (target.port !== '') {
    return {
      reason: 'url_non_default_port',
      message: `LITERATURE_SUPABASE_URL must use the default HTTPS port; port ${target.port} is refused.`,
    }
  }
  if (target.pathname !== '/' && target.pathname !== '') {
    return {
      reason: 'url_unexpected_path',
      message: `LITERATURE_SUPABASE_URL must address the project root; path ${target.pathname} is refused.`,
    }
  }
  if (target.isLoopback) {
    return {
      reason: 'loopback_not_permitted_in_production',
      message: `LITERATURE_SUPABASE_URL resolves to the loopback host ${target.hostname}, which is never a valid hosted Literature target.`,
    }
  }
  if (target.hostname !== LITERATURE_CANONICAL_PRODUCTION_HOSTNAME) {
    return {
      reason: 'noncanonical_production_url',
      message: `LITERATURE_SUPABASE_URL must be exactly ${LITERATURE_CANONICAL_PRODUCTION_ORIGIN}; host ${target.hostname} is refused.`,
    }
  }
  return null
}

/**
 * Resolve the dedicated Literature database binding.
 *
 * The contract is fail-closed in both directions: an incomplete or contradictory configuration
 * never silently degrades to the main application project, and a configuration that names the
 * wrong project is rejected rather than used.
 *
 * The strict contract requires all three dedicated variables, exactly the canonical hosted origin,
 * and a current-model `sb_secret_…` credential. Local mode keeps the same structural rules but
 * accepts loopback targets, legacy service-role JWTs, opaque local keys, and the legacy variable
 * name so the existing local Supabase workflow keeps working unchanged. Local mode never accepts a
 * remote host.
 */
export function resolveLiteratureDedicatedBinding(
  environment: LiteratureDedicatedEnvironment,
  mode: LiteratureRuntimeMode = resolveLiteratureRuntimeMode(environment),
): LiteratureDatabaseBinding {
  const strict = mode === 'production_strict'
  const rawUrl = environment.LITERATURE_SUPABASE_URL
  // H-3: the strict contract judges the raw byte sequence. Only local mode trims, and only for
  // presence detection — the two modes deliberately do not share a normalization path.
  const url = strict
    ? rawUrl === undefined || rawUrl === ''
      ? undefined
      : rawUrl
    : trimmed(rawUrl)
  const secretKey = trimmed(environment.LITERATURE_SUPABASE_SECRET_KEY)
  const legacyKey = trimmed(environment.LITERATURE_SUPABASE_SERVICE_ROLE_KEY)
  const expectedRef = trimmed(environment.LITERATURE_SUPABASE_EXPECTED_PROJECT_REF)

  if (!url && !secretKey && !legacyKey && !expectedRef) {
    return failure(
      mode,
      'not_configured',
      'The dedicated Literature database is not configured. Set LITERATURE_SUPABASE_URL, ' +
        'LITERATURE_SUPABASE_SECRET_KEY, and LITERATURE_SUPABASE_EXPECTED_PROJECT_REF.',
    )
  }

  // Two simultaneously defined privileged credentials are never silently reconciled. Identical
  // values are not two credentials, so that single case is allowed through; anything else stops.
  if (secretKey && legacyKey && secretKey !== legacyKey) {
    return failure(
      mode,
      'ambiguous_credentials',
      'LITERATURE_SUPABASE_SECRET_KEY and LITERATURE_SUPABASE_SERVICE_ROLE_KEY are both set to ' +
        'different values. Remove LITERATURE_SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  if (!secretKey && legacyKey && strict) {
    return failure(
      mode,
      'legacy_credential_variable_not_permitted_in_production',
      'The strict contract requires LITERATURE_SUPABASE_SECRET_KEY. The legacy ' +
        'LITERATURE_SUPABASE_SERVICE_ROLE_KEY variable is accepted only when ' +
        'LITERATURE_SUPABASE_RUNTIME_MODE=local.',
    )
  }

  const credential = secretKey ?? legacyKey
  const usedLegacyCredentialVariable = !secretKey && Boolean(legacyKey)

  if (!url || !credential || !expectedRef) {
    const missing = [
      url ? null : 'LITERATURE_SUPABASE_URL',
      credential ? null : 'LITERATURE_SUPABASE_SECRET_KEY',
      expectedRef ? null : 'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF',
    ].filter((name): name is string => name !== null)

    if (!expectedRef && url && credential) {
      return failure(
        mode,
        'expected_project_ref_missing',
        'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF is required so the Literature client can prove ' +
          'it is talking to the intended project.',
      )
    }
    return failure(
      mode,
      'partial_configuration',
      `The dedicated Literature configuration is incomplete. Missing: ${missing.join(', ')}. ` +
        'A partial dedicated configuration never falls back to the main application project.',
    )
  }

  if (!isWellFormedProjectRef(expectedRef)) {
    return failure(
      mode,
      'expected_project_ref_malformed',
      'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF must be a twenty-character Supabase project ref.',
    )
  }

  if (strict && url !== LITERATURE_CANONICAL_PRODUCTION_URL_EXACT) {
    // H-3 primary gate: raw bytes first, parsing never. The raw value is deliberately not echoed.
    return failure(
      mode,
      'noncanonical_production_url',
      'LITERATURE_SUPABASE_URL must be byte-for-byte exactly ' +
        `${LITERATURE_CANONICAL_PRODUCTION_URL_EXACT} — no trailing-slash omission, scheme case ` +
        'change, whitespace, explicit :443, dot path, or percent-encoding variant is accepted.',
    )
  }

  const target = parseLiteratureTargetUrl(url)
  if (!target) {
    return failure(mode, 'invalid_url', 'LITERATURE_SUPABASE_URL must be an absolute URL.')
  }

  if (strict) {
    // Secondary, defensive validation of the already-byte-exact value.
    const urlFailure = strictUrlFailure(target)
    if (urlFailure) return failure(mode, urlFailure.reason, urlFailure.message)
  } else {
    // Local mode is for the local Supabase stack only. It relaxes the scheme and port, never the
    // host: an arbitrary remote target must not become reachable by setting one variable.
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      return failure(
        mode,
        'invalid_url',
        'LITERATURE_SUPABASE_URL must use http or https in local mode.',
      )
    }
    if (target.hasUserInfo) {
      return failure(
        mode,
        'url_contains_userinfo',
        'LITERATURE_SUPABASE_URL must not embed a username or password.',
      )
    }
    if (!target.isLoopback) {
      return failure(
        mode,
        'remote_host_not_permitted_in_local_mode',
        `LITERATURE_SUPABASE_RUNTIME_MODE=local accepts loopback targets only; ${target.hostname} is refused.`,
      )
    }
  }

  if (LITERATURE_PROHIBITED_PROJECT_REFS.includes(expectedRef)) {
    return failure(
      mode,
      'prohibited_project_ref',
      `Project ref ${expectedRef} is the main application project and may never hold Literature ` +
        'data. Point the Literature client at the dedicated project instead.',
    )
  }

  if (target.projectRef === null) {
    // Only reachable in local mode: the strict path already required the canonical hosted host.
    if (strict) {
      return failure(
        mode,
        'unresolvable_project_ref',
        `No Supabase project ref can be derived from ${target.hostname}.`,
      )
    }
  } else {
    if (LITERATURE_PROHIBITED_PROJECT_REFS.includes(target.projectRef)) {
      return failure(
        mode,
        'prohibited_project_ref',
        `LITERATURE_SUPABASE_URL targets ${target.projectRef}, the main application project, ` +
          'which may never hold Literature data.',
      )
    }
    if (target.projectRef !== expectedRef) {
      return failure(
        mode,
        'project_ref_mismatch',
        `LITERATURE_SUPABASE_URL targets project ${target.projectRef} but ` +
          `LITERATURE_SUPABASE_EXPECTED_PROJECT_REF declares ${expectedRef}.`,
      )
    }
  }

  const resolvedRef = target.projectRef ?? expectedRef

  if (strict && resolvedRef !== LITERATURE_APPROVED_PRODUCTION_PROJECT_REF) {
    return failure(
      mode,
      'unapproved_production_project_ref',
      `Project ${resolvedRef} is not the approved dedicated Literature production project ` +
        `(${LITERATURE_APPROVED_PRODUCTION_PROJECT_REF}).`,
    )
  }

  const credentialClass = classifyLiteratureCredential(credential)

  if (NEVER_PRIVILEGED_CREDENTIAL_CLASSES.includes(credentialClass)) {
    return failure(
      mode,
      'invalid_credential_class',
      `The configured Literature credential is a ${credentialClass} key. The Literature client ` +
        'requires a privileged backend secret key and never accepts a publishable or anon key.',
    )
  }

  if (strict && credentialClass !== 'secret') {
    return failure(
      mode,
      'production_requires_secret_key_credential',
      'The strict contract requires a current-model Supabase backend secret key (sb_secret_…) in ' +
        'LITERATURE_SUPABASE_SECRET_KEY.',
    )
  }

  return {
    status: 'bound',
    mode,
    url,
    secretKey: credential,
    projectRef: resolvedRef,
    credentialClass,
    usedLegacyCredentialVariable,
  }
}

/**
 * A redacted view of a binding, safe to log or serialize. Present so the later
 * unavailable-versus-empty UI package can distinguish failure states without ever handling the
 * credential itself.
 */
export interface LiteratureBindingDiagnostics {
  status: LiteratureDatabaseBinding['status']
  mode: LiteratureRuntimeMode
  projectRef: string | null
  credentialClass: LiteratureCredentialClass | null
  reason: LiteratureBindingFailureReason | null
  message: string | null
  usedLegacyCredentialVariable: boolean
}

export function describeLiteratureBinding(
  binding: LiteratureDatabaseBinding,
): LiteratureBindingDiagnostics {
  if (binding.status === 'bound') {
    return {
      status: 'bound',
      mode: binding.mode,
      projectRef: binding.projectRef,
      credentialClass: binding.credentialClass,
      reason: null,
      message: null,
      usedLegacyCredentialVariable: binding.usedLegacyCredentialVariable,
    }
  }
  return {
    status: 'unbound',
    mode: binding.mode,
    projectRef: null,
    credentialClass: null,
    reason: binding.reason,
    message: binding.message,
    usedLegacyCredentialVariable: false,
  }
}
