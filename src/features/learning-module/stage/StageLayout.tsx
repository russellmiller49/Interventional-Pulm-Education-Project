'use client'

import type { ReactNode } from 'react'

import {
  ResizableTeachingWorkspace,
  type TeachingWorkspacePaneMinimums,
  type TeachingWorkspaceWidthFractions,
} from '../curriculum/ResizableTeachingWorkspace'
import { LessonShell, type LessonShellSection } from './LessonShell'
import { type StagePaneId } from './stageModel'
import styles from './lesson-stage.module.css'

type WorkspaceSlot = 'primary' | 'secondary' | 'tertiary'

const SLOTS: readonly WorkspaceSlot[] = ['primary', 'secondary', 'tertiary']

/** Left to right. */
export type StagePaneOrder = readonly [StagePaneId, StagePaneId, StagePaneId]

/**
 * The arrangement every adopter had before the order became an option: the simulator first, the
 * steps last. A caller that passes no `paneOrder` gets exactly this.
 */
export const DEFAULT_STAGE_PANE_ORDER: StagePaneOrder = ['simulator', 'teaching', 'steps']

/**
 * What each pane is for, in the learner's words, printed on the pane after its name.
 *
 * Opt-in per pane: a caller that passes none renders no caption element at all, which is what
 * every adopter did before the option existed. Passing one prints "Steps panel · what to do" at the
 * head of that pane, sticky, so the answer to "which panel is this?" is on screen wherever the pane
 * is scrolled to. The panes had accessible names and nothing visible, and a learner review in
 * September 2026 reported guessing which panel each instruction meant on four separate steps.
 */
export type StagePaneCaptions = Partial<Record<StagePaneId, string>>

const PANE_LABELS: Readonly<Record<StagePaneId, string>> = {
  simulator: 'Simulator',
  teaching: 'Teaching',
  steps: 'Steps',
}

/** Which workspace slot a pane occupies under an order. */
export function stagePaneSlot(order: StagePaneOrder, pane: StagePaneId): WorkspaceSlot {
  const index = order.indexOf(pane)
  return SLOTS[index < 0 ? 0 : index]
}

/**
 * The stage's arrangement: the lean shell around the shared three-pane workspace.
 *
 * Three panes, each scrolling on its own inside a frame the shell sizes to the viewport. Below the
 * fixed-workspace viewport the shared workspace stacks its panes and the document scrolls.
 *
 * The order is the caller's. The default is simulator, teaching, steps — left to right — which is
 * the arrangement the stage was promoted with. A module whose learners read the instruction first
 * passes its steps first, and then also passes the opening fractions that keep its device pane the
 * widest, because the workspace's slots are positional and its content is not.
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
  paneOrder = DEFAULT_STAGE_PANE_ORDER,
  paneCaptions,
  defaultWidthFractions,
  paneMinimums,
  compactPane,
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
  /** Left to right. Omitted, simulator then teaching then steps. */
  readonly paneOrder?: StagePaneOrder
  /** What each pane is for, printed on it. Omitted, no caption is rendered. */
  readonly paneCaptions?: StagePaneCaptions
  /** Opening widths as fractions of the usable width. Omitted, the workspace's own default. */
  readonly defaultWidthFractions?: TeachingWorkspaceWidthFractions
  /** Drag floors in pixels. Omitted, the workspace's own default. */
  readonly paneMinimums?: TeachingWorkspacePaneMinimums
  /**
   * Which pane a one-pane compact viewport should show for the current step — followed, not
   * forced. Omitted, the workspace opens on its first slot and stays where the learner puts it.
   */
  readonly compactPane?: StagePaneId
}) {
  const content: Readonly<Record<StagePaneId, ReactNode>> = {
    simulator: (
      <div className={styles.simulatorPane} data-pane="simulator">
        {simulator}
      </div>
    ),
    teaching: (
      <div className={styles.teachingColumn} data-pane="teaching">
        {teaching}
      </div>
    ),
    steps: (
      <div className={styles.taskColumn} data-pane="task">
        {task}
      </div>
    ),
  }

  function pane(id: StagePaneId): ReactNode {
    const caption = paneCaptions?.[id]
    if (!caption) return content[id]
    return (
      <>
        <p className={styles.paneLabel} data-pane-label={id} aria-hidden="true">
          <span>{PANE_LABELS[id]}</span> panel · {caption}
        </p>
        {content[id]}
      </>
    )
  }

  const [first, second, third] = paneOrder

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
          primary={pane(first)}
          secondary={pane(second)}
          tertiary={pane(third)}
          paneLabels={{
            primary: PANE_LABELS[first],
            secondary: PANE_LABELS[second],
            tertiary: PANE_LABELS[third],
          }}
          workspaceLabel={workspaceLabel}
          preferredCompactPane={compactPane ? stagePaneSlot(paneOrder, compactPane) : undefined}
          defaultWidthFractions={defaultWidthFractions}
          paneMinimums={paneMinimums}
        />
      </div>
      {overlay}
    </LessonShell>
  )
}
