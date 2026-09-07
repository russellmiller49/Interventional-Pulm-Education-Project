'use client'

import type { ReactNode } from 'react'

import { ResizableTeachingWorkspace } from '@/features/learning-module/curriculum/ResizableTeachingWorkspace'

import { EcmoActivityShell } from '../shell/EcmoActivityShell'
import styles from './EcmoLessonStage.module.css'

const PANE_LABELS = {
  primary: 'Steps',
  secondary: 'Teaching',
  tertiary: 'Simulator',
} as const

/**
 * What each pane is for, in the learner's words, printed on the pane.
 *
 * The panes had accessible names and nothing visible, so a step that said "review the lesson
 * narrative" or "read the live values" named no pane a learner could point at. A learner review in
 * September 2026 reported guessing which panel each instruction meant on four separate steps. The
 * step copy now names its pane, and this is what makes that name findable. Marked `aria-hidden`
 * because the region it sits in is already labelled with the same word.
 */
const PANE_PURPOSE = {
  primary: 'what to do',
  secondary: 'what to read',
  tertiary: 'what to look at',
} as const

/**
 * The opening split, and how narrow each pane may be dragged.
 *
 * The Steps pane leads but does not take the width: R4-OD-10 put the pressure-zone map in the
 * simulator pane because it is drawn for a thousand pixels and needs the widest pane, and the
 * console facsimile is scaled to whatever width that pane settles at. So the fractions are chosen
 * to keep the simulator the widest of the three, and the drag floors follow the content across the
 * slots rather than staying with the slot numbers.
 */
const PANE_WIDTH_FRACTIONS = { primary: 0.26, secondary: 0.29 } as const
const PANE_MINIMUMS = { primary: 300, secondary: 280, tertiary: 340 } as const

function Pane({
  slot,
  children,
}: {
  readonly slot: keyof typeof PANE_LABELS
  readonly children: ReactNode
}) {
  return (
    <>
      <p className={styles.paneLabel} data-pane-label={slot} aria-hidden="true">
        <span>{PANE_LABELS[slot]}</span> panel · {PANE_PURPOSE[slot]}
      </p>
      {children}
    </>
  )
}

/**
 * The stage's arrangement: the lean shell around the shared three-pane workspace.
 *
 * Steps, Teaching, Simulator — left to right — each scrolling on its own inside a frame the shell
 * sizes to the viewport. Below the fixed-workspace viewport the shared workspace stacks its panes
 * and the document scrolls, as it always has.
 *
 * The Steps pane used to sit last. A learner review in September 2026 asked for the prompts and
 * questions on the left "for a more natural read", and the swap pays twice: below the compact
 * threshold the shared workspace opens on its `primary` pane, which now means the learner meets the
 * instruction rather than a console they cannot operate.
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
  supportMode,
  fixedPathway,
  compactPane,
}: {
  readonly stageId: string
  readonly label: string
  /** Stamped on the frame so a test can read which reference circuit is behind the teaching. */
  readonly supportMode?: string
  /** Present when the section runs on one track regardless of the requested one. */
  readonly fixedPathway?: string
  readonly header: ReactNode
  readonly contextStrip?: ReactNode
  readonly simulator: ReactNode
  readonly teaching: ReactNode
  readonly task: ReactNode
  readonly footer?: ReactNode
  readonly overlay?: ReactNode
  /**
   * Which pane a one-pane compact viewport should show for the current step.
   *
   * At compact widths exactly one pane is on screen, so a step whose answer control is a set of
   * places on the circuit map is unanswerable if the view is parked on the instruction. The hosts
   * derive this from where the step's work is — the same authored location the Now card prints.
   */
  readonly compactPane?: 'primary' | 'secondary' | 'tertiary'
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
      <div
        className={styles.workspaceFrame}
        data-ecmo-stage-frame
        data-support-mode={supportMode}
        data-fixed-pathway={fixedPathway}
      >
        <ResizableTeachingWorkspace
          className={styles.workspace}
          primary={
            <Pane slot="primary">
              <div className={styles.taskColumn} data-pane="task">
                {task}
              </div>
            </Pane>
          }
          secondary={<Pane slot="secondary">{teaching}</Pane>}
          tertiary={
            <Pane slot="tertiary">
              <div className={styles.simulatorPane} data-pane="simulator">
                {simulator}
              </div>
            </Pane>
          }
          paneLabels={PANE_LABELS}
          preferredCompactPane={compactPane}
          defaultWidthFractions={PANE_WIDTH_FRACTIONS}
          paneMinimums={PANE_MINIMUMS}
          workspaceLabel="ECMO lesson workspace: steps, teaching, and simulator"
        />
      </div>
      {overlay}
    </EcmoActivityShell>
  )
}
