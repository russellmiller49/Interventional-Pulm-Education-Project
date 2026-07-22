import { IMPELLA_RP_ADVANCEMENT_PROGRESS } from '@/features/cardiac-anatomy/content/paths'

import type { ImpellaRightPosition } from '../../engine'

export interface ImpellaRpEndpointProgress {
  head: number
  inlet: number
}

const RP_PHYSICAL_SPAN_PROGRESS =
  IMPELLA_RP_ADVANCEMENT_PROGRESS.correct - IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet

/**
 * Separates RP outlet and inlet teaching faults without inventing valve morphology.
 * The inlet-too-high target lies within the reviewed RA route segment between the CT-derived
 * IVC inlet and the tricuspid-location gate; it is a non-target malposition, not a leaflet target.
 */
export function impellaRpEndpointProgress(
  position: ImpellaRightPosition,
): ImpellaRpEndpointProgress {
  if (position === 'inlet-too-high') {
    return {
      head: IMPELLA_RP_ADVANCEMENT_PROGRESS.correct,
      inlet:
        IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet +
        (IMPELLA_RP_ADVANCEMENT_PROGRESS.tricuspidGate - IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet) *
          0.55,
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
