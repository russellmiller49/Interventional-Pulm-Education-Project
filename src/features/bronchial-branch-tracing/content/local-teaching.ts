import type { CtCheckpoint, LocalExerciseSpec } from './ct-types'

// Source-specific observations of the supplied geometry, not reviewed CT findings.
const NOTES: Record<string, [string, string]> = {
  'junction-1': [
    'The supplied parent is the trachea above the carina.',
    'Compare the right and left main bronchial locations at the same daughter level.',
  ],
  'junction-3': [
    'The supplied parent is the left main bronchus.',
    'The model separates the lower- and upper-lobe continuations at different levels; return to the parent for each.',
  ],
  'junction-6': [
    'Begin in the left lower-lobe bronchus before the superior/basal division.',
    'Compare the posterior LB6 location with the more caudal basal continuation.',
  ],
  'junction-14': [
    'Begin in RB1. Both model daughters advance toward cranial levels.',
    'Compare RB1b and RB1a across the 422–424 interval; the labels identify these source subsegments.',
  ],
  'junction-9': [
    'Begin in RLL before the basal/superior division.',
    'The basal model location is more caudal than the RB6 location. This differs from the cranial RB1 example.',
  ],
  'junction-10': [
    'The RML parent and both daughter locations lie near axial level 307.',
    'Follow the in-plane RML connection toward RB4 and RB5, then inspect the neighboring planes.',
  ],
  'junction-19': [
    'This next local interval starts in RB4; the supplied daughter points share level 307.',
    'Compare the in-plane separation of these source daughters. Slice movement alone cannot represent this course.',
  ],
  'junction-20': [
    'Begin in RB5 before its subsegmental division.',
    'Compare RB5a at level 309 with RB5b at 301. This is the same division revisited, not a new anatomical transfer case.',
  ],
  'junction-16': [
    'Begin in RB3a. The model daughters move laterally with different changes in level.',
    'Keep the neighboring continuation in view while comparing lateral displacement and cranial–caudal change.',
  ],
  'junction-23': [
    'Begin in the left upper division. This regional comparison has a stronger craniocaudal component.',
    'Compare LB3 and LB1+2. This is a regional contrast, not an interchangeable copy of the RB3a oblique pattern.',
  ],
  'junction-11': [
    'Begin the recorded short route at LB6 after the caudal LLL approach. LB6 itself now advances cranially.',
    'The reference continues into source edge 23 toward more cranial levels. Preserve the other daughter when adding this division.',
  ],
  'junction-25': [
    'This division continues directly from edge 23 into its daughters.',
    'Compare both daughter locations before accepting the reference continuation into edge 50.',
  ],
  'junction-52': [
    'The final mapped division is reached along edge 50.',
    'Both supplied daughters lie cranial to the parent here. Distal travel has reversed the earlier caudal direction.',
  ],
}

export function localTeaching(spec: LocalExerciseSpec, point: CtCheckpoint) {
  const note = NOTES[point.id]
  if (!note) throw new Error(`Missing local teaching for ${spec.traceId}/${point.id}`)
  const warm = spec.kind === 'same-lumen' || spec.kind === 'viewpoint'
  return {
    finding: warm
      ? `Keep the supplied ${point.decision!.parent.airway.code} lumen in view before its division.`
      : note[0],
    comparison: warm
      ? 'Replay the intervening planes and compare the same lumen with its starting location.'
      : note[1],
    interval:
      'A model connection does not establish a visible lumen connection; backtrack when the image is unclear.',
  }
}

/** A demonstration of the same division is guided application. */
export function parentViewTask(spec: LocalExerciseSpec, exampleIndex: number) {
  if (['same-lumen', 'viewpoint', 'integration'].includes(spec.kind)) return 'none'
  if (exampleIndex === 0) return 'guided'
  return spec.kind === 'bifurcation' || spec.kind === 'parent-view' ? 'independent' : 'none'
}
