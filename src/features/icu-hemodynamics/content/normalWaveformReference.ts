import { hemodynamicsSourceById } from './sources'
import { waveformAtlasById, type WaveformAtlasEntry } from './waveformAtlas'

/**
 * The single canonical normal RA → RV → PA → PAWP reference (H2).
 *
 * H0/H1 established a limited version of this: seven uniform facets per chamber, pointing at the
 * atlas for the figure. H2 extends that same record rather than adding a second reference, because
 * the advancement section needs exactly the same facts — where the tip is, what the tracing should
 * look like, what should change from the previous chamber, and what would make the signal
 * untrustworthy. Two authored copies of those facts would drift.
 *
 * What H2 adds to each entry:
 *
 * - `order` and `expectedChangeFromPrevious`, so the reference reads as a sequence rather than four
 *   independent cards, and so the advancement station can ask "what should change next?" from the
 *   same record.
 * - `technicalDistortions`, itemized. The H0/H1 prose sentence stays (it is the summary a learner
 *   reads first), but each distortion now carries what you see, what it mimics, and its evidence,
 *   because the H2 interaction asks the learner to tell distortion from physiology.
 * - `cannotEstablish` — what a correct reading of this tracing still does not license.
 * - `displayUnit`, `respiratorySwingMmHg`, and the shared scale below, so the figure never changes
 *   its axis without saying so.
 * - `evidenceIds`, validated at import.
 *
 * Pressure ranges are quoted as commonly reported values with that framing made explicit. None is a
 * treatment target, and this module has no source that supplies one.
 */

/** Every pressure in this reference is displayed in the same unit. */
export const NORMAL_WAVEFORM_REFERENCE_UNIT = 'mmHg' as const

/**
 * One scale for all four normal tracings.
 *
 * The atlas gives each entry its own `scaleMaxMmHg` — 20 for the right atrium and the wedge, 40 for
 * the right ventricle and the pulmonary artery. That is right for a standalone figure and wrong for
 * a reference the learner steps through, because a right-atrial tracing and a wedge tracing drawn to
 * 20 mmHg look the same height as a pulmonary-artery tracing drawn to 40 mmHg. A novice comparing
 * them concludes the pressures are comparable. Nothing on the axis contradicts that, and nothing
 * announces the change.
 *
 * So the reference pins one scale across all four states. The learner may still switch to the
 * low-pressure detail scale — that is a real bedside action and worth teaching — but the switch is
 * deliberate, labeled, and announced.
 */
export const NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG = 40
export const NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG = 20

export type NormalWaveformScaleId = 'shared' | 'low-pressure-detail'

export interface NormalWaveformScaleOption {
  readonly id: NormalWaveformScaleId
  readonly label: string
  readonly maxMmHg: number
  readonly whyItExists: string
  /** Shown whenever this scale is active, so a height change is never read as a pressure change. */
  readonly notice: string
}

export const normalWaveformScaleOptions: readonly NormalWaveformScaleOption[] = [
  {
    id: 'shared',
    label: `Shared 0–${NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG} ${NORMAL_WAVEFORM_REFERENCE_UNIT}`,
    maxMmHg: NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG,
    whyItExists:
      'One scale for all four tracings, so the height you see is the pressure difference between chambers rather than a difference between two figures.',
    notice: `All four states are drawn on the same 0–${NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG} ${NORMAL_WAVEFORM_REFERENCE_UNIT} axis. Heights are comparable across chambers.`,
  },
  {
    id: 'low-pressure-detail',
    label: `Low-pressure detail 0–${NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG} ${NORMAL_WAVEFORM_REFERENCE_UNIT}`,
    maxMmHg: NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG,
    whyItExists:
      'A venous tracing spanning a few mmHg has wave components that are hard to see on a wide scale. Narrowing the axis makes them readable.',
    notice: `SCALE CHANGED to 0–${NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG} ${NORMAL_WAVEFORM_REFERENCE_UNIT}. The tracing is drawn taller because the axis is narrower. No pressure has changed, and heights can no longer be compared with the shared scale.`,
  },
] as const

export function normalWaveformScaleOption(id: NormalWaveformScaleId): NormalWaveformScaleOption {
  const option = normalWaveformScaleOptions.find((candidate) => candidate.id === id)
  if (!option) throw new Error(`Unknown normal waveform scale: ${id}`)
  return option
}

