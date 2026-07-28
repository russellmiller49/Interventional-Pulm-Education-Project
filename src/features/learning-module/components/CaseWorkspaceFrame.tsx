import type { ReactNode } from 'react'

import { ClinicalContextStrip } from './ClinicalContextStrip'
import { TaskDrawer } from './TaskDrawer'
import styles from './learning-module-v2.module.css'

export interface CaseWorkspaceFrameProps {
  readonly patientContext: ReactNode
  readonly viewport: ReactNode
  readonly currentTask: ReactNode
}

export function CaseWorkspaceFrame({
  patientContext,
  viewport,
  currentTask,
}: CaseWorkspaceFrameProps) {
  return (
    <div className={styles.caseWorkspaceFrame}>
      <ClinicalContextStrip>{patientContext}</ClinicalContextStrip>
      <section className={styles.caseViewport} aria-label="Simulation viewport">
        {viewport}
      </section>
      <TaskDrawer label="Case workflow">{currentTask}</TaskDrawer>
    </div>
  )
}
