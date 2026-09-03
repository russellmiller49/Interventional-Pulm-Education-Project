'use client'

import type { ReactNode } from 'react'

import { ResizableTeachingWorkspace } from '@/features/learning-module/curriculum/ResizableTeachingWorkspace'

import { EcmoActivityShell } from '../shell/EcmoActivityShell'
import styles from './EcmoLessonStage.module.css'

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
 * and the document scrolls, as it always has.
 */
export function StageLayout({
  stageId,
  label,
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
  readonly header: ReactNode
  readonly contextStrip?: ReactNode
  readonly simulator: ReactNode
  readonly teaching: ReactNode
  readonly task: ReactNode
  readonly footer?: ReactNode
  readonly overlay?: ReactNode
}) {
  return (
    <EcmoActivityShell
      section="learn"
      stage={stageId}
      label={label}
      header={header}
      contextStrip={contextStrip}
      footer={footer}
    >
      <div className={styles.workspaceFrame} data-ecmo-stage-frame>
        <ResizableTeachingWorkspace
          className={styles.workspace}
          primary={
            <div className={styles.simulatorPane} data-pane="simulator">
              {simulator}
            </div>
          }
          secondary={teaching}
          tertiary={
            <div className={styles.taskColumn} data-pane="task">
              {task}
            </div>
          }
          paneLabels={PANE_LABELS}
          workspaceLabel="ECMO lesson workspace: simulator, teaching, and steps"
        />
      </div>
      {overlay}
    </EcmoActivityShell>
  )
}
