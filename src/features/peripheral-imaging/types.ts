import type { StageBlockKind } from '@/features/learning-module/stage/StageTeachingScope'

export type LabId =
  | 'geometry'
  | 'field'
  | 'temporal'
  | 'dts'
  | 'acquisition'
  | 'mpr'
  | 'registration'
  | 'safety'
  | 'dose'
export type ObjectiveId = 'choose' | 'optimize' | 'dts' | 'cbct' | 'verify' | 'protect'
export type SourceId =
  | 'setser'
  | 'wabip'
  | 'aapm12'
  | 'tg272'
  | 'tg125'
  | 'saad'
  | 'sumner'
  | 'podder'
  | 'mobile'
  | 'verhoeven'
  | 'vespa'
  | 'ilocate'
  | 'frontier'
  | 'confirm'
  | 'pritchett'
  | 'icrp'
  | 'skin'
export interface Source {
  id: SourceId
  authors: string
  title: string
  publication: string
  year: number
  url: string
  kind:
    | 'Technical review'
    | 'Practice guideline'
    | 'Technical report'
    | 'Primary study'
    | 'Randomized trial'
    | 'Professional guidance'
  supports: string
  limitation: string
}
export interface Choice {
  id: string
  text: string
  rationale: string
}
export interface Question {
  id: string
  objective: ObjectiveId
  stem: string
  choices: Choice[]
  correct: string
  takeaway: string
  sources: SourceId[]
  critical?: boolean
}
export interface TeachingBlock {
  title: string
  /** Which phase of a section may show this block; classified by teachingBlocks.ts when absent. */
  kind?: StageBlockKind
  body: string
  points?: string[]
  sources: SourceId[]
  detail?: { title: string; body: string }
}
export interface Lesson {
  id: string
  title: string
  /** The rail label: three words at most. */
  shortTitle: string
  group: string
  stage: string
  minutes: number
  objective: ObjectiveId
  outcome: string
  concept: string
  prerequisites: string[]
  why: string
  recall: { prompt: string; answer: string }
  blocks: TeachingBlock[]
  worked: { scenario: string; reasoning: string }
  lab?: LabId
  labTask?: string
  takeaway: string[]
  checkIds: string[]
}
export type Phase = 'learn' | 'lab' | 'check' | 'debrief'
export interface Attempt {
  choice: string
  correct: boolean
}
export interface Progress {
  version: 1
  lessonId: string
  phase: Phase
  answers: Record<string, Attempt>
  feedbackQuestion: Record<string, string>
  reviewed: string[]
  labValues: Record<string, Record<string, number | string | boolean>>
}
