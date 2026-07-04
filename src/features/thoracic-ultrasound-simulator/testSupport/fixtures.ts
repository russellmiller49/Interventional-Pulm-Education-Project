import type {
  FrameAtlasEntry,
  ThoracicCaseManifest,
  ThoracicFrameMetrics,
  ThoracicProbeState,
  ThoracicVolume,
} from '../types'

import { buildLabelResolver } from '../loader/loadThoracicCase'

export const testLabelCodes = {
  '0': 'background',
  '4': 'rib',
  '7': 'pleuralFluid',
  '10': 'diaphragm',
  '11': 'liver',
} as const

export const testProbe: ThoracicProbeState = {
  lateralMm: 2,
  posteriorMm: 79,
  craniocaudalMm: 2,
  tiltDeg: 0,
  rotationDeg: 0,
  depthCm: 7,
  gain: 1,
  dynamicRangeDb: 56,
  sectorAngleDeg: 60,
  needleAngleDeg: 0,
}

/** 5x80x5 volume at 1mm spacing, origin 0 — the probe looks down -Y from y=79. */
export function makeTestVolume() {
  const sizeXyz: [number, number, number] = [5, 80, 5]
  const data = new Uint8Array(sizeXyz[0] * sizeXyz[1] * sizeXyz[2])

  const volume: ThoracicVolume = {
    data,
    geometry: {
      sizeXyz,
      sourceSizeXyz: sizeXyz,
      strideXyz: [1, 1, 1],
      spacingXyzMm: [1, 1, 1],
      originLpsMm: [0, 0, 0],
      coordinateSystem: 'LPS',
    },
    resolveLabel: buildLabelResolver(testLabelCodes),
  }

  function setCode(x: number, y: number, z: number, code: number) {
    data[x + sizeXyz[0] * (y + sizeXyz[1] * z)] = code
  }

  return { volume, setCode }
}

export function makeTestMetrics(
  overrides: Partial<ThoracicFrameMetrics> = {},
): ThoracicFrameMetrics {
  return {
    maxFluidPocketMm: 48,
    meanFluidPocketMm: 34,
    fluidBeamFraction: 0.56,
    ribShadowBeamFraction: 0.14,
    diaphragmSeen: true,
    lungSeen: true,
    solidOrganSeen: false,
    centralNeedle: {
      ribHit: false,
      diaphragmHit: false,
      solidOrganHit: false,
      lungHit: false,
      fluidRunMm: 36,
      firstFluidDepthMm: 28,
      safeWindow: true,
    },
    ...overrides,
  }
}

export function makeAtlasEntry(overrides: Partial<FrameAtlasEntry> = {}): FrameAtlasEntry {
  return {
    id: 'best-window',
    label: 'Best window',
    description: 'Teaching frame for a centered fluid pocket.',
    imageUrl: '/assets/frame-atlas/best-window.svg',
    probe: testProbe,
    metrics: makeTestMetrics(),
    groundTruthKey: 'simpleAnechoic',
    generator: {
      source: 'manual-curated',
      name: 'Synthetic test atlas',
      version: '1',
    },
    reviewStatus: 'reviewed',
    educationalUse: 'Synthetic educational frame only.',
    tags: ['best-window'],
    ...overrides,
  }
}

export function makeManifest(overrides: Partial<ThoracicCaseManifest> = {}): ThoracicCaseManifest {
  return {
    schemaVersion: 2,
    id: 'test-case',
    name: 'Test thoracic case',
    description: 'Synthetic case for unit tests.',
    safetyLabel: 'Educational simulation only; not for diagnosis or clinical use.',
    anatomicRegion: 'pleural',
    supportedApplications: ['pleural-effusion'],
    meshUrl: '/assets/test-case.glb',
    primaryLabelVolume: {
      id: 'test-labelmap',
      url: '/assets/test-case.labelmap.uint8.bin',
      format: 'uint8-single-label',
      geometry: {
        sizeXyz: [5, 80, 5],
        sourceSizeXyz: [5, 80, 5],
        strideXyz: [1, 1, 1],
        spacingXyzMm: [1, 1, 1],
        originLpsMm: [0, 0, 0],
        coordinateSystem: 'LPS',
      },
      labelCodes: testLabelCodes,
    },
    structures: [
      {
        label: 'pleuralFluid',
        displayName: 'Pleural fluid',
        category: 'fluid',
        code: 7,
        boundsLpsMm: { min: [0, 30, 0], max: [4, 66, 4], voxels: 500 },
      },
      {
        label: 'rib',
        displayName: 'Rib',
        category: 'chest-wall',
        code: 4,
        hazard: true,
        boundsLpsMm: { min: [0, 66, 0], max: [4, 72, 4], voxels: 60 },
      },
      {
        label: 'diaphragm',
        displayName: 'Diaphragm',
        category: 'diaphragm',
        code: 10,
        hazard: true,
        boundsLpsMm: { min: [0, 8, 0], max: [4, 14, 4], voxels: 60 },
      },
    ],
    probePresets: [
      {
        id: 'default',
        label: 'Default preset',
        probeType: 'curvilinear',
        defaults: testProbe,
        ranges: {
          lateralMm: { min: -60, max: 60, step: 2 },
          craniocaudalMm: { min: -60, max: 60, step: 2 },
          posteriorMm: { min: 40, max: 90, step: 2 },
          tiltDeg: { min: -28, max: 28, step: 1 },
          rotationDeg: { min: -55, max: 55, step: 1 },
          needleAngleDeg: { min: -25, max: 25, step: 1 },
          depthCm: { min: 6, max: 18, step: 0.5 },
          gain: { min: 0.7, max: 2.4, step: 0.05 },
          sectorAngleDeg: { min: 40, max: 80, step: 1 },
        },
      },
    ],
    defaultProbePresetId: 'default',
    frameSources: [
      { id: 'reviewed-atlas', kind: 'reviewed-atlas', status: 'reviewed', priority: 0 },
      {
        id: 'plus-atlas',
        kind: 'plus-atlas',
        status: 'reviewed',
        priority: 1,
        indexUrl: '/assets/frames/frames.json',
      },
      { id: 'browser-raymarch', kind: 'browser-raymarch', status: 'prototype', priority: 2 },
      { id: 'placeholder', kind: 'placeholder', status: 'placeholder', priority: 3 },
    ],
    frameAtlas: {
      selectionTolerance: {},
      entries: [makeAtlasEntry()],
    },
    qualityStatus: {
      overall: 'mixed',
      browserRaymarch: 'prototype',
      atlas: 'reviewed',
    },
    learningTasks: [
      {
        id: 'classify',
        kind: 'classify-pattern',
        prompt: 'Classify the current pattern, then compare with the case target.',
        hiddenGroundTruth: 'simpleAnechoic',
      },
    ],
    ...overrides,
  }
}
