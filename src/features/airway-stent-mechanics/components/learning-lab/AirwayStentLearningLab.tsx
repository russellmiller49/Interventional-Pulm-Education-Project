'use client'

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Users,
} from 'lucide-react'
import type { Route } from 'next'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { recordSiteModuleEvent } from '@/lib/analytics'
import { HandoffContent } from '@/i18n/handoff'

import { ArchitectureComparison } from '../clinical/ArchitectureComparison'
import { ClinicalCaseFlow } from '../clinical/ClinicalCaseFlow'
import { ClinicalCaseSummary } from '../clinical/ClinicalCaseSummary'
import { FitPlanningChecklist } from '../clinical/FitPlanningChecklist'
import { GranulationCase } from '../clinical/GranulationCase'
import { IndicationBenefitChecklist } from '../clinical/IndicationBenefitChecklist'
import { LumenBudgetLab } from '../clinical/LumenBudgetLab'
import { MechanicalJobBuilder } from '../clinical/MechanicalJobBuilder'
import { MechanismScenarioLab } from '../clinical/MechanismScenarioLab'
import { architectureRegistry } from '../../content/architectureRegistry'
import {
  clinicalAssessmentItems,
  clinicalAssessmentMasteryThreshold,
  clinicalModuleCopy,
} from '../../content/clinicalModuleCopy'
import {
  getCasesForLesson,
  getPrimaryCaseForLesson,
  getRequiredCaseIdsForLesson,
} from '../../content/clinicalCaseRegistry'
import { complicationRegistry } from '../../content/complicationRegistry'
import { stentPlanModel } from '../../content/clinicalDecisionFramework'
import {
  getMechanismScenario,
  type MechanismArchitectureFamily,
} from '../../content/mechanismScenarioRegistry'
import {
  ENGINEERING_DEEP_DIVE_ID,
  createDefaultStentProgress,
  isCaseCompleted,
  isModuleComplete,
  markCaseCompleted,
  markCaseInteractionCompleted,
  markCaseSurveillanceCommitted,
  markLessonCompleted,
  markOptionalLabCompleted,
  readStentProgress,
  recordAssessmentResult,
  recordCaseDecision,
  recordCaseObservationCommitment,
  resolveInitialLessonId,
  resolveStentLessonRequest,
  setCaseComplicationSelections,
  setCaseOutcomeState,
  setLastCase,
  setLastLesson,
  writeStentProgress,
} from '../../engine/learningLabProgress'
import {
  STENT_LESSON_IDS,
  type AssessmentItem,
  type StentClinicalCase,
  type StentLessonId,
  type StentProgressState,
} from '../../engine/learningLabTypes'
import { AssessmentPanel, type AssessmentResult } from './AssessmentPanel'
import { EngineeringDeepDive } from './EngineeringDeepDive'
import { LessonStepper, type LessonStepperItem } from './LessonStepper'
import type { LearningPrompt } from './PredictionCard'
import { SourcesPanel } from './SourcesPanel'

const MODULE_ID = 'airway-stent-mechanics'
const ACTIVE_LESSON_ANCHOR_ID = 'airway-stent-active-lesson'

const requiredCaseInteractionIds: Readonly<Record<string, readonly string[]>> = {
  'post-debulking-no-stent': ['indication-benefit'],
  'mixed-residual-extrinsic-compression': ['indication-benefit'],
  'aerodigestive-fistula-sealing': ['mechanical-job'],
  'selected-dynamic-collapse-trial': ['mechanical-job'],
  'benign-complex-stenosis-removal-horizon': ['lumen-budget'],
  'main-carinal-whole-y-fit': ['fit-plan', 'whole-y-fit-deployment'],
  'curved-mainstem-fit-failure': ['fit-plan', 'silicone-curve-involution'],
  'proximal-granulation-multifactorial': [
    'cough-interface-response',
    'complication-differential',
    'longitudinal-complication-outcomes',
  ],
}

interface AirwayStentLearningLabProps {
  requestedLessonId?: string
  requestedPanel?: string
}

type IdentifierAnalyticsPayload = Readonly<Record<string, string | readonly string[] | undefined>>

