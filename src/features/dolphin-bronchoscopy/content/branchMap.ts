import type { DolphinSourceId } from '../data/sources'

/**
 * The branch map: every named airway below the larynx, as the NMMP/NMMF guide names it, with what
 * this module's CT shows and what varies across the ten-animal mapping series.
 *
 * `thisCt` is copied from `public/airway-anatomy/dolphin-001/metadata/geometry-review.json`
 * (`LMBBranches`, `RMBBranches`, `trachealBronchusDivisions`) and checked against it and against
 * `centerline_labels.json` by `branch-map.test.ts`. Names deliberately carry no direction: the
 * number counts order from the carina, because direction varies between animals.
 *
 * Variation is taught as counts with its basis (ten dolphins, five of each sex, mapped from CT;
 * work in preparation), never as percentages. The data sheet records that its CTs were flipped
 * horizontally before reading; the owner is confirming sides.
 */
export type BranchSide = 'right' | 'left' | 'midline'

export interface BranchMapEntry {
  readonly id: string
  readonly abbr: string
  readonly side: BranchSide
  /** The branch number off its main bronchus or the tracheal bronchus. */
  readonly number?: number
  /** The airway it leaves. */
  readonly parent: string | null
  readonly guideName: string
  readonly thisCt: {
    readonly present: boolean
    readonly edgeId?: number
    /** Path length from the carina to the branch origin, along the main bronchus. */
    readonly fromCarinaMm?: number
    /** The computed direction of the branch on this CT. */
    readonly direction?: string
  }
  /** The branch it arises with on this CT, when the two origins lie within 10 mm. */
  readonly arisesWith?: string
  readonly variation: { readonly note: string; readonly basis: 'nmmp-2026-n10' | 'this-ct' }
  readonly sourceIds: readonly DolphinSourceId[]
}

const MAPPING = ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'] as const
const VARIES = {
  note: 'Direction varies between animals; the number counts order from the carina.',
  basis: 'nmmp-2026-n10',
} as const

function branch(
  side: 'right' | 'left',
  number: number,
  thisCt: BranchMapEntry['thisCt'],
  extra: Partial<Pick<BranchMapEntry, 'arisesWith' | 'variation'>> = {},
): BranchMapEntry {
  const prefix = side === 'right' ? 'RB' : 'LB'
  return {
    id: `${prefix.toLowerCase()}${number}`,
    abbr: `${prefix}${number}`,
    side,
    number,
    parent: side === 'right' ? 'RMB' : 'LMB',
    guideName: `${side === 'right' ? 'Right' : 'Left'} main bronchus, branch ${number}`,
    thisCt,
    variation: extra.variation ?? VARIES,
    ...(extra.arisesWith ? { arisesWith: extra.arisesWith } : {}),
    sourceIds: [...MAPPING],
  }
}

