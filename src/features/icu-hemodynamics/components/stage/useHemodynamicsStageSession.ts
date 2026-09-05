'use client'

import { useCallback, useEffect, useReducer } from 'react'

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
 * Ten ticks a second, four under reduced motion — the cadence the previous Learn surfaces used —
 * each tick advancing the patient by the wall-clock time since the last one, capped at a second.
 * A background tab throttles the interval to once a second; measuring the interval keeps
 * simulated time tracking real time there instead of running at a tenth of it, and the cap keeps
 * a long-hidden tab from replaying minutes in one step when it comes back. `load` replaces the
 * state wholesale; it is how a step's entry state and a restart arrive, and nothing else in the
 * host reaches into the state.
 */
export const STAGE_TICK_CAP_SECONDS = 1

export function useHemodynamicsStageSession(initial: () => HemodynamicSimulationState) {
  const [state, dispatch] = useReducer(stageReducer, undefined, initial)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const intervalMs = reduceMotion ? 250 : 100
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = Math.min(STAGE_TICK_CAP_SECONDS, Math.max(0, (now - last) / 1000))
      last = now
      if (seconds > 0) dispatch({ type: 'TICK', seconds })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [])

  const load = useCallback((next: HemodynamicSimulationState) => {
    dispatch({ type: 'STAGE_LOAD', state: next })
  }, [])

  /*
   * A development-only seam for driving the clock from the browser console: a hidden preview tab
   * throttles timers to one a minute after a few minutes, so a catheter in transit or a balloon
   * waiting to settle cannot be verified there by waiting. Never present in production.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return
    const host = window as unknown as { __hemodynamicsStage?: { tick: (seconds: number) => void } }
    host.__hemodynamicsStage = {
      tick: (seconds: number) => dispatch({ type: 'TICK', seconds: Math.max(0, seconds) }),
    }
    return () => {
      delete host.__hemodynamicsStage
    }
  }, [])

  return { state, dispatch, load }
}
