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
 *
 * ## The production runtime is activated by this source constant, never by a variable
 *
 * The third independent review found that a fully valid strict configuration produced a `bound`
 * result, which `createLiteratureAdmin()` turned into a privileged remote client that the existing
 * curation and gold-set callers use for mutating RPCs. Setting the documented Railway variables
 * would therefore have activated remote mutation with no reviewed change in between. The fix was
 * to make activation a **source constant** — `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION`,
 * deliberately not another environment variable — so no value an operator can set turns the
 * production client on.
 *
 * That constant is now `activated_by_reviewed_cutover`, and this is the reviewed change that set
 * it. The property it protects is unchanged and still load-bearing: the three Railway variables
 * *alone* cannot broaden the target. They are validated against the byte-exact canonical URL, the
 * single approved ref, and the current-model secret-key credential class, and a build without this
 * constant flipped refuses them all. Widening the target still requires editing this file.
 *
 * Activation is also not the same thing as capability. What a bound client may *do* is a separate,
 * equally source-controlled allowlist in `./database-client`: the reads the foundation schema
 * supports are carried, and curation writes, gold-set operations, and ingestion are withheld. See
 * `LITERATURE_ACTIVATED_OPERATIONS` there.
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

/**
 * The canonical local hostnames the relaxed local contract accepts, exactly as Node 20's WHATWG
 * `URL.hostname` renders them: letters lowercased, IPv4 shorthand expanded, IPv6 bracketed. This
 * is a closed *destination* allowlist, not a "looks local" heuristic (fourth review): `0.0.0.0`
 * and `[::]` are unspecified wildcard *bind* addresses, not loopback destinations, and
 * `*.localhost`, `localhost.localdomain`, other `127/8` aliases, and IPv4-mapped IPv6 forms are
 * deliberately absent. No DNS resolution is ever consulted.
 */
export const LITERATURE_PERMITTED_LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'] as const

const PERMITTED_LOCAL_HOSTNAME_SET: ReadonlySet<string> = new Set(
  LITERATURE_PERMITTED_LOCAL_HOSTNAMES,
)

/* ------------------------------------------------------------------------------------------- *
 * The raw local authority gate (fifth review, finding 3)
 *
 * Comparing `URL.hostname` against the allowlist above is necessary but not sufficient, because
 * the WHATWG host parser is a *normalizer*: it rewrites `127.1`, `127.0.1`, `127.000.000.001`,
 * `0177.0.0.1`, `0x7f.1`, and the bare integer `2130706433` all into the string `127.0.0.1`. Every
 * one of those spellings therefore satisfied a check written against the normalized output — the
 * allowlist looked closed while the set of accepted *inputs* was open.
 *
 * So the raw text is judged first, before any URL is constructed: only the documented canonical
 * authority spellings are admitted, and everything else is refused without normalization getting a
 * say. The normalized allowlist then runs as before, so both must agree.
 * ------------------------------------------------------------------------------------------- */

/**
 * The raw authority host spellings the local contract supports, written exactly as an operator
 * writes them. Closed, and enumerated rather than derived: there is no rule here that a future
 * numeric or shorthand form could satisfy by accident.
 *
 * `localhost` is matched ASCII-case-insensitively — a URI host is case-insensitive by definition,
 * so `LOCALHOST` is the same *name*, not an alias resolving to the same address by a different
 * spelling. The two IP literals are matched byte for byte; every other numeric spelling of the
 * loopback address is rejected precisely because it is a different spelling.
 */
export const LITERATURE_CANONICAL_RAW_LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const

const CANONICAL_RAW_LOCAL_HOST_SET: ReadonlySet<string> = new Set(
  LITERATURE_CANONICAL_RAW_LOCAL_HOSTS,
)

/** A port is optional; when present it must be a plain decimal in range, with no leading zero. */
function isCanonicalRawPort(port: string): boolean {
  if (port === '') return true
  if (!/^[1-9][0-9]{0,4}$/u.test(port)) return false
  return Number(port) <= 65535
}

/**
 * Whether the *raw* URL text carries one of the documented canonical local authorities.
 *
 * The authority is taken as the text between `://` and the first `/`, `?`, `#`, or `\` — the same
 * terminators the WHATWG authority state uses for a special scheme — so userinfo, an extra host,
 * or a backslash trick lands inside the extracted string and fails the exact comparison instead of
 * being normalized away. No `URL` is constructed and no DNS lookup is performed.
 */
