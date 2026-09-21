'use client'

import { useState, type ReactNode } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import {
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import type { ActivityShellProps } from '@/features/learning-module/components/ActivityShell'
import { ActivityChrome } from '@/features/learning-module/components/ActivityChrome'
import { AssumedConceptStrip } from '@/features/critical-care/components/AssumedConceptStrip'
import { NativeWorkbenchFrame } from '@/features/learning-module/components/NativeWorkbenchFrame'
import frameStyles from '@/features/learning-module/components/learning-module-v2.module.css'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { baxterCrrtMasteryManifest } from '../content/mastery'
import { getBaxterCrrtDeviceProfile } from '../content/deviceProfiles'
import type { CrrtLearningSessionState, CrrtReasoningPhase } from '../engine/learningSession'
import {
  formatCrrtSuppliedLabValue,
  selectCrrtLabEvidence,
  type CrrtSuppliedLabValue,
} from '../labEvidence'
import styles from './baxter-crrt.module.css'

/** Keep the native CRRT layout without inferring completed phases from navigation. */
function CrrtWorkspaceShell({
  activityId,
  assumedConceptIds = [],
  patientContext,
  viewport,
  currentTask,
  ...chrome
}: ActivityShellProps) {
  return (
    <ActivityChrome {...chrome} layout="native-workbench" showProgressStepper={false}>
      <div className={frameStyles.activityFrameStack}>
        {activityId && assumedConceptIds.length > 0 ? (
          <AssumedConceptStrip activityId={activityId} conceptIds={assumedConceptIds} />
        ) : null}
        <NativeWorkbenchFrame
          patientContext={patientContext}
          viewport={viewport}
          currentTask={currentTask}
        />
      </div>
    </ActivityChrome>
  )
}

const semanticPhaseByCrrtPhase: Readonly<Record<CrrtReasoningPhase, CriticalCareActivityPhase>> = {
  read: 'recognize',
  define: 'recognize',
  select: 'predict',
  predict: 'predict',
  run: 'act',
  reassess: 'observe',
  reflect: 'explain',
}

const taskByReasoningPhase: Readonly<
  Record<
    CrrtReasoningPhase,
    {
      readonly objective: string
      readonly requiredAction: string
    }
  >
> = {
  read: {
    objective: 'Build a patient–prescription–circuit problem representation.',
    requiredAction:
      'Review the patient, access, circuit, current prescription, delivered therapy, pressure pattern, and active alert or open Explain this case for a worked plan.',
  },
  define: {
    objective: 'Define the patient-centered treatment and safety goal.',
    requiredAction:
      'Choose the immediate solute, acid–base, fluid, delivery, or circuit goal that best fits the observable findings.',
  },
  select: {
    objective: 'Localize the mechanism and choose a bounded control plan.',
    requiredAction:
      'Review the mechanism and controls in Explain this case. No answer is required to use the simulation.',
  },
  predict: {
    objective: 'Compare a worked plan with the clinical findings.',
    requiredAction: 'Open Explain this case, explore a control, or continue to another topic.',
  },
  run: {
    objective: 'Perform the planned patient, circuit, or equipment actions.',
    requiredAction:
      'Sequence the clinical and equipment actions, then advance simulated time to observe delivery and patient consequences.',
  },
  reassess: {
    objective: 'Compare the observed response with the prediction.',
    requiredAction:
      'Review patient, delivered-therapy, pressure, balance, and alert changes; record every reassessment actually completed.',
  },
  reflect: {
    objective: 'Explain the causal chain and identify the transfer principle.',
    requiredAction:
      'Open and review the causal debrief, including missed safety steps, observed trends, and how the reasoning transfers to another patient.',
  },
}

function formatClinicalValue(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? 'Unavailable'
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`
}

function formatPressurePattern(
  access: number | null | undefined,
  filter: number | null | undefined,
  returnPressure: number | null | undefined,
  effluent: number | null | undefined,
): string {
  return [
    `A ${formatClinicalValue(access, 'mmHg')}`,
    `F ${formatClinicalValue(filter, 'mmHg')}`,
    `R ${formatClinicalValue(returnPressure, 'mmHg')}`,
    `E ${formatClinicalValue(effluent, 'mmHg')}`,
  ].join(' · ')
}

function humanizeAlarmCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
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
  const deviceProfile = getBaxterCrrtDeviceProfile(session.simulation.deviceId)
  const title = definition.title
  const task = taskByReasoningPhase[session.reasoningPhase]
  const patient = session.simulation.patient
  const prescription = session.simulation.prescription
  const latestTrend = session.simulation.trends.at(-1)
  const pressures = session.simulation.circuit.pressures
  const activeAlarm = session.simulation.alarms.find((alarm) => alarm.active)
  const labEvidence = selectCrrtLabEvidence(session)
  const suppliedLabValue = (id: CrrtSuppliedLabValue['id']): string => {
    const entry = labEvidence.suppliedBaseline.find((candidate) => candidate.id === id)
    return entry ? formatCrrtSuppliedLabValue(entry) : 'Not supplied'
  }
  const activityId =
    mode === 'challenge'
      ? `crrt:assess:${baxterCrrtMasteryManifest.id}`
      : `crrt:practice:${definition.id}`
  const catalogActivity = criticalCareActivityById.get(activityId)
  const [helpState, setHelpState] = useState({ activityId, visible: false })
  const helpVisible = helpState.activityId === activityId && helpState.visible
  const sourceEntries = definition.sourceBasis.map((source) => ({
    id: source.id,
    title: source.sourceTitle,
    sourceLabel: `${source.documentVersion} · ${source.pageOrSection}`,
    limitation: String(source.value ?? 'Use only within the authored educational source scope.'),
  }))
  const sourceTitles = [...new Set(definition.sourceBasis.map((source) => source.sourceTitle))]
  const evidenceEntries = sourceEntries

  function focusRestoredActivity() {
    document.getElementById('crrt-activity-viewport')?.focus({ preventScroll: true })
  }

  function showHelp() {
    setHelpState({ activityId, visible: true })
  }

  return (
    <CrrtWorkspaceShell
      layout="native-workbench"
      activityId={activityId}
      assumedConceptIds={catalogActivity?.assumedConceptIds}
      breadcrumb={
        <>
          <Link href={baxterCrrtNavBase}>CRRT</Link>
          {' / '}
          {mode === 'challenge' ? 'challenge' : 'practice'}
        </>
      }
      activityTitle={title}
      phase={crrtSemanticActivityPhase(session)}
      mode={mode}
      progressLabel={progressLabel}
      theme="dark"
      patientContext={
        <>
          <PatientContextBar
            title="Live patient, prescription, and circuit"
            items={[
              { label: 'Case', value: definition.title },
              { label: 'Device', value: deviceProfile.displayName },
              {
                label: 'Patient',
                value:
                  patient.status === 'configured'
                    ? `${formatClinicalValue(patient.bodyWeightKg, 'kg')} · MAP ${formatClinicalValue(patient.meanArterialPressureMmHg, 'mmHg')}`
                    : 'Patient data unavailable',
              },
              {
                label: 'Modality / blood flow',
                value:
                  prescription.status === 'configured'
                    ? `${prescription.modality.toUpperCase()} · ${formatClinicalValue(prescription.flows.bloodFlowMlMin, 'mL/min')}`
                    : 'Not configured',
              },
              {
                label: 'Effluent / patient removal',
                value: `${formatClinicalValue(
                  session.simulation.deliveredTherapy.prescribedEffluentDoseMlKgHour,
                  'mL/kg/h',
                )} · PFR ${formatClinicalValue(
                  prescription.flows.patientFluidRemovalMlHour,
                  'mL/h',
                )}`,
              },
              {
                label: 'Delivered / balance',
                value: `${formatClinicalValue(
                  latestTrend?.deliveredDoseMlKgHour,
                  'mL/kg/h',
                )} · ${formatClinicalValue(latestTrend?.cumulativeWholePatientBalanceMl, 'mL')}`,
              },
              {
                // Supplied case-start values, not the evolving pool. The pool is
                // advanced by delivered clearance alone, so showing it here would
                // read as a measured laboratory trend (see labEvidence.ts).
                label: 'Supplied labs at case start',
                value: `K ${suppliedLabValue('potassium')} · HCO₃ ${suppliedLabValue(
                  'bicarbonate',
                )} · pH ${suppliedLabValue('pH')} · not modeled over time`,
              },
              {
                label: 'Pressure pattern',
                value: formatPressurePattern(
                  pressures.accessPressureMmHg,
                  pressures.filterPressureMmHg,
                  pressures.returnPressureMmHg,
                  pressures.effluentPressureMmHg,
                ),
              },
              {
                label: 'Active alert',
                value: activeAlarm ? humanizeAlarmCode(activeAlarm.code) : 'None',
              },
            ]}
            immediateGoal={definition.learningObjectives[0]}
            safetyConstraints={[
              'Educational simulation only; use current manufacturer instructions and local policy.',
              'Displayed values and responses are synthetic and are not patient-specific targets.',
            ]}
          />
          {resumed ? (
            <ResumeBanner
              state="ready"
              title="Return to saved case"
              description={`${definition.title} is open with its saved selection and device profile; prior machine and answer state was not replayed.`}
              onResume={focusRestoredActivity}
              resumeActionLabel="Return to case"
            />
          ) : null}
        </>
      }
      currentTask={
        <TaskPanel
          objective={`${task.objective} ${definition.learningObjectives[0]}`}
          requiredAction={task.requiredAction}
          targets={
            session.reasoningPhase === 'read'
              ? definition.visibleFindings.slice(0, 4)
              : definition.learningObjectives
          }
          hint={definition.hintLadder[0]?.text}
          mode="practice"
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
                summary: definition.patientDescription,
                meta: sourceTitles.join(' · '),
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
                  label: 'Clinical frame',
                  result: 'Compare the prediction with the observed patient and circuit response',
                },
                {
                  label: 'Safety review',
                  result:
                    session.criticalErrorIds.length === 0
                      ? 'Review device warnings and prerequisites for each action'
                      : 'Revisit the safety event and the cue that preceded it',
                },
                {
                  label: 'Reassessment',
                  result: 'Reconnect prescription, delivered therapy, circuit, and patient',
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
