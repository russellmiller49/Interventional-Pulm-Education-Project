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
    eyebrow: 'Operate the pilot interface',
    summary:
      'Run the case-free PrisMax equipment checkout from setup through operations, inspect the original circuit, and reload a clean interface state.',
    status: 'scaffold',
    statusLabel: 'Available',
  },
  {
    id: 'learn',
    label: 'Learn',
    eyebrow: 'Guided cases',
    summary:
      'Run the three source-mapped pilot cases with staged hints, prediction before action, immediate and delayed response, required reassessment, and an unscored causal debrief.',
    status: 'scaffold',
    statusLabel: 'Protected pilot',
  },
  {
    id: 'practice',
    label: 'Practice',
    eyebrow: 'Independent cases',
    summary:
      'Run the same three cases from isolated clean state. Machine controls remain locked until a five-field prediction commitment; scoring allows explicit safe alternatives.',
    status: 'scaffold',
    statusLabel: 'Scored pilot',
  },
  {
    id: 'mastery',
    label: 'Mastery',
    eyebrow: 'Unavailable',
    summary:
      'Mastery creation, scoring, and persistence are locked in the engine until an exact multi-hit capstone, problem domains, scoring, and required reviews are approved.',
    status: 'locked',
    statusLabel: 'Review gated',
  },
])

export function getBaxterCrrtPathway(pathwayId: BaxterCrrtPathwayId) {
  const pathway = baxterCrrtPathways.find((candidate) => candidate.id === pathwayId)
  if (!pathway) {
    throw new Error('Unknown Baxter CRRT pathway: ' + pathwayId)
  }
  return pathway
}