export function hasCanonicalRawLocalAuthority(rawUrl: string): boolean {
  const separator = rawUrl.indexOf('://')
  if (separator < 0) return false

  let end = rawUrl.length
  for (let index = separator + 3; index < rawUrl.length; index += 1) {
    const character = rawUrl[index]
    if (character === '/' || character === '?' || character === '#' || character === '\\') {
      end = index
      break
    }
  }
  const authority = rawUrl.slice(separator + 3, end)

  let host = authority
  let port = ''
  if (authority.startsWith('[')) {
    const closing = authority.indexOf(']')
    if (closing < 0) return false
    host = authority.slice(0, closing + 1)
    const remainder = authority.slice(closing + 1)
    if (remainder !== '') {
      if (!remainder.startsWith(':')) return false
      port = remainder.slice(1)
    }
  } else {
    const colon = authority.indexOf(':')
    if (colon >= 0) {
      host = authority.slice(0, colon)
      port = authority.slice(colon + 1)
      // A second colon means userinfo or a malformed authority, never a canonical local target.
      if (port.includes(':')) return false
    }
  }

  // ASCII-only lowercasing: no locale rule and no Unicode folding can map another host onto one
  // of these spellings.
  const normalizedHost = host.replaceAll(/[A-Z]/gu, (letter) => letter.toLowerCase())
  return CANONICAL_RAW_LOCAL_HOST_SET.has(normalizedHost) && isCanonicalRawPort(port)
}

/** Wildcard/unspecified addresses: valid to bind a listener to, never a client destination. */
const UNSPECIFIED_WILDCARD_HOSTNAMES: ReadonlySet<string> = new Set(['0.0.0.0', '[::]'])

/**
 * Local-*shaped* hostnames in the broad diagnostic sense. Used only to pick the strict contract's
 * refusal reason (defence in depth behind the byte-exact production gate) — everything here is
 * refused in strict mode, and this breadth never feeds the permissive local allowlist above.
 */
function isLocalShapedHostname(hostname: string): boolean {
  return (
    PERMITTED_LOCAL_HOSTNAME_SET.has(hostname) ||
    UNSPECIFIED_WILDCARD_HOSTNAMES.has(hostname) ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost') ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(hostname)
  )
}

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

/**
 * Whether the dedicated **production** Literature runtime is activated in this build.
 *
 * A source constant on purpose. Introducing another environment variable here would recreate the
 * defect the third review found: a deployment could activate a privileged remote Literature client
 * — reachable by the existing curation and gold-set mutating RPCs — simply by setting variables,
 * with no reviewed change in between. Activation must be a code change.
 *
 * The production bring-up package is that code change, so the value is
 * `activated_by_reviewed_cutover`. What flipping it does and does not do:
 *
 *   - it does **not** relax a single validation rule. The byte-exact canonical URL, the approved
 *     ref, the prohibited main-project ref, and the `sb_secret_…` credential class are all still
 *     required, and a partial configuration still fails closed with no fallback;
 *   - it does **not** grant capability. `LITERATURE_ACTIVATED_OPERATIONS` in `./database-client`
 *     decides which operations may hold the resulting client, and curation writes, gold-set
 *     operations, and ingestion are not on it;
 *   - it does mean a correctly configured deployment reads the dedicated project instead of
 *     reporting "not configured".
 *
 * The annotation widens the type past the assigned literal deliberately: the comparison below is a
 * real runtime branch, and reverting activation needs no other edit.
 */
export type LiteratureProductionRuntimeActivation =
  | 'not_activated'
  | 'activated_by_reviewed_cutover'

export const LITERATURE_PRODUCTION_RUNTIME_ACTIVATION: LiteratureProductionRuntimeActivation =
  'activated_by_reviewed_cutover'

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
  /** The URL names a wildcard bind address (0.0.0.0 or [::]), which is never a destination. */
  | 'wildcard_address_not_permitted'
  /**
   * The raw authority is an alias spelling (`127.1`, `0x7f.1`, `2130706433`, …) that only the URL
   * parser's normalization would have turned into a canonical local host.
   */
  | 'noncanonical_local_url_authority'
  /** Local mode accepts the canonical local hosts only; another host was supplied. */
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

