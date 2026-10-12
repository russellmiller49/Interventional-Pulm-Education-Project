import { DTS } from '../lib/tomosynthesis'
import { LESION_RADIUS, windowRelationship, type Point3 } from '../lib/physics'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { capstoneItemId, imagingCaseById } from './cases'
import { imagingMicroCaseById } from './microCases'

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
 * 1. every figure opens with a plain caption of what it shows (teaching-first rules, 2026-10-08:
 *    the module's one statement that it is a teaching simulator is on the hub, not on each figure);
 * 2. every figure depicts its question (`depicts-the-question`); a case whose scenario no figure
 *    here can show carries no figure;
 * 3. the case text was changed to match the model (practice 9: left lung, smooth sphere, no
 *    airway claim), never the other way round;
 * 4. no teaching colour gives an answer away (the DTS prior layer is drawn in neutral grey here);
 * 5. readouts that state the answer stay hidden until the learner opens the explanation or checks
 *    an answer.
 */
export type CaseFigureMedium = 'teaching-model' | 'schematic'
export type CaseFigureEvidence = 'depicts-the-question'

export interface CaseFigureDeclaration {
  /** `<item id>:figure`, so the figure is keyed to exactly one question. */
  readonly identity: string
  readonly caseKind: 'practice' | 'integrated'
  readonly caseId: string
  readonly evidence: CaseFigureEvidence
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
      'One projection with the catheter in place, three reconstructed planes, and the planning CT through the same lesion.',
    basis:
      'The question asks what the reconstructed planes support. The figure shows a projection of the DTS model with its catheter in place, three planes that carry no catheter at any depth, and the planning CT through the lesion: the absence and the resemblance the answer rests on are on screen.',
  },
  {
    identity: `${capstoneItemId('case-5-v2')}:figure`,
    caseKind: 'integrated',
    caseId: 'case-5-v2',
    evidence: 'depicts-the-question',
    medium: 'teaching-model',
    label: 'Linked thin axial, coronal and sagittal planes through the lesion and the needle.',
    basis:
      'The question asks which part of the needle lies where. The linked thin planes are drawn at a geometry whose window partly intersects the modeled lesion and whose tip lies beyond it, by the model’s own relationship readout.',
  },
  {
    identity: 'practice:staff-protection-practice-1:figure',
    caseKind: 'practice',
    caseId: 'staff-protection-practice-1',
    evidence: 'depicts-the-question',
    medium: 'schematic',
    label:
      'Plan of the room in this case: the table, the tube, the detector and the three standing positions.',
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
