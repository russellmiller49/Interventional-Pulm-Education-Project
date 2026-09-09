'use client'
import { useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { SuiteViewSpec } from './types'

/** One clock for the suite; only an active, visible canvas requests continuous frames. */
export function useSuitePlayback(
  view: SuiteViewSpec,
  enabled: boolean,
  visible: boolean,
  reducedMotion: boolean,
) {
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState<boolean | null>(null)
  const [stepped, setStepped] = useState(false)
  // A reduced-motion view opens at a completed state. Step remains an explicit clock input.
  const phase = reducedMotion && !stepped ? 1 : elapsed
  const running = Boolean(
    view.animation &&
    (playing ?? view.animation.autoplay) &&
    enabled &&
    visible &&
    !reducedMotion &&
    (view.animation.loop || elapsed < 1),
  )
  return {
    phase,
    running,
    tick: (delta: number) =>
      setElapsed((n) => (view.animation?.loop && n + delta > 1 ? 0 : Math.min(1, n + delta))),
    reset: () => {
      setElapsed(0)
      setPlaying(null)
      setStepped(false)
    },
    step: (seconds: number) => {
      setPlaying(false)
      setStepped(true)
      setElapsed(phase + seconds)
    },
    toggle: () => {
      if (elapsed >= 1) setElapsed(0)
      setPlaying(!(playing ?? view.animation?.autoplay))
    },
  }
}

export function SuiteClock({ tick }: { tick: (delta: number) => void }) {
  useFrame((_, delta) => tick(Math.min(delta, 1 / 30) * 0.1))
  return null
}
