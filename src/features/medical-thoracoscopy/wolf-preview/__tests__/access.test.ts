/** @jest-environment node */
import {
  codeVerifier,
  issueSession,
  matchCode,
  mayAttempt,
  newReviewCode,
  normaliseCode,
  previewConfig,
  recordFailure,
  resetAttempts,
  SESSION_SECONDS,
  sessionCookie,
  verifySession,
} from '../server/access'

/**
 * The preview's access rules, on the server: off unless fully configured, codes checked against
 * verifiers only, sessions signed, bounded in time, and ended by revoking or re-issuing a code.
 */
const SECRET = 'test-secret-'.padEnd(48, 'x')
const CODE_1 = newReviewCode()
const CODE_2 = newReviewCode()
const env = (overrides: Record<string, string | undefined> = {}) => ({
  MT_WOLF_PREVIEW_ENABLED: 'true',
  MT_WOLF_PREVIEW_SESSION_SECRET: SECRET,
  MT_WOLF_PREVIEW_REVIEWERS: `wolf-reviewer-1:${codeVerifier(CODE_1)},wolf-reviewer-2:${codeVerifier(CODE_2)}`,
  ...overrides,
})

describe('preview configuration', () => {
  it('opens only when enabled, signed and with at least one well-formed reviewer', () => {
    expect(previewConfig(env())?.reviewers.map((reviewer) => reviewer.label)).toEqual([
      'wolf-reviewer-1',
      'wolf-reviewer-2',
    ])
    for (const broken of [
      { MT_WOLF_PREVIEW_ENABLED: undefined },
      { MT_WOLF_PREVIEW_ENABLED: 'false' },
      { MT_WOLF_PREVIEW_ENABLED: 'TRUE ' },
      { MT_WOLF_PREVIEW_ENABLED: '1' },
      { MT_WOLF_PREVIEW_SESSION_SECRET: undefined },
      { MT_WOLF_PREVIEW_SESSION_SECRET: 'short' },
      { MT_WOLF_PREVIEW_REVIEWERS: undefined },
      { MT_WOLF_PREVIEW_REVIEWERS: '' },
      { MT_WOLF_PREVIEW_REVIEWERS: `Wolf:${codeVerifier(CODE_1)}` },
      { MT_WOLF_PREVIEW_REVIEWERS: `a:${codeVerifier(CODE_1)},a:${codeVerifier(CODE_2)}` },
      { MT_WOLF_PREVIEW_REVIEWERS: `a:${codeVerifier(CODE_1)},b:plain-code` },
      { MT_WOLF_PREVIEW_REVIEWERS: `a:${CODE_1}` },
    ]) {
      expect({ broken, config: previewConfig(env(broken)) }).toEqual({ broken, config: null })
    }
  })
})

describe('review codes', () => {
  const config = previewConfig(env())!

  it('issues random, well-formed codes', () => {
    expect(CODE_1).toMatch(/^MTW(-[A-HJ-NP-Z2-9]{5}){5}$/)
    expect(new Set(Array.from({ length: 200 }, newReviewCode)).size).toBe(200)
  })

  it('finds the reviewer a code belongs to, forgiving case, spaces and hyphens', () => {
    expect(matchCode(config, CODE_1)?.label).toBe('wolf-reviewer-1')
    expect(matchCode(config, CODE_2)?.label).toBe('wolf-reviewer-2')
    expect(matchCode(config, ` ${CODE_2.toLowerCase().replace(/-/g, ' ')} `)?.label).toBe(
      'wolf-reviewer-2',
    )
    expect(normaliseCode('mtw-ab cd')).toBe('MTWABCD')
  })

  it('refuses anything else, including a verifier or a label typed as a code', () => {
    for (const wrong of [
      '',
      'wolf-reviewer-1',
      codeVerifier(CODE_1),
      codeVerifier(CODE_1).slice(7),
      newReviewCode(),
      `${CODE_1}X`,
      'x'.repeat(5000),
    ]) {
      expect(matchCode(config, wrong)).toBeNull()
    }
  })
})

