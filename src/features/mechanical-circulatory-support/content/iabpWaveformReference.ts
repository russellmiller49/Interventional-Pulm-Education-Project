/**
 * A labeled reference contour for the assisted arterial trace.
 *
 * Until 2026-10-08 the live strip did not draw the two relationships a learner is told to look
 * for, and this diagram stood in for them. The engine now draws them (`iabpPressureEffect` in
 * `engine/model.ts`): at aligned timing and 1:2 the augmented peak stands above unassisted
 * systole, and the assisted end-diastolic and assisted systolic pressures sit below their
 * unassisted partners. The diagram stays as a key to the five landmark names.
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
  heading: 'The five landmarks',
  lead: 'A labeled diagram of the pressures a counterpulsation trace is read by, on the same pressure scale as the live strip above.',
  notThis:
    'The live strip shows the same five landmarks for this patient; the readout beside it gives their pressures.',
  sourceLead:
    'The landmark names and each relationship come from Getinge’s IABP waveform booklet. The drawing is original.',
  noMagnitude:
    'How large each change is depends on the patient: balloon volume, heart rate, stroke volume and how stiff the aorta is.',
  reviewNote:
    'Check timing at a 1:2 ratio, so an assisted beat and an unassisted beat sit side by side.',
})

/**
 * What the production engine's own strip does and does not show, measured.
 *
 * Printed beside the live figure so the learner is told which of the two pictures answers which
 * question, instead of being left to discover that the live one does not carry the features.
 */
export const MCS_IABP_LIVE_TRACE_LIMITS = Object.freeze({
  heading: 'Reading the live trace',
  shows:
    'Where inflation and deflation fall inside the beat, which beats are assisted, and how each timing error changes the shape, all from the same clock the balloon and the 3D model use.',
  doesNotShow:
    'With good timing, three things are true. The augmented diastolic peak stands above unassisted systole. The assisted end-diastolic pressure is lower than the unassisted one. The assisted systolic peak is lower than unassisted systole. Late deflation removes the last two; late or early inflation shrinks the first.',
  soRead:
    'Set the ratio to 1:2 to check timing: the strip then shows an assisted beat and an unassisted beat side by side.',
})
