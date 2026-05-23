'use client'

import { useMemo, useState } from 'react'

import { chestDrainageQuizItems } from '../content/quizItems'

export function AssessmentPanel() {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const answeredCount = Object.keys(answers).length
  const score = useMemo(() => {
    if (!answeredCount) {
      return 0
    }

    const correct = chestDrainageQuizItems.filter(
      (item) => answers[item.id] === item.answerIndex,
    ).length

    return Math.round((correct / chestDrainageQuizItems.length) * 100)
  }, [answeredCount, answers])

  return (
    <section className="container space-y-6">
      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Chest drainage assessment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mixed knobology and troubleshooting checks with immediate debrief.
            </p>
          </div>
          <div className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground">
            Score {score}%
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        {chestDrainageQuizItems.map((item, itemIndex) => {
          const selectedAnswer = answers[item.id]
          const answered = selectedAnswer !== undefined
          const correct = selectedAnswer === item.answerIndex

          return (
            <article
              key={item.id}
              className="rounded-lg border border-border/80 bg-card p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold leading-7 text-foreground">
                {itemIndex + 1}. {item.prompt}
              </h3>
              <div className="mt-4 grid gap-2">
                {item.choices.map((choice, choiceIndex) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() =>
                      setAnswers((current) => ({ ...current, [item.id]: choiceIndex }))
                    }
                    className={
                      answered && choiceIndex === item.answerIndex
                        ? 'rounded-lg border border-emerald-500 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : selectedAnswer === choiceIndex
                          ? 'rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-left text-sm text-red-950 dark:bg-red-950/30 dark:text-red-100'
                          : 'rounded-lg border border-border bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    }
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {answered ? (
                <p
                  className={
                    correct
                      ? 'mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                      : 'mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100'
                  }
                  aria-live="polite"
                >
                  {item.explanation}
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
