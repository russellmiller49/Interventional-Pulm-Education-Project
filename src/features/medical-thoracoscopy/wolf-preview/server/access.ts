import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Server-side access for the private manufacturer review of the device explorer.
 *
 * Nothing here is ever sent to the browser except the signed session cookie, which carries no
 * code and no verifier. Configuration is read from the server environment on every call, so
 * changing it on the host takes effect at once:
 *
 *   MT_WOLF_PREVIEW_ENABLED         "true" to open the preview; anything else keeps it shut (404).
 *   MT_WOLF_PREVIEW_SESSION_SECRET  at least 32 characters; signs session cookies. Rotating it
 *                                   ends every session.
 *   MT_WOLF_PREVIEW_REVIEWERS       comma-separated `label:sha256:<64 hex>` entries, one per issued
 *                                   review code. Removing an entry, or giving the label a new
 *                                   code, ends that reviewer's sessions.
 *
 * A review code is random (see `scripts/medical-thoracoscopy/wolf-preview-credential.mjs`), so a
 * salted SHA-256 verifier is enough: the environment never holds a code, and a verifier cannot be
 * reversed. Any missing or malformed setting leaves the preview shut; nothing fails open.
 */

export const SESSION_SECONDS = 7 * 24 * 60 * 60
const CLOCK_SKEW_SECONDS = 60
const VERIFIER_DOMAIN = 'mt-wolf-preview:code:v1:'
const COOKIE_DOMAIN = 'mt-wolf-preview:session:v1:'
const FINGERPRINT_DOMAIN = 'mt-wolf-preview:verifier:v1:'
const LABEL = /^[a-z0-9][a-z0-9-]{0,39}$/
const VERIFIER = /^sha256:([0-9a-f]{64})$/
const MIN_SECRET_LENGTH = 32

type Env = Record<string, string | undefined>

export interface Reviewer {
  readonly label: string
  readonly digest: Buffer
}

export interface PreviewConfig {
  readonly secret: string
  readonly reviewers: readonly Reviewer[]
}

/** The configuration, or null when the preview is off or not fully and correctly configured. */
export function previewConfig(env: Env = process.env): PreviewConfig | null {
  if (env.MT_WOLF_PREVIEW_ENABLED?.trim() !== 'true') return null
  const secret = env.MT_WOLF_PREVIEW_SESSION_SECRET?.trim() ?? ''
  if (secret.length < MIN_SECRET_LENGTH) return null
  const reviewers: Reviewer[] = []
  for (const raw of (env.MT_WOLF_PREVIEW_REVIEWERS ?? '').split(',')) {
    const entry = raw.trim()
    if (!entry) continue
    const split = entry.indexOf(':')
    const label = entry.slice(0, split)
    const match = entry.slice(split + 1).match(VERIFIER)
    // A malformed entry shuts the whole preview rather than being skipped silently.
    if (split <= 0 || !LABEL.test(label) || !match) return null
    if (reviewers.some((reviewer) => reviewer.label === label)) return null
    reviewers.push({ label, digest: Buffer.from(match[1], 'hex') })
  }
  if (reviewers.length === 0) return null
  return { secret, reviewers }
}

/** Codes are compared without spaces or hyphens and in upper case, as they are issued. */
export function normaliseCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase()
}

export function codeDigest(code: string): Buffer {
  return createHash('sha256')
    .update(VERIFIER_DOMAIN + normaliseCode(code))
    .digest()
}

/** The verifier to put in the environment for a code. */
export function codeVerifier(code: string): string {
  return `sha256:${codeDigest(code).toString('hex')}`
}

/** A new random review code: 25 base-32 characters (125 bits), in groups of five. */
export function newReviewCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(25)
  const characters = [...bytes].map((byte) => alphabet[byte % 32]).join('')
  return `MTW-${characters.match(/.{5}/g)!.join('-')}`
}

