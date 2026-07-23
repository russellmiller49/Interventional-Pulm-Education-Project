import type { ReactNode } from 'react'

import { ClinicalContextStrip } from './ClinicalContextStrip'
import { TaskDrawer } from './TaskDrawer'
import styles from './learning-module-v2.module.css'

export interface NativeWorkbenchFrameProps {
  readonly patientContext: ReactNode
  readonly viewport: ReactNode
  readonly currentTask: ReactNode
}

export function NativeWorkbenchFrame({
  patientContext,
  viewport,
  currentTask,
}: NativeWorkbenchFrameProps) {
  return (
    <div className={styles.nativeWorkbenchFrame}>
      <ClinicalContextStrip>{patientContext}</ClinicalContextStrip>
      <section className={styles.nativeViewport} aria-label="Simulation viewport">
        {viewport}
      </section>
      <TaskDrawer>{currentTask}</TaskDrawer>
    </div>
  )
}
