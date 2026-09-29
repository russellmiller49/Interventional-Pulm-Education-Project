/** @jest-environment node */
import { createHash } from 'node:crypto'

import { NextRequest } from 'next/server'

const MODEL_BYTES = Buffer.from('glTF-test-model-bytes')
const storage = { objects: new Map<string, Buffer>(), calls: [] as string[] }

jest.mock('@/features/medical-thoracoscopy/wolf-preview/server/assetManifest', () => ({
  wolfPreviewAssets: {
    bucket: 'test-bucket',
    prefix: 'device-explorer/v1',
    models: {
      probe: {
        object: 'probe.0123456789ab.glb',
        bytes: 21,
        sha256: 'placeholder',
      },
    },
  },
}))
jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        download: async (objectPath: string) => {
          storage.calls.push(objectPath)
          const bytes = storage.objects.get(objectPath)
          return bytes
            ? { data: new Blob([new Uint8Array(bytes)]), error: null }
            : { data: null, error: new Error('missing') }
        },
      }),
    },
  }),
}))

import { POST as signIn } from '@/app/api/medical-thoracoscopy/wolf-preview/session/route'
import { POST as signOut } from '@/app/api/medical-thoracoscopy/wolf-preview/session/end/route'
import { GET as model } from '@/app/api/medical-thoracoscopy/wolf-preview/models/[file]/route'
import { wolfPreviewAssets } from '../server/assetManifest'
import {
  codeVerifier,
  issueSession,
  newReviewCode,
  previewConfig,
  resetAttempts,
} from '../server/access'
import { forgetModels } from '../server/models'

/**
 * The preview's endpoints: sign-in, end, and the model endpoint that serves the private bytes.
 */
const CODE = newReviewCode()
const variables = process.env as Record<string, string | undefined>
const saved = { ...variables }
const ORIGIN = 'https://preview.test'

function enable() {
  variables.MT_WOLF_PREVIEW_ENABLED = 'true'
  variables.MT_WOLF_PREVIEW_SESSION_SECRET = 'z'.repeat(48)
  variables.MT_WOLF_PREVIEW_REVIEWERS = `wolf-reviewer-1:${codeVerifier(CODE)}`
}

function signInRequest(code: string, headers: Record<string, string> = {}) {
  const body = new URLSearchParams({ code, locale: 'en' })
  return new Request(`${ORIGIN}/api/medical-thoracoscopy/wolf-preview/session`, {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: ORIGIN,
      host: 'preview.test',
      'x-forwarded-for': '198.51.100.20',
      ...headers,
    },
  })
}

function sessionCookieValue() {
  const config = previewConfig()!
  return issueSession(config, config.reviewers[0]).value
}

