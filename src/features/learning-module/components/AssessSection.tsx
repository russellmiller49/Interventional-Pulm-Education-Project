'use client'

import { Quiz, type QuizQuestion } from '@/components/training/Quiz'

interface AssessSectionProps {
  title: string
  intro?: string
  questions: QuizQuestion[]
}

/**
 * Thin wrapper over the shared Quiz used as the Assess section of a templated
 * module. Adds a short framing line above the commit-first question set.
 */
export function AssessSection({ title, intro, questions }: AssessSectionProps) {
  return (
    <div className="container max-w-4xl space-y-4">
      {intro ? <p className="text-sm leading-7 text-muted-foreground">{intro}</p> : null}
      <Quiz title={title} questions={questions} />
    </div>
  )
}
