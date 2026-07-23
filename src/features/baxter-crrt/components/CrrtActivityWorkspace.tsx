'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  useCriticalCareActivityAnalytics,
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { baxterCrrtMasteryManifest } from '../content/mastery'
import { selectCrrtLearningOutcome } from '../engine/outcomes'
import type { CrrtLearningSessionState, CrrtReasoningPhase } from '../engine/learningSession'
import styles from './baxter-crrt.module.css'

const semanticPhaseByCrrtPhase: Readonly<Record<CrrtReasoningPhase, CriticalCareActivityPhase>> = {
  read: 'recognize',
  define: 'recognize',
  select: 'predict',
  predict: 'predict',
  run: 'act',
  reassess: 'observe',
  reflect: 'explain',
}

export function crrtSemanticActivityPhase(
  session: CrrtLearningSessionState,
): CriticalCareActivityPhase {
  return semanticPhaseByCrrtPhase[session.reasoningPhase]
}

interface CrrtActivityWorkspaceProps {
  readonly session: CrrtLearningSessionState
  readonly mode: Extract<CriticalCareActivityMode, 'practice' | 'challenge'>
  readonly progressLabel: string
  readonly resumed?: boolean
  readonly currentTaskExtras?: ReactNode
  readonly nextRecommendation?: ReactNode
  readonly onReset: () => void
  readonly onSaveAndExit: () => void
  readonly children: ReactNode
}

