import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { normalWaveformReferenceEntry } from './normalWaveformReference'
import {
  pacPrebriefNotCoveredNotice,
  pacPrebriefStopConditions,
  type PacPrebriefStopCondition,
} from './pacAdvancementPrebrief'
import { hemodynamicsSourceById } from './sources'
import { HEMODYNAMICS_NUMBERS } from './teachingNumbers'

/**
 * Advancement as a decision at each stop.
 *
 * Each scenario presents the whole situation at once: the signal, the current tracing, the rhythm,
 * the patient, whether the catheter moves freely, the balloon, and the depth. The learner commits
 * before seeing what follows. Whether continuing is safe is derived from the scenario's flags by
 * `advancementStopReasons`, never from whether the waveform matched. Each stop scenario is keyed on
 * the first move a fellow makes with their hands.
 */

export type PacAdvancementCommitment = 'advance' | 'hold' | 'stop' | 'escalate'

export const pacAdvancementCommitmentLabels: Readonly<Record<PacAdvancementCommitment, string>> = {
  advance: 'Advance',
  hold: 'Hold where you are',
  stop: 'Stop the maneuver',
  escalate: 'Stop and make the first move',
}

/** The categories of stop condition. */
export type PacAdvancementStopReason =
  | 'signal-invalid'
  | 'unexpected-waveform'
  | 'position-depth-mismatch'
  | 'resistance'
  | 'rhythm-concern'
  | 'patient-deterioration'
  | 'balloon-state-unresolved'

export const pacAdvancementStopReasonLabels: Readonly<Record<PacAdvancementStopReason, string>> = {
  'signal-invalid': 'The pressure signal cannot be trusted',
  'unexpected-waveform': 'The waveform is not the one this position predicts',
  'position-depth-mismatch': 'Waveform and depth cannot be reconciled',
  resistance: 'The catheter will not advance freely',
  'rhythm-concern': 'The rhythm needs attention',
  'patient-deterioration': 'The patient is deteriorating',
  'balloon-state-unresolved': 'The balloon state is unsettled',
}

/** One observable, stated for the learner and flagged for the derivation. */
export interface PacAdvancementObservation {
  readonly statement: string
  /** True when this observable is a reason to stop. */
  readonly concerning: boolean
}

export interface PacAdvancementScenario {
  readonly id: string
  readonly title: string
  readonly kind: 'expected-transition' | 'stop'
  readonly fromPosition: 'introducer' | 'ra' | 'rv' | 'pa'
  readonly nextPosition: 'ra' | 'rv' | 'pa' | null
  /** Step 1 — can the pressure signal be trusted at all? */
  readonly signalValidity: PacAdvancementObservation
  /** Step 2 — what the current tracing is, or that it cannot be named. */
  readonly currentTracing: PacAdvancementObservation & {
    /** Reference chamber the tracing matches, or null when it matches none. */
    readonly matchesPosition: 'ra' | 'rv' | 'pa' | 'wedge' | null
  }
  /** Step 4 — rhythm and continuous monitoring. */
  readonly rhythm: PacAdvancementObservation
  /** Step 4 — the patient, as distinct from the tracing. */
  readonly patient: PacAdvancementObservation
  /** Step 7 — does the catheter move freely? */
  readonly resistance: PacAdvancementObservation
  /** Step 7 — is the balloon state settled? */
  readonly balloon: PacAdvancementObservation
  /** Step 7 — can waveform and depth readout be reconciled? */
  readonly depth: PacAdvancementObservation
  /** Step 5 — the commitment, revealed only after it is made. */
  readonly commitment: ClinicalLearningItem
  /** Step 6 — what happens next, shown only after the commitment. */
  readonly observed: string
  /** Step 7 — the reconciliation, in words. */
  readonly reconciliation: string
  /** Step 8 — whether continuing is safe, and why. */
  readonly justification: string
  /** The already-sourced stop condition this scenario exercises. */
  readonly prebriefStopConditionId: string | null
  /** A bedside point the scenario does not cover, or null. */
  readonly unsourcedBoundary: string | null
  readonly sourceIds: readonly string[]
}

const PLACEMENT_EVIDENCE = [
  'pac-waveforms-part-1-2021',
  'pac-review-2014',
  'clinical-hemodynamics-waveforms',
]
const SIGNAL_EVIDENCE = ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied']

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const ACTIVITY_ID = 'hemodynamics:learn:catheter-advancement'

