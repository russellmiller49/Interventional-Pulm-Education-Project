'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

import { icuHemodynamicsReducer } from '../../engine/reducer'
import type { HemodynamicAction, HemodynamicSimulationState } from '../../engine/types'

export type StageEngineAction =
  | HemodynamicAction
  | { readonly type: 'STAGE_LOAD'; readonly state: HemodynamicSimulationState }

function stageReducer(
  state: HemodynamicSimulationState,
  action: StageEngineAction,
): HemodynamicSimulationState {
  if (action.type === 'STAGE_LOAD') return action.state
  return icuHemodynamicsReducer(state, action)
}

/**
 * The one engine a section runs on, ticking.
 *
 * Ten ticks a second, four under reduced motion — the cadence the previous Learn surfaces used.
 * `load` replaces the state wholesale; it is how a step's entry state and a restart arrive, and
 * nothing else in the host reaches into the state. The tick pauses while the document is hidden
 * so a background tab does not run the patient on at full speed and then jump.
 */
export function useHemodynamicsStageSession(initial: () => HemodynamicSimulationState) {
  const [state, dispatch] = useReducer(stageReducer, undefined, initial)
  const lastTick = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const intervalMs = reduceMotion ? 250 : 100
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        lastTick.current = null
        return
      }
      dispatch({ type: 'TICK', seconds: intervalMs / 1000 })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [])

  const load = useCallback((next: HemodynamicSimulationState) => {
    dispatch({ type: 'STAGE_LOAD', state: next })
  }, [])

  return { state, dispatch, load }
}
