import { assertThoracoscopyCopy } from './learnerCopy'
import { type PleuralZoneId } from './pleuralZones'
import type { ClaimId } from './types'

/**
 * The landmarks that name a region of a normal right pleural space, as a learner sees them
 * through the telescope, and where this model gets each one.
 *
 * "CT segmentation" means the structure is in the scan's segmentation; the segment names are not
 * trusted, and the anatomy slice identifies each segment by its measured content before a landmark
 * is drawn from it. "Drawn by the author" is teaching geometry. "Not in this model" is named so the
 * learner knows to look for it in a patient and not in the scene.
 */
export const LANDMARK_IDS = [
  'ribs',
  'diaphragm',
  'costophrenic-recess',
  'apex-cone',
  'heart',
  'lung-surface',
  'fissures',
] as const

export type LandmarkId = (typeof LANDMARK_IDS)[number]

export interface Landmark {
  readonly id: LandmarkId
  readonly name: string
  /** How it is recognised through the telescope. */
  readonly recognised: string
  /** The regions it names. Empty for the lung, which is not a survey zone. */
  readonly zones: readonly PleuralZoneId[]
  readonly inThisModel: 'CT segmentation' | 'drawn by the author' | 'not in this model'
  readonly claimIds: readonly ClaimId[]
}

export const LANDMARKS: readonly Landmark[] = [
  {
    id: 'ribs',
    name: 'Ribs',
    recognised:
      'Evenly spaced bands beneath the lining of the chest wall, with the intercostal spaces between them.',
    zones: ['anterior-chest-wall', 'lateral-chest-wall', 'posterior-chest-wall', 'apex'],
    inThisModel: 'CT segmentation',
    claimIds: ['MT-C-0016'],
  },
  {
    id: 'diaphragm',
    name: 'Diaphragm',
    recognised:
      'The dome at the base of the space, toward the feet. In a patient it moves with each breath; the model does not.',
    zones: ['diaphragm'],
    inThisModel: 'CT segmentation',
    claimIds: ['MT-C-0012'],
  },
  {
    id: 'costophrenic-recess',
    name: 'Costophrenic recess',
    recognised: 'The narrow angle where the diaphragm meets the chest wall, all the way round.',
    zones: ['costophrenic-recess'],
    inThisModel: 'CT segmentation',
    claimIds: ['MT-C-0012'],
  },
  {
    id: 'apex-cone',
    name: 'Apex',
    recognised: 'The end of the space toward the head, narrowing like a cone.',
    zones: ['apex'],
    inThisModel: 'CT segmentation',
    claimIds: ['MT-C-0013'],
  },
  {
    id: 'heart',
    name: 'Heart',
    recognised: 'In the mediastinum, behind the inner wall of the space.',
    zones: ['mediastinum'],
    inThisModel: 'CT segmentation',
    claimIds: ['MT-C-0011'],
  },
  {
    id: 'lung-surface',
    name: 'Lung',
    recognised:
      'Pink and soft, with a fine network of lobules and scattered dark specks of anthracotic pigment.',
    zones: [],
    inThisModel: 'drawn by the author',
    claimIds: ['MT-C-0015'],
  },
  {
    id: 'fissures',
    name: 'Fissures',
    recognised:
      'On the right, the oblique and horizontal fissures, meeting where the three lobes join.',
    zones: [],
    inThisModel: 'CT segmentation',
    claimIds: ['MT-C-0014'],
  },
]

export function landmark(id: LandmarkId): Landmark {
  const found = LANDMARKS.find((entry) => entry.id === id)
  if (!found) throw new Error(`Unknown landmark: ${id}`)
  return found
}

if (LANDMARKS.map((entry) => entry.id).join() !== LANDMARK_IDS.join()) {
  throw new Error('Medical Thoracoscopy landmarks: one entry for each id, in order')
}

assertThoracoscopyCopy(
  LANDMARKS.flatMap((entry) => [
    { where: `landmark ${entry.id} name`, text: entry.name, options: { allowDigits: false } },
    { where: `landmark ${entry.id}`, text: entry.recognised },
  ]),
)
