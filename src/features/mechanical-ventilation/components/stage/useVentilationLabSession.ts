'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

import {
  createLabSession,
  labCheckpoint,
  learningLabReducer,
  type LabAction,
  type LabCheckpoint,
  type LabSession,
} from '../../engine/learningLab'
import type { VentilationAction, VentilatorDeviceId } from '../../engine/types'

export const VENTILATION_DEVICE_PREFERENCE_KEY = 'ventilation-learning-device'

export function readDevicePreference(
  fallback: VentilatorDeviceId = 'hamilton-c6',
): VentilatorDeviceId {
  try {
    const value = localStorage.getItem(VENTILATION_DEVICE_PREFERENCE_KEY)
    return (value as VentilatorDeviceId | null) ?? fallback
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

/**
 * The lab session behind a section: the event-sourced reducer, its clock, and its checkpointing.
 *
 * The clock ticks a tenth of a simulated second every hundred milliseconds while the tab is
 * visible, pauses the patient when the tab is hidden, and opens paused for a learner who prefers
 * reduced motion. The checkpoint is saved every five simulated seconds and on every change of
 * round, phase, event count or device, plus on page hide and unmount, so a reload reconstructs the
 * same patient, paused, with every commitment intact.
 */
export function useVentilationLabSession({
  unitId,
  device,
  saved,
  save,
}: {
  readonly unitId: string
  readonly device: VentilatorDeviceId
  readonly saved?: LabCheckpoint
  readonly save: (record: LabCheckpoint) => void
}) {
  const [session, dispatch] = useReducer(learningLabReducer, saved, (record) =>
    createLabSession(unitId, record?.device ?? device, record),
  )
  const sessionRef = useRef<LabSession>(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const engine = useCallback(
    (action: VentilationAction) => dispatch({ type: 'ENGINE', action }),
    [],
  )
  const lab = useCallback((action: LabAction) => dispatch(action), [])

  useEffect(() => {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => engine({ type: 'SET_PAUSED', paused: true }), 0)
    return () => window.clearTimeout(timer)
  }, [engine, session.round, session.phase])

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

  const saveBucket = Math.floor(session.simulation.simulationTime / 5)
  // Every commitment in either round, as one key, so a change to any of them saves at once.
  const commitments = session.evidence
    .map((evidence) =>
      [
        evidence.prediction ?? '',
        evidence.location ?? '',
        evidence.sort ? Object.keys(evidence.sort).length : '',
        evidence.completedAt ?? '',
      ].join(':'),
    )
    .join('|')
  useEffect(() => {
    save(labCheckpoint(sessionRef.current))
  }, [
    save,
    saveBucket,
    session.round,
    session.phase,
    session.events.length,
    session.device,
    session.readySince,
    commitments,
    session.completedAt,
  ])
  useEffect(() => {
    const persist = () => save(labCheckpoint(sessionRef.current))
    window.addEventListener('pagehide', persist)
    return () => {
      window.removeEventListener('pagehide', persist)
      persist()
    }
  }, [save])

  return { session, engine, lab }
}
