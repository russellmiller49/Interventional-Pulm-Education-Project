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
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { Link, useRouter } from '@/i18n/navigation'

import {
  hemodynamicCaseById,
  hemodynamicsSourceById,
  pacGuidedLearningItems,
  type PacGuidedSkillId,
} from '../content'
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
import { PhysiologyPanel } from './PhysiologyPanel'
import { WaveformAtlasPanel } from './WaveformAtlasPanel'
import { WaveformRecognitionDrill } from './WaveformRecognitionDrill'

interface PacGuidedSkillSpec {
  readonly title: string
  readonly objective: string
  readonly requiredAction: string
  readonly explanation: readonly string[]
  readonly transfer: string
}

const skillSpecs: Readonly<Record<PacGuidedSkillId, PacGuidedSkillSpec>> = {
  'pressure-system': {
    title: 'Level, zero, and dynamic response',
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
    objective: 'Advance from the introducer to a confirmed pulmonary-artery waveform.',
    requiredAction: 'Advance one position at a time and confirm each pressure waveform.',
    explanation: [
      'The authored route progresses from introducer to RA, RV, and PA.',
      'Anatomic route cues support orientation, but the pressure waveform confirms each transition.',
    ],
    transfer:
      'When a position is uncertain, stop advancement and re-establish a confirmed waveform.',
  },
  'waveform-interpretation': {
    title: 'Interpret normal and abnormal waveforms',
    objective: 'Identify normal and abnormal tracings from morphology alone.',
    requiredAction:
      'Work through the recognition drill until five tracings are correctly identified.',
    explanation: [
      'Right ventricular and pulmonary artery systolic pressures are normally identical, so the systolic number cannot distinguish them. The diastolic contour can: right ventricular diastole slopes up as the ventricle fills, and pulmonary artery diastole slopes down through runoff.',
      'Wave components carry diagnoses. A blunted y descent points to pericardial constraint, a tall systolic c-v wave that erases the x descent points to tricuspid regurgitation, and a giant wedge v wave points to mitral regurgitation.',
    ],
    transfer:
      'Before acting on any invasive number, confirm which chamber the waveform says the tip is in.',
  },
  'pawp-capture': {
    title: 'Brief end-expiratory PAWP capture',
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

function actionSkillState(skillId: PacGuidedSkillId): HemodynamicSimulationState {
  let state = createInitialHemodynamicState(baseCase, 'learn', 510)
  if (skillId === 'pressure-system') {
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 })
    state = icuHemodynamicsReducer(state, { type: 'SET_DAMPING', dampingRatio: 0.28 })
    state = icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'underdamped' })
  }
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
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 8 })
    state = icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'none' })
  }
  return state
}

function addThermodilutionTrial(
  state: HemodynamicSimulationState,
  technique: HemodynamicAction & { type: 'GENERATE_THERMODILUTION_TRIAL' },
): HemodynamicSimulationState {
  return icuHemodynamicsReducer(state, technique)
}

function predictionSkillState(skillId: PacGuidedSkillId): HemodynamicSimulationState {
  let state = actionSkillState(skillId)
  if (skillId === 'catheter-advancement') {
    state = icuHemodynamicsReducer(state, { type: 'SET_CATHETER_POSITION', position: 'rv' })
  }
  if (skillId === 'thermodilution-series') {
    const validTechnique = {
      injectateVolumeMl: baseCase.thermodilution.injectateVolumeMl,
      injectateTemperatureC: baseCase.thermodilution.injectateTemperatureC,
      injectionDurationSeconds: 2.5,
      respiratoryPhase: 'end-expiration' as const,
      smoothness: 0.95,
    }
    state = addThermodilutionTrial(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: validTechnique,
    })
    state = addThermodilutionTrial(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        ...validTechnique,
        injectionDurationSeconds: 7,
        respiratoryPhase: 'variable',
        smoothness: 0.3,
      },
    })
    state = addThermodilutionTrial(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: validTechnique,
    })
  }
  return state
}

