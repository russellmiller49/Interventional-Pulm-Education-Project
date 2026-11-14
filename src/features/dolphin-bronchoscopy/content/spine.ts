import type { SpineStopId } from './types'

/**
 * The passage: the module's spine.
 *
 * Blowhole to numbered branch, in the order the scope meets each place. Every section lights the
 * stops it teaches; the procedure sections lay the timeline over the same stops. `abbrs` are the
 * centerline labels of the CT case that belong to the stop, so a scope location maps to a stop.
 */
export interface SpineStop {
  readonly id: SpineStopId
  readonly name: string
  /** One line on what the scope meets here. */
  readonly note: string
  readonly abbrs: readonly string[]
}

export const DOLPHIN_SPINE: readonly SpineStop[] = [
  {
    id: 'blowhole',
    name: 'Blowhole',
    note: 'The single external opening, closed at rest by the nasal plugs.',
    abbrs: [],
  },
  {
    id: 'nasal-passage',
    name: 'Bony nasal passage',
    note: 'Left and right passages through the skull, below the plugs.',
    abbrs: ['LNP', 'RNP'],
  },
  {
    id: 'nasopharynx',
    name: 'Nasopharynx',
    note: 'The chamber the laryngeal spout rises into, with a blind fornix on each side.',
    abbrs: ['NPX', 'NPF'],
  },
  {
    id: 'spout',
    name: 'Laryngeal spout and glottis',
    note: 'The goosebeak; the glottis opens at its tip.',
    abbrs: ['LS'],
  },
  {
    id: 'larynx',
    name: 'Larynx',
    note: 'The cavity inside the spout, down to the trachea.',
    abbrs: ['LX'],
  },
  {
    id: 'trachea',
    name: 'Trachea',
    note: 'Short and wide, with complete cartilage rings.',
    abbrs: ['TRA'],
  },
  {
    id: 'tracheal-bronchus',
    name: 'Right tracheal bronchus',
    note: 'Leaves the right wall of the trachea above the carina.',
    abbrs: ['RTB', 'RT1', 'RT2', 'RT3'],
  },
  {
    id: 'carina',
    name: 'Carina',
    note: 'Where the trachea divides into the two main bronchi.',
    abbrs: [],
  },
  {
    id: 'main-bronchi',
    name: 'Main bronchi and numbered branches',
    note: 'Right and left main bronchi, their branches numbered in order from the carina.',
    abbrs: ['RMB', 'LMB'],
  },
]

export const spineStopById = new Map(DOLPHIN_SPINE.map((stop) => [stop.id, stop] as const))

/** The stop a centerline label belongs to. Numbered branches belong to the main bronchi. */
export function spineStopOfAbbr(abbr: string): SpineStop | null {
  if (/^[RL]B\d+$/.test(abbr)) return spineStopById.get('main-bronchi') ?? null
  return DOLPHIN_SPINE.find((stop) => stop.abbrs.includes(abbr)) ?? null
}
