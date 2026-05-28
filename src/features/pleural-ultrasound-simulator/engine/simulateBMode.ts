import type {
  PleuralProbeState,
  PleuralTissueLabel,
  PleuralVolume,
  UltrasoundFrameMetrics,
  Vec3,
} from '../types'

import { acousticMaterials, estimateBoundaryReflection } from './acousticMaterials'
import { isSolidOrgan } from './labels'
import { assessNeedlePath } from './scoring'
import { projectBeamToWorld } from './sectorGeometry'
import { sampleLabel } from './sampleVolume'

export interface SimulatePleuralBModeInput {
  volume: PleuralVolume
  probe: PleuralProbeState
  width: number
  height: number
}

export interface SimulatedPleuralFrame {
  imageData: ImageData
  metrics: UltrasoundFrameMetrics
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function fract(value: number) {
  return value - Math.floor(value)
}

export function stableSpeckle(worldPoint: Vec3, label: PleuralTissueLabel) {
  const labelSeed = label.length * 19.19
  const coarse =
    Math.sin(worldPoint[0] * 0.19 + worldPoint[1] * 0.31 + worldPoint[2] * 0.27 + labelSeed) *
    43758.5453
  const fine =
    Math.sin(worldPoint[0] * 1.47 + worldPoint[1] * 1.91 + worldPoint[2] * 1.33 + labelSeed) *
    12414.19

  const mixed = 0.62 * fract(coarse) + 0.38 * fract(fine)
  return Math.pow(0.18 + 0.82 * mixed, 1.35)
}

function logCompressToByte(rawEcho: number, dynamicRangeDb: number) {
  const db = 20 * Math.log10(Math.max(rawEcho, 0.00001))
  const normalized = (db + dynamicRangeDb) / dynamicRangeDb
  return clampByte(normalized * 255)
}

function tissueBackscatter(label: PleuralTissueLabel) {
  switch (label) {
    case 'background':
      return 0
    case 'pleuralFluid':
      return 0.0012
    case 'septation':
      return 0.22
    case 'debris':
      return 0.16
    case 'diaphragm':
      return 0.036
    case 'rib':
      return 0.025
    case 'lung':
      return 0.032
    case 'atelectaticLung':
      return 0.064
    case 'liver':
    case 'spleen':
      return 0.038
    case 'skin':
      return 0.048
    case 'intercostalMuscle':
      return 0.055
    case 'subcutaneousTissue':
      return 0.042
    default:
      return 0.038
  }
}

function isFluidInterface(previousLabel: PleuralTissueLabel, nextLabel: PleuralTissueLabel) {
  return previousLabel === 'pleuralFluid' || nextLabel === 'pleuralFluid'
}

function interfaceEcho(previousLabel: PleuralTissueLabel, nextLabel: PleuralTissueLabel) {
  if (previousLabel === nextLabel) {
    return 0
  }

  if (nextLabel === 'rib' || previousLabel === 'rib') {
    return 1.5
  }

  if (nextLabel === 'diaphragm' || previousLabel === 'diaphragm') {
    return 1.1
  }

  if (
    isFluidInterface(previousLabel, nextLabel) &&
    (previousLabel === 'liver' ||
      nextLabel === 'liver' ||
      previousLabel === 'spleen' ||
      nextLabel === 'spleen' ||
      previousLabel === 'lung' ||
      nextLabel === 'lung' ||
      previousLabel === 'atelectaticLung' ||
      nextLabel === 'atelectaticLung')
  ) {
    return 0.86
  }

  if (nextLabel === 'lung' || previousLabel === 'lung') {
    return 0.58
  }

  if (isFluidInterface(previousLabel, nextLabel)) {
    return 0.5
  }

  return estimateBoundaryReflection(previousLabel, nextLabel) * 0.36
}

function isNearFluidBoundary(
  volume: PleuralVolume,
  probe: PleuralProbeState,
  sectorAngleDeg: number,
  depthMm: number,
  stepMm: number,
) {
  const offsets: [number, number][] = [
    [0, -stepMm * 1.4],
    [0, stepMm * 1.4],
    [-0.85, 0],
    [0.85, 0],
  ]

  for (const [angleOffset, depthOffset] of offsets) {
    const neighbor = sampleLabel(
      volume,
      projectBeamToWorld(probe, sectorAngleDeg + angleOffset, Math.max(0, depthMm + depthOffset)),
    )
    if (neighbor !== 'pleuralFluid') {
      return true
    }
  }

  return false
}

function tissueTexture(worldPoint: Vec3, label: PleuralTissueLabel, depthMm: number) {
  const speckle = stableSpeckle(worldPoint, label)
  const fascialBand =
    label === 'skin' || label === 'intercostalMuscle' || label === 'subcutaneousTissue'
      ? 0.028 * Math.max(0, Math.sin(worldPoint[0] * 0.08 + worldPoint[2] * 0.06))
      : 0
  const liverGrain =
    label === 'liver' || label === 'spleen'
      ? 0.026 * fract(Math.sin(worldPoint[0] * 0.55 + worldPoint[2] * 0.47) * 9142.17)
      : 0
  const nearFieldNoise =
    depthMm < 16 && label !== 'pleuralFluid' ? 0.014 * stableSpeckle(worldPoint, 'skin') : 0

  return (
    tissueBackscatter(label) * (0.35 + speckle * 0.9) + fascialBand + liverGrain + nearFieldNoise
  )
}

function writeIntensity(
  pixels: Float32Array,
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  gray: number,
) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return
  }

  const index = x + y * width
  pixels[index] = Math.max(pixels[index] ?? 0, gray)
  mask[index] = 1
}