/**
 * The respiratory context every entry is described against.
 *
 * Stated once rather than repeated per chamber: the modeled patient is on controlled
 * positive-pressure ventilation, so the slow envelope rises during inspiration and end expiration is
 * the trough. Spontaneous breathing reverses the direction, which is why the contrast is carried
 * here instead of being left implicit.
 */
export const NORMAL_WAVEFORM_RESPIRATORY_CONTEXT = {
  mode: 'Controlled positive-pressure ventilation',
  /** Breaths drawn across the reference strip, so the marker lands on a real trough. */
  cyclesPerStrip: 1,
  /** Fraction of the strip where the slow envelope is at its trough. */
  endExpirationPhase: 0.5,
  readingRule:
    'Freeze the trace, find the trough of the slow respiratory envelope, and read there. Under controlled positive-pressure ventilation that trough is end expiration.',
  spontaneousContrast:
    'With spontaneous breathing the envelope moves the other way, so the same rule lands on a different part of the breath. Identify the ventilation mode before applying it.',
  renderingBoundary:
    'The respiratory swing drawn here is qualitative — enough to show which point on the strip is end expiration. It is not a measured amplitude for this or any patient.',
  sourceIds: ['cvp-measurement-2017', 'pac-waveforms-part-1-2021'],
} as const

/**
 * The rhythm this reference is drawn in, stated rather than assumed.
 *
 * Every tracing here has a P wave in front of it and an a wave on it, and the wave-by-wave timing
 * described in each entry depends on both. A learner who meets this reference and then meets a
 * patient in atrial fibrillation has to know which parts stopped applying — otherwise the missing a
 * wave reads as an invalid tracing, which is the wrong conclusion and, on a wedge, a costly one.
 */
export const NORMAL_WAVEFORM_RHYTHM_CONTEXT = {
  assumption: 'This reference assumes sinus rhythm.',
  whyItMatters:
    'Each entry times its waves against a P wave, and the a wave exists because the atrium contracts in an organized way. Both are properties of the rhythm rather than of the catheter.',
  atrialFibrillation:
    'Atrial fibrillation removes the a wave. On a wedge tracing its absence does not by itself make the tracing invalid — the remaining ECG and pressure landmarks carry the timing instead, and the x descent survives because part of it reflects descent of the atrioventricular junction during ventricular systole rather than atrial relaxation.',
  whatToUseInstead:
    'Identify the compartment from the wave components that remain and from their timing against the QRS complex and the T wave, and judge validity from the whole picture — signal quality, respiratory phase, the clinical context, and the return of the pulmonary-artery waveform on deflation.',
  sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
} as const

export interface NormalWaveformTechnicalDistortion {
  readonly id: string
  readonly label: string
  /** What appears on the screen. */
  readonly whatYouSee: string
  /** The physiologic finding it can be mistaken for. */
  readonly whatItMimics: string
  readonly sourceIds: readonly string[]
}

export interface NormalWaveformReferenceEntry {
  readonly atlasEntryId: string
  readonly position: 'ra' | 'rv' | 'pa' | 'wedge'
  /** Place in the insertion sequence, 1-based. */
  readonly order: number
  /** Where the tip physically is when this tracing appears. */
  readonly physicalLocation: string
  readonly expectedMorphology: string
  readonly ecgRelation: string
  /** Direction and relationships, not a target to drive toward. */
  readonly pressureDirection: string
  /** What should be different from the previous state, and what confirms it. */
  readonly expectedChangeFromPrevious: string
  readonly respiratoryVariation: string
  /** Peak-to-trough respiratory swing drawn on the figure. Qualitative — see the context above. */
  readonly respiratorySwingMmHg: number
  /** The prose summary a learner reads first. */
  readonly technicalDistortion: string
  /** The same distortions, itemized for the interaction that asks the learner to tell them apart. */
  readonly technicalDistortions: readonly NormalWaveformTechnicalDistortion[]
  /** What makes this tracing unsafe or impossible to interpret. */
  readonly unsafeToInterpret: string
  /** What a correct reading of this tracing still does not establish. */
  readonly cannotEstablish: string
  readonly displayUnit: typeof NORMAL_WAVEFORM_REFERENCE_UNIT
  readonly evidenceIds: readonly string[]
}

export const NORMAL_WAVEFORM_RANGE_CAVEAT = 'Normal resting adult values.'

