import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import type { LessonPartId } from '../../content/lessonParts'
import type { Plausibility, ThoracoscopySectionSpec } from '../../content/types'

/**
 * Every word the lesson host adds to a section, checked by the learner-copy gate as it loads. The
 * section's own teaching comes from its spec, already checked there. No word here carries a number,
 * a score or a verdict (learning contract).
 */
export const LESSON_WORDS = {
  notReviewed:
    'The clinical statements in this section are written from published sources and have not yet been clinically reviewed. Read them as teaching in preparation, not as settled practice.',
  objective: 'What you will be able to explain',
  clinicalQuestion: 'The question this section helps you answer',
  signalsHeading: 'What you see, and where it comes from',
  partsHeading: 'The parts of this section',
  partsNote: 'You can open any part at any time.',
  here: 'you are here',
  done: 'done',
  movedPast: 'moved past',
  back: 'Back',
  continue: 'Continue',
  moveOn: 'Move on without doing this',
  exampleLoadAgain: 'Put the space back as the example has it',
  exampleTaughtIn: 'Where these steps are taught',
  lungAuthored:
    'The lung here is an authored teaching state, loaded with the space: not the lung’s response to anything you did, and not yet clinically reviewed.',
  inPreparation: 'in preparation',
  open: 'open',
  questionNote: 'Optional. Try it, or read the explanation first. Nothing you choose is kept.',
  check: 'Check',
  explain: 'Read the explanation',
  explanationHeading: 'Explanation',
  chooseFirst: 'Choose an answer to check it.',
  conceptHeading: 'The one new idea',
  increment: 'What is new',
  analogy: 'An image first',
  precise: 'Precisely',
  application: 'Use it now',
  workedExampleNote: 'A worked example, shown in full.',
  misconceptionsHeading: 'What people often think',
  harmfulHeading: 'The tempting move',
  risk: 'The risk',
  inThisModel: 'In this model',
  leavesOutHeading: 'What this model leaves out',
  transferHeading: 'The same idea, somewhere else',
  finishHeading: 'Finishing this section',
  finishNote:
    'Marking a section reviewed is your own note that you have worked through it. It is kept on this device, and you can take it back.',
  markReviewed: 'Mark this section reviewed',
  marked: 'You marked this section reviewed.',
  unmark: 'Take the mark back',
  leave: 'Leave without marking',
  next: 'Next',
  allSections: 'All the sections',
  cannotSave: 'This browser is not saving the course here, so where you are will not be kept.',
} as const

/** What checking a choice says, by the kind of choice it was authored as. No verdict beyond it. */
export const PLAUSIBILITY_WORDS: Readonly<Record<Plausibility, string>> = {
  best: 'This one fits.',
  'reasonable-but-incomplete': 'This one is reasonable, and it leaves something out.',
  'incorrect-mechanism': 'This one does not match how it works.',
  unsafe: 'This one would be unsafe.',
}

export const PART_TITLES: Readonly<Record<Exclude<LessonPartId, `block:${string}`>, string>> = {
  orientation: 'What this section is for',
  'teaching-example': 'The teaching example',
  question: 'A question to try',
  concept: 'The one new idea',
  'worked-example': 'A worked example',
  activity: 'Try it in the space',
  misconceptions: 'What people often think',
  'harmful-reflex': 'The tempting move',
  'model-leaves-out': 'What this model leaves out',
  transfer: 'The same idea, somewhere else',
}

/** The title of a part, a block's own heading for a block. */
export function partTitle(part: LessonPartId, spec: ThoracoscopySectionSpec): string {
  if (part.startsWith('block:')) {
    const block = spec.blocks.find((entry) => `block:${entry.id}` === part)
    if (!block) throw new Error(`${spec.id} has no block for ${part}`)
    return block.heading
  }
  return PART_TITLES[part as keyof typeof PART_TITLES]
}

assertThoracoscopyCopy([
  ...Object.entries(LESSON_WORDS).map(([key, text]) => ({
    where: `lesson ${key}`,
    text,
    options: { allowDigits: false },
  })),
  ...Object.entries(PLAUSIBILITY_WORDS).map(([key, text]) => ({
    where: `plausibility ${key}`,
    text,
    options: { allowDigits: false },
  })),
  ...Object.entries(PART_TITLES).map(([key, text]) => ({
    where: `part ${key}`,
    text,
    options: { allowDigits: false },
  })),
])