function smoothInsideSector(values: Float32Array, mask: Uint8Array, width: number, height: number) {
  const firstPass = new Float32Array(values.length)
  const result = new Float32Array(values.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = x + y * width
      if (!mask[index]) continue

      let total = 0
      let weightTotal = 0
      for (let dx = -3; dx <= 3; dx += 1) {
        const sampleX = x + dx
        if (sampleX < 0 || sampleX >= width) continue
        const sampleIndex = sampleX + y * width
        if (!mask[sampleIndex]) continue
        const weight = dx === 0 ? 5 : Math.abs(dx) === 1 ? 3 : Math.abs(dx) === 2 ? 2 : 1
        total += values[sampleIndex] * weight
        weightTotal += weight
      }
      firstPass[index] = total / Math.max(1, weightTotal)
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = x + y * width
      if (!mask[index]) continue

      let total = 0
      let weightTotal = 0
      for (let dy = -2; dy <= 2; dy += 1) {
        const sampleY = y + dy
        if (sampleY < 0 || sampleY >= height) continue
        const sampleIndex = x + sampleY * width
        if (!mask[sampleIndex]) continue
        const weight = dy === 0 ? 4 : Math.abs(dy) === 1 ? 2 : 1
        total += firstPass[sampleIndex] * weight
        weightTotal += weight
      }
      result[index] = total / Math.max(1, weightTotal)
    }
  }

  return result
}

function renderImageData(values: Float32Array, mask: Uint8Array, width: number, height: number) {
  const image = new ImageData(width, height)
  const smoothed = smoothInsideSector(values, mask, width, height)
  const centerX = width / 2

  for (let y = 0; y < height; y += 1) {
    const depthFraction = y / Math.max(1, height - 1)
    const scanlineShade = y % 2 === 0 ? 0.965 : 1

    for (let x = 0; x < width; x += 1) {
      const offset = (x + y * width) * 4
      const index = x + y * width
      const fanHalfWidth = Math.max(8, (width / 2 - 2) * (0.08 + 0.92 * depthFraction))
      const lateralFraction = Math.min(1, Math.abs(x - centerX) / Math.max(1, fanHalfWidth))
      const edgeVignette = 1 - Math.pow(lateralFraction, 3) * 0.22
      const nearFieldDropout = depthFraction < 0.035 ? depthFraction / 0.035 : 1
      const pixelGrain = fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)
      const baseValue =
        Math.pow(Math.max(0, smoothed[index]) / 255, 1.36) *
        228 *
        scanlineShade *
        edgeVignette *
        Math.max(0.28, nearFieldDropout)
      const granularValue =
        baseValue * (0.76 + pixelGrain * 0.5) + (baseValue > 24 ? pixelGrain * 7 : 0)
      const displayValue = mask[index] ? clampByte(granularValue) : 0

      image.data[offset] = displayValue
      image.data[offset + 1] = displayValue
      image.data[offset + 2] = displayValue
      image.data[offset + 3] = 255
    }
  }

  return image
}