function transferSkillState(skillId: PacGuidedSkillId): HemodynamicSimulationState {
  if (skillId === 'pressure-system') {
    let state = createInitialHemodynamicState(baseCase, 'learn', 611)
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: -6 })
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    state = icuHemodynamicsReducer(state, { type: 'SET_DAMPING', dampingRatio: 1.15 })
    return icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'overdamped' })
  }
  if (skillId === 'catheter-advancement') {
    return icuHemodynamicsReducer(createInitialHemodynamicState(baseCase, 'learn', 612), {
      type: 'SET_CATHETER_POSITION',
      position: 'ra',
    })
  }
  if (skillId === 'pawp-capture') {
    const ventilatedVariant = {
      ...baseCase,
      initialParameters: {
        ...baseCase.initialParameters,
        peepCmH2O: 12,
        respiratoryRateBpm: 22,
      },
    }
    return icuHemodynamicsReducer(createInitialHemodynamicState(ventilatedVariant, 'learn', 613), {
      type: 'SET_CATHETER_POSITION',
      position: 'pa',
    })
  }
  if (skillId === 'thermodilution-series') {
    const lowFlowCase = hemodynamicCaseById.get('HD-03') ?? baseCase
    return icuHemodynamicsReducer(createInitialHemodynamicState(lowFlowCase, 'learn', 614), {
      type: 'SET_CATHETER_POSITION',
      position: 'pa',
    })
  }
  if (skillId === 'derived-hemodynamics') {
    const invalidPpvVariant = {
      ...baseCase,
      initialParameters: {
        ...baseCase.initialParameters,
        rhythmRegularity: 0.72,
        spontaneousBreathingFraction: 0.25,
      },
    }
    let state = createInitialHemodynamicState(invalidPpvVariant, 'learn', 615)
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    return icuHemodynamicsReducer(state, { type: 'SET_ARTIFACT', artifact: 'none' })
  }
  return createInitialHemodynamicState(baseCase, 'learn', 616)
}

