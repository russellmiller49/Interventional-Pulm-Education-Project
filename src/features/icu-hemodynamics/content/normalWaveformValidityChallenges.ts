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
 * Representative signal-validity problems, shown against the same normal reference (H2 §5).
 *
 * The reference teaches what each chamber should look like. On its own that produces a learner who
 * can name four tracings and will name them just as confidently when the tracing is a display
 * artifact — which is the failure the pressure-system section exists to prevent and which has to be
 * exercised, not merely stated.
 *
 * Each challenge draws one of the four normal tracings through one authored display fault. Nothing
 * here re-implements waveform physics: the fault is a display specification the figure applies using
 * the same artifact transforms the live monitor uses, and the underlying trace is the atlas entry
 * the reference already points at.
 *
 * The answer is always the same shape — the chamber cannot be named confidently from this display,
 * and something has to be repaired or re-read first. That is the point. Withholding is prevented
 * from becoming a guessable habit by distractors that are the genuine physiologic misreads each
 * fault produces.
 *
 * Nothing here gates. Every station stays reachable by URL, and a learner who never opens a
 * challenge can still work through every other part of the section.
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
  /** Why a chamber cannot be named from this display. */
  readonly whyInterpretationIsWithheld: string
  /** The first thing to do about it, bounded to what the sources support. */
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
    whatItInvites:
      'A raised right-atrial pressure, and a decision about volume built on it. Every wave component is where it belongs, so nothing on the tracing argues against the number.',
    whyInterpretationIsWithheld:
      'A hydrostatic offset moves the whole tracing without changing its shape. Shape is the only thing this display can vouch for, and shape is exactly what the fault leaves intact.',
    repairFirst:
      'Return the transducer to the institutional phlebostatic reference and establish atmospheric zero as a separate step, then read the tracing again.',
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
            'Nothing yet. The morphology identifies the compartment, but the value carries a hydrostatic offset until the transducer is re-levelled and zeroed.',
          rationale:
            'An off-level transducer shifts every sample by a fixed number of mmHg without touching the shape. Because right-atrial pressures are small, that fixed offset is proportionally large.',
          plausibility: 'best',
        },
        {
          id: 'read-rising-filling-pressure',
          label:
            'Right-atrial pressure has risen since the earlier reading, so filling pressure is higher than it was.',
          rationale:
            'This is the reading the fault is designed to produce. Two values taken at different transducer heights are not comparable, whatever the trend looks like.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'accept-because-waves-clean',
          label:
            'The value can be used, because the a, c, and v waves are clean and the respiratory swing is normal.',
          rationale:
            'Clean morphology establishes which compartment is being sampled. It says nothing about the reference the pressure is reported against.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['withhold-until-levelled'],
      explanation:
        'Level and zero establish the reference; morphology establishes the compartment. A tracing can be flawless on the second and unusable on the first, and this is the fault that looks least like a fault.',
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
    whatItInvites:
      'A diagnosis. A venous-looking tracing on a pulmonary-artery channel reads as severe damping, or as a spontaneous wedge, and both invite immediate action.',
    whyInterpretationIsWithheld:
      'The tracing is a valid signal under a label that does not belong to it. Nothing about the shape is abnormal, so any conclusion drawn from the mismatch is a conclusion about the label.',
    repairFirst:
      'Read the channel label and the axis before the shape, and reconcile the displayed channel with where the catheter is supposed to be. Confirm which pressure this lumen is actually connected to before naming what is at fault in it.',
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
          label:
            'Establish which pressure this channel is connected to before naming the tracing, because the shape shown is a normal venous pattern rather than a damaged pulmonary-artery one.',
          rationale:
            'A venous morphology under a pulmonary-artery heading is a mismatch between signal and label. Which of the two is mistaken has to be settled before either is interpreted.',
          plausibility: 'best',
        },
        {
          id: 'call-it-overdamped',
          label:
            'Name it a severely overdamped pulmonary-artery tracing and troubleshoot the fluid path.',
          rationale:
            'Overdamping blunts a pulmonary-artery contour; it does not manufacture a, c, and v waves. Troubleshooting the tubing here repairs something that is not broken.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'call-it-spontaneous-wedge',
          label:
            'Treat it as a spontaneous wedge and withdraw the catheter under supervision straight away.',
          rationale:
            'A spontaneous wedge is a real emergency and the reasoning is sound if the label is right — which is precisely the assumption that has not been checked.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['reconcile-channel-first'],
      explanation:
        'A displayed label is a claim about the signal, not part of it. When morphology and label disagree, the disagreement itself is the finding, and acting on either one before reconciling them means acting on an unverified assumption.',
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
    whatItInvites:
      'A damping diagnosis made from appearance. A flat-looking tracing is the classic picture of an overdamped system, and the axis is the last thing a hurried reader looks at.',
    whyInterpretationIsWithheld:
      'Nothing about the signal changed. The axis changed, and with it every judgement about amplitude, pulse pressure, and how sharp the contour looks.',
    repairFirst:
      'Set a display range that fits the pressure you expect from this chamber, then judge the contour. Compare the axis before comparing two tracings to each other.',
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
          label:
            'Nothing about the signal. Set a display range appropriate to pulmonary-artery pressure and judge the contour again before naming any distortion.',
          rationale:
            'Amplitude on screen is signal divided by axis. Changing the denominator changes every visual judgement while the pressure stays where it was.',
          plausibility: 'best',
        },
        {
          id: 'flat-means-overdamped',
          label:
            'The system is overdamped, because a blunted low-amplitude tracing is what overdamping looks like.',
          rationale:
            'It is what overdamping looks like — and also what a mismatched axis looks like. Appearance alone cannot separate them; a fast-flush response can.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'low-pa-pressure',
          label: 'Pulmonary-artery pressure is low, given how little of the axis it occupies.',
          rationale:
            'How much of the axis a tracing occupies is a property of the axis. Read the numbers on it rather than the fraction of the plot filled.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['appearance-is-the-axis'],
      explanation:
        'The scale-and-channel step of the validity sequence exists for this. A high range flattens a normal signal and a narrow one clips it, and both invite a damping diagnosis that belongs to the display rather than the patient.',
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
      'Either a falsely reassuring pulmonary-artery systolic pressure, or — because the notch is what marks the pulmonic valve — the conclusion that the tip is still in the right ventricle.',
    whyInterpretationIsWithheld:
      'An overdamped system attenuates rapid pressure change, so systolic reads low and diastolic reads high while the mean stays relatively preserved. The features that identify the chamber are the first thing lost.',
    repairFirst:
      'Trace the fluid path for air, blood, kinks, loose connections, and a low pressure bag, then classify the fast-flush release before interpreting anything but the mean.',
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
            'The mean, with caution. Withhold systolic, diastolic, and pulse pressure, and repair the fluid path before judging the contour or the catheter position.',
          rationale:
            'Damping attenuates rapid pressure change and leaves the mean relatively preserved. The creeping fast-flush release is what identifies the problem as the measurement system.',
          plausibility: 'best',
        },
        {
          id: 'tip-back-in-rv',
          label:
            'The absent notch means the tip has fallen back into the right ventricle; withdraw the assumption of a pulmonary-artery position.',
          rationale:
            'The notch is the pulmonary-artery marker, so its loss is worth taking seriously — but damping erases it too, and a right-ventricular tracing would also slope up through diastole.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'reassuring-systolic',
          label: 'The lower systolic pressure is reassuring and can be recorded as an improvement.',
          rationale:
            'A damped systolic pressure is falsely low by an amount nobody can quantify from the tracing. Recording it as improvement records the tubing rather than the patient.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['mean-only-repair-path'],
      explanation:
        'Damping is a property of the catheter, tubing, and transducer, not of the circulation. It removes exactly the features — peak sharpness and the notch — that chamber identification depends on, which is why a damped tracing cannot confirm a position.',
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
      'A raised right-ventricular systolic pressure, and — because the diastolic contour is buried under the ringing — the conclusion that the tip has already reached the pulmonary artery.',
    whyInterpretationIsWithheld:
      'Resonance exaggerates rapid pressure change: systolic reads high, diastolic reads low, and the pulse pressure widens independently of the patient. Here it also destroys the one feature that separates this chamber from the next one.',
    repairFirst:
      'Classify the fast-flush release; persistent ringing identifies the system rather than the patient. Resolve it before either reading the peak or deciding which chamber the tip is in.',
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
            'Neither the peak nor the chamber can be settled here. Resolve the ringing first, because the diastolic contour it obscures is part of what distinguishes the right ventricle from the pulmonary artery.',
          rationale:
            'Resonance widens pulse pressure independently of the circulation, and the oscillations sit exactly where the diastolic contour has to be read.',
          plausibility: 'best',
        },
        {
          id: 'rising-pa-pressure',
          label:
            'Pulmonary pressures are rising, since the systolic peak is clearly higher than it was.',
          rationale:
            'An underdamped system overshoots the true peak. A rise seen only after the tracing started ringing is a property of the tubing until proven otherwise.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'must-be-pa-now',
          label:
            'The tip has reached the pulmonary artery, because the diastolic segment no longer slopes up.',
          rationale:
            'It no longer looks as though it climbs, which is not the same thing. Losing a feature to artifact is not the same as the feature being absent — and a pulmonary-artery position would also need a diastolic step-up, a downward runoff, and a notch, none of which this tracing can show through the ringing.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['resolve-ringing-before-naming'],
      explanation:
        'A distorted dynamic response is not a physiologic finding. When the distortion lands on the feature that identifies the chamber, the position is unconfirmed — and an unconfirmed position is not somewhere to advance from.',
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
    whatItInvites:
      'A higher systolic pressure and a wider pulse pressure than the artery is producing, and a derived value calculated from both.',
    whyInterpretationIsWithheld:
      'The spikes come from the catheter moving inside the vessel, not from the pressure inside it. They overestimate systolic pressure and underestimate diastolic pressure, and they change from beat to beat, so no single beat can be trusted.',
    repairFirst:
      'Note that the extra deflections do not repeat identically beat to beat, and reassess the catheter and its loop under appropriate supervision rather than recording the peak.',
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
            'Not the peak. Beat-to-beat variation in an added deflection indicates the catheter is moving rather than the pressure changing, and the systolic value it produces is unusable.',
          rationale:
            'Motion of the fluid column inside a moving catheter overestimates systolic and underestimates diastolic pressure. Physiologic beats repeat; this deflection does not.',
          plausibility: 'best',
        },
        {
          id: 'record-highest-beat',
          label:
            'The highest beat, since a peak pressure should be recorded at its maximum to avoid understating it.',
          rationale:
            'Choosing the largest deflection selects the beat most contaminated by motion. The maximum is the least representative sample here, not the most.',
          plausibility: 'unsafe',
        },
        {
          id: 'call-it-underdamped',
          label:
            'Record it as an underdamped system and adjust the tubing before reading the tracing.',
          rationale:
            'Resonance produces a regular oscillation that repeats identically beat to beat. This deflection does not repeat, which implicates the catheter rather than the tubing.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['withhold-peak-beat-variation'],
      explanation:
        'Beat-to-beat reproducibility is the readable difference between a system artifact and a moving catheter. Neither is physiology, and both make a systolic pressure unusable — but they are repaired in different places.',
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
    whatItInvites:
      'A raised occlusion pressure, and a diuretic or fluid decision built on the difference between two readings taken at different moments in the breath.',
    whyInterpretationIsWithheld:
      'The displayed pressure includes whatever surrounds the vessel. Moving along the respiratory swing changes the number without anything changing in the circulation, and the swing is largest exactly here.',
    repairFirst:
      'Freeze the trace, identify the trough of the slow envelope under controlled positive-pressure ventilation, and read there. Confirm the ventilation mode first, because spontaneous breathing moves the envelope the other way.',
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
            'A pressure sampled at the point in the breath where surrounding pressure contributes most. Re-read at the trough of the slow envelope, which is end expiration in this ventilation mode.',
          rationale:
            'What is measured is the pressure inside the vessel including whatever surrounds it. End expiration is the agreed sampling point precisely because it makes two readings comparable.',
          plausibility: 'best',
        },
        {
          id: 'peak-is-true-filling',
          label:
            'The highest value in the breath, which is the safest estimate of true left-sided filling pressure.',
          rationale:
            'The inspiratory maximum carries the largest contribution from airway pressure. Taking the highest value systematically overstates the vascular pressure of interest.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'average-the-breath',
          label:
            'Averaging the whole breath removes the respiratory contribution and gives a usable number.',
          rationale:
            'An average across the breath depends on how big the swing is, so it moves with airway pressure rather than removing it, and it loses the reference point that makes readings comparable.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['reread-at-end-expiration'],
      explanation:
        'Respiratory phase is a validity step, not a refinement. The swing is most prominent on the wedge, where the pressure is small and the surrounding pressure is transmitted directly to it, so where you read matters more here than anywhere else.',
      evidenceIds: ['cvp-measurement-2017', 'pac-waveforms-part-1-2021', 'pac-derived-part-2-2021'],
      reviewStatus: 'sme-review',
    }),
    sourceIds: ['cvp-measurement-2017', 'pac-waveforms-part-1-2021', 'pac-derived-part-2-2021'],
  },
] as const

/** Fails the import rather than the render — same reasoning as the reference itself. */
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

/**
 * The answer a valid signal would license, and this one does not.
 *
 * Held as data rather than as a sentence inside a component, so the contract "an invalid signal
 * prevents a confident chamber interpretation" is something a suite can assert against the record
 * rather than against rendered prose.
 */
export const NORMAL_WAVEFORM_INTERPRETATION_WITHHELD =
  'Chamber interpretation withheld — this display cannot support one'

export function chamberInterpretationAvailable(
  challenge: NormalWaveformValidityChallenge | null,
): boolean {
  return challenge === null
}
