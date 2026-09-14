'use client'
import { useEffect, useState } from 'react'
import {
  PROGRESS_CHANGED_EVENT,
  readProgress,
  snapshotFromStorage,
  type CourseProgressSnapshot,
} from '../engine/selfPacedProgress'

/** The saved self-paced record and whether this browser is saving it. Read after mounting. */
export function useCourseProgress(): CourseProgressSnapshot {
  const [snapshot, setSnapshot] = useState<CourseProgressSnapshot>(() =>
    snapshotFromStorage(null, true),
  )
  useEffect(() => {
    const refresh = () => setSnapshot(readProgress())
    refresh()
    window.addEventListener(PROGRESS_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(PROGRESS_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return snapshot
}
