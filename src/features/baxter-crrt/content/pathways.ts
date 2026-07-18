export type BaxterCrrtPathwayId = 'orientation' | 'learn' | 'practice' | 'mastery'

export interface BaxterCrrtPathwayScaffold {
  readonly id: BaxterCrrtPathwayId
  readonly label: string
  readonly eyebrow: string
  readonly summary: string
  readonly status: 'available'
  readonly statusLabel: string
}

export const baxterCrrtPathways: readonly BaxterCrrtPathwayScaffold[] = Object.freeze([
  Object.freeze({
    id: 'orientation',
    label: 'Orientation',
    eyebrow: 'Learn device workflows',
    summary:
      'Explore manual-reference setup, operations, history, bags/scales, alarms, interruption, and stop/end framing on both devices.',
    status: 'available',
    statusLabel: 'Available',
  }),
  Object.freeze({
    id: 'learn',
    label: 'Learn',
    eyebrow: 'Guided cases',
    summary:
      'Run all 18 cases with staged hints, prediction before action, timed response, required reassessment, and causal debrief.',
    status: 'available',
    statusLabel: '18 cases',
  }),
  Object.freeze({
    id: 'practice',
    label: 'Practice',
    eyebrow: 'Independent cases',
    summary:
      'Run the same cases from isolated clean state with scoring, accepted alternatives, critical-error handling, and required reassessment.',
    status: 'available',
    statusLabel: 'Scored',
  }),
  Object.freeze({
    id: 'mastery',
    label: 'Mastery',
    eyebrow: 'Masked multi-hit capstone',
    summary:
      'Complete the unseen PrisMax capstone with no hints, a score of at least 80, no critical error, and required reassessment.',
    status: 'available',
    statusLabel: 'Available',
  }),
])

export function getBaxterCrrtPathway(pathwayId: BaxterCrrtPathwayId) {
  const pathway = baxterCrrtPathways.find((candidate) => candidate.id === pathwayId)
  if (!pathway) throw new Error(`Unknown Baxter CRRT pathway: ${pathwayId}`)
  return pathway
}
