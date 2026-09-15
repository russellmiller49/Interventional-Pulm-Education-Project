'use client'

import { useState } from 'react'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import type { CtJunctionAttempt, CtTrace } from '../content/ct-types'
import { STANDARD_ORIENTATION } from '../geometry/orientation'
import { NativeCtViewer } from './NativeCtViewer'

/**
 * Read-only snapshots of the learner's own responses at this junction, for comparison with the
 * current one. No hint use, support label or first-response status is shown.
 */
export function CtRouteAttemptHistory({
  trace,
  active,
  attempts,
}: {
  trace: CtTrace
  active: number
  attempts: CtJunctionAttempt[]
}) {
  const [review, setReview] = useState<number | null>(null)
  const attempt = review === null ? undefined : attempts[review]
  if (!attempts.length) return null
  return (
    <>
      <details>
        <summary>Your responses at this junction · {attempts.length}</summary>
        {attempts.map((item, i) => (
          <p key={i}>
            Response {i + 1} · {item.mark.pixel ? 'lumen marked' : 'lumen unresolved'}.{' '}
            <button onClick={() => setReview(i)}>Inspect response {i + 1}</button>
          </p>
        ))}
      </details>
      <HelpDialog
        open={Boolean(attempt)}
        onClose={() => setReview(null)}
        title="Recorded response · review only"
      >
        {attempt && (
          <>
            <p>
              This saved response remains separate from your current attempt.{' '}
              {attempt.mark.pixel ? 'Lumen mark recorded' : 'Lumen unresolved'} on slice{' '}
              {attempt.mark.slice}.{' '}
              {attempt.branch === 'unresolved'
                ? 'Continuation unresolved.'
                : attempt.branch !== null
                  ? `Selected ${trace.checkpoints[active].decision?.options.find((o) => o.sourceEdgeId === attempt.branch)?.label}.`
                  : ''}
            </p>
            {!attempt.orientation && (
              <p>The earlier display was not recorded. This review uses standard axial.</p>
            )}
            <NativeCtViewer
              trace={trace}
              active={active}
              local
              marks={trace.checkpoints.map((_, i) => (i === active ? attempt.mark : null))}
              orientation={attempt.orientation ?? STANDARD_ORIENTATION}
              orientationControls={false}
              scopeAvailable={false}
              initialView={{
                slice: attempt.mark.slice,
                focus: 'junction',
                full: false,
                magnification: 1,
                showNodule: false,
                showScope: false,
              }}
            />
          </>
        )}
      </HelpDialog>
    </>
  )
}
