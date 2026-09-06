'use client'

import type { ReactNode } from 'react'

import { ResizableTeachingWorkspace } from '../curriculum/ResizableTeachingWorkspace'
import { LessonShell, type LessonShellSection } from './LessonShell'
import styles from './lesson-stage.module.css'

const PANE_LABELS = {
  primary: 'Simulator',
  secondary: 'Teaching',
  tertiary: 'Steps',
} as const

/**
 * The stage's arrangement: the lean shell around the shared three-pane workspace.
 *
 * Simulator, Teaching, Steps — left to right — each scrolling on its own inside a frame the shell
 * sizes to the viewport. Below the fixed-workspace viewport the shared workspace stacks its panes
 * and the document scrolls.
 */
export function StageLayout({
  stageId,
  label,
  module,
  section = 'learn',
  workspaceLabel,
  header,
  contextStrip,
  simulator,
  teaching,
  task,
  footer,
  overlay,
}: {
  readonly stageId: string
  readonly label: string
  readonly module: string
  readonly section?: LessonShellSection
  readonly workspaceLabel: string
  readonly header: ReactNode
  readonly contextStrip?: ReactNode
  readonly simulator: ReactNode
  readonly teaching: ReactNode
  readonly task: ReactNode
  readonly footer?: ReactNode
  readonly overlay?: ReactNode
}) {
  return (
    <LessonShell
      section={section}
      stage={stageId}
      label={label}
      module={module}
      header={header}
      contextStrip={contextStrip}
      footer={footer}
    >
      <div className={styles.workspaceFrame} data-stage-frame>
        <ResizableTeachingWorkspace
          className={styles.workspace}
          primary={
            <div className={styles.simulatorPane} data-pane="simulator">
              {simulator}
            </div>
          }
          secondary={
            <div className={styles.teachingColumn} data-pane="teaching">
              {teaching}
            </div>
          }
          tertiary={
            <div className={styles.taskColumn} data-pane="task">
              {task}
            </div>
          }
          paneLabels={PANE_LABELS}
          workspaceLabel={workspaceLabel}
        />
      </div>
      {overlay}
    </LessonShell>
  )
}
