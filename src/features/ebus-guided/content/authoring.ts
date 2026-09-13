import type { Question, Sequence, Matching } from './types'
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
export const sequence = (prompt: string, steps: string[], explanation: string): Sequence => ({
  prompt,
  steps: steps.map((text, i) => ({ id: 'step-' + i, text })),
  explanation,
})
export const matching = (
  prompt: string,
  pairs: [string, string][],
  explanation: string,
): Matching => ({
  prompt,
  pairs: pairs.map(([cue, response], i) => ({ id: 'pair-' + i, cue, response })),
  explanation,
})

export function choiceOrder(q: Question) {
  // A stable per-item rotation: the answer's authored position never predicts display position.
  const shift = Array.from(q.id).reduce((n, c) => n + c.charCodeAt(0), 0) % q.choices.length
  return [...q.choices.slice(shift), ...q.choices.slice(0, shift)]
}