export const DOLPHIN_BRANCH_MAP: readonly BranchMapEntry[] = [
  {
    id: 'tra',
    abbr: 'TRA',
    side: 'midline',
    parent: 'LX',
    guideName: 'Trachea',
    thisCt: { present: true, edgeId: 5 },
    variation: {
      note: 'Complete cartilage rings; short and wide. The same in every dolphin mapped.',
      basis: 'nmmp-2026-n10',
    },
    sourceIds: ['tsang-2002', 'ivancic-2014', 'nmmp-mapping-2026'],
  },
  {
    id: 'rtb',
    abbr: 'RTB',
    side: 'right',
    parent: 'TRA',
    guideName: 'Right tracheal bronchus',
    thisCt: { present: true, edgeId: 7 },
    variation: {
      note: 'Leaves the right wall of the trachea above the carina in all ten dolphins mapped.',
      basis: 'nmmp-2026-n10',
    },
    sourceIds: ['nmmp-mapping-2026', 'ivancic-2014', 'tsang-2002'],
  },
  ...(
    [
      ['rt1', 'RT1', 1, 11, 'Cranial division'],
      ['rt2', 'RT2', 2, 16, 'Caudal division, side branch'],
      ['rt3', 'RT3', 3, 17, 'Caudal division'],
    ] as const
  ).map(
    ([id, abbr, number, edgeId, name]): BranchMapEntry => ({
      id,
      abbr,
      side: 'right',
      number,
      parent: 'RTB',
      guideName: `Right tracheal bronchus, division ${number} (${name.toLowerCase()})`,
      thisCt: { present: true, edgeId },
      variation: {
        note: 'Tsang describes three subsegments of the tracheal bronchus; this CT shows three divisions.',
        basis: 'this-ct',
      },
      sourceIds: ['tsang-2002', 'nmmp-bronchoscopy-guide', 'dolphin-001-ct'],
    }),
  ),
  {
    id: 'rmb',
    abbr: 'RMB',
    side: 'right',
    parent: 'TRA',
    guideName: 'Right main bronchus',
    thisCt: { present: true, edgeId: 9 },
    variation: { note: 'The same in all ten dolphins mapped.', basis: 'nmmp-2026-n10' },
    sourceIds: ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide'],
  },
  {
    id: 'lmb',
    abbr: 'LMB',
    side: 'left',
    parent: 'TRA',
    guideName: 'Left main bronchus',
    thisCt: { present: true, edgeId: 8 },
    variation: { note: 'The same in all ten dolphins mapped.', basis: 'nmmp-2026-n10' },
    sourceIds: ['nmmp-mapping-2026', 'nmmp-bronchoscopy-guide'],
  },
  branch(
    'right',
    1,
    { present: true, edgeId: 15, fromCarinaMm: 110.6, direction: 'Dorsolateral' },
    {
      variation: { note: 'Dorsolateral in all ten dolphins mapped.', basis: 'nmmp-2026-n10' },
    },
  ),
  branch(
    'right',
    2,
    { present: true, edgeId: 45, fromCarinaMm: 156.2, direction: 'Lateral' },
    {
      arisesWith: 'RB3',
      variation: {
        note: 'Arose together with RB3 in 4 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'right',
    3,
    { present: true, edgeId: 24, fromCarinaMm: 147.5, direction: 'Dorsal' },
    {
      arisesWith: 'RB2',
      variation: {
        note: 'Arose together with RB2 in 4 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'right',
    4,
    { present: true, edgeId: 83, fromCarinaMm: 188.8, direction: 'Lateral' },
    {
      arisesWith: 'RB5',
      variation: {
        note: 'Arose together with RB5 in 2 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'right',
    5,
    { present: true, edgeId: 64, fromCarinaMm: 183.1, direction: 'Dorsal' },
    {
      arisesWith: 'RB4',
      variation: {
        note: 'Arose together with RB4 in 2 of the 10 dolphins mapped, and with RB6 in 1. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'right',
    6,
    { present: true, edgeId: 97, fromCarinaMm: 219.7, direction: 'Lateral' },
    {
      variation: {
        note: 'Arose together with RB5 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch('right', 7, { present: true, edgeId: 104, fromCarinaMm: 238.6, direction: 'Dorsomedial' }),
  branch('right', 8, { present: true, edgeId: 111, fromCarinaMm: 259.4, direction: 'Lateral' }),
  branch(
    'right',
    9,
    { present: true, edgeId: 123, fromCarinaMm: 290.9, direction: 'Lateral' },
    { arisesWith: 'RB10' },
  ),
  branch(
    'right',
    10,
    { present: true, edgeId: 116, fromCarinaMm: 283.2, direction: 'Medial' },
    { arisesWith: 'RB9' },
  ),
  branch('right', 11, { present: true, edgeId: 126, fromCarinaMm: 297.8, direction: 'Dorsal' }),
  branch('right', 12, { present: true, edgeId: 130, fromCarinaMm: 315.3, direction: 'Medial' }),
  branch('right', 13, { present: true, edgeId: 135, fromCarinaMm: 327.1, direction: 'Lateral' }),
  branch(
    'right',
    14,
    { present: false },
    {
      variation: {
        note: 'Recorded in the ten-animal series, most often dorsal (3 of 10) or lateral (2 of 10). Not traced on this module’s CT, which shows 13 branches on the right.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    1,
    { present: true, edgeId: 12, fromCarinaMm: 55.2, direction: 'Lateral' },
    {
      variation: {
        note: 'Lateral in all 5 females; dorsolateral in all 5 males.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch('left', 2, { present: true, edgeId: 22, fromCarinaMm: 118.6, direction: 'Dorsal' }),
  branch('left', 3, { present: true, edgeId: 40, fromCarinaMm: 159.3, direction: 'Lateral' }),
  branch(
    'left',
    4,
    { present: true, edgeId: 63, fromCarinaMm: 183.5, direction: 'Dorsomedial' },
    {
      arisesWith: 'LB5',
      variation: {
        note: 'Arose together with LB5 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    5,
    { present: true, edgeId: 78, fromCarinaMm: 188.2, direction: 'Dorsolateral' },
    {
      arisesWith: 'LB4',
      variation: {
        note: 'Arose together with LB4 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    6,
    { present: true, edgeId: 92, fromCarinaMm: 213.6, direction: 'Lateral' },
    {
      variation: {
        note: 'Arose together with LB7 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    7,
    { present: true, edgeId: 101, fromCarinaMm: 235.2, direction: 'Medial' },
    {
      variation: {
        note: 'Arose together with LB6 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    8,
    { present: true, edgeId: 106, fromCarinaMm: 252.1, direction: 'Lateral' },
    {
      variation: {
        note: 'Arose together with LB9 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    9,
    { present: true, edgeId: 115, fromCarinaMm: 275.6, direction: 'Dorsomedial' },
    {
      variation: {
        note: 'Arose together with LB8 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    10,
    { present: true, edgeId: 120, fromCarinaMm: 292.6, direction: 'Lateral' },
    {
      variation: {
        note: 'Lateral in all 5 females; in the 5 males, lateral in 2, dorsomedial in 2, ventral in 1.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    11,
    { present: true, edgeId: 124, fromCarinaMm: 319.1, direction: 'Lateral' },
    {
      variation: {
        note: 'Arose together with LB12 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch(
    'left',
    12,
    { present: true, edgeId: 129, fromCarinaMm: 338.7, direction: 'Medial' },
    {
      variation: {
        note: 'Arose together with LB11 in 1 of the 10 dolphins mapped. Direction varies.',
        basis: 'nmmp-2026-n10',
      },
    },
  ),
  branch('left', 13, { present: true, edgeId: 132, fromCarinaMm: 354.5, direction: 'Lateral' }),
  branch('left', 14, { present: true, edgeId: 137, fromCarinaMm: 374.0, direction: 'Medial' }),
]

export const branchMapByAbbr: ReadonlyMap<string, BranchMapEntry> = new Map(
  DOLPHIN_BRANCH_MAP.map((entry) => [entry.abbr, entry] as const),
)

/** The numbered branches of one main bronchus, in order from the carina on this CT. */
export function branchesInCtOrder(side: 'right' | 'left'): readonly BranchMapEntry[] {
  return DOLPHIN_BRANCH_MAP.filter(
    (entry) =>
      entry.side === side &&
      entry.number !== undefined &&
      entry.parent?.endsWith('MB') &&
      entry.thisCt.present,
  ).sort((a, b) => (a.thisCt.fromCarinaMm ?? 0) - (b.thisCt.fromCarinaMm ?? 0))
}

/** "The next opening is LB4, dorsomedial, 24 mm on" — the hint a drill gives after a wrong turn. */
export function nextOpeningHint(target: string): string | null {
  const entry = branchMapByAbbr.get(target)
  if (!entry || !entry.thisCt.present) return null
  const direction = entry.thisCt.direction
    ? `, ${entry.thisCt.direction.toLowerCase()} on this CT`
    : ''
  return `${entry.abbr} leaves the ${entry.parent === 'RMB' ? 'right' : entry.parent === 'LMB' ? 'left' : ''} ${entry.parent === 'RTB' ? 'tracheal bronchus' : 'main bronchus'}${direction}`.replace(
    '  ',
    ' ',
  )
}
