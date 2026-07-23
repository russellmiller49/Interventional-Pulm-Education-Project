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
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { Link, useRouter } from '@/i18n/navigation'

import { hemodynamicCaseById, hemodynamicsSourceById, type PacGuidedSkillId } from '../content'
import {
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  thermodilutionAcceptedAverage,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import { BedsideMonitor } from './BedsideMonitor'
import { FormulaDrawer } from './FormulaDrawer'
import { PacActionDock } from './PacActionDock'
import { PacSkillsLab } from './PacSkillsLab'

interface PacGuidedSkillSpec {
  readonly title: string
  readonly prediction: string
  readonly objective: string
  readonly requiredAction: string
  readonly explanation: readonly string[]
  readonly transfer: string
}

const skillSpecs: Readonly<Record<PacGuidedSkillId, PacGuidedSkillSpec>> = {
  'pressure-system': {
    title: 'Level, zero, and dynamic response',
    prediction: 'Which action belongs before interpreting an invasive pressure?',
    objective: 'Establish a valid pressure-measurement system.',
    requiredAction:
      'Open to air and zero, then characterize the dynamic response with a fast flush.',
    explanation: [
      'Hydrostatic offset changes every displayed invasive pressure.',
      'The fast-flush response characterizes the measurement system before a waveform is interpreted.',
    ],
    transfer:
      'Repeat level, zero, and dynamic-response validation after any setup or position change.',
  },
  'catheter-advancement': {
    title: 'Advance the PAC by waveform',
    prediction: 'What confirms advancement through the right heart?',
    objective: 'Advance from the introducer to a confirmed pulmonary-artery waveform.',
    requiredAction: 'Advance one position at a time and confirm each pressure waveform.',
    explanation: [
      'The authored route progresses from introducer to RA, RV, and PA.',
      'Anatomic route cues support orientation, but the pressure waveform confirms each transition.',
    ],
    transfer:
      'When a position is uncertain, stop advancement and re-establish a confirmed waveform.',
  },
  'pawp-capture': {
    title: 'Brief end-expiratory PAWP capture',
    prediction: 'When is a PAWP sample stored in this model?',
    objective: 'Capture a brief, end-expiratory PAWP and restore the PA waveform.',
    requiredAction:
      'Inflate only from confirmed PA, sample one respiratory cycle, place the cursor, store, and deflate.',
    explanation: [
      'PAWP capture uses transient balloon occlusion from a confirmed PA position.',
      'Prompt deflation and return of the PA waveform close the safety sequence.',
    ],
    transfer:
      'If the PA waveform does not return, treat the signal and catheter position as unsafe.',
  },
  'thermodilution-series': {
    title: 'Thermodilution technique and curve review',
    prediction: 'Which curves belong in an accepted cardiac-output average?',
    objective: 'Create and accept at least three technically valid thermodilution trials.',
    requiredAction: 'Standardize technique, review each curve, and reject poor trials.',
    explanation: [
      'A technically poor curve should be rejected rather than averaged into false precision.',
      'The preserved engine calculates the accepted valid average only after adequate trials.',
    ],
    transfer:
      'Repeat a questionable trial with standardized technique instead of forcing agreement.',
  },
  'derived-hemodynamics': {
    title: 'Derived values and interpretation limits',
    prediction: 'What happens to a derived value when one of its inputs is invalid?',
    objective: 'Review formulas and the validity screen for every derived value.',
    requiredAction: 'Open the formula panel and inspect the explicit not-interpretable states.',
    explanation: [
      'Derived values inherit the validity and limitations of every input.',
      'PPV remains unavailable outside the modeled rhythm, ventilation, effort, chest, waveform, and RV conditions.',
    ],
    transfer:
      'Withhold precise derived interpretation whenever a source measurement is stale or invalid.',
  },
}

const phaseOrder: readonly CriticalCareActivityPhase[] = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
]

