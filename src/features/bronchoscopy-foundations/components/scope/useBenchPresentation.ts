'use client'

import { useEffect, useRef, useState } from 'react'
import { authoredScopePose } from '../../engine/scope/scopeAuthoredPose'
import { BENCH_TRANSITION_MS, interpolateBenchMotion, type BenchMotion } from './benchPresentation'
import type { ScopeState } from './types'

/** Brief visual transitions only: no dispatch, elapsed simulation time, scoring or persistence. */
export function useBenchPresentation(state: ScopeState, enabled: boolean, visible: boolean) {
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
      current.current = interpolateBenchMotion(from, to, fraction)
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
