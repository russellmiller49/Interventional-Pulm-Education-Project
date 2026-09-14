'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { BASE_PATH } from '../content/lessons'
import styles from './branch-tracing.module.css'

export function ModuleFrame({
  section,
  children,
  activity = false,
}: {
  section: 'overview' | 'learn' | 'practice' | 'assess'
  children: ReactNode
  activity?: boolean
}) {
  const typeMeasure = useRef<HTMLSpanElement>(null)
  const [enlargedText, setEnlargedText] = useState(false)
  useEffect(() => {
    if (!typeMeasure.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setEnlargedText(entry.contentRect.width > 20))
    observer.observe(typeMeasure.current)
    return () => observer.disconnect()
  }, [])
  const items = [
    { href: BASE_PATH, title: 'Overview', description: 'The course and your progress' },
    { href: `${BASE_PATH}/learn`, title: 'Learn', description: 'Trace real CT' },
    { href: `${BASE_PATH}/practice`, title: 'Practice', description: 'Coached CT tracing' },
    { href: `${BASE_PATH}/assess`, title: 'Assess', description: 'Independent interpretation' },
  ]
  return (
    <div
      className={styles.module}
      data-activity={activity}
      data-enlarged-text={enlargedText || undefined}
      lang="en"
    >
      <span ref={typeMeasure} className={styles.typeMeasure} aria-hidden />
      <ModuleNavV2
        items={items}
        activeHref={section === 'overview' ? BASE_PATH : `${BASE_PATH}/${section}`}
        ariaLabel="Branch tracing sections"
      />
      {children}
    </div>
  )
}
