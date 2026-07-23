import type { ReactNode } from 'react'

import { ClinicalContextStrip } from './ClinicalContextStrip'
import styles from './learning-module-v2.module.css'

export interface DidacticLessonFrameProps {
  readonly patientContext: ReactNode
  readonly viewport: ReactNode
  readonly currentTask: ReactNode
}

export function DidacticLessonFrame({
  patientContext,
  viewport,
  currentTask,
}: DidacticLessonFrameProps) {
  return (
    <div className={styles.didacticLessonFrame}>
      <ClinicalContextStrip>{patientContext}</ClinicalContextStrip>
      <aside className={styles.didacticTaskPanel} aria-label="Current task">
        {currentTask}
      </aside>
      <section className={styles.didacticViewport} aria-label="Simulation viewport">
        {viewport}
      </section>
    </div>
  )
}
