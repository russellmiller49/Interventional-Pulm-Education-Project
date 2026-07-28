import type { ReactNode } from 'react'

import { ClinicalContextStrip } from './ClinicalContextStrip'
import styles from './learning-module-v2.module.css'

export interface GuidedLabFrameProps {
  readonly patientContext: ReactNode
  readonly viewport: ReactNode
  readonly currentTask: ReactNode
}

export function GuidedLabFrame({ patientContext, viewport, currentTask }: GuidedLabFrameProps) {
  return (
    <div className={styles.guidedLabFrame}>
      <ClinicalContextStrip>{patientContext}</ClinicalContextStrip>
      <div className={styles.guidedLabBody}>
        <section className={styles.guidedViewport} aria-label="Simulation viewport">
          {viewport}
        </section>
        <aside className={styles.guidedTaskPanel} aria-label="Current task">
          {currentTask}
        </aside>
      </div>
    </div>
  )
}
