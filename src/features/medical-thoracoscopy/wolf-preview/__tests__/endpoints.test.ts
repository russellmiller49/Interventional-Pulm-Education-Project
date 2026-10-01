/** @jest-environment node */
import { createHash } from 'node:crypto'

import { NextRequest } from 'next/server'

const MODEL_BYTES = Buffer.from('glTF-test-model-bytes')
const PAGE_BYTES = Buffer.from('<!doctype html><title>viewer</title>')
const VIDEO_BYTES = Buffer.from(Array.from({ length: 100 }, (_, index) => index))
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
jest.mock('@/features/medical-thoracoscopy/wolf-preview/server/demoManifest', () => ({
  wolfPreviewDemoAssets: {
    bucket: 'demo-bucket',
    prefix: 'v1',
    groups: {
      hub: {
        'cards/device-explorer.jpg': { object: 'card.000000000000.jpg', bytes: 0, sha256: '' },
      },
      'pleural-model-progress': {
        'index.html': { object: 'index.0123456789ab.html', bytes: 0, sha256: '' },
        'media/demo.mp4': { object: 'demo.0123456789ab.mp4', bytes: 0, sha256: '' },
      },
    },
  },
}))
jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    storage: {
      from: (bucket: string) => ({
        download: async (objectPath: string) => {
          storage.calls.push(`${bucket}:${objectPath}`)
          const bytes = storage.objects.get(`${bucket}:${objectPath}`)
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
import { GET as file } from '@/app/api/medical-thoracoscopy/wolf-preview/files/[group]/[...path]/route'
import { GET as model } from '@/app/api/medical-thoracoscopy/wolf-preview/models/[file]/route'
import { wolfPreviewAssets } from '../server/assetManifest'
import { wolfPreviewDemoAssets } from '../server/demoManifest'
import {
  codeVerifier,
  issueSession,
  newReviewCode,
  previewConfig,
  resetAttempts,
} from '../server/access'
import { byteRange, forgetPreviewFiles } from '../server/files'
import { forgetModels } from '../server/models'

/**
 * The preview's endpoints: sign-in, end, the model endpoint and the file endpoint that serve the
 * private bytes.
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

function signInRequest(
  code: string,
  headers: Record<string, string> = {},
  fields: Record<string, string> = {},
) {
  const body = new URLSearchParams({ code, locale: 'en', ...fields })
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

function fileRequest(group: string, path: string[], cookie?: string, range?: string) {
  return file(
    new NextRequest(
      `${ORIGIN}/api/medical-thoracoscopy/wolf-preview/files/${group}/${path.join('/')}`,
      { headers: { ...(cookie ? { cookie } : {}), ...(range ? { range } : {}) } },
    ),
    { params: Promise.resolve({ group, path }) },
  )
}

type Entry = { object: string; sha256: string; bytes: number }
function stage(entry: Entry, bytes: Buffer, bucket: string, objectPath: string) {
  entry.sha256 = createHash('sha256').update(bytes).digest('hex')
  entry.bytes = bytes.length
  storage.objects.set(`${bucket}:${objectPath}`, bytes)
}

beforeEach(() => {
  enable()
  resetAttempts()
  forgetModels()
  forgetPreviewFiles()
  storage.objects.clear()
  storage.calls = []
  const models = wolfPreviewAssets.models as Record<string, Entry>
  stage(models.probe, MODEL_BYTES, 'test-bucket', 'device-explorer/v1/probe.0123456789ab.glb')
  const demo = wolfPreviewDemoAssets.groups['pleural-model-progress'] as Record<string, Entry>
  stage(demo['index.html'], PAGE_BYTES, 'demo-bucket', 'v1/index.0123456789ab.html')
  stage(demo['media/demo.mp4'], VIDEO_BYTES, 'demo-bucket', 'v1/demo.0123456789ab.mp4')
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

  it('returns to the page the code screen was on, and to the hub for anything else', async () => {
    const back = await signIn(signInRequest(CODE, {}, { item: 'pleural-model-progress' }))
    expect(back.headers.get('location')).toBe(
      '/en/medical-thoracoscopy/wolf-preview/pleural-model-progress',
    )
    expect(back.headers.get('set-cookie')).toMatch(/^mt-wolf-preview=/)
    const denied = await signIn(signInRequest('wrong-code', {}, { item: 'device-explorer' }))
    expect(denied.headers.get('location')).toBe(
      '/en/medical-thoracoscopy/wolf-preview/device-explorer?review=denied',
    )
    for (const item of ['https://elsewhere.test', '//elsewhere.test', '../admin', 'hub', '']) {
      const response = await signIn(signInRequest(CODE, {}, { item }))
      expect({ item, location: response.headers.get('location') }).toEqual({
        item,
        location: '/en/medical-thoracoscopy/wolf-preview',
      })
    }
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
    expect(storage.calls).toEqual(['test-bucket:device-explorer/v1/probe.0123456789ab.glb'])
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
      'test-bucket:device-explorer/v1/probe.0123456789ab.glb',
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

describe('files', () => {
  const cookie = () => `mt-wolf-preview=${sessionCookieValue()}`

  it('refuses a request without a valid session, before touching storage', async () => {
    for (const value of [undefined, 'mt-wolf-preview=forged.value', 'other=1']) {
      const response = await fileRequest('pleural-model-progress', ['index.html'], value)
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toContain('no-store')
    }
    expect(storage.calls).toEqual([])
  })

  it('serves a listed file to a signed-in reviewer from the demonstrations’ bucket, uncached', async () => {
    const response = await fileRequest('pleural-model-progress', ['index.html'], cookie())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PAGE_BYTES)
    expect(storage.calls).toEqual(['demo-bucket:v1/index.0123456789ab.html'])
    // Read once, then served from the verified copy.
    await fileRequest('pleural-model-progress', ['index.html'], cookie())
    expect(storage.calls).toHaveLength(1)
  })

  it('serves a video in the byte ranges a browser asks for', async () => {
    const path = ['media', 'demo.mp4']
    const part = await fileRequest('pleural-model-progress', path, cookie(), 'bytes=10-19')
    expect(part.status).toBe(206)
    expect(part.headers.get('content-type')).toBe('video/mp4')
    expect(part.headers.get('content-range')).toBe('bytes 10-19/100')
    expect(part.headers.get('content-length')).toBe('10')
    expect([...Buffer.from(await part.arrayBuffer())]).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ])
    const open = await fileRequest('pleural-model-progress', path, cookie(), 'bytes=90-')
    expect(open.headers.get('content-range')).toBe('bytes 90-99/100')
    const past = await fileRequest('pleural-model-progress', path, cookie(), 'bytes=100-')
    expect(past.status).toBe(416)
    expect(past.headers.get('content-range')).toBe('bytes */100')
    const whole = await fileRequest('pleural-model-progress', path, cookie(), 'bytes=1-2,4-5')
    expect(whole.status).toBe(200)
    expect(storage.calls).toHaveLength(1)
  })

  it('serves nothing that is not on the manifest, whatever the name', async () => {
    for (const [group, path] of [
      ['pleural-model-progress', ['unknown.html']],
      ['pleural-model-progress', ['index.0123456789ab.html']],
      ['pleural-model-progress', ['README.md']],
      ['pleural-model-progress', ['..', 'index.html']],
      ['pleural-model-progress', ['..%2Findex.html']],
      ['pleural-model-progress', ['media', '..', 'index.html']],
      ['pleural-model-progress', ['v1', 'demo.0123456789ab.mp4']],
      ['pleural-model-progress', ['INDEX.HTML']],
      ['pleural-model-progress', []],
      ['portable-trainer-concept', ['index.html']],
      ['hub', ['index.html']],
      ['device-explorer', ['index.html']],
      ['__proto__', ['index.html']],
      ['constructor', ['index.html']],
      ['pleural-model-progress', ['constructor']],
      ['pleural-model-progress', ['__proto__']],
    ] as [string, string[]][]) {
      const response = await fileRequest(group, path, cookie())
      expect({ group, path, status: response.status }).toEqual({ group, path, status: 404 })
    }
    expect(storage.calls).toEqual([])
  })

  it('refuses bytes that do not match the manifest, and a store that is down', async () => {
    storage.objects.set(
      'demo-bucket:v1/index.0123456789ab.html',
      Buffer.from('tampered page bytes'),
    )
    expect((await fileRequest('pleural-model-progress', ['index.html'], cookie())).status).toBe(503)
    storage.objects.clear()
    expect((await fileRequest('pleural-model-progress', ['index.html'], cookie())).status).toBe(503)
  })

  it('is not found while the preview is off, even with a session', async () => {
    const value = cookie()
    variables.MT_WOLF_PREVIEW_ENABLED = 'false'
    expect((await fileRequest('pleural-model-progress', ['index.html'], value)).status).toBe(404)
  })
})

describe('byte ranges', () => {
  it('reads one range, a suffix and an open end; ignores what it cannot honour', () => {
    expect(byteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 })
    expect(byteRange('bytes=95-200', 100)).toEqual({ start: 95, end: 99 })
    expect(byteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(byteRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 })
    expect(byteRange('bytes=50-', 100)).toEqual({ start: 50, end: 99 })
    expect(byteRange('bytes=100-', 100)).toBe('unsatisfiable')
    expect(byteRange('bytes=-0', 100)).toBe('unsatisfiable')
    for (const header of [null, '', 'bytes=-', 'bytes=9-1', 'items=0-1', 'bytes=0-1,3-4']) {
      expect(byteRange(header, 100)).toBeNull()
    }
  })
})
