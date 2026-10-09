import type { CtCheckpoint, LocalExerciseSpec } from './ct-types'

// What to look at in each division, from the airway model's own levels and directions.
// Learner-facing sentences name airways, not source edge or checkpoint identifiers.
const NOTES: Record<string, [string, string]> = {
  'junction-1': [
    'Start in the trachea above the carina.',
    'On slice 372 the carina stands between two ovals: the right main bronchus on the patient’s right, the left main bronchus on the patient’s left.',
  ],
  'junction-3': [
    'Start in the left main bronchus.',
    'The upper-lobe bronchus leaves forward and outward at about the level of the division; the lower-lobe bronchus continues backward and down. Return to the parent for each.',
  ],
  'junction-6': [
    'Start in the left lower-lobe bronchus, above where LB6 leaves it.',
    'LB6 is the posterior part of the dark area on slice 326; the basal trunk is the single lumen lower down, on slice 313.',
  ],
  'junction-14': [
    'Start in RB1. Both daughters keep climbing.',
    'On slices 422 to 424 RB1b is the anterior ring and RB1a the posterior ring.',
  ],
  'junction-9': [
    'Start in the right lower-lobe bronchus, above where RB6 leaves it.',
    'The basal trunk continues down to slice 294; RB6 reaches backward and is marked higher, on slice 309. Unlike RB1, the two daughters go opposite ways.',
  ],
  'junction-10': [
    'The middle-lobe bronchus and both daughters lie on or next to slice 307.',
    'Follow the middle-lobe channel in the plane to its fork: RB4 carries on laterally, RB5 turns forward. Then look one slice up and down.',
  ],
  'junction-19': [
    'Start in RB4; both daughters are marked on slice 307.',
    'The two daughters part front to back within the plane, 6 mm apart. Scrolling will not separate them: follow the channel across the slice to its fork.',
  ],
  'junction-20': [
    'Start in RB5, at the front end of its channel.',
    'RB5a rises to slice 309; RB5b drops to slice 301. This lesson shows the same division twice.',
  ],
  'junction-16': [
    'Start in RB3a. Both daughters head laterally; one climbs and one descends.',
    'The cranial daughter is marked on slice 396 and the caudal one on slice 384, at almost the same spot on the screen. Slice direction tells them apart.',
  ],
  'junction-23': [
    'Start in the left upper division, a single ring that climbs straight up.',
    'From slice 374 a wall separates LB3 in front from LB1+2 behind. This division is steeper than the RB3a example.',
  ],
  'junction-11': [
    'You came down the lower-lobe bronchus; LB6 itself now runs backward and up. The recorded route starts here.',
    'One daughter turns back down (slice 324), the other keeps climbing (slice 334). The reference route follows the one that climbs; keep the other on your map.',
  ],
  'junction-25': [
    'This division is the next one along the daughter you just entered.',
    'One daughter runs outward in the plane on slice 337; the other keeps climbing to slice 345. Find both before you choose.',
  ],
  'junction-52': [
    'The last mapped division is the next one along the daughter you just entered.',
    'Both daughters lie above the parent here (slices 354 and 358). You came down to reach LB6 and have been going up ever since.',
  ],
}

export function localTeaching(spec: LocalExerciseSpec, point: CtCheckpoint) {
  const note = NOTES[point.id]
  if (!note) throw new Error(`Missing local teaching for ${spec.traceId}/${point.id}`)
  const warm = spec.kind === 'same-lumen' || spec.kind === 'viewpoint'
  return {
    finding: warm
      ? `Keep the ${point.decision!.parent.airway.code} lumen in view above its division.`
      : note[0],
    comparison: warm
      ? 'Replay the intervening planes and compare the same lumen with its starting location.'
      : note[1],
    interval: 'If you lose the lumen, step back to the last slice you were sure of.',
  }
}

/** A demonstration of the same division is guided application. */
export function parentViewTask(spec: LocalExerciseSpec, exampleIndex: number) {
  if (['same-lumen', 'viewpoint', 'integration'].includes(spec.kind)) return 'none'
  if (exampleIndex === 0) return 'guided'
  return spec.kind === 'bifurcation' || spec.kind === 'parent-view' ? 'independent' : 'none'
}
