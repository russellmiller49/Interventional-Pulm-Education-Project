'use client'

import { useCallback, useEffect, useReducer } from 'react'

import { createLabSession, learningLabReducer, type LabAction } from '../../engine/learningLab'
import {
  ventilatorDeviceIds,
  type VentilationAction,
  type VentilatorDeviceId,
} from '../../engine/types'

export const VENTILATION_DEVICE_PREFERENCE_KEY = 'ventilation-learning-device'

export function readDevicePreference(
  fallback: VentilatorDeviceId = 'hamilton-c6',
): VentilatorDeviceId {
  try {
    const value = localStorage.getItem(VENTILATION_DEVICE_PREFERENCE_KEY)
    return ventilatorDeviceIds.includes(value as VentilatorDeviceId)
      ? (value as VentilatorDeviceId)
      : fallback
  } catch {
    return fallback
  }
}

export function saveDevicePreference(device: VentilatorDeviceId) {
  try {
    localStorage.setItem(VENTILATION_DEVICE_PREFERENCE_KEY, device)
  } catch {
    /* The session stays usable. */
  }
}

/** Transient patient session. Only the host's topic/step location is persisted. */
export function useVentilationLabSession({
  unitId,
  device,
  round = 0,
}: {
  readonly unitId: string
  readonly device: VentilatorDeviceId
  readonly round?: 0 | 1
}) {
  const [session, dispatch] = useReducer(learningLabReducer, undefined, () => {
    const initial = createLabSession(unitId, device)
    const opened = learningLabReducer(initial, { type: 'OPEN_ROUND', round })
    return { ...opened, simulation: { ...opened.simulation, paused: true } }
  })
  const engine = useCallback(
    (action: VentilationAction) => dispatch({ type: 'ENGINE', action }),
    [],
  )
  const lab = useCallback((action: LabAction) => dispatch(action), [])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') engine({ type: 'TICK', seconds: 0.1 })
    }, 100)
    const hide = () => {
      if (document.visibilityState !== 'visible') engine({ type: 'SET_PAUSED', paused: true })
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [engine])
  return { session, engine, lab }
}
