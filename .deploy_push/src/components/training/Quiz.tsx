'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export interface QuizQuestion {
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
}

export interface QuizProps {
  title: string
  questions: QuizQuestion[]
}

export function Quiz({ title, questions }: QuizProps) {
  const [selected, setSelected] = useState<Record<number, number | null>>({})
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})

  const progress = useMemo(() => {
    const answered = Object.values(revealed).filter(Boolean).length
    return {
      answered,
      total: questions.length,
      percent: Math.round((answered / questions.length) * 100) || 0,
    }
  }, [questions.length, revealed])

  return (
    <div className="space-y-6 rounded-3xl border border-border/70 bg-card/70 p-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">
          Select an answer to reveal the explanation. Responses are stored locally for now; LMS sync
          arrives with analytics.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>
          Progress · {progress.answered}/{progress.total} questions answered
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setSelected({})
              setRevealed({})
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((question, index) => {
          const choice = selected[index] ?? null
          const isCorrect = choice !== null && choice === question.answerIndex
          const isRevealed = revealed[index] ?? false
          return (
            <div
              key={question.prompt}
              className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4"
            >
              <h4 className="text-sm font-semibold text-foreground">
                Q{index + 1}. {question.prompt}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {question.options.map((option, optionIndex) => {
                  const active = choice === optionIndex
                  const correct = optionIndex === question.answerIndex
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected((prev) => ({ ...prev, [index]: optionIndex }))
                          setRevealed((prev) => ({ ...prev, [index]: false }))
                        }}
                        className={cn(
                          'w-full rounded-xl border px-4 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active && isRevealed
                            ? correct
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                              : 'border-destructive bg-destructive/10 text-destructive'
                            : active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/60 hover:border-border text-muted-foreground',
                        )}
                        aria-pressed={active}
                      >
                        {option}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={isRevealed ? 'outline' : 'secondary'}
                  onClick={() => {
                    if (choice === null) {
                      return
                    }
                    setRevealed((prev) => ({ ...prev, [index]: !prev[index] }))
                  }}
                  disabled={choice === null}
                >
                  {isRevealed
                    ? 'Hide explanation'
                    : choice === null
                      ? 'Select an answer'
                      : 'Check answer'}
                </Button>
                {choice !== null && !isRevealed ? (
                  <span className="text-xs text-muted-foreground/80">
                    Select “Check answer” to reveal feedback.
                  </span>
                ) : null}
              </div>
              {choice !== null && isRevealed ? (
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm',
                    isCorrect
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600'
                      : 'border-destructive/60 bg-destructive/10 text-destructive',
                  )}
                >
                  {question.explanation}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
