import type { PretestQuestionContent } from '@/content/types';

export interface PretestResult {
  correctCount: number;
  answeredCount: number;
  totalCount: number;
  percent: number;
}

export function scorePretest(questions: PretestQuestionContent[], answers: Record<string, string | undefined>): PretestResult {
  const correctCount = questions.filter((question) => answers[question.id] === question.correctOptionId).length;
  const answeredCount = questions.filter((question) => Boolean(answers[question.id])).length;
  const totalCount = questions.length;

  return {
    correctCount,
    answeredCount,
    totalCount,
    percent: totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100),
  };
}

export function getFirstUnansweredQuestionIndex(
  questions: PretestQuestionContent[],
  answers: Record<string, string | undefined>,
) {
  return questions.findIndex((question) => !answers[question.id]);
}

export function getNextUnansweredQuestionIndex(
  questions: PretestQuestionContent[],
  answers: Record<string, string | undefined>,
  fromIndex: number,
) {
  if (questions.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= questions.length; offset += 1) {
    const index = (fromIndex + offset) % questions.length;

    if (!answers[questions[index].id]) {
      return index;
    }
  }

  return -1;
}
