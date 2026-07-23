'use client'

import type { ReactNode } from 'react'

import type { CriticalCareActivityMode, CriticalCareActivityPhase } from '../activity'
import { ActivityChrome, type ActivityLayout } from './ActivityChrome'
import { CaseWorkspaceFrame } from './CaseWorkspaceFrame'
import { DidacticLessonFrame } from './DidacticLessonFrame'
import { GuidedLabFrame } from './GuidedLabFrame'
import { NativeWorkbenchFrame } from './NativeWorkbenchFrame'

export interface ActivityShellProps {
  readonly breadcrumb: ReactNode
  readonly activityTitle: string
  readonly phase: CriticalCareActivityPhase
  readonly mode: CriticalCareActivityMode
  readonly progressLabel: string
  readonly stepperAriaLabel?: string
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
  phase,
  mode,
  progressLabel,
  stepperAriaLabel,
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
      bottomContent={bottomContent}
      secondaryActions={secondaryActions}
      onSaveAndExit={onSaveAndExit}
      onHelp={onHelp}
      onReset={onReset}
      layout={layout}
      theme={theme}
      maskedAssessment={maskedAssessment}
    >
      {frame}
    </ActivityChrome>
  )
}
