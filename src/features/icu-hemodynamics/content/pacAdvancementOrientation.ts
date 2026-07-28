export type PacAdvancementOrientationPosition = 'introducer' | 'ra' | 'rv' | 'pa' | 'wedge'

export interface PacAdvancementOrientationStep {
  readonly position: PacAdvancementOrientationPosition
  readonly shortLabel: string
  readonly title: string
  readonly waveformFocus: string
  readonly physiologyFocus: string
  readonly techniqueFocus: string
}

/**
 * Ordered preview used before the learner performs the catheter-advancement skill.
 * The preview deliberately separates waveform recognition, chamber physiology, and
 * advancement technique so that depth or anatomy never substitutes for signal confirmation.
 */
export const pacAdvancementOrientationSteps: readonly PacAdvancementOrientationStep[] = [
  {
    position: 'introducer',
    shortLabel: 'INTRO',
    title: 'Introducer / SVC',
    waveformFocus:
      'No intracardiac pressure waveform should be assigned here from insertion depth alone.',
    physiologyFocus:
      'The distal tip is still at the venous introducer and superior vena cava entry, before a confirmed right-atrial signal.',
    techniqueFocus:
      'Keep the balloon deflated while the tip is inside the introducer. Advance only until a stable low-pressure atrial waveform appears.',
  },
  {
    position: 'ra',
    shortLabel: 'RA',
    title: 'Right atrium',
    waveformFocus:
      'Look for a low-amplitude venous tracing with a, c, and v waves and x and y descents. The distal PAC and CVP channels represent the same right-atrial pressure here.',
    physiologyFocus:
      'With controlled positive-pressure ventilation, use the trough of the slow respiratory swing for end expiration and read the base of the c wave.',
    techniqueFocus:
      'Confirm the RA waveform first. After the tip has entered the RA, inflate the flow-directed balloon before advancing toward the RV.',
  },
  {
    position: 'rv',
    shortLabel: 'RV',
    title: 'Right ventricle',
    waveformFocus:
      'Look for a steep systolic upstroke, a low diastolic pressure that slopes upward during filling, and no dicrotic notch.',
    physiologyFocus:
      'The tip has crossed the tricuspid valve. RV and PA systolic pressures can be similar, so identify the chamber from the diastolic contour rather than the peak alone.',
    techniqueFocus:
      'Confirm the RV waveform and continue flow-directed advancement with the balloon inflated; do not leave the catheter parked in the RV.',
  },
  {
    position: 'pa',
    shortLabel: 'PA',
    title: 'Pulmonary artery',
    waveformFocus:
      'Systolic pressure stays similar to the RV, while diastolic pressure steps up, slopes downward through runoff, and gains a dicrotic notch.',
    physiologyFocus:
      'The tip has crossed the pulmonic valve and entered the pulmonary artery; the notch marks pulmonic valve closure.',
    techniqueFocus:
      'Stop advancing when the PA waveform appears, promptly deflate the flow-directed balloon, and confirm the stable PA signal before any wedge maneuver.',
  },
  {
    position: 'wedge',
    shortLabel: 'PAWP',
    title: 'Normal wedge / PAWP',
    waveformFocus:
      'With brief balloon occlusion, PA pulsatility and the dicrotic notch disappear and a lower-pressure atrial waveform with delayed a and v waves appears.',
    physiologyFocus:
      'At the same PA depth, the occluded distal lumen samples left-atrial pressure through a static column of blood across the pulmonary circulation.',
    techniqueFocus:
      'Wedge only from a confirmed PA position, capture at end expiration, then deflate promptly and verify return of the PA waveform.',
  },
] as const
