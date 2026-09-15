'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { StagePhase } from './stageModel'

/**
 * What the teaching pane is allowed to foreground right now.
 *
 * The stage publishes the current step's phase and whether the prediction has been committed;
 * teaching blocks consult it to decide whether they are the focus, a collapsed earlier block, or
 * not yet due. With no provider — the render harness, a panel test, the offline preview — the scope
 * is null and every block renders as it always has. The four introductory foundations select an ordinary teaching block explicitly; their independent
 * case reasoning is mounted separately. Drill explanations can always be opened.
 */
export interface StageTeachingScopeValue {
  readonly phase: StagePhase
  readonly predictionCommitted: boolean
  readonly stepId: string
  readonly foundationBlock?: string
  readonly focusedPresentation?: boolean
  readonly teachingSections?: readonly string[]
  readonly baselineGroup?: string
  /** Context and the existing Continue action, repeated beside reading in a single-pane view. */
  readonly foundationNavigation?: {
    readonly instruction: string
    readonly nextTitle: string
    readonly onContinue: () => void
  }
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

export type DrillBlockKind =
  | 'question'
  | 'signals'
  | 'pattern'
  | 'discriminators'
  | 'after-commitment'
  | 'boundary'

export type StageBlockVisibility = 'shown' | 'collapsed' | 'hidden'

/**
 * Which drill teaching blocks are the focus at each phase.
 *
 * Recognize and Predict foreground the question and the live signals. Act and Observe keep the
 * signals open and fold the question away. Explain and Transfer foreground mechanism teaching.
 * Other blocks and model boundaries remain available as disclosures without a prediction.
 */
export function drillBlockVisibility(
  kind: DrillBlockKind,
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
          : 'collapsed'
    case 'boundary':
      if (phase === 'explain') return 'shown'
      return 'collapsed'
    default:
      return 'shown'
  }
}
