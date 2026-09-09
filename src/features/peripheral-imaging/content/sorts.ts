import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { chainStop, isChainStopId } from './imagingChain'
import { imagingLearnerCopyErrors } from './learnerCopy'
import type { ImagingSectionId } from './pathway'

/**
 * Attribution sorts: the Act step of the sections that have no lab to act on.
 *
 * Each sort is a set of statements the learner places into a small set of origins — the four
 * imaging questions, the five things you can change, the three uses of a reconstruction, the
 * thing to change first, the stop of the chain a problem lives at — committed as a set and graded
 * row by row in words. Every origin must be the answer to something (a decoy origin is a trick),
 * and every string passes the copy gate at import.
 */
export interface SortOrigin {
  readonly id: string
  readonly label: string
  readonly definition: string
}

export interface SortRow {
  readonly id: string
  readonly statement: string
  readonly origin: string
  readonly rationale: string
}

export interface ImagingSort {
  readonly id: string
  readonly sectionId: ImagingSectionId
  readonly prompt: string
  /** When true the origins are chain stops and the suite may light the chosen one after commit. */
  readonly originsAreChainStops: boolean
  readonly origins: readonly SortOrigin[]
  readonly rows: readonly SortRow[]
  readonly sourceIds: readonly SourceId[]
}

function chainOrigins(
  ids: readonly ('source' | 'beam' | 'patient' | 'detector' | 'reconstruction' | 'display')[],
): readonly SortOrigin[] {
  return ids.map((id) => {
    const stop = chainStop(id)
    return { id, label: stop.title, definition: stop.plainName }
  })
}

