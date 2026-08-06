import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { normalWaveformReferenceEntry } from './normalWaveformReference'
import { pacPrebriefNotCoveredNotice } from './pacAdvancementPrebrief'
import { hemodynamicsSourceById } from './sources'
import { waveformAtlasById } from './waveformAtlas'

/**
 * PAWP acquisition as an explicit safety sequence (H3 §7).
 *
 * The station already had the right actions in the right order — inflate from a confirmed
 * pulmonary-artery position, sample a respiratory cycle, place an end-expiratory cursor, store,
 * deflate. What it did not have was any point at which the learner had to *judge* anything. The
 * plausibility of the occlusion tracing was explanatory copy, and the return of the pulmonary-artery
 * waveform was asserted by the simulation rather than assessed by the learner: the station said
 * "PA waveform restored" and the objective counted the balloon being down, so the one failure the
 * sequence exists to catch was the one thing it could not represent.
 *
 * Two records fix that. `pawpOcclusionOutcomes` gives the learner three things an occlusion can
 * produce and asks which are plausibly interpretable. `pawpRecoveryOutcomes` gives the two things
 * deflation can produce and makes the return of the pulmonary-artery waveform an answer rather than
 * a reassurance — including the case where it does not return, where continuation is withheld.
 *
 * No inflation-time limit and no balloon volume appears anywhere in this file. Those are properties
 * of a specific catheter and a specific local protocol rather than of this station, so the boundary
 * is stated and the learner is sent to the current instructions for the catheter actually in use.
 */

export interface PawpCaptureStep {
  readonly id: string
  readonly order: number
  readonly shortLabel: string
  /** The question the learner answers at this step, in their own words. */
  readonly question: string
  readonly whatYouDo: string
  readonly whatItEstablishes: string
  /** The step's boundary — what a clean result here still does not license. */
  readonly whatItDoesNotEstablish: string
  readonly sourceIds: readonly string[]
}

const OCCLUSION_EVIDENCE = [
  'pac-waveforms-part-1-2021',
  'clinical-hemodynamics-waveforms',
  'edwards-swan-ganz-ifu-2023',
]
const TIMING_EVIDENCE = ['cvp-measurement-2017', 'pac-derived-part-2-2021']