export const normalWaveformReference: readonly NormalWaveformReferenceEntry[] = [
  {
    atlasEntryId: 'ra-normal',
    position: 'ra',
    order: 1,
    physicalLocation:
      'The distal tip sits in the right atrium, past the introducer and the superior vena cava. The distal PAC channel and the CVP channel report the same pressure here.',
    expectedMorphology:
      'A low-amplitude venous tracing spanning only a few mmHg: three positive waves (a, c, v) and two descents (x, y). The a wave is normally taller than the v wave.',
    ecgRelation:
      'The a wave follows the P wave by roughly 80 ms; the c wave follows the QRS complex; the v wave peaks at the end of the T wave. The y descent belongs to early ventricular diastole.',
    pressureDirection:
      'Lowest of the four tracings, and within a few mmHg of right ventricular end-diastolic pressure. Normal mean 2–6 mmHg.',
    expectedChangeFromPrevious:
      'The first intracardiac tracing: a, c and v waves at low amplitude. Confirm it by its morphology, never by depth alone.',
    respiratoryVariation:
      'On controlled positive-pressure ventilation the tracing rises with inspiration, so end expiration is the trough. In spontaneous breathing it is the peak. Freeze the trace, find end expiration, and read at the base of the c wave.',
    respiratorySwingMmHg: 3,
    technicalDistortion:
      'Wall contact flattens the waves; valve contact adds a spike. An off-level transducer shifts the whole tracing, and the relative error is large because the pressures are small.',
    technicalDistortions: [
      {
        id: 'ra-off-level',
        label: 'Transducer off level or unzeroed',
        whatYouSee:
          'The whole tracing sits higher or lower on the axis. Its shape is untouched, so nothing looks amiss.',
        whatItMimics:
          'Volume overload or hypovolemia. The error is a fixed number of mmHg, so it is proportionally largest exactly here, where the pressures are smallest.',
        sourceIds: ['arterial-pressure-five-step-2020', 'clinical-hemodynamics-waveforms'],
      },
      {
        id: 'ra-wall-contact',
        label: 'Wall contact',
        whatYouSee: 'The trace damps toward a flat line and the wave components disappear.',
        whatItMimics:
          'A low-amplitude venous tracing that has simply lost its detail, rather than a tip sitting against a chamber wall.',
        sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
      },
      {
        id: 'ra-valve-contact',
        label: 'Valve contact',
        whatYouSee: 'An extra sharp spike appears on an otherwise venous tracing.',
        whatItMimics:
          'A tall a or c wave, and therefore a stiff ventricle or a rhythm problem the patient does not have.',
        sourceIds: ['clinical-hemodynamics-waveforms'],
      },
      {
        id: 'ra-respiratory-phase',
        label: 'Read away from end expiration',
        whatYouSee:
          'A plausible number, taken at an inspiratory peak or averaged across the whole breath.',
        whatItMimics:
          'A rising filling pressure. Nothing in the circulation changed; the reading moved along the respiratory swing.',
        sourceIds: ['cvp-measurement-2017'],
      },
    ],
    unsafeToInterpret:
      'Do not read it with the transducer off level or unzeroed, when the waves cannot be identified, or at an arbitrary point in the breath.',
    cannotEstablish:
      'It does not predict fluid responsiveness, and it is not a left-sided filling pressure.',
    displayUnit: NORMAL_WAVEFORM_REFERENCE_UNIT,
    evidenceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'cvp-measurement-2017',
      'arterial-pressure-five-step-2020',
    ],
  },
  {
    atlasEntryId: 'rv-normal',
    position: 'rv',
    order: 2,
    physicalLocation:
      'The tip has crossed the tricuspid valve into the right ventricle. This is a transit position, not somewhere the catheter is left.',
    expectedMorphology:
      'A rapid systolic rise to a pressure much higher than the atrium, then a fall toward a low diastolic pressure that may climb gradually as the ventricle fills. No diastolic step-up, no runoff, and no dicrotic notch.',
    ecgRelation:
      'The upstroke follows the QRS complex; relaxation falls after the T wave; end-diastolic pressure is best read at the time of the R wave, at the very end of filling.',
    pressureDirection:
      'Systolic steps up sharply from the atrium and equals pulmonary-artery systolic pressure; end-diastolic stays within a few mmHg of the right atrial mean. Normal systolic 15–30 mmHg, end-diastolic 0–8 mmHg.',
    expectedChangeFromPrevious:
      'From the right atrium, systolic pressure rises sharply while diastolic stays near the atrial mean. Diastole is low and may climb as the ventricle fills. There is no diastolic step-up, no runoff and no dicrotic notch.',
    respiratoryVariation:
      'Systolic and end-diastolic pressure both move with the breath; read at end expiration. The shape of diastole does not change with breathing, so if it does, suspect the tracing.',
    respiratorySwingMmHg: 3,
    technicalDistortion:
      'Ringing exaggerates the systolic peak and hides the diastolic slope; overdamping blunts the upstroke until it resembles a pulmonary-artery tracing. Catheter whip adds spikes that read as a higher systolic pressure.',
    technicalDistortions: [
      {
        id: 'rv-underdamped',
        label: 'Underdamped system, ringing',
        whatYouSee:
          'An exaggerated systolic peak with oscillations after it that run into the diastolic segment.',
        whatItMimics:
          'Pulmonary hypertension, and — worse here — it buries the diastolic contour, which is part of what separates this chamber from the pulmonary artery.',
        sourceIds: ['arterial-pressure-five-step-2020', 'clinical-hemodynamics-waveforms'],
      },
      {
        id: 'rv-overdamped',
        label: 'Overdamped system',
        whatYouSee: 'A rounded upstroke, a blunted peak, and a narrowed pulse pressure.',
        whatItMimics:
          'A pulmonary-artery tracing. The diastolic contour flattens and the notch is lost, so the position can read as further along than it is.',
        sourceIds: ['arterial-pressure-five-step-2020', 'clinical-hemodynamics-waveforms'],
      },
      {
        id: 'rv-catheter-whip',
        label: 'Catheter whip',
        whatYouSee:
          'Narrow spikes added by the motion of the catheter itself, varying from beat to beat.',
        whatItMimics: 'A higher systolic pressure than the ventricle is generating.',
        sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
      },
    ],
    unsafeToInterpret:
      'Systolic pressure alone cannot tell the right ventricle from the pulmonary artery: the two are nearly identical. The diastolic step-up, the runoff and the notch do, and a distorted line loses exactly those.',
    cannotEstablish:
      'A right-ventricular tracing means the tip is still in transit. Do not leave it there.',
    displayUnit: NORMAL_WAVEFORM_REFERENCE_UNIT,
    evidenceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'arterial-pressure-five-step-2020',
    ],
  },
  {
    atlasEntryId: 'pa-normal',
    position: 'pa',
    order: 3,
    physicalLocation:
      'The tip has crossed the pulmonic valve and lies in the pulmonary artery. This is where the catheter rests between measurements.',
    expectedMorphology:
      'Systolic pressure unchanged from the right ventricle, but two things announce the change: a diastolic step-up, and a dicrotic notch on the downstroke marking pulmonic valve closure. Diastole slopes down through runoff rather than up.',
    ecgRelation:
      'The systolic upstroke follows the QRS complex; the dicrotic notch falls at the end of ventricular systole, around the end of the T wave; the diastolic minimum arrives just before the next QRS.',
    pressureDirection:
      'Systolic unchanged from the right ventricle; diastolic clearly higher than right ventricular end-diastolic pressure. The wedge mean normally sits slightly below pulmonary-artery diastolic pressure. Normal systolic 15–30 mmHg, diastolic 4–12 mmHg, mean 9–19 mmHg.',
    expectedChangeFromPrevious:
      'From the right ventricle, systolic pressure does not move, diastolic pressure steps up, the diastolic slope turns downward, and a dicrotic notch appears. If systolic pressure jumped as well, explain it before advancing.',
    respiratoryVariation:
      'The respiratory swing can exceed the pulse pressure on positive-pressure ventilation. Read at end expiration.',
    respiratorySwingMmHg: 5,
    technicalDistortion:
      'A display scale set too high makes a normal pulmonary-artery tracing look flat and damped. Air, blood or a low pressure bag blunts the notch.',
    technicalDistortions: [
      {
        id: 'pa-scale-mismatch',
        label: 'Display scale that does not fit the pressure',
        whatYouSee:
          'A normal tracing drawn small and flat on a wide axis, or clipped flat against the top of a narrow one.',
        whatItMimics:
          'Overdamping. Both make the waveform look featureless, and neither is a property of the signal.',
        sourceIds: ['monitor-workflow-supplied', 'emcrit-rhc-supplied-2026'],
      },
      {
        id: 'pa-blunted-notch',
        label: 'Air, blood, or a low pressure bag',
        whatYouSee: 'The dicrotic notch flattens out and the upstroke rounds off.',
        whatItMimics:
          'A right-ventricular tracing — because the notch is the feature that says the pulmonic valve has been crossed.',
        sourceIds: ['monitor-workflow-supplied', 'arterial-pressure-five-step-2020'],
      },
      {
        id: 'pa-mislabelled-channel',
        label: 'Reading a mislabelled channel',
        whatYouSee:
          'A perfectly valid tracing under a label that names a different pressure. Nothing on it looks amiss.',
        whatItMimics:
          'Whichever chamber the label claims. The shape is real; the attribution is not.',
        sourceIds: ['monitor-workflow-supplied', 'arterial-pressure-five-step-2020'],
      },
    ],
    unsafeToInterpret:
      'If pulsatility and the notch disappear without the balloon up, that is a spontaneous wedge: withdraw until the tracing returns. Pulmonary-artery diastolic pressure does not stand in for left atrial pressure when pulmonary vascular resistance is high.',
    cannotEstablish: 'It is not a left atrial pressure.',
    displayUnit: NORMAL_WAVEFORM_REFERENCE_UNIT,
    evidenceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'pac-derived-part-2-2021',
      'monitor-workflow-supplied',
    ],
  },
  {
    atlasEntryId: 'wedge-normal',
    position: 'wedge',
    order: 4,
    physicalLocation:
      'The tip stays at the same pulmonary-artery depth; the inflated balloon occludes flow so the distal lumen samples left atrial pressure through a static column of blood across the pulmonary bed.',
    expectedMorphology:
      'Amplitude collapses back to a venous, atrial-looking tracing. The c wave usually does not survive transmission through the pulmonary bed, and the v wave is typically larger than the a wave — the reverse of the right atrium. That relationship is a typical normal feature, not a requirement a tracing has to meet.',
    ecgRelation:
      'Everything arrives late. The a wave follows the P wave by roughly 240 ms rather than 80 ms, so it appears after the QRS complex, and the v wave peaks after the T wave. That delay is what distinguishes a wedge tracing from a right atrial one.',
    pressureDirection:
      'Lower than the pulmonary-artery tracing, a little below its diastolic pressure. For left ventricular end-diastolic pressure, read the end-diastolic point just before the c wave; when the c wave cannot be seen, in sinus rhythm average the peak and trough of the a wave. The displayed mean is a different measurement. Normal mean 4–12 mmHg.',
    expectedChangeFromPrevious:
      'From the pulmonary artery, pulsatility and the notch disappear and a lower atrial tracing with late waves replaces them. Depth does not change. A tracing that stays pulsatile is an incomplete occlusion; one that climbs without waves is over-wedged.',
    respiratoryVariation:
      'The respiratory swing is most prominent here, because the pressure is small. Read at end expiration; higher airway pressures raise the displayed value without any change in left atrial filling.',
    respiratorySwingMmHg: 5,
    technicalDistortion:
      'Transmitted airway pressure is the main confounder. An over-wedged catheter gives a tracing that climbs with no a or v waves.',
    technicalDistortions: [
      {
        id: 'wedge-transmitted-airway-pressure',
        label: 'Transmitted airway pressure',
        whatYouSee: 'A larger respiratory swing and a higher displayed pressure at higher PEEP.',
        whatItMimics:
          'Rising left atrial filling pressure. What is measured is the pressure inside the vessel, including whatever surrounds it.',
        sourceIds: ['clinical-hemodynamics-waveforms', 'pac-derived-part-2-2021'],
      },
      {
        id: 'wedge-over-wedged',
        label: 'Over-wedged',
        whatYouSee:
          'A wavering line with no identifiable a or v waves that drifts upward over seconds instead of settling.',
        whatItMimics:
          'A high wedge pressure. What identifies it is the drift together with the loss of interpretable atrial wave components; a value sitting above pulmonary-artery diastolic pressure is a reason to reconcile the two readings rather than a finding that settles the matter on its own.',
        sourceIds: ['clinical-hemodynamics-waveforms', 'pac-review-2014'],
      },
      {
        id: 'wedge-incomplete-occlusion',
        label: 'Incomplete occlusion',
        whatYouSee:
          'Residual pulmonary-artery pulsatility riding on top of an otherwise atrial-looking tracing.',
        whatItMimics:
          'A valid wedge with a falsely raised mean — hard to spot, because a and v waves may still be visible.',
        sourceIds: ['clinical-hemodynamics-waveforms'],
      },
    ],
    unsafeToInterpret:
      'Do not accept a wedge on shape alone. Look for a and v waves and an abrupt return of the pulmonary-artery tracing on deflation. In atrial fibrillation the a wave is absent, which does not invalidate the tracing. A large v wave can raise the displayed mean above pulmonary-artery diastolic pressure in a true wedge.',
    cannotEstablish:
      'A valid wedge also needs a trustworthy line, a reading at end expiration, a tip in zone 3, and the pulmonary-artery tracing back on deflation.',
    displayUnit: NORMAL_WAVEFORM_REFERENCE_UNIT,
    evidenceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-review-2014',
      'edwards-swan-ganz-ifu-2023',
      'cvp-measurement-2017',
    ],
  },
] as const

