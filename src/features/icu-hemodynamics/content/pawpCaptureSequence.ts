import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { normalWaveformReferenceEntry } from './normalWaveformReference'
import { pacPrebriefNotCoveredNotice } from './pacAdvancementPrebrief'
import { hemodynamicsSourceById } from './sources'
import { HEMODYNAMICS_NUMBERS } from './teachingNumbers'
import { waveformAtlasById } from './waveformAtlas'

/**
 * The wedge as a sequence the learner judges at two points: whether the occlusion tracing is
 * plausible (`pawpOcclusionOutcomes`), and whether the pulmonary-artery tracing came back on
 * deflation (`pawpRecoveryOutcomes`). Balloon volume and the first move when the tracing does not
 * return come from the numbers register.
 */

export interface PawpCaptureStep {
  readonly id: string
  readonly order: number
  readonly shortLabel: string
  /** The question the learner answers at this step, in their own words. */
  readonly question: string
  readonly whatYouDo: string
  readonly whatItEstablishes: string
  /** What the step still leaves open. Empty when there is nothing to add. */
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
    question: 'Can I trust this pulmonary-artery signal?',
    whatYouDo:
      'Check the pulmonary-artery tracing: level, zero, fluid path, scale, dynamic response. Confirm pulsatility and a dicrotic notch.',
    whatItEstablishes: 'The tracing the occlusion will be judged against is readable.',
    whatItDoesNotEstablish: '',
    sourceIds: ['arterial-pressure-five-step-2020', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'confirm-balloon-state',
    order: 2,
    shortLabel: 'Balloon state',
    question: 'What is the balloon doing right now?',
    whatYouDo: 'Confirm the balloon is down and the syringe is passive before you touch anything.',
    whatItEstablishes: 'A known starting state, so any later change in the tracing has a cause.',
    whatItDoesNotEstablish: '',
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'predict-occlusion',
    order: 3,
    shortLabel: 'Predict',
    question: 'What should a plausible occlusion tracing do?',
    whatYouDo:
      'Say what should change: pulsatility and the notch disappear, the tracing becomes atrial with a and v waves arriving late against the ECG, and the mean sits a little below pulmonary-artery diastolic pressure.',
    whatItEstablishes: 'Something to compare the result against.',
    whatItDoesNotEstablish: '',
    sourceIds: OCCLUSION_EVIDENCE,
  },
  {
    id: 'commit',
    order: 4,
    shortLabel: 'Inflate',
    question: 'How much, and how fast?',
    whatYouDo: `Inflate slowly with ${HEMODYNAMICS_NUMBERS.value('balloon-volume')} while watching the tracing, and stop as soon as it wedges. Never use liquid.`,
    whatItEstablishes: 'A wedge taken with the least volume that produces it.',
    whatItDoesNotEstablish: `${capitalize(HEMODYNAMICS_NUMBERS.value('overwedge-volume'))}: deflate and withdraw.`,
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'monitor-workflow-supplied'],
  },
  {
    id: 'observe',
    order: 5,
    shortLabel: 'Observe',
    question: 'What is on the screen?',
    whatYouDo:
      'Read the morphology, the wave timing against the ECG, the respiratory swing, and the value. The displayed mean and the end-diastolic point are different measurements.',
    whatItEstablishes: 'The evidence for the plausibility judgement.',
    whatItDoesNotEstablish: '',
    sourceIds: [...OCCLUSION_EVIDENCE, ...TIMING_EVIDENCE],
  },
  {
    id: 'judge-plausibility',
    order: 6,
    shortLabel: 'Plausible?',
    question: 'Is this tracing an occlusion pressure?',
    whatYouDo:
      'Decide, and allow the answer to be no. Check the wave timing, the respiratory phase and the depth. In atrial fibrillation there is no a wave; that is the rhythm, not a fault.',
    whatItEstablishes: 'Whether the value is usable.',
    whatItDoesNotEstablish:
      'The strongest confirmations are still to come: an abrupt return of the pulmonary-artery tracing on deflation, and paired oximetry.',
    sourceIds: [...OCCLUSION_EVIDENCE, ...TIMING_EVIDENCE],
  },
  {
    id: 'deflate',
    order: 7,
    shortLabel: 'Deflate',
    question: 'Is the balloon down, by my action?',
    whatYouDo:
      'Keep the wedge brief: just long enough to read the value at end expiration. Then let the balloon deflate passively.',
    whatItEstablishes: 'The occlusion ended when you chose.',
    whatItDoesNotEstablish: '',
    sourceIds: ['edwards-swan-ganz-ifu-2023', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'confirm-pa-return',
    order: 8,
    shortLabel: 'PA returns?',
    question: 'Has the pulmonary-artery waveform come back?',
    whatYouDo:
      'Look at the tracing after deflation. Pulsatility and the dicrotic notch should return abruptly.',
    whatItEstablishes:
      'The occlusion has ended at the vessel, and the tracing before it was a true wedge.',
    whatItDoesNotEstablish: '',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'withhold-or-continue',
    order: 9,
    shortLabel: 'If it does not return',
    question: 'What if the pulmonary-artery tracing does not come back?',
    whatYouDo: `Confirm the balloon is fully deflated, do not flush, and ${HEMODYNAMICS_NUMBERS.value('retract-distance')} until the pulmonary-artery tracing returns. If it does not, get a chest film and help.`,
    whatItEstablishes:
      'The tip is back in a proximal pulmonary artery before anything else is done.',
    whatItDoesNotEstablish: '',
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
      'Pulsatility and the notch are gone. The tracing is atrial, with a and v waves arriving late against the ECG, and the mean sits a little below pulmonary-artery diastolic pressure.',
    verdict: 'An occlusion pressure: every predicted change is present.',
    nextAction:
      'Read at end expiration, then deflate and confirm the pulmonary-artery waveform returns.',
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'over-wedged',
    label: 'Upward drift with no identifiable waves',
    atlasEntryId: 'wedge-overwedged',
    plausiblyInterpretable: false,
    whatYouSee:
      'A line with no a or v waves that climbs over seconds instead of settling, often above pulmonary-artery diastolic pressure.',
    verdict:
      'Over-wedged: the balloon is overinflated for the vessel, or the tip is too distal. Not an occlusion pressure.',
    nextAction: `Deflate at once and do not flush. ${capitalize(HEMODYNAMICS_NUMBERS.value('overwedge-volume'))}: withdraw until the pulmonary-artery tracing returns.`,
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'incomplete-occlusion',
    label: 'Residual pulsatility riding on an atrial tracing',
    atlasEntryId: 'wedge-hybrid',
    plausiblyInterpretable: false,
    whatYouSee:
      'Some atrial morphology with pulmonary-artery pulsatility still riding on it. The mean has not fallen below pulmonary-artery diastolic pressure.',
    verdict:
      'An incomplete occlusion, and the easiest to miss: a and v waves may still be visible.',
    nextAction:
      'Deflate and return to a confirmed pulmonary-artery tracing. Do not add air beyond the full volume; reposition instead.',
    sourceIds: ['clinical-hemodynamics-waveforms'],
  },
] as const

