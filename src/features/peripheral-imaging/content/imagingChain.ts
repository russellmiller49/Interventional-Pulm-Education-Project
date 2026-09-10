import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The physics layer: how a fluoroscopic image is formed, in six components drawn once in the suite
 * scene and highlighted per section.
 *
 * This is the explanatory layer beneath the clinical sequence (plan, localize, optimize, confirm,
 * sample, reconfirm), not the vocabulary a learner is asked to use at the table. Each component is
 * named in the terms clinicians and technologists use; the precise statement comes first, and the
 * analogy is a secondary aid, never the name of the concept. The caption is the only place a
 * component number is printed. Radial EBUS forms its image acoustically, with the same roles
 * worded on the components that change.
 */
export const chainStopIds = [
  'source',
  'beam',
  'patient',
  'detector',
  'reconstruction',
  'display',
] as const

export type ChainStopId = (typeof chainStopIds)[number]

export function isChainStopId(value: unknown): value is ChainStopId {
  return typeof value === 'string' && (chainStopIds as readonly string[]).includes(value)
}

export interface ChainStop {
  readonly id: ChainStopId
  readonly number: 1 | 2 | 3 | 4 | 5 | 6
  /** The title on the pin and in the caption: "The detector". */
  readonly title: string
  /** What a learner says it is: "the flat panel that measures the image". */
  readonly plainName: string
  readonly analogy: string
  readonly precise: string
  /** Authored per list, because a checklist and a set of facts read differently. */
  readonly checklistLabel: string
  readonly checklist: readonly string[]
  /** The same role on the acoustic chain, where radial EBUS changes the wording. */
  readonly acoustic?: { readonly plainName: string; readonly precise: string }
  readonly sourceIds: readonly SourceId[]
}

export const CHAIN_STOPS: readonly ChainStop[] = Object.freeze([
  {
    id: 'source',
    number: 1,
    title: 'X-ray tube',
    plainName: 'the X-ray tube and generator',
    analogy:
      'Think of a light on automatic brightness: the picture stays even while the output behind it changes.',
    precise:
      'The tube and generator set beam energy (kV) and photon output (mA and pulse duration) for each pulse. Automatic exposure regulation adjusts them to hold the detector signal, so image brightness does not report radiation output; the dose-rate and cumulative dose readouts do.',
    checklistLabel: 'What the tube and generator set',
    checklist: [
      'kV — beam energy and penetration',
      'mA and pulse width — photon output per pulse',
      'pulse rate — how often a new image is acquired',
      'automatic exposure regulation chooses; the dose readout reports',
    ],
    acoustic: {
      plainName: 'the radial EBUS transducer at the probe tip',
      precise:
        'A rotating ultrasound transducer emits sound and receives the returning echoes. No ionizing radiation is involved, and the source sits inside the airway.',
    },
    sourceIds: ['tg125', 'tg272'],
  },
  {
    id: 'beam',
    number: 2,
    title: 'Beam geometry',
    plainName: 'the collimated X-ray beam between the tube and the detector',
    analogy:
      'Think of a lamp casting a shadow: the angle, the opening and the distances change the shadow before anything else does.',
    precise:
      'The C-arm projection (obliquity and cranial or caudal angulation), collimation, filtration and the source–object–detector distances shape the beam. A single projection collapses everything along each X-ray path onto one detector location, so structures at different depths superimpose.',
    checklistLabel: 'What beam geometry sets',
    checklist: [
      'projection — C-arm obliquity and cranial or caudal angulation',
      'collimation — the irradiated field',
      'geometry — source-to-patient and patient-to-detector distance',
      'a single projection collapses depth',
    ],
    acoustic: {
      plainName: 'the ultrasound beam',
      precise:
        'A narrow ultrasound beam rotated through a full circle around the probe. It shows what surrounds the probe tip, not the path a later biopsy tool will take.',
    },
    sourceIds: ['tg272', 'setser'],
  },
  {
    id: 'patient',
    number: 3,
    title: 'Patient anatomy',
    plainName: 'the anatomy in the X-ray path',
    analogy:
      'Think of glass slides stacked against a light: what overlaps, what moves and when the picture was taken decide what you can make out.',
    precise:
      'Attenuation, superimposition and motion happen here. The intraprocedural lung may differ from the planning CT in lung volume, position, atelectasis and deformation — CT-to-body divergence. The patient is also the principal source of scatter radiation.',
    checklistLabel: 'What to ask about the patient',
    checklist: [
      'what is superimposed on the lesion in this projection',
      'respiratory and cardiac motion',
      'CT-to-body divergence since the planning CT',
      'scatter radiation — it originates in the patient',
    ],
    acoustic: {
      plainName: 'the tissue around the probe',
      precise:
        'Aerated lung scatters ultrasound into a bright, snowstorm-like pattern; solid tissue transmits it and reflects at its margins. Atelectatic lung can mimic a solid lesion.',
    },
    sourceIds: ['setser', 'vespa', 'ilocate'],
  },
  {
    id: 'detector',
    number: 4,
    title: 'Flat-panel detector',
    plainName: 'the flat-panel detector',
    analogy:
      'Think of a camera sensor: it records one field, at one sampling pitch, a set number of times per second, and nothing outside the field or between frames.',
    precise:
      'The detector field of view, pixel sampling (including binning) and acquisition rate decide what is recorded. The kerma–area product is defined in the beam on its way here; the panel records what it receives.',
    checklistLabel: 'What the detector records',
    checklist: [
      'field of view — what the panel sees',
      'sampling — pixel size and binning',
      'acquisition rate — how often a new frame is recorded',
      'what was acquired, not what is displayed',
    ],
    sourceIds: ['tg272', 'aapm12'],
  },
  {
    id: 'reconstruction',
    number: 5,
    title: 'Reconstruction and registration',
    plainName: 'DTS or CBCT reconstruction, and registration of prior imaging',
    analogy:
      'Think of a sculptor working from a few photographs: the fewer the angles and the older the photographs, the more of the result is inferred.',
    precise:
      'Digital tomosynthesis reconstructs planes from a limited-angle acquisition; CBCT reconstructs a volume from a rotational acquisition. Registration aligns a planning CT or a segmentation with the current image. Each can add content the current projections did not directly acquire.',
    checklistLabel: 'What to ask about a reconstruction',
    checklist: [
      'the acquisition arc and the number of projections',
      'what a prior CT or a model contributed',
      'when the prior was acquired',
      'what the current projections actually show',
    ],
    sourceIds: ['saad', 'setser', 'pritchett'],
  },
  {
    id: 'display',
    number: 6,
    title: 'Display and interpretation',
    plainName: 'the monitor and the procedure record',
    analogy:
      'Think of enlarging a photograph: zoom, window and overlay change what you see, not what was acquired.',
    precise:
      'Display zoom, window/level and overlays are display operations. Interpretation, and the procedure note, should state what was directly visualized, what was inferred, and what remains uncertain.',
    checklistLabel: 'What the display can and cannot do',
    checklist: [
      'display zoom enlarges acquired pixels',
      'window/level changes contrast, not acquired information',
      'an overlay is a registered projection of an earlier acquisition',
      'document what was visualized and what was inferred',
    ],
    acoustic: {
      plainName: 'the radial EBUS image',
      precise:
        'A 360-degree image around the probe: a concentric view, with lesion surrounding the probe; an eccentric view, with lesion to one side; or no lesional pattern. None of them establishes where a later biopsy tool will go.',
    },
    sourceIds: ['tg272', 'wabip'],
  },
])

