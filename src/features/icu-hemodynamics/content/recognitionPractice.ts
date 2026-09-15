import { unidentifiedTraceDescription } from './introductoryTeaching'
import {
  normalWaveformValidityChallenges,
  type NormalWaveformValidityChallenge,
} from './normalWaveformValidityChallenges'
import { waveformAtlasById, type WaveformAtlasEntry } from './waveformAtlas'

/**
 * Recognition practice for the waveform-interpretation section: tracings a learner names, compares
 * and revisits at will.
 *
 * HD-02 replaced a question drill — one unlabelled tracing at a time, the four normal places repeated
 * to fill six turns — with learner-chosen practice. Each example states the reading it supports (a
 * place, or that the display cannot name one), the tracing it is most easily confused with, and the
 * feature that separates the two. Every tracing is drawn by the module's waveform model and none is a
 * patient recording: a model variant changes one parameter of an atlas entry and says so, and a
 * display fault reuses the authored validity challenge whose distortion it draws.
 */

export type RecognitionPlace = 'ra-normal' | 'rv-normal' | 'pa-normal' | 'wedge-normal'
export type RecognitionReading = RecognitionPlace | 'cannot-name'
export type RecognitionOrigin = 'reference' | 'model-variant' | 'display-fault'

export interface RecognitionReadingOption {
  readonly id: RecognitionReading
  /** The option label in a try. For a place, the atlas entry's own label. */
  readonly label: string
  /** The reading inside a sentence: "this is {sentence}". */
  readonly sentence: string
}

export interface RecognitionPracticeExample {
  readonly id: string
  /** What the tracing supports: its place, or that this display cannot name one. */
  readonly reading: RecognitionReading
  /** What is drawn. A model variant is a modified copy of an atlas entry, never a new recording. */
  readonly entry: WaveformAtlasEntry
  readonly origin: RecognitionOrigin
  /** What this tracing is, shown with its labels. */
  readonly originNote: string
  /** Text equivalent while the labels are hidden. Names no reading. */
  readonly unlabelledDescription: string
  /** Where to look, without naming a reading. */
  readonly hint: string
  /** The example it is most easily confused with, drawn on the same axis. */
  readonly compareWithId: string
  /** The feature that separates the two. */
  readonly contrast: string
  /** A display-fault example draws, and explains itself with, this authored validity challenge. */
  readonly displayFault?: NormalWaveformValidityChallenge
}

function atlasEntry(id: string): WaveformAtlasEntry {
  const entry = waveformAtlasById.get(id)
  if (!entry) throw new Error(`Recognition practice needs the atlas entry ${id}.`)
  return entry
}

const rightAtrium = atlasEntry('ra-normal')
const rightVentricle = atlasEntry('rv-normal')
const pulmonaryArtery = atlasEntry('pa-normal')
const wedge = atlasEntry('wedge-normal')

export const recognitionReadings: readonly RecognitionReadingOption[] = [
  { id: 'ra-normal', label: rightAtrium.label, sentence: 'the right atrium (CVP)' },
  { id: 'rv-normal', label: rightVentricle.label, sentence: 'the right ventricle' },
  { id: 'pa-normal', label: pulmonaryArtery.label, sentence: 'the pulmonary artery' },
  { id: 'wedge-normal', label: wedge.label, sentence: 'the pulmonary capillary wedge' },
  {
    id: 'cannot-name',
    label: 'Cannot be named from this display',
    sentence: 'a display that cannot name a place',
  },
]

export const recognitionReadingById: ReadonlyMap<RecognitionReading, RecognitionReadingOption> =
  new Map(recognitionReadings.map((reading) => [reading.id, reading]))

function referenceNote(tracing: string): string {
  return `Reference model tracing: the normal ${tracing} drawn by this module’s waveform model at one heart rate and rhythm. It is not a patient recording.`
}

const VENTRICLE_ARTERY_HINT =
  'Similar systolic peaks do not name the place. Look at diastole: where the pressure sits between beats, which way it slopes, and whether a notch interrupts the downstroke.'
const ATRIAL_HINT =
  'Time each small peak against the ECG. Is there a peak just after the P wave, before the QRS, and another just after the QRS? Or do the peaks arrive later, the first one only after the QRS?'
const DISPLAY_HINT =
  'Before naming any place, ask whether this display can be read: are the upstroke, the peak and any notch sharp enough to use?'

