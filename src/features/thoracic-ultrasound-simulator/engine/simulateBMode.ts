import type {
  ThoracicFrameMetrics,
  ThoracicProbeState,
  ThoracicStructureLabel,
  ThoracicVolume,
  TissueModel,
  Vec3,
} from '../types'

import { defaultThoracicTissueModel } from './tissueModel'
import { assessNeedlePath } from './needlePath'
import { beamDirection, probeOrigin, projectBeamToWorld } from './sectorGeometry'
import { sampleLabel } from './sampleVolume'

export interface SimulateBModeInput {
  volume: ThoracicVolume
  probe: ThoracicProbeState
  width: number
  height: number
  model?: TissueModel
  /**
   * When false the beam loop only accumulates metrics (cheap, synchronous, no
   * pixel writes or smoothing) so scoring can run on every probe move without
   * paying for an image nobody displays. When true it also rasterizes the fan
   * and returns ImageData.
   */
  renderImage?: boolean
}

export interface SimulatedBModeFrame {
  imageData: ImageData | null
  metrics: ThoracicFrameMetrics
}

export interface RenderedBModeFrame extends SimulatedBModeFrame {
  imageData: ImageData
}

const DEG2RAD = Math.PI / 180

/** Curvature radius of the virtual curvilinear transducer face, in mm. */
const FACE_RADIUS_MM = 45
/** Soft-tissue attenuation the time-gain-compensation curve assumes. */
const REFERENCE_ATTENUATION = 0.52
/** Converts material attenuation units into per-mm log-amplitude loss. */
const ATTENUATION_SCALE = 0.021
/** Ceiling on combined TGC + posterior-enhancement gain. */
const MAX_DEPTH_GAIN = 2.3

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function fract(value: number) {
  return value - Math.floor(value)
}

function pixelHash(a: number, b: number) {
  return fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453)
}

function logCompressToByte(rawEcho: number, dynamicRangeDb: number) {
  const db = 20 * Math.log10(Math.max(rawEcho, 0.00001))
  const normalized = (db + dynamicRangeDb) / dynamicRangeDb
  return clampByte(normalized * 255)
}

/**
 * Distance from the transducer face to first tissue contact along the central
 * beams. The probe pose may hover a little off the skin surface; cropping this
 * air standoff radially is visually equivalent to pressing the probe onto the
 * skin, so the image starts at the entry line instead of an air gap.
 */
function findContactDepthMm(
  volume: ThoracicVolume,
  probe: ThoracicProbeState,
  maxDepthMm: number,
): number | null {
  const origin = probeOrigin(probe)
  const searchLimit = Math.min(70, maxDepthMm)
  let contact: number | null = null

  for (const beamFraction of [0.5, 0.35, 0.65]) {
    const direction = beamDirection(probe, probe.sectorAngleDeg * (beamFraction - 0.5))
    for (let depth = 0; depth <= searchLimit; depth += 1.5) {
      const label = sampleLabel(volume, [
        origin[0] + direction[0] * depth,
        origin[1] + direction[1] * depth,
        origin[2] + direction[2] * depth,
      ])
      if (label !== 'background') {
        if (contact === null || depth < contact) {
          contact = depth
        }
        break
      }
    }
  }

  return contact
}

/**
 * March every scanline through the volume once, producing a polar (beam x
 * depth) grid of display intensities. Working in the acquisition domain first
 * — and only scan-converting to screen space at the end — is what real systems
 * do, and it is what makes the output read as ultrasound instead of a colored
 * splat: speckle correlates along the beam, shadows follow scanlines, and the
 * point-spread blur can widen with depth.
 */