function commitmentItem(input: {
  id: string
  clinicalContextId: string
  stem: string
  choices: readonly {
    id: PacAdvancementCommitment
    label: string
    rationale: string
    plausibility: 'best' | 'reasonable-but-incomplete' | 'unsafe' | 'incorrect-mechanism'
  }[]
  correctChoiceIds: readonly PacAdvancementCommitment[]
  explanation: string
  evidenceIds: readonly string[]
}): ClinicalLearningItem {
  return item({
    id: input.id,
    activityId: ACTIVITY_ID,
    phase: 'predict',
    itemType: 'management-decision',
    contextRequirement: 'technical',
    clinicalContextId: input.clinicalContextId,
    visualAssetIds: ['pac-live-waveform'],
    stem: input.stem,
    choices: input.choices,
    correctChoiceIds: input.correctChoiceIds,
    explanation: input.explanation,
    evidenceIds: input.evidenceIds,
    reviewStatus: 'sme-review',
  })
}

/**
 * Every reason this scenario is not somewhere to advance from.
 *
 * Deliberately blind to whether the tracing matched the prediction. Recognizing the expected
 * waveform is what licenses the *next* question, never the answer to it.
 */
export function advancementStopReasons(
  scenario: PacAdvancementScenario,
): readonly PacAdvancementStopReason[] {
  const reasons: PacAdvancementStopReason[] = []
  if (scenario.signalValidity.concerning) reasons.push('signal-invalid')
  if (scenario.currentTracing.concerning) reasons.push('unexpected-waveform')
  if (scenario.depth.concerning) reasons.push('position-depth-mismatch')
  if (scenario.resistance.concerning) reasons.push('resistance')
  if (scenario.rhythm.concerning) reasons.push('rhythm-concern')
  if (scenario.patient.concerning) reasons.push('patient-deterioration')
  if (scenario.balloon.concerning) reasons.push('balloon-state-unresolved')
  return reasons
}

/** Whether advancing is defensible here. False whenever any stop reason is present. */
export function advancementMayContinue(scenario: PacAdvancementScenario): boolean {
  return advancementStopReasons(scenario).length === 0
}

/**
 * The commitments that are defensible in this scenario.
 *
 * Holding, stopping, and escalating are always available — being more cautious than the situation
 * demands is not a safety failure. Advancing is available only when nothing says stop.
 */
export function safeAdvancementCommitments(
  scenario: PacAdvancementScenario,
): readonly PacAdvancementCommitment[] {
  const cautious: readonly PacAdvancementCommitment[] = ['hold', 'stop', 'escalate']
  return advancementMayContinue(scenario) ? ['advance', ...cautious] : cautious
}

export function prebriefStopConditionFor(
  scenario: PacAdvancementScenario,
): PacPrebriefStopCondition | null {
  if (!scenario.prebriefStopConditionId) return null
  const condition = pacPrebriefStopConditions.find(
    (candidate) => candidate.id === scenario.prebriefStopConditionId,
  )
  if (!condition) {
    throw new Error(
      `Advancement scenario ${scenario.id} names an unknown prebrief stop condition: ${scenario.prebriefStopConditionId}`,
    )
  }
  return condition
}

const clean = {
  signal: {
    statement:
      'Levelled, zeroed, intact fluid path, and a fast-flush release that settles after one or two oscillations.',
    concerning: false,
  },
  rhythm: {
    statement: 'Sinus rhythm on the continuously watched monitor, with no new ectopy.',
    concerning: false,
  },
  patient: {
    statement: 'Unchanged: perfusion, blood pressure, and level of comfort all as before.',
    concerning: false,
  },
  resistance: { statement: 'The catheter is moving freely.', concerning: false },
  balloon: {
    statement: 'Flow-directed balloon state is known and matches where the tip is.',
    concerning: false,
  },
} as const

