/**
 * Dedicated Literature Supabase project contract.
 *
 * The Literature corpus lives in its own Supabase project (`IP_Literature`). The main
 * application project (`Endoreels`) keeps authentication, site-admin identity, and the existing
 * non-Literature application data, and must never receive the Literature schema or corpus.
 *
 * Everything in this module is pure: no network access, no `process.env` reads, no Supabase
 * client construction. That keeps the binding rules independently testable and lets the
 * operational scripts under `scripts/literature/dedicated-supabase/` share one source of truth
 * with the runtime resolver in `./database-client`.
 *
 * No function here ever returns, embeds, or logs a credential value. Failures are reported as
 * typed reason codes plus messages that name only variables, hostnames, and project refs.
 */

/** The approved dedicated Literature production project (`IP_Literature`). */
export const LITERATURE_APPROVED_PRODUCTION_PROJECT_REF = 'itcttmkxdxvwmwcmzmey'

/** The main application project (`Endoreels`). Authentication only — never Literature data. */
export const LITERATURE_MAIN_APPLICATION_PROJECT_REF = 'tqnhxlwvkkswuckszlee'

/**
 * Project refs that may never be used as a Literature data target, in any mode. The main
 * application project is excluded outright rather than only in production: the whole point of the
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
 */
export type LiteratureCredentialClass =
  /** Current Supabase backend secret key (`sb_secret_…`). The only class production accepts. */
  | 'secret'
  /** Current Supabase browser-safe key (`sb_publishable_…`). Never privileged. */
  | 'publishable'
  /** Legacy service-role JWT. Privileged, but not accepted in production. */
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

export type LiteratureRuntimeMode = 'production' | 'non_production'

export type LiteratureBindingFailureReason =
  /** No dedicated Literature variable is set at all. */
  | 'not_configured'
  /** Some but not all required dedicated variables are set. */
  | 'partial_configuration'
  /** Both the new secret variable and the legacy variable are set to different values. */
  | 'ambiguous_credentials'
  /** Only the legacy service-role variable is set, and the mode is production. */
  | 'legacy_credential_variable_not_permitted_in_production'
  /** The URL does not parse, or does not use https/http. */
  | 'invalid_url'
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
  /** In production the target must be the single approved dedicated ref. */
  | 'unapproved_production_project_ref'
  /** A loopback or local URL was presented as a production target. */
  | 'loopback_not_permitted_in_production'
  /** The credential is a publishable/anon/unclassifiable key. */
  | 'invalid_credential_class'
  /** In production the credential must use the current `sb_secret_…` model. */
  | 'production_requires_secret_key_credential'

export interface LiteratureDatabaseBindingSuccess {
  status: 'bound'
  mode: LiteratureRuntimeMode
  url: string
  /** The privileged backend credential. Never log, serialize, or return this to a client. */
  secretKey: string
  projectRef: string
  credentialClass: LiteratureCredentialClass
  /** True when the legacy variable supplied the credential (non-production only). */
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
export interface LiteratureDedicatedEnvironment {
  LITERATURE_SUPABASE_URL?: string
  LITERATURE_SUPABASE_SECRET_KEY?: string
  LITERATURE_SUPABASE_EXPECTED_PROJECT_REF?: string
  /** Legacy alias retained for established local workflows. Never accepted in production. */
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
 * usable outside production while never being accepted as a production credential.
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
  isLoopback: boolean
  projectRef: string | null
}

/**
 * Parse a Literature target URL. Returns `null` only when the value is not a usable http(s) URL;
 * a well-formed URL with no derivable project ref is returned with `projectRef: null` so callers
 * can fail closed with the more specific `unresolvable_project_ref` reason.
 */
export function parseLiteratureTargetUrl(url: string): ParsedLiteratureTarget | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  const hosted = SUPABASE_HOST_PATTERN.exec(hostname)
  return {
    hostname,
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
 * Resolve the dedicated Literature database binding.
 *
 * The contract is fail-closed in both directions: an incomplete or contradictory configuration
 * never silently degrades to the main application project, and a configuration that names the
 * wrong project is rejected rather than used.
 *
 * Production requires all three dedicated variables, a target that resolves to the single approved
 * ref, and a current-model `sb_secret_…` credential. Outside production the same structural rules
 * apply except that loopback targets, refs other than the approved one, legacy service-role JWTs,
 * and the legacy variable name remain supported so the existing local Supabase workflow keeps
 * working unchanged.
 */
export function resolveLiteratureDedicatedBinding(
  environment: LiteratureDedicatedEnvironment,
  mode: LiteratureRuntimeMode,
): LiteratureDatabaseBinding {
  const url = trimmed(environment.LITERATURE_SUPABASE_URL)
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

  if (!secretKey && legacyKey && mode === 'production') {
    return failure(
      mode,
      'legacy_credential_variable_not_permitted_in_production',
      'Production requires LITERATURE_SUPABASE_SECRET_KEY. The legacy ' +
        'LITERATURE_SUPABASE_SERVICE_ROLE_KEY variable is accepted only outside production.',
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

  const target = parseLiteratureTargetUrl(url)
  if (!target) {
    return failure(mode, 'invalid_url', 'LITERATURE_SUPABASE_URL must be an absolute http(s) URL.')
  }

  if (mode === 'production' && target.isLoopback) {
    return failure(
      mode,
      'loopback_not_permitted_in_production',
      `LITERATURE_SUPABASE_URL resolves to the loopback host ${target.hostname}, which is never a ` +
        'valid production Literature target.',
    )
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
    // Outside production a non-hosted target (a local Supabase stack, a tunnel) cannot carry a ref
    // in its hostname, so the expected ref is accepted as the declared identity of that target.
    if (mode === 'production') {
      return failure(
        mode,
        'unresolvable_project_ref',
        `No Supabase project ref can be derived from ${target.hostname}. Production requires a ` +
          'hosted https://<ref>.supabase.co URL so the target identity can be proven.',
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

  if (mode === 'production' && resolvedRef !== LITERATURE_APPROVED_PRODUCTION_PROJECT_REF) {
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

  if (mode === 'production' && credentialClass !== 'secret') {
    return failure(
      mode,
      'production_requires_secret_key_credential',
      'Production requires a current-model Supabase backend secret key (sb_secret_…) in ' +
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
