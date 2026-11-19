import { createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto'

/**
 * Server-side access for the Literature Atlas draft-evidence viewer (a shared viewer password for a
 * small working group; the owner's decision of 2026-11-18). It follows the manufacturer preview's
 * pattern (`features/medical-thoracoscopy/wolf-preview/server/access.ts`), with one difference: the
 * password is chosen by a person, not random, so the environment holds a slow salted PBKDF2 hash.
 *
 * Configuration is read from the server environment on every call; anything missing or malformed
 * keeps the viewer shut (404). Nothing here is sent to the browser except the signed session cookie.
 *
 *   LITERATURE_ATLAS_VIEWER_HASH     `pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>` (the same
 *                                    format the Atlas uses; `python -m atlas_evidence.viewer hash`).
 *   LITERATURE_ATLAS_VIEWER_SECRET   at least 32 characters; signs viewer sessions. Rotating it, or
 *                                    changing the hash, ends every session.
 *   LITERATURE_ATLAS_RELAY_SECRET    at least 32 characters, shared with the Atlas service only
 *                                    (`ATLAS_RELAY_VIEWER_SECRET` there); signs the short-lived note
 *                                    the relay adds to its Atlas requests for a verified viewer.
 */

export const SESSION_SECONDS = 12 * 60 * 60
/** The relay's note to the Atlas lives five minutes; each relayed request gets a fresh one. */
export const RELAY_NOTE_SECONDS = 5 * 60
export const RELAY_HEADER = 'x-atlas-evidence-viewer'
const CLOCK_SKEW_SECONDS = 60
const SESSION_DOMAIN = 'literature-atlas-viewer:session:v1:'
const FINGERPRINT_DOMAIN = 'literature-atlas-viewer:hash:v1:'
const RELAY_DOMAIN = 'atlas-evidence-viewer:v1:'
const MIN_SECRET_LENGTH = 32
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 2_000_000

type Env = Record<string, string | undefined>

export interface ViewerConfig {
  readonly iterations: number
  readonly salt: Buffer
  readonly hash: Buffer
  readonly secret: string
  readonly relaySecret: string
  readonly fingerprint: string
}

export function parseHash(
  text: string | undefined,
): { iterations: number; salt: Buffer; hash: Buffer } | null {
  const parts = (text ?? '').trim().split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return null
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS)
    return null
  if (!/^[0-9a-f]{32,}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return null
  return { iterations, salt: Buffer.from(parts[2], 'hex'), hash: Buffer.from(parts[3], 'hex') }
}

/** The configuration, or null when the viewer is not fully and correctly configured. */
export function viewerConfig(env: Env = process.env): ViewerConfig | null {
  const parsed = parseHash(env.LITERATURE_ATLAS_VIEWER_HASH)
  const secret = env.LITERATURE_ATLAS_VIEWER_SECRET?.trim() ?? ''
  const relaySecret = env.LITERATURE_ATLAS_RELAY_SECRET?.trim() ?? ''
  if (!parsed || secret.length < MIN_SECRET_LENGTH || relaySecret.length < MIN_SECRET_LENGTH)
    return null
  if (secret === relaySecret) return null // two different keys, so one leaking does not give both
  const fingerprint = createHmac('sha256', secret)
    .update(FINGERPRINT_DOMAIN + parsed.hash.toString('hex'))
    .digest('base64url')
    .slice(0, 22)
  return { ...parsed, secret, relaySecret, fingerprint }
}

/** Whether a password is the configured one (constant-time comparison of the derived keys). */
export function checkPassword(config: ViewerConfig, password: string): boolean {
  if (typeof password !== 'string' || password.length === 0 || password.length > 200) return false
  const derived = pbkdf2Sync(password, config.salt, config.iterations, 32, 'sha256')
  return timingSafeEqual(derived, config.hash)
}

function sign(secret: string, domain: string, value: string): string {
  return createHmac('sha256', secret)
    .update(domain + value)
    .digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** A viewer session: `v1.<issued>.<expires>.<fingerprint>.<signature>`. */
export function issueSession(
  config: ViewerConfig,
  now = Date.now(),
): { value: string; maxAge: number } {
  const iat = Math.floor(now / 1000)
  const body = `v1.${iat}.${iat + SESSION_SECONDS}.${config.fingerprint}`
  return { value: `${body}.${sign(config.secret, SESSION_DOMAIN, body)}`, maxAge: SESSION_SECONDS }
}

/** Whether a cookie value is a current session for the configured password. */
export function verifySession(
  config: ViewerConfig | null,
  value: string | undefined,
  now = Date.now(),
): boolean {
  if (!config || !value || value.length > 512) return false
  const parts = value.split('.')
  if (parts.length !== 5 || parts[0] !== 'v1') return false
  const [, iatText, expText, fingerprint, signature] = parts
  const iat = Number(iatText)
  const exp = Number(expText)
  const seconds = Math.floor(now / 1000)
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return false
  if (exp <= seconds || iat > seconds + CLOCK_SKEW_SECONDS || exp - iat > SESSION_SECONDS)
    return false
  if (!safeEqual(fingerprint, config.fingerprint)) return false
  return safeEqual(signature, sign(config.secret, SESSION_DOMAIN, parts.slice(0, 4).join('.')))
}

/**
 * The note the relay adds to an Atlas request for a verified viewer: `v1.<expires>.<signature>`,
 * signed with the relay secret the Atlas also holds. It names no one and expires in minutes.
 */
export function relayNote(config: ViewerConfig, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + RELAY_NOTE_SECONDS
  return `v1.${exp}.${sign(config.relaySecret, RELAY_DOMAIN, String(exp))}`
}

/**
 * The session cookie's name and attributes. In production the `__Host-` prefix makes the browser
 * refuse it unless it is Secure, host-only and on path `/` (the relay under `/api/` must see it).
 */
export function sessionCookie(env: Env = process.env) {
  const production = env.NODE_ENV === 'production'
  return {
    name: production ? '__Host-literature-atlas-viewer' : 'literature-atlas-viewer',
    options: { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' },
  }
}

/** The value of one cookie from a raw Cookie header (the relay reads it without forwarding it). */
export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return undefined
}

// ——— Attempts (as the manufacturer preview counts them: per client and overall, in memory) ———

const WINDOW_MS = 15 * 60 * 1000
const PER_CLIENT = 10
const OVERALL = 100

type Window = { start: number; count: number }
const attempts = new Map<string, Window>()
let overall: Window = { start: 0, count: 0 }

function current(window: Window | undefined, now: number): Window {
  return !window || now - window.start >= WINDOW_MS ? { start: now, count: 0 } : window
}

export function mayAttempt(client: string, now = Date.now()): boolean {
  overall = current(overall, now)
  return current(attempts.get(client), now).count < PER_CLIENT && overall.count < OVERALL
}

export function recordFailure(client: string, now = Date.now()): void {
  const window = current(attempts.get(client), now)
  attempts.set(client, { ...window, count: window.count + 1 })
  overall = current(overall, now)
  overall = { ...overall, count: overall.count + 1 }
  if (attempts.size > 5000) {
    for (const [key, value] of attempts) if (now - value.start >= WINDOW_MS) attempts.delete(key)
  }
}

export function resetAttempts(): void {
  attempts.clear()
  overall = { start: 0, count: 0 }
}

/**
 * The client address that keys the attempt limit. A visitor can send its own `X-Forwarded-For`, so the
 * first (left-most) entry is the visitor's choice and is never trusted: rotating it would spread guesses
 * over many keys. Each trusted proxy appends the address it saw, so the entry `hops` places from the right
 * is the one the host's own proxy recorded (default 1: the last entry; set
 * `LITERATURE_ATLAS_TRUSTED_PROXY_HOPS` when the host adds more than one trusted hop). With no usable
 * forwarded chain, `X-Real-IP` is used, else one shared key, so an unknown client is limited, never exempt.
 * The overall cap in `mayAttempt` still bounds every attempt, whatever the key.
 */
export function clientOf(headers: Headers, hops: number = trustedProxyHops()): string {
  const chain = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (hops >= 1 && chain.length >= hops) return chain[chain.length - hops]!
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Trusted proxy hops in front of the site: a whole number from 1 to 5, else 1. */
export function trustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.LITERATURE_ATLAS_TRUSTED_PROXY_HOPS ?? '1')
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 1
}
