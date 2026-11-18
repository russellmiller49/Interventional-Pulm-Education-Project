/** @jest-environment node */
import { pbkdf2Sync, randomBytes } from 'node:crypto'

import {
  RELAY_NOTE_SECONDS,
  checkPassword,
  cookieValue,
  issueSession,
  mayAttempt,
  parseHash,
  recordFailure,
  relayNote,
  resetAttempts,
  sessionCookie,
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
})
