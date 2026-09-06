'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emptyLabProgress,
  parseLabProgress,
  VENTILATION_LAB_STORAGE_KEY,
  type LabCheckpoint,
} from '../engine/learningLab'

export function useVentilationLabProgress() {
  const [progress, setProgress] = useState(emptyLabProgress)
  const [ready, setReady] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const current = useRef(progress)
  useEffect(() => {
    function read() {
      try {
        current.current = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY))
        setProgress(current.current)
      } catch {
        setStorageAvailable(false)
      }
      setReady(true)
    }
    const timer = window.setTimeout(read, 0)
    const listener = (event: StorageEvent) => {
      if (event.key === VENTILATION_LAB_STORAGE_KEY) read()
    }
    window.addEventListener('storage', listener)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('storage', listener)
    }
  }, [])
  const save = useCallback((record: LabCheckpoint) => {
    let latest = current.current
    try {
      latest = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY))
    } catch {
      /* Keep this session usable. */
    }
    const next = { version: 1 as const, units: { ...latest.units, [record.unitId]: record } }
    current.current = next
    setProgress(next)
    try {
      localStorage.setItem(VENTILATION_LAB_STORAGE_KEY, JSON.stringify(next))
    } catch {
      setStorageAvailable(false)
    }
  }, [])
  return { progress, ready, storageAvailable, save }
}