export function simulatePleuralBMode({
  volume,
  probe,
  width,
  height,
}: SimulatePleuralBModeInput): SimulatedPleuralFrame {
  const pixels = new Float32Array(width * height)
  const mask = new Uint8Array(width * height)
  const maxDepthMm = probe.depthCm * 10
  const stepMm = maxDepthMm / Math.max(1, height - 1)
  const beamCount = Math.round(width * 1.25)
  const maxFanHalfWidth = width / 2 - 2
  const centerX = width / 2
  const fluidRuns: number[] = []
  let ribShadowBeamCount = 0
  let fluidBeamCount = 0
  let diaphragmSeen = false
  let lungSeen = false
  let solidOrganSeen = false

  for (let beam = 0; beam < beamCount; beam += 1) {
    const beamFraction = beam / Math.max(1, beamCount - 1)
    const sectorAngleDeg = probe.sectorAngleDeg * (beamFraction - 0.5)
    let shadow = 1
    let traversedFluidMm = 0
    let cumulativeAttenuation = 0
    let previousLabel: PleuralTissueLabel = 'background'
    let currentFluidRun = 0
    let bestFluidRun = 0
    let ribHitOnBeam = false
    let shallowBoneShadowed = false
    let lungSurfaceDepthMm: number | null = null
    let enteredPatient = false

    for (let py = 0; py < height; py += 1) {
      const depthFraction = py / Math.max(1, height - 1)
      const depthMm = depthFraction * maxDepthMm
      const worldPoint = projectBeamToWorld(probe, sectorAngleDeg, depthMm)
      const label = sampleLabel(volume, worldPoint)
      if (label !== 'background') {
        enteredPatient = true
      }
      const renderLabel =
        label === 'background' && (enteredPatient || depthMm < 72) ? 'subcutaneousTissue' : label
      const material = acousticMaterials[renderLabel] ?? acousticMaterials.background
      const boundaryEcho = interfaceEcho(previousLabel, renderLabel)
      const depthGainCompensation = 0.58 + depthFraction * 0.82

      if (label === 'diaphragm') diaphragmSeen = true
      if (label === 'lung' || label === 'atelectaticLung') lungSeen = true
      if (isSolidOrgan(label)) solidOrganSeen = true

      if ((label === 'lung' || label === 'atelectaticLung') && lungSurfaceDepthMm === null) {
        lungSurfaceDepthMm = depthMm
      }

      if (label === 'pleuralFluid') {
        currentFluidRun += stepMm
        bestFluidRun = Math.max(bestFluidRun, currentFluidRun)
        traversedFluidMm += stepMm
      } else {
        currentFluidRun = 0
      }

      const posteriorBoost =
        label === 'pleuralFluid'
          ? 0.6
          : 1 + Math.min(0.28, (traversedFluidMm / Math.max(1, maxDepthMm)) * 0.85)
      const aLineEcho =
        material.airInterface && lungSurfaceDepthMm !== null && depthMm > lungSurfaceDepthMm + 14
          ? Math.max(0, 0.12 - (((depthMm - lungSurfaceDepthMm) % 22) / 22) * 0.12)
          : 0
      const rawEcho =
        (tissueTexture(worldPoint, renderLabel, depthMm) +
          boundaryEcho * material.reflectivity +
          aLineEcho) *
        Math.exp(-cumulativeAttenuation) *
        shadow *
        posteriorBoost *
        probe.gain *
        depthGainCompensation
      const gray = logCompressToByte(rawEcho, probe.dynamicRangeDb)
      const fanHalfWidth = Math.max(8, maxFanHalfWidth * (0.08 + 0.92 * depthFraction))
      const displayX = Math.round(centerX + (beamFraction - 0.5) * fanHalfWidth * 2)
      const fluidBoundary =
        label === 'pleuralFluid'
          ? boundaryEcho > 0.16 ||
            isNearFluidBoundary(volume, probe, sectorAngleDeg, depthMm, stepMm)
          : false
      const displayGray =
        label === 'pleuralFluid'
          ? fluidBoundary
            ? Math.min(Math.max(gray, 72), 148)
            : Math.min(gray, 16)
          : label === 'rib'
            ? Math.max(gray, 178)
            : label === 'diaphragm'
              ? Math.max(gray, 158)
              : (label === 'liver' || label === 'spleen') && boundaryEcho < 0.16
                ? Math.min(gray, 106)
                : label === 'background' && renderLabel === 'subcutaneousTissue'
                  ? Math.min(gray, 104)
                  : gray

      writeIntensity(pixels, mask, width, height, displayX, py, displayGray)
      writeIntensity(pixels, mask, width, height, displayX - 1, py, displayGray * 0.68)
      writeIntensity(pixels, mask, width, height, displayX + 1, py, displayGray * 0.68)
      writeIntensity(pixels, mask, width, height, displayX - 2, py, displayGray * 0.22)
      writeIntensity(pixels, mask, width, height, displayX + 2, py, displayGray * 0.22)

      cumulativeAttenuation += material.attenuation * (stepMm / 10) * 0.055
      if (material.castsShadow && depthMm < 52) {
        ribHitOnBeam = true
        if (!shallowBoneShadowed) {
          shadow *= 0.38
          shallowBoneShadowed = true
        }
      }
      previousLabel = renderLabel
    }

    if (bestFluidRun > 0) {
      fluidBeamCount += 1
    }
    if (ribHitOnBeam) {
      ribShadowBeamCount += 1
    }
    fluidRuns.push(bestFluidRun)
  }

  const maxFluidPocketMm = Math.max(0, ...fluidRuns)
  const fluidRunsAboveNoise = fluidRuns.filter((run) => run > 2)
  const meanFluidPocketMm =
    fluidRunsAboveNoise.reduce((total, run) => total + run, 0) /
    Math.max(1, fluidRunsAboveNoise.length)

  return {
    imageData: renderImageData(pixels, mask, width, height),
    metrics: {
      maxFluidPocketMm,
      meanFluidPocketMm,
      fluidBeamFraction: fluidBeamCount / beamCount,
      ribShadowBeamFraction: ribShadowBeamCount / beamCount,
      diaphragmSeen,
      lungSeen,
      solidOrganSeen,
      centralNeedle: assessNeedlePath(volume, probe),
    },
  }
}
