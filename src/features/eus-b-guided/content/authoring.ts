import type { Question } from './types'

/**
 * One single-best-answer question: the keyed option first, then two others, each with the reason
 * it does or does not hold. Display order is rotated by the shared `orderChoices`, so the position
 * written here never predicts the position shown.
 */
export const question = (
  id: string,
  prompt: string,
  correct: [string, string],
  wrong: [string, string],
  other: [string, string],
  unsafe: boolean | 'both' = false,
): Question => ({
  id,
  prompt,
  choices: [
    { id: 'a', text: wrong[0], rationale: wrong[1], unsafe: !!unsafe },
    { id: 'b', text: correct[0], rationale: correct[1], correct: true },
    { id: 'c', text: other[0], rationale: other[1], unsafe: unsafe === 'both' },
  ],
  explanation: correct[1],
})
