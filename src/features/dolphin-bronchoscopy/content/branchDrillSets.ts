/**
 * The find-the-branch drill sets. Tiers group the CT case's labels by how far down the passage
 * they are; the fornix (NPF) is never a target — it is a place to stay out of.
 */
export type DrillTier = 'passage' | 'landmark' | 'near-branch' | 'far-branch'

export function drillTierOf(abbr: string): DrillTier | null {
  if (['LNP', 'RNP', 'NPX', 'LS', 'LX', 'TRA'].includes(abbr)) return 'passage'
  if (['RTB', 'RT1', 'RT2', 'RT3', 'RMB', 'LMB'].includes(abbr)) return 'landmark'
  const match = /^([RL])B(\d+)$/.exec(abbr)
  if (!match) return null
  return Number(match[2]) <= 5 ? 'near-branch' : 'far-branch'
}

export interface DrillSet {
  readonly id: string
  readonly title: string
  readonly description: string
  /** Where each target is driven from. */
  readonly start: 'naris' | 'trachea-mid' | 'carina' | 'rmb-origin' | 'lmb-origin'
  readonly targets: readonly string[]
}

const range = (side: 'R' | 'L', from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${side}B${from + i}`)

export const DOLPHIN_DRILL_SETS: readonly DrillSet[] = [
  {
    id: 'passage',
    title: 'The passage',
    description: 'From the naris to the trachea, through the right opening at each fork.',
    start: 'naris',
    targets: ['NPX', 'LS', 'LX', 'TRA'],
  },
  {
    id: 'landmarks',
    title: 'The landmarks below the larynx',
    description: 'The tracheal bronchus and its divisions, and the two main bronchi.',
    start: 'trachea-mid',
    targets: ['RTB', 'RT1', 'RT3', 'RMB', 'LMB'],
  },
  {
    id: 'near-branches',
    title: 'The first five on each side',
    description: 'Branches 1 to 5 of each main bronchus, counted from the carina.',
    start: 'carina',
    // Branches that leave in order on this CT come first. RB3 leaves 9 mm before RB2, and RB5
    // before RB4, so those pairs come last, where the overlay's map line tells them apart.
    targets: ['RB1', 'LB1', 'LB2', 'LB3', 'LB4', 'LB5', 'RB2', 'RB3', 'RB4', 'RB5'],
  },
  {
    id: 'far-branches',
    title: 'Further down',
    description: 'Branches 6 and beyond, where counting matters most.',
    start: 'carina',
    targets: [...range('R', 6, 13), ...range('L', 6, 14)],
  },
  {
    id: 'right-side',
    title: 'The right side',
    description: 'The tracheal bronchus and every numbered branch of the right main bronchus.',
    start: 'trachea-mid',
    targets: ['RTB', 'RMB', ...range('R', 1, 13)],
  },
  {
    id: 'left-side',
    title: 'The left side',
    description: 'Every numbered branch of the left main bronchus.',
    start: 'carina',
    targets: ['LMB', ...range('L', 1, 14)],
  },
]

export const dolphinDrillSetById: ReadonlyMap<string, DrillSet> = new Map(
  DOLPHIN_DRILL_SETS.map((set) => [set.id, set] as const),
)

const UPPER_PASSAGE = ['LNP', 'RNP', 'NPX', 'LS', 'LX', 'TRA'] as const

/**
 * The labels on the way from the naris to a target: entering any other label is a turn off the
 * passage to it. Static, from the guide's naming, so the drill needs no graph.
 */
export function passageToTarget(target: string): readonly string[] {
  if (/^RT\d$/.test(target)) return [...UPPER_PASSAGE, 'RTB', target]
  if (target === 'RTB' || target === 'RMB' || target === 'LMB') return [...UPPER_PASSAGE, target]
  const match = /^([RL])B\d+$/.exec(target)
  if (match) return [...UPPER_PASSAGE, `${match[1]}MB`, target]
  const index = UPPER_PASSAGE.indexOf(target as (typeof UPPER_PASSAGE)[number])
  return index >= 0 ? UPPER_PASSAGE.slice(0, index + 1) : [target]
}
