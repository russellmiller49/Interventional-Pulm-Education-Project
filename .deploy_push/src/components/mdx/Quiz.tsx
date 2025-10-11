import type { QuizQuestion } from '@/components/training/Quiz'
import { Quiz } from '@/components/training/Quiz'

interface MDXQuizProps {
  title: string
  questions: QuizQuestion[]
}

export function MDXQuiz({ title, questions }: MDXQuizProps) {
  return <Quiz title={title} questions={questions} />
}
