'use client'

import type { ReactNode } from 'react'

import type { CriticalCareActivityMode, CriticalCareActivityPhase } from '../activity'
import { AssumedConceptStrip } from '@/features/critical-care/components/AssumedConceptStrip'
import { ActivityChrome, type ActivityLayout } from './ActivityChrome'
import { CaseWorkspaceFrame } from './CaseWorkspaceFrame'
import { DidacticLessonFrame } from './DidacticLessonFrame'
import { GuidedLabFrame } from './GuidedLabFrame'
import { NativeWorkbenchFrame } from './NativeWorkbenchFrame'
import styles from './learning-module-v2.module.css'

export interface ActivityShellProps {
  readonly breadcrumb: ReactNode
  readonly activityTitle: string
  readonly activityId?: string
  readonly assumedConceptIds?: readonly string[]
  readonly phase: CriticalCareActivityPhase
  readonly mode: CriticalCareActivityMode
  readonly progressLabel: string
  readonly stepperAriaLabel?: string
  readonly onPhaseSelect?: (phase: CriticalCareActivityPhase) => void
  readonly patientContext: ReactNode
  readonly viewport: ReactNode
  readonly currentTask: ReactNode
  readonly bottomContent?: ReactNode
  readonly secondaryActions?: ReactNode
  readonly onSaveAndExit: () => void
  readonly onHelp: () => void
  readonly onReset: () => void
  readonly theme?: 'light' | 'dark'
  readonly maskedAssessment?: boolean
  readonly layout?: ActivityLayout
}

export function ActivityShell({
  breadcrumb,
  activityTitle,
  activityId,
  assumedConceptIds = [],
  phase,
  mode,
  progressLabel,
  stepperAriaLabel,
  onPhaseSelect,
  patientContext,
  viewport,
  currentTask,
  bottomContent,
  secondaryActions,
  onSaveAndExit,
  onHelp,
  onReset,
  theme = 'light',
  maskedAssessment = false,
  layout = 'guided-lab',
}: ActivityShellProps) {
  const frame =
    layout === 'native-workbench' ? (
      <NativeWorkbenchFrame
        patientContext={patientContext}
        viewport={viewport}
        currentTask={currentTask}
      />
    ) : layout === 'didactic-lesson' ? (
      <DidacticLessonFrame
        patientContext={patientContext}
        viewport={viewport}
        currentTask={currentTask}
      />
    ) : layout === 'case-workspace' ? (
      <CaseWorkspaceFrame
        patientContext={patientContext}
        viewport={viewport}
        currentTask={currentTask}
      />
    ) : (
      <GuidedLabFrame
        patientContext={patientContext}
        viewport={viewport}
        currentTask={currentTask}
      />
    )

  return (
    <ActivityChrome
      breadcrumb={breadcrumb}
      activityTitle={activityTitle}
      phase={phase}
      mode={mode}
      progressLabel={progressLabel}
      stepperAriaLabel={stepperAriaLabel}
      onPhaseSelect={onPhaseSelect}
      bottomContent={bottomContent}
      secondaryActions={secondaryActions}
      onSaveAndExit={onSaveAndExit}
      onHelp={onHelp}
      onReset={onReset}
      layout={layout}
      theme={theme}
      maskedAssessment={maskedAssessment}
    >
      <div className={styles.activityFrameStack}>
        {activityId && assumedConceptIds.length > 0 ? (
          <AssumedConceptStrip activityId={activityId} conceptIds={assumedConceptIds} />
        ) : null}
        {frame}
      </div>
    </ActivityChrome>
  )
}
