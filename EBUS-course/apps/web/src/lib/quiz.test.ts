import { describe, expect, it } from 'vitest';

import type { QuizQuestionContent } from '@/content/types';
import { calculateQuizResult, isQuizAnswerCorrect } from '@/lib/quiz';

const questions: QuizQuestionContent[] = [
  {
    id: 'single',
    moduleId: 'knobology',
    prompt: 'Question 1',
    type: 'single-best-answer',
    options: [
      { id: 'a', label: 'A', rationale: 'Because A.' },
      { id: 'b', label: 'B', rationale: 'Because B.' },
    ],
    correctOptionIds: ['a'],
    explanation: 'Because A.',
    difficulty: 'basic',
    tags: ['test'],
  },
  {
    id: 'multi',
    moduleId: 'station-map',
    prompt: 'Question 2',
    type: 'multi-select',
    options: [
      { id: 'a', label: 'A', rationale: 'Because A.' },
      { id: 'b', label: 'B', rationale: 'Because B.' },
      { id: 'c', label: 'C', rationale: 'Because C.' },
    ],
    correctOptionIds: ['a', 'c'],
    explanation: 'Because A and C.',
    difficulty: 'intermediate',
    tags: ['test'],
  },
  {
    id: 'ordering',
    moduleId: 'station-explorer',
    prompt: 'Question 3',
    type: 'ordering',
    options: [
      { id: 'one', label: 'One', rationale: 'Because one.' },
      { id: 'two', label: 'Two', rationale: 'Because two.' },
    ],
    correctOptionIds: ['one', 'two'],
    explanation: 'Because one then two.',
    difficulty: 'advanced',
    tags: ['test'],
  },
];

describe('isQuizAnswerCorrect', () => {
  it('treats multi-select answers as set equality', () => {
    expect(isQuizAnswerCorrect(questions[1], ['c', 'a'])).toBe(true);
    expect(isQuizAnswerCorrect(questions[1], ['a'])).toBe(false);
  });

  it('requires exact order for ordering questions', () => {
    expect(isQuizAnswerCorrect(questions[2], ['one', 'two'])).toBe(true);
    expect(isQuizAnswerCorrect(questions[2], ['two', 'one'])).toBe(false);
  });
});

describe('calculateQuizResult', () => {
  it('counts answered and correct questions separately across question types', () => {
    const result = calculateQuizResult([...questions], {
      single: ['a'],
      multi: ['a', 'c'],
    });

    expect(result.correctCount).toBe(2);
    expect(result.answeredCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.percent).toBe(67);
  });
});
