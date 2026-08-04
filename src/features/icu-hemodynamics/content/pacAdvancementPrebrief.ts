/**
 * The safety prebrief shown before the learner first moves the simulated catheter (H0/H1 §5).
 *
 * Authored strictly from claims already reviewed and sourced inside this module. Where the package
 * asked for a stop condition that no registered source in this repository supports, it is named in
 * `notCoveredHere` rather than invented — see the note on that constant. Nothing here carries a
 * numeric threshold, an inflation-time limit, or a balloon volume, because no source in this module
 * supplies one.
 */

export interface PacPrebriefStopCondition {
  readonly id: string
  /** What the learner sees or hears. */
  readonly trigger: string
  /** What to do about it, bounded to what the sources support. */
  readonly response: string
  readonly sourceIds: readonly string[]
}

/**
 * The distinction the lesson exists to protect: recognizing waveforms is not the same as being able
 * to place a catheter in a patient.
 */
export const pacPrebriefScope = {
  teaches:
    'Recognizing which chamber a pressure waveform comes from, in what order those waveforms appear, and which observations mean stop.',
  doesNotTeach:
    'Placing or manipulating a pulmonary-artery catheter in a patient. Nothing here establishes that skill, and idealized waveforms are easier to read than the ones on a real monitor.',
  supervision:
    'At the bedside this is done under qualified supervision and your institution’s own procedure protocol, with the manufacturer’s instructions for the specific catheter in use.',
} as const

export const pacPrebriefBeforeYouStart: readonly string[] = [
  'A valid pressure system: leveled, zeroed, an intact fluid path, and a dynamic response you have classified.',
  'A stable reference for the normal right-atrial, right-ventricular, pulmonary-artery, and wedge waveforms, so a transition is recognizable when it happens.',
  'Continuous rhythm monitoring, watched throughout — not checked once at the start.',
] as const

export const pacPrebriefExpectedTransitions: readonly string[] = [
  'The order is introducer, right atrium, right ventricle, pulmonary artery — and, only from a confirmed pulmonary-artery position, a brief wedge.',
  'Each transition is confirmed by the waveform. Insertion depth is a rough landmark for what to expect next, never the confirmation itself.',
  'The balloon stays deflated inside the introducer, is inflated once a right-atrial waveform is confirmed, and stays inflated for the flow-directed passage toward the pulmonary artery.',
  'Advancement stops when the pulmonary-artery waveform appears. Deflate promptly and confirm a stable pulmonary-artery signal before any wedge maneuver.',
] as const

export const pacPrebriefStopConditions: readonly PacPrebriefStopCondition[] = [
  {
    id: 'waveform-does-not-confirm',
    trigger:
      'The waveform does not confirm the chamber the insertion depth predicts, or you cannot reconcile the tracing with where the catheter should be.',
    response:
      'Do not advance further on depth alone. Re-establish a confirmed waveform first; an unconfirmed position is an unknown position.',
    sourceIds: ['pac-waveforms-part-1-2021', 'pac-review-2014', 'emcrit-rhc-supplied-2026'],
  },
  {
    id: 'ventricular-ectopy',
    trigger:
      'Ventricular ectopy appears. It is common while the tip is in the right ventricle, which is exactly why the rhythm is watched continuously.',
    response:
      'Do not ignore it, and do not manipulate the catheter without authority. Monitor the rhythm continuously and move toward a pulmonary-artery position only under appropriate supervision.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'parked-in-rv',
    trigger:
      'A ventricular contour persists — systolic pressure similar to the pulmonary artery, but diastole sloping up and no notch.',
    response:
      'Do not leave the catheter parked in the right ventricle. An unrecognized right-ventricular position risks ventricular arrhythmia and perforation, and it is missed whenever only the systolic number is read.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'spontaneous-or-over-wedge',
    trigger:
      'Pulmonary-artery pulsatility and the notch disappear without you inflating, or an occlusion tracing loses its a and v waves and drifts upward.',
    response:
      'Treat it as a potentially fatal warning sign. Deflate immediately, stop manipulating or flushing the catheter, and reassess or reposition only under appropriate supervision. Pulmonary-artery rupture associated with a balloon-tipped catheter carries a reported mortality range of roughly 30–70%.',
    sourceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
    ],
  },
  {
    id: 'do-not-flush',
    trigger: 'You suspect distal occlusion, a wedged catheter, or pulmonary-artery injury.',
    response:
      'Do not forcefully flush. Establish the position before aspirating or flushing anything.',
    sourceIds: ['monitor-workflow-supplied', 'edwards-swan-ganz-ifu-2023'],
  },
  {
    id: 'patient-deteriorates',
    trigger: 'The patient deteriorates, or the displayed signal and the patient stop agreeing.',
    response:
      'Stop advancing and treat the patient rather than the tracing. A measurement problem and a patient problem can look alike from the monitor alone, and only one of them is fixed at the monitor.',
    sourceIds: ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied'],
  },
] as const

export const pacPrebriefBalloonDiscipline: readonly string[] = [
  'Deflated inside the introducer; inflated only once a right-atrial waveform is confirmed.',
  'Inflate to the volume specified by the manufacturer for the catheter in use, and never with liquid.',
  'Occlusion is brief and deliberate. Deflate promptly and confirm the pulmonary-artery waveform returns; if it does not, treat the signal and the position as unsafe.',
  'Stop repeated inflation attempts if the waveform will not transition — manage or replace the catheter under supervision instead.',
] as const

/**
 * Stop conditions the H0/H1 brief asked for that **no registered source in this repository
 * supports**, listed rather than authored.
 *
 * Repository-wide search found nothing licensing: resistance felt on advancement as a stop rule;
 * catheter knotting, coiling, or looping; a numeric balloon-inflation time limit; a balloon volume
 * in milliliters; or conduction complications (right bundle branch block, complete heart block) on
 * crossing the tricuspid or pulmonic valve. Each is a real bedside concern and several are standard
 * teaching — which is exactly why they must come from a source rather than from this file. Flagged
 * for owner and SME review before any of them is asserted to a learner.
 */
export const pacPrebriefNotCoveredHere: readonly string[] = [
  'What resistance felt during advancement means, and when it should stop you.',
  'Catheter knotting, coiling, or looping — how it is recognized and what is done about it.',
  'How long a balloon may stay inflated, and the inflation volume in milliliters for a given catheter.',
  'Conduction complications during valve crossing, including new bundle branch block.',
] as const

export const pacPrebriefNotCoveredNotice =
  'These are not covered here because this module has no reviewed source for them yet. Get them from your institution’s procedure protocol, the manufacturer’s instructions for the catheter in use, and your supervising clinician — not from this simulation.'