/**
 * The reason a *valid* configuration still yields no client. Distinct from every failure reason:
 * nothing is misconfigured, the runtime is simply not activated in this build.
 */
export type LiteratureBindingWithheldReason = 'dedicated_runtime_not_activated'

/**
 * A fully validated production configuration whose client is deliberately withheld.
 *
 * It carries the diagnostics the later capability-gating UI needs — mode, resolved ref, credential
 * class — and, pointedly, **no `secretKey` field**: there is nothing here for a caller to
 * construct a remote client from, by mistake or by cast.
 */
export interface LiteratureDatabaseBindingWithheld {
  status: 'not_activated'
  mode: LiteratureRuntimeMode
  projectRef: string
  credentialClass: LiteratureCredentialClass
  reason: LiteratureBindingWithheldReason
  message: string
}

export type LiteratureDatabaseBinding =
  | LiteratureDatabaseBindingSuccess
  | LiteratureDatabaseBindingWithheld
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
  /**
   * The **raw** authority was one of the documented canonical local spellings, judged before the
   * URL parser normalized anything. False for `127.1`, `0x7f.1`, `2130706433`, and every other
   * alias the parser would have rewritten into an allowlisted hostname.
   */
  hasCanonicalRawLocalAuthority: boolean
  /**
   * The URL parser's `hostname` is on the canonical allowlist. On its own this says nothing about
   * how the authority was spelled — it is true for `127.1` and `0x7f.1` too — so it is used only
   * to tell an alias spelling apart from an ordinary remote host when reporting a refusal.
   */
  normalizesToPermittedLocalHostname: boolean
  /**
   * Exactly on the canonical local allowlist — the only client-permitting sense of "local".
   * Requires the raw spelling *and* the normalized hostname to agree.
   */
  isPermittedLocalHost: boolean
  /** A wildcard/unspecified bind address (`0.0.0.0`, `[::]`). Never a permitted destination. */
  isUnspecifiedWildcardHost: boolean
  /** Local-shaped in the broad diagnostic sense. Refused in strict mode; never permits anything. */
  isLocalShapedHost: boolean
  projectRef: string | null
}

/**
 * Parse a Literature target URL into the facts the contract judges. Returns `null` only when the
 * value is not a parseable absolute URL; every other defect is reported through the returned
 * fields so callers can fail closed with a specific reason.
 */
export function parseLiteratureTargetUrl(url: string): ParsedLiteratureTarget | null {
  const raw = url.trim()
  // Judged on the raw text, before the URL parser can normalize an alias spelling into a
  // hostname the allowlist recognises (fifth review, finding 3).
  const rawLocalAuthority = hasCanonicalRawLocalAuthority(raw)

  let parsed: URL
  try {
    parsed = new URL(raw)
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
    hasCanonicalRawLocalAuthority: rawLocalAuthority,
    normalizesToPermittedLocalHostname: PERMITTED_LOCAL_HOSTNAME_SET.has(hostname),
    // Both gates must agree: the operator wrote a documented canonical authority *and* it parses
    // to a canonical loopback destination.
    isPermittedLocalHost: rawLocalAuthority && PERMITTED_LOCAL_HOSTNAME_SET.has(hostname),
    isUnspecifiedWildcardHost: UNSPECIFIED_WILDCARD_HOSTNAMES.has(hostname),
    isLocalShapedHost: isLocalShapedHostname(hostname),
    projectRef: hosted ? hosted[1] : null,
  }
}

export function isWellFormedProjectRef(value: string): boolean {
  return PROJECT_REF_PATTERN.test(value.trim())
}

/**
 * The explicit canonical local-host allowlist that the single client-constructing path checks:
 * exactly `localhost`, `127.0.0.1`, and `[::1]` — as the operator spelled them in the raw value
 * *and* in Node's own `URL.hostname` rendering.
 *
 * `resolveLiteratureDedicatedBinding` already refuses every other host in local mode, so this is
 * a second, independent statement of the same rule at the point of construction: while the
 * production runtime is not activated, a Supabase client may only ever be built for a canonical
 * loopback destination — never a wildcard bind address such as `0.0.0.0`, never an alias spelling
 * such as `127.1` or `2130706433` that only normalization makes look canonical, and never a
 * remote host. Two agreeing gates are what makes "no remote client exists in this PR" checkable
 * rather than inferred from control flow.
 */
