import type { ReactNode } from 'react'

import styles from './learning-module-v2.module.css'

export interface TaskDrawerProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
  readonly label?: string
}

export function TaskDrawer({
  children,
  defaultOpen = false,
  label = 'Current task',
}: TaskDrawerProps) {
  return (
    <details className={styles.taskDrawer} open={defaultOpen || undefined}>
      <summary className={styles.taskDrawerTrigger}>{label}</summary>
      <aside className={styles.taskDrawerPanel} aria-label={label}>
        {children}
      </aside>
    </details>
  )
}
