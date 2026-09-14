import { useState } from 'react'
import type { BronchStageStep } from '../../content/stageLessons'
import { scopeViewOfStep } from '../../content/stageLessons'
import type { ScopeCase } from '../../engine/scope/scopeCase'
import { createScopeState, reduceScope } from '../../engine/scope/scopeReducer'
import type { ScopeRuntimeState } from '../../engine/scope/scopeRuntime'

/** Isolated from the learner reducer and persistence. Discrete playback also respects reduced motion. */
export function useScopeDemonstration(step: BronchStageStep, scopeCase: ScopeCase | null) {
  const [demo, setDemo] = useState<{
    stepId: string
    index: number
    state: ScopeRuntimeState
  } | null>(null)
  const active = demo?.stepId === step.id ? demo : null
  const moves = step.learn?.demonstration ?? step.course?.demonstration ?? []
  const view = scopeViewOfStep(step)
  function show(index: number) {
    if (!view || !moves[index]) return
    setDemo((current) => {
      const previous =
        index === 0 || current?.stepId !== step.id
          ? createScopeState(view, scopeCase)
          : current.state
      return {
        stepId: step.id,
        index,
        state: reduceScope(previous, moves[index].command, 'scripted', { view, scopeCase }),
      }
    })
  }
  return {
    state: active?.state,
    caption: active ? moves[active.index]?.caption : undefined,
    finished: !!active && active.index === moves.length - 1,
    start: () => show(0),
    next: () => show((active?.index ?? -1) + 1),
    stop: () => setDemo(null),
  }
}
