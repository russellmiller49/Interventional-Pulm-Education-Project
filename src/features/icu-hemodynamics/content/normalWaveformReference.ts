import { waveformAtlasById, type WaveformAtlasEntry } from './waveformAtlas'

/**
 * The stable normal reference the waveform section establishes *before* any abnormality (H0/H1 §4).
 *
 * The atlas already carried excellent normal entries, but three things were missing for a novice
 * building a first reference: respiratory variation was absent for the right ventricle and the
 * wedge, technical distortion was absent for the right ventricle and pulmonary artery, and no entry
 * said plainly what would make that signal unsafe to interpret.
 *
 * This organizes the seven facets uniformly across the four chambers and fills those gaps. It does
 * not restate the atlas — the figure, the annotations, the recognition cues, and the pitfall all
 * still come from the atlas entry named by `atlasEntryId`. Abnormal entries are untouched: this
 * package establishes the normal reference, it does not rewrite the abnormal atlas.
 *
 * Pressure ranges are quoted from the atlas as commonly reported values with that framing made
 * explicit. None is a treatment target, and this module has no source that supplies one.
 */
export interface NormalWaveformReferenceEntry {
  readonly atlasEntryId: string
  readonly position: 'ra' | 'rv' | 'pa' | 'wedge'
  /** Where the tip physically is when this tracing appears. */
  readonly physicalLocation: string
  readonly expectedMorphology: string
  readonly ecgRelation: string
  /** Direction and relationships, not a target to drive toward. */
  readonly pressureDirection: string
  readonly respiratoryVariation: string
  readonly technicalDistortion: string
  /** What makes this tracing unsafe or impossible to interpret. */
  readonly unsafeToInterpret: string
}

export const NORMAL_WAVEFORM_RANGE_CAVEAT =
  'Ranges below are commonly reported values used here to say which way a pressure should move and how the chambers relate to each other. They are not treatment targets, and no source in this module supplies one.'