function assessmentPrompt(item: AssessmentItem): LearningPrompt {
  return {
    id: item.id,
    title: item.prompt,
    stem: item.stem,
    prompt: item.prompt,
    choices: item.choices.map((choice) => ({ ...choice })),
    correctChoiceId: item.correctChoiceId,
    explanation: item.explanation,
  }
}

function lessonStepperItems(): LessonStepperItem[] {
  return clinicalModuleCopy.lessons.map((lesson) => ({
    id: lesson.id,
    label: lesson.title,
    shortLabel: lesson.eyebrow,
  }))
}

function scrollToId(id: string) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id)
    if (typeof target?.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start' })
    }
  })
}

function isRestorableCaseComplete(
  progress: StentProgressState,
  caseData: StentClinicalCase,
): boolean {
  return Boolean(
    isCaseCompleted(progress, caseData.id) &&
    (caseData.requiredForLesson === false ||
      progress.caseProgress[caseData.id]?.surveillancePlanCommitted),
  )
}

export function AirwayStentLearningLab({
  requestedLessonId,
  requestedPanel,
}: AirwayStentLearningLabProps) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const resolvedRequest = useMemo(
    () => resolveStentLessonRequest(requestedLessonId),
    [requestedLessonId],
  )
  const requestedEngineeringPanel =
    requestedPanel === 'mechanics' || resolvedRequest?.openEngineeringDeepDive === true
  const [activeLessonId, setActiveLessonId] = useState<StentLessonId>(
    resolvedRequest?.lessonId ?? 'indication',
  )
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [progress, setProgress] = useState<StentProgressState>(createDefaultStentProgress)
  const [hydrated, setHydrated] = useState(false)
  const [assessmentAttempt, setAssessmentAttempt] = useState(1)
  const [engineeringOpen, setEngineeringOpen] = useState(requestedEngineeringPanel)

  const lessons = clinicalModuleCopy.lessons
  const stepperItems = useMemo(() => lessonStepperItems(), [])
  const activeLesson =
    lessons.find((lesson) => lesson.id === activeLessonId) ?? clinicalModuleCopy.lessons[0]
  const activeLessonIndex = lessons.findIndex((lesson) => lesson.id === activeLesson.id)
  const activeCases = getCasesForLesson(activeLesson.id)
  const activeRequiredCaseIds = getRequiredCaseIdsForLesson(activeLesson.id)
  const activeRequiredCasesCompleted = activeCases.filter(
    (caseData) =>
      caseData.requiredForLesson !== false && isRestorableCaseComplete(progress, caseData),
  ).length
  const selectedCase =
    activeCases.find((caseData) => caseData.id === activeCaseId) ??
    getPrimaryCaseForLesson(activeLesson.id)
  const selectedCaseIsComplete = selectedCase
    ? isRestorableCaseComplete(progress, selectedCase)
    : false
  const selectedCaseProgress = selectedCase ? progress.caseProgress[selectedCase.id] : undefined
  const selectedCompletedInteractionIds = selectedCaseProgress?.completedInteractionIds ?? []
  const selectedCaseRequiresSurveillance = selectedCase?.requiredForLesson !== false
  const selectedRequiredInteractionIds = selectedCase
    ? [
        ...new Set([
          ...(requiredCaseInteractionIds[selectedCase.id] ?? []),
          ...(selectedCaseRequiresSurveillance ? ['surveillance-plan'] : []),
        ]),
      ]
    : []
  const previousLesson = activeLessonIndex > 0 ? lessons[activeLessonIndex - 1] : null
  const nextLesson = activeLessonIndex < lessons.length - 1 ? lessons[activeLessonIndex + 1] : null

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedProgress = readStentProgress()
      const lessonId = resolveInitialLessonId(requestedLessonId, storedProgress)
      const savedCaseId =
        storedProgress.lastLessonId === lessonId &&
        getCasesForLesson(lessonId).some((caseData) => caseData.id === storedProgress.lastCaseId)
          ? storedProgress.lastCaseId
          : null
      const initialCaseId =
        lessonId === 'assessment'
          ? null
          : (savedCaseId ?? getPrimaryCaseForLesson(lessonId)?.id ?? null)
      const nextProgress = setLastCase(setLastLesson(storedProgress, lessonId), initialCaseId)
      setProgress(nextProgress)
      setActiveLessonId(lessonId)
      setActiveCaseId(initialCaseId)
      setAssessmentAttempt(nextProgress.assessment.attempts + 1)
      if (requestedEngineeringPanel) setEngineeringOpen(true)
      writeStentProgress(nextProgress)
      setHydrated(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [requestedEngineeringPanel, requestedLessonId])

  const recordInteraction = useCallback(
    (interaction: string, eventPayload: IdentifierAnalyticsPayload = {}) => {
      recordSiteModuleEvent({
        eventType: 'module_opened',
        moduleId: MODULE_ID,
        section: activeLessonId,
        eventPayload: { interaction, ...eventPayload },
      })
    },
    [activeLessonId],
  )

  const handleCaseStarted = useCallback(
    (caseId: string) => {
      recordInteraction('clinical_case_started', { caseId })
    },
    [recordInteraction],
  )

  const handleDecisionCommitted = useCallback(
    ({
      caseId,
      choiceId,
      decisionId,
      initial,
      revised,
    }: {
      caseId: string
      choiceId: string
      decisionId: string
      initial: boolean
      revised: boolean
    }) => {
      setProgress((current) => {
        const next = recordCaseDecision(current, caseId, decisionId, revised)
        writeStentProgress(next)
        return next
      })
      recordInteraction(
        revised
          ? 'decision_revised'
          : initial
            ? 'initial_decision_committed'
            : 'clinical_decision_committed',
        {
          caseId,
          choiceId,
          decisionId,
        },
      )
    },
    [recordInteraction],
  )

  const handlePhysicsLensOpen = useCallback(
    (caseId: string) => {
      recordInteraction('physics_lens_opened', { caseId })
    },
    [recordInteraction],
  )

  const evidenceIds = (() => {
    const ids = new Set<string>(activeLesson.evidenceRefs)
    for (const caseData of activeCases) {
      caseData.evidenceRefs.forEach((id) => ids.add(id))
      caseData.decisions.forEach((decision) => decision.evidenceRefs.forEach((id) => ids.add(id)))
      caseData.physicsLens?.evidenceRefs.forEach((id) => ids.add(id))
    }
    if (activeLesson.id === 'architecture-choice') {
      architectureRegistry.forEach((profile) => profile.evidenceRefs.forEach((id) => ids.add(id)))
    }
    if (activeLesson.id === 'complications-surveillance') {
      complicationRegistry.forEach((pathway) => pathway.evidenceRefs.forEach((id) => ids.add(id)))
    }
    if (activeLesson.id === 'assessment') {
      clinicalAssessmentItems.forEach((item) => item.evidenceRefs.forEach((id) => ids.add(id)))
    }
    return [...ids]
  })()

  function updateLessonUrl(lessonId: StentLessonId) {
    const search = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    search.set('lesson', lessonId)
    search.delete('panel')
    router.push(`${pathname}?${search.toString()}` as Route, { scroll: false })
  }

  function openLesson(lessonId: StentLessonId) {
    const primaryCaseId =
      lessonId === 'assessment' ? null : (getPrimaryCaseForLesson(lessonId)?.id ?? null)
    setActiveLessonId(lessonId)
    setActiveCaseId(primaryCaseId)
    const nextProgress = setLastCase(setLastLesson(progress, lessonId), primaryCaseId)
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    updateLessonUrl(lessonId)
    scrollToId(ACTIVE_LESSON_ANCHOR_ID)
  }

  function selectCase(caseId: string) {
    setActiveCaseId(caseId)
    setProgress((current) => {
      const next = setLastCase(setLastLesson(current, activeLesson.id), caseId)
      writeStentProgress(next)
      return next
    })
  }

  function sendModuleCompletedIfReady(
    previousProgress: StentProgressState,
    nextProgress: StentProgressState,
  ) {
    if (isModuleComplete(previousProgress) || !isModuleComplete(nextProgress)) return
    recordSiteModuleEvent({
      eventType: 'module_completed',
      moduleId: MODULE_ID,
      eventPayload: {
        interaction: 'module_completed',
        completionId: 'module-mastery-complete',
      },
    })
  }

  function completeCaseInteraction(caseId: string, interactionId: string) {
    setProgress((current) => {
      const next = markCaseInteractionCompleted(current, caseId, interactionId)
      writeStentProgress(next)
      return next
    })
    recordInteraction('required_interaction_completed', { caseId, interactionId })
  }

  function completeComplicationDifferential(caseId: string, selectedIds: readonly string[]) {
    setProgress((current) => {
      const withSelections = setCaseComplicationSelections(current, caseId, selectedIds)
      const next = markCaseInteractionCompleted(withSelections, caseId, 'complication-differential')
      writeStentProgress(next)
      return next
    })
    recordInteraction('complication_differential_completed', {
      caseId,
      complicationSelectionIds: selectedIds,
    })
  }

  function commitCaseSurveillance(caseId: string) {
    setProgress((current) => {
      const withInteraction = markCaseInteractionCompleted(current, caseId, 'surveillance-plan')
      const next = markCaseSurveillanceCommitted(withInteraction, caseId)
      writeStentProgress(next)
      return next
    })
    recordInteraction('surveillance_plan_completed', { caseId })
  }

  function recordMechanismPrediction({
    architectureFamily,
    predictionId,
    scenarioId,
  }: {
    architectureFamily: MechanismArchitectureFamily
    predictionId: string
    scenarioId: string
  }) {
    recordInteraction('mechanism_prediction_committed', {
      architectureFamily,
      predictionId,
      scenarioId,
      caseId: selectedCase?.id,
    })
  }

  function recordMechanismObservation({
    observationId,
    scenarioId,
  }: {
    observationId: string
    scenarioId: string
  }) {
    if (!selectedCase) return
    setProgress((current) => {
      const next = recordCaseObservationCommitment(
        current,
        selectedCase.id,
        `${scenarioId}:${observationId}`,
      )
      writeStentProgress(next)
      return next
    })
    recordInteraction('mechanism_observation_committed', {
      caseId: selectedCase.id,
      observationId,
      scenarioId,
    })
  }

  function completeMechanismArchitecture(
    caseId: string,
    {
      architectureFamily,
      consequenceId,
      scenarioId,
    }: {
      architectureFamily: MechanismArchitectureFamily
      consequenceId: string
      scenarioId: string
    },
  ) {
    const outcomeStateId = `${scenarioId}:${architectureFamily}:${consequenceId}`
    setProgress((current) => {
      const next = setCaseOutcomeState(current, caseId, outcomeStateId)
      writeStentProgress(next)
      return next
    })
    recordInteraction('mechanism_architecture_completed', {
      architectureFamily,
      caseId,
      consequenceId,
      outcomeStateId,
      scenarioId,
    })
  }

  function completeMechanismScenario(caseId: string, { scenarioId }: { scenarioId: string }) {
    setProgress((current) => {
      const next = markCaseInteractionCompleted(current, caseId, scenarioId)
      writeStentProgress(next)
      return next
    })
    recordInteraction('mechanism_scenario_completed', {
      caseId,
      completionId: `${scenarioId}-complete`,
      scenarioId,
    })
  }

  function completeCase(lessonId: StentLessonId, caseId: string) {
    const caseData = getCasesForLesson(lessonId).find((candidate) => candidate.id === caseId)
    if (
      caseData?.requiredForLesson !== false &&
      progress.caseProgress[caseId]?.surveillancePlanCommitted !== true
    ) {
      return
    }

    const lessonWasComplete = progress.completedLessonIds.includes(lessonId)
    const caseProgress = markCaseCompleted(progress, caseId)
    const requiredCaseIds = getRequiredCaseIdsForLesson(lessonId)
    const lessonNowComplete = requiredCaseIds.every((requiredCaseId) =>
      Boolean(
        isCaseCompleted(caseProgress, requiredCaseId) &&
        caseProgress.caseProgress[requiredCaseId]?.surveillancePlanCommitted,
      ),
    )
    const nextProgress = lessonNowComplete
      ? markLessonCompleted(caseProgress, lessonId)
      : caseProgress
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    if (lessonNowComplete && !lessonWasComplete) {
      recordSiteModuleEvent({
        eventType: 'section_completed',
        moduleId: MODULE_ID,
        section: lessonId,
        eventPayload: {
          caseId,
          interaction: 'required_cases_completed',
          completionId: `${lessonId}-required-cases-complete`,
          requiredCaseIds,
        },
      })
    } else {
      recordInteraction('clinical_case_completed', {
        caseId,
        completionId: 'clinical-case-complete',
      })
    }
    sendModuleCompletedIfReady(progress, nextProgress)
  }

  function completeAssessment(result: AssessmentResult) {
    const nextProgress = recordAssessmentResult(
      progress,
      result.score,
      result.total,
      clinicalAssessmentMasteryThreshold,
    )
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    recordSiteModuleEvent({
      eventType: 'quiz_submitted',
      moduleId: MODULE_ID,
      eventPayload: {
        interaction: 'assessment_submitted',
        assessmentId: 'integrated-airway-stent-assessment',
        attemptId: `assessment-attempt-${result.attempt}`,
        completionId: result.mastery ? 'mastery-achieved' : 'mastery-not-achieved',
      },
    })
    sendModuleCompletedIfReady(progress, nextProgress)
  }

  function completeOptionalEngineeringLab() {
    if (progress.completedOptionalLabIds.includes(ENGINEERING_DEEP_DIVE_ID)) return
    const nextProgress = markOptionalLabCompleted(progress, ENGINEERING_DEEP_DIVE_ID)
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    recordSiteModuleEvent({
      eventType: 'section_completed',
      moduleId: MODULE_ID,
      section: ENGINEERING_DEEP_DIVE_ID,
      eventPayload: {
        interaction: 'optional_engineering_deep_dive_completed',
        completionId: 'engineering-deep-dive-complete',
      },
    })
  }

  function openEngineeringDeepDive() {
    setEngineeringOpen(true)
    recordInteraction('engineering_deep_dive_opened')
    scrollToId('airway-stent-engineering-deep-dive')
  }

  return (
    <HandoffContent>
      <div className="pb-20 pt-8 md:pt-12">
        <div className="container space-y-8">
          <header className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 px-6 py-9 text-white shadow-2xl sm:px-8 md:py-12 lg:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_82%_72%,rgba(99,102,241,0.16),transparent_32%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                    Clinical decision lab
                  </span>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-slate-200">
                    {clinicalModuleCopy.clinicalReviewStatus === 'reviewed'
                      ? 'Clinically reviewed'
                      : 'Draft · clinical review required'}
                  </span>
                  {locale !== 'en' ? (
                    <span
                      className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100"
                      data-no-handoff-translate
                    >
                      {clinicalModuleCopy.clinicalReviewStatus === 'reviewed'
                        ? 'Reviewed English fallback · translation review pending'
                        : 'English clinical draft fallback · translation review pending'}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Airway Stent <span className="text-cyan-300">Clinical Decision Lab</span>
                  <span className="mt-3 block text-xl font-semibold leading-tight text-slate-200 sm:text-2xl lg:text-3xl">
                    Indication, Architecture, Fit &amp; Complications
                  </span>
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
                  {clinicalModuleCopy.subtitle}
                </p>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-cyan-300" aria-hidden />~
                    {clinicalModuleCopy.estimatedMinutes} minutes
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-300" aria-hidden />
                    Fellows, bronchoscopists, and residents
                  </span>
                  <a
                    href="#stent-evidence"
                    className="inline-flex items-center gap-2 font-semibold text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden />
                    Evidence and limitations
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-300/35 bg-cyan-300/10 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  Opening patient
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Is a stent still needed?</h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  A purely intrinsic malignant obstruction has been debulked. The residual airway is
                  patent and the wall appears stable. Decide whether a structural job remains before
                  choosing any architecture.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    openLesson('indication')
                    scrollToId(ACTIVE_LESSON_ANCHOR_ID)
                  }}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 motion-reduce:transition-none"
                >
                  Start a clinical case
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={openEngineeringDeepDive}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-xs font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                >
                  <FlaskConical className="h-4 w-4" aria-hidden />
                  Advanced mechanics: inspect the engineering model
                </button>
              </div>
            </div>
          </header>

          <section
            className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
            aria-labelledby="stent-plan-model-title"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
              Clinical model
            </p>
            <h2 id="stent-plan-model-title" className="mt-2 text-2xl font-bold">
              A stent plan is more than a material choice
            </h2>
            <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              {stentPlanModel.map((part, index) => (
                <li key={part} className="rounded-xl border bg-muted/20 p-3 text-sm">
                  <span className="block text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                    {index + 1}
                  </span>
                  <span className="mt-1 block font-semibold">{part}</span>
                </li>
              ))}
            </ol>
          </section>

          <LessonStepper
            activeLessonId={activeLesson.id}
            completedLessonIds={progress.completedLessonIds}
            lessons={stepperItems}
            onSelect={openLesson}
          />

          {!hydrated ? (
            <p className="text-center text-xs text-muted-foreground" role="status">
              Restoring saved clinical progress…
            </p>
          ) : null}

          <section id={ACTIVE_LESSON_ANCHOR_ID} className="scroll-mt-24 space-y-6">
            <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                    Lesson {activeLesson.step} · {activeLesson.eyebrow}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                    {activeLesson.title}
                  </h2>
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {activeLesson.summary}
                  </p>
                </div>
                {progress.completedLessonIds.includes(activeLesson.id) ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Lesson completed
                  </span>
                ) : null}
              </div>
              <ul className="mt-5 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-3">
                {activeLesson.objectives.map((objective) => (
                  <li key={objective} className="rounded-xl border bg-muted/25 p-3">
                    {objective}
                  </li>
                ))}
              </ul>
            </div>

            {activeLesson.id !== 'assessment' && selectedCase ? (
              <>
                {activeCases.length > 1 ? (
                  <section
                    className="rounded-3xl border bg-muted/10 p-4"
                    aria-label="Cases in this lesson"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <p>Choose a case</p>
                      <p>
                        {activeRequiredCasesCompleted} of {activeRequiredCaseIds.length} required
                        cases complete
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {activeCases.map((caseData) => (
                        <ClinicalCaseSummary
                          key={caseData.id}
                          active={caseData.id === selectedCase.id}
                          caseData={caseData}
                          completed={isRestorableCaseComplete(progress, caseData)}
                          onSelect={() => selectCase(caseData.id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <ClinicalCaseFlow
                  key={`${selectedCase.id}:${selectedCaseIsComplete ? 'completed' : 'active'}`}
                  caseData={selectedCase}
                  completedInteractionIds={selectedCompletedInteractionIds}
                  initiallyCompleted={selectedCaseIsComplete}
                  onCaseStarted={handleCaseStarted}
                  onComplete={(caseId) => completeCase(activeLesson.id, caseId)}
                  onDecisionCommitted={handleDecisionCommitted}
                  onPhysicsLensOpen={handlePhysicsLensOpen}
                  onSurveillancePlanCompleted={() => commitCaseSurveillance(selectedCase.id)}
                  requiredInteractionIds={selectedRequiredInteractionIds}
                  surveillancePlanCompleted={
                    selectedCaseProgress?.surveillancePlanCommitted === true
                  }
                >
                  {activeLesson.id === 'indication' ? (
                    <IndicationBenefitChecklist
                      completed={selectedCompletedInteractionIds.includes('indication-benefit')}
                      onComplete={() =>
                        completeCaseInteraction(selectedCase.id, 'indication-benefit')
                      }
                    />
                  ) : null}
                  {activeLesson.id === 'clinical-job' ? (
                    <MechanicalJobBuilder
                      completed={selectedCompletedInteractionIds.includes('mechanical-job')}
                      onComplete={() => completeCaseInteraction(selectedCase.id, 'mechanical-job')}
                    />
                  ) : null}
                  {activeLesson.id === 'architecture-choice' ? (
                    <>
                      <ArchitectureComparison />
                      <LumenBudgetLab
                        completed={selectedCompletedInteractionIds.includes('lumen-budget')}
                        onComplete={() => completeCaseInteraction(selectedCase.id, 'lumen-budget')}
                      />
                    </>
                  ) : null}
                  {activeLesson.id === 'fit-behavior' ? (
                    <>
                      <FitPlanningChecklist
                        completed={selectedCompletedInteractionIds.includes('fit-plan')}
                        onComplete={() => completeCaseInteraction(selectedCase.id, 'fit-plan')}
                      />
                      <MechanismScenarioLab
                        scenario={getMechanismScenario(
                          selectedCase.id === 'main-carinal-whole-y-fit'
                            ? 'whole-y-fit-deployment'
                            : 'silicone-curve-involution',
                        )}
                        onArchitectureCompleted={(details) =>
                          completeMechanismArchitecture(selectedCase.id, details)
                        }
                        onPredictionCommitted={recordMechanismPrediction}
                        onObservationCommitted={recordMechanismObservation}
                        onCompleted={(details) =>
                          completeMechanismScenario(selectedCase.id, details)
                        }
                      />
                    </>
                  ) : null}
                  {activeLesson.id === 'complications-surveillance' ? (
                    <>
                      <MechanismScenarioLab
                        scenario={getMechanismScenario('cough-interface-response')}
                        onArchitectureCompleted={(details) =>
                          completeMechanismArchitecture(selectedCase.id, details)
                        }
                        onPredictionCommitted={recordMechanismPrediction}
                        onObservationCommitted={recordMechanismObservation}
                        onCompleted={(details) =>
                          completeMechanismScenario(selectedCase.id, details)
                        }
                      />
                      <MechanismScenarioLab
                        scenario={getMechanismScenario('longitudinal-complication-outcomes')}
                        onArchitectureCompleted={(details) =>
                          completeMechanismArchitecture(selectedCase.id, details)
                        }
                        onPredictionCommitted={recordMechanismPrediction}
                        onObservationCommitted={recordMechanismObservation}
                        onCompleted={(details) =>
                          completeMechanismScenario(selectedCase.id, details)
                        }
                      />
                      <GranulationCase
                        complicationSelectionIds={
                          selectedCaseProgress?.complicationSelectionIds ?? []
                        }
                        differentialCompleted={selectedCompletedInteractionIds.includes(
                          'complication-differential',
                        )}
                        onDifferentialCompleted={(selectedIds) =>
                          completeComplicationDifferential(selectedCase.id, selectedIds)
                        }
                      />
                    </>
                  ) : null}
                </ClinicalCaseFlow>
              </>
            ) : (
              <AssessmentPanel
                key={`assessment-attempt-${assessmentAttempt}`}
                attempt={assessmentAttempt}
                items={clinicalAssessmentItems.map(assessmentPrompt)}
                masteryThreshold={clinicalAssessmentMasteryThreshold}
                onComplete={completeAssessment}
                onRetry={() => setAssessmentAttempt((current) => current + 1)}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
              <button
                type="button"
                disabled={!previousLesson}
                onClick={() => previousLesson && openLesson(previousLesson.id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {previousLesson ? previousLesson.eyebrow : 'First lesson'}
              </button>
              <span className="text-xs text-muted-foreground">
                {progress.completedLessonIds.length} of {STENT_LESSON_IDS.length} required lessons
                complete
              </span>
              <button
                type="button"
                disabled={!nextLesson}
                onClick={() => nextLesson && openLesson(nextLesson.id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nextLesson ? nextLesson.eyebrow : 'Course complete'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </section>

          <EngineeringDeepDive
            open={engineeringOpen}
            onOpenChange={setEngineeringOpen}
            onOpen={() => recordInteraction('engineering_deep_dive_opened')}
            onOptionalCompletion={completeOptionalEngineeringLab}
          />

          <div id="stent-evidence" className="scroll-mt-24">
            <SourcesPanel
              disclaimer={clinicalModuleCopy.disclaimer}
              evidenceIds={evidenceIds}
              limitations={clinicalModuleCopy.evidenceLimitations}
            />
          </div>
        </div>
      </div>
    </HandoffContent>
  )
}
