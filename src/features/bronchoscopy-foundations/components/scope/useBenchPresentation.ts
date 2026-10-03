'use client'

import { useEffect, useRef, useState } from 'react'
import { authoredScopePose } from '../../engine/scope/scopeAuthoredPose'
import { BENCH_TRANSITION_MS, interpolateBenchMotion, type BenchMotion } from './benchPresentation'
import type { ScopeState, ScopeViewSpec } from './types'

/** The five-controls bench with its control-head and bending-section close-ups. */
export function isDetailedBench(
  view: Pick<ScopeViewSpec, 'sectionId' | 'physicalControlLabels'>,
  state: Pick<ScopeState, 'place'>,
): boolean {
  return (
    view.sectionId === 'five-controls' && !!view.physicalControlLabels && state.place === 'bench'
  )
}

/** What the bench is showing right now: the state every drawing of it reads, and the valve's travel. */
export interface BenchPresentation {
  readonly state: ScopeState
  readonly suctionTravel: number
}

/**
 * Brief visual transitions only: no dispatch, elapsed simulation time, scoring or persistence.
 *
 * Called once, by the pane, and handed to everything that draws the bench — the scope view, the
 * control head, the bending section and the end-on tip drawing — so that during a transition they
 * all show the same intermediate state. The controls, readouts and goals keep reading the model's
 * own state, which is where the learner's command already is.
 */
export function useBenchPresentation(
  state: ScopeState,
  enabled: boolean,
  visible: boolean,
): BenchPresentation {
  const target: BenchMotion = {
    depth: state.depthMm,
    rotation: state.inputs.rotationDeg,
    deflection: state.inputs.deflectionDeg,
    suction: Number(state.inputs.suction),
  }
  const [motion, setMotion] = useState(target)
  const current = useRef(motion)
  const [reducedMotion, setReducedMotion] = useState(true)
  const [foreground, setForeground] = useState(true)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    const visibility = () => setForeground(document.visibilityState === 'visible')
    update()
    visibility()
    media.addEventListener('change', update)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      media.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  const { depth, rotation, deflection, suction } = target
  useEffect(() => {
    const to = { depth, rotation, deflection, suction }
    const from = current.current
    if (!enabled || !visible || !foreground || reducedMotion) {
      current.current = to
      return
    }
    let frame: number
    const started = performance.now()
    const animate = (now: number) => {
      const fraction = Math.min(1, (now - started) / BENCH_TRANSITION_MS)
      // The transition ends on the model's own values, not on an equivalent of them: a turn taken
      // the short way round would otherwise settle at 270° where the model says −90°.
      current.current = fraction < 1 ? interpolateBenchMotion(from, to, fraction) : to
      setMotion(current.current)
      if (fraction < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [depth, rotation, deflection, suction, enabled, visible, foreground, reducedMotion])
  if (!enabled) return { state, suctionTravel: target.suction }
  const displayed = reducedMotion || !visible || !foreground ? target : motion
  const inputs = {
    ...state.inputs,
    rotationDeg: displayed.rotation,
    deflectionDeg: displayed.deflection,
  }
  return {
    state: {
      ...state,
      inputs,
      depthMm: displayed.depth,
      pose: authoredScopePose('bench', displayed.depth, inputs),
    },
    suctionTravel: displayed.suction,
  }
}
