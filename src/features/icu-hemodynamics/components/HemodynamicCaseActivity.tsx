'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useRef, useState } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareReferences } from '@/features/critical-care/content/references'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import {
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
  type CriticalCareActivityStatus,
} from '@/features/learning-module/activity'
import { Link, useRouter } from '@/i18n/navigation'

import { hemodynamicCaseById, hemodynamicsSourceById } from '../content'
import {
  createInitialHemodynamicState,
  hasHemodynamicMastery,
  icuHemodynamicsReducer,
  readIcuHemodynamicsProgress,
  recordIcuHemodynamicsResult,
  thermodilutionAcceptedAverage,
  writeIcuHemodynamicsProgress,
  type HemodynamicAction,
} from '../engine'
import { HemodynamicNativeWorkspace } from './HemodynamicNativeWorkspace'

type CaseMode = 'practice' | 'challenge'

const phaseOrder: readonly CriticalCareActivityPhase[] = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
]

const hd08ProcedureMilestoneIds = new Set([
  'correct-measurement-system',
  'reposition-catheter',
  'repeat-valid-thermodilution',
])

function seededCaseNumber(caseId: string, mode: CaseMode): number {
  const base = [...caseId].reduce((total, character) => total + character.charCodeAt(0), 0)
  return mode === 'challenge' ? base + 7000 : base + 3000
}

function metricValue(value: number | null, digits = 0): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message)
  return value
}