/** What deflation can produce. The simulation always restores the tracing, so the second outcome is written out. */
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
      'Immediately after deflation the systolic pulse, the diastolic runoff and the dicrotic notch are back.',
    whatItMeans:
      'The occlusion has ended at the vessel. An abrupt return also confirms the tracing before it was a true wedge.',
    requiredResponse: 'Note the return, then use the stored value.',
    continuationPermitted: true,
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
  },
  {
    id: 'pa-does-not-return',
    label: 'The occlusion morphology persists',
    atlasEntryId: 'wedge-normal',
    paWaveformReturned: false,
    whatYouSee:
      'The balloon is down, but the tracing still has no pulsatility and no dicrotic notch.',
    whatItMeans: 'The tip is wedged with the balloon down: it has migrated too far distally.',
    requiredResponse: `Confirm the balloon is fully deflated, do not flush, and ${HEMODYNAMICS_NUMBERS.value('retract-distance')} until the pulmonary-artery tracing returns. If it does not, get a chest film and help.`,
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
        'Little. It still needs wave timing against the ECG, an end-expiratory reading, and PA return on deflation.',
      rationale:
        'Each false pattern survives a glance. An incomplete occlusion may still show a and v waves, and an over-wedged tracing is recognized by what is missing.',
      plausibility: 'best',
    },
    {
      id: 'shape-establishes-wedge',
      label:
        'That the balloon has occluded the vessel and the value may be recorded as an occlusion pressure.',
      rationale: 'A wedge-like shape is necessary for a valid occlusion pressure, not sufficient.',
      plausibility: 'unsafe',
    },
    {
      id: 'shape-plus-value-enough',
      label:
        'That it is an occlusion pressure, provided the displayed value sits below the pulmonary-artery diastolic pressure.',
      rationale:
        'A useful comparison, not a decisive one: a large v wave can lift the displayed mean to or past pulmonary-artery diastolic pressure in a true wedge.',
      plausibility: 'reasonable-but-incomplete',
    },
  ],
  correctChoiceIds: ['shape-alone-establishes-little'],
  explanation:
    'A wedge is believable when the things around it agree: a trustworthy signal, a and v waves timed late against the ECG, a reading at end expiration, a plausible depth, and an abrupt return of the pulmonary-artery tracing when the balloon comes down. In atrial fibrillation there is no a wave, and the other landmarks do that work.',
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
      label: `Confirm the balloon is fully down, do not flush, and ${HEMODYNAMICS_NUMBERS.value('retract-distance')} until the PA tracing returns.`,
      rationale:
        'A wedge tracing with the balloon down means the tip is too distal. Pulling back a short distance brings it into a larger vessel; flushing would pressurize an occluded branch.',
      plausibility: 'best',
    },
    {
      id: 'record-the-value-anyway',
      label:
        'Record the stored value, since it was captured at end expiration before the balloon came down.',
      rationale:
        'How the value was captured does not matter yet. The tip is still wedged, and that comes first.',
      plausibility: 'unsafe',
    },
    {
      id: 'reinflate-to-check',
      label:
        'Briefly re-inflate to see whether the tracing changes, which would confirm that the balloon is still working.',
      rationale: 'Inflating a balloon in a small distal branch is how a pulmonary artery ruptures.',
      plausibility: 'unsafe',
    },
    {
      id: 'wait-briefly',
      label: 'Wait a few seconds and look again before doing anything.',
      rationale:
        'A true return is abrupt. Waiting leaves the tip wedged in a branch that is not being perfused.',
      plausibility: 'reasonable-but-incomplete',
    },
  ],
  correctChoiceIds: ['treat-as-unsafe-and-escalate'],
  explanation: `The balloon being down is not the end; the returning pulmonary-artery tracing is. If it has not returned, confirm the balloon is fully deflated, do not flush, and ${HEMODYNAMICS_NUMBERS.value('retract-distance')} until it does. If it still does not, get a chest film and help. The simulator always restores the tracing, so this one is taught in words.`,
  evidenceIds: [
    'clinical-hemodynamics-waveforms',
    'pac-review-2014',
    'pac-waveforms-part-1-2021',
    'edwards-swan-ganz-ifu-2023',
  ],
  reviewStatus: 'sme-review',
})

/** The balloon in numbers, beside the wedge controls. */
export const PAWP_BALLOON_NUMBERS_BOUNDARY = `Inflate slowly with ${HEMODYNAMICS_NUMBERS.value('balloon-volume')} and stop as soon as the tracing wedges. ${capitalize(HEMODYNAMICS_NUMBERS.value('overwedge-volume'))}. Keep each inflation brief: just long enough to read the value at end expiration. The simulator releases the balloon itself if you leave it up.`

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
}

assertPawpSequenceIsResolvable()

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

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