const stopById = new Map(CHAIN_STOPS.map((stop) => [stop.id, stop] as const))

export function chainStop(id: ChainStopId): ChainStop {
  const stop = stopById.get(id)
  if (!stop) throw new Error(`Unknown chain stop ${id}`)
  return stop
}

export function chainStopNumber(id: ChainStopId): number {
  return chainStop(id).number
}

/** "Image formation · Flat-panel detector (4 of 6)." — the one place a component number is printed. */
export function chainCaption(lit: ChainStopId | null): string {
  if (!lit) return 'Image formation: no component is highlighted on this step.'
  const stop = chainStop(lit)
  return `Image formation · ${stop.title} (${stop.number} of ${CHAIN_STOPS.length}).`
}

export function validateImagingChain(): readonly string[] {
  const errors: string[] = []
  if (CHAIN_STOPS.map((stop) => stop.id).join('|') !== chainStopIds.join('|')) {
    errors.push('The chain stops are not one per id, in order.')
  }
  CHAIN_STOPS.forEach((stop, index) => {
    const where = `Chain stop ${stop.id}`
    if (stop.number !== index + 1) errors.push(`${where} is numbered ${stop.number}.`)
    errors.push(
      ...imagingLearnerCopyErrors(`${where} title`, stop.title, { allowDigits: false }),
      ...imagingLearnerCopyErrors(`${where} plain name`, stop.plainName),
      ...imagingLearnerCopyErrors(`${where} analogy`, stop.analogy),
      ...imagingLearnerCopyErrors(`${where} precise statement`, stop.precise),
      ...imagingLearnerCopyErrors(`${where} checklist label`, stop.checklistLabel),
    )
    if (stop.checklist.length === 0 || stop.checklist.length > 4) {
      errors.push(`${where} checklist must hold one to four items.`)
    }
    for (const item of stop.checklist) {
      errors.push(...imagingLearnerCopyErrors(`${where} checklist item`, item))
    }
    if (stop.acoustic) {
      errors.push(
        ...imagingLearnerCopyErrors(`${where} acoustic name`, stop.acoustic.plainName),
        ...imagingLearnerCopyErrors(`${where} acoustic statement`, stop.acoustic.precise),
      )
    }
    if (stop.sourceIds.length === 0) errors.push(`${where} cites nothing.`)
  })
  return errors
}

const chainErrors = validateImagingChain()
if (chainErrors.length > 0) {
  throw new Error(`The imaging chain is invalid:\n${chainErrors.join('\n')}`)
}