/**
 * The reviewer a code belongs to, or null. Every configured verifier is compared, in constant
 * time, whether or not an earlier one matched, so the time taken says nothing about which.
 */
export function matchCode(config: PreviewConfig, code: string): Reviewer | null {
  const normalised = normaliseCode(code)
  if (normalised.length < 16 || normalised.length > 128) return null
  const digest = codeDigest(normalised)
  let found: Reviewer | null = null
  for (const reviewer of config.reviewers) {
    if (timingSafeEqual(digest, reviewer.digest) && !found) found = reviewer
  }
  return found
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url')
}

function sign(secret: string, value: string): Buffer {
  return createHmac('sha256', secret)
    .update(COOKIE_DOMAIN + value)
    .digest()
}

/** A short tag of the reviewer's current verifier, so a re-issued code ends older sessions. */
function fingerprint(secret: string, reviewer: Reviewer): string {
  return createHmac('sha256', secret)
    .update(FINGERPRINT_DOMAIN + reviewer.digest.toString('hex'))
    .digest('base64url')
    .slice(0, 22)
}

interface SessionPayload {
  readonly v: 1
  readonly l: string
  readonly f: string
  readonly iat: number
  readonly exp: number
}

export function issueSession(
  config: PreviewConfig,
  reviewer: Reviewer,
  now = Date.now(),
): { value: string; maxAge: number } {
  const iat = Math.floor(now / 1000)
  const payload: SessionPayload = {
    v: 1,
    l: reviewer.label,
    f: fingerprint(config.secret, reviewer),
    iat,
    exp: iat + SESSION_SECONDS,
  }
  const body = base64url(Buffer.from(JSON.stringify(payload)))
  return { value: `${body}.${base64url(sign(config.secret, body))}`, maxAge: SESSION_SECONDS }
}

/** The reviewer label a cookie proves, or null for a missing, forged, expired or revoked one. */
export function verifySession(
  config: PreviewConfig | null,
  value: string | undefined,
  now = Date.now(),
): string | null {
  if (!config || !value || value.length > 1024) return null
  const [body, signature, extra] = value.split('.')
  if (!body || !signature || extra !== undefined) return null
  const expected = sign(config.secret, body)
  let given: Buffer
  try {
    given = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
  } catch {
    return null
  }
  const seconds = Math.floor(now / 1000)
  if (
    payload.v !== 1 ||
    typeof payload.l !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.exp <= seconds ||
    payload.iat > seconds + CLOCK_SKEW_SECONDS ||
    payload.exp - payload.iat > SESSION_SECONDS
  )
    return null
  const reviewer = config.reviewers.find((candidate) => candidate.label === payload.l)
  if (!reviewer || payload.f !== fingerprint(config.secret, reviewer)) return null
  return reviewer.label
}

/**
 * The session cookie's name and attributes. In production the `__Host-` prefix makes the browser
 * refuse it unless it is Secure, host-only and on path `/`.
 */
export function sessionCookie(env: Env = process.env) {
  const production = env.NODE_ENV === 'production'
  return {
    name: production ? '__Host-mt-wolf-preview' : 'mt-wolf-preview',
    options: {
      httpOnly: true,
      secure: production,
      sameSite: 'lax' as const,
      path: '/',
    },
  }
}

// ——— Attempts ———

const WINDOW_MS = 15 * 60 * 1000
const PER_CLIENT = 10
const OVERALL = 200

type Window = { start: number; count: number }
const attempts = new Map<string, Window>()
let overall: Window = { start: 0, count: 0 }

function current(window: Window | undefined, now: number): Window {
  return !window || now - window.start >= WINDOW_MS ? { start: now, count: 0 } : window
}

/**
 * Whether a client may try a code now. Failed attempts are counted per client and overall, in
 * memory on this server: enough to stop rapid guessing of a 125-bit code, with no new service.
 */
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

/** The client address as the host's proxy reports it; the first forwarded address wins. */
export function clientOf(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  )
}