describe('sessions', () => {
  const config = previewConfig(env())!
  const reviewer = config.reviewers[0]
  const now = Date.UTC(2026, 8, 30, 12)

  it('proves the reviewer for seven days and no longer', () => {
    const { value, maxAge } = issueSession(config, reviewer, now)
    expect(maxAge).toBe(SESSION_SECONDS)
    expect(SESSION_SECONDS).toBe(7 * 24 * 60 * 60)
    expect(verifySession(config, value, now)).toBe('wolf-reviewer-1')
    expect(verifySession(config, value, now + (SESSION_SECONDS - 5) * 1000)).toBe('wolf-reviewer-1')
    expect(verifySession(config, value, now + SESSION_SECONDS * 1000)).toBeNull()
  })

  it('carries no code and no verifier', () => {
    const { value } = issueSession(config, reviewer, now)
    const decoded = Buffer.from(value.split('.')[0], 'base64url').toString('utf8')
    expect(value).not.toContain(normaliseCode(CODE_1))
    expect(decoded).not.toContain(codeVerifier(CODE_1).slice(7))
    expect(decoded).not.toContain(SECRET)
  })

  it('refuses a tampered, forged, reshaped or missing cookie', () => {
    const { value } = issueSession(config, reviewer, now)
    const [body, signature] = value.split('.')
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    const forged = Buffer.from(JSON.stringify({ ...payload, l: 'wolf-reviewer-2' })).toString(
      'base64url',
    )
    const longer = Buffer.from(
      JSON.stringify({ ...payload, exp: payload.exp + 30 * 24 * 3600 }),
    ).toString('base64url')
    for (const bad of [
      undefined,
      '',
      body,
      `${forged}.${signature}`,
      `${longer}.${signature}`,
      `${body}.${signature.slice(0, -2)}AA`,
      `${body}.${signature}.extra`,
      `${body}.!!!`,
    ]) {
      expect(verifySession(config, bad, now)).toBeNull()
    }
    const otherSecret = previewConfig(env({ MT_WOLF_PREVIEW_SESSION_SECRET: 'y'.repeat(40) }))!
    expect(verifySession(otherSecret, value, now)).toBeNull()
    expect(verifySession(null, value, now)).toBeNull()
  })

  it('ends a reviewer’s sessions when the code is revoked or re-issued', () => {
    const { value } = issueSession(config, reviewer, now)
    const revoked = previewConfig(
      env({ MT_WOLF_PREVIEW_REVIEWERS: `wolf-reviewer-2:${codeVerifier(CODE_2)}` }),
    )!
    expect(verifySession(revoked, value, now)).toBeNull()
    const reissued = previewConfig(
      env({ MT_WOLF_PREVIEW_REVIEWERS: `wolf-reviewer-1:${codeVerifier(newReviewCode())}` }),
    )!
    expect(verifySession(reissued, value, now)).toBeNull()
  })

  it('names a Secure, host-only, HttpOnly cookie in production', () => {
    expect(sessionCookie({ NODE_ENV: 'production' })).toEqual({
      name: '__Host-mt-wolf-preview',
      options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    })
    expect(sessionCookie({ NODE_ENV: 'development' }).options.secure).toBe(false)
  })
})

describe('attempts', () => {
  beforeEach(() => resetAttempts())

  it('stops a client after ten failures for fifteen minutes', () => {
    const now = Date.now()
    for (let index = 0; index < 10; index += 1) {
      expect(mayAttempt('198.51.100.7', now)).toBe(true)
      recordFailure('198.51.100.7', now)
    }
    expect(mayAttempt('198.51.100.7', now)).toBe(false)
    expect(mayAttempt('203.0.113.9', now)).toBe(true)
    expect(mayAttempt('198.51.100.7', now + 15 * 60 * 1000)).toBe(true)
  })

  it('stops everyone after two hundred failures in the window', () => {
    const now = Date.now()
    for (let index = 0; index < 200; index += 1) recordFailure(`client-${index}`, now)
    expect(mayAttempt('fresh-client', now)).toBe(false)
  })
})
