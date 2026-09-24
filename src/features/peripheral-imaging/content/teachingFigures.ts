import { fovCylinder } from '../components/suite/suiteModel'
import { LESION_CENTER, type Point3 } from '../lib/physics'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * Teaching figures on reading steps (Prompt 04, owner decisions OD4-06 and OD4-08, 2026-09-22).
 *
 * Each is fixed, authored data drawn from the course's own models: nothing reads the learner's
 * controls, and every number a caption prints is computed from the same state the figure draws.
 * They sit on reading steps, not beside a question, so they declare what they are made of
 * (`medium`) rather than a relation to a question. Every signed angle is the model's own C-arm
 * obliquity or beam tilt; none is given a LAO/RAO or cranial/caudal name (P03-ANGLE is open).
 */
export type TeachingFigureMedium =
  /** Output of the course's CT-derived model, labelled as such. */
  | 'model-output'
  /** Model output with a labelled simulated effect applied. */
  | 'simulated-on-model'
  /** A text panel standing where an honest image does not yet exist. */
  | 'placeholder'

export interface TeachingFigurePanel {
  readonly id: string
  readonly title: string
  readonly medium: TeachingFigureMedium
  readonly caption: string
}

export interface TeachingFigureDeclaration {
  readonly id: string
  /** The reading step's content reference that places it in the teaching column, if one does. */
  readonly contentRef?: `@${string}`
  readonly label: string
  readonly panels: readonly TeachingFigurePanel[]
}

/**
 * The CT → two-axis worked example for Section 9 (OD4-08, option A). Every choice below was read
 * off the model before it was written down (see the handoff): along the target ray, the frontal
 * view's detector-side path crosses a large soft-tissue-like density anterior to the modeled
 * lesion; negative obliquity (detector toward the patient's left) swings that part of the ray off
 * it, and −20° gives the shortest soft-tissue-like path of the candidates; at −20° tilt changes
 * little, so this lesion needs none; beyond about −25° the tube-side path lengthens toward the
 * spine instead. `model-truth.test.ts` holds each of those statements to the real teaching CT.
 */
export const TWO_AXIS_EXAMPLE = {
  sliceZ: LESION_CENTER[2],
  /** Beam lines drawn on the axial CT. */
  candidates: [0, -20, 20] as const,
  chosenObliquity: -20,
  /** Rows of the target-ray comparison. */
  stripObliquities: [0, -20, -35, 20] as const,
  /** Beam tilts checked at the chosen obliquity. */
  tiltCheck: { obliquity: -20, tilts: [-10, 0, 10, 20] as const },
  /** "No tilt needed" is printed only if the detector-side path changes by no more than this. */
  tiltToleranceMm: 10,
  /** The image is the collimated field itself: recentred on the lesion, 200 detector mm across. */
  projection: { sizePx: 192, fieldMm: 200 },
  /** The modeled tool's direction in the geometry lab: 65 mm along −x from its tip. */
  toolLengthMm: 65,
  /** A view close to the modeled tool's own axis. */
  alignmentObliquity: -80,
} as const

/** Section 6's CT-derived comparison (OD4-06; brief D1–D3). */
export const CONSPICUITY_SET = {
  referenceView: { orbit: 0, tilt: 0 },
  changedView: { orbit: TWO_AXIS_EXAMPLE.chosenObliquity, tilt: 0 },
  sizePx: 192,
  frameFieldMm: 340,
  collimatedFieldMm: 200,
  noise: { photonsPerPixel: 700, seed: 6 },
  veil: { fractionOfMean: 1 },
} as const

/**
 * Section 16's truncation panel (OD4-06; brief D5). The modeled reconstruction volume is the CBCT
 * model's own field-of-view cylinder, placed off-centre so that its edge runs through the modeled
 * lesion's centre. It is honest about coverage only.
 */
export const TRUNCATION_EXAMPLE: {
  readonly sliceZ: number
  readonly radiusMm: number
  readonly centreMm: Point3
} = {
  sliceZ: LESION_CENTER[2],
  radiusMm: fovCylinder('generic').radius,
  centreMm: [LESION_CENTER[0] - fovCylinder('generic').radius, LESION_CENTER[1], LESION_CENTER[2]],
}

