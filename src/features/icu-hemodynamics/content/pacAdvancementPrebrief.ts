import { HEMODYNAMICS_NUMBERS } from './teachingNumbers'

/**
 * The prebrief shown before the learner first moves the simulated catheter: what to expect, and
 * the first move for each thing that goes off plan. Numbers come from the numbers register.
 */

export interface PacPrebriefStopCondition {
  readonly id: string
  /** What the learner sees or hears. */
  readonly trigger: string
  /** The first move, in order. */
  readonly response: string
  readonly sourceIds: readonly string[]
}

/** What the lesson teaches, and what the bedside adds. */
export const pacPrebriefScope = {
  teaches:
    'Which chamber a pressure waveform comes from, the order the waveforms appear in, and the first move when one does not appear.',
  doesNotTeach:
    'The feel of the catheter. Idealized waveforms are easier to read than the ones on a real monitor.',
  supervision: 'Your first catheters are floated under qualified supervision.',
} as const

export const pacPrebriefBeforeYouStart: readonly string[] = [
  'A valid pressure system: leveled, zeroed, an intact fluid path, and a dynamic response you have classified.',
  'The normal right-atrial, right-ventricular, pulmonary-artery, and wedge waveforms in your head, so a transition is recognizable when it happens.',
  'Continuous rhythm monitoring, watched throughout, with a defibrillator available.',
] as const

export const pacPrebriefExpectedTransitions: readonly string[] = [
  'The order is introducer, right atrium, right ventricle, pulmonary artery, then a brief wedge from a confirmed pulmonary-artery position.',
  'The waveform confirms each transition. Depth tells you what to expect next.',
  `The balloon stays down inside the introducer, goes up with ${HEMODYNAMICS_NUMBERS.value('balloon-volume')} once a right-atrial waveform is confirmed, and stays up while the catheter floats to the pulmonary artery.`,
  'Stop advancing when the pulmonary-artery waveform appears. Deflate and confirm a stable pulmonary-artery tracing before any wedge.',
] as const

export const pacPrebriefStopConditions: readonly PacPrebriefStopCondition[] = [
  {
    id: 'waveform-does-not-confirm',
    trigger:
      'Depth and waveform disagree, for example no right-ventricular tracing by 30–40 cm from the right internal jugular.',
    response:
      'Do not advance on depth alone. The catheter is usually coiling: deflate, withdraw to the right atrium, re-inflate and advance again.',
    sourceIds: ['pac-waveforms-part-1-2021', 'pac-review-2014', 'emcrit-rhc-supplied-2026'],
  },
  {
    id: 'ventricular-ectopy',
    trigger: `Ventricular ectopy with the tip in the right ventricle: ${HEMODYNAMICS_NUMBERS.value('flotation-ectopy')}, usually self-limited.`,
    response:
      'Do not leave the tip sitting in the ventricle. If the ectopy is sustained, advance promptly through to the pulmonary artery with the balloon up, or deflate and withdraw to the right atrium. Treat a sustained arrhythmia as you would any other.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'parked-in-rv',
    trigger:
      'A ventricular contour persists: systolic pressure like the pulmonary artery, but diastole near zero and sloping up, with no notch.',
    response:
      'The tip is still in the right ventricle, where it causes arrhythmia and can perforate. Advance to the pulmonary artery or withdraw to the right atrium; do not leave it there.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'resistance',
    trigger: 'You feel resistance to advancing.',
    response:
      'Never push against resistance. Deflate, withdraw to the last chamber where the catheter moved freely, check the position on the tracing and the depth, and try again. Repeated failure means fluoroscopy.',
    sourceIds: ['pac-review-2014', 'edwards-swan-ganz-ifu-2023'],
  },
  {
    id: 'spontaneous-or-over-wedge',
    trigger:
      'The pulmonary-artery tracing flattens to a wedge without the balloon up, or an occlusion tracing loses its a and v waves and climbs.',
    response: `Deflate at once and confirm the syringe is passive. Do not flush. Withdraw until the pulmonary-artery tracing returns. ${capitalize(HEMODYNAMICS_NUMBERS.value('overwedge-volume'))}: withdraw. Pulmonary-artery rupture carries a mortality of ${HEMODYNAMICS_NUMBERS.value('pa-rupture-mortality')}.`,
    sourceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
    ],
  },
  {
    id: 'do-not-flush',
    trigger:
      'You suspect a wedged catheter or pulmonary-artery injury, for example hemoptysis after a wedge.',
    response:
      'Do not flush. For hemoptysis: deflate, turn the patient affected side down, secure the airway and call for help.',
    sourceIds: ['monitor-workflow-supplied', 'edwards-swan-ganz-ifu-2023'],
  },
  {
    id: 'patient-deteriorates',
    trigger: 'The patient deteriorates while you are advancing.',
    response:
      'Stop advancing and deflate. Look at the patient and the rhythm first, and treat what you find. Resume only when the patient is stable.',
    sourceIds: ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied'],
  },
] as const

export const pacPrebriefBalloonDiscipline: readonly string[] = [
  'Down inside the introducer; up only once a right-atrial waveform is confirmed.',
  `Inflate slowly with ${HEMODYNAMICS_NUMBERS.value('balloon-volume')}, never liquid, and stop as soon as the tracing wedges.`,
  `Keep each wedge brief: just long enough to read the value at end expiration. Deflate and confirm the pulmonary-artery tracing returns; if it does not, ${HEMODYNAMICS_NUMBERS.value('retract-distance')}.`,
  'If the tracing will not wedge with the full volume, do not add more. Deflate and reposition.',
] as const

/** Bedside topics this module does not teach yet. */
export const pacPrebriefNotCoveredHere: readonly string[] = [
  'Conduction complications during valve crossing, including new bundle branch block.',
  'Catheter knotting and how it is removed.',
] as const

export const pacPrebriefNotCoveredNotice =
  'Ask your supervising attending about these before your first catheter.'

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