export const normalWaveformReference: readonly NormalWaveformReferenceEntry[] = [
  {
    atlasEntryId: 'ra-normal',
    position: 'ra',
    physicalLocation:
      'The distal tip sits in the right atrium, past the introducer and the superior vena cava. The distal PAC channel and the CVP channel report the same pressure here.',
    expectedMorphology:
      'A low-amplitude venous tracing spanning only a few mmHg: three positive waves (a, c, v) and two descents (x, y). The a wave is normally taller than the v wave.',
    ecgRelation:
      'The a wave follows the P wave by roughly 80 ms; the c wave follows the QRS complex; the v wave peaks at the end of the T wave. The y descent belongs to early ventricular diastole.',
    pressureDirection:
      'Lowest of the four tracings, and within a few mmHg of right ventricular end-diastolic pressure — that relationship is more useful than the absolute value. Commonly reported mean 2–6 mmHg.',
    respiratoryVariation:
      'Under controlled positive-pressure ventilation the slow venous envelope rises during inspiration, so end expiration is the trough of that swing. With spontaneous breathing the direction reverses. Freeze the trace, find end expiration, then read at the base of the c wave.',
    technicalDistortion:
      'Wall contact damps the tracing and can flatten the wave components; valve contact adds a misleading spike. An off-level transducer shifts the whole tracing without changing its shape, and the relative error is large because the pressures themselves are small.',
    unsafeToInterpret:
      'Do not interpret it if the transducer is off level or unzeroed, if the wave components cannot be identified at all, or if you are reading at an arbitrary point in the respiratory cycle — an inspiratory peak or a one-beat average can overstate the value substantially.',
  },
  {
    atlasEntryId: 'rv-normal',
    position: 'rv',
    physicalLocation:
      'The tip has crossed the tricuspid valve into the right ventricle. This is a transit position, not somewhere the catheter is left.',
    expectedMorphology:
      'A steep systolic upstroke to a pressure much higher than the atrium, rapid relaxation, and — the identifying feature — a diastole that begins low and slopes upward as the ventricle fills. No dicrotic notch.',
    ecgRelation:
      'The upstroke follows the QRS complex; relaxation falls after the T wave; end-diastolic pressure is best read at the time of the R wave, at the very end of filling.',
    pressureDirection:
      'Systolic pressure steps up sharply from the atrium and is normally equal to pulmonary-artery systolic pressure; end-diastolic pressure stays low, within a few mmHg of the right atrial mean. Commonly reported systolic 15–30 mmHg, end-diastolic 0–8 mmHg.',
    respiratoryVariation:
      'Systolic pressure and end-diastolic pressure both move with the respiratory cycle as intrathoracic pressure changes venous return; read at end expiration for the same reason as every other chamber. The up-sloping diastolic contour itself does not disappear with respiration — if it does, suspect the tracing rather than the physiology.',
    technicalDistortion:
      'An underdamped system exaggerates the systolic peak and can add ringing that obscures the diastolic slope; an overdamped system blunts the upstroke until the contour resembles a pulmonary-artery tracing. Catheter whip from cardiac motion adds spikes that are easy to read as a higher systolic pressure.',
    unsafeToInterpret:
      'Do not interpret systolic pressure alone here: right ventricular and pulmonary-artery systolic pressures are nearly identical, so the number cannot tell you which chamber you are in — only the diastolic contour can. If the dynamic response is distorted, that contour is exactly what is lost, and the position is then unconfirmed.',
  },
  {
    atlasEntryId: 'pa-normal',
    position: 'pa',
    physicalLocation:
      'The tip has crossed the pulmonic valve and lies in the pulmonary artery. This is where the catheter rests between measurements.',
    expectedMorphology:
      'Systolic pressure unchanged from the right ventricle, but two things announce the change: a diastolic step-up, and a dicrotic notch on the downstroke marking pulmonic valve closure. Diastole slopes down through runoff rather than up.',
    ecgRelation:
      'The systolic upstroke follows the QRS complex; the dicrotic notch falls at the end of ventricular systole, around the end of the T wave; the diastolic minimum arrives just before the next QRS.',
    pressureDirection:
      'Systolic unchanged from the right ventricle; diastolic clearly higher than right ventricular end-diastolic pressure — that step-up is the transition. Mean wedge pressure normally sits slightly below pulmonary-artery diastolic pressure. Commonly reported systolic 15–30 mmHg, diastolic 4–12 mmHg, mean 9–19 mmHg.',
    respiratoryVariation:
      'A marked respiratory swing is common and can be larger than the pulse pressure itself under positive-pressure ventilation. Read at end expiration; comparing values sampled at different points in the breath will produce differences that have nothing to do with the circulation.',
    technicalDistortion:
      'A mismatched display scale is the classic problem here — a high scale makes a normal pulmonary-artery signal look small and flat, inviting a damping diagnosis from appearance alone. Air, blood, or a low pressure bag blunts the notch, which is the feature the transition depends on.',
    unsafeToInterpret:
      'Do not interpret it if pulsatility and the notch have disappeared without you inflating the balloon — that is a spontaneous wedge, not a pulmonary-artery tracing, and it needs attention rather than interpretation. Using pulmonary-artery diastolic pressure to stand in for left atrial pressure is unreliable whenever pulmonary vascular resistance is abnormal.',
  },
  {
    atlasEntryId: 'wedge-normal',
    position: 'wedge',
    physicalLocation:
      'The tip stays at the same pulmonary-artery depth; the inflated balloon occludes flow so the distal lumen samples left atrial pressure through a static column of blood across the pulmonary bed.',
    expectedMorphology:
      'Amplitude collapses back to a venous, atrial-looking tracing. No c wave — it does not survive transmission through the pulmonary bed — and the v wave normally exceeds the a wave, the reverse of the right atrium.',
    ecgRelation:
      'Everything arrives late. The a wave follows the P wave by roughly 240 ms rather than 80 ms, so it appears after the QRS complex, and the v wave peaks after the T wave. That delay is what distinguishes a wedge tracing from a right atrial one.',
    pressureDirection:
      'Lower than the pulmonary-artery tracing it replaced, normally sitting a little below pulmonary-artery diastolic pressure. The peak of the a wave is the best single estimate of left ventricular end-diastolic pressure. Commonly reported mean 4–12 mmHg.',
    respiratoryVariation:
      'Respiratory swing is often more prominent here than anywhere else, because the pressure is small and the surrounding pressure is transmitted directly to it. Read at end expiration, and expect the swing to grow with higher airway pressures — which changes the displayed pressure without changing left atrial filling.',
    technicalDistortion:
      'Transmitted airway pressure is the dominant confounder, not a monitoring artifact: what is measured is the pressure inside the vessel, including whatever surrounds it. An over-wedged catheter produces a tracing that drifts upward with no identifiable a or v waves.',
    unsafeToInterpret:
      'Do not accept it as a wedge unless the a and v waves are well defined and pulmonary-artery pressure and morphology return abruptly on deflation. A tracing that drifts upward without identifiable waves, or that reads higher than pulmonary-artery diastolic pressure, is not a valid wedge — that combination is physiologically impossible and is a warning sign, not a measurement.',
  },
] as const

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
