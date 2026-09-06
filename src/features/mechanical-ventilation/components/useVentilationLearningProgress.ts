'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emptyVentilationLearningProgress,
  parseVentilationLearningProgress,
  VENTILATION_LEARNING_STORAGE_KEY,
  type VentilationLearningProgress,
} from '../engine/learningProgress'

export function useVentilationLearningProgress() {
  const [progress, setProgress] = useState(emptyVentilationLearningProgress)
  const [ready, setReady] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const current = useRef(progress)
  useEffect(() => {
    const read = () => {
      try {
        const next = parseVentilationLearningProgress(
          window.localStorage.getItem(VENTILATION_LEARNING_STORAGE_KEY),
        )
        current.current = next
        setProgress(next)
      } catch {
        setStorageAvailable(false)
      }
      setReady(true)
    }
    const timer = window.setTimeout(read, 0)
    const onStorage = (event: StorageEvent) => {
      if (event.key === VENTILATION_LEARNING_STORAGE_KEY) read()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  const update = useCallback(
    (change: (previous: VentilationLearningProgress) => VentilationLearningProgress) => {
      const next = change(current.current)
      current.current = next
      setProgress(next)
      try {
        window.localStorage.setItem(VENTILATION_LEARNING_STORAGE_KEY, JSON.stringify(next))
      } catch {
        setStorageAvailable(false)
      }
    },
    [],
  )
  return { progress, ready, storageAvailable, update }
}
