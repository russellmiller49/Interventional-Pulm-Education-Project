// Leaf import, not the curriculum barrel: the barrel re-exports React components that reach
// next-intl navigation, and this is a content module loaded by non-DOM callers.
import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import { pacLearningPathwaySections, type PacLearningPathwaySectionId } from './pacLearningPathway'

/**
 * What a learner needs to know *before* opening a section, authored per section.
 *
 * H0/H1 requirement 6. Two deliberate choices:
 *
 * 1. The recommended prior section is derived from the pathway order (`recommendedPriorSection`
 *    below), never from the catalog's `prerequisiteActivityIds`. The catalog field is a separate
 *    dependency graph that does not have to agree with the recommended reading order, and reading
 *    it here would show a learner a "come from" section that the pathway does not put before this
 *    one.
 * 2. Nothing here gates. These are advisory facts rendered beside an always-enabled link.
 */
export interface PacSectionReadiness {
  readonly sectionId: PacLearningPathwaySectionId
  /** Plain-language placement, not a difficulty score. */
  readonly level: string
  /** What the learner should already be able to do. */
  readonly beforeStarting: string
  /** The actual activity, in the learner's terms. */
  readonly whatYouWillPractice: string
  /**
   * Which half of the module this is. The distinction matters: this module teaches signal
   * interpretation, and its catheter work is simulated waveform recognition rather than
   * instruction in placing a catheter in a patient.
   */
  readonly boundary: 'signal-interpretation' | 'simulated-procedure'
}

export const pacSectionBoundaryLabels: Readonly<
  Record<PacSectionReadiness['boundary'], { readonly label: string; readonly detail: string }>
> = {
  'signal-interpretation': {
    label: 'Signal interpretation',
    detail: 'You are reading and judging a measurement, not performing a procedure.',
  },
  'simulated-procedure': {
    label: 'Simulated procedure',
    detail:
      'A simulated catheter exercise in recognizing waveforms and knowing when to stop. It is not instruction in placing a catheter in a patient, and it does not replace supervision or local protocol.',
  },
}

export const pacSectionReadiness: Readonly<
  Record<PacLearningPathwaySectionId, PacSectionReadiness>
> = {
  'pressure-system': {
    sectionId: 'pressure-system',
    level: 'Start here — no earlier section is assumed',
    beforeStarting:
      'Bring basic ECG rhythm reading and familiarity with an ICU bedside monitor. No pulmonary-artery catheter experience is assumed.',
    whatYouWillPractice:
      'Leveling and zeroing a transducer, reading the displayed scale and channel, classifying a fast-flush response, and deciding whether the displayed number should be interpreted at all.',
    boundary: 'signal-interpretation',
  },
  'waveform-interpretation': {
    sectionId: 'waveform-interpretation',
    level: 'Builds directly on the pressure-system section',
    beforeStarting:
      'Be able to say whether a tracing is trustworthy before you interpret its shape — a distorted waveform is not a physiologic finding.',
    whatYouWillPractice:
      'Naming the chamber from morphology alone across RA, RV, PA, and wedge, anchoring each to the ECG and the respiratory cycle, then reading the wave components that carry a diagnosis.',
    boundary: 'signal-interpretation',
  },
  'catheter-advancement': {
    sectionId: 'catheter-advancement',
    level: 'First simulated catheter work — do the two signal sections first',
    beforeStarting:
      'Recognize the normal RA, RV, PA, and wedge tracings, and know what an untrustworthy signal looks like. Both are what tell you where the tip is.',
    whatYouWillPractice:
      'Advancing a simulated catheter from the introducer to a confirmed pulmonary-artery waveform, confirming every transition from morphology rather than insertion depth, and stopping when the signal does not confirm the position.',
    boundary: 'simulated-procedure',
  },
  'pawp-capture': {
    sectionId: 'pawp-capture',
    level: 'Continues the simulated catheter work',
    beforeStarting:
      'Hold a confirmed pulmonary-artery position and be able to tell a true wedge tracing from an over-wedged one.',
    whatYouWillPractice:
      'A brief end-expiratory occlusion from a confirmed PA position: sample one respiratory cycle, place the cursor, store, deflate promptly, and confirm the PA waveform returns.',
    boundary: 'simulated-procedure',
  },
  'thermodilution-series': {
    sectionId: 'thermodilution-series',
    level: 'Returns to signal interpretation, now for flow',
    beforeStarting:
      'A confirmed pulmonary-artery position and a valid pressure system; both are inputs to the measurement you are about to make.',
    whatYouWillPractice:
      'Comparing what thermodilution and Fick each measure, standardizing injection technique, inspecting every curve, and rejecting a technically poor trial instead of averaging it in.',
    boundary: 'signal-interpretation',
  },
  'derived-hemodynamics': {
    sectionId: 'derived-hemodynamics',
    level: 'Uses everything measured so far',
    beforeStarting:
      'Know which measurements each calculated value depends on, and that a derived value is an equation rather than an independent measurement.',
    whatYouWillPractice:
      'Tracing each calculated value back to its source measurements, and withholding interpretation when a required input is stale, missing, or invalid.',
    boundary: 'signal-interpretation',
  },
  'pac-signal-validation': {
    sectionId: 'pac-signal-validation',
    level: 'Integration capstone — work through the six earlier sections first',
    beforeStarting:
      'All six earlier sections. Nothing new is introduced here; this is where the separate checks are used together under time pressure.',
    whatYouWillPractice:
      'One case whose displayed numbers disagree with the patient: deciding in order whether the setup, the catheter position, the curve quality, and the derived values can be trusted before any of them changes management.',
    boundary: 'signal-interpretation',
  },
}

/**
 * The section the pathway puts immediately before this one, or null at the start.
 *
 * Derived from the authored pathway order rather than from `prerequisiteActivityIds` — see the
 * note on `PacSectionReadiness`. Advisory only: every section stays reachable by URL.
 */
export function recommendedPriorSection(
  sectionId: PacLearningPathwaySectionId,
): LearningPathwaySection | null {
  const index = pacLearningPathwaySections.findIndex((section) => section.id === sectionId)
  if (index <= 0) return null
  return pacLearningPathwaySections[index - 1] ?? null
}

export function pacSectionReadinessFor(
  sectionId: PacLearningPathwaySectionId,
): PacSectionReadiness {
  const readiness = pacSectionReadiness[sectionId]
  if (!readiness) throw new Error(`Missing PAC section readiness for ${sectionId}`)
  return readiness
}
