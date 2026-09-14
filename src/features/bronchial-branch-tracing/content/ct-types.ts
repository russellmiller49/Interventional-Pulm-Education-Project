import type { StageStepBase } from '@/features/learning-module/stage/stageModel'
import type { DisplayPreset, Vec3 } from '../geometry/coordinates'
import type { CtOrientation } from '../geometry/orientation'

export interface AirwayLabel {
  code: string
  name: string
  shortName: string
}
export interface CtBranchOption {
  sourceEdgeId: number
  airway: AirwayLabel
  label: string
  direction: string
  slice: number
  pixel: [number, number]
  lps: Vec3
}
export type CtBranchChoice = number | 'unresolved'
export interface CtCheckpoint {
  id: string
  slice: number
  pixel: [number, number]
  lps: Vec3
  /** Present only when the source exporter sampled this exact location. */
  sourceHu?: number
  sourceEdgeId: number
  airway: AirwayLabel
  landmark: string
  visibilityNote?: string
  cropCenter?: [number, number]
  cropSize?: number
  decision?: {
    nodeId: number
    junctionLps: Vec3
    parent: {
      sourceEdgeId: number
      airway: AirwayLabel
      slice: number
      pixel: [number, number]
      lps: Vec3
    }
    options: CtBranchOption[]
  }
}
export interface CtTrace {
  id: string
  targetId: string
  sourceEdgeIds: number[]
  region: string
  focusAirway?: AirwayLabel
  preset: DisplayPreset
  range: [number, number]
  cropCenter: [number, number]
  cropSize: number
  airwayPath: AirwayLabel[]
  anchor: { slice: number; pixel: [number, number]; sourceEdgeId: number; airway: AirwayLabel }
  checkpoints: CtCheckpoint[]
  scopePositionLps: Vec3
  scopeDirectionLps: Vec3
}
export interface CtNoduleTarget {
  id: string
  segment: { code: string; name: string; bronchusCode: string }
  approachCode: string
  centerLps: Vec3
  pixel: [number, number]
  slice: number
  patch: {
    originPixel: [number, number]
    size: [number, number]
    frames: { slice: number; path: string; changedPixels: number }[]
  }
}
export type TargetRelation = 'approaches' | 'unresolved' | 'different-structure'
export const TARGET_RELATION_OPTIONS: Record<TargetRelation, string> = {
  approaches: 'Airway approaches the nodule',
  unresolved: 'Distal connection unresolved',
  'different-structure': 'Possible adjacent structure',
}
export const TARGET_RELATION_FEEDBACK: Record<TargetRelation, string> = {
  approaches:
    'Compare the last visible air column with the nodule across neighboring slices. A planned airway approach does not establish instrument reach or tool-in-lesion.',
  unresolved:
    'Keep that uncertainty in your route description. Backtrack to the last definite lumen and review the interval toward the nodule; proximity alone is insufficient.',
  'different-structure':
    'Return to the parent junction and follow the air column again. A neighboring vessel or a different bronchus can appear close to the nodule without continuing from your selected branch.',
}
export type Course = 'cranial' | 'caudal' | 'horizontal' | 'returning' | 'uncertain'
export const COURSE_OPTIONS: Record<Course, string> = {
  cranial: 'Toward more cranial levels',
  caudal: 'Toward more caudal levels',
  horizontal: 'Mainly within the axial plane',
  returning: 'Changes cranial–caudal direction',
  uncertain: 'Cannot establish the continuation',
}
export interface CtMark {
  slice: number
  pixel: [number, number] | null
}
export interface CtJunctionAttempt {
  mark: CtMark
  branch: CtBranchChoice | null
  /** Legacy drafts only. Self-paced responses record neither hint use nor a support label. */
  hints?: number
  support?: 'coached' | 'independent' | 'after-comparison' | 'legacy-unknown'
  orientation?: CtOrientation
}
export interface CtResponse {
  orientation: { first: CtOrientation; used: CtOrientation }
  marks: CtMark[]
  /** Actual daughter selections in checkpoint order; null only at the distal approach. */
  branches: (CtBranchChoice | null)[]
  course: Course
  /** Legacy drafts only. */
  hints?: number
  targetRelation: TargetRelation
}
export interface CtLesson {
  id: string
  title: string
  minutes: number
  objective: string
  prerequisite: string
  concept: string
  /** Why the skill matters at the bronchoscope, in a sentence or two. */
  purpose?: string
  /** A visible tracing aid shown beside the task, never withheld until a response. */
  checklist?: string[]
  teaching: string[]
  worked: string
  interpretation: string
  transferPrompt: string
  sourcePages: string
  example: string
  prediction: string
  transfer: string
  steps: StageStepBase<string>[]
  /** Local exercises precede full routes. IDs resolve against unchanged source geometry. */
  exercises?: LocalExerciseSpec[]
}

export type AnnotationReview =
  | { status: 'provisional'; reason: string }
  | { status: 'faculty-reviewed'; reviewer: string; date: string; geometryVersion: string }

export interface CtTeachingOverlay {
  label: string
  pixel: [number, number]
  /** Native CT pixels, authored from image review; never inferred from a centerline. */
  contour?: [number, number][]
}
export interface CtTeachingFrame {
  slice: number
  caption: string
  overlays: CtTeachingOverlay[]
}
export interface LocalExerciseSpec {
  traceId: string
  checkpointId: string
  kind: 'same-lumen' | 'viewpoint' | 'bifurcation' | 'pattern' | 'integration' | 'parent-view'
}
export interface LocalCtExercise {
  id: string
  spec: LocalExerciseSpec
  trace: CtTrace
  review: AnnotationReview
  frames: CtTeachingFrame[]
  answerPoints: { label: string; slice: number; pixel: [number, number] }[]
  task: string
  explanation: string
  hints: [string, string, string]
  teaching: {
    sourceCase: string
    sourceSha256: string
    graphSha256: string
    parentEdge: number
    daughterEdges: number[]
    responseReason: string
    finding: string
    comparison: string
    overlayKind: 'model-locator'
    referenceFrame: string
  }
}

export interface CtViewerState {
  slice: number
  focus: 'start' | 'target' | 'junction'
  full: boolean
  magnification: number
  showNodule: boolean
  showScope: boolean
}