/**
 * Fails the import rather than the render.
 *
 * An entry pointing at a missing atlas figure, a missing source, or a duplicated chamber is a
 * content defect that would otherwise surface as a blank pane in front of a learner.
 */
function assertNormalWaveformReferenceIsResolvable(): void {
  const positions = new Set<string>()
  for (const [index, entry] of normalWaveformReference.entries()) {
    if (!waveformAtlasById.has(entry.atlasEntryId)) {
      throw new Error(
        `Normal waveform reference points at a missing atlas entry: ${entry.atlasEntryId}`,
      )
    }
    if (positions.has(entry.position)) {
      throw new Error(`Duplicate normal waveform reference position: ${entry.position}`)
    }
    positions.add(entry.position)
    if (entry.order !== index + 1) {
      throw new Error(
        `Normal waveform reference ${entry.position} declares order ${entry.order} at index ${index}`,
      )
    }
    for (const sourceId of [
      ...entry.evidenceIds,
      ...entry.technicalDistortions.flatMap((distortion) => distortion.sourceIds),
    ]) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        throw new Error(
          `Normal waveform reference ${entry.position} cites an unregistered source: ${sourceId}`,
        )
      }
    }
  }
  for (const sourceId of [
    ...NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.sourceIds,
    ...NORMAL_WAVEFORM_RHYTHM_CONTEXT.sourceIds,
  ]) {
    if (!hemodynamicsSourceById.has(sourceId)) {
      throw new Error(
        `Normal waveform respiratory or rhythm context cites an unregistered source: ${sourceId}`,
      )
    }
  }
}

