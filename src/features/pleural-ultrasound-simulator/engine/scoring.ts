import type {
  NeedlePathAssessment,
  PleuralProbeState,
  PleuralVolume,
  ProbeScore,
  UltrasoundFrameMetrics,
} from '../types'
import type { EffusionPattern } from '@/features/pleural-ultrasound/engine/types'

import { isSolidOrgan } from './labels'
import { projectBeamToWorld } from './sectorGeometry'
import { sampleLabel } from './sampleVolume'

export function assessNeedlePath(
  volume: PleuralVolume,
  probe: PleuralProbeState,
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
    if (isSolidOrgan(label)) solidOrganHit = true
    if (label === 'lung' || label === 'atelectaticLung') lungHit = true

    if (label === 'pleuralFluid') {
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

export function scoreProbeWindow(
  metrics: UltrasoundFrameMetrics,
  answer: EffusionPattern | null,
  groundTruthPattern: EffusionPattern,
): ProbeScore {
  const largestPocketFound = metrics.maxFluidPocketMm >= 40
  const avoidsRibShadow = metrics.ribShadowBeamFraction < 0.38
  const avoidsDiaphragm = !metrics.centralNeedle.diaphragmHit
  const avoidsSolidOrgan = !metrics.centralNeedle.solidOrganHit
  const needleTrajectorySafe = metrics.centralNeedle.safeWindow
  const patternClassificationCorrect = answer ? answer === groundTruthPattern : null

  const unsafeReasons = [
    !largestPocketFound ? 'scan for a larger fluid pocket' : null,
    !avoidsRibShadow ? 'center the interspace to reduce rib shadow' : null,
    !avoidsDiaphragm ? 'move above the diaphragm boundary' : null,
    !avoidsSolidOrgan ? 'avoid liver or spleen in the projected path' : null,
    !needleTrajectorySafe ? 'keep the needle line in fluid without crossing hazards' : null,
  ].filter(Boolean)

  return {
    safeWindow: largestPocketFound && avoidsRibShadow && avoidsDiaphragm && avoidsSolidOrgan,
    largestPocketFound,
    avoidsRibShadow,
    avoidsDiaphragm,
    avoidsSolidOrgan,
    patternClassificationCorrect,
    needleTrajectorySafe,
    summary:
      unsafeReasons.length === 0
        ? 'This is a strong educational window: fluid is visible, the interspace is usable, and the projected path avoids diaphragm and solid organs.'
        : `Refine the window: ${unsafeReasons.join('; ')}.`,
  }
}