export function HemodynamicCaseActivity({
  caseId,
  mode,
  locale = 'en',
}: {
  readonly caseId: string
  readonly mode: CaseMode
  readonly locale?: string
}) {
  const definition = requireValue(
    hemodynamicCaseById.get(caseId),
    `Unknown hemodynamics case: ${caseId}`,
  )
  const section = mode === 'challenge' ? 'assess' : 'practice'
  const activityId =
    mode === 'challenge' ? 'hemodynamics:assess:masked-seeded' : `hemodynamics:practice:${caseId}`
  const activity = requireValue(
    criticalCareActivityById.get(activityId),
    `Missing critical-care activity: ${activityId}`,
  )

  const router = useRouter()
  const [state, setState] = useState(() =>
    createInitialHemodynamicState(definition, 'practice', seededCaseNumber(caseId, mode)),
  )
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [hintVisible, setHintVisible] = useState(false)
  const [transferComplete, setTransferComplete] = useState(false)
  const [transferChoiceId, setTransferChoiceId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const attempt = useRef(1)
  const legacyRecorded = useRef(false)
  const recordedSafetyEvents = useRef(new Set<string>())
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
    activityId,
    mode,
    phase,
  })
  const assessmentMasked = mode === 'challenge' && !state.completed

  const dispatch = (action: HemodynamicAction) => {
    setState((current) => icuHemodynamicsReducer(current, action))
  }

  useEffect(() => {
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    attempt.current = (existing?.attempts ?? 0) + 1
    if (envelope.resume?.activityId === activityId) {
      const timer = window.setTimeout(
        () =>
          setMessage(
            'Saved work was restored to the authored pre-prediction checkpoint; detailed interventions are not replayed without an exact safe contract.',
          ),
        0,
      )
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [activityId])

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(
      () =>
        setState((current) =>
          icuHemodynamicsReducer(current, { type: 'TICK', seconds: intervalMs / 1000 }),
        ),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!state.completed || !state.score || legacyRecorded.current) return
    legacyRecorded.current = true
    const legacy = readIcuHemodynamicsProgress()
    writeIcuHemodynamicsProgress(
      recordIcuHemodynamicsResult(legacy, {
        caseId: state.caseId,
        score: state.score,
        criticalErrorCount: state.criticalErrors.length,
      }),
    )
  }, [state.caseId, state.completed, state.criticalErrors.length, state.score])

  useEffect(() => {
    if (state.criticalErrors.length === 0) {
      recordedSafetyEvents.current.clear()
      return
    }
    for (const error of state.criticalErrors) {
      if (recordedSafetyEvents.current.has(error)) continue
      recordedSafetyEvents.current.add(error)
      lifecycleAnalytics.recordSafetyEvent()
    }
  }, [lifecycleAnalytics, state.criticalErrors])

  useEffect(() => {
    if (
      definition.requiredInterventionIds.length > 0 &&
      definition.requiredInterventionIds.every((id) => state.completedInterventionIds.includes(id))
    ) {
      lifecycleAnalytics.recordGoalMet()
    }
  }, [definition.requiredInterventionIds, lifecycleAnalytics, state.completedInterventionIds])

  const referenceEntries = useMemo(() => {
    if (assessmentMasked) {
      return [
        {
          id: 'hemodynamics-assessment-boundary',
          title: 'Assessment reference boundary',
          summary: 'Case-specific references and diagnosis cues become available after debrief.',
          meta: 'Masked assessment',
        },
      ]
    }
    const directlyRelated = criticalCareReferences.filter((reference) =>
      (reference.relatedActivityIds as readonly string[]).includes(activityId),
    )
    const records =
      directlyRelated.length > 0
        ? directlyRelated
        : criticalCareReferences.filter((reference) =>
            (reference.moduleIds as readonly string[]).includes('icu-hemodynamics'),
          )
    return records.map((reference) => ({
      id: reference.id,
      title: reference.title,
      summary: reference.summary,
      meta: reference.category.replaceAll('-', ' '),
    }))
  }, [activityId, assessmentMasked])

  const evidenceEntries = useMemo(
    () =>
      assessmentMasked
        ? [
            {
              id: 'hemodynamics-assessment-evidence-boundary',
              title: 'Assessment evidence boundary',
              sourceLabel: 'Scenario-specific evidence available after debrief',
              limitation:
                'Use current institutional policy, source documents, and supervised clinical judgment.',
            },
          ]
        : definition.sourceIds.flatMap((sourceId) => {
            const source = hemodynamicsSourceById.get(sourceId)
            return source
              ? [
                  {
                    id: source.id,
                    title: source.title,
                    sourceLabel: `${source.citation} · version ${source.version}. Intended use: ${source.intendedUse}`,
                    limitation: source.limitation ?? 'Educational use only; not patient-specific.',
                  },
                ]
              : []
          }),
    [assessmentMasked, definition.sourceIds],
  )

  function writeNormalizedProgress(
    status: CriticalCareActivityStatus,
    phaseForProgress: CriticalCareActivityPhase,
    addHint = false,
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    const authoritativeStatus = authoritativeCriticalCareStatus(activity, status)
    const done = authoritativeStatus === 'completed' || authoritativeStatus === 'mastered'
    let updated = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId,
        status: authoritativeStatus,
        currentPhase: phaseForProgress,
        mode: mode satisfies CriticalCareActivityMode,
        ...(state.score ? { bestScore: state.score.total } : {}),
        attempts: Math.max(attempt.current, existing?.attempts ?? 0),
        hintCount: (existing?.hintCount ?? 0) + (addHint ? 1 : 0),
        competencyEvidenceIds: authoritativeCriticalCareCompetencyEvidence(
          activity,
          done ? activity.competencyIds : [],
        ),
        updatedAt: now,
      },
      done
        ? undefined
        : {
            activityId,
            pathname: `/icu-hemodynamics/${section}`,
            query: mode === 'challenge' ? { start: '1' } : { case: caseId },
            mode,
            // Detailed interventions are not replayed for this activity. The
            // authored safe restore point is the beginning of Recognize, even
            // when the learner had advanced farther in the live UI.
            phase: 'recognize',
            scenarioId: mode === 'challenge' ? 'masked-seeded' : caseId,
            checkpointId: 'authored-pre-prediction',
            payloadVersion: `hemodynamic-case-${definition.version}-v1`,
            updatedAt: now,
          },
    )
    if (done) updated = withoutCriticalCareResumePointer(updated, activityId)
    const saved = writeCriticalCareProgress(window.localStorage, updated)
    setMessage(
      saved
        ? done
          ? `${authoritativeStatus === 'mastered' ? 'Mastery' : 'Completion'} saved on this device.`
          : 'Safe pre-prediction checkpoint saved on this device.'
        : 'Progress could not be stored on this device.',
    )
  }

  function checkpoint(nextPhase: CriticalCareActivityPhase) {
    setPhase(nextPhase)
    setHintVisible(false)
    writeNormalizedProgress('in-progress', nextPhase)
  }

  function commitPrediction() {
    dispatch({ type: 'COMMIT_PREDICTION' })
    lifecycleAnalytics.recordPredictionSubmitted()
    checkpoint('act')
  }

  function applyIntervention(interventionId: string) {
    const selected = definition.interventions.find((item) => item.id === interventionId)
    if (!selected) return
    dispatch({ type: 'APPLY_INTERVENTION', intervention: selected })
    writeNormalizedProgress('in-progress', 'act')
  }

  function completeReassessment() {
    setState((current) => {
      const reassessed = icuHemodynamicsReducer(current, { type: 'REASSESS' })
      return icuHemodynamicsReducer(reassessed, { type: 'COMPLETE_CASE' })
    })
    lifecycleAnalytics.recordDebriefViewed()
    checkpoint('explain')
  }

  function beginTransfer() {
    setState((current) => {
      const leveledVariant = icuHemodynamicsReducer(current, {
        type: 'SET_TRANSDUCER_LEVEL',
        levelCm: -5,
      })
      const dampedVariant = icuHemodynamicsReducer(leveledVariant, {
        type: 'SET_DAMPING',
        dampingRatio: 1.15,
      })
      return {
        ...icuHemodynamicsReducer(dampedVariant, {
          type: 'SET_ARTIFACT',
          artifact: 'overdamped',
        }),
        signalValidationChecks: current.signalValidationChecks.filter(
          (check) =>
            check !== 'fast-flush' &&
            check !== 'dynamic-response-classified' &&
            check !== 'dynamic-response-corrected',
        ),
      }
    })
    setTransferChoiceId(null)
    checkpoint('transfer')
  }

  function completeTransfer() {
    if (!state.score) return
    const transferInteractionComplete =
      transferChoiceId === 'overdamped-after-position-change' &&
      Math.abs(state.measurementSystem.transducerLevelCm) <= 1 &&
      state.signalValidationChecks.includes('fast-flush') &&
      state.signalValidationChecks.includes('dynamic-response-classified') &&
      state.signalValidationChecks.includes('dynamic-response-corrected') &&
      state.measurementSystem.artifact === 'none'
    if (!transferInteractionComplete) {
      setMessage(
        'Interpret the new release trace, re-level the transducer, and correct the dynamic response in the workspace.',
      )
      return
    }
    const mastered = hasHemodynamicMastery(state)
    setTransferComplete(true)
    writeNormalizedProgress(mastered ? 'mastered' : 'completed', 'transfer')
    lifecycleAnalytics.recordTransferCompleted()
    lifecycleAnalytics.recordActivityCompleted(mastered)
  }

  function reset() {
    setState(createInitialHemodynamicState(definition, 'practice', seededCaseNumber(caseId, mode)))
    setPhase('recognize')
    setHintVisible(false)
    setTransferComplete(false)
    setTransferChoiceId(null)
    legacyRecorded.current = false
    setMessage('Case reset with the same deterministic seed.')
  }

  function showHint() {
    if (mode === 'challenge') {
      setMessage(
        'Assessment help: diagnosis cues remain hidden. Use the generic Reference and Evidence boundaries for model limits and source scope.',
      )
      return
    }
    if (!hintVisible) {
      writeNormalizedProgress('in-progress', phase, true)
      lifecycleAnalytics.recordHintUsed()
    }
    setHintVisible(true)
  }

  function saveAndExit() {
    writeNormalizedProgress('in-progress', phase)
    router.push(`/icu-hemodynamics/${section}` as Route)
  }

  const requiredCompleted = definition.requiredInterventionIds.filter((id) =>
    state.completedInterventionIds.includes(id),
  ).length
  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  const canObserve =
    state.predictionCommitted &&
    (definition.id === 'HD-08'
      ? requiredCompleted === definition.requiredInterventionIds.length
      : state.completedInterventionIds.length > 0)
  const visibleInterventions = definition.interventions.filter(
    (intervention) => definition.id !== 'HD-08' || !hd08ProcedureMilestoneIds.has(intervention.id),
  )
  const modeLabel: CriticalCareActivityMode = mode

  let taskControls = null
  if (phase === 'recognize') {
    taskControls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => checkpoint('predict')}
      >
        Orient to the patient and signals
      </button>
    )
  } else if (phase === 'predict') {
    taskControls = (
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Suspected mechanism
          <select
            className="min-h-11 rounded-xl border bg-background px-3 font-normal"
            value={state.selectedMechanismId}
            onChange={(event) => dispatch({ type: 'SELECT_MECHANISM', id: event.target.value })}
          >
            <option value="">Choose a mechanism…</option>
            {definition.mechanismOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Immediate priority
          <select
            className="min-h-11 rounded-xl border bg-background px-3 font-normal"
            value={state.selectedPriorityId}
            onChange={(event) => dispatch({ type: 'SELECT_PRIORITY', id: event.target.value })}
          >
            <option value="">Choose a priority…</option>
            {definition.priorityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!state.selectedMechanismId || !state.selectedPriorityId}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={commitPrediction}
        >
          Commit mechanism and priority
        </button>
      </div>
    )
  } else if (phase === 'act') {
    taskControls = (
      <div className="grid gap-3">
        <div className="grid gap-2 text-xs" aria-label="Signal-validation state">
          <p
            className="rounded-lg border p-2"
            data-complete={Math.abs(state.measurementSystem.transducerLevelCm) <= 1 || undefined}
          >
            Level: {state.measurementSystem.transducerLevelCm.toFixed(0)} cm from reference
          </p>
          <p
            className="rounded-lg border p-2"
            data-complete={state.measurementSystem.zeroed || undefined}
          >
            Atmospheric zero: {state.measurementSystem.zeroed ? 'complete' : 'required'}
          </p>
          <p
            className="rounded-lg border p-2"
            data-complete={
              state.signalValidationChecks.includes('dynamic-response-classified') || undefined
            }
          >
            Dynamic response:{' '}
            {state.signalValidationChecks.includes('dynamic-response-classified')
              ? 'classified'
              : 'not classified'}
          </p>
          <p className="rounded-lg border p-2">Catheter: {state.catheter.position.toUpperCase()}</p>
        </div>
        <div className="grid gap-2" aria-label="Bounded simulated interventions">
          {visibleInterventions.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={state.completedInterventionIds.includes(item.id) && !item.repeatable}
              className="min-h-11 rounded-xl border p-3 text-left text-sm disabled:opacity-50"
              onClick={() => applyIntervention(item.id)}
            >
              <strong className="block">{item.shortLabel}</strong>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!canObserve}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => checkpoint('observe')}
        >
          Observe the modeled response
        </button>
      </div>
    )
  } else if (phase === 'observe') {
    taskControls = (
      <div className="grid gap-3">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt>MAP</dt>
            <dd>{metricValue(state.measurements.mapMmHg)} mmHg</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cardiac index</dt>
            <dd>{metricValue(state.measurements.cardiacIndexLMinM2, 1)} L/min/m²</dd>
          </div>
          <div className="flex justify-between">
            <dt>Required actions</dt>
            <dd>
              {requiredCompleted}/{definition.requiredInterventionIds.length}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Accepted CO</dt>
            <dd>{average === null ? 'Pending' : `${average.toFixed(1)} L/min`}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          onClick={() => dispatch({ type: 'TICK', seconds: 15 })}
        >
          Observe 15 model seconds
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={completeReassessment}
        >
          Commit final reassessment
        </button>
      </div>
    )
  } else if (phase === 'explain') {
    taskControls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={beginTransfer}
      >
        Open a new signal-transfer variant
      </button>
    )
  } else {
    const transferInteractionComplete =
      transferChoiceId === 'overdamped-after-position-change' &&
      Math.abs(state.measurementSystem.transducerLevelCm) <= 1 &&
      state.signalValidationChecks.includes('dynamic-response-classified') &&
      state.signalValidationChecks.includes('dynamic-response-corrected') &&
      state.measurementSystem.artifact === 'none'
    taskControls = (
      <div className="grid gap-2">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">
            After a patient-position change, the release trace returns slowly with little
            oscillation and pulse pressure narrows. What best explains the new signal?
          </legend>
          {[
            [
              'overdamped-after-position-change',
              'An off-level, overdamped measurement chain that requires revalidation',
            ],
            [
              'true-afterload-change',
              'A true acute rise in afterload; the pressure signal itself is already valid',
            ],
            [
              'respiratory-change',
              'Respiratory variation alone, despite the abnormal fast-flush release',
            ],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                name="case-transfer-interpretation"
                checked={transferChoiceId === value}
                onChange={() => setTransferChoiceId(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p className="rounded-xl bg-muted p-3 text-xs leading-5">
          Re-level, run and classify the live fast-flush trace, then correct the response in the
          pressure-system workspace. The answer choice alone does not complete transfer.
        </p>
        <button
          type="button"
          disabled={transferComplete || !transferInteractionComplete}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={completeTransfer}
        >
          Complete validated transfer
        </button>
      </div>
    )
  }

  const viewport =
    phase === 'explain' && state.score ? (
      <div className="h-full overflow-auto p-4">
        <DebriefPanel
          clinicalModel={`Mechanism: ${definition.mechanismOptions.find((item) => item.id === state.selectedMechanismId)?.label ?? 'not selected'}; priority: ${definition.priorityOptions.find((item) => item.id === state.selectedPriorityId)?.label ?? 'not selected'}.`}
          actions={state.completedInterventionIds.map(
            (id) => definition.interventions.find((item) => item.id === id)?.label ?? id,
          )}
          consequences={definition.debrief}
          performanceDomains={[
            { label: 'Signal validity', result: `${state.score.signalValidity}/20` },
            { label: 'Mechanism', result: `${state.score.mechanism}/20` },
            { label: 'Management', result: `${state.score.management}/25` },
            { label: 'TD + derived', result: `${state.score.thermodilutionAndDerived}/15` },
            { label: 'Reassessment + safety', result: `${state.score.reassessmentAndSafety}/20` },
            { label: 'Total', result: `${state.score.total}/100` },
          ]}
          remediation={
            hasHemodynamicMastery(state) ? undefined : (
              <p>
                Review signal validation and the case-specific required interventions before
                replaying with the same seed.
              </p>
            )
          }
          transfer={
            <p>Carry the full signal-to-reassessment loop into a different shock phenotype.</p>
          }
        />
      </div>
    ) : (
      <HemodynamicNativeWorkspace
        state={state}
        dispatch={dispatch}
        pressureChallengeMode={
          definition.id === 'HD-08' || phase === 'transfer' ? 'current-state' : 'selectable'
        }
      />
    )

  return (
    <SimulationLaunchGate
      activityTitle={assessmentMasked ? 'Masked hemodynamics capstone' : definition.title}
      minimumViewport="desktop"
      bandwidthClass="standard"
      estimatedSizeLabel="Under 2 MB after shared application assets"
      lightweightAlternativeHref={`/icu-hemodynamics/${section}`}
      onSaveForLater={saveAndExit}
      theme="dark"
    >
      {locale !== 'en' ? (
        <p className="sr-only">Reviewed English fallback; localized clinical review is pending.</p>
      ) : null}
      <ActivityShell
        layout="case-workspace"
        breadcrumb={
          <span>
            <Link href={'/icu-hemodynamics' as Route}>ICU Hemodynamics</Link> /{' '}
            <Link href={`/icu-hemodynamics/${section}` as Route}>
              {section === 'assess' ? 'Assess' : 'Practice'}
            </Link>{' '}
            / {assessmentMasked ? 'Masked case' : caseId}
          </span>
        }
        activityTitle={assessmentMasked ? 'Masked hemodynamics capstone' : definition.title}
        phase={phase}
        mode={modeLabel}
        progressLabel={
          transferComplete
            ? state.score && hasHemodynamicMastery(state)
              ? 'Mastered'
              : 'Completed'
            : `${phaseOrder.indexOf(phase) + 1} of 6 · ${phase}`
        }
        patientContext={
          <PatientContextBar
            title={assessmentMasked ? 'Masked patient context' : 'Patient context'}
            items={[
              { label: 'Scenario', value: assessmentMasked ? 'Masked assessment' : caseId },
              { label: 'Setting', value: 'Adult ICU · simulated' },
              {
                label: 'Presentation',
                value: definition.presentation,
              },
              { label: 'HR', value: `${state.parameters.heartRateBpm.toFixed(0)} /min` },
              { label: 'MAP', value: `${state.measurements.mapMmHg.toFixed(0)} mmHg` },
              {
                label: 'Cardiac index',
                value: `${state.measurements.cardiacIndexLMinM2.toFixed(1)} L/min/m²`,
              },
              {
                label: 'PA / PAWP',
                value: `${state.measurements.papSystolicMmHg}/${state.measurements.papDiastolicMmHg} · ${state.measurements.pawpMmHg ?? '—'} mmHg`,
              },
              {
                label: 'Support',
                value: `PEEP ${state.parameters.peepCmH2O.toFixed(0)} cm H₂O`,
              },
              { label: 'PAC position', value: state.catheter.position.toUpperCase() },
              { label: 'Model time', value: `${state.timeSeconds.toFixed(1)} s` },
            ]}
            immediateGoal={
              phase === 'recognize'
                ? definition.presentation
                : phase === 'transfer'
                  ? 'Revalidate the altered measurement chain before carrying the case interpretation forward.'
                  : 'Build a mechanism, act in bounded tiers, and reassess the whole patient.'
            }
            safetyConstraints={[
              'Educational model—not a clinical device.',
              'No patient-specific dosing or treatment guidance.',
            ]}
          />
        }
        viewport={viewport}
        currentTask={
          <TaskPanel
            objective={
              phase === 'recognize'
                ? 'Recognize the patient, signal quality, and immediate problem.'
                : phase === 'predict'
                  ? 'Commit to a mechanism and immediate priority.'
                  : phase === 'act'
                    ? 'Validate signals and choose bounded modeled interventions.'
                    : phase === 'observe'
                      ? 'Observe the response and complete a whole-patient reassessment.'
                      : phase === 'explain'
                        ? 'Review the existing score and causal debrief.'
                        : 'Apply signal validation to an altered level and dynamic-response variant.'
            }
            requiredAction={
              phase === 'recognize'
                ? definition.presentation
                : phase === 'act'
                  ? 'Use the monitor, optional CO/derived surfaces, and case interventions.'
                  : 'Complete the current reasoning checkpoint.'
            }
            targets={
              assessmentMasked
                ? ['Complete the current phase without diagnosis or threshold cues.']
                : definition.successCriteria.map((criterion) => criterion.label)
            }
            hint={mode === 'challenge' ? undefined : definition.guidedPrompt}
            hintVisible={hintVisible}
            onHintRequested={mode === 'challenge' ? undefined : showHint}
            mode={modeLabel}
          >
            {taskControls}
          </TaskPanel>
        }
        bottomContent={
          message ? (
            <span role="status">{message}</span>
          ) : (
            (state.responseMessage ?? `Deterministic seed ${state.seed}`)
          )
        }
        secondaryActions={
          <>
            <ReferenceDrawer
              entries={referenceEntries}
              trigger={
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Reference
                </button>
              }
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Evidence
                </button>
              }
            />
          </>
        }
        onHelp={showHint}
        onReset={reset}
        onSaveAndExit={saveAndExit}
        theme="dark"
        maskedAssessment={assessmentMasked}
      />
    </SimulationLaunchGate>
  )
}
