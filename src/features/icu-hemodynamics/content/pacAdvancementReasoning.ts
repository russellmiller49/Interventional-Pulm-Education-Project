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

/**
 * Advancement as continuous safety reasoning (H3 §6).
 *
 * The section used to be a two-button dock: confirm the waveform, then advance. That teaches the
 * proposition this package exists to break — that recognizing the expected tracing is sufficient
 * reason to keep going. It is necessary and it is not sufficient, and the difference is where
 * patients are hurt.
 *
 * Each scenario below presents the whole situation at once: whether the pressure signal can be
 * trusted, what the current tracing is, what the reference says should change next, what the rhythm
 * and the patient are doing, whether the catheter is moving freely, whether the balloon state is
 * settled, and whether the depth readout can be reconciled with the waveform. The learner commits
 * to advance, hold, stop, or escalate *before* seeing what follows.
 *
 * Two structural decisions matter more than any sentence here:
 *
 * 1. **Whether continuing is safe is derived, not authored.** `advancementStopReasons` reads the
 *    scenario's state flags. Nothing in it looks at whether the waveform matched the prediction, so
 *    an expected morphology cannot cancel a stop condition — not because an author remembered, but
 *    because there is no code path by which it could.
 * 2. **The sentences come from the sourced records that already carry them.** Every stop scenario
 *    names a `pacAdvancementPrebrief` stop condition by id and the panel renders that record's own
 *    trigger and response. This file adds the reasoning structure and the scenario-specific
 *    observations; it does not restate clinical claims that already exist with evidence attached.
 */

export type PacAdvancementCommitment = 'advance' | 'hold' | 'stop' | 'escalate'

export const pacAdvancementCommitmentLabels: Readonly<Record<PacAdvancementCommitment, string>> = {
  advance: 'Advance',
  hold: 'Hold where you are',
  stop: 'Stop the maneuver',
  escalate: 'Stop and escalate to the supervising clinician',
}

