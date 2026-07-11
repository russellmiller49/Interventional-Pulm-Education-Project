import type { CardiacModelSpec, ThoracicVolume, Vec3 } from '../types'

import {
  cardiacContraction,
  cardiacPhaseAtTime,
  createCardiacRenderState,
  probeIntersectsCardiacModel,
  sampleCardiacAnatomy,
} from '../engine/cardiacModel'
import { simulateBMode } from '../engine/simulateBMode'
import { installImageDataPolyfill } from '../testSupport/imageDataPolyfill'

installImageDataPolyfill()

const cardiacModel: CardiacModelSpec = {
  kind: 'parametric-cardiac-v1',
  sourceLabel: 'heart',
  centerLpsMm: [10, 10, 10],
  basis: {
    leftAxis: [1, 0, 0],
    anteriorAxis: [0, 1, 0],
    baseAxis: [0, 0, 1],
  },
  defaultHeartRateBpm: 60,
  respiratoryRateBpm: 15,
  respiratoryExcursionMm: 0,
  chambers: [
    {
      id: 'left-ventricle',
      centerLocalMm: [0, 0, 0],
      endDiastolicRadiiMm: [5, 5, 6],
      endSystolicRadiiMm: [2.8, 2.8, 3.8],
    },
    {
      id: 'right-ventricle',
      centerLocalMm: [-5, 2, 0],
      endDiastolicRadiiMm: [3.5, 3, 5],
      endSystolicRadiiMm: [2.2, 1.9, 3.2],
      crescent: 0.45,
    },
    {
      id: 'left-atrium',
      centerLocalMm: [2, 0, 6],
      endDiastolicRadiiMm: [2.5, 2.5, 2.5],
      endSystolicRadiiMm: [3, 3, 3],
    },
    {
      id: 'right-atrium',
      centerLocalMm: [-3, 1, 6],
      endDiastolicRadiiMm: [2.5, 2.5, 2.5],
      endSystolicRadiiMm: [3, 3, 3],
    },
  ],
  valves: [
    {
      id: 'mitral',
      centerLocalMm: [1, 0, 4],
      normalLocal: [0, 0, 1],
      radiusMm: 2,
      thicknessMm: 1,
      timing: 'atrioventricular',
    },
  ],
}

function localToWorld(local: Vec3): Vec3 {
  return [
    cardiacModel.centerLpsMm[0] + local[0],
    cardiacModel.centerLpsMm[1] + local[1],
    cardiacModel.centerLpsMm[2] + local[2],
  ]
}

function makeCardiacVolume() {
  const sizeXyz: Vec3 = [21, 21, 21]
  const data = new Uint8Array(sizeXyz[0] * sizeXyz[1] * sizeXyz[2])
  for (let z = 2; z <= 18; z += 1) {
    for (let y = 2; y <= 18; y += 1) {
      for (let x = 2; x <= 18; x += 1) {
        if (Math.hypot(x - 10, y - 10, z - 10) <= 9) {
          data[x + sizeXyz[0] * (y + sizeXyz[1] * z)] = 19
        }
      }
    }
  }

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
    resolveLabel: (code) => (code === 19 ? 'heart' : 'background'),
    cardiacModel,
  }

  return volume
}

const probe = {
  lateralMm: 10,
  posteriorMm: 20,
  craniocaudalMm: 10,
  tiltDeg: 0,
  rotationDeg: 0,
  depthCm: 2,
  gain: 1.1,
  dynamicRangeDb: 58,
  sectorAngleDeg: 64,
  needleAngleDeg: 0,
}

describe('procedural cardiac anatomy', () => {
  it('uses a periodic asymmetric contraction waveform', () => {
    expect(cardiacPhaseAtTime(0, 60)).toBe(0)
    expect(cardiacPhaseAtTime(1, 60)).toBe(0)
    expect(cardiacContraction(0)).toBe(0)
    expect(cardiacContraction(0.3)).toBeCloseTo(1)
    expect(cardiacContraction(0.75)).toBe(0)
  })

  it('shrinks ventricular blood pools while preserving bright valve tissue', () => {
    const diastole = createCardiacRenderState(cardiacModel, 0)
    const systole = createCardiacRenderState(cardiacModel, 0.3)
    const nearLvWall = localToWorld([4, 0, 0])

    expect(sampleCardiacAnatomy('heart', nearLvWall, diastole).label).toBe('cardiacBlood')
    expect(sampleCardiacAnatomy('heart', nearLvWall, systole).label).toBe('myocardium')
    expect(sampleCardiacAnatomy('heart', localToWorld([1, 0, 4]), diastole).label).toBe(
      'cardiacValve',
    )
    expect(sampleCardiacAnatomy('liver', nearLvWall, diastole).label).toBe('liver')
  })

  it('detects when the probe fan intersects the whole-heart source label', () => {
    const volume = makeCardiacVolume()
    expect(probeIntersectsCardiacModel(volume, probe)).toBe(true)
    expect(probeIntersectsCardiacModel(volume, { ...probe, lateralMm: 100 })).toBe(false)
  })

  it('renders deterministic phase-specific cine frames without changing pleural metrics', () => {
    const volume = makeCardiacVolume()
    const input = {
      volume,
      probe,
      width: 72,
      height: 86,
      probeType: 'phased' as const,
      renderImage: true as const,
    }
    const diastole = simulateBMode({ ...input, simulationTimeSec: 0 })
    const repeated = simulateBMode({ ...input, simulationTimeSec: 0 })
    const systole = simulateBMode({ ...input, simulationTimeSec: 0.3 })
    const nextCycle = simulateBMode({ ...input, simulationTimeSec: 1 })

    expect(Buffer.from(diastole.imageData.data).equals(Buffer.from(repeated.imageData.data))).toBe(
      true,
    )
    expect(Buffer.from(diastole.imageData.data).equals(Buffer.from(nextCycle.imageData.data))).toBe(
      true,
    )
    expect(Buffer.from(diastole.imageData.data).equals(Buffer.from(systole.imageData.data))).toBe(
      false,
    )
    expect(diastole.metrics).toEqual(systole.metrics)
  })
})
