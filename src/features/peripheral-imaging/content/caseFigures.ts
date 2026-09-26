import { DTS } from '../lib/tomosynthesis'
import { LESION_RADIUS, windowRelationship, type Point3 } from '../lib/physics'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { capstoneItemId, imagingCaseById } from './cases'
import { imagingMicroCaseById } from './microCases'
import type { FixedExampleEvidence } from './teachingExamples'

/**
 * Figures inside cases (Prompt 04, owner decisions OD4-04 and OD4-12, 2026-09-22).
 *
 * A case figure is fixed, authored data, like a section check's fixed example (PI-01): it has one
 * identity, one declared relation to its question, and one state that nothing the learner does can
 * change. Opening the explanation, checking an answer or trying again changes only which readouts
 * are shown. Nothing here falls back to a default: every figure a case renders is listed, and
 * `caseFigureFor` returns nothing for a case that is not.
 *
 * The five OD4-04 safeguards, as they apply here:
 * 1. every model figure is labelled as teaching model output, never a patient acquisition;
 * 2. every figure declares whether it depicts its question (`depicts-the-question`) or is only the
 *    course's model beside a written scenario (`illustrative-model`);
 * 3. the case text was changed to match the model (practice 9: left lung, smooth sphere, no
 *    airway claim), never the other way round;
 * 4. no teaching colour gives an answer away (the DTS prior layer is drawn in neutral grey here);
 * 5. readouts that state the answer stay hidden until the learner opens the explanation or checks
 *    an answer.
 */
export type CaseFigureMedium = 'teaching-model' | 'schematic'

export interface CaseFigureDeclaration {
  /** `<item id>:figure`, so the figure is keyed to exactly one question. */
  readonly identity: string
  readonly caseKind: 'practice' | 'integrated'
  readonly caseId: string
  readonly evidence: FixedExampleEvidence
  readonly medium: CaseFigureMedium
  /** Printed first on the figure, before any image. */
  readonly label: string
  /** Why the declaration is what it is. Not shown to the learner. */
  readonly basis: string
}

/**
 * Practice 9 (QS-5). Every value is the existing DTS model's: the plane frame the Section 10 and 11
 * views use, and the catheter's authored depth from the projection manifest. The projection panel is
 * that model's 0° projection with the catheter, before the teaching filter the stored projections
 * carry (see `dtsModelProjection`).
 */
export const DTS_ABSENCE_FIGURE = {
  /** From the modeled catheter's depth to the modeled lesion's centre, in plane millimetres. */
  planeDepthsMm: [DTS.toolPlaneRelativeMm, DTS.toolPlaneRelativeMm / 2, 0] as const,
  /** The planning CT through the lesion: the same plane geometry at the lesion's depth. */
  ctPlaneDepthMm: 0,
} as const

/**
 * Integrated case 5 (QS-8). Tip and plane positions relative to the modeled lesion's centre, in
 * millimetres (x patient left, y anterior, z superior). The needle runs along +x and its side window
 * spans tip − 14 to tip − 6 (`windowRelationship`), so a tip 19 mm along x puts the window across
 * the lesion's edge and the tip beyond it. `case-figures.test.ts` holds this to the model's own
 * readouts rather than to how the drawing looks.
 */
export const SAMPLING_CASE_FIGURE: {
  readonly tip: Point3
  readonly planes: { readonly axial: number; readonly coronal: number; readonly sagittal: number }
} = {
  tip: [19, 2, -1],
  // Axial and coronal planes through the needle; the sagittal plane through the part of the
  // window that lies inside the modeled lesion.
  planes: { axial: -1, coronal: 2, sagittal: 7 },
}

export function samplingCaseReadouts() {
  const relationship = windowRelationship(SAMPLING_CASE_FIGURE.tip)
  const [x, y, z] = SAMPLING_CASE_FIGURE.tip
  const tipFromSurfaceMm = Math.hypot(x, y, z) - LESION_RADIUS
  return { ...relationship, tipFromSurfaceMm }
}

const DECLARATIONS: readonly CaseFigureDeclaration[] = [
  {
    identity: 'practice:dts-interpretation-practice-1:figure',
    caseKind: 'practice',
    caseId: 'dts-interpretation-practice-1',
    evidence: 'depicts-the-question',
    medium: 'teaching-model',
    label:
      'Teaching model: CT-derived images with an authored nodule and a modeled catheter. Not a patient acquisition.',
    basis:
      'The question asks what the reconstructed planes support. The figure shows a projection of the DTS model with its catheter in place, three planes that carry no catheter at any depth, and the planning CT through the lesion: the absence and the resemblance the answer rests on are on screen.',
  },
  {
    identity: `${capstoneItemId('case-5-v2')}:figure`,
    caseKind: 'integrated',
    caseId: 'case-5-v2',
    evidence: 'depicts-the-question',
    medium: 'teaching-model',
    label:
      'Teaching model: CT context with an authored nodule and a modeled needle. Not a patient acquisition; the needle’s dimensions do not describe a real device.',
    basis:
      'The question asks which part of the needle lies where. The linked thin planes are drawn at an authored geometry whose window partly intersects the modeled lesion and whose tip lies beyond it, by the model’s own relationship readout.',
  },
  {
    identity: 'practice:staff-protection-practice-1:figure',
    caseKind: 'practice',
    caseId: 'staff-protection-practice-1',
    evidence: 'depicts-the-question',
    medium: 'schematic',
    label:
      'Schematic of this case’s room, drawn from its text. Not a scatter measurement or a dose map.',
    basis:
      'The case states the geometry completely: tube near, detector far, three standing positions at a similar distance from the table. The plan draws exactly that and nothing about exposure.',
  },
]

export function caseFigureDeclarations(): readonly CaseFigureDeclaration[] {
  return DECLARATIONS
}

export function caseFigureFor(
  caseKind: CaseFigureDeclaration['caseKind'],
  caseId: string,
): CaseFigureDeclaration | null {
  return (
    DECLARATIONS.find(
      (declaration) => declaration.caseKind === caseKind && declaration.caseId === caseId,
    ) ?? null
  )
}

export function validateCaseFigures(): readonly string[] {
  const errors: string[] = []
  const identities = new Set<string>()
  for (const declaration of DECLARATIONS) {
    const where = `Case figure ${declaration.identity}`
    if (identities.has(declaration.identity)) errors.push(`${where} is declared twice.`)
    identities.add(declaration.identity)
    const item =
      declaration.caseKind === 'practice'
        ? imagingMicroCaseById.get(declaration.caseId)?.item
        : imagingCaseById.get(declaration.caseId)?.item
    if (!item) errors.push(`${where} names a case that is not in the module.`)
    else if (declaration.identity !== `${item.id}:figure`)
      errors.push(`${where} is not keyed to its case's item.`)
    errors.push(...imagingLearnerCopyErrors(`${where} label`, declaration.label))
    if (declaration.medium === 'teaching-model' && !/^Teaching model:/.test(declaration.label))
      errors.push(`${where} does not open by naming itself a teaching model.`)
    if (!/Not a /.test(declaration.label)) errors.push(`${where} does not say what it is not.`)
  }
  const sampling = samplingCaseReadouts()
  if (!sampling.intersects || sampling.full || sampling.tipInside)
    errors.push(
      'The integrated case 5 figure no longer shows a window partly inside and a tip beyond.',
    )
  return errors
}

const caseFigureErrors = validateCaseFigures()
if (caseFigureErrors.length > 0) {
  throw new Error(`The case figures are invalid:\n${caseFigureErrors.join('\n')}`)
}
