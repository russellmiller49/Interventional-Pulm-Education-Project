import type { QuizQuestionContent } from '@/content/types';

export interface QuizResultItem {
  question: QuizQuestionContent;
  selectedOptionIds: string[];
  isCorrect: boolean;
}

export interface QuizResult {
  correctCount: number;
  totalCount: number;
  answeredCount: number;
  percent: number;
  items: QuizResultItem[];
}

export function calculateQuizResult(
  questions: QuizQuestionContent[],
  answers: Record<string, string[] | undefined>,
): QuizResult {
  const items = questions.map((question) => {
    const selectedOptionIds = answers[question.id] ?? [];
    const isCorrect = isQuizAnswerCorrect(question, selectedOptionIds);

    return {
      question,
      selectedOptionIds,
      isCorrect,
    };
  });

  const correctCount = items.filter((item) => item.isCorrect).length;
  const answeredCount = items.filter((item) => item.selectedOptionIds.length > 0).length;
  const totalCount = items.length;
  const percent = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);

  return {
    correctCount,
    totalCount,
    answeredCount,
    percent,
    items,
  };
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function isQuizAnswerCorrect(question: QuizQuestionContent, selectedOptionIds: string[]): boolean {
  if (selectedOptionIds.length === 0) {
    return false;
  }

  if (question.type === 'ordering') {
    return arraysEqual(selectedOptionIds, question.correctOptionIds);
  }

  const normalizedSelected = [...new Set(selectedOptionIds)].sort();
  const normalizedCorrect = [...new Set(question.correctOptionIds)].sort();

  return arraysEqual(normalizedSelected, normalizedCorrect);
}
