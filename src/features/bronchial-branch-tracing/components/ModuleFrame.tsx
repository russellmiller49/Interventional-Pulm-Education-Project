'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { BASE_PATH } from '../content/lessons'
import { ASSESS_TRACES } from '../content/practice'
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
    { href: BASE_PATH, title: 'Overview', description: 'The course and where you left off' },
    { href: `${BASE_PATH}/learn`, title: 'Learn', description: 'Trace real CT' },
    { href: `${BASE_PATH}/practice`, title: 'Practice', description: 'Route to a chosen segment' },
    // The former Assess address stays; it opens an optional revisit set in the same CT, with
    // references available. It is not a separate assessment.
    {
      href: `${BASE_PATH}/assess`,
      title: 'More routes',
      description: `Optional: ${ASSESS_TRACES.length} revisit routes, same CT`,
    },
  ]
  return (
    <div
      className={styles.module}
      data-activity={activity}
      data-learning-scroll-owner={activity ? 'workspace' : 'document'}
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