assertNormalWaveformReferenceIsResolvable()

export function normalWaveformReferenceEntry(
  position: NormalWaveformReferenceEntry['position'],
): NormalWaveformReferenceEntry {
  const entry = normalWaveformReference.find((candidate) => candidate.position === position)
  if (!entry) throw new Error(`Missing normal waveform reference for ${position}`)
  return entry
}

/** The atlas entry that supplies the figure, annotations, cues, and pitfall for a reference entry. */
export function normalWaveformAtlasEntry(entry: NormalWaveformReferenceEntry): WaveformAtlasEntry {
  const atlasEntry = waveformAtlasById.get(entry.atlasEntryId)
  if (!atlasEntry) {
    throw new Error(
      `Normal waveform reference points at a missing atlas entry: ${entry.atlasEntryId}`,
    )
  }
  return atlasEntry
}

/**
 * The complete text equivalent of one reference state.
 *
 * Assembled from the authored facets rather than written a second time, so a graphic and its text
 * alternative cannot drift apart — which is the usual way a text equivalent stops being equivalent.
 */
export function normalWaveformReferenceTextEquivalent(
  entry: NormalWaveformReferenceEntry,
  scale: NormalWaveformScaleOption = normalWaveformScaleOption('shared'),
): string {
  const atlasEntry = normalWaveformAtlasEntry(entry)
  // Label wording is deliberately different from the definition list's own terms. Identical labels
  // in both places make every text query in a suite ambiguous, and an ambiguous query is one that
  // gets loosened rather than fixed.
  return [
    `${atlasEntry.label}, state ${entry.order} of ${normalWaveformReference.length} in the insertion sequence.`,
    `Tip location: ${entry.physicalLocation}`,
    `Morphology: ${entry.expectedMorphology}`,
    `ECG timing: ${entry.ecgRelation}`,
    `Pressure relationships: ${entry.pressureDirection}`,
    `Change from the previous state: ${entry.expectedChangeFromPrevious}`,
    `Respiration: ${entry.respiratoryVariation}`,
    `Displayed axis: 0 to ${scale.maxMmHg} ${entry.displayUnit}. ${scale.notice}`,
    `Landmarks drawn on the trace: ${atlasEntry.annotations
      .map((annotation) => `${annotation.label} — ${annotation.description}`)
      .join(' ')}`,
    `Technical distortion: ${entry.technicalDistortion}`,
    `Not safe to interpret when: ${entry.unsafeToInterpret}`,
    `Still not established: ${entry.cannotEstablish}`,
  ].join(' ')
}
