'use client'

import { useState, type ReactNode } from 'react'

import { EducationalDisclaimer } from '@/features/pleural-procedures/components/EducationalDisclaimer'
import { HandoffContent } from '@/i18n/handoff'

export interface LessonScaffoldProps {
  title: string
  objectives: string[]
  clinicalAnchor?: ReactNode
  howToUse: string[]
  children: ReactNode
  reveal?: ReactNode
  revealed?: boolean
  canReveal?: boolean
  onReveal?: () => void
  revealLabel?: string
  keyTakeaway?: ReactNode
}

export function LessonScaffold({
  title,
  objectives,
  clinicalAnchor,
  howToUse,
  children,
  reveal,
  revealed = false,
  canReveal = true,
  onReveal,
  revealLabel = 'Check my answer',
  keyTakeaway,
}: LessonScaffoldProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false)

  return (
    <HandoffContent>
      {
        <section className="container space-y-6">
          <header className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              By the end of this module you can
            </p>
            <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-foreground">
              {objectives.map((objective) => (
                <li key={objective} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setInstructionsOpen((open) => !open)}
              aria-expanded={instructionsOpen}
              className="mt-4 text-sm font-medium text-sky-700 underline decoration-sky-500/50 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300"
            >
              {instructionsOpen ? 'Hide instructions' : 'How to use this screen'}
            </button>
            {instructionsOpen ? (
              <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm leading-6 text-muted-foreground">
                {howToUse.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
          </header>

          {clinicalAnchor ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-5 text-sm leading-6 text-foreground">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Clinical scenario
              </p>
              <div className="mt-2">{clinicalAnchor}</div>
            </div>
          ) : null}

          {children}

          {reveal ? (
            <div className="space-y-4">
              {!revealed ? (
                <button
                  type="button"
                  onClick={onReveal}
                  disabled={!canReveal}
                  className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canReveal ? revealLabel : 'Make a selection first'}
                </button>
              ) : (
                reveal
              )}
            </div>
          ) : null}

          {keyTakeaway && (!reveal || revealed) ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100">
              <p className="text-xs font-semibold uppercase tracking-wide">Key takeaway</p>
              <div className="mt-1">{keyTakeaway}</div>
            </div>
          ) : null}

          <EducationalDisclaimer />
        </section>
      }
    </HandoffContent>
  )
}
