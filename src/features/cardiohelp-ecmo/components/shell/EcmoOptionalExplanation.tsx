'use client'

import { useId, useState, type ReactNode } from 'react'

/**
 * The ways past a question without answering it: show the answer, try again, or skip.
 *
 * This used to be a bordered box on every step, opening with "Optional practice. You can read the
 * explanation, try again, or move on." A tester (2026-10-13) met it on a reading step with nothing
 * to practise, then twice more, and asked for "a couple of buttons that say skip or show answers"
 * instead. So it is now only the buttons: each is offered when it can do something, and the hosts
 * leave the whole row out on a step that has no question and already has a way forward.
 */
export function EcmoOptionalExplanation({
  children,
  onRetry,
  onContinue,
}: {
  /** The answer and its reasoning. Left out, no "Show answer" button is drawn. */
  readonly children?: ReactNode
  readonly onRetry?: () => void
  readonly onContinue?: () => void
}) {
  const [open, setOpen] = useState(false)
  const explanationId = useId()
  const buttonClass =
    'min-h-10 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2'
  if (!children && !onRetry && !onContinue) return null
  return (
    <section aria-label="Answer and skip options" className="my-3 grid gap-3" data-optional-support>
      <div className="flex flex-wrap gap-2">
        {children ? (
          <button
            className={buttonClass}
            type="button"
            aria-expanded={open}
            aria-controls={explanationId}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide answer' : 'Show answer'}
          </button>
        ) : null}
        {onRetry ? (
          <button className={buttonClass} type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {onContinue ? (
          <button className={buttonClass} type="button" onClick={onContinue}>
            Skip
          </button>
        ) : null}
      </div>
      {children ? (
        <div id={explanationId}>
          {open ? (
            <div className="grid gap-2 rounded-xl border p-3" data-optional-explanation>
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
