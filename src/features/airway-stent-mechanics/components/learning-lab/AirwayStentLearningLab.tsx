'use client'

import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Users } from 'lucide-react'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { recordSiteModuleEvent } from '@/lib/analytics'

import {
  assessmentMasteryThreshold,
  forceTaxonomy,
  forceLabMissions,
  ginaDumonBenchData,
  guidedForceScenes,
  obstructionMorphologies,
  stentModuleCopy,
  tissueMechanisms,
} from '../../content/learningLabCopy'
import {
  createDefaultStentProgress,
  isModuleComplete,
  markLessonCompleted,
  readStentProgress,
  recordAssessmentResult,
  resolveInitialLessonId,
  setLastLesson,
  writeStentProgress,
} from '../../engine/learningLabProgress'
import {
  STENT_LESSON_IDS,
  isStentLessonId,
  type AssessmentItem,
  type CheckpointPrompt,
  type InstructionalLessonCopy,
  type PredictionPrompt,
  type StentLessonCopy,
  type StentLessonId,
  type StentLabExperienceProgress,
  type StentProgressState,
} from '../../engine/learningLabTypes'
import { AssessmentPanel, type AssessmentResult } from './AssessmentPanel'
import {
  EvidenceDecisionLab,
  LearningSections,
  ObstructionMorphologyGrid,
  TissueMechanismMap,
} from './LessonContent'
import { LessonStepper, type LessonStepperItem } from './LessonStepper'
import { PredictionCard, type LearningPrompt } from './PredictionCard'
import { SourcesPanel } from './SourcesPanel'
import { StentArchitectureLabDynamic } from './StentArchitectureLabDynamic'

const MODULE_ID = 'airway-stent-mechanics'
const GUIDED_FORCE_LAB_ANCHOR_ID = 'airway-stent-guided-force-lab'

function emptyExperienceProgress(): StentLabExperienceProgress {
  return { completedIds: [], complete: false }
}

interface AirwayStentLearningLabProps {
  requestedLessonId?: string
}

function predictionPrompt(prompt: PredictionPrompt): LearningPrompt {
  return {
    id: prompt.id,
    title: 'Make the first call',
    prompt: prompt.prompt,
    choices: prompt.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      rationale:
        choice.rationale ??
        (choice.id === prompt.correctChoiceId
          ? prompt.reveal
          : `This option misses the controlling relationship. ${prompt.reveal}`),
    })),
    correctChoiceId: prompt.correctChoiceId,
    explanation: prompt.reveal,
  }
}

function checkpointPrompt(prompt: CheckpointPrompt): LearningPrompt {
  return {
    id: prompt.id,
    title: 'Lesson checkpoint',
    prompt: prompt.prompt,
    choices: prompt.choices.map((choice) => ({ ...choice })),
    correctChoiceId: prompt.correctChoiceId,
    explanation: prompt.explanation,
  }
}

function assessmentPrompt(item: AssessmentItem): LearningPrompt {
  return {
    id: item.id,
    title: 'Decision case',
    stem: item.stem,
    prompt: item.prompt,
    choices: item.choices.map((choice) => ({ ...choice })),
    correctChoiceId: item.correctChoiceId,
    explanation: item.explanation,
  }
}

function collectLessonEvidence(lesson: StentLessonCopy): string[] {
  const evidenceIds = new Set<string>()
  for (const section of lesson.sections) {
    section.evidenceRefs?.forEach((id) => evidenceIds.add(id))
    section.cards?.forEach((card) => card.evidenceRefs?.forEach((id) => evidenceIds.add(id)))
  }

  if (lesson.kind === 'instructional') {
    lesson.prediction.evidenceRefs.forEach((id) => evidenceIds.add(id))
    lesson.checkpoint.evidenceRefs.forEach((id) => evidenceIds.add(id))
  } else {
    lesson.items.forEach((item) => item.evidenceRefs.forEach((id) => evidenceIds.add(id)))
  }

  if (lesson.id === 'orient') {
    obstructionMorphologies.forEach((item) =>
      item.evidenceRefs.forEach((id) => evidenceIds.add(id)),
    )
    guidedForceScenes.forEach((scene) => scene.evidenceRefs.forEach((id) => evidenceIds.add(id)))
  }
  if (lesson.id === 'force-lab') {
    forceLabMissions.forEach((mission) => mission.evidenceRefs.forEach((id) => evidenceIds.add(id)))
  }
  if (lesson.id === 'tissue-time') {
    tissueMechanisms.forEach((item) => item.evidenceRefs.forEach((id) => evidenceIds.add(id)))
  }
  if (lesson.id === 'evidence-decisions') {
    forceTaxonomy.forEach((item) => item.evidenceRefs.forEach((id) => evidenceIds.add(id)))
    ginaDumonBenchData.forEach((item) => item.evidenceRefs.forEach((id) => evidenceIds.add(id)))
  }

  return [...evidenceIds]
}

