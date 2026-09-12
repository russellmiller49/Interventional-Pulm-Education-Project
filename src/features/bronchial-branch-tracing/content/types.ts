import type { StageStepBase } from '@/features/learning-module/stage/stageModel'
import type { Vec3 } from '../geometry/coordinates'

export type Pattern =
  | 'vertical'
  | 'horizontal-horizontal'
  | 'horizontal-vertical'
  | 'horizontal-oblique'
  | 'reversal'
  | 'variant'
export type Domain = 'connectivity' | 'viewpoint' | 'uncertainty'
export interface Branch {
  id: string
  parentId: string | null
  childIds: string[]
  points: Vec3[]
  radius: number
  label: string
  namedGeneration: number | null
  topologicalDepth: number
  kind: 'standard' | 'common-trunk' | 'daughter' | 'unclassified'
  lumenEvidence: 'visible' | 'partial' | 'inferred'
  geometryStatus: 'synthetic' | 'candidate' | 'verified'
  labelStatus: 'unnamed' | 'candidate' | 'reviewed'
}
export interface Phantom {
  id: string
  kind: 'synthetic'
  frame: 'RAS-mm'
  rootId: string
  pattern: Pattern
  branches: Branch[]
  camera: { position: Vec3; target: Vec3; up: Vec3; roll: number; fov: number }
  sliceRange: [number, number]
  initialSlice: number
}
export interface Exercise {
  id: string
  phantom: Phantom
  question: string
  targetId: string | 'unresolved'
  evidence: string
  rationale: string
  misconceptions: Record<string, string>
  hints: string[]
}
export interface Lesson {
  id: string
  title: string
  minutes: number
  objective: string
  prerequisite: string
  concept: string
  teaching: string[]
  checklist: string[]
  worked: string
  sourcePages: string
  example: Exercise
  prediction: Exercise
  transfer: Exercise
  steps: StageStepBase<string>[]
}
export interface CaseCapabilities {
  hasSourceIntensityVolume: boolean
  hasContinuousCtStack: boolean
  hasReviewedSubsegmentLabels: boolean
  hasReviewedJunctionPoses: boolean
  hasActualBronchoscopyVideo: boolean
}
export interface ClinicalCaseReview {
  kind: 'clinical'
  capabilities: CaseCapabilities
  rightsApproved: boolean
  deidentificationApproved: boolean
  reviewedDerivativeSha256?: string
  approvedCheckpointIds: string[]
}
export const canAssessClinicalCase = (c: ClinicalCaseReview) =>
  c.rightsApproved &&
  c.deidentificationApproved &&
  c.capabilities.hasContinuousCtStack &&
  c.capabilities.hasReviewedSubsegmentLabels &&
  c.capabilities.hasReviewedJunctionPoses &&
  Boolean(c.reviewedDerivativeSha256?.match(/^[a-f0-9]{64}$/)) &&
  c.approvedCheckpointIds.length > 0

export function validateGraph(branches: Branch[], rootId: string): string[] {
  const errors: string[] = []
  const map = new Map(branches.map((b) => [b.id, b]))
  if (map.size !== branches.length) errors.push('Duplicate branch IDs')
  if (!map.has(rootId) || map.get(rootId)?.parentId !== null) errors.push('Invalid root')
  for (const b of branches) {
    if (b.points.length < 2 || !b.points.flat().every(Number.isFinite))
      errors.push(`Invalid geometry: ${b.id}`)
    if (!(b.radius > 0) || !Number.isFinite(b.radius)) errors.push(`Invalid radius: ${b.id}`)
    if (new Set(b.childIds).size !== b.childIds.length) errors.push(`Duplicate children: ${b.id}`)
    for (const id of b.childIds) {
      const child = map.get(id)
      if (!child || child.parentId !== b.id) errors.push(`Nonreciprocal child: ${id}`)
      else if (
        Math.hypot(...child.points[0].map((v, i) => v - b.points[b.points.length - 1][i])) > 0.001
      )
        errors.push(`Disconnected endpoint: ${id}`)
    }
    if (b.id !== rootId && (!b.parentId || !map.get(b.parentId)?.childIds.includes(b.id)))
      errors.push(`Invalid parent: ${b.id}`)
  }
  const seen = new Set<string>(),
    active = new Set<string>()
  function visit(id: string) {
    if (active.has(id)) {
      errors.push('Cycle')
      return
    }
    if (seen.has(id)) return
    seen.add(id)
    active.add(id)
    map.get(id)?.childIds.forEach(visit)
    active.delete(id)
  }
  visit(rootId)
  if (seen.size !== branches.length) errors.push('Disconnected graph')
  return errors
}