const VENTRICLE_ARTERY_CONTRAST =
  'The systolic peaks are alike, so the peak cannot separate these two. Diastole does: the right ventricle falls to a low pressure that may rise gradually through filling, with no notch; the pulmonary artery holds a higher diastolic pressure, shows a valve-closure notch on the downstroke, and runs off downward through diastole.'
const ATRIUM_WEDGE_TIMING =
  'Timing against the ECG separates them: the right-atrial a wave follows the P wave and a c wave follows the QRS, while the wedge waves arrive later — its a wave after the QRS, with no c wave, and typically a v wave larger than the a wave.'
const ATRIUM_WEDGE_CONTRAST = `Both are low-amplitude atrial shapes. ${ATRIUM_WEDGE_TIMING}`
const LEVEL_MATCHED_CONTRAST = `Both are low-amplitude atrial shapes at the same mean pressure, so the number cannot separate them. ${ATRIUM_WEDGE_TIMING}`

if (rightAtrium.trace.kind !== 'atrial' || wedge.trace.kind !== 'atrial') {
  throw new Error('Recognition practice expects atrial traces for the right atrium and the wedge.')
}
const wedgeMeanMmHg = wedge.trace.meanMmHg

/**
 * Model variant: the reference right atrium at the wedge example's mean. Only `meanMmHg` changes, so
 * every wave, descent and landmark keeps the reference right atrium's timing and amplitude.
 */
const RIGHT_ATRIUM_AT_WEDGE_MEAN: WaveformAtlasEntry = {
  ...rightAtrium,
  id: 'ra-normal-level-matched',
  label: `${rightAtrium.label} · model variant`,
  shortLabel: 'RA variant',
  normalRange: null,
  insertionDepth: null,
  trace: { ...rightAtrium.trace, meanMmHg: wedgeMeanMmHg },
}

const overdamped = normalWaveformValidityChallenges.find(
  (challenge) => challenge.id === 'validity-overdamped',
)
if (!overdamped || overdamped.position !== 'pa') {
  throw new Error('Recognition practice reuses the overdamped pulmonary-artery validity challenge.')
}

/**
 * Display fault: the reference pulmonary artery, which the practice draws through the challenge's
 * overdamping. It carries no landmarks, because a damped display is exactly the one whose landmarks
 * cannot be trusted to name a place.
 */
const OVERDAMPED_DISPLAY: WaveformAtlasEntry = {
  ...pulmonaryArtery,
  id: 'pa-normal-overdamped-display',
  label: 'Overdamped display',
  shortLabel: 'Overdamped',
  normalRange: null,
  insertionDepth: null,
  summary: overdamped.whatYouSee,
  annotations: [],
  recognitionCues: [],
  pitfall: null,
}

/** Suggested order: the pairs the section teaches, then the level-matched variant and the fault. */
export const recognitionPracticeExamples: readonly RecognitionPracticeExample[] = [
  {
    id: 'rv',
    reading: 'rv-normal',
    entry: rightVentricle,
    origin: 'reference',
    originNote: referenceNote('right-ventricular tracing'),
    unlabelledDescription: unidentifiedTraceDescription(rightVentricle),
    hint: VENTRICLE_ARTERY_HINT,
    compareWithId: 'pa',
    contrast: VENTRICLE_ARTERY_CONTRAST,
  },
  {
    id: 'pa',
    reading: 'pa-normal',
    entry: pulmonaryArtery,
    origin: 'reference',
    originNote: referenceNote('pulmonary-artery tracing'),
    unlabelledDescription: unidentifiedTraceDescription(pulmonaryArtery),
    hint: VENTRICLE_ARTERY_HINT,
    compareWithId: 'rv',
    contrast: VENTRICLE_ARTERY_CONTRAST,
  },
  {
    id: 'wedge',
    reading: 'wedge-normal',
    entry: wedge,
    origin: 'reference',
    originNote: referenceNote('wedge tracing'),
    unlabelledDescription: unidentifiedTraceDescription(wedge),
    hint: ATRIAL_HINT,
    compareWithId: 'ra-level-matched',
    contrast: LEVEL_MATCHED_CONTRAST,
  },
  {
    id: 'ra',
    reading: 'ra-normal',
    entry: rightAtrium,
    origin: 'reference',
    originNote: referenceNote('right-atrial tracing'),
    unlabelledDescription: unidentifiedTraceDescription(rightAtrium),
    hint: ATRIAL_HINT,
    compareWithId: 'wedge',
    contrast: ATRIUM_WEDGE_CONTRAST,
  },
  {
    id: 'ra-level-matched',
    reading: 'ra-normal',
    entry: RIGHT_ATRIUM_AT_WEDGE_MEAN,
    origin: 'model-variant',
    originNote: `Model variant: the reference right-atrial model tracing moved up to a mean of ${wedgeMeanMmHg} mmHg, the mean of the wedge example, so the number cannot separate the two. Only the level changed; the waves and their timing are the reference right atrium’s. A mean of ${wedgeMeanMmHg} mmHg is above the normal right-atrial range. It is not a patient recording.`,
    unlabelledDescription: unidentifiedTraceDescription(rightAtrium),
    hint: ATRIAL_HINT,
    compareWithId: 'wedge',
    contrast: LEVEL_MATCHED_CONTRAST,
  },
  {
    id: 'pa-overdamped',
    reading: 'cannot-name',
    entry: OVERDAMPED_DISPLAY,
    origin: 'display-fault',
    originNote: `Display fault: the reference pulmonary-artery model tracing drawn through the overdamped line of the display problem “${overdamped.label}”, without its respiratory swing, so the damping is the only difference from the clean tracing it is compared with. It is not a patient recording.`,
    unlabelledDescription:
      'Pressure trace and synchronized ECG. The upstroke is rounded, the peak is blunted, the pulse pressure is narrow, and a notch on the downstroke can barely be made out.',
    hint: DISPLAY_HINT,
    compareWithId: 'pa',
    contrast: `${overdamped.whatYouSee} ${overdamped.whyInterpretationIsWithheld}`,
    displayFault: overdamped,
  },
]