export const pawpCaptureSteps: readonly PawpCaptureStep[] = [
  {
    id: 'confirm-pa-signal',
    order: 1,
    shortLabel: 'Trustworthy PA signal',
    question: 'Can I trust this pulmonary-artery signal, and is this the right moment?',
    whatYouDo:
      'Run the validity sequence on the pulmonary-artery tracing: level, zero, fluid path, scale and channel, dynamic response. Confirm pulsatility and a dicrotic notch are present, and that the simulated patient and setting are ones in which an occlusion pressure would answer a question.',
    whatItEstablishes:
      'That the signal an occlusion will be judged against is itself readable, and that the measurement is being made for a reason.',
    whatItDoesNotEstablish:
      'A valid pulmonary-artery signal says nothing about whether the tip is at a depth where a balloon may safely be inflated.',
    sourceIds: ['arterial-pressure-five-step-2020', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'confirm-balloon-state',
    order: 2,
    shortLabel: 'Balloon state',
    question: 'What is the balloon doing right now?',
    whatYouDo:
      'Read the balloon state before touching anything, and reconcile it with where the tip is. The flow-directed balloon used to float through the right heart and the brief occlusion used to sample a pressure are two different uses of the same balloon.',
    whatItEstablishes:
      'A known starting state, so that any change in morphology afterwards has an accounted-for cause.',
    whatItDoesNotEstablish:
      'Knowing the balloon is down does not establish that inflating it here is appropriate — that comes from the confirmed position and the manufacturer’s instructions for the catheter in use.',
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'predict-occlusion',
    order: 3,
    shortLabel: 'Predict',
    question: 'What should a plausible occlusion tracing do?',
    whatYouDo:
      'Say in advance what should change: pulsatility and the dicrotic notch disappear, amplitude collapses to an atrial-looking tracing, the wave components arrive late relative to the ECG, the mean typically sits a little below pulmonary-artery diastolic pressure, and depth does not change.',
    whatItEstablishes:
      'Something for the result to be compared against. Without it, whatever appears will be accepted.',
    whatItDoesNotEstablish:
      'A prediction is not a permission. It describes what a valid occlusion looks like, not that this one will be valid.',
    sourceIds: OCCLUSION_EVIDENCE,
  },
  {
    id: 'commit',
    order: 4,
    shortLabel: 'Commit',
    question: 'Am I committing to this before I see the result?',
    whatYouDo:
      'Commit to the prediction and to the intended sequence before inflating. Inflate only from a confirmed pulmonary-artery position, to the volume specified by the manufacturer for the catheter in use, and never with liquid.',
    whatItEstablishes:
      'That the judgement made afterwards is a judgement rather than a description of whatever appeared.',
    whatItDoesNotEstablish:
      'Committing does not make the acquisition safe; it makes the judgement of it honest.',
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'monitor-workflow-supplied'],
  },
  {
    id: 'observe',
    order: 5,
    shortLabel: 'Observe',
    question: 'What is actually on the screen?',
    whatYouDo:
      'Read the morphology, the timing of the wave components against the ECG, the behaviour across the respiratory cycle, and the displayed value — as four separate observations rather than one impression. Note which value you are reading: the displayed mean and the end-diastolic point are different measurements.',
    whatItEstablishes: 'The evidence the plausibility judgement will be made from.',
    whatItDoesNotEstablish:
      'Observing carefully does not make a tracing interpretable. The next step is where that is decided.',
    sourceIds: [...OCCLUSION_EVIDENCE, ...TIMING_EVIDENCE],
  },
  {
    id: 'judge-plausibility',
    order: 6,
    shortLabel: 'Plausible?',
    question: 'Is this tracing plausibly an occlusion pressure at all?',
    whatYouDo:
      'Decide explicitly, and allow the answer to be no. Reconcile the shape with the signal validity, the wave timing, the respiratory phase you read at, the clinical context, and the depth the tip is at. In sinus rhythm that includes the a wave; in atrial fibrillation it does not, and its absence is a property of the rhythm rather than a fault in the tracing.',
    whatItEstablishes:
      'That "this is not a usable occlusion pressure" is a real available answer, reached deliberately rather than by default.',
    whatItDoesNotEstablish:
      'A plausible tracing is not yet a confirmed one, and the relationship between the occlusion pressure and pulmonary-artery diastolic pressure does not settle it by itself. The most confirmatory checks — paired oximetry, and an abrupt return of pulmonary-artery pressure on deflation — have not been made yet.',
    sourceIds: [...OCCLUSION_EVIDENCE, ...TIMING_EVIDENCE],
  },
  {
    id: 'deflate',
    order: 7,
    shortLabel: 'Deflate',
    question: 'Is the balloon down, by my action?',
    whatYouDo:
      'Deflate promptly and deliberately, as a step of its own. Occlusion is brief; nothing about the value obtained is a reason to keep it inflated.',
    whatItEstablishes: 'That the occlusion ended because it was ended, and at a moment you chose.',
    whatItDoesNotEstablish:
      'Deflating does not establish that the circulation to that segment has been restored. That is the next step, and it is the one that gets skipped.',
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'confirm-pa-return',
    order: 8,
    shortLabel: 'PA returns?',
    question: 'Has the pulmonary-artery waveform come back?',
    whatYouDo:
      'Look at the tracing after deflation and answer the question yourself. Pulsatility and the dicrotic notch should return abruptly and unmistakably.',
    whatItEstablishes:
      'That the occlusion has actually ended at the vessel, not only at the syringe — and, in doing so, one of the strongest available confirmations that the tracing before it was a genuine occlusion pressure.',
    whatItDoesNotEstablish:
      'A returned pulmonary-artery waveform does not retrospectively validate a tracing that did not survive the earlier checks.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'withhold-or-continue',
    order: 9,
    shortLabel: 'Continue?',
    question: 'Given all of that, may this go any further?',
    whatYouDo:
      'Continue only if the pulmonary-artery waveform returned and the whole sequence reconciles. If it did not return, or if the state cannot be reconciled, treat the signal and the catheter position as unsafe: stop, do not flush or manipulate the catheter, and escalate.',
    whatItEstablishes:
      'That continuation is a decision with conditions attached, rather than what happens when nothing stops you.',
    whatItDoesNotEstablish:
      'Working through this sequence in simulation does not establish readiness to perform it. That requires supervision, local protocol, and the manufacturer’s instructions for the catheter in use.',
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'monitor-workflow-supplied', 'pac-review-2014'],
  },
] as const

/** What a brief occlusion can produce, and which of those may be interpreted. */
export interface PawpOcclusionOutcome {
  readonly id: string
  readonly label: string
  readonly atlasEntryId: string
  readonly plausiblyInterpretable: boolean
  readonly whatYouSee: string
  readonly verdict: string
  readonly nextAction: string
  readonly sourceIds: readonly string[]
}

