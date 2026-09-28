import { MODEL_BOUNDARIES } from './curriculum'
import { assertThoracoscopyCopy } from './learnerCopy'

/**
 * What the model leaves out, by name, so a section can point at a statement instead of
 * rewording it. The first six are the manifest's boundaries in the learner wording the curriculum
 * already uses; the next two are added by the scan the anatomy comes from (module plan, "What the
 * model leaves out"); the last is this model's own.
 */
export const MODEL_BOUNDARY_IDS = [
  'no-forces',
  'qualitative-pressure',
  'illustrative-pathology',
  'authored-anatomy',
  'instructions-for-use',
  'not-competence',
  'scan-position',
  'rigid-ribs',
  'no-motion',
] as const

export type ModelBoundaryId = (typeof MODEL_BOUNDARY_IDS)[number]

export interface ModelBoundary {
  readonly id: ModelBoundaryId
  readonly text: string
  readonly from: 'manifest' | 'the scan' | 'this model'
}

const FROM_THE_SCAN: Readonly<Record<'scan-position' | 'rigid-ribs', string>> = {
  'scan-position':
    'The scan was taken lying on the back with the arms down. The course turns it onto its side for the procedure, but nothing inside has moved with the change of position, and the chest wall is shown as scanned.',
  'rigid-ribs': 'The ribs are rigid in the model. The chest wall does not give.',
}

/** Added for the first sections, and an owner decision (T13) until breathing is modelled. */
const FROM_THIS_MODEL: Readonly<Record<'no-motion', string>> = {
  'no-motion':
    'Nothing in the model moves with breathing or with the heartbeat. The diaphragm and the heart are shown still.',
}

export const MODEL_BOUNDARY_LIST: readonly ModelBoundary[] = MODEL_BOUNDARY_IDS.map((id, index) => {
  if (index < MODEL_BOUNDARIES.length) {
    return { id, text: MODEL_BOUNDARIES[index], from: 'manifest' as const }
  }
  if (id in FROM_THE_SCAN) {
    return { id, text: FROM_THE_SCAN[id as keyof typeof FROM_THE_SCAN], from: 'the scan' as const }
  }
  return {
    id,
    text: FROM_THIS_MODEL[id as keyof typeof FROM_THIS_MODEL],
    from: 'this model' as const,
  }
})

export function modelBoundary(id: ModelBoundaryId): ModelBoundary {
  const boundary = MODEL_BOUNDARY_LIST.find((entry) => entry.id === id)
  if (!boundary) throw new Error(`Unknown model boundary: ${id}`)
  return boundary
}

if (MODEL_BOUNDARIES.length !== 6) {
  throw new Error('Medical Thoracoscopy model boundaries: six from the manifest, then the scan')
}

assertThoracoscopyCopy(
  MODEL_BOUNDARY_LIST.map((boundary) => ({
    where: `boundary ${boundary.id}`,
    text: boundary.text,
  })),
)
