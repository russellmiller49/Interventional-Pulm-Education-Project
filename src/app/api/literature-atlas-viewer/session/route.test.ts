/** @jest-environment node */
import { pbkdf2Sync, randomBytes } from 'node:crypto'

import {
  resetAttempts,
  verifySession,
  viewerConfig,
} from '@/features/literature-atlas-viewer/server/access'

import { POST as END } from './end/route'
import { GET, POST } from './route'

const PASSWORD = 'INVENTED-viewer-pass'
const salt = randomBytes(16)
const HASH = `pbkdf2_sha256$100000$${salt.toString('hex')}$${pbkdf2Sync(PASSWORD, salt, 100_000, 32, 'sha256').toString('hex')}`
const ENV = {
  LITERATURE_ATLAS_VIEWER_HASH: HASH,
  LITERATURE_ATLAS_VIEWER_SECRET: 'INVENTED-session-secret-for-tests-0123456789',
  LITERATURE_ATLAS_RELAY_SECRET: 'INVENTED-relay-secret-for-tests-0123456789',
}
const HOST = 'www.interventionalpulm.com'

function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request(`https://${HOST}${path}`, {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: {
      host: HOST,
      origin: `https://${HOST}`,
      'x-forwarded-for': '203.0.113.7',
      ...headers,
    },
  })
}

describe('Literature Atlas viewer session', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    Object.assign(process.env, ENV)
    resetAttempts()
  })
  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key]
    Object.assign(process.env, saved)
  })

  it('is not found when the viewer is not configured', async () => {
    delete process.env.LITERATURE_ATLAS_VIEWER_HASH
    const response = await POST(
      post('/api/literature-atlas-viewer/session', { password: PASSWORD }),
    )
    expect(response.status).toBe(404)
  })

  it('refuses a cross-site form', async () => {
    const response = await POST(
      post(
        '/api/literature-atlas-viewer/session',
        { password: PASSWORD },
        { origin: 'https://elsewhere.invented.test' },
      ),
    )
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('returns a generic message and no cookie for a wrong password', async () => {
    const response = await POST(
      post('/api/literature-atlas-viewer/session', { password: 'wrong', locale: 'es' }),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/es/literature-atlas/evidence?viewer=denied')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('sets a signed HttpOnly session for the right password and returns to the page', async () => {
    const response = await POST(
      post('/api/literature-atlas-viewer/session', { password: PASSWORD, locale: 'xx' }),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/en/literature-atlas/evidence')
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^literature-atlas-viewer=v1\./)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).not.toContain(PASSWORD)
    const value = cookie.split(';')[0].split('=').slice(1).join('=')
    expect(verifySession(viewerConfig(), value)).toBe(true)
  })

  it('stops a client after ten wrong passwords, even with the right one', async () => {
    for (let i = 0; i < 10; i++)
      await POST(post('/api/literature-atlas-viewer/session', { password: 'wrong' }))
    const response = await POST(
      post('/api/literature-atlas-viewer/session', { password: PASSWORD }),
    )
    expect(response.headers.get('location')).toBe('/en/literature-atlas/evidence?viewer=limited')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('accepts only POST, and leaving clears the session', async () => {
    expect(GET().status).toBe(405)
    const response = await END(post('/api/literature-atlas-viewer/session/end', { locale: 'en' }))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/en/literature-atlas/evidence?viewer=ended')
    expect(response.headers.get('set-cookie')).toMatch(/literature-atlas-viewer=;.*Max-Age=0/i)
  })
})
