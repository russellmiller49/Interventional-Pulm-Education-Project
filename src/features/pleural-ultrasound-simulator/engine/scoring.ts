import type {
  NeedlePathAssessment,
  PleuralProbeState,
  PleuralVolume,
  ProbeScore,
  UltrasoundFrameMetrics,
} from '../types'
import type { EffusionPattern } from '@/features/pleural-ultrasound/engine/types'

import { assessNeedlePath as thoracicAssessNeedlePath } from '@/features/thoracic-ultrasound-simulator/engine/needlePath'

import { toThoracicVolume } from './sampleVolume'
import { pleuralTissueModel } from './tissueModel'

export function assessNeedlePath(
  volume: PleuralVolume,
  probe: PleuralProbeState,
  stepMm = 2,
): NeedlePathAssessment {
  return thoracicAssessNeedlePath(toThoracicVolume(volume), probe, pleuralTissueModel, stepMm)
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
