'use client'

import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { mechanicsScenarios } from '@/features/airway-stent-mechanics/content/curriculum'
import { cn } from '@/lib/cn'

export function MechanicsChallenge() {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const scenario = mechanicsScenarios[scenarioIndex]
  const correct = revealed && selected === scenario.bestChoiceId

  function moveTo(index: number) {
    setScenarioIndex(index)
    setSelected(null)
    setRevealed(false)
  }

  function reveal() {
    if (!selected) return
    setRevealed(true)
    setCompleted((current) => ({
      ...current,
      [scenario.id]: selected === scenario.bestChoiceId,
    }))
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm">
      <div className="border-b bg-muted/30 px-5 py-4 md:flex md:items-center md:justify-between md:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
            Commit before reveal
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">
            Mechanics challenge {scenarioIndex + 1} of {mechanicsScenarios.length}
          </h3>
        </div>
        <div className="mt-3 flex gap-2 md:mt-0" aria-label="Challenge progress">
          {mechanicsScenarios.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => moveTo(index)}
              aria-label={`Open challenge ${index + 1}: ${item.title}`}
              aria-current={index === scenarioIndex ? 'step' : undefined}
              className={cn(
                'h-2.5 w-9 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === scenarioIndex
                  ? 'bg-violet-600'
                  : completed[item.id]
                    ? 'bg-emerald-500'
                    : 'bg-border',
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:p-7">
        <div>
          <h4 className="text-2xl font-semibold text-foreground">{scenario.title}</h4>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{scenario.stem}</p>
          <p className="mt-5 text-base font-semibold leading-7 text-foreground">
            {scenario.prompt}
          </p>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Relevant source references:{' '}
            {scenario.sourceRefs.map((reference) => `[${reference}]`).join(', ')}
          </p>
        </div>

        <div className="space-y-3">
          {scenario.choices.map((choice) => {
            const isSelected = selected === choice.id
            const isCorrect = choice.id === scenario.bestChoiceId
            return (
              <button
                key={choice.id}
                type="button"
                disabled={revealed}
                onClick={() => setSelected(choice.id)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                  !revealed && isSelected && 'border-violet-500 bg-violet-500/10',
                  !revealed &&
                    !isSelected &&
                    'border-border bg-background hover:border-violet-500/40',
                  revealed && isCorrect && 'border-emerald-500/60 bg-emerald-500/10',
                  revealed && isSelected && !isCorrect && 'border-rose-500/60 bg-rose-500/10',
                  revealed && !isCorrect && !isSelected && 'border-border bg-muted/20 opacity-60',
                )}
              >
                <span className="flex items-start gap-3">
                  {revealed && isCorrect ? (
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                  ) : revealed && isSelected ? (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
                  ) : (
                    <span
                      className={cn(
                        'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2',
                        isSelected
                          ? 'border-violet-600 bg-violet-600 shadow-[inset_0_0_0_4px_white]'
                          : 'border-border',
                      )}
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {choice.label}
                    </span>
                    {revealed ? (
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {choice.rationale}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            )
          })}

          {!revealed ? (
            <Button
              type="button"
              onClick={reveal}
              disabled={!selected}
              className="mt-2 w-full sm:w-auto"
            >
              Lock answer and reveal mechanics
            </Button>
          ) : (
            <div
              className={cn(
                'rounded-2xl border p-4 text-sm leading-6',
                correct
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
              )}
              role="status"
            >
              <p className="font-semibold">
                {correct ? 'Mechanically sound.' : 'Reframe the variable.'}
              </p>
              <p className="mt-1">{scenario.explanation}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => moveTo(Math.max(0, scenarioIndex - 1))}
          disabled={scenarioIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelected(null)
            setRevealed(false)
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Retry this challenge
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => moveTo(Math.min(mechanicsScenarios.length - 1, scenarioIndex + 1))}
          disabled={scenarioIndex === mechanicsScenarios.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
