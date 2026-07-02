import {
  beamDirection,
  needleEndpoint,
  probeOrigin,
  projectBeamToWorld,
} from '../engine/sectorGeometry'
import {
  containsWorldPoint,
  sampleCode,
  sampleLabel,
  volumeBounds,
  voxelToWorld,
  worldToVoxel,
} from '../engine/sampleVolume'
import { assessNeedlePath } from '../engine/needlePath'
import { computeBModeMetrics, simulateBMode } from '../engine/simulateBMode'
import { createTissueModel, defaultThoracicTissueModel, stableSpeckle } from '../engine/tissueModel'
import { installImageDataPolyfill } from '../testSupport/imageDataPolyfill'
import { makeTestVolume, testProbe } from '../testSupport/fixtures'

installImageDataPolyfill()

describe('beam-plane mapping', () => {
  it('places the probe origin at the transform position', () => {
    expect(probeOrigin(testProbe)).toEqual([2, 79, 2])
  })

  it('fires the center beam straight along the depth axis', () => {
    const direction = beamDirection(testProbe, 0)
    expect(direction[0]).toBeCloseTo(0)
    expect(direction[1]).toBeCloseTo(-1)
    expect(direction[2]).toBeCloseTo(0)
  })

  it('sweeps the fan into the lateral axis at the sector edge', () => {
    const direction = beamDirection(testProbe, 90)
    expect(direction[0]).toBeCloseTo(1)
    expect(direction[1]).toBeCloseTo(0)
    expect(direction[2]).toBeCloseTo(0)
  })

  it('spins the lateral axis with marker rotation', () => {
    const rotated = beamDirection({ ...testProbe, rotationDeg: 90 }, 90)
    expect(rotated[0]).toBeCloseTo(0)
    expect(rotated[2]).toBeCloseTo(1)
  })

  it('rocks the depth axis with tilt', () => {
    const tilted = beamDirection({ ...testProbe, tiltDeg: 90 }, 0)
    expect(tilted[1]).toBeCloseTo(0)
    expect(tilted[2]).toBeCloseTo(1)
  })

  it('projects world points along the beam', () => {
    expect(projectBeamToWorld(testProbe, 0, 10)).toEqual([2, 69, 2])
  })

  it('aligns the needle endpoint with the needle-angle beam', () => {
    const fromBeam = projectBeamToWorld({ ...testProbe, needleAngleDeg: 12 }, 12, 40)
    const fromNeedle = needleEndpoint({ ...testProbe, needleAngleDeg: 12 }, 40)
    expect(fromNeedle[0]).toBeCloseTo(fromBeam[0])
    expect(fromNeedle[1]).toBeCloseTo(fromBeam[1])
    expect(fromNeedle[2]).toBeCloseTo(fromBeam[2])
  })
})

describe('volume sampling', () => {
  it('round-trips voxel and world coordinates', () => {
    const { volume } = makeTestVolume()
    const world = voxelToWorld(volume.geometry, [2, 40, 2])
    expect(worldToVoxel(volume.geometry, world)).toEqual([2, 40, 2])
  })

  it('reports codes inside the volume and -1 outside', () => {
    const { volume, setCode } = makeTestVolume()
    setCode(2, 40, 2, 7)

    expect(sampleCode(volume, [2, 40, 2])).toBe(7)
    expect(sampleCode(volume, [999, 40, 2])).toBe(-1)
  })

  it('resolves labels through the volume resolver with background fallback', () => {
    const { volume, setCode } = makeTestVolume()
    setCode(2, 40, 2, 7)
    setCode(2, 41, 2, 250)

    expect(sampleLabel(volume, [2, 40, 2])).toBe('pleuralFluid')
    expect(sampleLabel(volume, [2, 41, 2])).toBe('background')
    expect(sampleLabel(volume, [-50, 0, 0])).toBe('background')
  })

  it('exposes containment and world bounds', () => {
    const { volume } = makeTestVolume()
    expect(containsWorldPoint(volume, [2, 40, 2])).toBe(true)
    expect(containsWorldPoint(volume, [2, 90, 2])).toBe(false)
    expect(volumeBounds(volume)).toEqual({ min: [0, 0, 0], max: [4, 79, 4] })
  })
})

