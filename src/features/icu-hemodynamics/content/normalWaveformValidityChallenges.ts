import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import {
  NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG,
  normalWaveformReferenceEntry,
  type NormalWaveformReferenceEntry,
} from './normalWaveformReference'
import { hemodynamicsSourceById } from './sources'

/**
 * Seven display faults, each drawn through one of the four normal tracings with the same artifact
 * transforms the live monitor uses. Each carries two answers: whether the chamber can still be
 * named, and whether the number can be used.
 */

export type NormalWaveformFaultKind =
  | 'level-or-zero'
  | 'mislabeled-channel'
  | 'scale-mismatch'
  | 'overdamped'
  | 'underdamped'
  | 'motion-artifact'
  | 'respiratory-phase-mismatch'

/**
 * How the figure should be drawn wrongly.
 *
 * Every field is a display instruction, not a physiologic parameter. The tracing underneath is the
 * unmodified normal reference trace, which is exactly what makes these teachable: the physiology is
 * normal and the picture is not.
 */
export interface NormalWaveformDisplayFault {
  /** Hydrostatic offset added to every sample, as an off-level transducer would. */
  readonly levelOffsetMmHg?: number
  /** Axis maximum, when the fault is the axis rather than the signal. */
  readonly scaleMaxMmHg?: number
  /** Measurement-system distortion, applied with the same transforms the live monitor uses. */
  readonly artifact?: 'overdamped' | 'underdamped' | 'catheter-whip'
  readonly dampingRatio?: number
  readonly naturalFrequencyHz?: number
  /** Channel name displayed above a tracing that is not that channel. */
  readonly mislabeledAs?: string
  /** Where on the strip the learner is being invited to read, as a fraction of the strip. */
  readonly readAtStripFraction?: number
}

/**
 * The two readings a faulted display is judged on, kept apart (report L3-09).
 *
 * `chamber` says whether the shape on this display still identifies the compartment; `value` says
 * whether the number can be used. An identifiable shape does not make the number usable, and a
 * number withheld does not by itself mean the chamber cannot be named.
 */
export interface NormalWaveformValidityReadout {
  readonly chamber:
    | { readonly identifiable: true; readonly words: string }
    | { readonly identifiable: false; readonly words: string }
  readonly value: string
}

export interface NormalWaveformValidityChallenge {
  readonly id: string
  readonly faultKind: NormalWaveformFaultKind
  readonly label: string
  /** The chamber whose normal tracing is drawn. */
  readonly position: NormalWaveformReferenceEntry['position']
  /** What the monitor claims this channel is. */
  readonly displayedChannelLabel: string
  readonly fault: NormalWaveformDisplayFault
  /** What is visibly different from the reference. */
  readonly whatYouSee: string
  /** The physiologic reading this display invites. */
  readonly whatItInvites: string
  /**
   * Why the display cannot be used as it stands — why no chamber can be named, or, where the shape
   * still names it, why the number cannot be used.
   */
  readonly whyInterpretationIsWithheld: string
  /** The chamber and the value, judged separately, from this challenge's own key. */
  readonly readout: NormalWaveformValidityReadout
  /** The first thing to do about it. */
  readonly repairFirst: string
  /** Text equivalent of the drawn figure, for a learner who cannot see it. */
  readonly figureTextEquivalent: string
  readonly commitment: ClinicalLearningItem
  readonly sourceIds: readonly string[]
}

const DISPLAY_EVIDENCE = ['monitor-workflow-supplied', 'arterial-pressure-five-step-2020']
const MORPHOLOGY_EVIDENCE = ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021']

