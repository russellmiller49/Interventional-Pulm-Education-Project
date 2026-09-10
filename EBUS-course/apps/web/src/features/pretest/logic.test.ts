import { describe, expect, it } from 'vitest';

import { getFirstUnansweredQuestionIndex, getNextUnansweredQuestionIndex, scorePretest } from '@/features/pretest/logic';

describe('pretest logic', () => {
  const questions = [
    { id: 'q1', correctOptionId: 'a', options: [] },
    { id: 'q2', correctOptionId: 'c', options: [] },
    { id: 'q3', correctOptionId: 'b', options: [] },
  ] as const;

  it('scores pretest answers without explanation state', () => {
    const result = scorePretest(questions as never, {
      q1: 'a',
      q2: 'b',
      q3: 'b',
    });

    expect(result).toMatchObject({
      correctCount: 2,
      answeredCount: 3,
      totalCount: 3,
      percent: 67,
    });
  });

  it('finds unanswered questions and wraps around the list', () => {
    const answers = {
      q1: 'a',
      q3: 'b',
    };

    expect(getFirstUnansweredQuestionIndex(questions as never, answers)).toBe(1);
    expect(getNextUnansweredQuestionIndex(questions as never, answers, 2)).toBe(1);
  });
});