function lessonStepperItems(): LessonStepperItem[] {
  return stentModuleCopy.lessons.map((lesson) => ({
    id: lesson.id,
    label: lesson.title,
    shortLabel: lesson.eyebrow,
  }))
}

function filteredSections(lesson: StentLessonCopy) {
  if (lesson.id === 'orient') {
    return lesson.sections.filter((section) => section.id !== 'orient-morphology')
  }
  if (lesson.id === 'tissue-time') {
    return lesson.sections.filter((section) => section.id !== 'tissue-pathways')
  }
  return lesson.sections
}

export function AirwayStentLearningLab({ requestedLessonId }: AirwayStentLearningLabProps) {
  const router = useRouter()
  const pathname = usePathname()
  const explicitInitialLesson = isStentLessonId(requestedLessonId) ? requestedLessonId : null
  const [activeLessonId, setActiveLessonId] = useState<StentLessonId>(
    explicitInitialLesson ?? 'orient',
  )
  const [progress, setProgress] = useState<StentProgressState>(createDefaultStentProgress)
  const [hydrated, setHydrated] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [committedPromptIds, setCommittedPromptIds] = useState<string[]>([])
  const [assessmentAttempt, setAssessmentAttempt] = useState(1)
  const [guidedForceProgress, setGuidedForceProgress] =
    useState<StentLabExperienceProgress>(emptyExperienceProgress)
  const [forcePracticeProgress, setForcePracticeProgress] =
    useState<StentLabExperienceProgress>(emptyExperienceProgress)

  const lessons = stentModuleCopy.lessons
  const stepperItems = useMemo(() => lessonStepperItems(), [])
  const activeLesson =
    lessons.find((lesson) => lesson.id === activeLessonId) ?? stentModuleCopy.lessons[0]
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLesson.id)
  const completedPromptIds = new Set(committedPromptIds)
  const evidenceIds = useMemo(() => collectLessonEvidence(activeLesson), [activeLesson])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedProgress = readStentProgress()
      const lessonId = resolveInitialLessonId(explicitInitialLesson, storedProgress)
      const nextProgress = setLastLesson(storedProgress, lessonId)
      setProgress(nextProgress)
      setActiveLessonId(lessonId)
      setAssessmentAttempt(nextProgress.assessment.attempts + 1)
      writeStentProgress(nextProgress)
      setHydrated(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [explicitInitialLesson])

  function updateLessonUrl(lessonId: StentLessonId, replace = false) {
    const search = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    search.set('lesson', lessonId)
    const href = `${pathname}?${search.toString()}`
    if (replace) router.replace(href as Route, { scroll: false })
    else router.push(href as Route, { scroll: false })
  }

  function openLesson(lessonId: StentLessonId, scrollTargetId = 'airway-stent-active-lesson') {
    setActiveLessonId(lessonId)
    const nextProgress = setLastLesson(progress, lessonId)
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    updateLessonUrl(lessonId)
    requestAnimationFrame(() => {
      const target = document.getElementById(scrollTargetId)
      if (typeof target?.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start' })
      }
    })
  }

  const updateGuidedForceProgress = useCallback((next: StentLabExperienceProgress) => {
    setGuidedForceProgress((current) => {
      const completedIds = [...new Set([...current.completedIds, ...next.completedIds])]
      const complete = current.complete || next.complete
      if (
        complete === current.complete &&
        completedIds.length === current.completedIds.length &&
        completedIds.every((id, index) => id === current.completedIds[index])
      ) {
        return current
      }
      return { completedIds, complete }
    })
  }, [])

  const updateForcePracticeProgress = useCallback((next: StentLabExperienceProgress) => {
    setForcePracticeProgress((current) => {
      const completedIds = [...new Set([...current.completedIds, ...next.completedIds])]
      const complete = current.complete || next.complete
      if (
        complete === current.complete &&
        completedIds.length === current.completedIds.length &&
        completedIds.every((id, index) => id === current.completedIds[index])
      ) {
        return current
      }
      return { completedIds, complete }
    })
  }, [])

  function sendModuleCompletedIfReady(nextProgress: StentProgressState) {
    if (!isModuleComplete(nextProgress)) return
    recordSiteModuleEvent({
      eventType: 'module_completed',
      moduleId: MODULE_ID,
      percentComplete: 100,
      eventPayload: {
        mastery: nextProgress.assessment.mastery,
        bestScore: nextProgress.assessment.bestScore,
        attempts: nextProgress.assessment.attempts,
      },
    })
  }

  function completeLesson(lessonId: StentLessonId, eventPayload?: Record<string, unknown>) {
    if (progress.completedLessonIds.includes(lessonId)) return
    const nextProgress = markLessonCompleted(progress, lessonId)
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    recordSiteModuleEvent({
      eventType: 'section_completed',
      moduleId: MODULE_ID,
      section: lessonId,
      percentComplete: Math.round(
        (nextProgress.completedLessonIds.length / STENT_LESSON_IDS.length) * 100,
      ),
      ...(eventPayload ? { eventPayload } : {}),
    })
    sendModuleCompletedIfReady(nextProgress)
  }

  function commitInstructionalPrompt(promptId: string, lesson?: InstructionalLessonCopy) {
    if (!selectedAnswers[promptId]) return
    const isCheckpoint = lesson && promptId === lesson.checkpoint.id
    if (isCheckpoint && lesson.id === 'orient' && !guidedForceProgress.complete) return
    if (isCheckpoint && lesson.id === 'force-lab' && !forcePracticeProgress.complete) return

    setCommittedPromptIds((current) =>
      current.includes(promptId) ? current : [...current, promptId],
    )
    if (!isCheckpoint) return

    if (lesson.id === 'orient') {
      completeLesson(lesson.id, {
        experience: 'guided-force',
        completedSceneCount: guidedForceProgress.completedIds.length,
      })
      return
    }

    if (lesson.id === 'force-lab') {
      completeLesson(lesson.id, {
        experience: 'force-practice',
        completedMissionCount: forcePracticeProgress.completedIds.length,
      })
      return
    }

    completeLesson(lesson.id)
  }

  function completeAssessment(result: AssessmentResult) {
    const nextProgress = recordAssessmentResult(progress, result.score, result.total)
    setProgress(nextProgress)
    writeStentProgress(nextProgress)
    recordSiteModuleEvent({
      eventType: 'quiz_submitted',
      moduleId: MODULE_ID,
      percentComplete: Math.round(
        (nextProgress.completedLessonIds.length / STENT_LESSON_IDS.length) * 100,
      ),
      eventPayload: {
        score: result.score,
        total: result.total,
        attempt: result.attempt,
        mastery: result.mastery,
      },
    })
    sendModuleCompletedIfReady(nextProgress)
  }

  const previousLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null
  const nextLesson = activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null

  return (
    <div className="pb-20 pt-8 md:pt-12">
      <div className="container space-y-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 px-6 py-9 text-white shadow-2xl sm:px-8 md:py-12 lg:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_82%_72%,rgba(244,63,94,0.12),transparent_32%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end">
            <div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                  Guided clinician learning lab
                </span>
                <span className="rounded-full border border-white/20 px-3 py-1 text-slate-200">
                  Draft · English clinical review
                </span>
              </div>
              <h1
                aria-label={stentModuleCopy.title}
                className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
              >
                Airway Stent <span className="text-cyan-300">Learning Lab</span>
                <span className="mt-3 block text-xl font-semibold leading-tight text-slate-200 sm:text-2xl lg:text-3xl">
                  Architecture, Mechanics &amp; Clinical Tradeoffs
                </span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
                Architecture, mechanics, tissue interaction, and clinical tradeoffs—organized around
                the problem the stent must solve rather than a material or product shortcut.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-cyan-300" aria-hidden />~
                  {stentModuleCopy.estimatedMinutes} minutes
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
            <div className="overflow-hidden rounded-3xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur">
              <div className="relative h-40 overflow-hidden border-b border-white/10 bg-slate-950/70">
                <svg
                  aria-hidden="true"
                  className="h-full w-full"
                  viewBox="0 0 420 180"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <defs>
                    <linearGradient id="force-lab-airway" x1="0" x2="1">
                      <stop offset="0" stopColor="#164e63" stopOpacity="0.3" />
                      <stop offset="0.5" stopColor="#67e8f9" stopOpacity="0.22" />
                      <stop offset="1" stopColor="#164e63" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M22 51 C112 24 300 25 398 54 L398 126 C296 151 112 153 22 127 Z"
                    fill="url(#force-lab-airway)"
                    stroke="#67e8f9"
                    strokeOpacity="0.35"
                    strokeWidth="2"
                  />
                  {Array.from({ length: 11 }, (_, index) => {
                    const x = 45 + index * 33
                    return (
                      <g key={x}>
                        <path
                          d={`M${x - 35} 126 C${x - 4} 96 ${x + 4} 81 ${x + 35} 52`}
                          fill="none"
                          stroke="#a5f3fc"
                          strokeOpacity="0.8"
                          strokeWidth="2"
                        />
                        <path
                          d={`M${x - 35} 53 C${x - 4} 82 ${x + 4} 97 ${x + 35} 127`}
                          fill="none"
                          stroke="#fbbf24"
                          strokeOpacity="0.72"
                          strokeWidth="2"
                        />
                      </g>
                    )
                  })}
                  <path
                    d="M210 24 V156 M194 40 L210 24 L226 40 M194 140 L210 156 L226 140"
                    fill="none"
                    stroke="#fb7185"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                  />
                </svg>
                <span className="absolute bottom-3 left-4 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                  Visible geometry · matched displacement
                </span>
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  Guided first · case practice later
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                  Start in the Force Lab
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Begin with three guided deformation scenes, then return to solve cases with the
                  full mechanics cockpit.
                </p>
                <button
                  type="button"
                  onClick={() => openLesson('orient', GUIDED_FORCE_LAB_ANCHOR_ID)}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 motion-reduce:transition-none"
                >
                  Start guided Force Lab
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {stentModuleCopy.comparisonModelNote}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  No force ranking, synthetic wall stress, or patient-specific recommendation is
                  generated.
                </p>
              </div>
            </div>
          </div>
        </header>

        <LessonStepper
          activeLessonId={activeLesson.id}
          completedLessonIds={progress.completedLessonIds}
          lessons={stepperItems}
          onSelect={openLesson}
        />

        {!hydrated ? (
          <p className="text-center text-xs text-muted-foreground" role="status">
            Restoring saved lesson progress…
          </p>
        ) : null}

        <section id="airway-stent-active-lesson" className="scroll-mt-24 space-y-6">
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

          {activeLesson.kind === 'instructional' ? (
            <InstructionalLesson
              lesson={activeLesson}
              selectedAnswers={selectedAnswers}
              guidedForceProgress={guidedForceProgress}
              forcePracticeProgress={forcePracticeProgress}
              committedPromptIds={completedPromptIds}
              onGuidedForceProgress={updateGuidedForceProgress}
              onForcePracticeProgress={updateForcePracticeProgress}
              onSelect={(promptId, choiceId) =>
                setSelectedAnswers((current) => ({ ...current, [promptId]: choiceId }))
              }
              onCommit={(promptId) => commitInstructionalPrompt(promptId, activeLesson)}
            />
          ) : (
            <>
              <LearningSections sections={activeLesson.sections} />
              <AssessmentPanel
                key={`assessment-attempt-${assessmentAttempt}`}
                attempt={assessmentAttempt}
                items={activeLesson.items.map(assessmentPrompt)}
                masteryThreshold={assessmentMasteryThreshold}
                onComplete={completeAssessment}
                onRetry={() => setAssessmentAttempt((current) => current + 1)}
              />
            </>
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
              {progress.completedLessonIds.length} of {STENT_LESSON_IDS.length} lessons complete
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

        <div id="stent-evidence" className="scroll-mt-24">
          <SourcesPanel
            disclaimer={stentModuleCopy.disclaimer}
            evidenceIds={evidenceIds}
            limitations={stentModuleCopy.evidenceLimitations}
          />
        </div>
      </div>
    </div>
  )
}

function InstructionalLesson({
  committedPromptIds,
  forcePracticeProgress,
  guidedForceProgress,
  lesson,
  onCommit,
  onForcePracticeProgress,
  onGuidedForceProgress,
  onSelect,
  selectedAnswers,
}: {
  committedPromptIds: Set<string>
  forcePracticeProgress: StentLabExperienceProgress
  guidedForceProgress: StentLabExperienceProgress
  lesson: InstructionalLessonCopy
  onCommit: (promptId: string) => void
  onForcePracticeProgress: (progress: StentLabExperienceProgress) => void
  onGuidedForceProgress: (progress: StentLabExperienceProgress) => void
  onSelect: (promptId: string, choiceId: string) => void
  selectedAnswers: Record<string, string>
}) {
  const predictionCommitted = committedPromptIds.has(lesson.prediction.id)
  const checkpointCommitted = committedPromptIds.has(lesson.checkpoint.id)
  const isGuidedForceLesson = lesson.id === 'orient'
  const isForcePracticeLesson = lesson.id === 'force-lab'
  const guidedScenesRemaining = Math.max(
    0,
    guidedForceScenes.length - guidedForceProgress.completedIds.length,
  )
  const practiceMissionsRemaining = Math.max(
    0,
    forceLabMissions.length - forcePracticeProgress.completedIds.length,
  )

  const checkpoint = (
    <PredictionCard
      eyebrow="Checkpoint"
      committed={checkpointCommitted}
      prompt={checkpointPrompt(lesson.checkpoint)}
      selectedChoiceId={selectedAnswers[lesson.checkpoint.id]}
      onSelect={(choiceId) => onSelect(lesson.checkpoint.id, choiceId)}
      onCommit={() => onCommit(lesson.checkpoint.id)}
    />
  )

  return (
    <div className="space-y-6">
      <PredictionCard
        committed={predictionCommitted}
        prompt={predictionPrompt(lesson.prediction)}
        selectedChoiceId={selectedAnswers[lesson.prediction.id]}
        onSelect={(choiceId) => onSelect(lesson.prediction.id, choiceId)}
        onCommit={() => onCommit(lesson.prediction.id)}
      />

      {isGuidedForceLesson ? (
        <div id={GUIDED_FORCE_LAB_ANCHOR_ID} className="scroll-mt-24">
          <StentArchitectureLabDynamic
            experience="guided-force"
            onExperienceProgress={onGuidedForceProgress}
          />
        </div>
      ) : null}

      {predictionCommitted ? (
        <>
          {isGuidedForceLesson ? (
            <ObstructionMorphologyGrid items={obstructionMorphologies} />
          ) : null}
          {lesson.id === 'architectures' ? (
            <StentArchitectureLabDynamic experience="architecture-explorer" />
          ) : null}
          {isForcePracticeLesson ? (
            <StentArchitectureLabDynamic
              experience="force-practice"
              onExperienceProgress={onForcePracticeProgress}
            />
          ) : null}
          {lesson.id === 'tissue-time' ? <TissueMechanismMap items={tissueMechanisms} /> : null}
          {lesson.id === 'evidence-decisions' ? (
            <EvidenceDecisionLab benchData={ginaDumonBenchData} forceTaxonomy={forceTaxonomy} />
          ) : null}

          {!isForcePracticeLesson || forcePracticeProgress.complete ? (
            <LearningSections sections={filteredSections(lesson)} />
          ) : null}

          {isGuidedForceLesson && !guidedForceProgress.complete ? (
            <ExperienceGate
              completedCount={guidedForceProgress.completedIds.length}
              label="guided scene"
              remainingCount={guidedScenesRemaining}
              totalCount={guidedForceScenes.length}
            />
          ) : null}
          {isForcePracticeLesson && !forcePracticeProgress.complete ? (
            <ExperienceGate
              completedCount={forcePracticeProgress.completedIds.length}
              label="practice mission"
              remainingCount={practiceMissionsRemaining}
              totalCount={forceLabMissions.length}
            />
          ) : null}

          {(!isGuidedForceLesson || guidedForceProgress.complete) &&
          (!isForcePracticeLesson || forcePracticeProgress.complete)
            ? checkpoint
            : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Commit to the opening prediction to unlock this lesson’s visual model and evidence.
        </div>
      )}
    </div>
  )
}

function ExperienceGate({
  completedCount,
  label,
  remainingCount,
  totalCount,
}: {
  completedCount: number
  label: 'guided scene' | 'practice mission'
  remainingCount: number
  totalCount: number
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/5 p-5 text-sm leading-6 text-muted-foreground"
      role="status"
    >
      <p className="font-semibold text-foreground">
        Complete {remainingCount} remaining {label}
        {remainingCount === 1 ? '' : 's'} to unlock the lesson checkpoint.
      </p>
      <p className="mt-1">
        {completedCount} of {totalCount} {label}s visited and committed.
      </p>
    </div>
  )
}
