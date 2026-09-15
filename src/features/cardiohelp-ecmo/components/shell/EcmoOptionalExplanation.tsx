'use client'

import { useId, useState, type ReactNode } from 'react'

export function EcmoOptionalExplanation({
  children,
  onRetry,
  onContinue,
}: {
  readonly children: ReactNode
  readonly onRetry?: () => void
  readonly onContinue?: () => void
}) {
  const [open, setOpen] = useState(false)
  const explanationId = useId()
  const buttonClass =
    'min-h-10 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2'
  return (
    <section
      aria-label="Optional learning support"
      className="my-4 grid gap-3 rounded-xl border p-3"
    >
      <p>Optional practice. You can read the explanation, try again, or move on.</p>
      <div className="flex flex-wrap gap-3">
        <button
          className={buttonClass}
          type="button"
          aria-expanded={open}
          aria-controls={explanationId}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide explanation' : 'Show explanation without answering'}
        </button>
        {onRetry ? (
          <button className={buttonClass} type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {onContinue ? (
          <button className={buttonClass} type="button" onClick={onContinue}>
            Continue without doing this step
          </button>
        ) : null}
      </div>
      <div id={explanationId}>{open ? <div data-optional-explanation>{children}</div> : null}</div>
    </section>
  )
}