export const IMAGING_SORTS: readonly ImagingSort[] = Object.freeze([
  {
    id: 'four-questions',
    sectionId: 'imaging-questions',
    prompt:
      'Six things a display in the suite can show. For each one, say which of the four questions it answers: where the tracked catheter is on the map, where the lesion is now, where the actual sampling component is relative to it, or whether the specimen answered the clinical question.',
    originsAreChainStops: false,
    origins: [
      {
        id: 'navigation',
        label: 'Navigation',
        definition: 'Where the tracked catheter is relative to the map.',
      },
      {
        id: 'localization',
        label: 'Localization',
        definition: 'Where the intended lesion is now.',
      },
      {
        id: 'confirmation',
        label: 'Confirmation',
        definition: 'Where the actual sampling component is relative to the lesion.',
      },
      {
        id: 'diagnosis',
        label: 'Diagnosis',
        definition: 'Whether the specimen answered the clinical question.',
      },
    ],
    rows: [
      {
        id: 'icon-on-target',
        statement: 'The navigation screen shows the catheter icon on the virtual target.',
        origin: 'navigation',
        rationale:
          'The display places tracked hardware on a map. It says nothing about the lesion today.',
      },
      {
        id: 'tissue-all-round',
        statement: 'A radial ultrasound image shows tissue all round the probe.',
        origin: 'localization',
        rationale:
          'The probe measures the tissue around itself: a finding about what is there, not about the tool that comes next.',
      },
      {
        id: 'window-in-solid-part',
        statement:
          'Thin reformats show the needle’s side window inside the solid part of the nodule.',
        origin: 'confirmation',
        rationale:
          'The actual sampling component is placed relative to the target in three planes. That is what confirmation means.',
      },
      {
        id: 'adequate-cells',
        statement: 'The pathologist reports adequate malignant cells.',
        origin: 'diagnosis',
        rationale: 'Only the specimen answers the clinical question. Geometry never did.',
      },
      {
        id: 'contour-moved',
        statement: 'A limited sweep moves the target contour on the map by several millimetres.',
        origin: 'localization',
        rationale:
          'A reconstruction that moves the target updates where the lesion is now. It does not show the sampling tool.',
      },
      {
        id: 'rose-nondiagnostic',
        statement:
          'The specimen came from the tissue the ultrasound showed, and rapid on-site evaluation was nondiagnostic.',
        origin: 'diagnosis',
        rationale:
          'A specimen that does not answer the question is a diagnosis finding, whatever the images said about position.',
      },
    ],
    sourceIds: ['setser', 'confirm', 'ilocate'],
  },
  {
    id: 'five-things',
    sectionId: 'good-image',
    prompt:
      'Nine controls and readouts from a C-arm console. For each one, say which of the five things it changes — the aim, the width, the time sampling, the acquisition or the display — or that it is monitoring, because it changes nothing about the beam.',
    originsAreChainStops: false,
    origins: [
      {
        id: 'angle',
        label: 'The aim',
        definition: 'Where the beam is aimed: obliquity and cranial or caudal tilt.',
      },
      { id: 'field', label: 'The width', definition: 'How wide the beam is: the collimator.' },
      {
        id: 'time',
        label: 'The time sampling',
        definition: 'Pulses per second and how long each lasts.',
      },
      {
        id: 'acquisition',
        label: 'The acquisition',
        definition: 'A single image, a limited sweep or a full orbit.',
      },
      { id: 'display', label: 'The display', definition: 'Zoom, window and level, an overlay.' },
      {
        id: 'monitoring',
        label: 'Monitoring',
        definition: 'Set by the machine or accumulated by it; read, not turned.',
      },
    ],
    rows: [
      {
        id: 'obliquity',
        statement: 'The obliquity control.',
        origin: 'angle',
        rationale: 'It turns the C-arm about the patient and changes which ray crosses the target.',
      },
      {
        id: 'blades',
        statement: 'The collimator blades.',
        origin: 'field',
        rationale: 'They close the beam; less tissue is irradiated and less scatter is made.',
      },
      {
        id: 'pulse-rate',
        statement: 'The pulse rate selector.',
        origin: 'time',
        rationale: 'It sets how often a new measurement arrives.',
      },
      {
        id: 'spin-button',
        statement: 'The rotational acquisition button.',
        origin: 'acquisition',
        rationale: 'It asks for an orbit of projections instead of a single image.',
      },
      {
        id: 'window-level',
        statement: 'The window and level control.',
        origin: 'display',
        rationale: 'It maps the same measured values to different greys.',
      },
      {
        id: 'kilovoltage',
        statement: 'The kilovoltage shown on the console.',
        origin: 'monitoring',
        rationale: 'Automatic exposure regulation chooses it. You read it; you do not set it.',
      },
      {
        id: 'stored-zoom',
        statement: 'The zoom on a stored image.',
        origin: 'display',
        rationale: 'It enlarges existing pixels and adds no exposure.',
      },
      {
        id: 'tilt',
        statement: 'The cranial and caudal tilt.',
        origin: 'angle',
        rationale: 'The second axis of aim; it changes overlap along the length of the chest.',
      },
      {
        id: 'kap-readout',
        statement: 'The kerma–area product readout.',
        origin: 'monitoring',
        rationale:
          'It accumulates what the machine delivered. It is where output is judged, not a knob.',
      },
    ],
    sourceIds: ['tg272', 'tg125', 'wabip'],
  },
  {
    id: 'three-uses',
    sectionId: 'dts-interpretation',
    prompt:
      'Six things that can happen after a limited sweep. For each, say which use of reconstruction it is: a correction of the navigation map, a local tomographic image, or an augmented overlay on live fluoroscopy.',
    originsAreChainStops: false,
    origins: [
      {
        id: 'correction',
        label: 'Map correction',
        definition: 'The navigation target moves to where the reconstruction found it.',
      },
      {
        id: 'tomography',
        label: 'Local tomography',
        definition: 'Reconstructed planes through the target and tool are shown.',
      },
      {
        id: 'overlay',
        label: 'Augmented overlay',
        definition: 'A segmentation is projected onto live fluoroscopy and follows the C-arm.',
      },
    ],
    rows: [
      {
        id: 'target-jumps',
        statement: 'The virtual target jumps to a new position after the sweep.',
        origin: 'correction',
        rationale: 'The map has been corrected; nothing has been shown about the tool.',
      },
      {
        id: 'three-planes',
        statement:
          'Axial, coronal and sagittal planes through the needle appear on a second monitor.',
        origin: 'tomography',
        rationale: 'That is a reconstructed volume being read in planes.',
      },
      {
        id: 'outline-follows',
        statement:
          'A coloured outline of the nodule follows the live fluoroscopy as the C-arm moves.',
        origin: 'overlay',
        rationale: 'A segmentation projected onto a current image, registered to the gantry.',
      },
      {
        id: 'catheter-redirected',
        statement: 'The catheter is redirected because the map now shows the lesion elsewhere.',
        origin: 'correction',
        rationale:
          'Guidance changed because the map changed, not because the tool was seen in the lesion.',
      },
      {
        id: 'outline-stays',
        statement: 'The outline stays where it was while the lung has collapsed underneath it.',
        origin: 'overlay',
        rationale:
          'An overlay carries the age of its source. The live image changed; the drawing did not.',
      },
      {
        id: 'elongated-slab',
        statement:
          'A slab through the reconstructed volume shows the needle and nodule elongated in depth.',
        origin: 'tomography',
        rationale:
          'The limited arc measured depth unevenly; the reconstruction shows that anisotropy.',
      },
    ],
    sourceIds: ['saad', 'frontier', 'pritchett'],
  },
  {
    id: 'next-adjustment',
    sectionId: 'two-dimensional',
    prompt:
      'Six findings on the monitor. For each, name the thing to change first — the aim, the width, the time sampling, the display — or that no knob answers it and the state or the question has to be reassessed.',
    originsAreChainStops: false,
    origins: [
      { id: 'angle', label: 'The aim', definition: 'Change which ray crosses the target.' },
      { id: 'field', label: 'The width', definition: 'Close the collimator to the task.' },
      {
        id: 'time',
        label: 'The time sampling',
        definition: 'Change pulse width or pulse rate, or pause the movement.',
      },
      { id: 'display', label: 'The display', definition: 'Zoom or window the stored image.' },
      {
        id: 'reassess',
        label: 'No knob — reassess',
        definition:
          'The state or the question has changed; ask what has moved before touching anything.',
      },
    ],
    rows: [
      {
        id: 'rib-over-target',
        statement: 'A rib lies over the target on the frontal view; the needle is crisp.',
        origin: 'angle',
        rationale:
          'Superimposition lives on one ray. Another ray, planned on the CT, is the first move.',
      },
      {
        id: 'grainy-positioned',
        statement: 'The image is grainy, and the target is well centred.',
        origin: 'field',
        rationale:
          'Close the field first: less scatter reaches the panel and the machine may need fewer photons for the same picture.',
      },
      {
        id: 'tool-blurs',
        statement: 'The needle blurs each time it advances.',
        origin: 'time',
        rationale:
          'Movement within one pulse is a pulse-width problem; movement between pulses is a rate problem.',
      },
      {
        id: 'small-clear',
        statement: 'The needle edge is resolved but too small to inspect from where you stand.',
        origin: 'display',
        rationale: 'Enlarge the stored image. No new measurement is needed for a viewing problem.',
      },
      {
        id: 'target-gone',
        statement:
          'The target that was visible a minute ago cannot be found, and the overlay no longer matches.',
        origin: 'reassess',
        rationale:
          'Nothing on the console restores a collapsed lung or a moved target. Ask what has changed.',
      },
      {
        id: 'overlap-depth',
        statement: 'Needle and nodule overlap, and nobody can say whether they are in contact.',
        origin: 'angle',
        rationale:
          'A separated second view exposes the depth the first compressed. If it cannot, a sweep or an orbit can.',
      },
    ],
    sourceIds: ['setser', 'tg272', 'wabip'],
  },
  {
    id: 'where-it-lives',
    sectionId: 'suite-cases',
    prompt:
      'Eight findings from the imaging guide. For each, say which stop of the chain the problem lives at.',
    originsAreChainStops: true,
    origins: chainOrigins(['source', 'beam', 'patient', 'detector', 'reconstruction', 'display']),
    rows: [
      {
        id: 'tool-visible-lesion-uncertain',
        statement: 'The tool is visible; the lesion is uncertain.',
        origin: 'patient',
        rationale:
          'Identity and current state are questions about the anatomy the beam crosses, not about the hardware.',
      },
      {
        id: 'structure-overlaps',
        statement: 'A structure overlaps the target.',
        origin: 'beam',
        rationale: 'Two things on one ray share a pixel. The overlap is made at the beam.',
      },
      {
        id: 'grainy-washed',
        statement: 'The image is grainy or washed out.',
        origin: 'source',
        rationale: 'Photon count and scatter decide grain and contrast; they begin at the source.',
      },
      {
        id: 'edges-duplicate',
        statement: 'Edges duplicate, or instruments lag.',
        origin: 'detector',
        rationale:
          'How often and how long the panel measures decides what motion does to the picture.',
      },
      {
        id: 'depth-uncertain',
        statement: 'A depth relationship remains uncertain after two views.',
        origin: 'reconstruction',
        rationale: 'A new measurement — a sweep or an orbit — is a reconstruction question.',
      },
      {
        id: 'reconstructed-overlap',
        statement: 'A reconstructed tool overlaps the target on a slab.',
        origin: 'display',
        rationale:
          'Which component, which planes and which thickness are shown is a display and decision question.',
      },
      {
        id: 'setup-changed',
        statement: 'The anatomy or the setup has changed since the last image.',
        origin: 'patient',
        rationale: 'The timestamp of the anatomy belongs to the patient stop.',
      },
      {
        id: 'dose-alert',
        statement: 'A dose number or an alert appears.',
        origin: 'detector',
        rationale:
          'The quantity, its units and the modes it covers are defined where the beam is measured.',
      },
    ],
    sourceIds: ['setser', 'wabip', 'aapm12'],
  },
])

