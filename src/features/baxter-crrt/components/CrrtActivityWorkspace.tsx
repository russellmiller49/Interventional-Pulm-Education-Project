'use client'

import { useRef, useState, type ReactNode } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import {
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { ActivityChrome } from '@/features/learning-module/components/ActivityChrome'
import { AssumedConceptStrip } from '@/features/critical-care/components/AssumedConceptStrip'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { baxterCrrtMasteryManifest } from '../content/mastery'
import { getBaxterCrrtDeviceProfile } from '../content/deviceProfiles'
import { CRRT_ACTUAL_BLOOD_FLOW_LABEL, selectCrrtBloodFlowState } from '../engine/circuitDelivery'
import type { CrrtLearningSessionState, CrrtReasoningPhase } from '../engine/learningSession'
import {
  formatCrrtSuppliedLabValue,
  selectCrrtLabEvidence,
  type CrrtSuppliedLabValue,
} from '../labEvidence'
import {
  CrrtCurrentTask,
  CrrtEvidenceSummary,
  CrrtHelpDialog,
  CrrtWorkbenchLayout,
  type CrrtEvidenceItem,
} from './CrrtWorkbench'
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

/** The four measured sites in circuit order, one unit for the row. */
function formatPressureSites(
  access: number | null | undefined,
  filter: number | null | undefined,
  returnPressure: number | null | undefined,
  effluent: number | null | undefined,
): string {
  const values = [access, filter, returnPressure, effluent]
  if (values.some((value) => value === null || value === undefined || !Number.isFinite(value))) {
    return values.map((value) => formatClinicalValue(value, 'mmHg')).join(' · ')
  }
  return `${values
    .map((value) => (value as number).toLocaleString(undefined, { maximumFractionDigits: 1 }))
    .join(' · ')} mmHg`
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
  /** Case or return navigation shown above the task and the case (Practice: the Cases control). */
  readonly navigation?: ReactNode
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
  navigation,
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
  const bloodFlow = selectCrrtBloodFlowState(session.simulation)
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
  const [helpOpen, setHelpOpen] = useState(false)
  const helpReturnFocus = useRef<HTMLElement | null>(null)
  const sourceTitles = [...new Set(definition.sourceBasis.map((source) => source.sourceTitle))]

  // Every item the old sideways strip carried, except the case title (already the page heading
  // and the Cases control). Values keep their units and are grouped by whether they were supplied
  // at case start, are the current setting, or are live model output. Set and actual blood flow
  // stay two separate readings (CRRT-FELLOW-02), and laboratory values stay the supplied
  // case-start values with their "not modeled over time" statement (CRRT-FELLOW-01).
  const evidenceItems: readonly CrrtEvidenceItem[] = [
    {
      id: 'patient',
      label: 'Weight · MAP',
      value:
        patient.status === 'configured'
          ? `${formatClinicalValue(patient.bodyWeightKg, 'kg')} · MAP ${formatClinicalValue(
              patient.meanArterialPressureMmHg,
              'mmHg',
            )}`
          : 'Patient data unavailable',
      basis: 'supplied',
    },
    {
      // Supplied case-start values, not the evolving pool. The pool is advanced by delivered
      // clearance alone, so showing it here would read as a measured laboratory trend.
      id: 'labs',
      label: 'Supplied labs at case start',
      value: `K ${suppliedLabValue('potassium')} · HCO₃ ${suppliedLabValue(
        'bicarbonate',
      )} · pH ${suppliedLabValue('pH')} · not modeled over time`,
      basis: 'supplied',
    },
    {
      id: 'therapy',
      label: 'Therapy · blood flow set',
      value:
        prescription.status === 'configured'
          ? `${prescription.modality.toUpperCase()} · ${formatClinicalValue(
              bloodFlow.setMlMin,
              'mL/min',
            )}`
          : 'Not configured',
      basis: 'setting',
    },
    {
      id: 'prescribed',
      label: 'Prescribed dose · fluid removal set',
      value:
        prescription.status === 'configured'
          ? `${formatClinicalValue(
              session.simulation.deliveredTherapy.prescribedEffluentDoseMlKgHour,
              'mL/kg/h',
            )} · ${formatClinicalValue(prescription.flows.patientFluidRemovalMlHour, 'mL/h')}`
          : 'Not configured',
      basis: 'setting',
    },
    {
      id: 'actual-flow',
      label: CRRT_ACTUAL_BLOOD_FLOW_LABEL,
      value:
        bloodFlow.actualMlMin === null
          ? 'Not set'
          : formatClinicalValue(bloodFlow.actualMlMin, 'mL/min'),
      basis: 'model',
    },
    {
      id: 'delivered',
      label: 'Delivered dose · whole-patient balance',
      value: `${formatClinicalValue(
        latestTrend?.deliveredDoseMlKgHour,
        'mL/kg/h',
      )} · ${formatClinicalValue(latestTrend?.cumulativeWholePatientBalanceMl, 'mL')}`,
      basis: 'model',
    },
    {
      id: 'pressures',
      label: 'Access · filter · return · effluent pressure',
      value: formatPressureSites(
        pressures.accessPressureMmHg,
        pressures.filterPressureMmHg,
        pressures.returnPressureMmHg,
        pressures.effluentPressureMmHg,
      ),
      basis: 'model',
    },
  ]

  function focusRestoredActivity() {
    document.getElementById('crrt-activity-viewport')?.focus({ preventScroll: true })
  }

  function openHelp() {
    // Help is opened from the shared activity header, not from a dialog trigger, so remember the
    // opener and give focus back to it on close.
    helpReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setHelpOpen(true)
  }

  return (
    <ActivityChrome
      layout="native-workbench"
      showProgressStepper={false}
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
      onHelp={openHelp}
      onReset={onReset}
      onSaveAndExit={onSaveAndExit}
      bottomContent={progressLabel}
    >
      <div className={styles.workspaceStack}>
        {catalogActivity && catalogActivity.assumedConceptIds.length > 0 ? (
          <AssumedConceptStrip
            activityId={activityId}
            conceptIds={catalogActivity.assumedConceptIds}
          />
        ) : null}
        <CrrtWorkbenchLayout
          navigation={navigation}
          currentTask={
            <CrrtCurrentTask
              immediateGoal={definition.learningObjectives[0] ?? task.objective}
              objective={task.objective}
              requiredAction={task.requiredAction}
              targets={
                session.reasoningPhase === 'read'
                  ? definition.visibleFindings.slice(0, 4)
                  : definition.learningObjectives
              }
              targetsLabel={
                session.reasoningPhase === 'read' ? 'Findings to review' : 'Learning objectives'
              }
              hint={definition.hintLadder[0]?.text}
              material={{
                reference: {
                  id: definition.id,
                  title,
                  summary: definition.patientDescription,
                  meta: sourceTitles.join(' · '),
                },
                evidence: definition.sourceBasis.map((source) => ({
                  id: source.id,
                  title: source.sourceTitle,
                  sourceLabel: `${source.documentVersion} · ${source.pageOrSection}`,
                  limitation: String(
                    source.value ?? 'Use only within the authored educational source scope.',
                  ),
                })),
              }}
            >
              {currentTaskExtras}
            </CrrtCurrentTask>
          }
          evidence={
            <CrrtEvidenceSummary
              alert={{
                active: Boolean(activeAlarm),
                label: activeAlarm ? humanizeAlarmCode(activeAlarm.code) : 'None',
              }}
              items={evidenceItems}
              deviceLabel={deviceProfile.displayName}
              safetyConstraints={[
                'Educational simulation only; use current manufacturer instructions and local policy.',
                'Displayed values and responses are synthetic and are not patient-specific targets.',
              ]}
            />
          }
        >
          <div id="crrt-activity-viewport" className={styles.activityViewport} tabIndex={-1}>
            {resumed ? (
              <ResumeBanner
                state="ready"
                title="Return to saved case"
                description={`${definition.title} is open with its saved selection and device profile; prior machine and answer state was not replayed.`}
                onResume={focusRestoredActivity}
                resumeActionLabel="Return to case"
              />
            ) : null}
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
        </CrrtWorkbenchLayout>
        <CrrtHelpDialog
          open={helpOpen}
          onOpenChange={setHelpOpen}
          returnFocusRef={helpReturnFocus}
          hint={definition.hintLadder[0]?.text}
          caseTitle={title}
          includesCaseNavigation={mode === 'practice'}
        />
      </div>
    </ActivityChrome>
  )
}
