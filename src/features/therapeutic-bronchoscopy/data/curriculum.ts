import {
  stageStepLocationErrors,
  type StageLessonBase,
  type StageStepBase,
} from '@/features/learning-module/stage/stageModel'
import type { InstrumentId } from '../engine/instruments'
import type { PathologySettings } from '@/lib/airway-anatomy/pathology/model'

export const REVIEW_SOURCE = 'https://doi.org/10.21037/jtd.2017.07.27'
export const CAO_SOURCE =
  'https://www.chestnet.org/guidelines-and-topic-collections/guidelines/interventional-pulmonary/management-of-central-airway-obstruction'
export const BASE_ROUTE = '/admin/therapeutic-bronchoscopy'
export interface Lesson extends StageLessonBase<StageStepBase<string>> {
  instrument: InstrumentId
  objective: string
  prerequisite: string
  scenario: Partial<PathologySettings>
  question: string
  choices: readonly string[]
  answer: number
  explanation: string
  worked: readonly string[]
  transfer: string
}
const definitions = [
  {
    instrument: 'forceps',
    title: 'Forceps biopsy',
    objective: 'Engage visible tumor, take a localized bite and retrieve the specimen.',
    prerequisite: 'Central airway anatomy and scope orientation',
    scenario: { morphology: 'obstructing', site: 'trachea', size: 0.85 },
    question: 'What should change immediately when open forceps engage tumor and the cups close?',
    choices: [
      'A small tissue defect, with the specimen still held in the jaws',
      'The whole tumor disappears',
      'A specimen is recorded before the forceps are retrieved',
    ],
    answer: 0,
    explanation:
      'Cup closure separates a small piece of tissue. Retrieval completes the specimen step; it does not establish a histological diagnosis. Reassess the biopsy site for bleeding.',
    worked: [
      'Compare the lesion with the adjacent normal airway. Find protruding tissue away from the normal wall.',
      'Advance the closed forceps into view. Open the jaws, then advance to tumor contact.',
      'Close the jaws to take a bite. Retrieve the closed instrument, then inspect the defect and visible blood.',
    ],
    transfer: 'Repeat a forceps biopsy in the left mainstem bronchus.',
  },
  {
    instrument: 'cryoprobe',
    title: 'Cryoadhesion & extraction',
    objective:
      'Maintain probe contact, develop visible adhesion, and retrieve tissue with the scope and probe together.',
    prerequisite: 'Forceps biopsy and specimen retrieval',
    scenario: { morphology: 'obstructing', site: 'trachea', size: 1 },
    question:
      'The probe is frozen onto tumor. Which action produces immediate tissue removal in cryoextraction?',
    choices: [
      'Allow the ice to disappear without withdrawing tissue',
      'Detach the adherent tissue, then withdraw scope and probe together',
      'Pull the frozen specimen through the working channel',
    ],
    answer: 1,
    explanation:
      'Cryoextraction uses tissue adhesion and mechanical withdrawal for immediate removal. Freezing alone is not immediate debulking. Transfer the specimen outside the airway before re-entering to inspect the site.',
    worked: [
      'Advance the cryoprobe to protruding tumor with adequate separation from the normal airway wall.',
      'Freeze while maintaining contact. The visible ice cue in this model represents adhesion, not a clinical dose or recommended duration.',
      'Detach the adhered tissue, withdraw the scope and probe en bloc, transfer the specimen and re-enter.',
    ],
    transfer: 'Repeat cryoextraction from a lesion in the left mainstem bronchus.',
  },
  {
    instrument: 'snare',
    title: 'Snare resection',
    objective:
      'Encircle a discrete stalk, apply the modeled thermal interlocks and retrieve the resected lesion.',
    prerequisite: 'Specimen retrieval and thermal-airway precautions',
    scenario: { morphology: 'polypoid', site: 'trachea', size: 1 },
    question: 'What must the loop capture for the stalk-resection action used in this model?',
    choices: [
      'Any mucosal surface touched by an open loop',
      'A broad, shallow mucosal abnormality',
      'A discrete lesion stalk enclosed by the loop',
    ],
    answer: 2,
    explanation:
      'The loop must surround an appropriate attachment. Activation in this model requires stalk capture, inspired oxygen below 40% and confirmation of the monopolar return circuit. These are limited teaching interlocks; the clinical procedure requires broader airway and fire precautions.',
    worked: [
      'Use the polypoid scenario. With the tool retrieved, Approach target aligns the view with the stalk.',
      'Advance the sheath, open the loop and position the stalk within it. Adjust extension and rotation before tightening.',
      'Review the monopolar circuit and inspired oxygen. Activate resection, withdraw the retained tissue en bloc, transfer it and re-enter.',
    ],
    transfer: 'Repeat stalk capture and resection in the left mainstem bronchus.',
  },
] as const