export const pawpOcclusionOutcomes: readonly PawpOcclusionOutcome[] = [
  {
    id: 'plausible-wedge',
    label: 'Atrial morphology with late a and v waves',
    atlasEntryId: 'wedge-normal',
    plausiblyInterpretable: true,
    whatYouSee:
      'Pulsatility and the notch are gone. Amplitude collapses to a venous tracing with interpretable atrial wave components arriving late against the ECG — in sinus rhythm a and v waves, with the v wave typically the larger of the two. The mean sits a little below pulmonary-artery diastolic pressure and the depth has not changed.',
    verdict:
      'Plausibly an occlusion pressure. Every predicted change is present, the wave components are interpretable, and nothing about the tracing needs reconciling before it is read.',
    nextAction:
      'Read at end expiration — the end-diastolic point if you are estimating left ventricular end-diastolic pressure, the mean if that is the value you want, and not the two interchangeably. Then deflate promptly and confirm the pulmonary-artery waveform returns. Plausible is not the same as confirmed.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'over-wedged',
    label: 'Upward drift with no identifiable waves',
    atlasEntryId: 'wedge-overwedged',
    plausiblyInterpretable: false,
    whatYouSee:
      'A wavering line whose atrial wave components cannot be made out, drifting upward over seconds instead of settling, and often reading above pulmonary-artery diastolic pressure.',
    verdict:
      'Not an occlusion pressure. The defining features are the upward drift and the loss of interpretable wave components; the reading sitting above pulmonary-artery diastolic pressure is a relationship that needs reconciling, and on its own it does not establish over-wedging.',
    nextAction:
      'Deflate immediately. Do not flush or manipulate the catheter, and reassess or reposition only under appropriate supervision.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'incomplete-occlusion',
    label: 'Residual pulsatility riding on an atrial tracing',
    atlasEntryId: 'wedge-hybrid',
    plausiblyInterpretable: false,
    whatYouSee:
      'A mixture: some atrial morphology, with pulmonary-artery pulsatility still visible on top of it. The mean is higher than expected and has not fallen by the usual amount from pulmonary-artery diastolic pressure.',
    verdict:
      'Not an occlusion pressure, and the hardest of the three to catch — a and v waves may still be visible, so the shape can survive a glance.',
    nextAction:
      'Deflate, return to a confirmed pulmonary-artery signal, and reassess position and occlusion under appropriate supervision. Do not advance or withdraw to chase a number.',
    sourceIds: ['clinical-hemodynamics-waveforms'],
  },
] as const

/**
 * What deflation can produce.
 *
 * The second outcome is the reason this record exists. The simulation's own deflation always
 * restores the tracing, so without an authored counter-case there is no state in which a learner can
 * be asked to notice that it did not — and the one safety check the sequence ends on would be
 * untestable by construction.
 */
export interface PawpRecoveryOutcome {
  readonly id: string
  readonly label: string
  /** The tracing shown after deflation. */
  readonly atlasEntryId: string
  readonly paWaveformReturned: boolean
  readonly whatYouSee: string
  readonly whatItMeans: string
  readonly requiredResponse: string
  /** Whether the sequence may go any further from this state. */
  readonly continuationPermitted: boolean
  readonly sourceIds: readonly string[]
}

export const pawpRecoveryOutcomes: readonly PawpRecoveryOutcome[] = [
  {
    id: 'pa-returns',
    label: 'Pulsatility and the notch return',
    atlasEntryId: 'pa-normal',
    paWaveformReturned: true,
    whatYouSee:
      'Immediately after deflation the tracing regains its systolic pulse, its downward diastolic runoff, and its dicrotic notch, and the mean rises abruptly back to the pulmonary-artery value.',
    whatItMeans:
      'The occlusion has ended at the vessel. An abrupt, unmistakable return is also one of the strongest available confirmations that what preceded it was a genuine occlusion pressure.',
    requiredResponse:
      'Record that the pulmonary-artery waveform returned, and only then treat the stored value as something that may be interpreted.',
    continuationPermitted: true,
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'pa-does-not-return',
    label: 'The occlusion morphology persists',
    atlasEntryId: 'wedge-normal',
    paWaveformReturned: false,
    whatYouSee:
      'The balloon has been deflated, but the tracing still has no pulsatility and no dicrotic notch — the atrial-looking occlusion morphology is still there, at an unchanged depth.',
    whatItMeans:
      'The occlusion has not ended at the vessel. A wedge morphology with nothing inflated to account for it is the pattern the prebrief names as a potentially fatal warning sign, not a measurement.',
    requiredResponse:
      'Treat the signal and the catheter position as unsafe. Stop, do not forcefully flush or manipulate the catheter, and escalate for reassessment or repositioning under appropriate supervision.',
    continuationPermitted: false,
    sourceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
    ],
  },
] as const

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const ACTIVITY_ID = 'hemodynamics:learn:pawp-capture'