function objectiveComplete(skillId: PacGuidedSkillId, state: HemodynamicSimulationState): boolean {
  if (skillId === 'pressure-system') {
    return (
      Math.abs(state.measurementSystem.transducerLevelCm) <= 1 &&
      state.measurementSystem.zeroed &&
      state.signalValidationChecks.includes('fast-flush') &&
      state.signalValidationChecks.includes('dynamic-response-classified') &&
      (state.measurementSystem.artifact === 'none' ||
        state.signalValidationChecks.includes('dynamic-response-corrected'))
    )
  }
  if (skillId === 'catheter-advancement') {
    return (
      state.catheter.position === 'pa' &&
      state.signalValidationChecks.includes('waveform-confirmed-ra') &&
      state.signalValidationChecks.includes('waveform-confirmed-rv') &&
      state.signalValidationChecks.includes('waveform-confirmed-pa')
    )
  }
  if (skillId === 'waveform-interpretation') {
    return state.signalValidationChecks.includes('waveform-recognition')
  }
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
    return (
      <PacSkillsLab
        state={state}
        dispatch={dispatch}
        focus="pressure-system"
        pressureChallengeMode="current-state"
      />
    )
  }
  if (skillId === 'catheter-advancement') {
    return (
      <div className="grid gap-3">
        <PhysiologyPanel state={state} dispatch={dispatch} />
        <PacActionDock state={state} dispatch={dispatch} focus="advancement" />
      </div>
    )
  }
  if (skillId === 'waveform-interpretation') {
    return (
      <>
        <WaveformRecognitionDrill dispatch={dispatch} />
        <WaveformAtlasPanel initialEntryId="ra-tamponade" heading="Full waveform atlas" />
      </>
    )
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
  const learningItems = pacGuidedLearningItems[skillId]
  const activityId = `hemodynamics:learn:${skillId}`
  const activity = requireActivity(activityId)

  const router = useRouter()
  const [state, setState] = useState(() => predictionSkillState(skillId))
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [predictionChoiceId, setPredictionChoiceId] = useState<string | null>(null)
  const [transferChoiceId, setTransferChoiceId] = useState<string | null>(null)
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
    requestedDone = false,
    addHint = false,
    phaseForProgress: CriticalCareActivityPhase = phase,
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((item) => item.activityId === activityId)
    const authoritativeStatus = authoritativeCriticalCareStatus(
      activity,
      requestedDone ? 'completed' : 'in-progress',
    )
    const done = authoritativeStatus === 'completed' || authoritativeStatus === 'mastered'
    let updated = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId,
        status: authoritativeStatus,
        currentPhase: phaseForProgress,
        mode: 'guided',
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
          : requestedDone
            ? 'Draft review saved as in progress; no completion or competency credit was awarded.'
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
    setState(predictionSkillState(skillId))
    setPhase('recognize')
    setPredictionChoiceId(null)
    setTransferChoiceId(null)
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
    const choice = learningItems.prediction.choices.find(
      (candidate) => candidate.id === predictionChoiceId,
    )
    if (!choice) return
    const correct = learningItems.prediction.correctChoiceIds.includes(choice.id)
    setMessage(
      `${correct ? 'Best interpretation.' : 'Review this interpretation.'} ${choice.rationale}`,
    )
    setState(actionSkillState(skillId))
    lifecycleAnalytics.recordPredictionSubmitted()
    advance('act')
  }

  function completeObjective() {
    lifecycleAnalytics.recordGoalMet()
    advance('observe')
  }

  function enterTransfer() {
    setState(transferSkillState(skillId))
    setTransferChoiceId(null)
    setMessage(null)
    advance('transfer')
  }

  function completeTransfer() {
    const correctChoice =
      transferChoiceId !== null &&
      learningItems.transfer.correctChoiceIds.includes(transferChoiceId)
    if (!correctChoice || !objectiveComplete(skillId, state)) {
      setMessage(
        'Complete the authored transfer interaction and select the best interpretation before finishing.',
      )
      return
    }
    setCompleted(true)
    persist(true, false, 'transfer')
    lifecycleAnalytics.recordTransferCompleted()
  }

  const isObjectiveComplete = objectiveComplete(skillId, state)
  const predictionCorrect =
    predictionChoiceId !== null &&
    learningItems.prediction.correctChoiceIds.includes(predictionChoiceId)
  const transferCorrect =
    transferChoiceId !== null && learningItems.transfer.correctChoiceIds.includes(transferChoiceId)
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
        <legend className="text-sm font-semibold">{learningItems.prediction.stem}</legend>
        {learningItems.prediction.choices.map((choice) => (
          <label
            key={choice.id}
            className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
          >
            <input
              type="radio"
              name="skill-prediction"
              checked={predictionChoiceId === choice.id}
              onChange={() => setPredictionChoiceId(choice.id)}
            />
            {choice.label}
          </label>
        ))}
        <button
          type="button"
          disabled={predictionChoiceId === null}
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
        onClick={enterTransfer}
      >
        Open transfer check
      </button>
    ) : (
      <div className="grid gap-2">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">{learningItems.transfer.stem}</legend>
          {learningItems.transfer.choices.map((choice) => (
            <label
              key={choice.id}
              className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                name="skill-transfer"
                checked={transferChoiceId === choice.id}
                onChange={() => {
                  setTransferChoiceId(choice.id)
                  setMessage(choice.rationale)
                }}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
        <p className="rounded-xl bg-muted p-3 text-xs leading-5">
          Complete the new interaction in the visual workspace; selecting an answer alone does not
          complete the activity.
        </p>
        <button
          type="button"
          disabled={completed || !transferCorrect || !isObjectiveComplete}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={completeTransfer}
        >
          Complete validated transfer
        </button>
      </div>
    )

  const viewport =
    phase === 'explain' ? (
      <div className="h-full overflow-auto p-4">
        <DebriefPanel
          clinicalModel={
            predictionCorrect
              ? learningItems.prediction.explanation
              : 'The initial interpretation needs review against the displayed signal and technique.'
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
    ) : phase === 'recognize' ? (
      <div className="h-full overflow-auto p-2">
        <BedsideMonitor state={state} dispatch={dispatch} onOpenCardiacOutput={showHint} />
      </div>
    ) : (
      <div className="grid h-full gap-3 overflow-auto p-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <BedsideMonitor state={state} dispatch={dispatch} onOpenCardiacOutput={showHint} />
        <div className="min-w-0">
          <SkillSurface
            key={`${skillId}-${phase}`}
            skillId={skillId}
            state={state}
            dispatch={dispatch}
          />
        </div>
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
        layout="guided-lab"
        breadcrumb={
          <span>
            <Link href={'/icu-hemodynamics' as Route}>ICU Hemodynamics</Link> /{' '}
            <Link href={'/icu-hemodynamics/learn' as Route}>Learn</Link> / {spec.title}
          </span>
        }
        activityTitle={spec.title}
        phase={phase}
        mode="guided"
        progressLabel={
          completed
            ? activity.completionEvidenceAuthority === 'none'
              ? 'Draft reviewed · non-credit'
              : 'Completed'
            : `${phaseOrder.indexOf(phase) + 1} of 6 · ${phase}`
        }
        patientContext={
          <PatientContextBar
            items={[
              { label: 'Setting', value: 'Adult ICU · simulated' },
              { label: 'PAC position', value: state.catheter.position.toUpperCase() },
              {
                label: 'Pressure zero',
                value: state.measurementSystem.zeroed ? 'Complete' : 'Required',
              },
              {
                label: 'Transducer level',
                value: `${state.measurementSystem.transducerLevelCm > 0 ? '+' : ''}${state.measurementSystem.transducerLevelCm.toFixed(0)} cm`,
              },
              {
                label: 'Signal artifact',
                value: state.measurementSystem.artifact.replaceAll('-', ' '),
              },
              {
                label: 'Accepted CO',
                value:
                  thermodilutionAcceptedAverage(state.thermodilutionTrials) === null
                    ? 'Not established'
                    : `${thermodilutionAcceptedAverage(state.thermodilutionTrials)?.toFixed(1)} L/min`,
              },
              {
                label: 'Variant',
                value:
                  phase === 'transfer'
                    ? 'New authored waveform or patient state'
                    : 'Primary skill state',
              },
              { label: 'Model time', value: `${state.timeSeconds.toFixed(1)} s` },
            ]}
            immediateGoal={`${spec.objective} The resulting clinical interpretation depends on completing this validation first.`}
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
