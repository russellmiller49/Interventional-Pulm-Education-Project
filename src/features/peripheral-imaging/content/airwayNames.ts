/**
 * The bronchi the course names on its own CT: trachea to segmental bronchi.
 *
 * The names on the tree come from the segment surfaces of the same patient
 * (`scripts/peripheral-imaging/build-airway-tree.ts`); this file is the vocabulary: what each key
 * is called, which lobe and side it belongs to, and which bronchus a group of segments shares.
 */
export type AirwayLobeKey = 'RUL' | 'RML' | 'RLL' | 'LUL' | 'LLL'

export type AirwaySegmentKey =
  | 'RB1'
  | 'RB2'
  | 'RB3'
  | 'RB4'
  | 'RB5'
  | 'RB6'
  | 'RB7'
  | 'RB8'
  | 'RB9'
  | 'RB10'
  | 'LB1+2'
  | 'LB3'
  | 'LB4'
  | 'LB5'
  | 'LB6'
  | 'LB7+8'
  | 'LB9'
  | 'LB10'

export type AirwayCentralKey =
  | 'trachea'
  | 'RMB'
  | 'LMB'
  | 'BI'
  | 'RUL-bronchus'
  | 'RML-bronchus'
  | 'RLL-bronchus'
  | 'LUL-bronchus'
  | 'LUL-upper-division'
  | 'LUL-lingula'
  | 'LLL-bronchus'

export type AirwayBranchKey = AirwayCentralKey | AirwaySegmentKey

export interface AirwayBranchName {
  /** What the bronchus is called in running text and on a label. */
  readonly name: string
  /** The short label drawn beside it on an image. */
  readonly short: string
  readonly level: 'central' | 'lobar' | 'segment'
  readonly side: 'right' | 'left' | 'midline'
  readonly lobe?: AirwayLobeKey
}

export const AIRWAY_LOBES: Readonly<
  Record<AirwayLobeKey, { name: string; side: 'right' | 'left' }>
> = {
  RUL: { name: 'Right upper lobe', side: 'right' },
  RML: { name: 'Right middle lobe', side: 'right' },
  RLL: { name: 'Right lower lobe', side: 'right' },
  LUL: { name: 'Left upper lobe', side: 'left' },
  LLL: { name: 'Left lower lobe', side: 'left' },
}

export const AIRWAY_LOBE_KEYS = Object.keys(AIRWAY_LOBES) as AirwayLobeKey[]

const segment = (short: AirwaySegmentKey, name: string, lobe: AirwayLobeKey): AirwayBranchName => ({
  name,
  short,
  level: 'segment',
  side: AIRWAY_LOBES[lobe].side,
  lobe,
})

export const AIRWAY_BRANCHES: Readonly<Record<AirwayBranchKey, AirwayBranchName>> = {
  trachea: { name: 'Trachea', short: 'Trachea', level: 'central', side: 'midline' },
  RMB: { name: 'Right main bronchus', short: 'RMB', level: 'central', side: 'right' },
  LMB: { name: 'Left main bronchus', short: 'LMB', level: 'central', side: 'left' },
  BI: { name: 'Bronchus intermedius', short: 'BI', level: 'central', side: 'right' },
  'RUL-bronchus': {
    name: 'Right upper lobe bronchus',
    short: 'RUL',
    level: 'lobar',
    side: 'right',
    lobe: 'RUL',
  },
  'RML-bronchus': {
    name: 'Right middle lobe bronchus',
    short: 'RML',
    level: 'lobar',
    side: 'right',
    lobe: 'RML',
  },
  'RLL-bronchus': {
    name: 'Right lower lobe bronchus',
    short: 'RLL',
    level: 'lobar',
    side: 'right',
    lobe: 'RLL',
  },
  'LUL-bronchus': {
    name: 'Left upper lobe bronchus',
    short: 'LUL',
    level: 'lobar',
    side: 'left',
    lobe: 'LUL',
  },
  'LUL-upper-division': {
    name: 'Left upper lobe, upper division bronchus',
    short: 'Upper division',
    level: 'lobar',
    side: 'left',
    lobe: 'LUL',
  },
  'LUL-lingula': {
    name: 'Lingular bronchus',
    short: 'Lingula',
    level: 'lobar',
    side: 'left',
    lobe: 'LUL',
  },
  'LLL-bronchus': {
    name: 'Left lower lobe bronchus',
    short: 'LLL',
    level: 'lobar',
    side: 'left',
    lobe: 'LLL',
  },
  RB1: segment('RB1', 'Apical segmental bronchus (RB1)', 'RUL'),
  RB2: segment('RB2', 'Posterior segmental bronchus (RB2)', 'RUL'),
  RB3: segment('RB3', 'Anterior segmental bronchus (RB3)', 'RUL'),
  RB4: segment('RB4', 'Lateral segmental bronchus (RB4)', 'RML'),
  RB5: segment('RB5', 'Medial segmental bronchus (RB5)', 'RML'),
  RB6: segment('RB6', 'Superior segmental bronchus (RB6)', 'RLL'),
  RB7: segment('RB7', 'Medial basal segmental bronchus (RB7)', 'RLL'),
  RB8: segment('RB8', 'Anterior basal segmental bronchus (RB8)', 'RLL'),
  RB9: segment('RB9', 'Lateral basal segmental bronchus (RB9)', 'RLL'),
  RB10: segment('RB10', 'Posterior basal segmental bronchus (RB10)', 'RLL'),
  'LB1+2': segment('LB1+2', 'Apicoposterior segmental bronchus (LB1+2)', 'LUL'),
  LB3: segment('LB3', 'Anterior segmental bronchus (LB3)', 'LUL'),
  LB4: segment('LB4', 'Superior lingular segmental bronchus (LB4)', 'LUL'),
  LB5: segment('LB5', 'Inferior lingular segmental bronchus (LB5)', 'LUL'),
  LB6: segment('LB6', 'Superior segmental bronchus (LB6)', 'LLL'),
  'LB7+8': segment('LB7+8', 'Anteromedial basal segmental bronchus (LB7+8)', 'LLL'),
  LB9: segment('LB9', 'Lateral basal segmental bronchus (LB9)', 'LLL'),
  LB10: segment('LB10', 'Posterior basal segmental bronchus (LB10)', 'LLL'),
}

export const AIRWAY_BRANCH_KEYS = Object.keys(AIRWAY_BRANCHES) as AirwayBranchKey[]

export const isAirwayBranchKey = (value: unknown): value is AirwayBranchKey =>
  typeof value === 'string' && value in AIRWAY_BRANCHES

const UPPER_DIVISION: readonly AirwaySegmentKey[] = ['LB1+2', 'LB3']
const LINGULA: readonly AirwaySegmentKey[] = ['LB4', 'LB5']

/**
 * The bronchus that leads to exactly these segments and to no other lobe, or null when they span
 * lobes (a main bronchus or the bronchus intermedius, which the segment surfaces name themselves).
 */
export function lobeOfSegments(segments: readonly AirwayBranchKey[]): AirwayCentralKey | null {
  const lobes = new Set(segments.map((key) => AIRWAY_BRANCHES[key].lobe))
  if (lobes.size !== 1) return null
  const [lobe] = lobes
  if (!lobe) return null
  if (lobe === 'LUL') {
    const within = (group: readonly AirwaySegmentKey[]) =>
      segments.every((key) => (group as readonly string[]).includes(key))
    if (within(UPPER_DIVISION)) return 'LUL-upper-division'
    if (within(LINGULA)) return 'LUL-lingula'
  }
  return `${lobe}-bronchus`
}