/**
 * The categories of stop condition this module can represent.
 *
 * `resistance` is present as a category with a deliberately unquantified meaning — see
 * `PacAdvancementScenario.unsourcedBoundary`.
 */
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
  /**
   * Set when the teaching point is real but the module has no source that quantifies or manages it.
   * The panel renders it beside the `pacPrebriefNotCoveredNotice`, so a learner is never left
   * thinking a boundary statement was a source-derived rule.
   */
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
          label: 'Advance, watching for a low-amplitude venous tracing to appear.',
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
            'Advance, expecting a rapid systolic rise and a fall toward a low diastole that may climb gradually through filling, with no step-up, no runoff, and no notch.',
          rationale:
            'Nothing says stop, and the reference names exactly what should change: a large systolic step with a low diastole that may climb through filling, and none of the features that mark the pulmonary artery — not simply a higher number.',
          plausibility: 'best',
        },
        {
          id: 'hold',
          label: 'Hold, because ventricular ectopy is common once the tip crosses the valve.',
          rationale:
            'That it is common is why the rhythm is watched continuously — it is a reason to be ready, not a reason to stop before anything has happened.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'escalate',
          label: 'Stop and escalate, because the next chamber is the one where ectopy occurs.',
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
            'Advance, expecting diastolic pressure to step up, the diastolic slope to reverse, and a dicrotic notch to appear — with systolic pressure unchanged.',
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
            'Stop the simulated maneuver and escalate to the supervising clinician, keeping the rhythm under continuous watch.',
          rationale:
            'The rhythm is one of the things being watched, and it has changed. Recognizing it, stopping the maneuver, and escalating is the whole of what this module teaches about it.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Advance promptly toward the pulmonary artery, since the tracing confirms the position and leaving the ventricle resolves the ectopy.',
          rationale:
            'This is the reasoning the section exists to break. A confirmed position answers "where is the tip"; it does not answer "is it safe to keep going", and moving a catheter during a rhythm change is a decision that needs authority behind it.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold position and keep watching the rhythm.',
          rationale:
            'Holding is safer than advancing and is not a failure. It stops short of the part that matters: a rhythm change during catheter manipulation is something to report, not something to observe alone.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation:
        'This is the case the whole section is built around. The waveform is perfect and the waveform is not the question. An expected morphology confirms which chamber the tip is in and confirms nothing else — the rhythm, the patient, the resistance, and the balloon each have to be satisfied on their own.',
      evidenceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
    }),
    observed:
      'The simulated maneuver stops. The rhythm stays under continuous watch and the finding is reported to the supervising clinician.',
    reconciliation:
      'Waveform and depth agree with each other and with the reference. The rhythm does not agree with continuing. Those are separate questions, and only one of them was ever answered by the tracing.',
    justification:
      'Continuing is not safe. A stop condition outranks a matching waveform every time, because the waveform was never evidence about the rhythm.',
    prebriefStopConditionId: 'ventricular-ectopy',
    unsourcedBoundary:
      'How ectopy occurring during catheter manipulation should then be managed is deliberately not taught here.',
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
            'Stop the simulated maneuver and escalate to the supervising clinician, without forcing the catheter.',
          rationale:
            'A catheter that will not advance is not a catheter to push harder. Stopping and handing the situation to someone with the authority and information to act on it is what this module can support.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Apply a little more force, since the waveform confirms the catheter is where it should be.',
          rationale:
            'The waveform says which chamber the tip is in. It says nothing about what the catheter is caught on, or what forcing it would do to whatever that is.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold and wait to see whether it frees up.',
          rationale:
            'Holding does no harm. It leaves the situation unreported, and the reason to escalate is precisely that this module cannot tell you what the resistance means.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation:
        'This module has no reviewed source that says how much resistance means what, or how any particular cause of it is managed. What it can support is the boundary: do not force a catheter that will not advance, and get the situation to someone who can assess it.',
      evidenceIds: PLACEMENT_EVIDENCE,
    }),
    observed:
      'The simulated maneuver stops with the catheter where it is, and the finding is reported.',
    reconciliation:
      'Every signal-side observable agrees. The one that does not is mechanical, and no amount of waveform confirmation speaks to it.',
    justification:
      'Continuing is not safe, and the reason is not that a source quantified it — it is that nothing here can tell you what is in the way.',
    prebriefStopConditionId: null,
    unsourcedBoundary:
      'What resistance means, how much is too much, and how catheter knotting, coiling, or looping is recognized and managed are all deliberately absent. No reviewed source in this module supports them, and none is invented here. The stop-and-escalate boundary above is a supervision and protocol statement, not a source-derived rule about resistance.',
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
          label:
            'Stop advancing and reconcile the two accounts of the tip position before doing anything else.',
          rationale:
            'Waveform and depth are two independent claims about the same thing. When they disagree, the disagreement is the finding, and advancing on either one alone advances on an assumption.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Advance, because the waveform confirms the position and depth is only ever a rough landmark.',
          rationale:
            'Depth is indeed the weaker signal — which is a reason not to advance on depth alone, not a reason to ignore it when it contradicts the waveform. An unreconciled position is an unknown position.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold, and re-read the depth marking.',
          rationale:
            'Re-reading is the right instinct and holding is safe. It is a first step in the reconciliation rather than the whole of it — the waveform account has to be re-examined too.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['stop'],
      explanation:
        'The prebrief names this exactly: do not advance further on depth alone, and an unconfirmed position is an unknown position. It cuts both ways. A waveform that confirms a chamber while the depth says the catheter never travelled there leaves the position unconfirmed no matter how good the tracing is.',
      evidenceIds: [...PLACEMENT_EVIDENCE, 'emcrit-rhc-supplied-2026'],
    }),
    observed:
      'Advancement stops. Both accounts of the tip position are re-examined rather than one being chosen.',
    reconciliation:
      'The tracing and the depth readout describe incompatible positions. Nothing about the quality of the tracing resolves that, because the tracing is one of the two things in conflict.',
    justification:
      'Continuing is not safe. Reconciliation has to happen first, and it is not reconciliation to prefer the signal you like better.',
    prebriefStopConditionId: 'waveform-does-not-confirm',
    unsourcedBoundary:
      'No universal insertion-depth cut point is used here. Depth is treated as a rough landmark whose disagreement with the waveform is the finding, because the sources support the landmark framing and not a numeric rule for this catheter and approach.',
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
            'Not unsafe, but a repairable dynamic-response problem is within the validity sequence already taught. Escalation is for what cannot be resolved or reconciled.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['hold'],
      explanation:
        'Signal validity is the first step of the sequence for a reason. Everything downstream — identification, prediction, reconciliation — is being carried out with this tracing, so an invalid signal is not one more consideration alongside the others but the thing the others are made of.',
      evidenceIds: [...SIGNAL_EVIDENCE, 'clinical-hemodynamics-waveforms'],
    }),
    observed:
      'The catheter stays where it is. The fluid path and the dynamic response are addressed before anything else happens.',
    reconciliation:
      'Nothing else in the situation objects, and it does not matter: the observation that everything else looks fine was made through the instrument that has stopped being trustworthy.',
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
            'Stop advancing, treat the patient rather than the tracing, and escalate to the supervising clinician.',
          rationale:
            'A measurement problem and a patient problem can look alike from the monitor, and only one of them is fixed at the monitor. Nothing about the catheter is the priority here.',
          plausibility: 'best',
        },
        {
          id: 'advance',
          label:
            'Advance to the pulmonary artery quickly so that the measurements needed to explain the deterioration become available.',
          rationale:
            'The reasoning has an appealing shape and it inverts the priority: it continues a procedure on a deteriorating patient in order to obtain data about the deterioration.',
          plausibility: 'unsafe',
        },
        {
          id: 'hold',
          label: 'Hold position and watch for another minute.',
          rationale:
            'Holding stops the manipulation, which is the important half. It leaves the patient unattended to and the deterioration unreported.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation:
        'The tracing is not the patient. When the displayed signal and the patient stop agreeing, the disagreement is the finding, and the patient is what gets the response.',
      evidenceIds: [...SIGNAL_EVIDENCE, 'pac-derived-part-2-2021'],
    }),
    observed:
      'Catheter manipulation stops. Attention moves to the patient, and the supervising clinician is called.',
    reconciliation:
      'Every catheter-side observable is unremarkable. The patient is not, and the patient was never one of the things the tracing could vouch for.',
    justification:
      'Continuing is not safe. Advancing would be continuing a procedure through a deterioration whose cause has not been established.',
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
            'Stop, do not flush or manipulate the catheter, and escalate immediately for reassessment or repositioning under supervision.',
          rationale:
            'A wedge morphology that nobody produced is a warning sign rather than a measurement. It is treated as one, and the catheter is not flushed while distal occlusion is possible.',
          plausibility: 'best',
        },
        {
          id: 'hold',
          label: 'Hold and observe whether pulsatility returns on its own.',
          rationale:
            'Stopping manipulation is right and observing alone is not enough. The prebrief treats this as something to act on and report, not something to watch.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'advance',
          label: 'Flush the line, since a damped or occluded lumen would produce this appearance.',
          rationale:
            'Flushing is specifically what not to do when distal occlusion, wedging, or pulmonary-artery injury is possible. Position has to be established before anything is flushed or aspirated.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['escalate'],
      explanation:
        'Three observables disagree at once here — the morphology, the balloon state that should explain it, and the unchanged depth. Any one of them would be enough to stop; together they are the pattern the prebrief names as potentially fatal.',
      evidenceIds: [
        'clinical-hemodynamics-waveforms',
        'pac-review-2014',
        'pac-waveforms-part-1-2021',
        'edwards-swan-ganz-ifu-2023',
        'monitor-workflow-supplied',
      ],
    }),
    observed:
      'Manipulation and flushing stop. The finding is escalated for reassessment or repositioning under supervision.',
    reconciliation:
      'The tracing is a recognizable morphology in circumstances that do not account for it. Recognizing it correctly is what makes it alarming, not what makes it acceptable.',
    justification:
      'Continuing is not safe, and neither is flushing. This is the one scenario where correctly naming the tracing is itself the reason to stop.',
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

/**
 * Fails the import rather than the render.
 *
 * The important check is the last one: the authored best answer and the derived safety verdict have
 * to agree. If someone later marks `advance` as the best commitment in a scenario that carries a
 * stop condition, the module refuses to load rather than teaching it.
 */
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
