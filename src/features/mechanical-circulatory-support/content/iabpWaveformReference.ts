/**
 * An authored reference contour for the assisted arterial trace, and the record of why it exists.
 *
 * Section 3 asks a learner to recognize timing on the arterial waveform, and the two features they
 * are told to look for are the ones this simulation does not produce. Measured on the production
 * engine at the section's own 1:2 demonstration settings, matched beats, aligned timing:
 *
 *   assisted beat     systolic peak 98.1 · diastolic augmentation peak 92.4 · end-diastolic 60.5
 *   unassisted beat   systolic peak 97.8 · diastolic peak 76.2        · end-diastolic 61.0
 *
 * So the augmented peak sits below the systolic peak, and the assisted end-diastolic pressure is
 * 0.5 mm Hg below the unassisted one — a number no one can read off a trace. That is not a bug to
 * be tuned away: `generateMcsWaveformSample` adds a fixed-amplitude augmentation bump to assisted
 * beats and has no mechanism at all for reducing the pressure at the start of the next ejection,
 * and raising that amplitude until the picture matched the teaching would be changing a waveform
 * to agree with a sentence (F17).
 *
 * What is here instead is an authored diagram of the relationships the manufacturer's own booklet
 * names, on a fixed labelled pressure scale, kept visibly separate from the live trace. It is a
 * drawing of a principle. It is not this patient, not a run of this model, and not a measurement,
 * and every surface that shows it says so.
 *
 * Nothing in this file is a clinical magnitude. The booklet gives none; the report's "15–20 mm Hg
 * below unassisted" figure is a third-party interpretation that was not verified for this slice
 * and is deliberately absent. The shape below is schematic and its numbers exist only to draw it.
 */

/** The source whose text the diagram's relationships come from. */
export const MCS_IABP_REFERENCE_SOURCE_ID = 'getinge-iabp-numbers-game'

/**
 * One fixed pressure scale for every timing figure in the module.
 *
 * The live strip normalizes each window to its own minimum and maximum, so the five timing
 * demonstrations were each drawn to a different scale and could not be compared with one another
 * by eye. All five sit inside this range on the production engine (measured span 49–99 mm Hg), so
 * a common domain makes them comparable without changing a single sample.
 */
export const MCS_IABP_PRESSURE_SCALE = Object.freeze({ minMmHg: 40, maxMmHg: 120 })

export type McsIabpReferenceLandmarkId =
  | 'unassisted-systole'
  | 'diastolic-augmentation'
  | 'assisted-systole'
  | 'unassisted-end-diastolic'
  | 'assisted-end-diastolic'

export interface McsIabpReferenceLandmark {
  readonly id: McsIabpReferenceLandmarkId
  /** The booklet's own name for the landmark. */
  readonly label: string
  /** What a reader is looking for at that point, in the booklet's terms. */
  readonly relationship: string
  /** Position along the two-beat diagram, 0–1. Drawing coordinates, not physiology. */
  readonly x: number
  /** Schematic pressure in mm Hg. Exists to draw the line; it is not a clinical value. */
  readonly mmHg: number
}

/**
 * Two beats: an unassisted one, then an assisted one, as the booklet lays them out.
 *
 * The schematic pressures are chosen only to make each stated relationship visible on the scale
 * above — augmentation above systole, assisted systole below unassisted systole, assisted
 * end-diastolic below unassisted end-diastolic. No magnitude here is claimed to be the size of any
 * of those differences in a patient.
 */
export const MCS_IABP_REFERENCE_LANDMARKS: readonly McsIabpReferenceLandmark[] = Object.freeze([
  {
    id: 'unassisted-systole',
    label: 'Unassisted systole',
    relationship:
      'The peak of a beat the balloon did not assist. The comparison for everything else.',
    x: 0.14,
    mmHg: 104,
  },
  {
    id: 'unassisted-end-diastolic',
    label: 'Unassisted end-diastolic pressure',
    relationship:
      'The lowest pressure at the end of an unassisted beat — the load the next ejection would open against without the balloon.',
    x: 0.44,
    mmHg: 62,
  },
  {
    id: 'diastolic-augmentation',
    label: 'Diastolic augmentation',
    relationship:
      'Inflation at the dicrotic notch, appearing as a sharp V into the augmented peak. The booklet says this ideally rises above systole; it does not say it always does.',
    x: 0.66,
    mmHg: 112,
  },
  {
    id: 'assisted-end-diastolic',
    label: 'Assisted end-diastolic pressure',
    relationship:
      'Deflation just before ejection lowers the pressure at the end of the assisted beat, below the unassisted end-diastolic pressure. The booklet states the direction and gives no magnitude.',
    x: 0.9,
    mmHg: 52,
  },
  {
    id: 'assisted-systole',
    label: 'Assisted systole',
    relationship:
      'The ejection that follows deflation, peaking below unassisted systole because it opened against a lower pressure.',
    x: 0.97,
    mmHg: 94,
  },
])

/** Said wherever the diagram is drawn. It is the whole point of keeping it separate. */
export const MCS_IABP_REFERENCE_IDENTITY = Object.freeze({
  heading: 'Authored reference contour',
  lead: 'A drawing of the relationships a counterpulsation trace is read for, on the same pressure scale as the live strip above.',
  notThis:
    'This is not this patient’s trace, not a run of this simulation, and not a measurement. Nothing on it was produced by the model.',
  sourceLead:
    'The landmark names and each stated relationship come from Getinge’s own IABP waveform booklet, read for this slice. The drawing is this module’s, not the booklet’s figure.',
  noMagnitude:
    'The booklet gives no millimetre-of-mercury size for the reductions it describes, and none is claimed here. The pressures on the diagram exist only to draw the shape.',
  reviewNote: 'Diagram content and its rights question are open for review as OD-01 and OD-06.',
})

/**
 * What the production engine's own strip does and does not show, measured.
 *
 * Printed beside the live figure so the learner is told which of the two pictures answers which
 * question, instead of being left to discover that the live one does not carry the features.
 */
export const MCS_IABP_LIVE_TRACE_LIMITS = Object.freeze({
  heading: 'What the live trace above can and cannot show you',
  shows:
    'Where inflation and deflation fall inside the beat, which beats are assisted, and how the four timing errors move those events — all from the same clock the balloon and the 3D model use.',
  doesNotShow:
    'The two pressure relationships. Measured on this model at aligned timing and a 1:2 ratio, the augmented peak reaches about 92 mm Hg against a systolic peak of about 98, and the assisted end-diastolic pressure sits about 0.5 mm Hg below the unassisted one. This model adds a fixed-amplitude augmentation to assisted beats and models no reduction in the pressure the next ejection opens against.',
  soRead:
    'Read event timing from the live strip and the two pressure relationships from the authored reference below. Neither picture substitutes for the trace on the console in front of you.',
})
