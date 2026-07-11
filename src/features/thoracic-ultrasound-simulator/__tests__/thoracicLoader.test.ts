import fs from 'node:fs'
import path from 'node:path'

import { adaptPleuralV1, isLegacyPleuralCase } from '../loader/adaptPleuralV1'
import {
  buildLabelResolver,
  buildThoracicVolume,
  loadThoracicCase,
  normalizeThoracicManifest,
} from '../loader/loadThoracicCase'
import { matchMeshNamesToStructures, structureForMeshName } from '../loader/meshNaming'
import { validateThoracicManifest } from '../loader/validateManifest'
import { makeManifest, testLabelCodes } from '../testSupport/fixtures'

const realCasePath = path.join(
  process.cwd(),
  'public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001/case.json',
)

function loadRealLegacyCase() {
  return JSON.parse(fs.readFileSync(realCasePath, 'utf8'))
}

describe('manifest v2 validation', () => {
  it('accepts the synthetic v2 fixture', () => {
    const result = validateThoracicManifest(makeManifest())
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('collects errors for missing essentials', () => {
    const result = validateThoracicManifest({ schemaVersion: 2 })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/id is required/)
    expect(result.errors.join(' ')).toMatch(/safetyLabel is required/)
    expect(result.errors.join(' ')).toMatch(/primaryLabelVolume/)
    expect(result.errors.join(' ')).toMatch(/frameSources/)
  })

  it('requires an indexUrl on plus-atlas sources and a known raymarch quality', () => {
    const manifest = makeManifest()
    const broken = {
      ...manifest,
      frameSources: [{ id: 'plus', kind: 'plus-atlas', status: 'reviewed', priority: 0 }],
      qualityStatus: { ...manifest.qualityStatus, browserRaymarch: 'placeholder' },
    }
    const result = validateThoracicManifest(broken)
    expect(result.errors.join(' ')).toMatch(/indexUrl/)
    expect(result.errors.join(' ')).toMatch(/browserRaymarch/)
  })
})

describe('v1 -> v2 adapter over the real on-disk case', () => {
  it('detects the legacy manifest shape', () => {
    expect(isLegacyPleuralCase(loadRealLegacyCase())).toBe(true)
    expect(isLegacyPleuralCase(makeManifest())).toBe(false)
  })

  it('adapts the shipped case.json into a valid v2 manifest without touching the file', () => {
    const legacy = loadRealLegacyCase()
    const manifest = adaptPleuralV1(legacy, { manifestUrl: '/module-assets/case.json' })

    const validation = validateThoracicManifest(manifest)
    expect(validation.errors).toEqual([])

    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.id).toBe(legacy.id)
    expect(manifest.primaryLabelVolume.url).toBe(legacy.labelmapUrl)
    expect(manifest.primaryLabelVolume.labelCodes['7']).toBe('pleuralFluid')
    expect(manifest.cardiacModel?.kind).toBe('parametric-cardiac-v1')
    expect(manifest.supportedApplications).toContain('cardiac')

    const fluid = manifest.structures.find((structure) => structure.label === 'pleuralFluid')
    expect(fluid?.code).toBe(7)
    expect(fluid?.category).toBe('fluid')
    expect(fluid?.boundsLpsMm).toEqual(legacy.labelBoundsLpsMm.pleuralFluid)

    for (const hazard of ['rib', 'diaphragm', 'liver', 'spleen']) {
      expect(manifest.structures.find((structure) => structure.label === hazard)?.hazard).toBe(true)
    }
  })

  it('enables the live render first, with cached frames as fallback', () => {
    const manifest = adaptPleuralV1(loadRealLegacyCase(), {
      manifestUrl: '/module-assets/case.json',
    })

    // The adapter marks the live render displayable; the provider still
    // enforces this gate at resolve time for any case left at 'prototype'.
    expect(manifest.qualityStatus.browserRaymarch).toBe('acceptable')

    const kindsByPriority = [...manifest.frameSources]
      .sort((a, b) => a.priority - b.priority)
      .map((source) => source.kind)
    expect(kindsByPriority).toEqual([
      'browser-raymarch',
      'reviewed-atlas',
      'plus-atlas',
      'placeholder',
    ])
    expect(manifest.frameSources.find((source) => source.kind === 'browser-raymarch')?.status).toBe(
      'acceptable',
    )
    expect(manifest.frameSources.find((source) => source.kind === 'plus-atlas')?.indexUrl).toBe(
      '/module-assets/frames/frames.json',
    )
  })

  it('maps atlas ground truth and hides the case answer in a classify task', () => {
    const legacy = loadRealLegacyCase()
    const manifest = adaptPleuralV1(legacy)

    expect(manifest.frameAtlas?.entries[0].groundTruthKey).toBe(
      legacy.frameAtlas.entries[0].groundTruthPattern,
    )

    const classifyTask = manifest.learningTasks.find((task) => task.kind === 'classify-pattern')
    expect(classifyTask?.hiddenGroundTruth).toBe(legacy.groundTruthPattern)
    expect(classifyTask?.prompt).not.toContain(legacy.groundTruthPattern)
  })

  it('derives probe control ranges from the fluid and skin bounds', () => {
    const legacy = loadRealLegacyCase()
    const manifest = adaptPleuralV1(legacy)
    const preset = manifest.probePresets[0]

    expect(manifest.defaultProbePresetId).toBe(preset.id)
    // The adapter now seeds the circumferential approach angle (0 = the legacy
    // posterior approach) so the probe can also reach anterior windows.
    expect(preset.defaults).toEqual({ ...legacy.probeDefaults, approachDeg: 0 })
    expect(preset.ranges.approachDeg).toEqual({ min: -180, max: 180, step: 5 })
    expect(preset.ranges.lateralMm?.min).toBe(
      Math.floor(legacy.labelBoundsLpsMm.pleuralFluid.min[0] - 50),
    )
    expect(preset.ranges.posteriorMm?.max).toBe(Math.ceil(legacy.labelBoundsLpsMm.skin.max[1] + 18))
  })
})

