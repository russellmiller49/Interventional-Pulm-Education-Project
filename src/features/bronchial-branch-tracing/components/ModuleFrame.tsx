'use client'

import type { ReactNode } from 'react'
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
  const items = [
    { href: BASE_PATH, title: 'Overview', description: 'The course and your progress' },
    { href: `${BASE_PATH}/learn`, title: 'Learn', description: 'From a slice to an opening' },
    { href: `${BASE_PATH}/practice`, title: 'Practice', description: 'Trace with less assistance' },
    { href: `${BASE_PATH}/assess`, title: 'Assess', description: 'Independent interpretation' },
  ]
  return (
    <div className={styles.module} data-activity={activity} lang="en">
      <ModuleNavV2
        items={items}
        activeHref={section === 'overview' ? BASE_PATH : `${BASE_PATH}/${section}`}
        ariaLabel="Branch tracing sections"
      />
      {children}
    </div>
  )
}
