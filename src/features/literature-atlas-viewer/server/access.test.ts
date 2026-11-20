/** @jest-environment node */
import { pbkdf2Sync, randomBytes } from 'node:crypto'

import {
  RELAY_NOTE_SECONDS,
  checkPassword,
  clientOf,
  cookieValue,
  issueSession,
  mayAttempt,
  parseHash,
  recordFailure,
  relayNote,
  resetAttempts,
  sessionCookie,
  trustedProxyHops,
  verifySession,
  viewerConfig,
} from './access'

const PASSWORD = 'INVENTED-viewer-pass'
const SECRET = 'INVENTED-session-secret-for-tests-0123456789'
const RELAY_SECRET = 'INVENTED-relay-secret-for-tests-0123456789'
// The Atlas's tests assert the same vector (tests/test_evidence_domains.py, RELAY_VECTOR).
const RELAY_VECTOR = 'v1.1800000300.MzrqB8W6_dTEUCTCiR1tanFM7MF5oJeju3AEIds6slM'

function hashOf(password: string, iterations = 100_000) {
  const salt = randomBytes(16)
  const derived = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  return `pbkdf2_sha256$${iterations}$${salt.toString('hex')}$${derived.toString('hex')}`
}

const HASH = hashOf(PASSWORD)
const env = {
  LITERATURE_ATLAS_VIEWER_HASH: HASH,
  LITERATURE_ATLAS_VIEWER_SECRET: SECRET,
  LITERATURE_ATLAS_RELAY_SECRET: RELAY_SECRET,
}