function marchPolarGrid(
  volume: ThoracicVolume,
  probe: ThoracicProbeState,
  model: TissueModel,
  beams: number,
  samples: number,
) {
  const maxDepthMm = probe.depthCm * 10
  const stepMm = maxDepthMm / Math.max(1, samples - 1)
  const display = new Float32Array(beams * samples)
  const origin = probeOrigin(probe)
  const contactMm = findContactDepthMm(volume, probe, maxDepthMm)
  const inContact = contactMm !== null
  const cropMm = contactMm ?? 0

  // Per-beam scratch buffers, reused across beams.
  const beamLabels: ThoracicStructureLabel[] = new Array<ThoracicStructureLabel>(samples)
  const beamRenderLabels: ThoracicStructureLabel[] = new Array<ThoracicStructureLabel>(samples)
  const beamGray = new Float32Array(samples)
  const beamBoundary = new Float32Array(samples)
  const beamCortex = new Uint8Array(samples)

  for (let beam = 0; beam < beams; beam += 1) {
    const sectorAngleDeg = probe.sectorAngleDeg * (beam / Math.max(1, beams - 1) - 0.5)
    const direction = beamDirection(probe, sectorAngleDeg)
    // Small per-beam gain variation keeps the fan from looking machine-flat.
    const beamGain = 0.96 + 0.08 * pixelHash(beam * 1.31, 7.7)
    let attenuation = 0
    let shadow = 1
    let previousLabel: ThoracicStructureLabel = 'background'
    let airSurfaceDepthMm: number | null = null

    for (let sample = 0; sample < samples; sample += 1) {
      // Display depth (from the entry line) vs ray depth (from the probe pose):
      // the air standoff before contact is cropped out of the image.
      const depthMm = sample * stepMm
      const rayDepthMm = cropMm + depthMm
      // Two-scale deterministic jitter dithers the labelmap's voxel staircase
      // into organic boundaries: a coarse component displaced coherently over
      // ~5mm blocks plus a fine per-sample grain.
      const block = sample >> 4
      const jitterX =
        (pixelHash(beam * 7.13, block * 3.71) - 0.5) * 1.4 +
        (pixelHash(beam * 7.51, sample * 3.17) - 0.5) * 0.5
      const jitterY =
        (pixelHash(beam * 2.97, block * 8.31) - 0.5) * 1.4 +
        (pixelHash(beam * 2.39, sample * 8.93) - 0.5) * 0.5
      const jitterZ =
        (pixelHash(beam * 5.53, block * 6.19) - 0.5) * 1.4 +
        (pixelHash(beam * 5.11, sample * 6.71) - 0.5) * 0.5
      const world: Vec3 = [
        origin[0] + direction[0] * rayDepthMm + jitterX,
        origin[1] + direction[1] * rayDepthMm + jitterY,
        origin[2] + direction[2] * rayDepthMm + jitterZ,
      ]
      const label = sampleLabel(volume, world)
      // Once the probe has contact, the whole fan is in tissue: unlabeled
      // voxels render as fill. With no contact at all the fan stays dark.
      const renderLabel = label === 'background' && inContact ? model.fillLabel : label
      const material = model.materials[renderLabel] ?? model.materials.background
      let boundaryEcho = model.interfaceEcho(previousLabel, renderLabel)
      if (previousLabel === 'background' && renderLabel !== 'background' && sample > 0) {
        // Entry into tissue: strong specular line where the beam meets skin.
        boundaryEcho = Math.max(boundaryEcho, 0.85)
      }

      if (material.airInterface && airSurfaceDepthMm === null) {
        airSurfaceDepthMm = depthMm
      }
      // Reverberation bands (A-line analogue) below an air interface.
      const reverbEcho =
        material.airInterface && airSurfaceDepthMm !== null && depthMm > airSurfaceDepthMm + 10
          ? Math.max(0, 0.09 - (((depthMm - airSurfaceDepthMm) % 22) / 22) * 0.09)
          : 0

      // TGC assumes reference soft tissue, so regions that attenuate less
      // (fluid) come out brighter behind — posterior enhancement for free.
      const timeGain = Math.exp(REFERENCE_ATTENUATION * ATTENUATION_SCALE * depthMm)
      const depthGain = Math.min(MAX_DEPTH_GAIN, timeGain * Math.exp(-attenuation))
      const scatterAmp = model.texture(world, renderLabel, depthMm)
      const noiseAmp =
        0.0009 *
        (0.3 + 0.7 * pixelHash(beam * 3.1, sample * 1.7)) *
        Math.min(3.2, Math.sqrt(timeGain))
      const rawEcho =
        (scatterAmp + boundaryEcho * material.reflectivity + reverbEcho) *
          depthGain *
          shadow *
          probe.gain *
          beamGain +
        noiseAmp

      beamLabels[sample] = label
      beamRenderLabels[sample] = renderLabel
      beamGray[sample] = logCompressToByte(rawEcho, probe.dynamicRangeDb)
      beamBoundary[sample] = boundaryEcho
      beamCortex[sample] =
        label === 'rib' && (previousLabel !== 'rib' || boundaryEcho > 0.18) ? 1 : 0

      attenuation += material.attenuation * stepMm * ATTENUATION_SCALE
      if (material.castsShadow) {
        // Clean bone shadow: amplitude collapses within a few mm of cortex.
        shadow *= Math.exp(-stepMm * 0.5)
      } else if (material.airInterface) {
        // Dirty air shadow: gradual decay leaves reverberation haze visible.
        shadow *= Math.exp(-stepMm * 0.085)
      }
      previousLabel = renderLabel
    }

    for (let sample = 0; sample < samples; sample += 1) {
      const label = beamLabels[sample]
      const fluidBoundary =
        label === model.fluidLabel &&
        (beamBoundary[sample] > 0.16 ||
          (sample > 0 && beamLabels[sample - 1] !== model.fluidLabel) ||
          (sample + 1 < samples && beamLabels[sample + 1] !== model.fluidLabel))

      display[beam * samples + sample] = model.displayGray({
        label,
        renderLabel: beamRenderLabels[sample],
        gray: beamGray[sample],
        boundaryEcho: beamBoundary[sample],
        fluidBoundary,
        ribCortex: beamCortex[sample] === 1,
      })
    }
  }

  return display
}

