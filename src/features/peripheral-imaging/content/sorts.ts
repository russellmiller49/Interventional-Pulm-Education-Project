import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { chainStop, isChainStopId } from './imagingChain'
import { imagingLearnerCopyErrors } from './learnerCopy'
import type { ImagingSectionId } from './pathway'

/**
 * Attribution sorts: the Act step of the sections that have no lab to act on.
 *
 * Each sort is a set of statements the learner places into a small set of origins — the four
 * imaging questions, the fluoroscopy controls, the three uses of a reconstruction, the thing to
 * change first, the component of image formation a problem arises at — committed as a set and
 * graded row by row in words. Every origin must be the answer to something (a decoy origin is a trick),
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
      'Six findings a display can show. For each, say which question it answers: navigation (catheter position relative to the navigation target), localization (where the lesion is now), tool-in-lesion confirmation (where the actual biopsy tool is relative to the lesion), or diagnosis (whether the specimen answered the clinical question).',
    originsAreChainStops: false,
    origins: [
      {
        id: 'navigation',
        label: 'Navigation',
        definition: 'Catheter position relative to the navigation target.',
      },
      { id: 'localization', label: 'Localization', definition: 'Where the lesion is now.' },
      {
        id: 'confirmation',
        label: 'Tool-in-lesion confirmation',
        definition: 'Where the actual biopsy tool is relative to the lesion.',
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
          'Navigation shows catheter position relative to the navigation target. It says nothing about where the lesion is today.',
      },
      {
        id: 'tissue-all-round',
        statement: 'The radial EBUS view is concentric.',
        origin: 'localization',
        rationale:
          'The rEBUS probe images the tissue around itself: a localization finding, not a statement about the biopsy tool that follows.',
      },
      {
        id: 'window-in-solid-part',
        statement:
          'Thin reformats show the needle’s side-cutting window within the solid component of the nodule.',
        origin: 'confirmation',
        rationale:
          'The part of the biopsy tool that acquires tissue is shown within the lesion in more than one plane. That is tool-in-lesion confirmation.',
      },
      {
        id: 'adequate-cells',
        statement: 'The pathologist reports adequate malignant cells.',
        origin: 'diagnosis',
        rationale: 'Only the specimen answers the clinical question. Imaging never did.',
      },
      {
        id: 'contour-moved',
        statement: 'A DTS acquisition moves the navigation target by several millimetres.',
        origin: 'localization',
        rationale:
          'A reconstruction that moves the target updates where the lesion is now. It does not show the biopsy tool.',
      },
      {
        id: 'rose-nondiagnostic',
        statement:
          'The specimen came from the tissue the radial EBUS view showed, and rapid on-site evaluation was nondiagnostic.',
        origin: 'diagnosis',
        rationale:
          'A specimen that does not answer the question is a diagnostic finding, whatever the imaging showed about position.',
      },
    ],
    sourceIds: ['setser', 'confirm', 'ilocate'],
  },
  {
    id: 'five-things',
    sectionId: 'good-image',
    prompt:
      'Nine controls and readouts on a C-arm console. For each, say which fluoroscopy control it belongs to — C-arm projection, collimation, pulse rate and pulse width, acquisition mode, or display — or that it is monitoring, because you read it rather than set it.',
    originsAreChainStops: false,
    origins: [
      {
        id: 'angle',
        label: 'C-arm projection',
        definition: 'Obliquity and cranial or caudal angulation.',
      },
      {
        id: 'field',
        label: 'Collimation',
        definition: 'The collimator blades: the irradiated field.',
      },
      {
        id: 'time',
        label: 'Pulse rate and pulse width',
        definition: 'How often an image is acquired and how long each exposure lasts.',
      },
      {
        id: 'acquisition',
        label: 'Acquisition mode',
        definition: 'A single fluoroscopic projection, a DTS acquisition or a CBCT spin.',
      },
      { id: 'display', label: 'Display', definition: 'Display zoom, window/level and overlays.' },
      {
        id: 'monitoring',
        label: 'Monitoring',
        definition: 'Set or accumulated by the system; read, not adjusted.',
      },
    ],
    rows: [
      {
        id: 'obliquity',
        statement: 'The C-arm obliquity control.',
        origin: 'angle',
        rationale:
          'It rotates the C-arm around the patient and changes which anatomy is superimposed on the lesion.',
      },
      {
        id: 'blades',
        statement: 'The collimator blades.',
        origin: 'field',
        rationale: 'They narrow the beam: less tissue is irradiated and less scatter is produced.',
      },
      {
        id: 'pulse-rate',
        statement: 'The pulse rate selector.',
        origin: 'time',
        rationale: 'It sets how often a new image is acquired.',
      },
      {
        id: 'spin-button',
        statement: 'The CBCT acquisition button.',
        origin: 'acquisition',
        rationale: 'It requests a rotational acquisition instead of a single projection.',
      },
      {
        id: 'window-level',
        statement: 'The window and level control.',
        origin: 'display',
        rationale: 'It maps the same acquired values to different grey levels.',
      },
      {
        id: 'kilovoltage',
        statement: 'The kV shown on the console.',
        origin: 'monitoring',
        rationale:
          'Automatic exposure regulation selects it. You read it; you do not set it directly.',
      },
      {
        id: 'stored-zoom',
        statement: 'Display zoom on a stored image.',
        origin: 'display',
        rationale: 'It enlarges acquired pixels and adds no exposure.',
      },
      {
        id: 'tilt',
        statement: 'The cranial/caudal angulation.',
        origin: 'angle',
        rationale:
          'The second projection axis; it changes superimposition along the length of the chest.',
      },
      {
        id: 'kap-readout',
        statement: 'The kerma–area product readout.',
        origin: 'monitoring',
        rationale:
          'It accumulates what the system delivered. It is where output is judged, not a control.',
      },
    ],
    sourceIds: ['tg272', 'tg125', 'wabip'],
  },
  {
    id: 'three-uses',
    sectionId: 'dts-interpretation',
    prompt:
      'Six things that can follow a DTS acquisition. For each, say which use of the reconstruction it is: a navigation target update, local tomographic imaging, or an augmented-fluoroscopy overlay.',
    originsAreChainStops: false,
    origins: [
      {
        id: 'correction',
        label: 'Navigation target update',
        definition: 'The navigation target moves to where the reconstruction located the lesion.',
      },
      {
        id: 'tomography',
        label: 'Local tomography',
        definition: 'Reconstructed planes through the lesion and the tool are displayed.',
      },
      {
        id: 'overlay',
        label: 'Augmented fluoroscopy',
        definition: 'A segmentation is projected onto live fluoroscopy and follows the C-arm.',
      },
    ],
    rows: [
      {
        id: 'target-jumps',
        statement: 'The virtual target moves to a new position after the DTS acquisition.',
        origin: 'correction',
        rationale: 'The navigation target has been updated; nothing has been shown about the tool.',
      },
      {
        id: 'three-planes',
        statement:
          'Axial, coronal and sagittal planes through the needle appear on a second monitor.',
        origin: 'tomography',
        rationale: 'That is a reconstructed volume read in multiplanar views.',
      },
      {
        id: 'outline-follows',
        statement:
          'A coloured outline of the nodule follows the live fluoroscopy as the C-arm moves.',
        origin: 'overlay',
        rationale: 'A segmentation projected onto a current image, registered to the C-arm.',
      },
      {
        id: 'catheter-redirected',
        statement:
          'The catheter is redirected because the navigation target now shows the lesion elsewhere.',
        origin: 'correction',
        rationale:
          'Guidance changed because the navigation target changed, not because the tool was seen in the lesion.',
      },
      {
        id: 'outline-stays',
        statement: 'The overlay contour stays where it was while the lung collapses beneath it.',
        origin: 'overlay',
        rationale:
          'An overlay reflects the time of its source acquisition. The live image changed; the contour did not.',
      },
      {
        id: 'elongated-slab',
        statement:
          'A slab through the DTS reconstruction shows the needle and nodule elongated in depth.',
        origin: 'tomography',
        rationale:
          'The limited-angle acquisition resolves depth unevenly, and the reconstruction shows that anisotropy.',
      },
    ],
    sourceIds: ['saad', 'frontier', 'pritchett'],
  },
  {
    id: 'next-adjustment',
    sectionId: 'two-dimensional',
    prompt:
      'Six findings on the monitor. For each, name what to change first — the C-arm projection, collimation, pulse rate or pulse width, or the display — or that no control addresses it and the lesion or the question has to be reassessed.',
    originsAreChainStops: false,
    origins: [
      {
        id: 'angle',
        label: 'C-arm projection',
        definition: 'Change the projection to move the lesion away from overlapping anatomy.',
      },
      {
        id: 'field',
        label: 'Collimation',
        definition: 'Collimate to the lesion, the tool and the landmarks you need.',
      },
      {
        id: 'time',
        label: 'Pulse rate and pulse width',
        definition: 'Change pulse width or pulse rate, or pause the movement.',
      },
      {
        id: 'display',
        label: 'Display',
        definition: 'Display zoom or window/level on the stored image.',
      },
      {
        id: 'reassess',
        label: 'No control — reassess',
        definition: 'The anatomy or the question has changed; reconfirm before adjusting anything.',
      },
    ],
    rows: [
      {
        id: 'rib-over-target',
        statement:
          'A rib is superimposed on the lesion on the frontal projection; the needle is sharp.',
        origin: 'angle',
        rationale:
          'Superimposition is a projection problem. A different projection, planned from the CT, is the first step.',
      },
      {
        id: 'grainy-positioned',
        statement: 'The image is noisy, and the lesion is well centred.',
        origin: 'field',
        rationale:
          'Collimate first: less scatter reaches the detector, and automatic exposure regulation may need fewer photons for the same image.',
      },
      {
        id: 'tool-blurs',
        statement: 'The needle blurs each time it advances.',
        origin: 'time',
        rationale:
          'Motion within one pulse is a pulse-width problem; motion between pulses is a pulse-rate problem.',
      },
      {
        id: 'small-clear',
        statement: 'The needle edge is resolved but too small to inspect from where you stand.',
        origin: 'display',
        rationale:
          'Use display zoom on the stored image. A viewing problem needs no new acquisition.',
      },
      {
        id: 'target-gone',
        statement:
          'The lesion visible a minute ago cannot be found, and the overlay no longer matches.',
        origin: 'reassess',
        rationale:
          'No control restores an atelectatic segment or a displaced lesion. Reconfirm what has changed.',
      },
      {
        id: 'overlap-depth',
        statement:
          'The needle and nodule overlap, and nobody can say whether the needle is in the lesion.',
        origin: 'angle',
        rationale:
          'A sufficiently separated second projection resolves the depth the first collapsed. If it cannot, use DTS or CBCT.',
      },
    ],
    sourceIds: ['setser', 'tg272', 'wabip'],
  },
  {
    id: 'where-it-lives',
    sectionId: 'suite-cases',
    prompt:
      'Eight findings from the troubleshooting table. For each, say at which component of image formation the problem arises.',
    originsAreChainStops: true,
    origins: chainOrigins(['source', 'beam', 'patient', 'detector', 'reconstruction', 'display']),
    rows: [
      {
        id: 'tool-visible-lesion-uncertain',
        statement: 'The tool is visible; the lesion is uncertain.',
        origin: 'patient',
        rationale:
          'Lesion identity and the current anatomy are questions about the patient, not about the tool.',
      },
      {
        id: 'structure-overlaps',
        statement: 'A structure is superimposed on the lesion.',
        origin: 'beam',
        rationale:
          'Two objects on one X-ray path project to the same location. Superimposition arises from beam geometry.',
      },
      {
        id: 'grainy-washed',
        statement: 'The image is noisy or low in contrast.',
        origin: 'source',
        rationale:
          'Photon output and scatter determine noise and contrast; they begin at the X-ray tube.',
      },
      {
        id: 'edges-duplicate',
        statement: 'Edges duplicate, or instruments lag behind their movement.',
        origin: 'detector',
        rationale:
          'How often and for how long the detector acquires determines what motion does to the image.',
      },
      {
        id: 'depth-uncertain',
        statement: 'A depth relationship remains uncertain after two projections.',
        origin: 'reconstruction',
        rationale:
          'A DTS acquisition or a CBCT spin resolves it, which is a reconstruction question.',
      },
      {
        id: 'reconstructed-overlap',
        statement: 'A reconstructed tool overlaps the lesion on a thick slab.',
        origin: 'display',
        rationale:
          'Which component, which planes and which slab thickness are displayed is a display and interpretation question.',
      },
      {
        id: 'setup-changed',
        statement: 'The anatomy or the setup has changed since the last image.',
        origin: 'patient',
        rationale: 'Changes in the anatomy since the last acquisition belong to the patient.',
      },
      {
        id: 'dose-alert',
        statement: 'A dose index or a dose notification appears.',
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
