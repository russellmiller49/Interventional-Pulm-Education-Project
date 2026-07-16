export type BaxterCrrtPathwayId = 'orientation' | 'learn' | 'practice' | 'mastery'

export interface BaxterCrrtPathwayScaffold {
  readonly id: BaxterCrrtPathwayId
  readonly label: string
  readonly eyebrow: string
  readonly summary: string
  readonly status: 'scaffold' | 'locked'
  readonly statusLabel: string
}

export const baxterCrrtPathways: readonly BaxterCrrtPathwayScaffold[] = Object.freeze([
  {
    id: 'orientation',
    label: 'Orientation',
    eyebrow: 'See the workspace',
    summary:
      'Map the patient, reasoning rail, educational device surface, circuit, trends, and source boundary before live simulation is added.',
    status: 'scaffold',
    statusLabel: 'Phase 1 scaffold',
  },
  {
    id: 'learn',
    label: 'Learn',
    eyebrow: 'Guidance planned',
    summary:
      'Guided worked examples will use the same deterministic engine as Practice, with prediction before action and causal reassessment.',
    status: 'scaffold',
    statusLabel: 'Engine not connected',
  },
  {
    id: 'practice',
    label: 'Practice',
    eyebrow: 'Independent cases planned',
    summary:
      'Independent cases will begin from clean state and keep machine controls locked until a complete prediction commitment.',
    status: 'scaffold',
    statusLabel: 'Cases not loaded',
  },
  {
    id: 'mastery',
    label: 'Mastery',
    eyebrow: 'Unavailable',
    summary:
      'Unseen capstones remain unavailable until the three-case pilot, clinical review, and device review are complete.',
    status: 'locked',
    statusLabel: 'Future phase',
  },
])

export function getBaxterCrrtPathway(pathwayId: BaxterCrrtPathwayId) {
  const pathway = baxterCrrtPathways.find((candidate) => candidate.id === pathwayId)
  if (!pathway) {
    throw new Error('Unknown Baxter CRRT pathway: ' + pathwayId)
  }
  return pathway
}
