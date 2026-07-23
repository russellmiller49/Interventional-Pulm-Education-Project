'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from 'next'
import { CheckCircle2, Circle, Wind } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import {
  criticalCareActivityPhases,
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type CriticalCareActivityPhase,
  type CriticalCareResumePointer,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'

import { ventilationEvidenceById, type VentilationLessonDefinition } from '../content'

const PATHNAME = '/mechanical-ventilation/learn'
const PAYLOAD_VERSION = 'ventilation-lesson-v1'
const COMPETENCY_IDS = [
  'ventilator-setup',
  'ventilator-mechanics',
  'ventilator-waveform-interpretation',
  'ventilator-troubleshooting',
  'ventilator-safety',
] as const

interface ResumePrompt {
  readonly state: 'loading' | 'ready' | 'incompatible'
  readonly title: string
  readonly description: string
  readonly pointer?: CriticalCareResumePointer
}

function lessonActivityId(lessonId: string): string {
  return `ventilation:learn:${lessonId}`
}

function lessonCheckpoint(phase: CriticalCareActivityPhase): string {
  return `lesson-${phase}`
}

function phaseFromCheckpoint(checkpointId: string | undefined): CriticalCareActivityPhase | null {
  if (!checkpointId?.startsWith('lesson-')) return null
  const phase = checkpointId.slice('lesson-'.length)
  return criticalCareActivityPhases.includes(phase as CriticalCareActivityPhase)
    ? (phase as CriticalCareActivityPhase)
    : null
}

function BreathSequenceVisual({ phase }: { readonly phase: CriticalCareActivityPhase }) {
  const currentIndex = criticalCareActivityPhases.indexOf(phase)
  return (
    <div className="grid h-full content-center gap-6 overflow-auto p-6">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full border bg-card shadow-sm">
        <Wind className="size-9 text-primary" aria-hidden="true" />
      </div>
      <div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Stable reasoning sequence
        </p>
        <ol className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
          {criticalCareActivityPhases.map((item, index) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm capitalize"
              aria-current={item === phase ? 'step' : undefined}
            >
              {index < currentIndex ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <Circle
                  className={`size-4 shrink-0 ${index === currentIndex ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-hidden="true"
                />
              )}
              {item}
            </li>
          ))}
        </ol>
      </div>
      <p className="mx-auto max-w-2xl text-center text-sm leading-6 text-muted-foreground">
        Text equivalent: the current phase is {phase}. The sequence advances only after an explicit
        learner action.
      </p>
    </div>
  )
}

export function MechanicalVentilationLessonActivity({
  lesson,
  locale = 'en',
}: {
  readonly lesson: VentilationLessonDefinition
  readonly locale?: string
}) {
  const router = useRouter()
  const activityId = lessonActivityId(lesson.id)
  const query = useMemo(() => ({ activity: lesson.id }), [lesson.id])
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [predictionChoice, setPredictionChoice] = useState<string | null>(null)
  const [predictionCommitted, setPredictionCommitted] = useState(false)
  const [transferChoice, setTransferChoice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>({
    state: 'loading',
    title: 'Checking saved work',
    description: 'Validating the saved lesson checkpoint.',
  })
  const attemptNumber = useRef(1)
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-ventilation',
    activityId,
    mode: 'guided',
    phase,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const envelope = readCriticalCareProgress(window.localStorage)
      const existing = envelope.activities.find((activity) => activity.activityId === activityId)
      attemptNumber.current = (existing?.attempts ?? 0) + 1
      const pointer = envelope.resume
      if (!pointer || pointer.activityId !== activityId) {
        setResumePrompt(null)
        return
      }
      const restoredPhase = phaseFromCheckpoint(pointer.checkpointId)
      const compatible =
        pointer.pathname === PATHNAME &&
        pointer.query?.activity === lesson.id &&
        pointer.mode === 'guided' &&
        pointer.payloadVersion === PAYLOAD_VERSION &&
        restoredPhase === pointer.phase
      setResumePrompt(
        compatible
          ? {
              state: 'ready',
              title: `Resume ${lesson.title} at ${pointer.phase}`,
              description:
                'The authored phase checkpoint is compatible. Prior answer choices were intentionally not stored.',
              pointer,
            }
          : {
              state: 'incompatible',
              title: 'Saved lesson needs a safe restart',
              description:
                'The saved version or checkpoint no longer matches this lesson. No answer or clinical state will be guessed.',
            },
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activityId, lesson.id, lesson.title])

  const evidenceEntries = useMemo(
    () =>
      lesson.evidenceIds.flatMap((id) => {
        const evidence = ventilationEvidenceById.get(id)
        return evidence
          ? [
              {
                id: evidence.id,
                title: evidence.title,
                sourceLabel: evidence.citation,
                limitation: evidence.limitations,
              },
            ]
          : []
      }),
    [lesson.evidenceIds],
  )

  function persistCheckpoint(
    nextPhase: CriticalCareActivityPhase,
    options: { completed?: boolean; addHint?: boolean } = {},
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((activity) => activity.activityId === activityId)
    const pointer: CriticalCareResumePointer = {
      activityId,
      pathname: PATHNAME,
      query,
      mode: 'guided',
      phase: nextPhase,
      checkpointId: lessonCheckpoint(nextPhase),
      payloadVersion: PAYLOAD_VERSION,
      updatedAt: now,
    }
    let next = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId,
        status: options.completed ? 'completed' : 'in-progress',
        currentPhase: nextPhase,
        mode: 'guided',
        attempts: Math.max(attemptNumber.current, existing?.attempts ?? 0),
        hintCount: (existing?.hintCount ?? 0) + (options.addHint ? 1 : 0),
        competencyEvidenceIds: options.completed ? COMPETENCY_IDS : [],
        updatedAt: now,
      },
      options.completed ? undefined : pointer,
    )
    if (options.completed) next = withoutCriticalCareResumePointer(next, activityId)
    const stored = writeCriticalCareProgress(window.localStorage, next)
    setStorageMessage(
      stored
        ? options.completed
          ? 'Lesson completion saved on this device.'
          : 'Lesson checkpoint saved on this device.'
        : 'Progress could not be stored on this device. You can continue this session.',
    )
  }

  function advance(nextPhase: CriticalCareActivityPhase) {
    setPhase(nextPhase)
    setHintVisible(false)
    setFeedback(null)
    persistCheckpoint(nextPhase)
  }

  function resetLesson() {
    setPhase('recognize')
    setPredictionChoice(null)
    setPredictionCommitted(false)
    setTransferChoice(null)
    setFeedback(null)
    setHintVisible(false)
    setCompleted(false)
    const envelope = readCriticalCareProgress(window.localStorage)
    writeCriticalCareProgress(
      window.localStorage,
      withoutCriticalCareResumePointer(envelope, activityId),
    )
    setStorageMessage('Lesson reset to its authored starting checkpoint.')
  }

  function saveAndExit() {
    persistCheckpoint(phase)
    router.push('/mechanical-ventilation/learn' as Route)
  }

  function restore(pointer: CriticalCareResumePointer) {
    const restoredPhase = phaseFromCheckpoint(pointer.checkpointId)
    if (!restoredPhase) return
    setPhase(restoredPhase)
    setPredictionCommitted(restoredPhase !== 'recognize' && restoredPhase !== 'predict')
    setResumePrompt(null)
    setStorageMessage('Authored phase checkpoint restored. Prior choices were not retained.')
  }

  function startSafe() {
    const envelope = readCriticalCareProgress(window.localStorage)
    writeCriticalCareProgress(
      window.localStorage,
      withoutCriticalCareResumePointer(envelope, activityId),
    )
    setPhase('recognize')
    setResumePrompt(null)
  }

  function showHint() {
    if (!hintVisible) {
      persistCheckpoint(phase, { addHint: true })
      lifecycleAnalytics.recordHintUsed()
    }
    setHintVisible(true)
  }

  function commitPrediction() {
    if (!predictionChoice) return
    setPredictionCommitted(true)
    lifecycleAnalytics.recordPredictionSubmitted()
    advance('act')
    setFeedback(
      predictionChoice === lesson.prediction.correctChoiceId
        ? lesson.prediction.explanation
        : `Compare your choice with the teaching point: ${lesson.prediction.explanation}`,
    )
  }

  function completeTransfer() {
    if (!transferChoice) return
    if (transferChoice !== lesson.transfer.correctChoiceId) {
      setFeedback(`Reconsider the transfer: ${lesson.transfer.explanation}`)
      return
    }
    setFeedback(lesson.transfer.explanation)
    setCompleted(true)
    persistCheckpoint('transfer', { completed: true })
    lifecycleAnalytics.recordTransferCompleted()
    lifecycleAnalytics.recordActivityCompleted()
  }

  function applyTeachingAction() {
    lifecycleAnalytics.recordGoalMet()
    advance('observe')
  }

  let controls = null
  if (phase === 'recognize') {
    controls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => advance('predict')}
      >
        I have reviewed the signal and patient context
      </button>
    )
  } else if (phase === 'predict') {
    controls = (
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">{lesson.prediction.prompt}</legend>
        {lesson.prediction.choices.map((choice) => (
          <label
            key={choice.id}
            className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"
          >
            <input
              type="radio"
              name={`${lesson.id}-prediction`}
              checked={predictionChoice === choice.id}
              onChange={() => setPredictionChoice(choice.id)}
            />
            {choice.label}
          </label>
        ))}
        <button
          type="button"
          disabled={!predictionChoice}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={commitPrediction}
        >
          Commit prediction
        </button>
      </fieldset>
    )
  } else if (phase === 'act') {
    controls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={applyTeachingAction}
      >
        Apply the bounded teaching action
      </button>
    )
  } else if (phase === 'observe') {
    controls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => {
          lifecycleAnalytics.recordDebriefViewed()
          advance('explain')
        }}
      >
        Reassess the predicted response
      </button>
    )
  } else if (phase === 'explain') {
    controls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => advance('transfer')}
      >
        Apply the reasoning to a variant
      </button>
    )
  } else {
    controls = (
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">{lesson.transfer.prompt}</legend>
        {lesson.transfer.choices.map((choice) => (
          <label
            key={choice.id}
            className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"
          >
            <input
              type="radio"
              name={`${lesson.id}-transfer`}
              checked={transferChoice === choice.id}
              disabled={completed}
              onChange={() => setTransferChoice(choice.id)}
            />
            {choice.label}
          </label>
        ))}
        <button
          type="button"
          disabled={!transferChoice || completed}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={completeTransfer}
        >
          Complete transfer check
        </button>
      </fieldset>
    )
  }

  if (resumePrompt) {
    return (
      <main className="mx-auto grid min-h-[34rem] w-full max-w-3xl place-items-center px-4 py-10">
        <ResumeBanner
          state={resumePrompt.state}
          title={resumePrompt.title}
          description={resumePrompt.description}
          onResume={resumePrompt.pointer ? () => restore(resumePrompt.pointer!) : undefined}
          onStartSafe={startSafe}
        />
      </main>
    )
  }

  const phaseCopy = lesson.phases[phase]
  const viewport =
    phase === 'explain' ? (
      <div className="h-full overflow-auto p-4">
        <DebriefPanel
          clinicalModel={
            predictionCommitted
              ? 'A mechanism and expected response were committed before the teaching action.'
              : 'The prior prediction checkpoint was restored without retaining the answer choice.'
          }
          actions={[lesson.phases.act.requiredAction]}
          consequences={[lesson.phases.observe.teachingPoint]}
          performanceDomains={[
            { label: 'Recognition', result: lesson.phases.recognize.teachingPoint },
            { label: 'Mechanism', result: lesson.prediction.explanation },
            { label: 'Reassessment', result: lesson.phases.observe.requiredAction },
          ]}
          transfer={<p>{lesson.transfer.prompt}</p>}
        />
      </div>
    ) : (
      <BreathSequenceVisual phase={phase} />
    )

  return (
    <SimulationLaunchGate
      activityTitle={lesson.title}
      minimumViewport="tablet"
      bandwidthClass="standard"
      estimatedSizeLabel="Lightweight text and SVG lesson"
      lightweightAlternativeHref="/mechanical-ventilation/learn"
      onSaveForLater={saveAndExit}
      theme="dark"
    >
      {locale !== 'en' ? (
        <p className="sr-only">Reviewed-English fallback: localized clinical review is pending.</p>
      ) : null}
      <ActivityShell
        breadcrumb={
          <span>
            <Link href={'/mechanical-ventilation' as Route}>Mechanical Ventilation</Link> /{' '}
            <Link href={'/mechanical-ventilation/learn' as Route}>Learn</Link> / {lesson.domain}
          </span>
        }
        activityTitle={lesson.title}
        phase={phase}
        mode="guided"
        progressLabel={
          completed
            ? 'Completed'
            : `${criticalCareActivityPhases.indexOf(phase) + 1} of 6 · ${phase}`
        }
        patientContext={
          <PatientContextBar
            title="Learning context"
            items={[
              { label: 'Domain', value: lesson.domain },
              { label: 'Related cases', value: lesson.relatedCaseIds.join(' · ') },
              { label: 'Engine', value: 'Preserved deterministic model' },
            ]}
            immediateGoal={phaseCopy.objective}
            safetyConstraints={[
              'Reason from the patient and signals before changing the training console.',
              'Synthetic outputs cannot guide care for a real patient.',
            ]}
          />
        }
        viewport={viewport}
        currentTask={
          <TaskPanel
            objective={phaseCopy.objective}
            requiredAction={phaseCopy.requiredAction}
            targets={[phaseCopy.teachingPoint]}
            hint={phaseCopy.teachingPoint}
            mode="guided"
            hintVisible={hintVisible}
            onHintRequested={showHint}
          >
            {controls}
            {feedback ? (
              <p className="mt-3 rounded-xl bg-muted p-3 text-sm" role="status">
                {feedback}
              </p>
            ) : null}
          </TaskPanel>
        }
        bottomContent={storageMessage ?? `Checkpoint: ${lessonCheckpoint(phase)}`}
        secondaryActions={
          <>
            <ReferenceDrawer
              title={`${lesson.domain} reference`}
              entries={lesson.references.map((entry, index) => ({
                id: `${lesson.id}-${index}`,
                ...entry,
              }))}
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
        onSaveAndExit={saveAndExit}
        onHelp={showHint}
        onReset={resetLesson}
        theme="dark"
      />
    </SimulationLaunchGate>
  )
}
