'use client'

import type { ReactNode } from 'react'

import {
  drillBlockVisibility,
  useStageTeachingScope,
  type DrillBlockKind,
} from '../stage/StageTeachingScope'

/**
 * A teaching block that knows whether it is the focus of the current step.
 *
 * Outside a stage — the render harness, a panel test, the offline preview — there is no scope and
 * the block renders exactly as it always did. Inside a stage, a block that belongs to an earlier
 * phase folds to its heading, and a block that belongs to a later phase is not rendered. The
 * commitment gate inside `AfterCommitment` is independent of this and still decides what may be
 * said at all; this only decides what is open.
 */
export function StageBlock({
  kind,
  heading,
  children,
}: {
  readonly kind: DrillBlockKind
  readonly heading: string
  readonly children: ReactNode
}) {
  const scope = useStageTeachingScope()
  const visibility = drillBlockVisibility(kind, scope)
  if (visibility === 'hidden') return null
  if (visibility === 'collapsed') {
    return (
      <details data-stage-block={kind} data-stage-collapsed>
        <summary>{heading}</summary>
        {children}
      </details>
    )
  }
  return <div data-stage-block={kind}>{children}</div>
}
