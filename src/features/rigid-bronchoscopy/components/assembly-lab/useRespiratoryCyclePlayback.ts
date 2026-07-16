'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  getRespiratoryCycleState,
  type RespiratoryPhaseId,
  type VentilationModeId,
  type VentilationObstructionState,
} from '@/features/rigid-bronchoscopy/content/assemblyVentilation'

/**
 * Drives one explicit respiratory phase at a time. The clinical state machine
 * lives in assemblyVentilation; this hook only advances its elapsed clock.
 */
export function useRespiratoryCyclePlayback({
  mode,
  obstructionState,
  playing,
  reducedMotion,
  resetVersion,
}: {
  mode: VentilationModeId
  obstructionState: VentilationObstructionState
  playing: boolean
  reducedMotion: boolean
  resetVersion: number
}) {
  const playbackKey = `${mode}:${obstructionState}:${resetVersion}`
  const [clock, setClock] = useState({ elapsedSeconds: 0, key: playbackKey })
  const elapsedSeconds = clock.key === playbackKey ? clock.elapsedSeconds : 0

  useEffect(() => {
    if (!playing || reducedMotion) return

    let lastTick = performance.now()
    const interval = window.setInterval(() => {
      const nextTick = performance.now()
      const deltaSeconds = Math.min((nextTick - lastTick) / 1000, 0.25)
      lastTick = nextTick
      setClock((current) => ({
        elapsedSeconds:
          current.key === playbackKey ? current.elapsedSeconds + deltaSeconds : deltaSeconds,
        key: playbackKey,
      }))
    }, 80)

    return () => window.clearInterval(interval)
  }, [playbackKey, playing, reducedMotion])

  const cycleState = useMemo(
    () => getRespiratoryCycleState(mode, elapsedSeconds, obstructionState),
    [elapsedSeconds, mode, obstructionState],
  )

  return {
    activePhaseId: (reducedMotion ? undefined : cycleState.phase.id) as
      | RespiratoryPhaseId
      | undefined,
    cycleState,
    elapsedSeconds,
  }
}
