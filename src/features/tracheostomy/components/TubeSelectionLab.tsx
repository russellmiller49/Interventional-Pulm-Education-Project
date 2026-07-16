'use client'

import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { tracheostomyTubeCases } from '../content/tubeCases'

export function TubeSelectionLab() {
  const [caseIndex, setCaseIndex] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const current = tracheostomyTubeCases[caseIndex]
  const correct = choice === current.answerId

  function chooseCase(index: number) {
    setCaseIndex(index)
    setChoice(null)
    setRevealed(false)
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
          Tube selection lab
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Choose by function and anatomy—not the size stamped on the flange
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manufacturer sizes are not standardized. Commit to the most relevant design feature, then
          compare the benefit with the new tradeoff it creates.
        </p>
      </div>

      <div className="grid md:grid-cols-[230px_minmax(0,1fr)]">
        <div className="border-b border-border/70 p-3 md:border-b-0 md:border-r">
          <div
            className="grid grid-cols-2 gap-2 md:grid-cols-1"
            role="tablist"
            aria-label="Tube cases"
          >
            {tracheostomyTubeCases.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === caseIndex}
                onClick={() => chooseCase(index)}
                className={cn(
                  'rounded-xl border p-3 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === caseIndex
                    ? 'border-sky-500 bg-sky-500/10 text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/30',
                )}
              >
                <span className="mr-2 text-sky-600 dark:text-sky-300">0{index + 1}</span>
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 p-5 md:p-7" role="tabpanel">
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Clinical frame
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">{current.scenario}</p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-semibold text-foreground">{current.question}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {current.options.map((option) => {
                const active = option.id === choice
                const isAnswer = option.id === current.answerId
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setChoice(option.id)
                      setRevealed(false)
                    }}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border p-3 text-left text-sm leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      revealed && active
                        ? isAnswer
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                          : 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                        : active
                          ? 'border-sky-500 bg-sky-500/10 text-foreground'
                          : 'border-border/70 bg-background hover:border-sky-500/50',
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!choice} onClick={() => setRevealed(true)}>
              {choice ? 'Check this choice' : 'Choose a design feature'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setChoice(null)
                setRevealed(false)
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset case
            </Button>
          </div>

          {revealed ? (
            <div
              className={cn(
                'space-y-3 rounded-2xl border p-4 text-sm leading-6',
                correct
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-rose-500/40 bg-rose-500/5',
              )}
              role="status"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={cn('h-5 w-5', correct ? 'text-emerald-500' : 'text-rose-500')}
                  aria-hidden
                />
                <p className="font-semibold text-foreground">
                  {correct
                    ? 'Best match for the stated problem'
                    : 'Reframe the problem before choosing the tube'}
                </p>
              </div>
              <p className="text-muted-foreground">{current.rationale}</p>
              <p className="rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Tradeoff to carry forward:</span>{' '}
                {current.tradeoff}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