/** Signed model angle, e.g. "−20°" or "+20°", never a console label. */
export function signedDegrees(value: number): string {
  if (value === 0) return '0°'
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}°`
}

/** Where the model's sign convention puts the detector, in patient terms. */
export function obliquityDirection(value: number): string {
  if (value === 0) return 'frontal'
  return value < 0 ? 'detector toward the patient’s left' : 'detector toward the patient’s right'
}

const DECLARATIONS: readonly TeachingFigureDeclaration[] = [
  {
    // Section 6's reading steps show it in place of the cartoon set (`TeachingPanels`).
    id: 'signal:conspicuity-set',
    label:
      'Teaching model: projections computed from the course’s CT, which carries an authored nodule. Two of the effects below are simulated, and say so. Not device images, and no panel is a dose level.',
    panels: [
      {
        id: 'reference',
        title: 'Reference',
        medium: 'model-output',
        caption: 'Frontal projection, collimated to the task.',
      },
      {
        id: 'noise',
        title: 'Quantum noise · simulated',
        medium: 'simulated-on-model',
        caption:
          'The same projection re-read from far fewer detected photons per pixel. The mottle is fine and heaviest where the beam is most attenuated. It illustrates the square-root relation between photons and signal-to-noise; it is not a dose level or a setting.',
      },
      {
        id: 'scatter',
        title: 'Scatter-related contrast loss · drawn veil',
        medium: 'simulated-on-model',
        caption:
          'The collimator is open to the detector edges and a uniform veil is added, shown at the reference’s average brightness. Dense and soft structures drift toward the same gray while edges stay sharp. The course does not calculate scatter: this is a drawing of its look.',
      },
      {
        id: 'superimposition',
        title: 'Superimposition · another projection',
        medium: 'model-output',
        caption:
          'Only the C-arm obliquity changes. What lies along the ray through the lesion changes with it; the anatomy and the lesion do not move.',
      },
    ],
  },
  {
    id: 'changing-anatomy:artifact-strip',
    contentRef: '@artifact-strip',
    label:
      'Only the truncation panel is an image, and it is a teaching model. Authentic examples of motion and of a new dependent opacity are not shown until cleared media exist.',
    panels: [
      {
        id: 'motion',
        title: 'Motion · duplicated edges',
        medium: 'placeholder',
        caption:
          'No image here: the course has no motion model, and no cleared authentic example is available yet. Look for the catheter and the lesion margin drawn twice, a small distance apart, on several planes. Duplicated edges suggest motion; with the table, the C-arm and the tool still, breathing or other patient motion during the spin is the likely source.',
      },
      {
        id: 'truncation',
        title: 'Truncation · coverage',
        medium: 'model-output',
        caption:
          'Teaching model: an axial plane of the course’s CT, masked outside a modeled reconstruction volume that was placed off-centre, so its edge runs through the modeled lesion. Part of the lesion was never imaged. It shows coverage, not how a real reconstruction looks at its edge.',
      },
      {
        id: 'opacity',
        title: 'New dependent opacity',
        medium: 'placeholder',
        caption:
          'No image here: the course’s registration model moves anatomy rigidly and cannot show a new opacity, and no cleared authentic example is available yet. Look for a soft, ill-defined region in dependent lung that was absent on the earlier volume. It may be real atelectasis: anatomy, not an image-quality problem.',
      },
    ],
  },
  {
    id: 'two-dimensional:two-axis-example',
    contentRef: '@two-axis-example',
    label:
      'Teaching model: CT-derived anatomy with an authored nodule in the posterior left lung; no lobe is named. Angles are the model’s signed C-arm obliquity and beam tilt, not console labels.',
    panels: [
      {
        id: 'axial',
        title: 'Planning CT through the lesion, with candidate beams',
        medium: 'model-output',
        caption:
          'Each line is the central ray through the modeled lesion at one C-arm obliquity, with its arrowhead at the detector end; the X-ray tube is at the other end.',
      },
      {
        id: 'strip',
        title: 'What each ray crosses',
        medium: 'model-output',
        caption:
          'Millimetres of CT density along each ray, on the tube side and the detector side of the lesion. The model names density classes, not organs.',
      },
      {
        id: 'tilt',
        title: 'Beam tilt at the chosen obliquity',
        medium: 'model-output',
        caption: 'The same comparison as the beam is tilted, at the chosen obliquity.',
      },
      {
        id: 'projections',
        title: 'Projection before and after',
        medium: 'model-output',
        caption:
          'Recentred on the lesion and collimated around it and the tool’s approach. The dashed circle marks where the authored nodule projects; it is faint on any projection in this model.',
      },
      {
        id: 'tool-views',
        title: 'Alignment view and advancement view',
        medium: 'model-output',
        caption:
          'The modeled tool seen from near its own axis, where it is foreshortened, and side-on, where it is in profile.',
      },
    ],
  },
]

export function teachingFigureDeclarations(): readonly TeachingFigureDeclaration[] {
  return DECLARATIONS
}

export function teachingFigure(id: string): TeachingFigureDeclaration {
  const found = DECLARATIONS.find((declaration) => declaration.id === id)
  if (!found) throw new Error(`Unknown teaching figure ${id}`)
  return found
}

/** No figure text may give a signed angle a clinical console name. */
export const CLINICAL_ANGLE_LABEL = /\b(LAO|RAO|cranial|caudal)\b/i

export function validateTeachingFigures(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const declaration of DECLARATIONS) {
    const where = `Teaching figure ${declaration.id}`
    if (ids.has(declaration.id)) errors.push(`${where} is declared twice.`)
    ids.add(declaration.id)
    errors.push(...imagingLearnerCopyErrors(`${where} label`, declaration.label))
    for (const panel of declaration.panels) {
      errors.push(
        ...imagingLearnerCopyErrors(`${where} ${panel.id} title`, panel.title),
        ...imagingLearnerCopyErrors(`${where} ${panel.id} caption`, panel.caption),
      )
      if (CLINICAL_ANGLE_LABEL.test(`${panel.title} ${panel.caption}`))
        errors.push(`${where} ${panel.id} gives an angle a console name.`)
      if (
        panel.medium === 'simulated-on-model' &&
        !/simulat|drawn|drawing/i.test(panel.title + panel.caption)
      )
        errors.push(`${where} ${panel.id} is simulated but does not say so.`)
      if (panel.medium === 'placeholder' && !/^No image here/.test(panel.caption))
        errors.push(`${where} ${panel.id} is a placeholder that does not say so.`)
    }
  }
  return errors
}

const teachingFigureErrors = validateTeachingFigures()
if (teachingFigureErrors.length > 0) {
  throw new Error(`The teaching figures are invalid:\n${teachingFigureErrors.join('\n')}`)
}
