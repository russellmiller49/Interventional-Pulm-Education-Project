import { IMPELLA_RP_ADVANCEMENT_PROGRESS } from '@/features/cardiac-anatomy/content/paths'

import type { ImpellaRightPosition } from '../../engine'

export interface ImpellaRpEndpointProgress {
  head: number
  inlet: number
}

const RP_PHYSICAL_SPAN_PROGRESS =
  IMPELLA_RP_ADVANCEMENT_PROGRESS.correct - IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet

/**
 * Keeps the fixed 205 mm inlet-to-outlet span invariant in every RP teaching state.
 * An inlet that has migrated into the RA necessarily displaces the distal assembly farther into
 * the PA in this centerline model; shortening the cannula to hold the outlet fixed is not physical.
 */
export function impellaRpEndpointProgress(
  position: ImpellaRightPosition,
): ImpellaRpEndpointProgress {
  if (position === 'inlet-too-high') {
    const inlet =
      IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet +
      (IMPELLA_RP_ADVANCEMENT_PROGRESS.tricuspidGate - IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet) *
        0.55
    return {
      head: Math.min(1, inlet + RP_PHYSICAL_SPAN_PROGRESS),
      inlet,
    }
  }

  const head =
    position === 'too-distal'
      ? IMPELLA_RP_ADVANCEMENT_PROGRESS.tooDistal
      : position === 'outlet-too-proximal'
        ? IMPELLA_RP_ADVANCEMENT_PROGRESS.tooProximal
        : IMPELLA_RP_ADVANCEMENT_PROGRESS.correct

  return {
    head,
    inlet: Math.max(0, head - RP_PHYSICAL_SPAN_PROGRESS),
  }
}
