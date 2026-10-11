/**
 * What this model's reference tracings do not settle, stated where the learner compares them.
 *
 * Each statement describes a property of the generator, not of a patient. They are kept here, apart
 * from the component, so a test can hold each one to the model it describes: a statement stays only
 * while it is true of what is drawn, and a change to the generator that makes one false has to
 * remove it (HD-PRE-REVIEW-03, reports L3-03 and L3-07; both remain owner decisions).
 */
export const ventricleArteryModelNotes = {
  /** The right-ventricular fall has a change of slope where ejection ends, and no notch. */
  ventricularSlopeChange:
    'The right-ventricular fall steepens where ejection ends; that change of slope is not a notch, because the pressure keeps falling through it and never rises again, where the pulmonary-artery notch is a dip followed by a small rise.',
  /** Upstroke onset and peak are not timed against the ECG as a source describes them. */
  ecgTimingSchematic:
    'And the timing of each upstroke and peak against the ECG is schematic: this model starts the pulmonary-artery upstroke a little before the right-ventricular one and draws the pulmonary-artery peak ahead of the T wave rather than at it, so use these figures to compare diastole and the notch, not timing against the QRS and T wave.',
} as const