/** Step 6 — the plausibility judgement, committed before its reasoning appears. */
export const pawpPlausibilityCommitment: ClinicalLearningItem = item({
  id: 'pac-pawp-plausibility-commit',
  activityId: ACTIVITY_ID,
  phase: 'recognize',
  itemType: 'signal-recognition',
  contextRequirement: 'technical',
  clinicalContextId: 'pac-pawp-plausibility',
  visualAssetIds: ['pac-live-waveform', 'wedge-respiratory-cursor'],
  stem: 'A brief occlusion from a confirmed pulmonary-artery position has produced a tracing whose shape looks like the wedge in the atlas. What does that shape, on its own, establish?',
  choices: [
    {
      id: 'shape-alone-establishes-little',
      label:
        'Very little on its own. The shape has to be reconciled with the signal validity, the timing of the waves against the ECG, the respiratory phase you read at, the depth, and the clinical context — and then with the return of the pulmonary-artery waveform on deflation.',
      rationale:
        'Every one of the false patterns is a shape that can survive a glance. An incomplete occlusion may still show a and v waves, and an over-wedged trace is recognizable only by what is missing from it.',
      plausibility: 'best',
    },
    {
      id: 'shape-establishes-wedge',
      label:
        'That the balloon has occluded the vessel and the value may be recorded as an occlusion pressure.',
      rationale:
        'This is the habit the station exists to interrupt. A wedge-like shape is a necessary feature of a valid occlusion pressure and is nowhere near sufficient for one.',
      plausibility: 'unsafe',
    },
    {
      id: 'shape-plus-value-enough',
      label:
        'That it is an occlusion pressure, provided the displayed value sits below the pulmonary-artery diastolic pressure.',
      rationale:
        'That comparison is genuinely useful and it is not decisive in either direction. An unexpected relationship between the two is a warning to reconcile them rather than a finding that establishes over-wedging, and a large v wave can lift the displayed mean toward or past pulmonary-artery diastolic pressure without the end-diastolic value moving with it.',
      plausibility: 'reasonable-but-incomplete',
    },
  ],
  correctChoiceIds: ['shape-alone-establishes-little'],
  explanation:
    'Recognizing the morphology is where the judgement starts. What makes an occlusion pressure believable is the set of things that have to agree with it — a trustworthy signal, interpretable and correctly timed wave components, an end-expiratory reading of the value you actually want, a plausible depth, and an abrupt return of pulmonary-artery pressure and morphology when the balloon comes down. In atrial fibrillation the a wave is gone, and the remaining landmarks do that work instead.',
  evidenceIds: [...OCCLUSION_EVIDENCE, ...TIMING_EVIDENCE],
  reviewStatus: 'sme-review',
})

/** Step 9 — what follows when the pulmonary-artery waveform does not come back. */
export const pawpRecoveryCommitment: ClinicalLearningItem = item({
  id: 'pac-pawp-recovery-commit',
  activityId: ACTIVITY_ID,
  phase: 'observe',
  itemType: 'management-decision',
  contextRequirement: 'technical',
  clinicalContextId: 'pac-pawp-recovery',
  visualAssetIds: ['pac-live-waveform'],
  stem: 'The balloon has been deflated, and the tracing still shows no pulsatility and no dicrotic notch at an unchanged depth. What follows?',
  choices: [
    {
      id: 'treat-as-unsafe-and-escalate',
      label:
        'Treat the signal and the catheter position as unsafe. Stop, do not forcefully flush or manipulate the catheter, and escalate for reassessment or repositioning under supervision.',
      rationale:
        'An occlusion morphology with nothing inflated to account for it is a warning sign rather than a measurement, and flushing is specifically what not to do while distal occlusion is possible.',
      plausibility: 'best',
    },
    {
      id: 'record-the-value-anyway',
      label:
        'Record the stored value, since it was captured at end expiration before the balloon came down.',
      rationale:
        'The capture conditions are irrelevant to this. What is on the screen now says the occlusion did not end, which puts both the earlier value and the catheter position in doubt.',
      plausibility: 'unsafe',
    },
    {
      id: 'reinflate-to-check',
      label:
        'Briefly re-inflate to see whether the tracing changes, which would confirm the balloon is working.',
      rationale:
        'Re-inflating against a possible persistent occlusion adds occlusion to a segment that may already have too much of it. The prebrief stops repeated inflation attempts when the waveform will not transition.',
      plausibility: 'unsafe',
    },
    {
      id: 'wait-briefly',
      label: 'Wait a few seconds and look again before doing anything.',
      rationale:
        'Not doing anything harmful is the right instinct, and a genuine return is abrupt rather than gradual. Waiting alone leaves an unsafe state unreported.',
      plausibility: 'reasonable-but-incomplete',
    },
  ],
  correctChoiceIds: ['treat-as-unsafe-and-escalate'],
  explanation:
    'The last step of the sequence is the one that gets skipped, because the balloon being down feels like the end. It is not: the question is whether the occlusion ended at the vessel, and only the returning waveform answers it.',
  evidenceIds: [
    'clinical-hemodynamics-waveforms',
    'pac-review-2014',
    'pac-waveforms-part-1-2021',
    'edwards-swan-ganz-ifu-2023',
  ],
  reviewStatus: 'sme-review',
})