function commitment(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

export const normalWaveformValidityChallenges: readonly NormalWaveformValidityChallenge[] = [
  {
    id: 'validity-level-or-zero',
    faultKind: 'level-or-zero',
    label: 'Transducer below the reference level',
    position: 'ra',
    displayedChannelLabel: 'CVP / PAC · RA',
    fault: { levelOffsetMmHg: 7.4 },
    whatYouSee:
      'An a, c, v tracing with normal shape and normal respiratory swing, sitting several mmHg higher on the axis than the reference.',
    whatItInvites: 'A raised right-atrial pressure, and a volume decision built on it.',
    whyInterpretationIsWithheld:
      'A transducer 10 cm below the reference adds about 7.4 mmHg to every sample without changing the shape.',
    readout: {
      chamber: {
        identifiable: true,
        words: 'the right-atrial pattern — a, c and v waves and both descents are intact',
      },
      value:
        'not usable until the transducer is re-levelled and zeroed: every sample carries the same hydrostatic offset',
    },
    repairFirst:
      'Put the transducer back at the phlebostatic axis, zero it to atmosphere, then read again.',
    figureTextEquivalent:
      'A right-atrial venous tracing with identifiable a, c, and v waves and x and y descents, drawn several mmHg above where the reference places it. The morphology is unchanged; only the position on the axis has moved.',
    commitment: commitment({
      id: 'hemo-validity-commit-level',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-level-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: 'The transducer has been left about 10 cm below the phlebostatic reference. The tracing has identifiable a, c, and v waves and a normal respiratory swing, and the displayed mean is several mmHg above what this patient had an hour ago. What can you say about the right atrium from this display?',
      choices: [
        {
          id: 'withhold-until-levelled',
          label:
            'Nothing yet: the value carries a hydrostatic offset until the transducer is re-levelled.',
          rationale:
            'An off-level transducer shifts every sample by the same number of mmHg and leaves the shape alone.',
          plausibility: 'best',
        },
        {
          id: 'read-rising-filling-pressure',
          label:
            'Right-atrial pressure has risen since the earlier reading, so filling pressure is higher than it was.',
          rationale: 'Two values taken at different transducer heights cannot be compared.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'accept-because-waves-clean',
          label:
            'The value can be used, because the a, c, and v waves are clean and the respiratory swing is normal.',
          rationale:
            'Clean morphology names the compartment. It says nothing about the reference the pressure is measured against.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['withhold-until-levelled'],
      explanation:
        'Level and zero set the reference; morphology names the compartment. Right-atrial pressures are small, so a fixed offset is proportionally large.',
      evidenceIds: [...DISPLAY_EVIDENCE, 'clinical-hemodynamics-waveforms'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: [...DISPLAY_EVIDENCE, 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'validity-mislabeled-channel',
    faultKind: 'mislabeled-channel',
    label: 'Channel label that does not match the tracing',
    position: 'ra',
    displayedChannelLabel: 'PA',
    fault: { mislabeledAs: 'PA' },
    whatYouSee:
      'A low-amplitude venous tracing with a, c, and v waves, displayed under a channel labelled as the pulmonary artery.',
    whatItInvites: 'Calling it severe damping or a spontaneous wedge, and acting on either.',
    whyInterpretationIsWithheld:
      'The tracing is a normal venous signal under a label that does not belong to it.',
    readout: {
      chamber: {
        identifiable: false,
        words:
          'not named yet — the shape is a normal venous pattern, but the channel says pulmonary artery; which pressure this lumen is connected to has to be settled first',
      },
      value: 'not usable until the channel and the tracing are reconciled',
    },
    repairFirst: 'Check which lumen is connected to this channel before naming the tracing.',
    figureTextEquivalent:
      'A low-amplitude venous tracing with three positive waves and two descents — the right-atrial pattern — displayed beneath a channel heading that reads pulmonary artery.',
    commitment: commitment({
      id: 'hemo-validity-commit-channel',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-channel-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: 'A channel labelled as the pulmonary artery is showing a low-amplitude tracing with three positive waves and two descents, and no dicrotic notch. What is the most defensible next move?',
      choices: [
        {
          id: 'reconcile-channel-first',
          label: 'Check which pressure this channel is connected to before naming the tracing.',
          rationale:
            'Three positive waves and two descents are a normal venous pattern. The label or the connection is the first suspect.',
          plausibility: 'best',
        },
        {
          id: 'call-it-overdamped',
          label:
            'Name it a severely overdamped pulmonary-artery tracing and troubleshoot the fluid path.',
          rationale:
            'Overdamping blunts a pulmonary-artery contour; it does not create a, c and v waves.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'call-it-spontaneous-wedge',
          label: 'Treat it as a spontaneous wedge and withdraw the catheter straight away.',
          rationale:
            'A spontaneous wedge is an emergency, and the reasoning holds if the label is right. That is the part not yet checked.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['reconcile-channel-first'],
      explanation:
        'A channel label is a claim about the signal. When shape and label disagree, find out which is mistaken before acting on either.',
      evidenceIds: [...DISPLAY_EVIDENCE, ...MORPHOLOGY_EVIDENCE],
      reviewStatus: 'sme-review',
    }),
    sourceIds: [...DISPLAY_EVIDENCE, ...MORPHOLOGY_EVIDENCE],
  },
  {
    id: 'validity-scale-mismatch',
    faultKind: 'scale-mismatch',
    label: 'Display range that does not fit the pressure',
    position: 'pa',
    displayedChannelLabel: 'PA',
    fault: { scaleMaxMmHg: 160 },
    whatYouSee:
      'A normal pulmonary-artery tracing compressed into the bottom of an axis wide enough for a systemic arterial pressure. The notch is still there, but too small to find.',
    whatItInvites: 'A diagnosis of overdamping made from appearance.',
    whyInterpretationIsWithheld:
      'The signal has not changed. The axis has, and with it every judgement about amplitude and sharpness.',
    readout: {
      chamber: {
        identifiable: false,
        words: 'not judged from this plot — set a display range that fits, then read the contour',
      },
      value:
        'not judged from how much of the axis the tracing fills: the axis changes how large it is drawn, not the pressure',
    },
    repairFirst: 'Set a display range that fits pulmonary-artery pressure, then judge the contour.',
    figureTextEquivalent:
      'A pulmonary-artery tracing with a systolic peak, a dicrotic notch, and down-sloping diastole, drawn against an axis running to 160 mmHg so that the whole waveform occupies the lowest fifth of the plot.',
    commitment: commitment({
      id: 'hemo-validity-commit-scale',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-scale-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: `A pulmonary-artery channel looks flat and featureless. The axis runs to 160 mmHg; the reference draws the same signal against ${NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG} mmHg. What does the flat appearance establish?`,
      choices: [
        {
          id: 'appearance-is-the-axis',
          label: 'Nothing about the signal; set a pulmonary-artery display range and look again.',
          rationale: 'How tall a tracing is drawn depends on the axis. The pressure has not moved.',
          plausibility: 'best',
        },
        {
          id: 'flat-means-overdamped',
          label:
            'The system is overdamped, because a blunted low-amplitude tracing is what overdamping looks like.',
          rationale:
            'An overdamped line and a mismatched axis look alike. A fast flush separates them.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'low-pa-pressure',
          label: 'Pulmonary-artery pressure is low, given how little of the axis it occupies.',
          rationale:
            'How much of the axis a tracing fills is a property of the axis. Read the numbers.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['appearance-is-the-axis'],
      explanation:
        'A wide range flattens a normal signal and a narrow one clips it. Check the axis before you call a tracing damped.',
      evidenceIds: [...DISPLAY_EVIDENCE, 'emcrit-rhc-supplied-2026'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: [...DISPLAY_EVIDENCE, 'emcrit-rhc-supplied-2026'],
  },
  {
    id: 'validity-overdamped',
    faultKind: 'overdamped',
    label: 'Overdamped measurement system',
    position: 'pa',
    displayedChannelLabel: 'PA',
    fault: { artifact: 'overdamped', dampingRatio: 1.15, naturalFrequencyHz: 9 },
    whatYouSee:
      'A rounded upstroke, a blunted peak, a narrowed pulse pressure, and a dicrotic notch that has largely disappeared.',
    whatItInvites:
      'A falsely reassuring systolic pressure, or the conclusion that the tip is still in the right ventricle because the notch is gone.',
    whyInterpretationIsWithheld:
      'An overdamped line reads systolic low and diastolic high while the mean is relatively preserved. The peak and the notch, which identify the chamber, go first.',
    readout: {
      chamber: {
        identifiable: false,
        words:
          'not confirmed — damping removes the peak sharpness and the notch that identify the chamber',
      },
      value:
        'the mean only, with caution; systolic, diastolic and pulse pressure are withheld until the fluid path is repaired',
    },
    repairFirst:
      'Check the line for air, blood, kinks, loose connections and a low pressure bag, then repeat the fast flush.',
    figureTextEquivalent:
      'A pulmonary-artery tracing whose upstroke is rounded, whose peak is blunted and lower than the reference, and whose dicrotic notch is barely visible. The pulse pressure is narrower and the mean is close to the reference.',
    commitment: commitment({
      id: 'hemo-validity-commit-overdamped',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-overdamped-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: 'A tracing on the pulmonary-artery channel has a rounded upstroke, a blunted peak, and almost no dicrotic notch. The fast-flush release creeps back without oscillating. Which part of this display may be used?',
      choices: [
        {
          id: 'mean-only-repair-path',
          label:
            'The mean, with caution; repair the fluid path before judging the contour or the position.',
          rationale:
            'Damping spares the mean. The creeping fast flush puts the problem in the line.',
          plausibility: 'best',
        },
        {
          id: 'tip-back-in-rv',
          label:
            'The absent notch means the tip has fallen back into the right ventricle, so reposition it.',
          rationale:
            'Damping erases the notch too, and a right-ventricular tracing would have a diastole near zero.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'reassuring-systolic',
          label: 'The lower systolic pressure is reassuring and can be recorded as an improvement.',
          rationale: 'A damped systolic pressure is falsely low by an unknown amount.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['mean-only-repair-path'],
      explanation:
        'Damping belongs to the catheter, tubing and transducer. It removes the sharp peak and the notch, so a damped tracing cannot confirm a position.',
      evidenceIds: [...DISPLAY_EVIDENCE, 'clinical-hemodynamics-waveforms'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: [...DISPLAY_EVIDENCE, 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'validity-underdamped',
    faultKind: 'underdamped',
    label: 'Underdamped system with ringing',
    position: 'rv',
    displayedChannelLabel: 'PAC · RV',
    fault: { artifact: 'underdamped', dampingRatio: 0.24, naturalFrequencyHz: 11 },
    whatYouSee:
      'An exaggerated systolic peak with rapid oscillations after it that run down into the diastolic segment and obscure its contour.',
    whatItInvites:
      'A raised systolic pressure, and the conclusion that the tip has reached the pulmonary artery because the diastolic slope is hidden.',
    whyInterpretationIsWithheld:
      'Ringing reads systolic high and diastolic low. Here it also sits on the diastolic contour that separates the right ventricle from the pulmonary artery.',
    readout: {
      chamber: {
        identifiable: false,
        words:
          'not settled — the ringing sits on the diastolic contour that separates the right ventricle from the pulmonary artery',
      },
      value: 'the peak is not usable: resonance exaggerates it',
    },
    repairFirst:
      'Do a fast flush. If it rings, shorten the tubing and remove extra stopcocks before reading the peak or naming the chamber.',
    figureTextEquivalent:
      'A right-ventricular tracing whose systolic peak overshoots the reference and is followed by several narrow, rapidly decaying oscillations. The diastolic segment beneath them is disturbed, so its upward slope is difficult to trace.',
    commitment: commitment({
      id: 'hemo-validity-commit-underdamped',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-underdamped-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: 'A right-sided tracing shows a tall systolic peak followed by several rapid oscillations, and the diastolic segment is hard to follow. The displayed systolic pressure has risen since the last reading. What follows from this display?',
      choices: [
        {
          id: 'resolve-ringing-before-naming',
          label:
            'Neither the peak nor the chamber; resolve the ringing first, because it hides the diastolic contour.',
          rationale:
            'Resonance widens the pulse pressure, and the oscillations sit where the diastolic contour has to be read.',
          plausibility: 'best',
        },
        {
          id: 'rising-pa-pressure',
          label:
            'Pulmonary pressures are rising, since the systolic peak is clearly higher than it was.',
          rationale:
            'An underdamped line overshoots the true peak. A rise that appears with the ringing belongs to the tubing.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'must-be-pa-now',
          label:
            'The tip has reached the pulmonary artery, because the diastolic segment no longer slopes up.',
          rationale:
            'A slope hidden by artifact is not a slope that is absent. A pulmonary-artery tracing also needs a diastolic step-up and a notch.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['resolve-ringing-before-naming'],
      explanation:
        'Ringing is a property of the line. When it lands on the feature that identifies the chamber, the position is unconfirmed, and you do not advance from an unconfirmed position.',
      evidenceIds: [...DISPLAY_EVIDENCE, 'clinical-hemodynamics-waveforms'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: [...DISPLAY_EVIDENCE, 'clinical-hemodynamics-waveforms'],
  },
  {
    id: 'validity-motion-artifact',
    faultKind: 'motion-artifact',
    label: 'Catheter motion artifact',
    position: 'pa',
    displayedChannelLabel: 'PA',
    fault: { artifact: 'catheter-whip', dampingRatio: 0.62, naturalFrequencyHz: 12 },
    whatYouSee:
      'Narrow spikes added to an otherwise recognizable pulmonary-artery tracing, varying from beat to beat rather than repeating identically.',
    whatItInvites: 'A systolic pressure and pulse pressure higher than the artery is producing.',
    whyInterpretationIsWithheld:
      'The spikes come from the catheter moving in the vessel. They change from beat to beat, so no single beat can be trusted.',
    readout: {
      chamber: {
        identifiable: true,
        words:
          'the pulmonary-artery pattern — the notch and the down-sloping diastole are preserved',
      },
      value:
        'no single beat’s systolic or diastolic value is usable: the spikes overestimate the one and underestimate the other, differently on every beat',
    },
    repairFirst:
      'Do not record the peak. Secure the catheter and tubing; if the spikes persist, reposition the tip slightly.',
    figureTextEquivalent:
      'A pulmonary-artery tracing with its usual systolic peak, dicrotic notch, and down-sloping diastole, carrying additional narrow spikes near the upstroke whose height differs from beat to beat.',
    commitment: commitment({
      id: 'hemo-validity-commit-motion',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-motion-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: 'A pulmonary-artery tracing keeps its notch and its down-sloping diastole, but carries narrow spikes near the upstroke that are a different height on every beat. What should be recorded?',
      choices: [
        {
          id: 'withhold-peak-beat-variation',
          label:
            'Not the peak: spikes that change height on every beat are catheter motion, not pressure.',
          rationale:
            'A moving catheter adds a deflection that overestimates systolic pressure. Physiologic beats repeat; this does not.',
          plausibility: 'best',
        },
        {
          id: 'record-highest-beat',
          label:
            'The highest beat, since a peak pressure should be recorded at its maximum to avoid understating it.',
          rationale: 'The tallest deflection is the beat most contaminated by motion.',
          plausibility: 'unsafe',
        },
        {
          id: 'call-it-underdamped',
          label:
            'Record it as an underdamped system and adjust the tubing before reading the tracing.',
          rationale:
            'Resonance repeats identically beat to beat. This does not, which implicates the catheter.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['withhold-peak-beat-variation'],
      explanation:
        'Ringing repeats identically on every beat; catheter whip does not. Neither is physiology, and they are fixed in different places.',
      evidenceIds: [...MORPHOLOGY_EVIDENCE, 'pac-review-2014'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: [...MORPHOLOGY_EVIDENCE, 'pac-review-2014'],
  },
  {
    id: 'validity-respiratory-phase',
    faultKind: 'respiratory-phase-mismatch',
    label: 'Read away from end expiration',
    position: 'wedge',
    displayedChannelLabel: 'PAWP',
    fault: { readAtStripFraction: 0.02 },
    whatYouSee:
      'A wedge tracing with well-formed a and v waves, and a cursor sitting on the peak of the slow respiratory envelope instead of its trough.',
    whatItInvites: 'A raised wedge pressure, and a diuretic or fluid decision built on it.',
    whyInterpretationIsWithheld:
      'The displayed pressure includes the pressure around the vessel, so it moves along the respiratory swing with no change in the circulation.',
    readout: {
      chamber: {
        identifiable: true,
        words: 'the wedge (occlusion) pattern — clean a and v waves',
      },
      value:
        'not usable as taken: it was read at the top of the respiratory swing; re-read at end expiration',
    },
    repairFirst:
      'Freeze the trace and read at end expiration: the trough of the swing on controlled ventilation, the peak in spontaneous breathing.',
    figureTextEquivalent:
      'A wedge tracing with identifiable a and v waves, drawn across one respiratory cycle. The reading marker sits at the peak of the slow respiratory envelope rather than at its trough, which is where end expiration falls under controlled positive-pressure ventilation.',
    commitment: commitment({
      id: 'hemo-validity-commit-respiratory',
      activityId: 'hemodynamics:learn:waveform-interpretation',
      phase: 'recognize',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'hemo-normal-reference-respiratory-fault',
      visualAssetIds: ['normal-waveform-reference-figure'],
      stem: 'A wedge tracing has clean a and v waves. The value has been taken at the top of the slow respiratory swing, in a patient receiving controlled positive-pressure ventilation. What does that value represent?',
      choices: [
        {
          id: 'reread-at-end-expiration',
          label:
            'An overestimate from airway pressure; re-read at the trough of the swing, which is end expiration here.',
          rationale:
            'At the inspiratory peak of a positive-pressure breath, airway pressure adds most to the number.',
          plausibility: 'best',
        },
        {
          id: 'peak-is-true-filling',
          label:
            'The highest value in the breath, which is the safest estimate of true left-sided filling pressure.',
          rationale:
            'The inspiratory maximum carries the largest contribution from airway pressure.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'average-the-breath',
          label:
            'Averaging the whole breath removes the respiratory contribution and gives a usable number.',
          rationale:
            'An average moves with the size of the swing, so it tracks airway pressure instead of removing it.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['reread-at-end-expiration'],
      explanation:
        'End expiration is where pleural pressure is closest to atmospheric and readings are comparable. The swing matters most on the wedge, where the pressure is small.',
      evidenceIds: ['cvp-measurement-2017', 'pac-waveforms-part-1-2021', 'pac-derived-part-2-2021'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: ['cvp-measurement-2017', 'pac-waveforms-part-1-2021', 'pac-derived-part-2-2021'],
  },
] as const

/** Fails the import rather than the render. */
function assertValidityChallengesAreResolvable(): void {
  const ids = new Set<string>()
  const faultKinds = new Set<NormalWaveformFaultKind>()
  for (const challenge of normalWaveformValidityChallenges) {
    if (ids.has(challenge.id)) {
      throw new Error(`Duplicate normal waveform validity challenge: ${challenge.id}`)
    }
    ids.add(challenge.id)
    faultKinds.add(challenge.faultKind)
    // Throws if the reference has no entry for the chamber the challenge distorts.
    normalWaveformReferenceEntry(challenge.position)
    for (const sourceId of challenge.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        throw new Error(
          `Validity challenge ${challenge.id} cites an unregistered source: ${sourceId}`,
        )
      }
    }
  }
  const requiredKinds: readonly NormalWaveformFaultKind[] = [
    'level-or-zero',
    'mislabeled-channel',
    'scale-mismatch',
    'overdamped',
    'underdamped',
    'motion-artifact',
    'respiratory-phase-mismatch',
  ]
  for (const kind of requiredKinds) {
    if (!faultKinds.has(kind)) {
      throw new Error(`Normal waveform validity challenges are missing the ${kind} problem.`)
    }
  }
}

assertValidityChallengesAreResolvable()

export function normalWaveformValidityChallenge(id: string): NormalWaveformValidityChallenge {
  const challenge = normalWaveformValidityChallenges.find((candidate) => candidate.id === id)
  if (!challenge) throw new Error(`Unknown normal waveform validity challenge: ${id}`)
  return challenge
}

/** Shown when a fault removes the features that identify the chamber. */
export const NORMAL_WAVEFORM_INTERPRETATION_WITHHELD =
  'The chamber cannot be named from this display'

/**
 * Whether a chamber may be named from the display. A clean display always; a faulted one only when
 * its fault leaves the identifying shape intact — and even then the number is judged separately.
 */
export function chamberInterpretationAvailable(
  challenge: NormalWaveformValidityChallenge | null,
): boolean {
  return challenge === null || challenge.readout.chamber.identifiable
}

/** The heading the reasoning's "why" row carries, true to what this display withholds. */
export function validityWithheldHeading(challenge: NormalWaveformValidityChallenge): string {
  return challenge.readout.chamber.identifiable
    ? 'Why the number cannot be used as displayed'
    : 'Why no chamber can be named'
}