const sortById = new Map(IMAGING_SORTS.map((sort) => [sort.id, sort] as const))

export function imagingSort(id: string): ImagingSort {
  const sort = sortById.get(id)
  if (!sort) throw new Error(`Unknown sort ${id}`)
  return sort
}

export function imagingSortFor(sectionId: ImagingSectionId): ImagingSort | null {
  return IMAGING_SORTS.find((sort) => sort.sectionId === sectionId) ?? null
}

export function validateImagingSorts(
  sorts: readonly ImagingSort[] = IMAGING_SORTS,
): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const sort of sorts) {
    const where = `Sort ${sort.id}`
    if (ids.has(sort.id)) errors.push(`${where} is declared twice.`)
    ids.add(sort.id)
    const originIds = new Set(sort.origins.map((origin) => origin.id))
    for (const origin of sort.origins) {
      if (!sort.rows.some((row) => row.origin === origin.id)) {
        errors.push(`${where} origin ${origin.id} is the answer to no row; it is a decoy.`)
      }
      if (sort.originsAreChainStops && !isChainStopId(origin.id)) {
        errors.push(`${where} origin ${origin.id} is not a chain stop.`)
      }
      errors.push(
        ...imagingLearnerCopyErrors(`${where} origin ${origin.id} label`, origin.label),
        ...imagingLearnerCopyErrors(`${where} origin ${origin.id} definition`, origin.definition),
      )
    }
    const rowIds = new Set<string>()
    for (const row of sort.rows) {
      if (rowIds.has(row.id)) errors.push(`${where} row ${row.id} is declared twice.`)
      rowIds.add(row.id)
      if (!originIds.has(row.origin)) errors.push(`${where} row ${row.id} names an unknown origin.`)
      errors.push(
        ...imagingLearnerCopyErrors(`${where} row ${row.id} statement`, row.statement),
        ...imagingLearnerCopyErrors(`${where} row ${row.id} rationale`, row.rationale),
      )
    }
    if (sort.rows.length < 5) errors.push(`${where} needs at least five rows.`)
    errors.push(...imagingLearnerCopyErrors(`${where} prompt`, sort.prompt))
    if (sort.sourceIds.length === 0) errors.push(`${where} cites nothing.`)
    for (const sourceId of sort.sourceIds) {
      if (!SOURCE_BY_ID.has(sourceId))
        errors.push(`${where} cites an unregistered source ${sourceId}.`)
    }
  }
  return errors
}

const sortErrors = validateImagingSorts()
if (sortErrors.length > 0) {
  throw new Error(`The imaging sorts are invalid:\n${sortErrors.join('\n')}`)
}
