import type { BronchWorkspace } from '../content/types'

/**
 * A CT slice beside a camera still: the two-image comparison the media workspace lays out.
 *
 * No section of the rewritten course uses a pair (the section that did, `reference-frames`, is
 * retired), but the layout is still part of `MediaWorkspace`. The tests of its side-by-side frame,
 * its enlarge sizing and its notes use this pair.
 */
export const COMPARISON_WORKSPACE = {
  kind: 'media',
  media: [
    { kind: 'ct-slice', structureId: 'rmb', plane: 'axial' },
    { kind: 'endoscopic-still', structureId: 'rmb', outline: false },
  ],
  caption: 'An axial CT slice beside a camera still looking down the right main bronchus',
  mediaNotes: [
    'Axial CT, shown as if viewed from the patient’s feet. The letters at its edges name the patient’s directions.',
    'Camera still looking down the right main bronchus. The camera roll was not recorded.',
  ],
  comparisonNote: 'Two views to compare. They are not one patient’s matched study.',
} as const satisfies Extract<BronchWorkspace, { kind: 'media' }>
