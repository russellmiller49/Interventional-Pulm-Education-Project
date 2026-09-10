import knobologyQuizData from '../../../../content/quizzes/knobology-advanced.json';
import mediastinalQuizData from '../../../../content/quizzes/mediastinal-anatomy.json';
import proceduralQuizData from '../../../../content/quizzes/procedural-technique.json';
import sonographicQuizData from '../../../../content/quizzes/sonographic-interpretation.json';
import stagingQuizData from '../../../../content/quizzes/staging-strategy.json';

import type { QuizQuestionContent, RootModuleId } from '@/content/types';

export const quizQuestions = [
  ...(knobologyQuizData as QuizQuestionContent[]),
  ...(mediastinalQuizData as QuizQuestionContent[]),
  ...(sonographicQuizData as QuizQuestionContent[]),
  ...(proceduralQuizData as QuizQuestionContent[]),
  ...(stagingQuizData as QuizQuestionContent[]),
];

export function getQuizQuestions(moduleId?: RootModuleId): QuizQuestionContent[] {
  if (!moduleId) {
    return quizQuestions;
  }

  return quizQuestions.filter((question) => question.moduleId === moduleId);
}