function modelRequest(file: string, cookie?: string) {
  return model(
    new NextRequest(`${ORIGIN}/api/medical-thoracoscopy/wolf-preview/models/${file}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ file }) },
  )
}

beforeEach(() => {
  enable()
  resetAttempts()
  forgetModels()
  storage.objects.clear()
  storage.calls = []
  const entry = (wolfPreviewAssets.models as Record<string, { sha256: string; bytes: number }>)
    .probe
  entry.sha256 = createHash('sha256').update(MODEL_BYTES).digest('hex')
  entry.bytes = MODEL_BYTES.length
  storage.objects.set('device-explorer/v1/probe.0123456789ab.glb', MODEL_BYTES)
})

afterAll(() => {
  for (const key of Object.keys(variables)) if (!(key in saved)) delete variables[key]
  Object.assign(variables, saved)
})

describe('sign in', () => {
  it('sets a signed HttpOnly session cookie for a correct code and returns to the preview', async () => {
    const response = await signIn(signInRequest(CODE))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/en/medical-thoracoscopy/wolf-preview')
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^mt-wolf-preview=[^;]+/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/Max-Age=604800/)
    expect(cookie).not.toContain(CODE)
  })

  it('answers a wrong code with one generic state and no cookie', async () => {
    for (const code of ['', 'wolf-reviewer-1', newReviewCode(), codeVerifier(CODE)]) {
      const response = await signIn(signInRequest(code))
      expect(response.headers.get('location')).toBe(
        '/en/medical-thoracoscopy/wolf-preview?review=denied',
      )
      expect(response.headers.get('set-cookie')).toBeNull()
    }
  })

  it('stops rapid guessing, even of the right code', async () => {
    for (let index = 0; index < 10; index += 1) await signIn(signInRequest(newReviewCode()))
    const response = await signIn(signInRequest(CODE))
    expect(response.headers.get('location')).toBe(
      '/en/medical-thoracoscopy/wolf-preview?review=limited',
    )
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('refuses a post from another site', async () => {
    const response = await signIn(signInRequest(CODE, { origin: 'https://elsewhere.test' }))
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('accepts an opaque origin only when the browser says the post is same-origin', async () => {
    const opaque = await signIn(
      signInRequest(CODE, { origin: 'null', 'sec-fetch-site': 'same-origin' }),
    )
    expect(opaque.headers.get('set-cookie')).toMatch(/^mt-wolf-preview=/)
    for (const site of ['cross-site', 'same-site']) {
      const refused = await signIn(signInRequest(CODE, { origin: 'null', 'sec-fetch-site': site }))
      expect(refused.status).toBe(403)
    }
    expect((await signIn(signInRequest(CODE, { origin: 'null' }))).status).toBe(403)
  })

  it('is not found while the preview is off', async () => {
    variables.MT_WOLF_PREVIEW_ENABLED = 'false'
    expect((await signIn(signInRequest(CODE))).status).toBe(404)
  })

  it('marks the cookie Secure and host-only in production', async () => {
    variables.NODE_ENV = 'production'
    try {
      const cookie = (await signIn(signInRequest(CODE))).headers.get('set-cookie') ?? ''
      expect(cookie).toMatch(/^__Host-mt-wolf-preview=/)
      expect(cookie).toMatch(/Secure/)
    } finally {
      variables.NODE_ENV = 'test'
    }
  })
})

describe('end preview', () => {
  it('clears the session cookie', async () => {
    const response = await signOut(
      new Request(`${ORIGIN}/api/medical-thoracoscopy/wolf-preview/session/end`, {
        method: 'POST',
        body: new URLSearchParams({ locale: 'es' }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: ORIGIN,
          host: 'preview.test',
        },
      }),
    )
    expect(response.headers.get('location')).toBe(
      '/es/medical-thoracoscopy/wolf-preview?review=ended',
    )
    expect(response.headers.get('set-cookie')).toMatch(/^mt-wolf-preview=;.*Max-Age=0/i)
  })
})

describe('models', () => {
  it('refuses a request without a valid session, before touching storage', async () => {
    for (const cookie of [undefined, 'mt-wolf-preview=forged.value', 'other=1']) {
      const response = await modelRequest('probe.glb', cookie)
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toContain('no-store')
    }
    expect(storage.calls).toEqual([])
  })

  it('serves a listed model to a signed-in reviewer, uncached', async () => {
    const response = await modelRequest('probe.glb', `mt-wolf-preview=${sessionCookieValue()}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('model/gltf-binary')
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(MODEL_BYTES)
    expect(storage.calls).toEqual(['device-explorer/v1/probe.0123456789ab.glb'])
  })

  it('serves nothing that is not on the manifest, whatever the name', async () => {
    const cookie = `mt-wolf-preview=${sessionCookieValue()}`
    for (const file of [
      'unknown.glb',
      'probe.0123456789ab.glb',
      'probe',
      'probe.GLB',
      '../probe.glb',
      '..%2Fprobe.glb',
      'device-explorer%2Fv1%2Fprobe.0123456789ab.glb',
      'frame-02.png',
      'comparison-sheet.jpg',
      'manifest.json',
      'constructor.glb',
      '__proto__.glb',
    ]) {
      expect({ file, status: (await modelRequest(file, cookie)).status }).toEqual({
        file,
        status: 404,
      })
    }
    expect(storage.calls).toEqual([])
  })

  it('refuses bytes that do not match the manifest, and a store that is down', async () => {
    const cookie = `mt-wolf-preview=${sessionCookieValue()}`
    storage.objects.set(
      'device-explorer/v1/probe.0123456789ab.glb',
      Buffer.from('tampered-bytes!!!!!!!'),
    )
    expect((await modelRequest('probe.glb', cookie)).status).toBe(503)
    storage.objects.clear()
    expect((await modelRequest('probe.glb', cookie)).status).toBe(503)
  })

  it('is not found while the preview is off, even with a session', async () => {
    const cookie = `mt-wolf-preview=${sessionCookieValue()}`
    variables.MT_WOLF_PREVIEW_ENABLED = 'false'
    expect((await modelRequest('probe.glb', cookie)).status).toBe(404)
  })
})