/**
 * What this station will not tell you.
 *
 * Stated on the surface rather than left to the prebrief, because this is the station where a
 * learner most wants a number and where the module has none to give.
 */
export const PAWP_BALLOON_NUMBERS_BOUNDARY =
  'This station does not teach a universal inflation volume or duration. Use the current manufacturer instructions for the exact catheter in use and the applicable local procedure protocol. The simulator ends a prolonged occlusion at a fixed cutoff of its own so that an inflation is never left running here; that cutoff is an educational safety rail, not a clinical limit.'

export const PAWP_BOUNDARY_NOTICE = pacPrebriefNotCoveredNotice

/** Fails the import rather than the render. */
function assertPawpSequenceIsResolvable(): void {
  // Every wedge step is described against the canonical reference for the wedge and the artery.
  normalWaveformReferenceEntry('pa')
  normalWaveformReferenceEntry('wedge')

  for (const [index, step] of pawpCaptureSteps.entries()) {
    if (step.order !== index + 1) {
      throw new Error(`PAWP capture step ${step.id} declares order ${step.order} at index ${index}`)
    }
    for (const sourceId of step.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        throw new Error(`PAWP capture step ${step.id} cites an unregistered source: ${sourceId}`)
      }
    }
  }

  for (const outcome of [...pawpOcclusionOutcomes, ...pawpRecoveryOutcomes]) {
    if (!waveformAtlasById.has(outcome.atlasEntryId)) {
      throw new Error(
        `PAWP outcome ${outcome.id} points at a missing atlas entry: ${outcome.atlasEntryId}`,
      )
    }
    for (const sourceId of outcome.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        throw new Error(`PAWP outcome ${outcome.id} cites an unregistered source: ${sourceId}`)
      }
    }
  }

  if (pawpRecoveryOutcomes.filter((outcome) => outcome.paWaveformReturned).length !== 1) {
    throw new Error('Exactly one PAWP recovery outcome may represent a returned PA waveform.')
  }
  for (const outcome of pawpRecoveryOutcomes) {
    // The contract this station exists to enforce: no return, no continuation.
    if (!outcome.paWaveformReturned && outcome.continuationPermitted) {
      throw new Error(
        `PAWP recovery outcome ${outcome.id} permits continuation without a returned PA waveform.`,
      )
    }
  }

  const numberBearing = /\b\d+(\.\d+)?\s*(ml|millilit|cc|second|s\b|minute)/i
  for (const text of [
    PAWP_BALLOON_NUMBERS_BOUNDARY,
    ...pawpCaptureSteps.flatMap((step) => [step.whatYouDo, step.whatItEstablishes]),
    ...pawpOcclusionOutcomes.flatMap((outcome) => [outcome.whatYouSee, outcome.nextAction]),
    ...pawpRecoveryOutcomes.flatMap((outcome) => [outcome.whatYouSee, outcome.requiredResponse]),
  ]) {
    if (numberBearing.test(text)) {
      throw new Error(
        `PAWP copy states a balloon volume or duration, which no source here supports: ${text}`,
      )
    }
  }
}

assertPawpSequenceIsResolvable()

export function pawpRecoveryOutcome(id: string): PawpRecoveryOutcome {
  const outcome = pawpRecoveryOutcomes.find((candidate) => candidate.id === id)
  if (!outcome) throw new Error(`Unknown PAWP recovery outcome: ${id}`)
  return outcome
}

export function pawpOcclusionOutcome(id: string): PawpOcclusionOutcome {
  const outcome = pawpOcclusionOutcomes.find((candidate) => candidate.id === id)
  if (!outcome) throw new Error(`Unknown PAWP occlusion outcome: ${id}`)
  return outcome
}
