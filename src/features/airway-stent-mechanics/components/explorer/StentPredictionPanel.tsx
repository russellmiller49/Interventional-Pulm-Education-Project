'use client'

import { CheckCircle2, Eye, RotateCcw, SkipForward } from 'lucide-react'

import { cn } from '@/lib/cn'

import type { StentExplorerStation } from '../../explorer/types'

interface StentPredictionPanelProps {
  compact?: boolean
  committed: boolean
  onCommit: () => void
  onReset: () => void
  onSelect: (choiceId: string) => void
  onSkip: () => void
  selectedChoiceId: string | null
  skipped: boolean
  station: StentExplorerStation
}

export function StentPredictionPanel({
  compact = false,
  committed,
  onCommit,
  onReset,
  onSelect,
  onSkip,
  selectedChoiceId,
  skipped,
  station,
}: StentPredictionPanelProps) {
  const selectedChoice = station.prediction.choices.find((choice) => choice.id === selectedChoiceId)
  const matchesModel = committed && selectedChoiceId === station.prediction.bestChoiceId

  return (
    <section
      className={cn(
        'overflow-hidden border border-indigo-500/25 bg-card shadow-sm',
        compact ? 'rounded-2xl' : 'rounded-3xl',
      )}
      aria-labelledby="stent-explorer-prediction-title"
    >
      <header
        className={cn(
          'border-b border-indigo-500/20 bg-indigo-500/5',
          compact ? 'p-4' : 'p-5 sm:p-6',
        )}
      >
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">
          <Eye className="h-4 w-4" aria-hidden />
          Optional self-check · no score
        </p>
        <h3
          id="stent-explorer-prediction-title"
          className={cn('mt-2 font-bold', compact ? 'text-lg' : 'text-xl')}
        >
          Predict before the consequence is shown
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {station.prediction.instruction}
        </p>
        <p className="mt-3 font-semibold leading-6">{station.prediction.question}</p>
      </header>

      <div className={cn('space-y-4', compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="grid gap-2" role="radiogroup" aria-label={station.prediction.question}>
          {station.prediction.choices.map((choice) => {
            const selected = selectedChoiceId === choice.id
            const modelMatch = committed && choice.id === station.prediction.bestChoiceId
            return (
              <label
                key={choice.id}
                className={cn(
                  'relative block rounded-2xl border text-left text-sm leading-6 transition-colors has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 motion-reduce:transition-none',
                  compact ? 'p-3' : 'p-4',
                  (committed || skipped) && 'cursor-default',
                  !committed && selected && 'border-indigo-500 bg-indigo-500/10',
                  !committed && !selected && 'bg-background hover:border-indigo-500/50',
                  modelMatch && 'border-emerald-500/50 bg-emerald-500/10',
                  committed && selected && !modelMatch && 'border-amber-500/50 bg-amber-500/10',
                  committed && !selected && !modelMatch && 'opacity-65',
                )}
              >
                <input
                  type="radio"
                  name={`stent-prediction-${station.id}`}
                  value={choice.id}
                  checked={selected}
                  disabled={committed || skipped}
                  onChange={() => onSelect(choice.id)}
                  className="sr-only"
                />
                <span className="font-semibold">{choice.label}</span>
                {committed ? (
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {choice.rationale}
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>

        {!committed && !skipped ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={!selectedChoice}
              onClick={onCommit}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              Commit prediction and animate
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-background px-5 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:w-auto"
            >
              <SkipForward className="h-4 w-4" aria-hidden />
              Skip prediction and explore
            </button>
          </div>
        ) : committed ? (
          <div
            className={cn(
              'rounded-2xl border p-4 text-sm leading-6',
              matchesModel
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-amber-500/40 bg-amber-500/10',
            )}
            role="status"
            aria-live="polite"
          >
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2
                className={cn('h-5 w-5', matchesModel ? 'text-emerald-600' : 'text-amber-600')}
                aria-hidden
              />
              {matchesModel
                ? 'Your prediction matches this qualitative model.'
                : 'Compare your prediction with the highlighted mechanism.'}
            </p>
            <p className="mt-2 text-muted-foreground">
              This is an unscored comparison. The animation explains what to inspect; it does not
              predict an individual outcome.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Try another prediction
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-4 text-sm leading-6"
            role="status"
            aria-live="polite"
          >
            <p className="flex items-center gap-2 font-semibold">
              <SkipForward className="h-5 w-5 text-cyan-600" aria-hidden />
              Exploration unlocked without a prediction.
            </p>
            <p className="mt-2 text-muted-foreground">
              No answer or score was recorded. Advanced views, playback, hotspots, and the clinical
              debrief are now available.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Make a prediction instead
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
