'use client'

import { useState, type ReactNode } from 'react'

/**
 * LessonScaffold — the shared pedagogical spine for every pleural module.
 *
 * Fixes the systemic "control panel, not a lesson" problem by giving every
 * module the same predictable structure:
 *
 *   Objective  ->  Clinical anchor  ->  How to use  ->  [interactive]
 *              ->  (commit gate)  ->  Reveal  ->  Key takeaway  ->  Disclaimer
 *
 * Modules render their interactive UI as children. They drive the commit gate
 * via the `revealed` / `onReveal` props so the learner always thinks before
 * seeing the answer. Anything passed to `reveal` is hidden until the learner
 * commits.
 *
 * Place at: src/components/learning/LessonScaffold.tsx
 */

export interface LessonScaffoldProps {
  /** One-line module title, learner-facing (no internal codes). */
  title: string
  /** 2-4 concrete, testable objectives ("classify...", "state...", "decide..."). */
  objectives: string[]
  /** Short clinical vignette that gives the controls a reason to exist. Optional. */
  clinicalAnchor?: ReactNode
  /** Plain-language "what to do on this screen", 1-3 steps. */
  howToUse: string[]
  /** The interactive UI (controls, image, sliders, choices). */
  children: ReactNode
  /**
   * Commit gate. When `reveal` is provided, it stays hidden until `revealed`
   * is true. The module owns the state and passes a handler so it can require
   * an answer before allowing reveal.
   */
  reveal?: ReactNode
  revealed?: boolean
  onReveal?: () => void
  /** Disabled until the learner has made a choice. */
  canReveal?: boolean
  revealLabel?: string
  /** One or two sentences the learner should leave with. */
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
  onReveal,
  canReveal = true,
  revealLabel = 'Check my answer',
  keyTakeaway,
}: LessonScaffoldProps) {
  const [howToOpen, setHowToOpen] = useState(false)

  return (
    <section className="container space-y-6 py-4">
      {/* Objectives — always visible, sets the frame */}
      <header className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
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
          onClick={() => setHowToOpen((open) => !open)}
          aria-expanded={howToOpen}
          className="mt-4 text-sm font-medium text-sky-700 underline decoration-sky-500/50 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300"
        >
          {howToOpen ? 'Hide instructions' : 'How to use this screen'}
        </button>
        {howToOpen ? (
          <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm leading-6 text-muted-foreground">
            {howToUse.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
      </header>

      {/* Clinical anchor — the case that motivates the interaction */}
      {clinicalAnchor ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-5 text-sm leading-6 text-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Clinical scenario
          </p>
          <div className="mt-2">{clinicalAnchor}</div>
        </div>
      ) : null}

      {/* The module's own interactive UI */}
      {children}

      {/* Commit gate + reveal */}
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

      {/* Key takeaway — only meaningful once revealed (or always, if no reveal) */}
      {keyTakeaway && (!reveal || revealed) ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide">Key takeaway</p>
          <div className="mt-1">{keyTakeaway}</div>
        </div>
      ) : null}

      {/* Educational-only disclaimer — every module, every time */}
      <p className="text-xs leading-5 text-muted-foreground">
        Educational only. Not patient-specific medical advice. Local protocols and current society
        guidance govern patient care.
      </p>
    </section>
  )
}
