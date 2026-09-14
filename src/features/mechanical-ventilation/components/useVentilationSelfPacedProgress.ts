'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  emptySelfPacedProgress,
  parseSelfPacedProgress,
  visitVentilationLocation,
  VENTILATION_SELF_PACED_KEY,
  type VentilationLocation,
} from '../engine/selfPacedProgress'

export function useVentilationSelfPacedProgress() {
  const [progress, setProgress] = useState(emptySelfPacedProgress)
  const [ready, setReady] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  useEffect(() => {
    const read = () => {
      try {
        setProgress(parseSelfPacedProgress(localStorage.getItem(VENTILATION_SELF_PACED_KEY)))
      } catch {
        setStorageAvailable(false)
      }
      setReady(true)
    }
    const timer = window.setTimeout(read, 0)
    window.addEventListener('storage', read)
    window.addEventListener(VENTILATION_SELF_PACED_KEY, read)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('storage', read)
      window.removeEventListener(VENTILATION_SELF_PACED_KEY, read)
    }
  }, [])
  const visit = useCallback((location: VentilationLocation) => {
    try {
      const next = visitVentilationLocation(
        parseSelfPacedProgress(localStorage.getItem(VENTILATION_SELF_PACED_KEY)),
        location,
      )
      localStorage.setItem(VENTILATION_SELF_PACED_KEY, JSON.stringify(next))
      setProgress(next)
      window.dispatchEvent(new Event(VENTILATION_SELF_PACED_KEY))
    } catch {
      setStorageAvailable(false)
      setProgress((current) => visitVentilationLocation(current, location))
    }
  }, [])
  return { progress, ready, storageAvailable, visit }
}