export const recognitionPracticeExampleById: ReadonlyMap<string, RecognitionPracticeExample> =
  new Map(recognitionPracticeExamples.map((example) => [example.id, example]))

/** Words that would name a reading in text a learner reads before the labels are shown. */
const READING_NAME_PATTERNS: readonly RegExp[] = [
  /right.atri/i,
  /\bCVP\b/,
  /ventric/i,
  /pulmonary.artery/i,
  /\bwedge\b/i,
  /occlu/i,
  /damp/i,
  /cannot be named/i,
]

export function validateRecognitionPractice(): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const example of recognitionPracticeExamples) {
    const where = `Recognition example ${example.id}`
    if (seen.has(example.id)) errors.push(`${where} is duplicated.`)
    seen.add(example.id)
    const partner = recognitionPracticeExampleById.get(example.compareWithId)
    if (!partner) {
      errors.push(`${where} compares with a missing example ${example.compareWithId}.`)
    } else {
      if (partner.reading === example.reading) {
        errors.push(`${where} compares two tracings that support the same reading.`)
      }
      if (partner.entry.scaleMaxMmHg !== example.entry.scaleMaxMmHg) {
        errors.push(`${where} is compared on a different axis.`)
      }
    }
    for (const [field, text] of [
      ['hint', example.hint],
      ['unlabelled description', example.unlabelledDescription],
    ] as const) {
      for (const pattern of READING_NAME_PATTERNS) {
        if (pattern.test(text))
          errors.push(`${where} ${field} names a reading (${pattern.source}).`)
      }
    }
    if ((example.origin === 'display-fault') !== (example.displayFault !== undefined)) {
      errors.push(`${where} must draw a display fault exactly when its origin is a display fault.`)
    }
    if (example.origin === 'display-fault' && example.reading !== 'cannot-name') {
      errors.push(`${where} draws a display fault but names a place.`)
    }
    const originLead = {
      reference: 'Reference model tracing:',
      'model-variant': 'Model variant:',
      'display-fault': 'Display fault:',
    }[example.origin]
    if (!example.originNote.startsWith(originLead)) {
      errors.push(`${where} does not open its origin note with "${originLead}".`)
    }
    if (!example.originNote.includes('It is not a patient recording.')) {
      errors.push(`${where} does not say it is not a patient recording.`)
    }
  }
  for (const reading of recognitionReadings) {
    if (!recognitionPracticeExamples.some((example) => example.reading === reading.id)) {
      errors.push(`No recognition example supports ${reading.id}.`)
    }
  }
  return errors
}

const recognitionPracticeErrors = validateRecognitionPractice()
if (recognitionPracticeErrors.length > 0) {
  throw new Error(`Recognition practice is invalid:\n${recognitionPracticeErrors.join('\n')}`)
}
