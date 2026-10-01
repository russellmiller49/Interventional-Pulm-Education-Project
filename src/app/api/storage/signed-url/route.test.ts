/** @jest-environment node */
import { SIGNABLE_BUCKETS } from '@/lib/storage/signable-buckets'

import { GET } from './route'

/**
 * The generic signer signs with the service key and needs no sign-in, so it may sign only for the
 * buckets its callers use, never climb out of a bucket, and never send the key to a project the
 * caller names.
 */
const variables = process.env as Record<string, string | undefined>
const saved = { ...variables }
const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  variables.NEXT_PUBLIC_SUPABASE_URL = 'https://configured.supabase.test'
  variables.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return new Response(JSON.stringify({ signedURL: '/storage/v1/object/sign/x?token=t' }), {
      status: 200,
    })
  }) as typeof fetch
})

afterAll(() => {
  for (const key of Object.keys(variables)) if (!(key in saved)) delete variables[key]
  Object.assign(variables, saved)
})

const sign = (query: Record<string, string>) =>
  GET(new Request(`https://site.test/api/storage/signed-url?${new URLSearchParams(query)}`))

describe('generic signed-url route', () => {
  it('still signs for the buckets its callers use', async () => {
    for (const bucket of SIGNABLE_BUCKETS) {
      const response = await sign({ bucket, path: 'folder/file.mp3' })
      expect(response.status).toBe(200)
      expect((await response.json()).url).toMatch(/^https:\/\/configured\.supabase\.test\//)
    }
    expect(calls).toHaveLength(SIGNABLE_BUCKETS.size)
    expect(calls[0]).toBe(
      'https://configured.supabase.test/storage/v1/object/sign/Audio_companion/folder/file.mp3',
    )
  })

  it('refuses every other bucket without calling storage', async () => {
    for (const bucket of [
      'mt-wolf-preview',
      'library-pdfs',
      'pocus-media',
      'module-beta-feedback',
      '3D-MODELS',
      'module-assets/../mt-wolf-preview',
    ]) {
      const response = await sign({ bucket, path: 'device-explorer/v1/probe.glb' })
      expect({ bucket, status: response.status }).toEqual({ bucket, status: 404 })
    }
    expect(calls).toEqual([])
  })

  it('refuses a path that climbs out of its bucket', async () => {
    for (const path of [
      '../mt-wolf-preview/device-explorer/v1/probe.glb',
      'a/../../mt-wolf-preview/x.glb',
      './x',
      'a/%2e%2e/b',
      'a%2Fb',
      'a\\\\..\\\\b',
    ]) {
      expect({ path, status: (await sign({ bucket: '3d-models', path })).status }).toEqual({
        path,
        status: 404,
      })
    }
    expect(calls).toEqual([])
  })

  it('never sends the key to a project the caller names', async () => {
    delete variables.NEXT_PUBLIC_SUPABASE_URL
    delete variables.SUPABASE_URL
    variables.NEXT_PUBLIC_SUPABASE_PROJECT_REF = 'configuredref'
    await sign({ bucket: '3d-models', path: 'a.stl', projectRef: 'attackerref' })
    expect(calls).toEqual([
      'https://configuredref.supabase.co/storage/v1/object/sign/3d-models/a.stl',
    ])
  })
})
