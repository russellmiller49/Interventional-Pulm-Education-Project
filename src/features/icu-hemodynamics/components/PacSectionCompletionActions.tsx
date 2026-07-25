'use client'

import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'

interface PacSectionCompletionActionsProps {
  readonly sectionTitle: string
  readonly nextTitle?: string
  readonly continueLabel?: string
  readonly onRepeat: () => void
  readonly onContinue: () => void
}

export function PacSectionCompletionActions({
  sectionTitle,
  nextTitle,
  continueLabel,
  onRepeat,
  onContinue,
}: PacSectionCompletionActionsProps) {
  const resolvedContinueLabel =
    continueLabel ?? (nextTitle ? `Continue to next section: ${nextTitle}` : 'Continue')

  return (
    <section
      className="grid gap-3 rounded-xl border border-primary/35 bg-primary/5 p-3"
      aria-labelledby="pac-section-complete-heading"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">
            Section worked through
          </p>
          <h3 id="pac-section-complete-heading" className="mt-1 text-base font-semibold">
            Choose your next step
          </h3>
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        You worked through {sectionTitle}. Repeat it for another pass, or continue without returning
        to the pathway menu.
      </p>

      <div className="grid gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          onClick={onRepeat}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Repeat this section
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={onContinue}
        >
          {resolvedContinueLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