export const pacAdvancementScenarios: readonly PacAdvancementScenario[] = [
  {
    id: 'introducer-to-ra',
    title: 'Introducer toward the right atrium',
    kind: 'expected-transition',
    fromPosition: 'introducer',
    nextPosition: 'ra',
    signalValidity: clean.signal,
    currentTracing: {
      statement:
        'No intracardiac morphology yet — the tip is still inside the introducer, and nothing on the display should be named from depth alone.',
      concerning: false,
      matchesPosition: null,
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement: 'Balloon deflated inside the introducer, which is where it belongs at this point.',
      concerning: false,
    },
    depth: {
      statement:
        'Depth is consistent with a tip that has not yet entered the atrium. It predicts what to expect; it confirms nothing.',
      concerning: false,
    },
    commitment: commitmentItem({
      id: 'pac-advance-commit-introducer',
      clinicalContextId: 'pac-advancement-introducer-to-ra',
      stem: 'The pressure system is valid, the rhythm is sinus and continuously watched, the patient is unchanged, the catheter moves freely, the balloon is deflated inside the introducer, and no intracardiac waveform has appeared yet. What do you commit to?',
      choices: [
        {
          id: 'advance',
          label: 'Advance, watching for a venous tracing to appear.',
          rationale:
            'Nothing in the situation says stop, and the next thing that should happen is a right-atrial waveform appearing. Advancing here is a step taken in order to be confirmed, not one taken because it was confirmed.',
          plausibility: 'best',
        },
        {
          id: 'hold',
          label: 'Hold until an intracardiac waveform appears on its own.',
          rationale:
            'A waveform will not appear without movement. Holding is never unsafe, but here it waits for something that advancing is what produces.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'stop',
          label: 'Stop, because no waveform has confirmed a position.',
          rationale:
            'An unconfirmed position is a reason not to *assume* a chamber, not a reason to abandon a procedure that has not started. Nothing here is a stop condition.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['advance'],
      explanation:
        'Every check is clean and the expected next event is a right-atrial waveform. Advancing is defensible here for the reason that will matter throughout: nothing says stop. It would stop being defensible the moment anything did, however textbook the tracing looked.',
      evidenceIds: [...PLACEMENT_EVIDENCE, ...SIGNAL_EVIDENCE],
    }),
    observed: 'A low-amplitude venous tracing appears, with identifiable a, c, and v waves.',
    reconciliation:
      'Waveform, depth, rhythm, patient, resistance, and balloon state all agree, and the tracing matches what the reference says a right atrium looks like.',
    justification:
      'Continuing is defensible, because every observable was checked and none of them objected — not because the tracing came out as predicted.',
    prebriefStopConditionId: null,
    unsourcedBoundary: null,
    sourceIds: [...PLACEMENT_EVIDENCE, ...SIGNAL_EVIDENCE],
  },
  {
    id: 'ra-to-rv',
    title: 'Right atrium toward the right ventricle',
    kind: 'expected-transition',
    fromPosition: 'ra',
    nextPosition: 'rv',
    signalValidity: clean.signal,
    currentTracing: {
      statement:
        'A right-atrial tracing: low amplitude, a taller than v, with x and y descents, and the a wave following the P wave closely.',
      concerning: false,
      matchesPosition: 'ra',
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement:
        'The right-atrial waveform is confirmed, so the flow-directed balloon is inflated before movement toward the ventricle.',
      concerning: false,
    },
    depth: {
      statement: 'Depth is consistent with an atrial position and agrees with the waveform.',
      concerning: false,
    },
    commitment: commitmentItem({
      id: 'pac-advance-commit-ra',
      clinicalContextId: 'pac-advancement-ra-to-rv',
      stem: 'A right-atrial waveform is confirmed, the signal is valid, the rhythm is sinus and continuously watched, the patient is unchanged, the catheter moves freely, and the flow-directed balloon is inflated. What do you commit to?',
      choices: [
        {
          id: 'advance',
          label:
            'Advance, expecting a right-ventricular tracing: a sharp systolic rise and a diastole near zero.',
          rationale:
            'Nothing says stop, and the reference names exactly what should change: a large systolic step with a low diastole that may climb through filling, and none of the features that mark the pulmonary artery — not simply a higher number.',
          plausibility: 'best',
        },
        {
          id: 'hold',
          label:
            'Hold in the atrium, because ventricular ectopy is common once the tip crosses the tricuspid valve.',
          rationale:
            'That it is common is why the rhythm is watched continuously — it is a reason to be ready, not a reason to stop before anything has happened.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'escalate',
          label:
            'Stop and call the attending first, because the next chamber is the one where ectopy occurs.',
          rationale:
            'Escalating with no finding to report is not caution; it is deferring the check the situation actually calls for, which is watching the rhythm while advancing.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['advance'],
      explanation:
        'Naming the change to expect is what makes the next observation informative. A learner who advances without predicting has nothing to compare the result against, and will accept whatever appears.',
      evidenceIds: PLACEMENT_EVIDENCE,
    }),
    observed:
      'Systolic pressure steps up sharply, and diastole begins low and climbs gradually as the ventricle fills. There is no diastolic step-up, no runoff, and no dicrotic notch.',
    reconciliation:
      'The whole transition identifies the chamber rather than the peak: a low diastole that may climb through filling, and none of the step-up, runoff, or notch that would mark the pulmonary artery. Depth, rhythm, and patient all still agree.',
    justification:
      'Continuing is defensible. The right ventricle is a transit position, so stopping here would leave the catheter somewhere it should not be left — which is itself a stop condition in the prebrief.',
    prebriefStopConditionId: null,
    unsourcedBoundary: null,
    sourceIds: PLACEMENT_EVIDENCE,
  },
  {
    id: 'rv-to-pa',
    title: 'Right ventricle toward the pulmonary artery',
    kind: 'expected-transition',
    fromPosition: 'rv',
    nextPosition: 'pa',
    signalValidity: clean.signal,
    currentTracing: {
      statement:
        'A right-ventricular tracing: steep upstroke, low end-diastolic pressure, diastole sloping upward, no notch.',
      concerning: false,
      matchesPosition: 'rv',
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement: 'Flow-directed balloon inflated for the passage toward the pulmonary artery.',
      concerning: false,
    },
    depth: {
      statement: 'Depth agrees with a ventricular position.',
      concerning: false,
    },
    commitment: commitmentItem({
      id: 'pac-advance-commit-rv',
      clinicalContextId: 'pac-advancement-rv-to-pa',
      stem: 'A right-ventricular waveform is confirmed — a low diastole climbing through filling, with no step-up, no runoff, and no notch — every other observable is unchanged, and the flow-directed balloon is inflated. What do you commit to?',
      choices: [
        {
          id: 'advance',
          label:
            'Advance, expecting the diastolic pressure to step up and a dicrotic notch to appear.',
          rationale:
            'That is the whole transition, and naming all three parts of it in advance is what makes a partial change noticeable when it happens.',
          plausibility: 'best',
        },
        {
          id: 'hold',
          label: 'Hold here and record the right-ventricular pressures first.',
          rationale:
            'The right ventricle is a transit position. Lingering to collect numbers is exactly the habit that produces a catheter left in the ventricle.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'stop',
          label:
            'Stop, because right-ventricular and pulmonary-artery systolic pressures are the same and the transition therefore cannot be confirmed.',
          rationale:
            'The premise is right and the conclusion does not follow. Systolic pressure cannot distinguish the two chambers, which is why the diastolic step-up, the change in the direction diastole runs, and the notch are together what confirm the crossing.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['advance'],
      explanation:
        'Three things change together at the pulmonic valve and one thing deliberately does not. A prediction that includes the unchanged systolic pressure is the one that can detect a partial or spurious transition.',
      evidenceIds: PLACEMENT_EVIDENCE,
    }),
    observed:
      'Systolic pressure is unchanged. Diastolic pressure steps up, the diastolic slope reverses to a downward runoff, and a dicrotic notch appears on the downstroke.',
    reconciliation:
      'All three expected changes are present and systolic pressure did not move, which is what a pulmonic-valve crossing looks like. Depth, rhythm, patient, and resistance still agree.',
    justification:
      'Advancement stops here, because the pulmonary artery is the destination. The flow-directed balloon is deflated promptly and a stable pulmonary-artery signal is confirmed before any wedge maneuver.',
    prebriefStopConditionId: null,
    unsourcedBoundary: null,
    sourceIds: PLACEMENT_EVIDENCE,
  },
  {
    id: 'rv-ectopy-despite-textbook-waveform',
    title: 'Textbook right-ventricular tracing, new ectopy',
    kind: 'stop',
    fromPosition: 'rv',
    nextPosition: 'pa',
    signalValidity: clean.signal,
    currentTracing: {
      statement:
        'A textbook right-ventricular tracing — rapid systolic rise, low end-diastolic pressure, a diastole climbing through filling, and none of the pulmonary-artery features. Exactly what this position predicts.',
      concerning: false,
      matchesPosition: 'rv',
    },
    rhythm: {
      statement:
        'Runs of ventricular ectopy have appeared on the continuously watched monitor since the tip crossed the tricuspid valve.',
      concerning: true,
    },
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement: 'Flow-directed balloon inflated, as it should be at this point.',
      concerning: false,
    },
    depth: { statement: 'Depth agrees with a ventricular position.', concerning: false },
    commitment: commitmentItem({
      id: 'pac-advance-commit-ectopy',
      clinicalContextId: 'pac-advancement-rv-ectopy',
      stem: 'The right-ventricular tracing is as clean as the reference. The pressure system is valid, the patient is unchanged, and the catheter moves freely. Runs of ventricular ectopy have appeared since the tip crossed the tricuspid valve. What do you commit to?',
      choices: [
        {
          id: 'escalate',
          label:
            'Do not sit in the ventricle: go promptly through to the pulmonary artery, or deflate and withdraw to the atrium.',
          rationale:
            'The tip in the right ventricle is the irritant. Either exit ends it: through to the pulmonary artery with the balloon up, or back to the right atrium with it down. Have the defibrillator available.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Keep advancing at the same slow pace, since the tracing confirms the position and ectopy is expected here.',
          rationale:
            'Ectopy is expected, and it is usually self-limited. Runs of it are not: a slow advance keeps the tip against the ventricular wall for longer.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold the tip where it is and watch the rhythm until it settles.',
          rationale:
            'Stopping the advance is a reasonable instinct, but the tip is still in the ventricle, and that is what is driving the ectopy.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation: `Ventricular ectopy while the tip crosses the right ventricle is frequent (${HEMODYNAMICS_NUMBERS.value('flotation-ectopy')}) and usually self-limited. When it is sustained, get the tip out of the ventricle: advance promptly into the pulmonary artery, or deflate and withdraw to the right atrium. Treat a sustained arrhythmia as you would any other.`,
      evidenceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
    }),
    observed:
      'The tip leaves the ventricle and the ectopy stops. The rhythm stays under continuous watch.',
    reconciliation:
      'Waveform and depth agree with the reference. The rhythm is a separate question, and the tracing never answered it.',
    justification:
      'A clean right-ventricular tracing confirms where the tip is. It is also the reason for the ectopy.',
    prebriefStopConditionId: 'ventricular-ectopy',
    unsourcedBoundary: null,
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'rv-resistance',
    title: 'The catheter will not advance',
    kind: 'stop',
    fromPosition: 'rv',
    nextPosition: 'pa',
    signalValidity: clean.signal,
    currentTracing: {
      statement: 'A right-ventricular tracing, unchanged and still matching the reference.',
      concerning: false,
      matchesPosition: 'rv',
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: {
      statement:
        'The catheter has stopped moving forward. Further advancement meets resistance rather than travelling.',
      concerning: true,
    },
    balloon: {
      statement: 'Flow-directed balloon inflated, as it should be at this point.',
      concerning: false,
    },
    depth: {
      statement:
        'Depth has stopped changing while the waveform has stayed ventricular — the two agree, and neither is moving.',
      concerning: false,
    },
    commitment: commitmentItem({
      id: 'pac-advance-commit-resistance',
      clinicalContextId: 'pac-advancement-resistance',
      stem: 'The tracing is still a clean right-ventricular one, the signal is valid, the rhythm and the patient are unchanged — and the catheter has stopped travelling. Further advancement meets resistance. What do you commit to?',
      choices: [
        {
          id: 'escalate',
          label:
            'Deflate, withdraw to where the catheter moved freely, recheck the position, and try again.',
          rationale:
            'Never push against resistance. Back in the last chamber where the catheter moved freely, the tracing and the depth tell you where the tip is before the next attempt.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Apply a little more force, since the waveform confirms the catheter is where it should be.',
          rationale:
            'The waveform says which chamber the tip is in. It says nothing about what the catheter is caught on, and force is how a catheter knots or perforates.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold the catheter where it is and wait to see whether it frees up.',
          rationale:
            'Holding does no harm, and it leaves an inflated balloon sitting in the ventricle with nothing changed.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation:
        'Never push against resistance. Deflate, withdraw to the last chamber where the catheter moved freely, check the position on the tracing and the depth, and try again. Repeated failure means fluoroscopy.',
      evidenceIds: PLACEMENT_EVIDENCE,
    }),
    observed:
      'The balloon comes down and the catheter is withdrawn to where it moved freely. The simulator meets no resistance, so this one is taught in words.',
    reconciliation:
      'Every signal-side observable agrees. The one that does not is mechanical, and the waveform cannot speak to it.',
    justification: 'Continuing against resistance is not safe, whatever the tracing shows.',
    prebriefStopConditionId: 'resistance',
    unsourcedBoundary: null,
    sourceIds: PLACEMENT_EVIDENCE,
  },
  {
    id: 'pa-depth-mismatch',
    title: 'Pulmonary-artery waveform at an unexpected depth',
    kind: 'stop',
    fromPosition: 'rv',
    nextPosition: 'pa',
    signalValidity: clean.signal,
    currentTracing: {
      statement:
        'A pulmonary-artery tracing: diastolic step-up, downward runoff, and a dicrotic notch. Precisely the predicted transition.',
      concerning: false,
      matchesPosition: 'pa',
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement: 'Flow-directed balloon inflated, as it was for the passage.',
      concerning: false,
    },
    depth: {
      statement:
        'The depth readout has barely moved since the atrial tracing, yet the waveform has changed twice. The two accounts of where the tip is cannot both be right.',
      concerning: true,
    },
    commitment: commitmentItem({
      id: 'pac-advance-commit-depth',
      clinicalContextId: 'pac-advancement-depth-mismatch',
      stem: 'The predicted pulmonary-artery transition has appeared in full — diastolic step-up, downward runoff, dicrotic notch, systolic unchanged. The depth readout has hardly moved since the atrial tracing. What do you commit to?',
      choices: [
        {
          id: 'stop',
          label: 'Stop advancing and reconcile depth with the waveform before anything else.',
          rationale:
            'Waveform and depth are two independent accounts of where the tip is. When they disagree, sort that out before the catheter moves again.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Advance, because the waveform confirms the position and depth is only ever a rough landmark.',
          rationale:
            'Depth is the weaker signal, which is a reason not to advance on depth alone. It is not a reason to ignore it when it contradicts the waveform.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold, and re-read the depth marking.',
          rationale: 'Re-reading is the right first step. The waveform has to be re-examined too.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['stop'],
      explanation:
        'A waveform that says pulmonary artery while the depth says the catheter never travelled there leaves the position unconfirmed, however good the tracing. The usual landmarks from the right internal jugular are 20–30 cm for the right atrium, 30–40 cm for the right ventricle and 40–50 cm for the pulmonary artery.',
      evidenceIds: [...PLACEMENT_EVIDENCE, 'emcrit-rhc-supplied-2026'],
    }),
    observed: 'Advancement stops. The depth marking and the tracing are both re-read.',
    reconciliation:
      'The tracing and the depth describe different positions, and a good tracing does not settle that.',
    justification: 'Continuing is not safe until the two agree.',
    prebriefStopConditionId: 'waveform-does-not-confirm',
    unsourcedBoundary: null,
    sourceIds: [...PLACEMENT_EVIDENCE, 'emcrit-rhc-supplied-2026'],
  },
  {
    id: 'ra-signal-invalid',
    title: 'The signal stops being trustworthy',
    kind: 'stop',
    fromPosition: 'ra',
    nextPosition: 'rv',
    signalValidity: {
      statement:
        'The fast-flush release now rings for several beats before settling, and the tracing has picked up oscillations that were not there a moment ago.',
      concerning: true,
    },
    currentTracing: {
      statement:
        'Still recognizably atrial in family, but the wave components are hard to separate under the ringing.',
      concerning: false,
      matchesPosition: 'ra',
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement: 'Balloon state is known and matches the position.',
      concerning: false,
    },
    depth: { statement: 'Depth agrees with an atrial position.', concerning: false },
    commitment: commitmentItem({
      id: 'pac-advance-commit-signal',
      clinicalContextId: 'pac-advancement-signal-invalid',
      stem: 'The rhythm, the patient, the resistance, the balloon, and the depth are all unremarkable. The fast-flush release has started ringing for several beats and the tracing has picked up oscillations. What do you commit to?',
      choices: [
        {
          id: 'hold',
          label:
            'Hold position and repair the dynamic response before interpreting the tracing or moving again.',
          rationale:
            'The waveform is the instrument by which every transition is confirmed. An untrustworthy instrument does not stop being untrustworthy because the next chamber is easy to predict.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Advance anyway — the atrial family is still recognizable, and a ventricular tracing is unmistakable even through ringing.',
          rationale:
            'Ringing lands hardest on exactly the features that separate a right ventricle from a pulmonary artery. The next transition is the one this artifact is worst at showing.',
          plausibility: 'unsafe',
        },
        {
          id: 'escalate',
          label: 'Stop and escalate for the measurement problem.',
          rationale:
            'Not unsafe, but a ringing line is yours to repair: check for air and excess tubing, then flush again.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['hold'],
      explanation:
        'Signal validity comes first because every later step is read from this tracing.',
      evidenceIds: [...SIGNAL_EVIDENCE, 'clinical-hemodynamics-waveforms'],
    }),
    observed:
      'The catheter stays where it is. The fluid path and the dynamic response are addressed before anything else happens.',
    reconciliation:
      'Nothing else objects, but every other observation was made through a line that is now ringing.',
    justification:
      'Continuing is not safe. Advancing would mean confirming the next transition with a tracing that cannot confirm anything.',
    prebriefStopConditionId: 'waveform-does-not-confirm',
    unsourcedBoundary: null,
    sourceIds: [...SIGNAL_EVIDENCE, 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'patient-deteriorates',
    title: 'The patient changes while the tracing does not',
    kind: 'stop',
    fromPosition: 'rv',
    nextPosition: 'pa',
    signalValidity: clean.signal,
    currentTracing: {
      statement: 'A right-ventricular tracing, unchanged and matching the reference.',
      concerning: false,
      matchesPosition: 'rv',
    },
    rhythm: {
      statement: 'Sinus rhythm, faster than a few minutes ago but without new ectopy.',
      concerning: false,
    },
    patient: {
      statement:
        'Systemic blood pressure has fallen, the patient looks worse, and the displayed pressures and the patient no longer tell the same story.',
      concerning: true,
    },
    resistance: clean.resistance,
    balloon: {
      statement: 'Flow-directed balloon inflated, as it should be at this point.',
      concerning: false,
    },
    depth: { statement: 'Depth agrees with a ventricular position.', concerning: false },
    commitment: commitmentItem({
      id: 'pac-advance-commit-patient',
      clinicalContextId: 'pac-advancement-patient-deterioration',
      stem: 'The right-ventricular tracing is unchanged and valid. The systemic blood pressure has fallen and the patient looks worse. What do you commit to?',
      choices: [
        {
          id: 'escalate',
          label:
            'Stop advancing, deflate, and look at the patient and the rhythm before anything else.',
          rationale:
            'The patient comes first. With the balloon down, examine the patient and the rhythm and treat what you find; the catheter can wait.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Advance to the pulmonary artery quickly so that the measurements needed to explain the deterioration become available.',
          rationale:
            'This continues a procedure on a deteriorating patient in order to get data about the deterioration. The catheter may be the cause.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold position and watch the monitor for another minute.',
          rationale:
            'Holding stops the manipulation, which is half of it. Nobody has yet looked at the patient.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation:
        'Stop advancing, deflate, and look at the patient and the rhythm first. Treat what you find, call for help if it does not turn around, and resume only when the patient is stable.',
      evidenceIds: [...SIGNAL_EVIDENCE, 'pac-derived-part-2-2021'],
    }),
    observed: 'The balloon comes down and attention moves to the patient and the rhythm.',
    reconciliation:
      'Every catheter-side observable is unremarkable. The patient is not, and the tracing cannot vouch for the patient.',
    justification: 'Advancing through a deterioration whose cause is unknown is not safe.',
    prebriefStopConditionId: 'patient-deteriorates',
    unsourcedBoundary: null,
    sourceIds: [...SIGNAL_EVIDENCE, 'pac-derived-part-2-2021'],
  },
  {
    id: 'pa-spontaneous-wedge',
    title: 'Pulsatility disappears without inflating',
    kind: 'stop',
    fromPosition: 'pa',
    nextPosition: null,
    signalValidity: clean.signal,
    currentTracing: {
      statement:
        'Pulmonary-artery pulsatility and the dicrotic notch have gone, replaced by a low-amplitude atrial-looking tracing — with nothing inflated.',
      concerning: true,
      matchesPosition: 'wedge',
    },
    rhythm: clean.rhythm,
    patient: clean.patient,
    resistance: clean.resistance,
    balloon: {
      statement:
        'The balloon has not been inflated, so the occlusion morphology on screen has no accounted-for cause.',
      concerning: true,
    },
    depth: {
      statement:
        'Depth is unchanged, which is what makes the change in morphology harder to explain rather than easier.',
      concerning: true,
    },
    commitment: commitmentItem({
      id: 'pac-advance-commit-spontaneous-wedge',
      clinicalContextId: 'pac-advancement-spontaneous-wedge',
      stem: 'From a confirmed pulmonary-artery position, pulsatility and the dicrotic notch disappear and an atrial-looking tracing takes their place. The balloon has not been inflated and the depth has not changed. What do you commit to?',
      choices: [
        {
          id: 'escalate',
          label:
            'Confirm the balloon is down, do not flush, and withdraw until the PA tracing returns.',
          rationale:
            'A wedge nobody produced means the tip has migrated distally. Confirm the syringe is passive, then pull back until the pulmonary-artery tracing is back.',
          plausibility: 'best',
        },
        {
          id: 'hold',
          label: 'Hold the catheter still and observe whether pulsatility returns on its own.',
          rationale:
            'Not manipulating blindly is right, but a tip left wedged can infarct lung or rupture the artery.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'advance',
          label:
            'Flush the distal lumen, since a damped or occluded lumen would produce this appearance.',
          rationale:
            'Flushing a wedged catheter pressurizes a small occluded branch. Establish the position first.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation: `A spontaneous wedge means the tip is too distal. Deflate at once, confirm the syringe is passive, do not flush, and withdraw until the pulmonary-artery tracing returns. Pulmonary-artery rupture carries a mortality of ${HEMODYNAMICS_NUMBERS.value('pa-rupture-mortality')}.`,
      evidenceIds: [
        'clinical-hemodynamics-waveforms',
        'pac-review-2014',
        'pac-waveforms-part-1-2021',
        'edwards-swan-ganz-ifu-2023',
        'monitor-workflow-supplied',
      ],
    }),
    observed: 'The catheter is withdrawn until pulsatility and the dicrotic notch return.',
    reconciliation: 'It is a wedge tracing with nothing to account for it: the tip has moved.',
    justification: 'Continuing is not safe, and neither is flushing.',
    prebriefStopConditionId: 'spontaneous-or-over-wedge',
    unsourcedBoundary: null,
    sourceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
      'monitor-workflow-supplied',
    ],
  },
] as const

export const PAC_ADVANCEMENT_UNSOURCED_BOUNDARY_NOTICE = pacPrebriefNotCoveredNotice

/** Fails the import when a scenario's key and its derived safety verdict disagree. */
function assertAdvancementScenariosAreCoherent(): void {
  const ids = new Set<string>()
  const stopReasonsCovered = new Set<PacAdvancementStopReason>()

  for (const scenario of pacAdvancementScenarios) {
    if (ids.has(scenario.id)) {
      throw new Error(`Duplicate advancement scenario: ${scenario.id}`)
    }
    ids.add(scenario.id)

    if (scenario.currentTracing.matchesPosition) {
      // Throws when a scenario names a chamber the canonical reference does not carry.
      normalWaveformReferenceEntry(scenario.currentTracing.matchesPosition)
    }
    prebriefStopConditionFor(scenario)

    for (const sourceId of scenario.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        throw new Error(
          `Advancement scenario ${scenario.id} cites an unregistered source: ${sourceId}`,
        )
      }
    }

    const stops = advancementStopReasons(scenario)
    for (const reason of stops) stopReasonsCovered.add(reason)

    if ((scenario.kind === 'stop') !== stops.length > 0) {
      throw new Error(
        `Advancement scenario ${scenario.id} is declared ${scenario.kind} but derives ${stops.length} stop reasons.`,
      )
    }

    const safe = new Set(safeAdvancementCommitments(scenario))
    for (const choiceId of scenario.commitment.correctChoiceIds) {
      if (!safe.has(choiceId as PacAdvancementCommitment)) {
        throw new Error(
          `Advancement scenario ${scenario.id} marks "${choiceId}" as the best commitment, but the situation does not permit it.`,
        )
      }
    }
    if (stops.length > 0) {
      const advanceChoice = scenario.commitment.choices.find((choice) => choice.id === 'advance')
      if (advanceChoice && advanceChoice.plausibility !== 'unsafe') {
        throw new Error(
          `Advancement scenario ${scenario.id} carries a stop condition, so advancing cannot be offered as anything but unsafe.`,
        )
      }
    }
  }

  const requiredStopReasons: readonly PacAdvancementStopReason[] = [
    'signal-invalid',
    'unexpected-waveform',
    'position-depth-mismatch',
    'resistance',
    'rhythm-concern',
    'patient-deterioration',
    'balloon-state-unresolved',
  ]
  for (const reason of requiredStopReasons) {
    if (!stopReasonsCovered.has(reason)) {
      throw new Error(`No advancement scenario represents the ${reason} stop condition.`)
    }
  }
}

assertAdvancementScenariosAreCoherent()

export function pacAdvancementScenario(id: string): PacAdvancementScenario {
  const scenario = pacAdvancementScenarios.find((candidate) => candidate.id === id)
  if (!scenario) throw new Error(`Unknown advancement scenario: ${id}`)
  return scenario
}
