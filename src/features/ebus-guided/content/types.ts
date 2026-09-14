import { MODEL_REVISION, MODEL_STEPS, type ModelPackage } from '@/lib/ebus-model-contract'
import type { EbusControl, EbusObservation, EbusLinkedLesson } from '@/lib/ebus-guided-bridge'
import {
  LINKED_LANDMARKS,
  LINKED_TASK_VERSION,
  linkedTaskId,
  type LinkedVariant,
} from '@/lib/ebus-linked-contract'
export type Topic = 'Prepare' | 'Optimize' | 'Locate' | 'Plan' | 'Sample' | 'Complete'
export interface Choice {
  id: string
  text: string
  rationale: string
  correct?: boolean
  unsafe?: boolean
}
export interface Question {
  id: string
  prompt: string
  choices: Choice[]
  explanation: string
  imageStation?: string
  imagePolicy?: 'none' | 'retained-acquisition'
}
export type LabGoal = 'scan' | 'coupling' | 'depth' | 'gain' | 'doppler' | 'capture' | 'model'
export interface Lab {
  kind: 'simulator' | 'knobology' | 'model'
  modelPackage?: ModelPackage
  goal: LabGoal
  presetKey: string
  controls: EbusControl[]
  instruction: string
  freeDrive?: boolean
  initialRoll?: number
  initialDepth?: number
  initialGain?: number
  linkedLesson?: EbusLinkedLesson
  linkedVariant?: LinkedVariant
}
export interface Sequence {
  prompt: string
  steps: { id: string; text: string }[]
  explanation: string
}
export interface Matching {
  prompt: string
  pairs: { id: string; cue: string; response: string }[]
  explanation: string
}
export interface Lesson {
  id: string
  title: string
  topic: Topic
  minutes: number
  objective: string
  recall: string
  concept: string
  paragraphs: string[]
  checklist: string[]
  worked: { context: string; reasoning: string }
  question: Question
  transfer: Question
  observation: Question
  lab?: Lab
  transferLab?: Lab
  sequence?: Sequence
  matching?: Matching
  station?: string
  diagram: 'workflow' | 'ultrasound' | 'stations' | 'needle' | 'specimens'
  takeaways: string[]
  sources: string[]
  boundary: string
}
export interface EbusCase {
  id: string
  title: string
  topic: Topic
  context: string
  lessonIds: string[]
  questions: Question[]
  sources: string[]
}
export function labGoalMet(lab: Lab, state: EbusObservation): boolean {
  if (!state.ready || !state.frameReady || state.actionCount < 1) return false
  if (lab.linkedLesson) {
    const linked = state.linked
    const source = linked?.source
    if (
      !linked?.assetsReady ||
      !linked.frameId ||
      !source ||
      source.taskVersion !== LINKED_TASK_VERSION ||
      source.frameId !== linked.frameId ||
      source.taskId !== linkedTaskId(lab.linkedLesson, lab.linkedVariant ?? 'guided') ||
      source.modelRevision !== linked.modelRevision ||
      source.settings.depthMm !== state.depth ||
      source.settings.gainDb !== state.gain ||
      source.scope.roll !== state.roll ||
      source.scope.flexion !== state.flexion ||
      source.settings.contactQuality !== state.contactQuality
    )
      return false
    if (
      !LINKED_LANDMARKS[lab.linkedLesson].every((id) => linked.identifiedStructures?.includes(id))
    )
      return false
    if (lab.linkedLesson === 'ct-map' && !linked.modelSectionViewed) return false
    if (lab.linkedLesson === 'acoustic-contact') {
      if (!linked.baselineFrameId || linked.baselineFrameId === linked.frameId) return false
    } else {
      const approaches =
        lab.linkedLesson === 'station-seven' && lab.linkedVariant !== 'changed-window'
          ? (['rms', 'lms'] as const)
          : [linked.approach]
      if (
        !approaches.every(
          (a) =>
            linked.sweeps?.[a]?.phase === 'complete' &&
            linked.sweeps[a]!.samples >= 5 &&
            linked.sweeps[a]!.span >= 20,
        )
      )
        return false
    }
  }
  switch (lab.goal) {
    case 'model':
      return (
        !!lab.modelPackage &&
        state.model?.package === lab.modelPackage &&
        state.model.revision === MODEL_REVISION &&
        !!state.model.frameId &&
        state.model.complete &&
        !state.model.annotations &&
        MODEL_STEPS[lab.modelPackage].every((step) => state.model!.steps.includes(step))
      )
    case 'scan':
      return state.targetVisible && state.contactQuality >= 0.45
    case 'coupling':
      return state.contactQuality >= 0.8 && state.lastAction === 'flexion'
    case 'depth':
      return state.depth >= 30 && state.depth <= 45 && state.lastAction === 'depth'
    case 'gain':
      return (
        state.gain >= 35 &&
        state.gain <= 65 &&
        state.lastAction === 'gain' &&
        state.usedControls.includes('contrast')
      )
    case 'doppler':
      return state.doppler
    case 'capture':
      return state.frozen && state.measured && state.saved
  }
}