describe('mesh naming', () => {
  const structures = adaptPleuralV1(loadRealLegacyCase()).structures
  const glbMeshNames = [
    'aorta',
    'bone',
    'diaphragm ',
    'left pleural effusion',
    'liver',
    'lower lobe of left lung',
    'muscle',
    'right pleural effusion',
    'skin',
    'spine',
    'spleen',
    'stomach',
  ]

  it('matches anatomical mesh names (including trailing spaces) to structures', () => {
    expect(structureForMeshName('diaphragm ', structures)?.label).toBe('diaphragm')
    expect(structureForMeshName('left pleural effusion', structures)?.label).toBe('pleuralFluid')
    expect(structureForMeshName('bone', structures)?.label).toBe('rib')
    // The full-anatomy case exposes abdominal organs and distinguishes the
    // spine from the rib cage as its own structure.
    expect(structureForMeshName('stomach', structures)?.label).toBe('stomach')
    expect(structureForMeshName('spine', structures)?.label).toBe('spine')
    expect(structureForMeshName('superior vena cava', structures)?.label).toBe('venaCava')
    expect(structureForMeshName('unrelated widget', structures)).toBeNull()
  })

  it('fills structure meshNames from a GLB node list', () => {
    const matched = matchMeshNamesToStructures(structures, glbMeshNames)
    const fluid = matched.find((structure) => structure.label === 'pleuralFluid')
    expect(fluid?.meshNames).toEqual(['left pleural effusion', 'right pleural effusion'])
    const rib = matched.find((structure) => structure.label === 'rib')
    expect(rib?.meshNames).toEqual(['bone'])
    const spine = matched.find((structure) => structure.label === 'spine')
    expect(spine?.meshNames).toEqual(['spine'])
  })
})

describe('runtime volume construction', () => {
  it('builds a dense resolver with background fallback', () => {
    const resolve = buildLabelResolver(testLabelCodes)
    expect(resolve(7)).toBe('pleuralFluid')
    expect(resolve(4)).toBe('rib')
    expect(resolve(99)).toBe('background')
    expect(resolve(-1)).toBe('background')
  })

  it('rejects labelmaps whose length disagrees with the geometry', () => {
    const spec = makeManifest().primaryLabelVolume
    expect(() => buildThoracicVolume(new Uint8Array(10), spec)).toThrow(/byte length/)

    const volume = buildThoracicVolume(new Uint8Array(5 * 80 * 5), spec)
    expect(volume.resolveLabel(7)).toBe('pleuralFluid')
  })
})

describe('loadThoracicCase', () => {
  it('normalizes v2 manifests and adapts legacy v1 manifests', () => {
    expect(normalizeThoracicManifest(makeManifest()).schemaVersion).toBe(2)
    expect(normalizeThoracicManifest(loadRealLegacyCase()).schemaVersion).toBe(2)
    expect(() => normalizeThoracicManifest({ foo: 'bar' })).toThrow(/Unrecognized case manifest/)
  })

  it('fetches manifest and labelmap and builds the runtime volume', async () => {
    const manifest = makeManifest()
    const bytes = new Uint8Array(5 * 80 * 5)
    bytes[0] = 7

    const fetchImpl = jest.fn(async (url: string) => {
      if (url === '/case.json') {
        return { ok: true, json: async () => manifest } as unknown as Response
      }
      if (url === manifest.primaryLabelVolume.url) {
        return { ok: true, arrayBuffer: async () => bytes.buffer } as unknown as Response
      }
      return { ok: false, status: 404 } as unknown as Response
    }) as unknown as typeof fetch

    const loaded = await loadThoracicCase('/case.json', { fetchImpl })
    expect(loaded.manifest.id).toBe('test-case')
    expect(loaded.volume.data[0]).toBe(7)
    expect(loaded.volume.resolveLabel(loaded.volume.data[0])).toBe('pleuralFluid')
    expect(loaded.volume.cardiacModel).toBe(manifest.cardiacModel)
  })

  it('surfaces manifest and labelmap fetch failures', async () => {
    const failManifest = jest.fn(async () => ({
      ok: false,
      status: 503,
    })) as unknown as typeof fetch
    await expect(loadThoracicCase('/case.json', { fetchImpl: failManifest })).rejects.toThrow(/503/)

    const manifest = makeManifest()
    const failLabelmap = jest.fn(async (url: string) =>
      url === '/case.json'
        ? ({ ok: true, json: async () => manifest } as unknown as Response)
        : ({ ok: false, status: 404 } as unknown as Response),
    ) as unknown as typeof fetch
    await expect(loadThoracicCase('/case.json', { fetchImpl: failLabelmap })).rejects.toThrow(/404/)
  })
})
