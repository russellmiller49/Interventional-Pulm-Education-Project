import type { StageStepBase } from '@/features/learning-module/stage/stageModel'
import type { DisplayPreset, Vec3 } from '../geometry/coordinates'

export interface AirwayLabel {
  code: string
  name: string
  shortName: string
}
export interface CtCheckpoint {
  id: string
  slice: number
  pixel: [number, number]
  lps: Vec3
  sourceHu: number
  sourceEdgeId: number
  airway: AirwayLabel
  landmark: string
}
export interface CtTrace {
  id: string
  targetId: string
  sourceEdgeIds: number[]
  region: string
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
export interface CtResponse {
  marks: CtMark[]
  course: Course
  hints: number
  targetRelation: TargetRelation
}
export interface CtLesson {
  id: string
  title: string
  minutes: number
  objective: string
  prerequisite: string
  concept: string
  teaching: string[]
  worked: string
  interpretation: string
  transferPrompt: string
  sourcePages: string
  example: string
  prediction: string
  transfer: string
  steps: StageStepBase<string>[]
}