export const LESSONS: readonly Lesson[] = definitions.map((d, index) => ({
  ...d,
  sectionId: d.instrument,
  index,
  total: definitions.length,
  minutes: 8,
  predictionStepIndex: 1,
  steps: [
    {
      phase: 'recognize',
      title: 'Compare the airway',
      instruction:
        'Use Compare normal, then Return to lesion. Inspect the attachment and the open lumen.',
      landmark: 'BRONCHOSCOPE',
      actionLabel: 'Continue after comparison',
    },
    {
      phase: 'predict',
      title: 'Anticipate the tissue response',
      instruction: d.question,
      landmark: 'Prediction',
      actionLabel: 'Submit prediction',
    },
    {
      phase: 'act',
      title: 'Obtain and retrieve tissue',
      instruction: d.objective,
      landmark: 'Instrument',
      actionLabel: 'Review the tissue response',
    },
    {
      phase: 'observe',
      title: 'Inspect the treatment site',
      instruction:
        'Re-enter if needed. Review residual modeled tissue, the retrieved specimen count and visibility.',
      landmark: 'Residual modeled tissue',
      actionLabel: 'Explain the result',
    },
    {
      phase: 'explain',
      title: 'Connect action and response',
      instruction: 'Relate the visible defect and specimen to the instrument action.',
      landmark: 'Why the tissue changed',
      actionLabel: 'Begin the transfer case',
    },
    {
      phase: 'transfer',
      title: 'Apply at a second location',
      instruction: d.transfer,
      landmark: 'Instrument',
      actionLabel: 'Complete this instrument lesson',
    },
  ].map((step, i) => ({
    id: `${d.instrument}-${i}`,
    ordinal: i + 1,
    phase: step.phase as StageStepBase<string>['phase'],
    title: step.title,
    instruction: step.instruction,
    lookIn: {
      pane:
        step.phase === 'predict' ? 'steps' : step.phase === 'explain' ? 'teaching' : 'simulator',
      landmark: step.landmark,
    },
    actionLabel: step.actionLabel,
    interaction: step.phase,
    gate: i > 1 ? 'after-prediction' : 'open',
  })),
}))
export function nextLesson(completed: ReadonlySet<string>) {
  return LESSONS.find((l) => !completed.has(l.sectionId)) ?? LESSONS[0]
}
for (const lesson of LESSONS)
  for (const step of lesson.steps) {
    const errors = stageStepLocationErrors(step.id, step.lookIn)
    if (errors.length) throw new Error(errors.join('; '))
  }
export const ASSESSMENT = [
  {
    id: 'visibility',
    prompt: 'After a biopsy, blood obscures the target. What is the next modeled action?',
    options: [
      'Take another bite at the previous position',
      'Retrieve the instrument and use suction to restore the view',
      'Increase lesion size',
    ],
    answer: 1,
    feedback:
      'Further tissue actions require a visible target. In this model, suction through an empty channel reduces visible blood while the source can continue bleeding.',
  },
  {
    id: 'retrieval',
    prompt:
      'A cryoprobe holds a detached fragment. How should it leave the airway in this exercise?',
    options: [
      'Scope, probe and retained tissue are withdrawn together',
      'The frozen fragment is pulled into the working channel',
      'Thaw the tissue in the airway and count it as retrieved',
    ],
    answer: 0,
    feedback:
      'The retained specimen is removed with the scope and probe en bloc. Transfer it outside the airway before re-entering.',
  },
  {
    id: 'energy',
    prompt:
      'A snare holds a stalk, the return circuit is confirmed and inspired oxygen is 50%. What should happen?',
    options: [
      'Activation proceeds because the loop is tight',
      'The simulator removes tissue without energy',
      'Activation is blocked and thermal conditions must be reassessed',
    ],
    answer: 2,
    feedback:
      'The model blocks thermal activation at or above 40% inspired oxygen. Meeting this single threshold does not establish clinical fire safety.',
  },
] as const