/**
 * Point-spread function in the polar domain: a short axial pulse-length blur,
 * then a lateral blur that widens with depth as the beam diverges. This is
 * what turns per-sample noise into correlated speckle.
 */
function applyPointSpread(display: Float32Array, beams: number, samples: number) {
  const axial = new Float32Array(display.length)

  for (let beam = 0; beam < beams; beam += 1) {
    const base = beam * samples
    for (let sample = 0; sample < samples; sample += 1) {
      let total = display[base + sample] * 3
      let weight = 3
      if (sample > 0) {
        total += display[base + sample - 1] * 2
        weight += 2
      }
      if (sample > 1) {
        total += display[base + sample - 2]
        weight += 1
      }
      if (sample + 1 < samples) {
        total += display[base + sample + 1] * 2
        weight += 2
      }
      if (sample + 2 < samples) {
        total += display[base + sample + 2]
        weight += 1
      }
      axial[base + sample] = total / weight
    }
  }

  const result = new Float32Array(display.length)
  const nearWeight = new Float32Array(samples)
  const farWeight = new Float32Array(samples)
  for (let sample = 0; sample < samples; sample += 1) {
    const sigma = 0.55 + 1.6 * (sample / Math.max(1, samples - 1))
    nearWeight[sample] = Math.exp(-0.5 / (sigma * sigma))
    farWeight[sample] = Math.exp(-2 / (sigma * sigma))
  }

  for (let beam = 0; beam < beams; beam += 1) {
    for (let sample = 0; sample < samples; sample += 1) {
      const w1 = nearWeight[sample]
      const w2 = farWeight[sample]
      let total = axial[beam * samples + sample]
      let weight = 1
      if (beam > 0) {
        total += axial[(beam - 1) * samples + sample] * w1
        weight += w1
      }
      if (beam > 1) {
        total += axial[(beam - 2) * samples + sample] * w2
        weight += w2
      }
      if (beam + 1 < beams) {
        total += axial[(beam + 1) * samples + sample] * w1
        weight += w1
      }
      if (beam + 2 < beams) {
        total += axial[(beam + 2) * samples + sample] * w2
        weight += w2
      }
      result[beam * samples + sample] = total / weight
    }
  }

  return result
}

/**
 * Scan-convert the polar grid into a curvilinear sector on the output canvas:
 * virtual apex above the image, curved transducer face at depth zero, arc at
 * the bottom, black outside, with anti-aliased edges and centimetre ticks.
 */
function scanConvert(
  display: Float32Array,
  beams: number,
  samples: number,
  probe: ThoracicProbeState,
  width: number,
  height: number,
) {
  const image = new ImageData(width, height)
  const maxDepthMm = probe.depthCm * 10
  const halfRad = (probe.sectorAngleDeg / 2) * DEG2RAD
  const sectorRad = probe.sectorAngleDeg * DEG2RAD
  const sinHalf = Math.sin(halfRad)
  const cosHalf = Math.cos(halfRad)

  const scale = Math.min(
    (height - 14) / (maxDepthMm + FACE_RADIUS_MM * (1 - cosHalf)),
    (width / 2 - 4) / ((FACE_RADIUS_MM + maxDepthMm) * sinHalf),
  )
  const apexY = 8 - FACE_RADIUS_MM * scale * cosHalf
  const centerX = width / 2

  for (let y = 0; y < height; y += 1) {
    const dy = y - apexY
    for (let x = 0; x < width; x += 1) {
      const offset = (x + y * width) * 4
      const dx = x - centerX
      const radiusPx = Math.hypot(dx, dy)
      const radiusMm = radiusPx / scale
      const angle = Math.atan2(dx, dy)

      // Distance (in px) to the nearest sector edge, for a soft boundary.
      const edge = Math.min(
        (halfRad - Math.abs(angle)) * radiusPx,
        (radiusMm - FACE_RADIUS_MM) * scale,
        (FACE_RADIUS_MM + maxDepthMm - radiusMm) * scale,
      )

      let value = 0
      if (edge > 0) {
        const beamPos = (angle / sectorRad + 0.5) * (beams - 1)
        const samplePos = ((radiusMm - FACE_RADIUS_MM) / maxDepthMm) * (samples - 1)
        const b0 = Math.max(0, Math.min(beams - 2, Math.floor(beamPos)))
        const s0 = Math.max(0, Math.min(samples - 2, Math.floor(samplePos)))
        const bt = Math.max(0, Math.min(1, beamPos - b0))
        const st = Math.max(0, Math.min(1, samplePos - s0))
        const topRow = display[b0 * samples + s0] * (1 - bt) + display[(b0 + 1) * samples + s0] * bt
        const bottomRow =
          display[b0 * samples + s0 + 1] * (1 - bt) + display[(b0 + 1) * samples + s0 + 1] * bt
        const lateralVignette = 1 - 0.18 * Math.pow(Math.abs(angle) / halfRad, 2.5)
        value = (topRow * (1 - st) + bottomRow * st) * lateralVignette * Math.min(1, edge / 1.2)
      }

      const gray = clampByte(value)
      image.data[offset] = gray
      image.data[offset + 1] = gray
      image.data[offset + 2] = gray
      image.data[offset + 3] = 255
    }
  }

  // Centimetre depth ticks down the right edge, aligned with the fan.
  for (let cm = 0; cm <= Math.floor(probe.depthCm); cm += 1) {
    const y = Math.round(apexY + (FACE_RADIUS_MM + cm * 10) * scale)
    if (y < 1 || y >= height - 1) continue
    const major = cm % 5 === 0
    for (let dx = major ? -2 : -1; dx <= 0; dx += 1) {
      const offset = (width - 4 + dx + y * width) * 4
      image.data[offset] = 168
      image.data[offset + 1] = 176
      image.data[offset + 2] = 186
      image.data[offset + 3] = 255
    }
  }

  return image
}

