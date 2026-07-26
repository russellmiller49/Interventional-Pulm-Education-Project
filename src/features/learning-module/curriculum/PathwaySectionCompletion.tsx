'use client'

import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'

interface PathwaySectionCompletionProps {
  readonly sectionTitle: string
  /** Title of the next authored section. Omitted at the end of the pathway. */
  readonly nextTitle?: string
  /** Module-appropriate label used when there is no next section, e.g. "Go to Practice cases". */
  readonly endOfPathwayLabel?: string
  readonly onRepeat: () => void
  readonly onContinue: () => void
}

/**
 * Section-completion actions. The continue label names the next section so the learner never has
 * to return to the pathway menu to find out what follows.
 */
export function PathwaySectionCompletion({
  sectionTitle,
  nextTitle,
  endOfPathwayLabel = 'Continue',
  onRepeat,
  onContinue,
}: PathwaySectionCompletionProps) {
  const continueLabel = nextTitle ? `Continue to next section: ${nextTitle}` : endOfPathwayLabel

  return (
    <section
      className="grid gap-3 rounded-xl border border-primary/35 bg-primary/5 p-3"
      aria-labelledby="pathway-section-complete-heading"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">
            Section worked through
          </p>
          <h3 id="pathway-section-complete-heading" className="mt-1 text-base font-semibold">
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
          {continueLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
