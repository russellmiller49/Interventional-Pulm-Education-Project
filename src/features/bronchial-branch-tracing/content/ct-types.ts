import type { StageStepBase } from '@/features/learning-module/stage/stageModel'
import type { DisplayPreset, Vec3 } from '../geometry/coordinates'

export interface CtCheckpoint {
  id: string
  slice: number
  pixel: [number, number]
  lps: Vec3
  sourceHu: number
}
export interface CtTrace {
  id: string
  region: string
  preset: DisplayPreset
  range: [number, number]
  cropCenter: [number, number]
  cropSize: number
  anchor: { slice: number; pixel: [number, number] }
  checkpoints: CtCheckpoint[]
  scopePositionLps: Vec3
  scopeDirectionLps: Vec3
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