describe('needle path assessment', () => {
  it('accepts a long unobstructed fluid run', () => {
    const { volume, setCode } = makeTestVolume()
    for (let y = 35; y <= 65; y += 1) {
      setCode(2, y, 2, 7)
    }

    const assessment = assessNeedlePath(volume, testProbe, defaultThoracicTissueModel)
    expect(assessment.fluidRunMm).toBeGreaterThanOrEqual(25)
    expect(assessment.safeWindow).toBe(true)
  })

  it('rejects paths crossing a rib and honors the model solid-organ set', () => {
    const { volume, setCode } = makeTestVolume()
    setCode(2, 69, 2, 4)
    for (let y = 35; y <= 65; y += 1) {
      setCode(2, y, 2, 7)
    }
    // The needle walk samples every 2mm from y=79, so only odd y planes are hit.
    setCode(2, 21, 2, 11)

    const assessment = assessNeedlePath(volume, testProbe, defaultThoracicTissueModel)
    expect(assessment.ribHit).toBe(true)
    expect(assessment.solidOrganHit).toBe(true)
    expect(assessment.safeWindow).toBe(false)

    const noSolidOrganModel = createTissueModel({ isSolidOrgan: () => false })
    expect(assessNeedlePath(volume, testProbe, noSolidOrganModel).solidOrganHit).toBe(false)
  })
})

describe('simulateBMode render flag', () => {
  function makeFluidVolume() {
    const { volume, setCode } = makeTestVolume()
    for (let y = 30; y <= 66; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        for (let z = 0; z < 5; z += 1) {
          setCode(x, y, z, 7)
        }
      }
    }
    setCode(2, 70, 2, 4)
    for (let z = 0; z < 5; z += 1) {
      setCode(2, 10, z, 10)
    }
    return volume
  }

  it('produces identical metrics with and without image rasterization', () => {
    const volume = makeFluidVolume()
    const input = { volume, probe: testProbe, width: 64, height: 80 }

    const metricsOnly = simulateBMode({ ...input, renderImage: false })
    const rendered = simulateBMode({ ...input, renderImage: true })

    expect(metricsOnly.imageData).toBeNull()
    expect(rendered.imageData).not.toBeNull()
    expect(rendered.imageData.width).toBe(64)
    expect(rendered.imageData.height).toBe(80)
    expect(metricsOnly.metrics).toEqual(rendered.metrics)
    expect(computeBModeMetrics(input)).toEqual(rendered.metrics)
  })

  it('sees fluid, rib shadow, and the diaphragm in the metrics', () => {
    const volume = makeFluidVolume()
    const { metrics } = simulateBMode({ volume, probe: testProbe, width: 64, height: 80 })

    expect(metrics.maxFluidPocketMm).toBeGreaterThan(25)
    expect(metrics.fluidBeamFraction).toBeGreaterThan(0)
    expect(metrics.ribShadowBeamFraction).toBeGreaterThan(0)
    expect(metrics.diaphragmSeen).toBe(true)
    expect(metrics.centralNeedle.fluidRunMm).toBeGreaterThan(25)
  })

  it('renders deterministically for a fixed pose', () => {
    const volume = makeFluidVolume()
    const input = { volume, probe: testProbe, width: 48, height: 60, renderImage: true as const }

    const first = simulateBMode(input)
    const second = simulateBMode(input)
    expect(Buffer.from(first.imageData.data).equals(Buffer.from(second.imageData.data))).toBe(true)
  })
})

describe('stable speckle', () => {
  it('is deterministic per point and varies across labels', () => {
    expect(stableSpeckle([1, 2, 3], 'liver')).toBe(stableSpeckle([1, 2, 3], 'liver'))
    expect(stableSpeckle([1, 2, 3], 'liver')).not.toBe(stableSpeckle([1, 2, 3], 'pleuralFluid'))
  })
})
