import { findDrrBlendFrames, findNearestDrrFrame, validateFluoroCaseManifest } from './case'
import type { DrrAtlasFrame, FluoroCaseManifest } from './types'

const frames: DrrAtlasFrame[] = [
  { id: 'ap', raoLaoDeg: 0, cranialCaudalDeg: 0, imageUrl: '/ap.svg', thicknessProxy: 1 },
  { id: 'rao', raoLaoDeg: -30, cranialCaudalDeg: 0, imageUrl: '/rao.svg', thicknessProxy: 1.1 },
  { id: 'cranial', raoLaoDeg: 0, cranialCaudalDeg: 20, imageUrl: '/cran.svg', thicknessProxy: 1.2 },
]

const gridFrames: DrrAtlasFrame[] = [
  {
    id: 'm30_m20',
    raoLaoDeg: -30,
    cranialCaudalDeg: -20,
    imageUrl: '/m30_m20.svg',
    thicknessProxy: 1,
  },
  { id: 'p0_m20', raoLaoDeg: 0, cranialCaudalDeg: -20, imageUrl: '/p0_m20.svg', thicknessProxy: 1 },
  { id: 'm30_p0', raoLaoDeg: -30, cranialCaudalDeg: 0, imageUrl: '/m30_p0.svg', thicknessProxy: 1 },
  { id: 'p0_p0', raoLaoDeg: 0, cranialCaudalDeg: 0, imageUrl: '/p0_p0.svg', thicknessProxy: 1 },
]

function baseManifest(partial: Partial<FluoroCaseManifest> = {}): Partial<FluoroCaseManifest> {
  return {
    id: 'case',
    title: 'Case',
    version: '0.1.0',
    safetyLabel: 'Educational simulation only - not for diagnosis.',
    description: 'Test case',
    sourcePolicy: 'Derived educational assets only.',
    assetBaseUrl: '/case',
    geometry: {} as FluoroCaseManifest['geometry'],
    assets: { airwayGlb: '/model.glb' } as FluoroCaseManifest['assets'],
    ctSlices: { axes: { axial: {} } } as unknown as FluoroCaseManifest['ctSlices'],
    lessons: [],
    ...partial,
  }
}

test('findNearestDrrFrame chooses closest atlas angle', () => {
  expect(findNearestDrrFrame(frames, -26, 2)?.id).toBe('rao')
  expect(findNearestDrrFrame(frames, 2, 18)?.id).toBe('cranial')
})

test('findDrrBlendFrames returns one frame at an exact atlas angle', () => {
  expect(findDrrBlendFrames(gridFrames, -30, -20)).toEqual([{ frame: gridFrames[0], weight: 1 }])
})

test('findDrrBlendFrames blends continuously between adjacent RAO/LAO frames', () => {
  const blend = findDrrBlendFrames(gridFrames, -15, -20)

  expect(blend).toHaveLength(2)
  expect(blend.map((item) => item.frame.id).sort()).toEqual(['m30_m20', 'p0_m20'])
  expect(blend[0].weight).toBeCloseTo(0.5, 6)
  expect(blend[1].weight).toBeCloseTo(0.5, 6)
})

test('findDrrBlendFrames bilinearly blends four atlas corners', () => {
  const blend = findDrrBlendFrames(gridFrames, -15, -10)

  expect(blend).toHaveLength(4)
  for (const item of blend) {
    expect(item.weight).toBeCloseTo(0.25, 6)
  }
})

test('findDrrBlendFrames clamps outside the atlas grid', () => {
  expect(findDrrBlendFrames(gridFrames, -90, -40)).toEqual([{ frame: gridFrames[0], weight: 1 }])
})

test('validateFluoroCaseManifest requires safety wording and assets', () => {
  expect(validateFluoroCaseManifest({})).toContain('Manifest id is required.')
  expect(
    validateFluoroCaseManifest(
      baseManifest({
        drrAtlas: {
          grid: { raoLaoAngles: [0], cranialCaudalAngles: [0] },
          provenance: { backend: 'cpu-ray-sum', detectorPixels: [512, 512] },
          frames: frames.slice(0, 1),
        },
      }),
    ),
  ).toEqual([])
})

test('validateFluoroCaseManifest checks interaction assets when present', () => {
  expect(
    validateFluoroCaseManifest(
      baseManifest({
        assets: {
          airwayGlb: '/model.glb',
          airwayGraphJson: '/graph.json',
        } as FluoroCaseManifest['assets'],
        drrAtlas: {
          grid: { raoLaoAngles: [0], cranialCaudalAngles: [0] },
          provenance: { backend: 'cpu-ray-sum', detectorPixels: [512, 512] },
          frames: frames.slice(0, 1),
        },
      }),
    ),
  ).toContain('Interaction defaults are required when an airway graph is provided.')
})

test('validateFluoroCaseManifest accepts volume-only manifests', () => {
  expect(
    validateFluoroCaseManifest(
      baseManifest({
        volumeDrr: {
          volumeUri: '/case/ct/ct_volume_uint8.raw',
          format: 'uint8-r8',
          sizeXyz: [256, 256, 256],
          spacingXyzMm: [1, 1, 1],
          originLps: [0, 0, 0],
          directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          huRange: [-1144, 2951],
          sampleDomain: 'normalized-r8',
        },
      }),
    ),
  ).toEqual([])
})

test('validateFluoroCaseManifest rejects manifests without atlas or volume', () => {
  expect(validateFluoroCaseManifest(baseManifest())).toContain(
    'A DRR atlas (frames) or a volumeDrr asset is required.',
  )
})

test('validateFluoroCaseManifest validates volume DRR contract', () => {
  const errors = validateFluoroCaseManifest(
    baseManifest({
      volumeDrr: {
        volumeUri: '/case/ct/ct_volume_uint8.raw',
        format: 'r8' as 'uint8-r8',
        sizeXyz: [256, 256, 256],
        spacingXyzMm: [1, 1, 1],
        originLps: [0, 0, 0],
        directionLps: [1, 0, 0],
        huRange: [-1144, 2951],
        sampleDomain: 'normalized-r8',
      },
    }),
  )

  expect(errors).toContain('volumeDrr.format must be "uint8-r8".')
  expect(errors).toContain('volumeDrr.directionLps must contain 9 values.')
})

test('validateFluoroCaseManifest validates optional scope animation', () => {
  expect(
    validateFluoroCaseManifest(
      baseManifest({
        volumeDrr: {
          volumeUri: '/case/ct/ct_volume_uint8.raw',
          format: 'uint8-r8',
          sizeXyz: [256, 256, 256],
          spacingXyzMm: [1, 1, 1],
          originLps: [0, 0, 0],
          directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          huRange: [-1144, 2951],
          sampleDomain: 'normalized-r8',
        },
        scopeAnimation: { polylineJsonUri: '', defaultRouteId: 'bezier-demo' },
      }),
    ),
  ).toContain('scopeAnimation.polylineJsonUri is required.')
})
