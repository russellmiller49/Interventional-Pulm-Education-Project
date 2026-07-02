import type {
  NeedlePathAssessment,
  ThoracicProbeState,
  ThoracicVolume,
  TissueModel,
} from '../types'

import { projectBeamToWorld } from './sectorGeometry'
import { sampleLabel } from './sampleVolume'

/**
 * Walk the projected needle line and report what it crosses. A window is "safe"
 * for teaching when it traverses a usable fluid run and never crosses a rib,
 * diaphragm, or solid organ. This is geometry-only reasoning, not clinical
 * guidance.
 */
export function assessNeedlePath(
  volume: ThoracicVolume,
  probe: ThoracicProbeState,
  model: TissueModel,
  stepMm = 2,
): NeedlePathAssessment {
  const maxDepthMm = probe.depthCm * 10
  let ribHit = false
  let diaphragmHit = false
  let solidOrganHit = false
  let lungHit = false
  let currentFluidRun = 0
  let bestFluidRun = 0
  let firstFluidDepthMm: number | null = null

  for (let depthMm = 0; depthMm <= maxDepthMm; depthMm += stepMm) {
    const label = sampleLabel(volume, projectBeamToWorld(probe, probe.needleAngleDeg, depthMm))

    if (label === 'rib') ribHit = true
    if (label === 'diaphragm') diaphragmHit = true
    if (model.isSolidOrgan(label)) solidOrganHit = true
    if (label === 'lung' || label === 'atelectaticLung' || label === 'consolidation') lungHit = true

    if (label === model.fluidLabel) {
      firstFluidDepthMm ??= depthMm
      currentFluidRun += stepMm
      bestFluidRun = Math.max(bestFluidRun, currentFluidRun)
    } else {
      currentFluidRun = 0
    }
  }

  return {
    ribHit,
    diaphragmHit,
    solidOrganHit,
    lungHit,
    fluidRunMm: bestFluidRun,
    firstFluidDepthMm,
    safeWindow: bestFluidRun >= 25 && !ribHit && !diaphragmHit && !solidOrganHit,
  }
}
