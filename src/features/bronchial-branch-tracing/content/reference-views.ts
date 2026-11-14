import {
  turnCt,
  STANDARD_ORIENTATION,
  type CtOrientation,
  type OrientationOperation,
} from '../geometry/orientation'

/**
 * Which CT views help with each segmental bronchus, after Mortimer & Saghaie, Figure 2, and the
 * optional image transformation from their step 2. Paraphrased; the figure groups the segments
 * and the text gives the reasons.
 *
 * Keys are the segmental bronchus codes used by `segment.bronchusCode` in
 * public/branch-tracing/targets-v1/manifest.json. The suggestion is a starting point the learner
 * may take or leave; nothing here is graded.
 */
export const REFERENCE_VIEWS_SOURCE = {
  citation:
    'Mortimer N, Saghaie T. Lost in navigation: a simplified CT-based airway mapping method for ultrathin navigational bronchoscopy. J Clin Med 2025;14:8009. doi:10.3390/jcm14228009',
  title:
    'Mortimer & Saghaie. Lost in Navigation: a simplified CT-based airway mapping method (2025)',
  url: 'https://doi.org/10.3390/jcm14228009',
  figure: 'Figure 2',
} as const

export type ReconstructionPlane = 'coronal' | 'sagittal'
export type SuggestedView = 'axial' | ReconstructionPlane

export interface SegmentReferenceViews {
  code: string
  side: 'right' | 'left'
  /** Axial always comes first; at most one reconstruction is added beside it. */
  views: readonly SuggestedView[]
  reconstruction: ReconstructionPlane | null
  /** Why this combination, in one sentence. */
  reason: string
  /** The optional turn of the axial image, in the bench's own operations, applied in order. */
  turn: readonly OrientationOperation[]
  /** Where the turn above ends, from standard axial. */
  turned: CtOrientation
  turnHint: string
  /** The apical upper-lobe segments, where some readers also flip the image top to bottom. */
  verticalFlipMayHelp: boolean
}

const CORONAL = ['RB3', 'RB5', 'RB6', 'LB3', 'LB6'] as const
const SAGITTAL = ['RB2', 'RB4', 'LB4', 'LB5'] as const
const AXIAL_ONLY = ['RB1', 'RB7', 'RB8', 'RB9', 'RB10', 'LB1+2', 'LB8', 'LB9', 'LB10'] as const
const APICAL = new Set<string>(['RB1', 'LB1+2'])

/** Figure 2, as printed: the segments under each combination of views. */
export const FIGURE_2_GROUPS = {
  'axial + coronal': CORONAL,
  'axial + sagittal': SAGITTAL,
  'axial alone': AXIAL_ONLY,
} as const

const REASONS: Record<ReconstructionPlane | 'axial', string> = {
  coronal:
    'This segment runs forward or back, so a coronal plane cuts it across and shows its branches side by side.',
  sagittal:
    'This segment runs out toward the chest wall, so a sagittal plane cuts it across and shows its branches side by side.',
  axial:
    'This segment runs up toward the apex or down toward the base, so the axial slices already cut it across.',
}

/**
 * Step 2 of the method, optional: flip the axial image left to right, as the scope sees the airway
 * from the trachea, then turn it 90° counterclockwise for a right-sided lesion or clockwise for a
 * left-sided one, as the scope rolls into that main bronchus.
 */
export const TRANSFORM_HINT = {
  optional:
    'Turning the CT is optional. What matters is keeping track of the anatomical directions on its edges.',
  right: 'Flip the axial image left to right, then turn it 90° counterclockwise.',
  left: 'Flip the axial image left to right, then turn it 90° clockwise.',
  apical: 'For an apical upper-lobe segment, flipping the image top to bottom may also help.',
} as const

function entry(code: string, reconstruction: ReconstructionPlane | null): SegmentReferenceViews {
  const side = code.startsWith('R') ? 'right' : 'left'
  const turn: OrientationOperation[] = ['flip', side === 'right' ? 'left' : 'right']
  const apical = APICAL.has(code)
  return {
    code,
    side,
    views: reconstruction ? ['axial', reconstruction] : ['axial'],
    reconstruction,
    reason: REASONS[reconstruction ?? 'axial'],
    turn,
    turned: turn.reduce(turnCt, STANDARD_ORIENTATION),
    turnHint: [TRANSFORM_HINT[side], apical ? TRANSFORM_HINT.apical : ''].filter(Boolean).join(' '),
    verticalFlipMayHelp: apical,
  }
}

export const REFERENCE_VIEWS: Readonly<Record<string, SegmentReferenceViews>> = Object.fromEntries([
  ...CORONAL.map((code) => [code, entry(code, 'coronal')] as const),
  ...SAGITTAL.map((code) => [code, entry(code, 'sagittal')] as const),
  ...AXIAL_ONLY.map((code) => [code, entry(code, null)] as const),
])

/** The suggestion for a segmental bronchus code such as 'RB3' or 'LB1+2'; undefined if unknown. */
export function referenceViewsFor(bronchusCode: string): SegmentReferenceViews | undefined {
  return REFERENCE_VIEWS[bronchusCode]
}

/** "RB3: axial plus coronal." — the short hint line for a segment. */
export function referenceViewsLine(bronchusCode: string): string | undefined {
  const views = referenceViewsFor(bronchusCode)
  if (!views) return undefined
  return `${views.code}: ${views.reconstruction ? `axial plus ${views.reconstruction}` : 'axial alone'}.`
}