function requireCase(): NonNullable<ReturnType<typeof hemodynamicCaseById.get>> {
  const definition = hemodynamicCaseById.get('HD-01')
  if (!definition) throw new Error('PAC skills require hemodynamic case HD-01.')
  return definition
}

const baseCase = requireCase()

function requireActivity(activityId: string) {
  const activity = criticalCareActivityById.get(activityId)
  if (!activity) throw new Error(`Missing critical-care activity: ${activityId}`)
  return activity
}

function initialSkillState(skillId: PacGuidedSkillId): HemodynamicSimulationState {
  let state = createInitialHemodynamicState(baseCase, 'learn', 510)
  if (skillId === 'catheter-advancement') {
    state = icuHemodynamicsReducer(state, {
      type: 'SET_CATHETER_POSITION',
      position: 'introducer',
    })
  }
  if (skillId === 'pawp-capture' || skillId === 'thermodilution-series') {
    state = icuHemodynamicsReducer(state, { type: 'SET_CATHETER_POSITION', position: 'pa' })
  }
  if (skillId === 'derived-hemodynamics') {
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    state = icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'none' })
  }
  return state
}

function objectiveComplete(skillId: PacGuidedSkillId, state: HemodynamicSimulationState): boolean {
  if (skillId === 'pressure-system') {
    return (
      state.measurementSystem.zeroed &&
      state.signalValidationChecks.includes('fast-flush') &&
      state.signalValidationChecks.includes('dynamic-response-classified')
    )
  }
  if (skillId === 'catheter-advancement') return state.catheter.position === 'pa'
  if (skillId === 'pawp-capture') {
    return (
      state.catheter.storedWedgeMmHg !== null &&
      !state.catheter.balloonInflated &&
      state.catheter.position === 'pa'
    )
  }
  if (skillId === 'thermodilution-series') {
    return thermodilutionAcceptedAverage(state.thermodilutionTrials) !== null
  }
  return state.signalValidationChecks.includes('derived-reviewed')
}

function SkillSurface({
  skillId,
  state,
  dispatch,
}: {
  readonly skillId: PacGuidedSkillId
  readonly state: HemodynamicSimulationState
  readonly dispatch: (action: HemodynamicAction) => void
}) {
  if (skillId === 'pressure-system') {
    return <PacSkillsLab state={state} dispatch={dispatch} focus="pressure-system" />
  }
  if (skillId === 'catheter-advancement') {
    return <PacActionDock state={state} dispatch={dispatch} focus="advancement" />
  }
  if (skillId === 'pawp-capture') {
    return <PacActionDock state={state} dispatch={dispatch} focus="wedge" />
  }
  if (skillId === 'thermodilution-series') {
    return <PacSkillsLab state={state} dispatch={dispatch} focus="thermodilution" />
  }
  return <FormulaDrawer state={state} dispatch={dispatch} />
}

