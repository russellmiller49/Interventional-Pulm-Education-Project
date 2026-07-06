import {
  FACE_RADIUS_MM,
  approachFrame,
  beamDirection,
  needleEndpoint,
  probeOrigin,
  projectBeamToWorld,
  scanPlaneNormal,
  sectorImageToWorld,
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

describe('scan-plane geometry (3D slice + in-image identification)', () => {
  const probe = {
    lateralMm: -20,
    posteriorMm: -30,
    craniocaudalMm: -420,
    tiltDeg: -4,
    rotationDeg: 12,
    depthCm: 14,
    gain: 1.1,
    dynamicRangeDb: 56,
    sectorAngleDeg: 66,
    needleAngleDeg: 0,
  }
  const width = 520
  const height = 620
  const DEG2RAD = Math.PI / 180

  it('scan-plane normal is perpendicular to every beam in the fan', () => {
    const normal = scanPlaneNormal(probe)
    expect(Math.hypot(...normal)).toBeCloseTo(1)
    for (const angleDeg of [-33, -10, 0, 15, 33]) {
      const beam = beamDirection(probe, angleDeg)
      const dot = normal[0] * beam[0] + normal[1] * beam[1] + normal[2] * beam[2]
      expect(dot).toBeCloseTo(0)
    }
  })

  it('sectorImageToWorld inverts the renderer scan conversion', () => {
    const maxDepthMm = probe.depthCm * 10
    const halfRad = (probe.sectorAngleDeg / 2) * DEG2RAD
    const scale = Math.min(
      (height - 14) / (maxDepthMm + FACE_RADIUS_MM * (1 - Math.cos(halfRad))),
      (width / 2 - 4) / ((FACE_RADIUS_MM + maxDepthMm) * Math.sin(halfRad)),
    )
    const apexY = 8 - FACE_RADIUS_MM * scale * Math.cos(halfRad)
    const centerX = width / 2

    for (const angleDeg of [-30, -12, 0, 18, 30]) {
      for (const depthMm of [8, 45, 95, 138]) {
        const radiusPx = (FACE_RADIUS_MM + depthMm) * scale
        const imageX = centerX + radiusPx * Math.sin(angleDeg * DEG2RAD)
        const imageY = apexY + radiusPx * Math.cos(angleDeg * DEG2RAD)
        const recovered = sectorImageToWorld(probe, width, height, imageX, imageY)
        const expected = projectBeamToWorld(probe, angleDeg, depthMm)
        expect(recovered).not.toBeNull()
        expect(Math.hypot(...recovered!.map((value, i) => value - expected[i]))).toBeLessThan(0.05)

        // A cropped air standoff shifts the sampled world point deeper by
        // exactly the crop distance (matches marchPolarGrid's rayDepth).
        const cropMm = 21
        const recoveredCropped = sectorImageToWorld(probe, width, height, imageX, imageY, cropMm)
        const expectedCropped = projectBeamToWorld(probe, angleDeg, cropMm + depthMm)
        expect(recoveredCropped).not.toBeNull()
        expect(
          Math.hypot(...recoveredCropped!.map((value, i) => value - expectedCropped[i])),
        ).toBeLessThan(0.05)
      }
    }
  })

  it('returns null for pixels outside the sector', () => {
    expect(sectorImageToWorld(probe, width, height, 5, 5)).toBeNull()
  })
})

describe('circumferential approach (reach anterior structures)', () => {
  const baseProbe = {
    lateralMm: 0,
    posteriorMm: 0,
    craniocaudalMm: 0,
    tiltDeg: 0,
    rotationDeg: 0,
    depthCm: 12,
    gain: 1,
    dynamicRangeDb: 56,
    sectorAngleDeg: 60,
    needleAngleDeg: 0,
  }

  it('approachDeg 0 reproduces the legacy posterior beam (fires anterior)', () => {
    const legacy = beamDirection(baseProbe, 0)
    const explicit = beamDirection({ ...baseProbe, approachDeg: 0 }, 0)
    expect(legacy[0]).toBeCloseTo(0)
    expect(legacy[1]).toBeCloseTo(-1)
    expect(legacy[2]).toBeCloseTo(0)
    expect(explicit).toEqual(legacy)
  })

  it('approachDeg 180 fires the beam posteriorly (anterior window)', () => {
    const direction = beamDirection({ ...baseProbe, approachDeg: 180 }, 0)
    expect(direction[0]).toBeCloseTo(0)
    expect(direction[1]).toBeCloseTo(1)
    expect(direction[2]).toBeCloseTo(0)
  })

  it('approachDeg 90 fires the beam laterally toward the body centre', () => {
    const direction = beamDirection({ ...baseProbe, approachDeg: 90 }, 0)
    expect(direction[0]).toBeCloseTo(-1)
    expect(direction[1]).toBeCloseTo(0)
    expect(direction[2]).toBeCloseTo(0)
  })

  it('the approach frame is orthonormal and the scan plane tracks the rotated fan', () => {
    const probe = { ...baseProbe, approachDeg: 140, tiltDeg: 6, rotationDeg: -20 }
    const { outward, inward, tangent } = approachFrame(probe)
    expect(Math.hypot(...outward)).toBeCloseTo(1)
    expect(outward.map((v, i) => v + inward[i]).every((v) => Math.abs(v) < 1e-9)).toBe(true)
    expect(outward[0] * tangent[0] + outward[1] * tangent[1] + outward[2] * tangent[2]).toBeCloseTo(
      0,
    )
    const normal = scanPlaneNormal(probe)
    for (const angleDeg of [-25, 0, 25]) {
      const beam = beamDirection(probe, angleDeg)
      expect(normal[0] * beam[0] + normal[1] * beam[1] + normal[2] * beam[2]).toBeCloseTo(0)
    }
  })
})

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
