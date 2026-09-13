'use client'
import { useEffect, useState } from 'react'
import { emptyRecord, readRecord, RECORD_EVENT } from '../engine/progress'
export function useCourseRecord() {
  const [record, setRecord] = useState(emptyRecord)
  useEffect(() => {
    const refresh = () => setRecord(readRecord())
    refresh()
    window.addEventListener(RECORD_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(RECORD_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return record
}