export function isPermittedLocalRuntimeUrl(url: string): boolean {
  const target = parseLiteratureTargetUrl(url)
  if (!target) return false
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false
  if (target.hasUserInfo) return false
  return target.isPermittedLocalHost
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
  if (target.isLocalShapedHost) {
    return {
      reason: 'loopback_not_permitted_in_production',
      message: `LITERATURE_SUPABASE_URL resolves to the local host ${target.hostname}, which is never a valid hosted Literature target.`,
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
 * accepts the canonical local hosts (`localhost`, `127.0.0.1`, `[::1]`, spelled canonically in the
 * raw value), legacy service-role JWTs, opaque local keys, and the legacy variable name so the
 * existing local Supabase workflow keeps working unchanged. Local mode never accepts a remote
 * host, never a wildcard bind address such as `0.0.0.0`, and never an alias spelling of the
 * loopback address that only the URL parser's normalization would have made acceptable.
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
    if (target.isUnspecifiedWildcardHost) {
      // Fourth review: 0.0.0.0 (and [::]) is an unspecified wildcard *bind* address, not a
      // loopback destination. It gets its own reason so the refusal is diagnosable.
      return failure(
        mode,
        'wildcard_address_not_permitted',
        `LITERATURE_SUPABASE_URL names ${target.hostname}, a wildcard bind address rather than ` +
          'a loopback destination; local mode accepts only localhost, 127.0.0.1, or [::1].',
      )
    }
    if (!target.normalizesToPermittedLocalHostname) {
      return failure(
        mode,
        'remote_host_not_permitted_in_local_mode',
        'LITERATURE_SUPABASE_RUNTIME_MODE=local accepts only the canonical local hosts ' +
          `localhost, 127.0.0.1, and [::1]; ${target.hostname} is refused.`,
      )
    }
    if (!target.hasCanonicalRawLocalAuthority) {
      // Fifth review: the host only *normalizes* to an allowlisted spelling — `127.1`, `0x7f.1`,
      // `2130706433`, and friends. That gets its own reason so the refusal is diagnosable and is
      // not reported as "some remote host". The raw value is deliberately not echoed.
      return failure(
        mode,
        'noncanonical_local_url_authority',
        'LITERATURE_SUPABASE_URL must spell its authority canonically: local mode accepts only ' +
          'localhost, 127.0.0.1, or [::1], written exactly. Shorthand, zero-padded, octal, ' +
          'hexadecimal, and bare-integer spellings of the loopback address are refused before ' +
          'the URL parser is allowed to normalize them.',
      )
    }
    // Those two refusals are exactly the conjunction `isPermittedLocalHost` encodes, so anything
    // reaching this point satisfies the same predicate the client-constructing path re-checks
    // independently in `isPermittedLocalRuntimeUrl`.
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

  // Everything above has validated the strict configuration completely — canonical byte-exact URL,
  // approved ref, secret-key credential class. This is where validation stops and activation would
  // begin, and activation is deliberately absent: the production runtime is switched by a source
  // constant, not by any variable, so a valid configuration yields diagnostics and no client.
  if (strict && LITERATURE_PRODUCTION_RUNTIME_ACTIVATION !== 'activated_by_reviewed_cutover') {
    return {
      status: 'not_activated',
      mode,
      projectRef: resolvedRef,
      credentialClass,
      reason: 'dedicated_runtime_not_activated',
      message:
        `The dedicated Literature configuration for project ${resolvedRef} is valid, but the ` +
        'production Literature runtime is not activated in this build. No Supabase client is ' +
        'constructed and no remote RPC is reachable. Activation is a reviewed code change in the ' +
        'capability-gating / cutover package, not an environment variable: setting ' +
        'LITERATURE_SUPABASE_URL, LITERATURE_SUPABASE_SECRET_KEY, and ' +
        'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF does not enable it.',
    }
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
  reason: LiteratureBindingFailureReason | LiteratureBindingWithheldReason | null
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
  if (binding.status === 'not_activated') {
    // Valid but withheld. The later capability-gating UI needs to tell this apart from both
    // "misconfigured" and "no articles yet", so it keeps its ref and credential class.
    return {
      status: 'not_activated',
      mode: binding.mode,
      projectRef: binding.projectRef,
      credentialClass: binding.credentialClass,
      reason: binding.reason,
      message: binding.message,
      usedLegacyCredentialVariable: false,
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