export function CrrtActivityWorkspace({
  session,
  mode,
  progressLabel,
  resumed = false,
  currentTaskExtras,
  nextRecommendation,
  onReset,
  onSaveAndExit,
  children,
}: CrrtActivityWorkspaceProps) {
  const definition = session.caseDefinition
  const masked = session.experience === 'mastery' && !session.debriefRevealed
  const title = masked ? baxterCrrtMasteryManifest.learnerTitleBeforeDebrief : definition.title
  const outcome = selectCrrtLearningOutcome(session)
  const activityId =
    mode === 'challenge'
      ? `crrt:assess:${baxterCrrtMasteryManifest.id}`
      : `crrt:practice:${definition.id}`
  const [helpState, setHelpState] = useState({ activityId, visible: false })
  const recordedHints = useRef({ activityId: '', ids: new Set<string>() })
  const recordedSafetyEvents = useRef({ activityId: '', ids: new Set<string>() })
  const helpVisible = helpState.activityId === activityId && helpState.visible
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'baxter-crrt',
    activityId,
    mode,
    phase: crrtSemanticActivityPhase(session),
  })
  const sourceEntries = definition.sourceBasis.map((source) => ({
    id: source.id,
    title: source.sourceTitle,
    sourceLabel: `${source.documentVersion} · ${source.pageOrSection}`,
    limitation: String(source.value ?? 'Use only within the authored educational source scope.'),
  }))
  const deviceSource = definition.sourceBasis.find(
    (source) => source.sourceType === 'device-manual',
  )
  const evidenceEntries = masked
    ? [
        {
          id: 'masked-assessment-boundary',
          title: 'Assessment evidence boundary',
          sourceLabel:
            deviceSource?.documentVersion ?? `Device profile ${session.simulation.deviceId}`,
          limitation:
            'Case-specific evidence and source identifiers remain hidden until debrief. Use current manufacturer instructions and local policy.',
        },
      ]
    : sourceEntries

  useEffect(() => {
    if (!session.prediction) return
    lifecycleAnalytics.recordPredictionSubmitted()
  }, [lifecycleAnalytics, session.prediction])

  useEffect(() => {
    if (recordedHints.current.activityId !== activityId) {
      recordedHints.current = { activityId, ids: new Set() }
    }
    if (session.usedHintIds.length === 0) recordedHints.current.ids.clear()
    for (const hintId of session.usedHintIds) {
      if (recordedHints.current.ids.has(hintId)) continue
      recordedHints.current.ids.add(hintId)
      lifecycleAnalytics.recordHintUsed()
    }
  }, [activityId, lifecycleAnalytics, session.usedHintIds])

  useEffect(() => {
    if (recordedSafetyEvents.current.activityId !== activityId) {
      recordedSafetyEvents.current = { activityId, ids: new Set() }
    }
    if (outcome.criticalErrorIds.length === 0) recordedSafetyEvents.current.ids.clear()
    for (const error of outcome.criticalErrorIds) {
      if (recordedSafetyEvents.current.ids.has(error)) continue
      recordedSafetyEvents.current.ids.add(error)
      lifecycleAnalytics.recordSafetyEvent()
    }
  }, [activityId, lifecycleAnalytics, outcome.criticalErrorIds])

  useEffect(() => {
    if (outcome.mastery) lifecycleAnalytics.recordGoalMet()
  }, [lifecycleAnalytics, outcome.mastery])

  useEffect(() => {
    if (!session.debriefRevealed) return
    lifecycleAnalytics.recordDebriefViewed()
    lifecycleAnalytics.recordActivityCompleted(outcome.mastery)
  }, [lifecycleAnalytics, outcome.mastery, session.debriefRevealed])

  function focusRestoredActivity() {
    document.getElementById('crrt-activity-viewport')?.focus({ preventScroll: true })
  }

  function showHelp() {
    if (!helpVisible && mode !== 'challenge') lifecycleAnalytics.recordHintUsed()
    setHelpState({ activityId, visible: true })
  }

  return (
    <ActivityShell
      breadcrumb={
        <>
          <Link href={baxterCrrtNavBase}>CRRT</Link>
          {' / '}
          {mode === 'challenge' ? 'assess' : 'practice'}
        </>
      }
      activityTitle={title}
      phase={crrtSemanticActivityPhase(session)}
      mode={mode}
      progressLabel={progressLabel}
      stepperAriaLabel="CRRT shared activity phases"
      theme="dark"
      maskedAssessment={masked}
      patientContext={
        <>
          <PatientContextBar
            items={[
              { label: 'Case', value: masked ? 'Unseen capstone' : definition.id },
              { label: 'Device', value: session.simulation.deviceId },
              { label: 'Role lens', value: session.roleLens },
              { label: 'Attempt', value: `${session.attempt}` },
            ]}
            immediateGoal={
              masked
                ? 'Complete the full reasoning loop using only observable case and device data.'
                : definition.learningObjectives[0]
            }
            safetyConstraints={[
              'Educational simulation only; use current manufacturer instructions and local policy.',
              'Displayed values and responses are synthetic and are not patient-specific targets.',
            ]}
          />
          {resumed ? (
            <ResumeBanner
              state="ready"
              title="Exact activity restored"
              description={
                masked
                  ? 'The saved masked assessment is open with its device and route context.'
                  : `${definition.id} is open with its saved case and device context.`
              }
              onResume={focusRestoredActivity}
            />
          ) : null}
        </>
      }
      currentTask={
        <TaskPanel
          objective={
            masked
              ? 'Complete the masked assessment reasoning loop without diagnosis cues.'
              : definition.learningObjectives[0]
          }
          requiredAction="Complete the current reasoning phase in the case player."
          targets={masked ? [] : definition.learningObjectives}
          hint={masked ? undefined : definition.hintLadder[0]?.text}
          mode={mode}
          hintVisible={helpVisible}
          onHintRequested={showHelp}
        >
          {helpVisible ? (
            <p role="note">
              Open Reference or Evidence below for the existing case context, source scope, and
              model limits.
            </p>
          ) : null}
          {currentTaskExtras}
        </TaskPanel>
      }
      onHelp={showHelp}
      onReset={onReset}
      onSaveAndExit={onSaveAndExit}
      bottomContent={progressLabel}
      secondaryActions={
        <>
          <ReferenceDrawer
            entries={[
              {
                id: definition.id,
                title,
                summary: masked
                  ? 'Case identity remains hidden until debrief.'
                  : definition.patientDescription,
                meta: masked
                  ? 'Case-specific references available after debrief'
                  : definition.sourceBasis.map((source) => source.id).join(' · '),
              },
            ]}
            trigger={<button type="button">Reference</button>}
          />
          <EvidenceDrawer
            entries={evidenceEntries}
            trigger={<button type="button">Evidence</button>}
          />
          {nextRecommendation}
        </>
      }
      viewport={
        <div id="crrt-activity-viewport" className={styles.activityViewport} tabIndex={-1}>
          {children}
          {session.debriefRevealed ? (
            <DebriefPanel
              clinicalModel={definition.debrief.summary}
              actions={session.timeline.map((entry) => entry.type.replaceAll('-', ' '))}
              consequences={definition.debrief.causalChain}
              performanceDomains={[
                {
                  label: 'Score',
                  result: outcome.score === null ? 'Not scored' : `${outcome.score}%`,
                },
                { label: 'Mastery', result: outcome.mastery ? 'Met' : 'Not yet met' },
                {
                  label: 'Safety',
                  result:
                    outcome.criticalErrorIds.length === 0
                      ? 'No critical error'
                      : `${outcome.criticalErrorIds.length} critical error(s)`,
                },
              ]}
              transfer={<p>{definition.debrief.transferQuestion}</p>}
              replay={
                <button type="button" onClick={onReset}>
                  Replay this case
                </button>
              }
            />
          ) : null}
        </div>
      }
    />
  )
}
