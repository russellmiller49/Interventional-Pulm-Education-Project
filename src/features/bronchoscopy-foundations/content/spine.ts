import type { AirwayLabel } from '../components/scope/types'
import type { ClaimClass, SourceRef } from '../data/sources'

/**
 * The spine: the airway from the larynx to the segmental bronchi, drawn once on the airway map in
 * the Simulator panel and lit one stop at a time. Every airway term is introduced at its stop.
 *
 * Each stop: the plain name, the precise statement, one analogy as an aid (never the label), a
 * labelled checklist of at most four items, and its sources. `spineCaption` is the only place a
 * stop number is printed, so no other surface adds a second "N of M".
 */
export const SPINE_STOP_IDS = [
  'larynx',
  'trachea',
  'carina',
  'main-bronchi',
  'lobar',
  'segmental',
] as const

export type SpineStopId = (typeof SPINE_STOP_IDS)[number]

export interface SpineStop {
  readonly id: SpineStopId
  readonly title: string
  readonly precise: string
  readonly analogy: string
  readonly checklistLabel: string
  readonly checklist: readonly string[]
  /** The airways the map lights when this stop is current. */
  readonly airways: readonly AirwayLabel[]
  readonly claimClass: ClaimClass
  readonly sourceRefs: readonly SourceRef[]
}

export const SPINE_STOPS: readonly SpineStop[] = [
  {
    id: 'larynx',
    title: 'The larynx and glottis',
    precise:
      'The epiglottis, the arytenoid region, the false vocal folds above and the true vocal folds below. The glottis is the opening between the true folds; the subglottis lies beneath it. The true folds abduct with inspiration and adduct with phonation.',
    analogy: 'A gateway with two sets of doors, the inner pair opening as the patient breathes in.',
    checklistLabel: 'What to identify before crossing',
    checklist: [
      'The epiglottis',
      'The arytenoid region',
      'The false and the true vocal folds',
      'The opening between the true folds',
    ],
    airways: [],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 51, to: 65 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
    ],
  },
  {
    id: 'trachea',
    title: 'The trachea',
    precise:
      'Cartilage rings support the anterior and lateral walls; the flat membranous wall runs posteriorly. The trachea curves, so a scope advanced as though through a straight pipe meets its wall.',
    analogy: 'A ringed hose with one flat side — and the flat side is the back.',
    checklistLabel: 'Your reference in the trachea',
    checklist: [
      'The cartilage rings',
      'The posterior membranous wall',
      'The midline course',
      'The main carina ahead',
    ],
    airways: ['TR'],
    claimClass: 'source',
    sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } }],
  },
  {
    id: 'carina',
    title: 'The main carina',
    precise:
      'The main carina divides the right and left main bronchi. Stop far enough above it to see both origins before entering either; this is the reference you return to whenever you are uncertain.',
    analogy: 'A fork in the road, read from far enough back to see both signs.',
    checklistLabel: 'At the carina',
    checklist: [
      'Both main bronchial origins in view',
      'The posterior membranous wall',
      'Which side is which, from landmarks rather than the screen edge',
      'The place to come back to when uncertain',
    ],
    airways: ['TR', 'RMSB', 'LMSB'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
    ],
  },
  {
    id: 'main-bronchi',
    title: 'The main bronchi',
    precise:
      'The right main bronchus is short before the right upper lobe takeoff; beyond that origin the bronchus intermedius continues toward the middle and lower lobes. The left main bronchus is longer and divides into the upper and lower lobes.',
    analogy: 'Two hallways of different length; the right one opens a side door almost at once.',
    checklistLabel: 'What distinguishes the two sides',
    checklist: [
      'The short right main bronchus',
      'The early right upper lobe takeoff',
      'The bronchus intermedius — a bronchus, not a lobe',
      'The longer left main bronchus',
    ],
    airways: ['RMSB', 'BI', 'LMSB'],
    claimClass: 'source',
    sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } }],
  },
  {
    id: 'lobar',
    title: 'The lobar bronchi',
    precise:
      'Five lobes: right upper, middle and lower; left upper, with its upper division and the lingula, and left lower. The lingula belongs to the left upper lobe. The superior segment of each lower lobe belongs to that lower lobe, however near the middle lobe or lingula it appears.',
    analogy:
      'Branches are named for the limb they grow from, not for where they appear on the screen.',
    checklistLabel: 'Parentage first',
    checklist: [
      'Name the parent before the daughter',
      'The lingula is part of the left upper lobe',
      'The superior segments belong to the lower lobes',
      'The bronchus intermedius is not a lobe',
    ],
    airways: ['RUL', 'RML', 'RLL', 'LUL', 'LUL-UD', 'LB4+5', 'LLL'],
    claimClass: 'source',
    sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } }],
  },
  {
    id: 'segmental',
    title: 'The segmental bronchi',
    precise:
      'Eighteen segmental bronchi in this teaching profile, named by parent and number. On the right, B4 is lateral and B5 medial; on the left, B4 is superior lingular and B5 inferior lingular. The left anteromedial basal bronchus is taught as one combined LB7+8, a declared convention rather than universal anatomy.',
    analogy:
      'Street addresses: the lobe is the street and the number the house — and the same number names a different house on each side.',
    checklistLabel: 'Naming a segment',
    checklist: [
      'Name the parent lobe first',
      'Right B4 is lateral; right B5 is medial',
      'Left B4 is superior lingular; left B5 is inferior lingular',
      'State the left basal convention you are using',
    ],
    airways: [
      'RB1',
      'RB2',
      'RB3',
      'RB4',
      'RB5',
      'RB6',
      'RB7',
      'RB8',
      'RB9',
      'RB10',
      'LB1+2',
      'LB3',
      'LB4',
      'LB5',
      'LB6',
      'LB7+8',
      'LB9',
      'LB10',
    ],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 106 } },
    ],
  },
]

export function spineStop(id: SpineStopId): SpineStop {
  const stop = SPINE_STOPS.find((candidate) => candidate.id === id)
  if (!stop) throw new Error(`Unknown spine stop ${id}`)
  return stop
}

export function isSpineStopId(value: unknown): value is SpineStopId {
  return typeof value === 'string' && (SPINE_STOP_IDS as readonly string[]).includes(value)
}

/** "Airway · The main carina (3 of 6)" — the only surface that numbers a stop. */
export function spineCaption(stopId: SpineStopId | null): string {
  if (!stopId) return 'Airway · not named on this step'
  const index = SPINE_STOP_IDS.indexOf(stopId)
  return `Airway · ${spineStop(stopId).title} (${index + 1} of ${SPINE_STOP_IDS.length})`
}