function renderBModeImage(
  volume: ThoracicVolume,
  probe: ThoracicProbeState,
  model: TissueModel,
  width: number,
  height: number,
) {
  const beams = Math.max(96, Math.min(224, Math.round(width * 0.45)))
  const samples = Math.max(160, Math.min(384, Math.round(height * 0.6)))
  const display = applyPointSpread(
    marchPolarGrid(volume, probe, model, beams, samples),
    beams,
    samples,
  )
  return scanConvert(display, beams, samples, probe, width, height)
}

export function simulateBMode(input: SimulateBModeInput & { renderImage: true }): RenderedBModeFrame
export function simulateBMode(input: SimulateBModeInput): SimulatedBModeFrame
export function simulateBMode({
  volume,
  probe,
  width,
  height,
  model = defaultThoracicTissueModel,
  renderImage = false,
}: SimulateBModeInput): SimulatedBModeFrame {
  const maxDepthMm = probe.depthCm * 10
  const stepMm = maxDepthMm / Math.max(1, height - 1)
  const beamCount = Math.round(width * 1.25)
  const fluidRuns: number[] = []
  let ribShadowBeamCount = 0
  let fluidBeamCount = 0
  let diaphragmSeen = false
  let lungSeen = false
  let solidOrganSeen = false

  for (let beam = 0; beam < beamCount; beam += 1) {
    const beamFraction = beam / Math.max(1, beamCount - 1)
    const sectorAngleDeg = probe.sectorAngleDeg * (beamFraction - 0.5)
    let currentFluidRun = 0
    let bestFluidRun = 0
    let ribHitOnBeam = false
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
        label === 'background' && (enteredPatient || depthMm < 72) ? model.fillLabel : label
      const material = model.materials[renderLabel] ?? model.materials.background

      if (label === 'diaphragm') diaphragmSeen = true
      if (label === 'lung' || label === 'atelectaticLung' || label === 'consolidation') {
        lungSeen = true
      }
      if (model.isSolidOrgan(label)) solidOrganSeen = true

      if (label === model.fluidLabel) {
        currentFluidRun += stepMm
        bestFluidRun = Math.max(bestFluidRun, currentFluidRun)
      } else {
        currentFluidRun = 0
      }

      if (material.castsShadow && depthMm < 52) {
        ribHitOnBeam = true
      }
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
    imageData: renderImage ? renderBModeImage(volume, probe, model, width, height) : null,
    metrics: {
      maxFluidPocketMm,
      meanFluidPocketMm,
      fluidBeamFraction: fluidBeamCount / beamCount,
      ribShadowBeamFraction: ribShadowBeamCount / beamCount,
      diaphragmSeen,
      lungSeen,
      solidOrganSeen,
      centralNeedle: assessNeedlePath(volume, probe, model),
    },
  }
}

/** Metrics-only convenience wrapper; never rasterizes pixels. */
export function computeBModeMetrics(input: Omit<SimulateBModeInput, 'renderImage'>) {
  return simulateBMode({ ...input, renderImage: false }).metrics
}
