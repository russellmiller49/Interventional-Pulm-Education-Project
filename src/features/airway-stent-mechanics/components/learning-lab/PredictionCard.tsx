'use client'

import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface LearningChoice {
  id: string
  label: string
  rationale: string
}

export interface LearningPrompt {
  choices: LearningChoice[]
  correctChoiceId: string
  explanation: string
  id: string
  prompt: string
  stem?: string
  title: string
}

interface PredictionCardProps {
  committed: boolean
  eyebrow?: string
  onCommit: () => void
  onSelect: (choiceId: string) => void
  prompt: LearningPrompt
  selectedChoiceId?: string
}

export function PredictionCard({
  committed,
  eyebrow = 'Predict before reveal',
  onCommit,
  onSelect,
  prompt,
  selectedChoiceId,
}: PredictionCardProps) {
  const selectedChoice = prompt.choices.find((choice) => choice.id === selectedChoiceId)
  const isCorrect = committed && selectedChoiceId === prompt.correctChoiceId

  return (
    <section className="overflow-hidden rounded-3xl border border-indigo-500/25 bg-card shadow-sm">
      <div className="border-b border-indigo-500/20 bg-indigo-500/5 px-5 py-4 sm:px-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">
          <LockKeyhole className="h-4 w-4" aria-hidden />
          {eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{prompt.title}</h3>
        {prompt.stem ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{prompt.stem}</p>
        ) : null}
        <p className="mt-3 font-medium leading-6 text-foreground">{prompt.prompt}</p>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        <div className="grid gap-2" role="radiogroup" aria-label={prompt.prompt}>
          {prompt.choices.map((choice) => {
            const selected = selectedChoiceId === choice.id
            const correctChoice = committed && choice.id === prompt.correctChoiceId
            const selectedWrong = committed && selected && !correctChoice

            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={committed}
                onClick={() => onSelect(choice.id)}
                className={cn(
                  'rounded-2xl border p-4 text-left text-sm leading-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default motion-reduce:transition-none',
                  !committed && selected && 'border-indigo-500 bg-indigo-500/10',
                  !committed &&
                    !selected &&
                    'border-border bg-background hover:border-indigo-500/45',
                  correctChoice && 'border-emerald-500 bg-emerald-500/10',
                  selectedWrong && 'border-rose-500 bg-rose-500/10',
                )}
              >
                <span className="font-medium text-foreground">{choice.label}</span>
                {committed ? (
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {choice.rationale}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {!committed ? (
          <button
            type="button"
            onClick={onCommit}
            disabled={!selectedChoice}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
          >
            Commit and reveal
          </button>
        ) : (
          <div
            className={cn(
              'rounded-2xl border p-4 text-sm leading-6',
              isCorrect
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-amber-500/40 bg-amber-500/10',
            )}
            role="status"
            aria-live="polite"
          >
            <p className="flex items-center gap-2 font-semibold text-foreground">
              {isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              ) : (
                <CircleAlert className="h-5 w-5 text-amber-600" aria-hidden />
              )}
              {isCorrect
                ? 'Your prediction matches the evidence.'
                : 'Reframe the controlling variable.'}
            </p>
            <p className="mt-2 text-muted-foreground">{prompt.explanation}</p>
          </div>
        )}
      </div>
    </section>
  )
}
