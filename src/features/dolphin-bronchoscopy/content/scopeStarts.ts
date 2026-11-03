import type { ScopeStartId } from './types'

/**
 * Named places a scope lab can start from, on the CT case's centerline graph.
 *
 * Edge ids and distances come from `public/airway-anatomy/dolphin-001/metadata/geometry-review.json`
 * (central path edges 0, 1, 3, 4, 5, 6; carina node 7; main bronchus edges 8 and 9) and are checked
 * against `centerline_labels.json` by `scope-starts.test.ts`, so a rebuilt case that renumbers its
 * edges fails a test instead of starting a lesson in the wrong place.
 */
export interface ScopeStart {
  readonly id: ScopeStartId
  readonly edgeId: number
  readonly distanceMm: number
  /** The centerline label the start must sit on. */
  readonly abbr: string
  /** What the learner sees first, in one line. */
  readonly description: string
}

export const DOLPHIN_SCOPE_STARTS: Readonly<Record<ScopeStartId, ScopeStart>> = {
  naris: {
    id: 'naris',
    edgeId: 0,
    distanceMm: 4,
    abbr: 'LNP',
    description: 'In the left bony nasal passage, just below the closed nasal plugs.',
  },
  nasopharynx: {
    id: 'nasopharynx',
    edgeId: 1,
    distanceMm: 4,
    abbr: 'NPX',
    description: 'At the top of the nasopharynx, looking down the chamber.',
  },
  'spout-approach': {
    id: 'spout-approach',
    edgeId: 1,
    distanceMm: 39,
    abbr: 'NPX',
    description: 'At the foot of the nasopharynx, facing the tip of the laryngeal spout.',
  },
  larynx: {
    id: 'larynx',
    edgeId: 4,
    distanceMm: 4,
    abbr: 'LX',
    description: 'Just inside the larynx, below the spout.',
  },
  'trachea-mid': {
    id: 'trachea-mid',
    edgeId: 5,
    distanceMm: 40,
    abbr: 'TRA',
    description: 'In the upper trachea, above the tracheal bronchus.',
  },
  carina: {
    id: 'carina',
    edgeId: 6,
    distanceMm: 50,
    abbr: 'TRA',
    description: 'In the lower trachea, facing the carina.',
  },
  'rmb-origin': {
    id: 'rmb-origin',
    edgeId: 9,
    distanceMm: 4,
    abbr: 'RMB',
    description: 'Just inside the right main bronchus.',
  },
  'lmb-origin': {
    id: 'lmb-origin',
    edgeId: 8,
    distanceMm: 4,
    abbr: 'LMB',
    description: 'Just inside the left main bronchus.',
  },
}