describe('Literature Atlas viewer access', () => {
  it('is shut unless every setting is present and well formed', () => {
    expect(viewerConfig(env)).not.toBeNull()
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_HASH: undefined })).toBeNull()
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_HASH: 'sha256:abc' })).toBeNull()
    expect(
      viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_HASH: hashOf(PASSWORD, 1000) }),
    ).toBeNull()
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_SECRET: 'short' })).toBeNull()
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_RELAY_SECRET: '' })).toBeNull()
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_RELAY_SECRET: SECRET })).toBeNull() // two keys, not one
    expect(parseHash('pbkdf2_sha256$310000$00$00')).toBeNull()
  })

  it('accepts only the configured password', () => {
    const config = viewerConfig(env)!
    expect(checkPassword(config, PASSWORD)).toBe(true)
    for (const wrong of ['', 'INVENTED-viewer-Pass', `${PASSWORD} `, 'x'.repeat(500)]) {
      expect(checkPassword(config, wrong)).toBe(false)
    }
  })

  it('accepts each of several configured passwords, each revocable on its own', () => {
    const SECOND = 'INVENTED-second-pass'
    const THIRD = 'INVENTED-third-pass'
    const multi = { ...env, LITERATURE_ATLAS_VIEWER_HASH_2: hashOf(SECOND), LITERATURE_ATLAS_VIEWER_HASH_5: hashOf(THIRD) }
    const config = viewerConfig(multi)!
    expect(config.hashes).toHaveLength(3)
    for (const ok of [PASSWORD, SECOND, THIRD]) expect(checkPassword(config, ok)).toBe(true)
    expect(checkPassword(config, 'INVENTED-other-pass')).toBe(false)
    // removing one password: it stops working, the others still do
    const without = viewerConfig({ ...multi, LITERATURE_ATLAS_VIEWER_HASH_2: undefined })!
    expect(checkPassword(without, SECOND)).toBe(false)
    expect(checkPassword(without, PASSWORD)).toBe(true)
    expect(checkPassword(without, THIRD)).toBe(true)
    // blank extras are ignored; a malformed extra keeps the viewer shut
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_HASH_3: '  ' })).not.toBeNull()
    expect(viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_HASH_3: 'sha256:abc' })).toBeNull()
    // an extra alone, without the main password, does not open the viewer
    expect(viewerConfig({ ...multi, LITERATURE_ATLAS_VIEWER_HASH: undefined })).toBeNull()
    // changing any password changes the fingerprint, which ends existing sessions
    expect(config.fingerprint).not.toBe(viewerConfig(env)!.fingerprint)
    expect(config.fingerprint).not.toBe(without.fingerprint)
  })

  it('issues sessions that expire, cannot be forged, and end when the password or secret changes', () => {
    const config = viewerConfig(env)!
    const now = 1_800_000_000_000
    const { value, maxAge } = issueSession(config, now)
    expect(maxAge).toBe(12 * 60 * 60)
    expect(verifySession(config, value, now)).toBe(true)
    expect(verifySession(config, value, now + maxAge * 1000 + 1)).toBe(false)
    expect(verifySession(config, `${value}x`, now)).toBe(false)
    const parts = value.split('.')
    parts[2] = String(Number(parts[2]) + 3600) // a longer life with the old signature
    expect(verifySession(config, parts.join('.'), now)).toBe(false)
    expect(
      verifySession(
        viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_HASH: hashOf('other') }),
        value,
        now,
      ),
    ).toBe(false)
    expect(
      verifySession(
        viewerConfig({ ...env, LITERATURE_ATLAS_VIEWER_SECRET: `${SECRET}-rotated` }),
        value,
        now,
      ),
    ).toBe(false)
    expect(verifySession(null, value, now)).toBe(false)
    expect(verifySession(config, undefined, now)).toBe(false)
  })

  it('signs the relay note exactly as the Atlas verifies it, for minutes only', () => {
    const config = viewerConfig(env)!
    expect(relayNote(config, (1_800_000_300 - RELAY_NOTE_SECONDS) * 1000)).toBe(RELAY_VECTOR)
    expect(RELAY_NOTE_SECONDS).toBeLessThanOrEqual(600)
  })

  it('reads one cookie from a header and uses a host-only Secure cookie in production', () => {
    expect(cookieValue('a=1; literature-atlas-viewer=v1.x; b=2', 'literature-atlas-viewer')).toBe(
      'v1.x',
    )
    expect(cookieValue('xliterature-atlas-viewer=1', 'literature-atlas-viewer')).toBeUndefined()
    expect(cookieValue(null, 'x')).toBeUndefined()
    const prod = sessionCookie({ NODE_ENV: 'production' })
    expect(prod.name).toBe('__Host-literature-atlas-viewer')
    expect(prod.options).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
  })

  it('limits attempts per client and overall', () => {
    resetAttempts()
    const now = 1_800_000_000_000
    for (let i = 0; i < 10; i++) recordFailure('client-a', now)
    expect(mayAttempt('client-a', now)).toBe(false)
    expect(mayAttempt('client-b', now)).toBe(true)
    expect(mayAttempt('client-a', now + 16 * 60 * 1000)).toBe(true)
    resetAttempts()
  })

  it('keys attempts on the address the host proxy recorded, not one the visitor forged', () => {
    const headers = (value: Record<string, string>) => new Headers(value)
    // a forged first entry is ignored: the proxy-appended last entry is the key
    expect(clientOf(headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.20' }), 1)).toBe('198.51.100.20')
    expect(clientOf(headers({ 'x-forwarded-for': 'forged-1, 198.51.100.20' }), 1)).toBe(
      clientOf(headers({ 'x-forwarded-for': 'forged-2, 198.51.100.20' }), 1),
    )
    expect(clientOf(headers({ 'x-forwarded-for': '198.51.100.20' }), 1)).toBe('198.51.100.20')
    // two trusted hops: the second entry from the right
    expect(clientOf(headers({ 'x-forwarded-for': 'forged, 198.51.100.20, 10.0.0.1' }), 2)).toBe('198.51.100.20')
    // no usable chain: X-Real-IP, else one shared key (limited, never exempt)
    expect(clientOf(headers({ 'x-forwarded-for': '10.0.0.1' }), 2)).toBe('unknown')
    expect(clientOf(headers({ 'x-real-ip': '198.51.100.7' }), 1)).toBe('198.51.100.7')
    expect(clientOf(headers({}), 1)).toBe('unknown')
    // rotating forged entries cannot spread guesses over many keys
    resetAttempts()
    const now = 1_800_000_000_000
    for (let i = 0; i < 10; i++) recordFailure(clientOf(headers({ 'x-forwarded-for': `forged-${i}, 198.51.100.20` }), 1), now)
    expect(mayAttempt(clientOf(headers({ 'x-forwarded-for': 'forged-new, 198.51.100.20' }), 1), now)).toBe(false)
    resetAttempts()
  })

  it('reads the trusted hop count from configuration, within bounds', () => {
    expect(trustedProxyHops({})).toBe(1)
    expect(trustedProxyHops({ LITERATURE_ATLAS_TRUSTED_PROXY_HOPS: '2' })).toBe(2)
    for (const bad of ['0', '-1', '9', 'x', '1.5']) expect(trustedProxyHops({ LITERATURE_ATLAS_TRUSTED_PROXY_HOPS: bad })).toBe(1)
  })
})
