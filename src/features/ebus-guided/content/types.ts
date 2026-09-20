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
/**
 * The same conditions `labGoalMet` applies, said out loud (EBUS-PRE-REVIEW-02, L7-3).
 *
 * Readiness used to be reported as one sentence — "Waiting for your acquisition" — for every lab,
 * so a learner who had done almost everything could not tell what was still missing. In the
 * gain lesson in particular the goal requires the displayed recording to be a gain example, which
 * means the gain control has to be the last one moved; that is a real property of the lookup (the
 * clips vary one control at a time), not a stale flag, so it is explained rather than removed.
 *
 * This reports; it never decides. `labGoalMet` remains the only gate, and a test holds the two to
 * the same answer.
 */
export interface LabRequirement {
  id: string
  met: boolean
  text: string
}
export function labGoalRequirements(lab: Lab, state: EbusObservation): LabRequirement[] {
  const list: LabRequirement[] = [
    { id: 'ready', met: state.ready, text: 'The workbench has finished loading.' },
    {
      id: 'frame-ready',
      met: state.frameReady,
      text:
        lab.kind === 'knobology'
          ? 'The selected recording is decoded and on screen.'
          : 'The workbench is showing a rendered frame.',
    },
    {
      id: 'used-a-control',
      met: state.actionCount >= 1,
      text: 'You have moved at least one control in the workbench.',
    },
  ]
  if (lab.kind === 'knobology') {
    const source = state.recorded
    list.push({
      id: 'frame-matches-settings',
      met:
        !!source &&
        source.taskId === lab.goal &&
        source.settings.depthMm === state.depth &&
        source.settings.gain === state.gain &&
        source.settings.contrast === state.contrast &&
        source.settings.doppler === state.doppler &&
        source.captured === state.saved,
      text: 'The image on screen is the one your current control settings select.',
    })
  }
  if (lab.linkedLesson) {
    const linked = state.linked
    const source = linked?.source
    list.push({
      id: 'linked-frame',
      met:
        !!linked?.assetsReady &&
        !!linked.frameId &&
        !!source &&
        source.taskVersion === LINKED_TASK_VERSION &&
        source.frameId === linked.frameId &&
        source.taskId === linkedTaskId(lab.linkedLesson, lab.linkedVariant ?? 'guided') &&
        source.modelRevision === linked.modelRevision &&
        source.settings.depthMm === state.depth &&
        source.settings.gainDb === state.gain &&
        source.scope.roll === state.roll &&
        source.scope.flexion === state.flexion &&
        source.settings.contactQuality === state.contactQuality,
      text: 'The displayed plane matches your current scope position and image settings.',
    })
    list.push({
      id: 'linked-landmarks',
      met: LINKED_LANDMARKS[lab.linkedLesson].every((id) =>
        linked?.identifiedStructures?.includes(id),
      ),
      text: 'You have named each landmark this task asks for.',
    })
    if (lab.linkedLesson === 'ct-map')
      list.push({
        id: 'linked-section',
        met: !!linked?.modelSectionViewed,
        text: 'You have opened the model section beside the ultrasound.',
      })
    else if (lab.linkedLesson === 'acoustic-contact')
      list.push({
        id: 'linked-baseline',
        met: !!linked?.baselineFrameId && linked.baselineFrameId !== linked.frameId,
        text: 'Your current acquisition differs from the initial comparison frame.',
      })
    else {
      const approaches =
        lab.linkedLesson === 'station-seven' && lab.linkedVariant !== 'changed-window'
          ? (['rms', 'lms'] as const)
          : [linked?.approach]
      list.push({
        id: 'linked-sweep',
        met: approaches.every(
          (a) =>
            !!a &&
            linked?.sweeps?.[a]?.phase === 'complete' &&
            linked.sweeps[a]!.samples >= 5 &&
            linked.sweeps[a]!.span >= 20,
        ),
        text:
          approaches.length > 1
            ? 'You have completed a rotation sweep through each approach this task asks for.'
            : 'You have completed a rotation sweep across the target.',
      })
    }
  }
  switch (lab.goal) {
    case 'model':
      list.push({
        id: 'model-steps',
        met:
          !!lab.modelPackage &&
          state.model?.package === lab.modelPackage &&
          state.model.revision === MODEL_REVISION &&
          !!state.model.frameId &&
          state.model.complete &&
          !state.model.annotations &&
          MODEL_STEPS[lab.modelPackage].every((step) => state.model!.steps.includes(step)),
        text: 'Every step in this model activity is recorded, with the teaching labels off.',
      })
      break
    case 'scan':
      list.push({
        id: 'scan',
        met: state.targetVisible && state.contactQuality >= 0.45,
        text: 'The target is in the displayed plane with usable acoustic contact.',
      })
      break
    case 'coupling':
      list.push(
        {
          id: 'coupling-contact',
          met: state.contactQuality >= 0.8,
          text: 'Acoustic contact is good enough for tissue echoes to return.',
        },
        {
          id: 'coupling-last',
          met: state.lastAction === 'flexion',
          text: 'Tip flexion is the control you moved last, so the frame is the one it produced.',
        },
      )
      break
    case 'depth':
      list.push(
        {
          id: 'depth-range',
          met: state.depth >= 30 && state.depth <= 45,
          text: 'The selected depth is between 3 and 4.5 cm.',
        },
        {
          id: 'depth-last',
          met: state.lastAction === 'depth',
          text: 'Depth is the control you moved last, so the recording on screen is a depth example.',
        },
      )
      break
    case 'gain':
      list.push(
        {
          id: 'gain-range',
          met: state.gain >= 35 && state.gain <= 65,
          text: 'The selected gain is in the middle of its range.',
        },
        {
          id: 'gain-contrast-used',
          met: state.usedControls.includes('contrast'),
          text: 'You have also compared the contrast control.',
        },
        {
          id: 'gain-last',
          met: state.lastAction === 'gain',
          text: 'Gain is the control you moved last. Each recording varies one control, so the clip on screen is a gain example only while gain is the last one you moved.',
        },
      )
      break
    case 'doppler':
      list.push({ id: 'doppler', met: state.doppler, text: 'Color Doppler is on.' })
      break
    case 'capture':
      list.push(
        { id: 'capture-frozen', met: state.frozen, text: 'The image is frozen.' },
        {
          id: 'capture-measured',
          met: state.measured,
          text: 'Two separated calipers are placed.',
        },
        { id: 'capture-saved', met: state.saved, text: 'The image is saved in the workbench.' },
      )
      break
  }
  return list
}
export function labGoalMet(lab: Lab, state: EbusObservation): boolean {
  if (!state.ready || !state.frameReady || state.actionCount < 1) return false
  if (lab.kind === 'knobology') {
    const source = state.recorded
    if (
      !source ||
      source.taskId !== lab.goal ||
      source.settings.depthMm !== state.depth ||
      source.settings.gain !== state.gain ||
      source.settings.contrast !== state.contrast ||
      source.settings.doppler !== state.doppler ||
      source.captured !== state.saved
    )
      return false
  }
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
