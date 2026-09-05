'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { StagePhase } from './stageModel'

/**
 * What the teaching pane is allowed to foreground right now.
 *
 * The stage publishes the current step's phase and whether the prediction has been committed;
 * teaching blocks consult it to decide whether they are the focus, a collapsed earlier block, or
 * not yet due. With no provider — the render harness, a panel test, the offline preview — the scope
 * is null and every block renders as it always has. The scope only ever narrows what is shown; the
 * commitment gate inside a panel is independent of it and decides what may be said at all.
 */
export interface StageTeachingScopeValue {
  readonly phase: StagePhase
  readonly predictionCommitted: boolean
  readonly stepId: string
}

const StageTeachingScopeContext = createContext<StageTeachingScopeValue | null>(null)

export function StageTeachingScope({
  value,
  children,
}: {
  readonly value: StageTeachingScopeValue
  readonly children: ReactNode
}) {
  return (
    <StageTeachingScopeContext.Provider value={value}>
      {children}
    </StageTeachingScopeContext.Provider>
  )
}

export function useStageTeachingScope(): StageTeachingScopeValue | null {
  return useContext(StageTeachingScopeContext)
}

export type StageBlockKind =
  | 'question'
  | 'signals'
  | 'pattern'
  | 'discriminators'
  | 'after-commitment'
  | 'boundary'

export type StageBlockVisibility = 'shown' | 'collapsed' | 'hidden'

/**
 * Which teaching blocks are the focus at each phase.
 *
 * Recognize and Predict foreground the question and the live signals. Act and Observe keep the
 * signals open and fold the question away. Explain and Transfer foreground the post-commitment
 * blocks and fold the reading blocks. Boundaries say what the model leaves out of the mechanism,
 * so they are read once the mechanism is the learner's to read: absent until the prediction is
 * committed, reachable after it, and open only at Explain.
 */
export function stageBlockVisibility(
  kind: StageBlockKind,
  scope: StageTeachingScopeValue | null,
): StageBlockVisibility {
  if (!scope) return 'shown'
  const { phase } = scope
  switch (kind) {
    case 'question':
      return phase === 'recognize' || phase === 'predict' ? 'shown' : 'collapsed'
    case 'signals':
    case 'pattern':
      return phase === 'explain' || phase === 'transfer' ? 'collapsed' : 'shown'
    case 'discriminators':
      return phase === 'predict' ? 'shown' : 'collapsed'
    case 'after-commitment':
      return phase === 'explain' || phase === 'transfer'
        ? 'shown'
        : phase === 'act' || phase === 'observe'
          ? 'collapsed'
          : 'hidden'
    case 'boundary':
      if (phase === 'explain') return 'shown'
      return scope.predictionCommitted ? 'collapsed' : 'hidden'
    default:
      return 'shown'
  }
}
