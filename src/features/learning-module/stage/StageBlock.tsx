'use client'

import type { ReactNode } from 'react'

import {
  stageBlockVisibility,
  useStageTeachingScope,
  type StageBlockKind,
  type StageBlockVisibility,
} from './StageTeachingScope'

/**
 * A teaching block that knows whether it is the focus of the current step.
 *
 * Outside a stage there is no scope and the block renders exactly as it always did. Inside a
 * stage, a block that belongs to an earlier phase folds to its heading, and a block that belongs to
 * a later phase is not rendered. A caller may pass its own `visibility` when the decision is not
 * phase-shaped (a block that is the focus of exactly the steps that name it).
 */
export function StageBlock({
  kind,
  heading,
  visibility,
  children,
}: {
  readonly kind: StageBlockKind
  readonly heading: string
  readonly visibility?: StageBlockVisibility
  readonly children: ReactNode
}) {
  const scope = useStageTeachingScope()
  const resolved = visibility ?? stageBlockVisibility(kind, scope)
  if (resolved === 'hidden') return null
  if (resolved === 'collapsed') {
    return (
      <details data-stage-block={kind} data-stage-collapsed>
        <summary>{heading}</summary>
        {children}
      </details>
    )
  }
  return <div data-stage-block={kind}>{children}</div>
}
