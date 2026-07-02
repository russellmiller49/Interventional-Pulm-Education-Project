import {
  buildFrameProviders,
  caseGroundTruthKey,
  resolveFrameFromProviders,
} from '../providers/useBModeFrame'
import type { BModeFrameRequest } from '../providers/types'
import { installImageDataPolyfill } from '../testSupport/imageDataPolyfill'
import { makeAtlasEntry, makeManifest, makeTestVolume, testProbe } from '../testSupport/fixtures'

installImageDataPolyfill()

function makeRequest(overrides: Partial<BModeFrameRequest> = {}): BModeFrameRequest {
  return {
    manifest: makeManifest(),
    volume: null,
    probe: testProbe,
    width: 48,
    height: 60,
    ...overrides,
  }
}

function mockFetch(handler: (url: string) => unknown) {
  const fetchMock = jest.fn(async (url: string) => handler(url))
  ;(globalThis as { fetch?: unknown }).fetch = fetchMock
  return fetchMock
}

describe('frame provider stack', () => {
  it('prefers the reviewed atlas when a pose matches', async () => {
    mockFetch(() => ({ ok: false, status: 404 }))
    const request = makeRequest()
    const frame = await resolveFrameFromProviders(buildFrameProviders(request.manifest), request)

    expect(frame?.kind).toBe('reviewed-atlas')
    expect(frame?.quality).toBe('reviewed')
    expect(frame?.imageUrl).toBe('/assets/frame-atlas/best-window.svg')
    expect(frame?.metrics).toEqual(makeAtlasEntry().metrics)
  })

  it('falls back to the pose-indexed offline set when the embedded atlas misses', async () => {
    const offsetProbe = { ...testProbe, lateralMm: testProbe.lateralMm + 200 }
    mockFetch((url) =>
      url === '/assets/frames/frames.json'
        ? {
            ok: true,
            json: async () => ({
              selectionTolerance: {},
              entries: [
                makeAtlasEntry({ id: 'offline', probe: offsetProbe, imageUrl: 'offline.png' }),
              ],
            }),
          }
        : { ok: false, status: 404 },
    )

    const request = makeRequest({ probe: offsetProbe })
    const frame = await resolveFrameFromProviders(buildFrameProviders(request.manifest), request)

    expect(frame?.kind).toBe('plus-atlas')
    expect(frame?.imageUrl).toBe('/assets/frames/offline.png')
  })

  it('skips needs-review offline entries', async () => {
    const offsetProbe = { ...testProbe, lateralMm: testProbe.lateralMm + 200 }
    mockFetch((url) =>
      url === '/assets/frames/frames.json'
        ? {
            ok: true,
            json: async () => ({
              selectionTolerance: {},
              entries: [
                makeAtlasEntry({
                  id: 'unreviewed',
                  probe: offsetProbe,
                  reviewStatus: 'needs-review',
                }),
              ],
            }),
          }
        : { ok: false, status: 404 },
    )

    const request = makeRequest({ probe: offsetProbe, volume: makeTestVolume().volume })
    const frame = await resolveFrameFromProviders(buildFrameProviders(request.manifest), request)

    expect(frame?.kind).toBe('placeholder')
  })

  it('SAFETY: never shows the browser render while quality status is prototype', async () => {
    mockFetch(() => ({ ok: false, status: 404 }))
    const offsetProbe = { ...testProbe, lateralMm: testProbe.lateralMm + 200 }
    const request = makeRequest({
      probe: offsetProbe,
      volume: makeTestVolume().volume,
    })

    expect(request.manifest.qualityStatus.browserRaymarch).toBe('prototype')
    const frame = await resolveFrameFromProviders(buildFrameProviders(request.manifest), request)

    expect(frame?.kind).toBe('placeholder')
    expect(frame?.imageData).toBeUndefined()
    expect(frame?.imageUrl).toBeUndefined()
  })

  it('shows the browser render only once the manifest marks it acceptable', async () => {
    mockFetch(() => ({ ok: false, status: 404 }))
    const offsetProbe = { ...testProbe, lateralMm: testProbe.lateralMm + 200 }
    const manifest = makeManifest({
      qualityStatus: { overall: 'mixed', browserRaymarch: 'acceptable', atlas: 'reviewed' },
    })
    const { volume, setCode } = makeTestVolume()
    setCode(2, 40, 2, 7)

    const request = makeRequest({ manifest, probe: offsetProbe, volume })
    const frame = await resolveFrameFromProviders(buildFrameProviders(manifest), request)

    expect(frame?.kind).toBe('browser-raymarch')
    expect(frame?.imageData).toBeDefined()
    expect(frame?.metrics).toBeDefined()
    expect(frame?.educationalUse).toMatch(/educational simulation only/i)
  })

  it('always terminates with the placeholder even without one in the manifest', async () => {
    mockFetch(() => ({ ok: false, status: 404 }))
    const manifest = makeManifest({
      frameAtlas: undefined,
      frameSources: [
        { id: 'browser-raymarch', kind: 'browser-raymarch', status: 'prototype', priority: 0 },
      ],
    })

    const frame = await resolveFrameFromProviders(
      buildFrameProviders(manifest),
      makeRequest({ manifest }),
    )
    expect(frame?.kind).toBe('placeholder')
  })

  it('exposes the hidden case ground truth for scoring only', () => {
    expect(caseGroundTruthKey(makeManifest())).toBe('simpleAnechoic')
    expect(caseGroundTruthKey(makeManifest({ learningTasks: [] }))).toBeNull()
    expect(caseGroundTruthKey(null)).toBeNull()
  })
})