export function PacGuidedSkillActivity({
  skillId,
  locale = 'en',
}: {
  readonly skillId: PacGuidedSkillId
  readonly locale?: string
}) {
  const spec = skillSpecs[skillId]
  const activityId = `hemodynamics:learn:${skillId}`
  const activity = requireActivity(activityId)

  const router = useRouter()
  const [state, setState] = useState(() => initialSkillState(skillId))
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [predictionCorrect, setPredictionCorrect] = useState<boolean | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const attempt = useRef(1)
  const recordedSafetyEvents = useRef(new Set<string>())
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
    activityId,
    mode: 'guided',
    phase,
  })

  const dispatch = (action: HemodynamicAction) => {
    setState((current) => icuHemodynamicsReducer(current, action))
  }

  useEffect(() => {
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    attempt.current = (existing?.attempts ?? 0) + 1
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

  const referenceEntries = useMemo(
    () =>
      criticalCareReferences
        .filter((reference) =>
          (reference.relatedActivityIds as readonly string[]).includes(activityId),
        )
        .map((reference) => ({
          id: reference.id,
          title: reference.title,
          summary: reference.summary,
          meta: reference.category.replaceAll('-', ' '),
        })),
    [activityId],
  )

  const evidenceEntries = useMemo(
    () =>
      activity.evidenceIds.flatMap((sourceId) => {
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
    [activity.evidenceIds],
  )

  function persist(
    done = false,
    addHint = false,
    phaseForProgress: CriticalCareActivityPhase = phase,
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    let updated = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId,
        status: done ? 'completed' : 'in-progress',
        currentPhase: phaseForProgress,
        mode: 'guided',
        attempts: Math.max(attempt.current, existing?.attempts ?? 0),
        hintCount: (existing?.hintCount ?? 0) + (addHint ? 1 : 0),
        competencyEvidenceIds: done ? activity.competencyIds : [],
        updatedAt: now,
      },
      done
        ? undefined
        : {
            activityId,
            pathname: '/icu-hemodynamics/learn',
            query: { activity: skillId },
            mode: 'guided',
            phase: 'recognize',
            scenarioId: baseCase.id,
            checkpointId: 'authored-start',
            payloadVersion: `pac-${skillId}-v1`,
            updatedAt: now,
          },
    )
    if (done) updated = withoutCriticalCareResumePointer(updated, activityId)
    const saved = writeCriticalCareProgress(window.localStorage, updated)
    setMessage(
      saved
        ? done
          ? 'Activity completion saved on this device.'
          : 'Progress saved; this activity safely resumes from its authored setup.'
        : 'Progress could not be stored on this device.',
    )
  }

  function advance(next: CriticalCareActivityPhase) {
    setPhase(next)
    setHintVisible(false)
    persist(false, false, next)
  }

  function reset() {
    setState(initialSkillState(skillId))
    setPhase('recognize')
    setPredictionCorrect(null)
    setCompleted(false)
    setMessage('Activity reset to its authored setup.')
  }

  function showHint() {
    if (!hintVisible) {
      persist(false, true)
      lifecycleAnalytics.recordHintUsed()
    }
    setHintVisible(true)
  }

  function commitPrediction() {
    lifecycleAnalytics.recordPredictionSubmitted()
    advance('act')
  }

  function completeObjective() {
    lifecycleAnalytics.recordGoalMet()
    advance('observe')
  }

  const isObjectiveComplete = objectiveComplete(skillId, state)
  const taskControls =
    phase === 'recognize' ? (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => advance('predict')}
      >
        Orient to this skill station
      </button>
    ) : phase === 'predict' ? (
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{spec.prediction}</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm">
          <input
            type="radio"
            name="skill-prediction"
            checked={predictionCorrect === true}
            onChange={() => setPredictionCorrect(true)}
          />
          Validate the signal and technique before interpretation
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm">
          <input
            type="radio"
            name="skill-prediction"
            checked={predictionCorrect === false}
            onChange={() => setPredictionCorrect(false)}
          />
          Use the displayed value first and troubleshoot later
        </label>
        <button
          type="button"
          disabled={predictionCorrect === null}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={commitPrediction}
        >
          Commit prediction
        </button>
      </fieldset>
    ) : phase === 'act' ? (
      <button
        type="button"
        disabled={!isObjectiveComplete}
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        onClick={completeObjective}
      >
        Continue after completing the objective
      </button>
    ) : phase === 'observe' ? (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => {
          dispatch({ type: 'TICK', seconds: 5 })
          lifecycleAnalytics.recordDebriefViewed()
          advance('explain')
        }}
      >
        Observe and explain the result
      </button>
    ) : phase === 'explain' ? (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => advance('transfer')}
      >
        Open transfer check
      </button>
    ) : (
      <div className="grid gap-2">
        <button
          type="button"
          disabled={completed}
          className="min-h-11 rounded-xl border p-3 text-left text-sm disabled:opacity-50"
          onClick={() => {
            setCompleted(true)
            persist(true, false, 'transfer')
            lifecycleAnalytics.recordTransferCompleted()
            lifecycleAnalytics.recordActivityCompleted()
          }}
        >
          Carry the validation sequence into the new context
        </button>
        <button
          type="button"
          disabled={completed}
          className="min-h-11 rounded-xl border p-3 text-left text-sm disabled:opacity-50"
          onClick={() =>
            setMessage('Reconsider: a new context does not make an unvalidated signal reliable.')
          }
        >
          Skip validation because the device is already connected
        </button>
      </div>
    )

  const viewport =
    phase === 'act' ? (
      <div className="h-full overflow-auto p-3">
        <SkillSurface skillId={skillId} state={state} dispatch={dispatch} />
      </div>
    ) : phase === 'explain' ? (
      <div className="h-full overflow-auto p-4">
        <DebriefPanel
          clinicalModel={
            predictionCorrect
              ? 'Validate the signal and technique before interpretation.'
              : 'The initial prediction prioritized a displayed value before validation.'
          }
          actions={[spec.requiredAction]}
          consequences={spec.explanation}
          performanceDomains={[
            { label: 'Objective', result: isObjectiveComplete ? 'Completed' : 'Needs review' },
            { label: 'Safety sequence', result: 'Validation precedes interpretation' },
          ]}
          transfer={<p>{spec.transfer}</p>}
        />
      </div>
    ) : (
      <div className="h-full overflow-auto p-2">
        <BedsideMonitor state={state} dispatch={dispatch} onOpenCardiacOutput={showHint} />
      </div>
    )

  return (
    <SimulationLaunchGate
      activityTitle={spec.title}
      minimumViewport="desktop"
      bandwidthClass="standard"
      estimatedSizeLabel="Under 2 MB after shared application assets"
      lightweightAlternativeHref="/icu-hemodynamics/learn"
      onSaveForLater={() => {
        persist(false)
        router.push('/icu-hemodynamics/learn' as Route)
      }}
      theme="dark"
    >
      {locale !== 'en' ? (
        <p className="sr-only">Reviewed English fallback; localized clinical review is pending.</p>
      ) : null}
      <ActivityShell
        breadcrumb={
          <span>
            <Link href={'/icu-hemodynamics' as Route}>ICU Hemodynamics</Link> /{' '}
            <Link href={'/icu-hemodynamics/learn' as Route}>Learn</Link> / {spec.title}
          </span>
        }
        activityTitle={spec.title}
        phase={phase}
        mode="guided"
        progressLabel={completed ? 'Completed' : `${phaseOrder.indexOf(phase) + 1} of 6 · ${phase}`}
        patientContext={
          <PatientContextBar
            items={[
              { label: 'Setting', value: 'Adult ICU · simulated' },
              { label: 'PAC position', value: state.catheter.position.toUpperCase() },
              {
                label: 'Pressure zero',
                value: state.measurementSystem.zeroed ? 'Complete' : 'Required',
              },
              { label: 'Model time', value: `${state.timeSeconds.toFixed(1)} s` },
            ]}
            immediateGoal={spec.objective}
            safetyConstraints={[
              'Educational simulation only.',
              'Validate signals and technique before interpretation.',
            ]}
          />
        }
        viewport={viewport}
        currentTask={
          <TaskPanel
            objective={spec.objective}
            requiredAction={phase === 'transfer' ? spec.transfer : spec.requiredAction}
            targets={[spec.title]}
            hint={spec.explanation[0]}
            hintVisible={hintVisible}
            onHintRequested={showHint}
            mode="guided"
          >
            {taskControls}
          </TaskPanel>
        }
        bottomContent={
          message ??
          (skillId === 'pressure-system' &&
          phase === 'act' &&
          state.signalValidationChecks.includes('fast-flush') &&
          !state.signalValidationChecks.includes('dynamic-response-classified')
            ? 'Fast-flush trace captured; classify the release response before advancing.'
            : state.responseMessage) ??
          `Safe checkpoint · ${phase}`
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
        onSaveAndExit={() => {
          persist(false)
          router.push('/icu-hemodynamics/learn' as Route)
        }}
        theme="dark"
      />
    </SimulationLaunchGate>
  )
}
