import type {
  StageLessonBase,
  StageStepBase,
  StageStepLocation,
} from '@/features/learning-module/stage/stageModel'
import { stageStepLocationErrors } from '@/features/learning-module/stage/stageModel'
import type { Lesson } from './types'
import { LESSONS } from './curriculum'
export function stageLesson(lesson: Lesson): StageLessonBase<StageStepBase<null>> {
  const descriptions = [
    [
      'recognize',
      'Orientation',
      'Read the clinical question and locate the relevant anatomy or equipment.',
      'Teaching',
      'Teaching panel',
    ],
    [
      'recognize',
      'Worked example',
      'Follow the example and its reasoning before trying the next situation.',
      'Worked example',
      'Teaching panel',
    ],
    [
      'predict',
      'Your interpretation',
      'Choose a response using the situation below.',
      'Your interpretation',
      'Steps panel',
    ],
    [
      'act',
      'Guided activity',
      lesson.lab?.instruction ??
        lesson.sequence?.prompt ??
        lesson.matching?.prompt ??
        'Reconstruct the clinical sequence.',
      'Guided activity',
      'Steps panel',
    ],
    [
      'observe',
      'Interpret the result',
      'Describe what the observation means for the procedure.',
      'Interpret the result',
      'Steps panel',
    ],
    [
      'explain',
      'Clinical explanation',
      'Connect your actions with the image or procedural result.',
      'Clinical explanation',
      'Teaching panel',
    ],
    [
      'transfer',
      'Another situation',
      'Apply the same principle to a changed clinical situation.',
      'Another situation',
      'Steps panel',
    ],
  ] as const
  const steps: StageStepBase<null>[] = descriptions.map(
    ([phase, title, instruction, landmark, panel], i) => {
      const lookIn: StageStepLocation =
        (i === 3 && lesson.lab) ||
        (i === 1 && (lesson.lab?.linkedLesson || lesson.lab?.modelPackage))
          ? { pane: 'simulator', landmark: 'EBUS workbench' }
          : i === 4 && lesson.lab?.linkedLesson
            ? { pane: 'simulator', landmark: 'Retained ultrasound' }
            : i === 4 && lesson.lab?.modelPackage
              ? { pane: 'simulator', landmark: 'Retained model observation' }
              : { pane: panel === 'Teaching panel' ? 'teaching' : 'steps', landmark }
      return {
        id: lesson.id + '-step-' + i,
        ordinal: i + 1,
        phase,
        title,
        instruction,
        lookIn,
        actionLabel: 'Continue',
        interaction: null,
        gate: i > 2 ? 'after-prediction' : 'open',
      }
    },
  )
  const errors = steps.flatMap((s) => stageStepLocationErrors(s.id, s.lookIn))
  if (errors.length) throw new Error(errors.join('; '))
  return {
    sectionId: lesson.id,
    title: lesson.title,
    minutes: lesson.minutes,
    index: LESSONS.findIndex((entry) => entry.id === lesson.id),
    total: LESSONS.length,
    steps,
    predictionStepIndex: 2,
  }
}
