import { assessNeedlePath, scoreProbeWindow } from '../engine/scoring'
import { labelCodeByName } from '../engine/labels'
import type { PleuralProbeState, PleuralVolume, UltrasoundFrameMetrics } from '../types'

function makeVolume() {
  const sizeXyz: [number, number, number] = [5, 80, 5]
  const data = new Uint8Array(sizeXyz[0] * sizeXyz[1] * sizeXyz[2])

  function setLabel(x: number, y: number, z: number, label: number) {
    data[x + sizeXyz[0] * (y + sizeXyz[1] * z)] = label
  }

  return {
    volume: {
      data,
      labels: {},
      geometry: {
        sizeXyz,
        sourceSizeXyz: sizeXyz,
        strideXyz: [1, 1, 1],
        spacingXyzMm: [1, 1, 1],
        originLpsMm: [0, 0, 0],
        coordinateSystem: 'LPS',
      },
    } satisfies PleuralVolume,
    setLabel,
  }
}

const baseProbe: PleuralProbeState = {
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

describe('pleural ultrasound simulator scoring', () => {
  it('accepts a center needle path with a long fluid run and no hazards', () => {
    const { volume, setLabel } = makeVolume()
    for (let y = 35; y <= 65; y += 1) {
      setLabel(2, y, 2, labelCodeByName.pleuralFluid)
    }

    const assessment = assessNeedlePath(volume, baseProbe)

    expect(assessment.fluidRunMm).toBeGreaterThanOrEqual(25)
    expect(assessment.ribHit).toBe(false)
    expect(assessment.diaphragmHit).toBe(false)
    expect(assessment.safeWindow).toBe(true)
  })

  it('rejects a needle path when rib is hit before fluid', () => {
    const { volume, setLabel } = makeVolume()
    setLabel(2, 69, 2, labelCodeByName.rib)
    for (let y = 35; y <= 65; y += 1) {
      setLabel(2, y, 2, labelCodeByName.pleuralFluid)
    }

    const assessment = assessNeedlePath(volume, baseProbe)

    expect(assessment.ribHit).toBe(true)
    expect(assessment.safeWindow).toBe(false)
  })

  it('combines pocket, shadow, anatomy, needle, and classification into a probe score', () => {
    const metrics: UltrasoundFrameMetrics = {
      maxFluidPocketMm: 46,
      meanFluidPocketMm: 32,
      fluidBeamFraction: 0.62,
      ribShadowBeamFraction: 0.12,
      diaphragmSeen: true,
      lungSeen: true,
      solidOrganSeen: false,
      centralNeedle: {
        ribHit: false,
        diaphragmHit: false,
        solidOrganHit: false,
        lungHit: false,
        fluidRunMm: 34,
        firstFluidDepthMm: 26,
        safeWindow: true,
      },
    }

    const score = scoreProbeWindow(metrics, 'simpleAnechoic', 'simpleAnechoic')

    expect(score.safeWindow).toBe(true)
    expect(score.patternClassificationCorrect).toBe(true)
    expect(score.needleTrajectorySafe).toBe(true)
  })
})
