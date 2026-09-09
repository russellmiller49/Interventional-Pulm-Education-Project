import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The spine: the imaging chain, six stops, drawn once in the suite scene and lit one per section.
 *
 * Every term the course uses is introduced at its stop, never as a list. The stop's plain name
 * is what a learner says; the analogy is retrieval glue; the checklist is what the later sections
 * reference; the "you are here" caption is the only place a stop number is printed. Radial EBUS
 * is a second, acoustic chain with the same roles, worded on the stops that change.
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
    title: 'The source',
    plainName: 'the X-ray tube',
    analogy:
      'A torch you cannot turn up by hand. The machine chooses how brightly it burns, and tells you afterwards.',
    precise:
      'The tube sets photon energy and photon quantity over each pulse. Automatic exposure regulation changes them to hold the detector signal, so the dose readout, not the picture, is where you learn what it did.',
    checklistLabel: 'What the source decides',
    checklist: [
      'energy — how penetrating the beam is',
      'quantity — how many photons each pulse carries',
      'pulses — how often it fires',
      'the machine chooses; the readout reports',
    ],
    acoustic: {
      plainName: 'the transducer at the probe tip',
      precise:
        'A rotating crystal sends sound outward and listens for what comes back. No X-rays are involved; the source is inside the airway.',
    },
    sourceIds: ['tg125', 'tg272'],
  },
  {
    id: 'beam',
    number: 2,
    title: 'The beam',
    plainName: 'the cone between the tube and the detector',
    analogy:
      'A lamp casting a shadow. Where it is aimed, how wide it opens and how far away it stands all change the shadow before anything else does.',
    precise:
      'Angle, collimation, filtration and the source–object–detector distances shape the cone. Each detector pixel collects one ray, and everything along that ray lands on the same pixel.',
    checklistLabel: 'What the beam sets',
    checklist: [
      'aim — obliquity and cranial or caudal tilt',
      'width — the collimator blades',
      'distance — source to patient to detector',
      'one ray, one pixel',
    ],
    acoustic: {
      plainName: 'the sound beam',
      precise:
        'A narrow beam swept through a full circle, a few millimetres deep. It shows what is around the probe, not what is ahead of a tool.',
    },
    sourceIds: ['tg272', 'setser'],
  },
  {
    id: 'patient',
    number: 3,
    title: 'The patient',
    plainName: 'the anatomy the beam crosses',
    analogy:
      'A stack of glass slides held up to the light. What overlaps, what moves and when the picture was taken decide what you can make out.',
    precise:
      'Attenuation, superimposition and motion happen here, and the anatomy has a timestamp: inflation, position and collapse can differ from the planning CT. The patient is also where scatter is born.',
    checklistLabel: 'What to ask about the patient',
    checklist: [
      'what overlaps the target on this ray',
      'what is moving, and how fast',
      'when this anatomy was last measured',
      'what glows back — scatter',
    ],
    acoustic: {
      plainName: 'the tissue around the probe',
      precise:
        'Aerated lung scatters sound into snow; solid tissue lets it through and reflects at its edges. Collapsed lung can look like solid tissue.',
    },
    sourceIds: ['setser', 'vespa', 'ilocate'],
  },
  {
    id: 'detector',
    number: 4,
    title: 'The detector',
    plainName: 'the flat panel that measures the image',
    analogy:
      'A camera sensor. It measures a field, at a sampling pitch, so many times per second, and nothing outside the field or between the frames is measured.',
    precise:
      'The panel’s field, pixel sampling and frame rate decide what is measured. The kerma–area product is defined in the beam on its way here; the panel reports what it received.',
    checklistLabel: 'What the detector measured',
    checklist: [
      'field — what the panel saw',
      'sampling — pixels and binning',
      'frame rate — how often',
      'what was measured, not what is displayed',
    ],
    sourceIds: ['tg272', 'aapm12'],
  },
  {
    id: 'reconstruction',
    number: 5,
    title: 'Reconstruction and registration',
    plainName: 'what the computer adds after the measurement',
    analogy:
      'A sculptor working from a few photographs. The fewer the angles and the older the photographs, the more of the sculpture is guesswork.',
    precise:
      'Tomosynthesis sweeps a limited arc and cone-beam CT a wide orbit; both estimate a volume from projections. Registration maps a prior CT or a segmentation onto the current image. Each adds information the measurement did not contain.',
    checklistLabel: 'What to ask about a reconstruction',
    checklist: [
      'how many angles, over how wide an arc',
      'what was assumed, or borrowed from a prior',
      'how old the prior is',
      'what the current projections actually show',
    ],
    sourceIds: ['saad', 'setser', 'pritchett'],
  },
  {
    id: 'display',
    number: 6,
    title: 'Display and decision',
    plainName: 'the monitor and the note you write',
    analogy:
      'The monitor and the note. Zoom, window and overlay change what you see without changing what was measured, and the note is where the evidence is named.',
    precise:
      'Zoom, windowing and overlays are display operations. The decision names what was measured, what was inferred, and what remains uncertain.',
    checklistLabel: 'What the display can and cannot do',
    checklist: [
      'zoom shows existing pixels larger',
      'window changes contrast, not information',
      'an overlay is a projection of a model',
      'the note names measured, inferred and uncertain',
    ],
    acoustic: {
      plainName: 'the radial image',
      precise:
        'A circle around the probe. Tissue all the way round, tissue on one side, or no tissue at all are three different answers, and none of them says where a later tool will go.',
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

/** "You are at: the detector. Stop 4 of 6." — the one place a stop number is printed. */
export function chainCaption(lit: ChainStopId | null): string {
  if (!lit) return 'The chain map is not pointing anywhere on this step.'
  const stop = chainStop(lit)
  return `You are at: ${stop.title.toLowerCase()}. Stop ${stop.number} of ${CHAIN_STOPS.length}.`
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
