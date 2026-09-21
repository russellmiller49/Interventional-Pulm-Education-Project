'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import type { CtLesson, CtViewerState } from '../content/ct-types'
import { BASE_PATH, LESSONS, SOURCE, lessonAfter, ORIENTATION_CONTRACT } from '../content/lessons'
import { parentViewTask } from '../content/local-teaching'
import { CtViewpointComparison } from './CtViewpointComparison'
import { JunctionFeedback } from './JunctionFeedback'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { CourseOutline } from './CourseOutline'
import { LOCAL_DRAFT_ALIASES } from '../engine/local-draft-migration'
import { orientationName, sameOrientation, STANDARD_ORIENTATION } from '../geometry/orientation'
import { localExercise, MODEL_REFERENCE_LABEL } from '../content/local-exercises'
import {
  browserStorage,
  readSelfPacedRecord,
  recordDisplayExplanationShown,
  recordLessonOpened,
  setLessonReviewed,
} from '../engine/selfPacedProgress'
import { draftSignature, readCtDraft, writeCtDraft } from '../engine/ct-draft'
import {
  emptyLocalSession,
  localReady,
  localSessionReducer,
  parseLocalSession,
  restartDiscards,
  type LocalAction,
} from '../engine/local-session'
import { CtContinuationFeedback, CtCourseControl, CtCourseFeedback } from './CtTraceControls'
import { CtParentMap, CtLocalRouteMap } from './CtBranchMap'
import { NativeCtViewer } from './NativeCtViewer'
import { CtOrientationTeaching, orientationActionLabel } from './CtOrientationTeaching'
import { resetPaneScroll } from './resetPaneScroll'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import styles from './branch-tracing.module.css'

export function LocalCtLesson({ lesson }: { lesson: CtLesson }) {
  const router = useRouter()
  const exercises = useMemo(() => lesson.exercises!.map(localExercise), [lesson])
  const signature = useMemo(
    () =>
      draftSignature([
        lesson.id,
        lesson.id === 'orientation' ? ORIENTATION_CONTRACT : 'local-tracing',
        exercises.map((e) => ({
          id: e.id,
          trace: e.trace,
          answers: e.answerPoints,
          review: e.review,
        })),
      ]),
    [lesson, exercises],
  )
  const draftKey = `learn.${lesson.id}`
  // Explanations this device has already displayed; never a legacy comprehension result.
  const [knownOrientations] = useState(() => readSelfPacedRecord().record.displayExplanationsShown)
  const [loaded] = useState(() =>
    readCtDraft(
      browserStorage(),
      draftKey,
      signature,
      (v) => parseLocalSession(v, exercises, knownOrientations),
      LOCAL_DRAFT_ALIASES[lesson.id] ?? [],
    ),
  )
  const [s, setSession] = useState(
    () => loaded.value ?? emptyLocalSession(exercises, {}, knownOrientations),
  )
  const { record } = useSelfPacedProgress()
  const [saveFailed, setSaveFailed] = useState(false)
  const [help, setHelp] = useState(false)
  const helpRef = useRef<HTMLButtonElement>(null)
  const imageWorkspaceRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const instructionsRef = useRef<HTMLElement>(null)
  const previousStep = useRef<string | null>(null)
  const [exitWarning, setExitWarning] = useState(false)
  const [restartAsk, setRestartAsk] = useState(false)
  // A restart in this session; it makes the draft-restored note above it out of date.
  const [restarted, setRestarted] = useState(false)
  const [reviewAttempt, setReviewAttempt] = useState<number | null>(null)
  const [viewerEpoch, setViewerEpoch] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  // Transient, per step: showing a reference or the opening labels records nothing.
  const [referenceFor, setReferenceFor] = useState<string | null>(null)
  const [labelsFor, setLabelsFor] = useState<string | null>(null)
  const [request, setRequest] = useState<{ slice: number; serial: number; focusAirway?: boolean }>()
  const [focusRequest, setFocusRequest] = useState(0)
  const [displayedSlice, setDisplayedSlice] = useState<number | null>(null)
  const exercise = exercises[s.exercise]
  const point = exercise.trace.checkpoints[0]
  const slot = exercise.answerPoints[s.slot]
  const attempts = s.history[exercise.id] ?? []
  const nextLesson = lessonAfter(lesson.id)
  const sameLumen = ['same-lumen', 'viewpoint'].includes(exercise.spec.kind)
  const viewpoint = exercise.spec.kind === 'viewpoint'
  const authoredInterval = exercise.spec.kind === 'same-lumen'
  const parentTask = parentViewTask(exercise.spec, s.exercise)
  const parentRequired = parentTask !== 'none'
  const independentParent = parentTask === 'independent'
  const guide = s.orientationGuide
  const stepKey = `${exercise.id}:${s.phase}`
  const referenceShown = !guide && s.phase === 'attempt' && referenceFor === stepKey
  const labelsShown = labelsFor === exercise.id
  const attemptReady = !guide && s.phase === 'attempt' && localReady(s, exercise)
  const markPlaced = sameLumen && Boolean(s.marks[0]?.pixel)
  const responseCount = s.marks.filter(Boolean).length
  const missingSlot = s.marks.findIndex((mark) => !mark)
  const nextMarkSlot =
    !guide && !sameLumen && s.phase === 'attempt' && s.marks[s.slot] && missingSlot >= 0
      ? missingSlot
      : null
  const needsCourse = ['pattern', 'integration'].includes(exercise.spec.kind) && !s.course
  const needsBranch = exercise.spec.kind === 'integration' && s.branch === null
  const lastExercise = s.exercise === exercises.length - 1
  const nextDestination = nextLesson ? `${BASE_PATH}/learn?lesson=${nextLesson.id}` : BASE_PATH
  const showingWalkthrough =
    !guide &&
    (s.phase === 'demo' ||
      s.phase === 'compare' ||
      (s.phase === 'attempt' && (referenceShown || (s.hints === 3 && !attemptReady))))
  const complete = s.phase === 'complete'
  const reviewed = record.reviewedLessonIds.includes(lesson.id)
  const checkedCount = exercises.filter((e) => s.history[e.id]?.length).length
  const packet = junctionFeedbackPacket(exercise.spec.checkpointId)
  // Stated before the task, from the packet's own already-recorded source qualification.
  const entryLimitation = !sameLumen ? packet?.entryLimitation : undefined
  const discards = restartDiscards(s, exercises)
  const restoredDisplay =
    loaded.value && !sameOrientation(loaded.value.orientation, STANDARD_ORIENTATION)
      ? orientationName(loaded.value.orientation)
      : null
  const title = guide
    ? guide === 'context'
      ? 'Orient yourself on the CT'
      : guide === 'direction'
        ? 'Why change the CT display?'
        : 'What changed on the CT?'
    : sameLumen
      ? s.phase === 'demo'
        ? '1. Follow the airway'
        : s.phase === 'attempt'
          ? attemptReady
            ? markPlaced
              ? 'Mark placed — ready to review'
              : 'Uncertainty recorded — ready to review'
            : '2. Mark the same airway'
          : s.phase === 'compare'
            ? '3. Compare the two slices'
            : 'Lesson finished'
      : s.phase === 'demo'
        ? '1. Watch this bifurcation'
        : s.phase === 'attempt'
          ? attemptReady
            ? '2. Branch responses ready to review'
            : s.marks[s.slot]
              ? `2. ${slot.label} placed`
              : `2. Mark ${slot.label}`
          : s.phase === 'compare'
            ? s.marks.every((mark) => mark?.pixel)
              ? '3. Compare your branch marks'
              : '3. Compare your branch responses'
            : s.phase === 'parent-view'
              ? s.viewAnswer === null
                ? independentParent && !labelsShown
                  ? 'Match the branches'
                  : 'Study the parent-view relationship'
                : '4. Compare the labels with your choice'
              : 'Lesson finished'
  const goToSlice = (slice: number, focusAirway = false) =>
    setRequest((r) => ({ slice, focusAirway, serial: (r?.serial ?? 0) + 1 }))
  function act(action: LocalAction) {
    const next = localSessionReducer(exercises, s, action)
    if (next === s) return s
    // Reaching the end marks the lesson reviewed on this device; nothing about the marks is stored.
    if (next.phase === 'complete' && !complete) setLessonReviewed(lesson.id, true)
    if (action.type === 'frame') goToSlice(exercise.frames[next.frame].slice)
    if (action.type === 'slot') {
      setPlaying(false)
      goToSlice(exercise.answerPoints[next.slot].slice)
    }
    if (action.type === 'restart') {
      setViewerEpoch((v) => v + 1)
      setRestarted(true)
      setRestartAsk(false)
    }
    if (action.type === 'retry' || action.type === 'next' || action.type === 'restart')
      setReviewAttempt(null)
    if (action.type === 'begin' || action.type === 'retry' || action.type === 'reset-attempt')
      goToSlice(exercise.trace.anchor.slice)
    if (action.type === 'check') goToSlice(slot.slice)
    if (action.type === 'parent-view' || (action.type === 'skip' && next.phase === 'parent-view'))
      goToSlice(exercise.answerPoints[0].slice)
    if (action.type === 'focus-airway') goToSlice(exercise.trace.anchor.slice, true)
    if (action.type === 'finish-orientation' && s.phase === 'parent-view')
      goToSlice(exercise.answerPoints[0].slice)
    if (next.exercise !== s.exercise || action.type === 'restart') setRequest(undefined)
    if (
      next.phase !== s.phase ||
      next.exercise !== s.exercise ||
      (action.type === 'mark' && localReady(next, exercise))
    )
      setPlaying(false)
    setSession(next)
    return next
  }
  const onViewChange = useCallback(
    (view: CtViewerState) =>
      setSession((current) => {
        const exercise = exercises[current.exercise]
        const key = exercise.id
        const matchedFrame = exercise.frames.findIndex((frame) => frame.slice === view.slice)
        const frame =
          exercise.frames[current.frame].slice === view.slice || matchedFrame < 0
            ? current.frame
            : matchedFrame
        return JSON.stringify(current.views[key]) === JSON.stringify(view) &&
          frame === current.frame
          ? current
          : { ...current, frame, views: { ...current.views, [key]: view } }
      }),
    [exercises],
  )
  useEffect(() => {
    recordLessonOpened(lesson.id)
  }, [lesson.id])
  useEffect(() => {
    for (const preset of s.taughtPresets) recordDisplayExplanationShown(preset)
  }, [s.taughtPresets])
  useEffect(() => {
    const pane = instructionsRef.current
    const step = `${guide}:${exercise.id}:${s.phase}`
    const changed = previousStep.current !== null && previousStep.current !== step
    previousStep.current = step
    // The instructions pane holds the new task, so it returns to its own top.
    resetPaneScroll(pane)
    // Stacked layouts scroll the document. Return to the new task after reviewing
    // the CT; the sticky task alone does not bring its diagram/choices into view.
    if (changed && pane && getComputedStyle(pane).overflowY === 'visible')
      workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [guide, exercise.id, s.phase])
  useEffect(() => {
    // A new example is a new workspace. Checking an answer is not: the crop,
    // magnification and scroll position the learner set stay where they are.
    resetPaneScroll(imageWorkspaceRef.current)
  }, [exercise.id, guide, viewerEpoch])
  useEffect(() => {
    // Report whether synchronization with browser storage succeeded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveFailed(!writeCtDraft(browserStorage(), draftKey, signature, s))
  }, [draftKey, signature, s])
  useEffect(() => {
    if (!saveFailed) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveFailed])
  useEffect(() => {
    if (!playing || !imageReady || !showingWalkthrough) return
    const timer = window.setTimeout(() => {
      if (s.frame === exercise.frames.length - 1) {
        setPlaying(false)
        return
      }
      const frame = s.frame + 1
      setSession((current) => ({ ...current, frame }))
      setRequest((r) => ({ slice: exercise.frames[frame].slice, serial: (r?.serial ?? 0) + 1 }))
    }, 900)
    return () => window.clearTimeout(timer)
  }, [playing, imageReady, showingWalkthrough, s.frame, exercise])
  function exit() {
    if (writeCtDraft(browserStorage(), draftKey, signature, s)) router.push(BASE_PATH)
    else {
      setSaveFailed(true)
      setExitWarning(true)
    }
  }
  function hint(level: number) {
    act({ type: 'hint', level })
    // Focus CT view restores the crop this division was authored with. It claims no
    // region of interest and places nothing on the image.
    if (level === 1) setFocusRequest((value) => value + 1)
    if (level === 2) goToSlice(exercise.trace.anchor.slice)
  }
  function toggleReference() {
    setPlaying(false)
    if (referenceShown) setReferenceFor(null)
    else {
      setReferenceFor(stepKey)
      goToSlice(slot.slice)
    }
  }
  // An image must load before an image task is performed; moving on never waits for a mark.
  const canAdvance =
    imageReady &&
    (Boolean(guide) || nextMarkSlot !== null || s.phase !== 'attempt' || localReady(s, exercise))
  const primaryLabel = guide
    ? guide === 'context'
      ? 'Focus on this airway'
      : guide === 'direction'
        ? orientationActionLabel(exercise.trace)
        : 'Apply this to the same airway'
    : s.phase === 'demo'
      ? sameLumen
        ? 'Start tracing'
        : 'Start marking branches'
      : s.phase === 'attempt'
        ? sameLumen
          ? 'Check my tracing'
          : nextMarkSlot !== null
            ? `Mark ${exercise.answerPoints[nextMarkSlot].label}`
            : 'Check my tracing'
        : s.phase === 'compare' && parentRequired
          ? independentParent
            ? 'Continue to branch matching'
            : 'Study the parent view'
          : lastExercise
            ? sameLumen
              ? nextLesson
                ? `Next lesson: ${nextLesson.title}`
                : 'Return to overview'
              : 'Finish lesson'
            : sameLumen
              ? 'Next airway interval'
              : `Next example: ${exercises[s.exercise + 1].trace.anchor.airway.code}`
  const primaryAction = () => {
    if (guide) {
      act({
        type:
          guide === 'context'
            ? 'focus-airway'
            : guide === 'direction'
              ? 'demonstrate-orientation'
              : 'finish-orientation',
      })
      return
    }
    if (nextMarkSlot !== null) {
      act({ type: 'slot', index: nextMarkSlot })
      return
    }
    const next = act({
      type:
        s.phase === 'demo'
          ? 'begin'
          : s.phase === 'attempt'
            ? 'check'
            : s.phase === 'compare' && parentRequired
              ? 'parent-view'
              : 'next',
    })
    if (sameLumen && s.phase === 'compare' && lastExercise) {
      if (writeCtDraft(browserStorage(), draftKey, signature, next)) router.push(nextDestination)
      else {
        setSaveFailed(true)
        setExitWarning(true)
      }
    }
  }
  const secondary =
    guide || complete
      ? undefined
      : s.phase === 'attempt'
        ? { label: 'Continue without marking', onActivate: () => act({ type: 'skip' }) }
        : s.phase === 'compare' && parentRequired
          ? {
              label: lastExercise ? 'Finish without the parent view' : 'Skip the parent view',
              onActivate: () => act({ type: 'next' }),
            }
          : undefined
  const nextActionLabel = complete
    ? nextLesson
      ? `Next lesson: ${nextLesson.title}`
      : 'Return to overview'
    : primaryLabel
  const taskInstruction = guide
    ? guide === 'context'
      ? `Use the R/L/A/P markers on Axial CT to orient yourself, then focus on ${exercise.trace.anchor.airway.name}.`
      : guide === 'direction'
        ? `Read how the viewing directions differ, then select ${orientationActionLabel(exercise.trace)} to change this same CT.`
        : 'Compare the two copies: only the display changed. Select Apply this to the same airway when you are ready.'
    : sameLumen
      ? complete
        ? `Next: ${nextLesson?.title ?? 'course review'}.`
        : s.phase === 'demo'
          ? `Follow ${exercise.trace.anchor.airway.name} from slice ${exercise.trace.anchor.slice} to slice ${slot.slice}. Then select Start tracing to place your own mark.`
          : s.phase === 'attempt'
            ? attemptReady
              ? `Your ${markPlaced ? 'mark' : 'uncertainty response'} on slice ${slot.slice} is ready. Select Check my tracing to compare it with the starting slice.`
              : `Scroll from slice ${exercise.trace.anchor.slice} to ${slot.slice}, keeping the same lumen in view. Click inside it on slice ${slot.slice}, then select Check my tracing. You can show the reference or continue without marking.`
            : lastExercise
              ? `Compare the starting slice with your marked slice. Continue to ${nextLesson?.title ?? 'the overview'} when ready.`
              : `Compare the starting slice with your marked slice. Then select Next airway interval to repeat this on ${exercises[s.exercise + 1].trace.anchor.airway.name}.`
      : complete
        ? `You finished the ${exercises.length} examples. ${nextLesson ? `Continue to ${nextLesson.title}.` : 'Return to the overview to choose practice or more routes.'}`
        : s.phase === 'parent-view'
          ? !independentParent
            ? 'The labels show how this same division projects into the declared parent view. Follow each CT daughter to its schematic opening; this is guided application.'
            : s.viewAnswer === null && !labelsShown
              ? `Which numbered opening in the diagram matches CT branch ${exercise.answerPoints[0].label}? Choose an opening, or select Show the labels. You can continue at any point.`
              : `Compare the branch labels${s.viewAnswer === null ? '' : ' with your choice'}, then ${lastExercise ? 'select Finish lesson' : `continue to the ${exercises[s.exercise + 1].trace.anchor.airway.code} example`}.`
          : s.phase === 'demo'
            ? exercise.task
            : s.phase === 'compare'
              ? parentRequired
                ? 'Compare your marks with the model locations, then relate this division to the declared parent view, or skip it. Repeating the marks is optional.'
                : 'Review your marks on the CT. Retain uncertainty before continuing.'
              : attemptReady
                ? 'All responses are ready. Select Check my tracing to see the comparison.'
                : nextMarkSlot !== null
                  ? `Your ${slot.label} ${s.marks[s.slot]?.pixel ? 'mark' : 'uncertainty response'} is placed. Next, mark ${exercise.answerPoints[nextMarkSlot].label} on slice ${exercise.answerPoints[nextMarkSlot].slice}.`
                  : missingSlot < 0
                    ? needsCourse
                      ? 'Your branch marks are placed. Choose the Airway course below, then select Check my tracing.'
                      : 'Your branch marks are placed. Choose which branch to follow below, then select Check my tracing.'
                    : `Trace ${slot.label} from ${exercise.trace.anchor.airway.code} to slice ${slot.slice}, then click inside its lumen. You can also record Lumen unresolved here, show the reference, or continue without marking.`
  // Model points appear in the demonstration, the comparison, and whenever the learner shows the reference.
  const viewSlice = s.views[exercise.id]?.slice ?? exercise.trace.anchor.slice
  const frame = showingWalkthrough
    ? exercise.frames[s.frame]?.slice === viewSlice
      ? exercise.frames[s.frame]
      : exercise.frames.find((f) => f.slice === viewSlice)
    : undefined
  const showAnchor = Boolean(guide) || (s.phase === 'attempt' && s.hints < 3 && !referenceShown)
  const displayedFrameIndex = exercise.frames.findIndex((f) => f.slice === displayedSlice)
  const displayedFrame = exercise.frames[displayedFrameIndex]
  const checklist = lesson.checklist?.length ? (
    <section aria-label="Tracing checklist">
      <h3>Tracing checklist</h3>
      <ol className={styles.tracingChecklist}>
        {lesson.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  ) : null
  // The transport sits with the CT; the caption transcript and the teaching prose
  // stay in the instructions pane. Nothing plays until the learner asks it to.
  const walkthroughTransport = (
    <section className={styles.walkthroughTransport} aria-label="CT demonstration controls">
      <div className={styles.walkthroughControls}>
        <button
          onClick={() => {
            if (!playing) goToSlice(exercise.frames[s.frame].slice)
            setPlaying((v) => !v)
          }}
        >
          {playing ? 'Pause walkthrough' : 'Play walkthrough'}
        </button>
        <button
          disabled={s.frame === 0}
          onClick={() => {
            setPlaying(false)
            act({ type: 'frame', index: s.frame - 1 })
          }}
        >
          Previous demonstration slice
        </button>
        <button
          disabled={s.frame === exercise.frames.length - 1}
          onClick={() => {
            setPlaying(false)
            act({ type: 'frame', index: s.frame + 1 })
          }}
        >
          Next demonstration slice
        </button>
        <button
          onClick={() => {
            setPlaying(false)
            act({ type: 'frame', index: 0 })
          }}
        >
          Replay from parent
        </button>
        <span className={styles.walkthroughPosition}>
          {displayedSlice === null
            ? 'Loading CT demonstration…'
            : displayedFrame
              ? `Demonstration slice ${displayedSlice} · ${displayedFrameIndex + 1} of ${exercise.frames.length}`
              : `Browsing slice ${displayedSlice}`}
        </span>
      </div>
      <p>
        {displayedSlice === null
          ? 'Waiting for the CT image.'
          : (displayedFrame?.caption ??
            `Browsing slice ${displayedSlice}. Return to a demonstration slice to see its caption.`)}
      </p>
    </section>
  )
  const walkthrough = (
    <section className={styles.walkthrough} aria-label="Captioned CT walkthrough">
      {walkthroughTransport}
      <details>
        <summary>Caption transcript</summary>
        <ol>
          {exercise.frames
            .filter((f, i, frames) => i === 0 || f.caption !== frames[i - 1].caption)
            .map((f, i) => (
              <li key={i}>
                Slice {f.slice}: {f.caption}
              </li>
            ))}
        </ol>
      </details>
      <p className={styles.small}>
        Every demonstration slice is an adjacent native plane; the transport steps one plane at a
        time and no image is interpolated between them.
      </p>
    </section>
  )
  return (
    <LessonShell
      section="learn"
      stage={guide ?? s.phase}
      module="bronchial-branch-tracing"
      label="Local CT tracing lesson"
      header={
        <SectionHeader
          kicker={`Learn · ${LESSONS.indexOf(lesson) + 1} of ${LESSONS.length}`}
          title={lesson.title}
          sectionsControl={<CourseOutline currentId={lesson.id} />}
          helpRef={helpRef}
          onHelp={() => setHelp(true)}
          onRestart={() => (discards.length ? setRestartAsk(true) : act({ type: 'restart' }))}
          restartLabel="Restart lesson"
          onSaveAndExit={exit}
          resumedNote={
            saveFailed
              ? 'Draft saving failed. Keep this page open; Save & exit will explain how to leave without saving.'
              : restarted
                ? `You restarted this lesson. Your checked marks are kept below; the current example, its responses and the CT display started again in ${orientationName(STANDARD_ORIENTATION).toLowerCase()}.`
                : loaded.notice
                  ? `${loaded.notice}${
                      restoredDisplay
                        ? sameOrientation(s.orientation, loaded.value!.orientation)
                          ? ` Restored display: ${restoredDisplay}. Return to standard axial changes only the display.`
                          : ` That draft was saved with the display set to ${restoredDisplay}; the CT is now in ${orientationName(s.orientation).toLowerCase()}.`
                        : ''
                    }`
                  : undefined
          }
        />
      }
      footer={
        <div className={styles.footer}>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            {SOURCE.title}
          </a>
          <span>{lesson.sourcePages}</span>
          <span>{MODEL_REFERENCE_LABEL}</span>
        </div>
      }
    >
      <div
        ref={workspaceRef}
        className={styles.localWorkspace}
        data-route-map={exercise.spec.kind === 'integration' || undefined}
      >
        <div
          className={styles.currentTask}
          data-current-task
          data-response-ready={attemptReady}
          aria-live="polite"
        >
          <NowCard
            model={{
              kicker: `${viewpoint ? 'Viewpoint application · airway' : sameLumen ? 'Same-lumen interval' : 'Example'} ${s.exercise + 1} of ${exercises.length} · ${exercise.trace.anchor.airway.code}`,
              heading: title,
              body: taskInstruction,
              status:
                !guide && s.phase === 'attempt' && !sameLumen
                  ? `${responseCount} of ${exercise.answerPoints.length} branch responses placed`
                  : undefined,
              primary: {
                label: nextActionLabel,
                href: complete ? nextDestination : undefined,
                onActivate: primaryAction,
                disabled: !canAdvance,
                disabledReason: !imageReady
                  ? 'Wait for the CT image to load.'
                  : !guide && s.phase === 'attempt'
                    ? missingSlot >= 0
                      ? 'To check, place this mark on the CT or choose Lumen unresolved here. You can also continue without marking.'
                      : needsCourse
                        ? 'To check, choose an Airway course below, or continue without marking.'
                        : needsBranch
                          ? 'To check, choose a continuation branch below, or continue without marking.'
                          : undefined
                    : undefined,
              },
              secondary,
            }}
          />
        </div>
        <section
          ref={instructionsRef}
          className={styles.localInstructions}
          data-branch-matching={!guide && s.phase === 'parent-view' ? true : undefined}
          aria-label="Current exercise instructions"
        >
          {guide ? (
            <>
              <CtOrientationTeaching
                trace={exercise.trace}
                guide={{
                  step: guide,
                  orientation: s.orientation,
                  onAction: act,
                }}
              />
              {guide === 'context' &&
                (s.marks.some(Boolean) || Object.keys(s.history).length > 0) && (
                  <p>
                    Your saved marks are kept. After this orientation introduction, you will return
                    to your current task.
                  </p>
                )}
            </>
          ) : (
            <>
              <h2>
                {complete
                  ? 'Review your work'
                  : sameLumen
                    ? 'Keep the same airway in view'
                    : s.phase === 'parent-view'
                      ? 'Branch matching diagram'
                      : s.phase === 'compare'
                        ? 'Review your marks'
                        : 'CT tracing instructions'}
              </h2>
              {authoredInterval && s.phase === 'demo' && (
                <div className={styles.warmupPurpose} data-lesson-teaching>
                  {lesson.purpose && (
                    <>
                      <h3>Why this matters</h3>
                      <p>{lesson.purpose}</p>
                    </>
                  )}
                  <p>
                    <strong>{lesson.concept}</strong>
                  </p>
                  {lesson.teaching.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <h3>These intervals</h3>
                  <p>{lesson.worked}</p>
                  {checklist}
                </div>
              )}
              {exercise.spec.kind === 'integration' && s.parentConfirmed && (
                <p>
                  Supplied starting parent: {exercises[0].trace.anchor.airway.code}. Compare the CT
                  evidence before accepting the planned route; segment identification is supplied,
                  not asked.
                </p>
              )}

              {showingWalkthrough && s.phase !== 'compare' && (
                <section className={styles.walkthrough} aria-label="Captioned CT walkthrough">
                  <p>
                    The demonstration controls and the current caption are beside the CT. Full
                    captions for every slice are here.
                  </p>
                  <details>
                    <summary>Caption transcript</summary>
                    <ol>
                      {exercise.frames
                        .filter((f, i, frames) => i === 0 || f.caption !== frames[i - 1].caption)
                        .map((f, i) => (
                          <li key={i}>
                            Slice {f.slice}: {f.caption}
                          </li>
                        ))}
                    </ol>
                  </details>
                  <p className={styles.small}>
                    Every demonstration slice is an adjacent native plane; the transport steps one
                    plane at a time and no image is interpolated between them.
                  </p>
                </section>
              )}
              {entryLimitation && ['demo', 'attempt'].includes(s.phase) && (
                <p
                  className={styles.entryLimitation}
                  data-entry-limitation={exercise.spec.checkpointId}
                >
                  {entryLimitation}
                </p>
              )}
              {s.phase === 'demo' && !sameLumen && (
                <>
                  <p>{lesson.objective}</p>
                  <p>{lesson.concept}</p>
                  {lesson.teaching.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <h3>This local example</h3>
                  <p>{exercise.teaching.finding}</p>
                  <p>{exercise.teaching.comparison}</p>
                  <p>
                    Watch or step through the native CT interval. Gold crosshairs identify model
                    locations; examine the air-filled lumen and its walls between those locations.
                  </p>
                </>
              )}
              {s.phase === 'attempt' && !(sameLumen && attemptReady) && (
                <>
                  <fieldset className={styles.markSlots}>
                    <legend>
                      {sameLumen ? 'Mark the same lumen' : 'Mark each daughter lumen'}
                    </legend>
                    {exercise.answerPoints.map((p, i) => (
                      <button
                        key={i}
                        aria-pressed={s.slot === i}
                        onClick={() => act({ type: 'slot', index: i })}
                      >
                        {p.label} · slice {p.slice}
                        {s.marks[i] ? ' · placed' : ''}
                      </button>
                    ))}
                  </fieldset>
                  {sameLumen ? (
                    <p>
                      Follow the lumen from slice {exercise.trace.anchor.slice} to {slot.slice}{' '}
                      using the CT slice controls. Place a mark on {slot.slice}. If you lose track,
                      return to the starting slice or record uncertainty. Then select{' '}
                      <strong>Check my tracing</strong>.
                    </p>
                  ) : (
                    <p>
                      Select a branch above to open its marking slice. Place its mark, then follow
                      the next action above. Once all daughter responses are placed, select{' '}
                      <strong>Check my tracing</strong>. If you cannot identify a lumen, choose{' '}
                      <strong>Lumen unresolved here</strong> beside the CT.
                    </p>
                  )}
                  {authoredInterval && s.exercise > 0 && <p>{lesson.transferPrompt}</p>}
                  {authoredInterval && checklist}
                  {['pattern', 'integration'].includes(exercise.spec.kind) && (
                    <CtCourseControl
                      value={s.course}
                      onChange={(value) => act({ type: 'course', value })}
                    />
                  )}
                  {exercise.spec.kind === 'integration' && (
                    <fieldset>
                      <legend>
                        Which branch would you follow toward {exercise.trace.focusAirway?.code}?
                      </legend>
                      {point.decision?.options.map((option) => (
                        <label className={styles.localOption} key={option.sourceEdgeId}>
                          <input
                            type="radio"
                            name="continuation"
                            checked={s.branch === option.sourceEdgeId}
                            onChange={() => act({ type: 'branch', value: option.sourceEdgeId })}
                          />
                          {option.label}
                        </label>
                      ))}
                      <label className={styles.localOption}>
                        <input
                          type="radio"
                          name="continuation"
                          checked={s.branch === 'unresolved'}
                          onChange={() => act({ type: 'branch', value: 'unresolved' })}
                        />
                        Continuation unresolved
                      </label>
                    </fieldset>
                  )}
                  <div className={styles.hints}>
                    <h3>Help</h3>
                    <button aria-pressed={referenceShown} onClick={toggleReference}>
                      Show reference
                    </button>
                    {['Focus CT view', 'Return to the parent'].map((label, i) => (
                      <button key={label} onClick={() => hint(i + 1)}>
                        {label}
                      </button>
                    ))}
                    {referenceShown ? (
                      <p role="status">
                        Reference shown: gold crosshairs mark the model locations on the
                        demonstration slices. {exercise.hints[2]} Any mark you place stays exactly
                        where you put it.
                      </p>
                    ) : (
                      s.hints > 0 &&
                      s.hints < 3 && <p role="status">{exercise.hints[s.hints - 1]}</p>
                    )}
                  </div>
                </>
              )}
              {s.phase === 'compare' && (
                <div className={styles.feedback} role="status">
                  <h3>Review the image evidence</h3>
                  {sameLumen ? (
                    <>
                      <p>
                        {markPlaced
                          ? 'Your mark shows the lumen you chose'
                          : 'You recorded that the lumen was unresolved'}{' '}
                        on slice {slot.slice}. Switch between the two slices below, then browse the
                        intervening CT slices. Can you keep the same airway in view throughout?
                      </p>
                      <div className={styles.walkthroughControls}>
                        <button
                          aria-pressed={viewSlice === exercise.trace.anchor.slice}
                          onClick={() => goToSlice(exercise.trace.anchor.slice)}
                        >
                          Starting slice {exercise.trace.anchor.slice}
                        </button>
                        <button
                          aria-pressed={viewSlice === slot.slice}
                          onClick={() => goToSlice(slot.slice)}
                        >
                          My response · slice {slot.slice}
                        </button>
                      </div>
                      {authoredInterval && <p>{lesson.interpretation}</p>}
                      <p>
                        {lastExercise
                          ? 'Continue when ready.'
                          : `Next, repeat this on ${exercises[s.exercise + 1].trace.anchor.airway.name}.`}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className={styles.walkthroughControls}>
                        {exercise.answerPoints.map((p, i) => (
                          <button
                            key={i}
                            aria-pressed={s.slot === i}
                            onClick={() => act({ type: 'slot', index: i })}
                          >
                            Compare {p.label} · slice {p.slice}
                          </button>
                        ))}
                      </div>
                      <JunctionFeedback
                        key={`${exercise.id}.${attempts.length}`}
                        exercise={exercise}
                        marks={reviewAttempt !== null ? attempts[reviewAttempt].marks : s.marks}
                        packet={junctionFeedbackPacket(exercise.spec.checkpointId)}
                        onGoToSlice={(slice) => {
                          setPlaying(false)
                          goToSlice(slice)
                        }}
                      />
                      {s.course && (
                        <>
                          <h3>Your recorded course and the source levels</h3>
                          <CtCourseFeedback value={s.course} checkpoint={point} />
                        </>
                      )}
                      {exercise.spec.kind === 'integration' && (
                        <>
                          <h3>Your continuation and the model reference route</h3>
                          <CtContinuationFeedback
                            checkpoint={point}
                            choice={s.branch}
                            onGoToSlice={(slice) => {
                              setPlaying(false)
                              goToSlice(slice)
                            }}
                          />
                        </>
                      )}
                      <p>{exercise.explanation}</p>
                    </>
                  )}
                  {exercise.spec.kind === 'pattern' && s.exercise === 0 && (
                    <>
                      <h3>Reading this pattern</h3>
                      <p>{lesson.interpretation}</p>
                    </>
                  )}
                  <p>
                    ○ cyan rings are your marks · ＋ gold crosshairs are model locations. No
                    automatic accuracy verdict is assigned.
                  </p>
                  <button onClick={() => act({ type: 'retry' })}>
                    {sameLumen ? 'Try this lumen again' : 'Redo branch marks (optional)'}
                  </button>
                </div>
              )}
              {s.phase === 'compare' && !sameLumen && (
                <details>
                  <summary>Replay CT walkthrough (optional)</summary>
                  {walkthrough}
                </details>
              )}
              {s.phase === 'parent-view' && (
                <>
                  <CtParentMap
                    trace={exercise.trace}
                    labels={!independentParent || s.viewAnswer !== null || labelsShown}
                    ctLabels={exercise.answerPoints.map((p) => p.label)}
                    choice={s.viewAnswer}
                    onChoose={
                      independentParent && s.viewAnswer === null && !labelsShown
                        ? (value) => act({ type: 'view-answer', value })
                        : undefined
                    }
                  />
                  {independentParent && s.viewAnswer === null && !labelsShown && (
                    <button onClick={() => setLabelsFor(exercise.id)}>Show the labels</button>
                  )}
                  {independentParent && (s.viewAnswer !== null || labelsShown) && (
                    <p role="status">
                      {s.viewAnswer !== null
                        ? 'Your choice stays marked on the diagram.'
                        : 'Labels shown without choosing an opening.'}{' '}
                      The labels show the model relationship; open the parent airway view for an
                      optional comparison. This schematic does not validate clinical opening
                      positions.
                    </p>
                  )}
                </>
              )}
              {complete && (
                <>
                  <p>
                    {checkedCount === exercises.length
                      ? `You checked your marks on all ${exercises.length} ${exercises.length === 1 ? 'example' : 'examples'}.`
                      : checkedCount > 0
                        ? `You checked your marks on ${checkedCount} of ${exercises.length} examples and moved past the others without marking.`
                        : 'You moved through the examples without checking marks, so none are recorded.'}{' '}
                    These examples come from one patient CT.
                  </p>
                  <p>
                    Different regions or repeated bifurcations in this scan do not establish
                    performance on an unfamiliar patient.
                  </p>
                  <p role="status">
                    {reviewed
                      ? 'Marked reviewed on this device — a note for finding your place, not a result.'
                      : 'Not marked reviewed.'}{' '}
                    <button onClick={() => setLessonReviewed(lesson.id, !reviewed)}>
                      {reviewed ? 'Undo reviewed' : 'Mark reviewed'}
                    </button>
                  </p>
                </>
              )}
              {attempts.length > 0 && (
                <details>
                  <summary>Your checked marks on this example · {attempts.length}</summary>
                  {attempts.map((attempt, i) => (
                    <div key={i}>
                      <strong>Check {i + 1}</strong>
                      <p>
                        {attempt.marks.filter((m) => m.pixel === null).length} unresolved{' '}
                        {attempt.marks.filter((m) => m.pixel === null).length === 1
                          ? 'response'
                          : 'responses'}
                      </p>
                      <button
                        onClick={() => {
                          setPlaying(false)
                          setReviewAttempt(i)
                          goToSlice(attempt.marks[s.slot].slice)
                        }}
                      >
                        Inspect these marks
                      </button>
                      <p>
                        {attempt.marks
                          .map(
                            (m, j) =>
                              `${exercise.answerPoints[j].label}: ${m.pixel ? `(${m.pixel.map((p) => p.toFixed(1)).join(', ')})` : 'unresolved'}`,
                          )
                          .join(' · ')}
                      </p>
                    </div>
                  ))}
                </details>
              )}
              {!authoredInterval && (
                <details>
                  <summary>Earlier teaching and regional worked example</summary>
                  <p>{lesson.worked}</p>
                  <p>{lesson.interpretation}</p>
                  <p>{lesson.sourcePages}</p>
                </details>
              )}
              <details>
                <summary>Full-route rehearsal and source limits</summary>
                <Link href={`${BASE_PATH}/practice`}>Open full-route practice</Link>
                <p>
                  {exercise.review.status === 'provisional'
                    ? exercise.review.reason
                    : `Reviewed by ${exercise.review.reviewer}, ${exercise.review.date}`}
                </p>
                <p>
                  Educational spatial reasoning only. This activity does not establish instrument
                  reach, tool-in-lesion or procedural competence.
                </p>
              </details>
            </>
          )}
        </section>
        <div
          ref={imageWorkspaceRef}
          className={styles.localImageWorkspace}
          data-warmup={sameLumen || undefined}
        >
          {guide === 'direction' || guide === 'compare' ? (
            <CtViewpointComparison
              trace={exercise.trace}
              view={{
                ...(s.views[exercise.id] ?? {
                  focus: 'start',
                  full: false,
                  magnification: 1,
                  showNodule: false,
                  showScope: false,
                }),
                slice: exercise.trace.anchor.slice,
              }}
              marks={s.marks}
              orientation={s.orientation}
              onReadyChange={setImageReady}
            />
          ) : (
            <NativeCtViewer
              key={`${exercise.id}.${viewerEpoch}`}
              trace={exercise.trace}
              marks={
                reviewAttempt !== null && s.phase === 'compare'
                  ? attempts[reviewAttempt].marks
                  : s.marks
              }
              active={0}
              local
              orientationControls={!guide && !sameLumen}
              highlightRegion={s.phase === 'attempt' && s.hints > 0 && s.hints < 3}
              showAnchor={showAnchor}
              answerSlice={s.phase === 'parent-view' ? exercise.answerPoints[0].slice : slot.slice}
              sliceRequest={request}
              teachingFrame={frame}
              annotationReview={exercise.review}
              demonstrate={s.phase === 'demo'}
              scopeAvailable={
                !guide &&
                s.phase === 'parent-view' &&
                (!independentParent || s.viewAnswer !== null || labelsShown)
              }
              onMark={
                !guide && s.phase === 'attempt' ? (mark) => act({ type: 'mark', mark }) : undefined
              }
              orientation={s.orientation}
              onOrientation={(value) => act({ type: 'orientation', value })}
              initialView={s.views[exercise.id]}
              onViewChange={onViewChange}
              onReadyChange={setImageReady}
              onDisplayedSliceChange={setDisplayedSlice}
              markLabels={
                sameLumen
                  ? ['Your mark']
                  : exercise.answerPoints.map((p) => `Your mark ${p.label.split(' · ')[0]}`)
              }
              focusRequest={focusRequest}
              belowImage={
                showingWalkthrough && s.phase !== 'compare' ? walkthroughTransport : undefined
              }
            />
          )}
          {!guide && (
            // Kept for the whole exercise, with Reset attempt holding its place
            // outside the marking step: checking an answer must not shorten this
            // column and slide the CT the learner is inspecting.
            <div className={styles.workspaceTools} role="group" aria-label="Exercise tools">
              {!sameLumen && (
                <button onClick={() => act({ type: 'explain-orientation' })}>
                  Compare the regional display convention
                </button>
              )}
              <button
                className={s.phase === 'attempt' ? undefined : styles.reservedControl}
                aria-hidden={s.phase === 'attempt' ? undefined : true}
                tabIndex={s.phase === 'attempt' ? undefined : -1}
                disabled={s.phase !== 'attempt'}
                onClick={() => act({ type: 'reset-attempt' })}
              >
                Reset attempt
              </button>
            </div>
          )}
          <p className={styles.referenceNotice}>
            {MODEL_REFERENCE_LABEL}. No reviewed wall contours or distractor verdicts are supplied
            for this interval.
          </p>
        </div>
        {exercise.spec.kind === 'integration' && (
          <div className={styles.localRouteMap}>
            <CtLocalRouteMap exercises={exercises} history={s.history} active={s.exercise} />
          </div>
        )}
      </div>
      <HelpDialog open={help} onClose={() => setHelp(false)} returnFocusTo={helpRef}>
        <p>{lesson.minutes} min · One teaching CT · self-paced, nothing is scored</p>
        <p>
          {loaded.notice ||
            'A draft of your marks and CT view saves on this device so you can pick up where you left off.'}
        </p>
        <p>
          <strong>{title}</strong> · {exercise.trace.anchor.airway.code}
        </p>
        <p>{taskInstruction}</p>
        <p>
          Slice controls browse the CT. Go to response slice restores the marking frame. Show
          reference displays the model locations without placing a mark. Check my tracing opens the
          comparison with your marks; it does not grade anatomical accuracy. Continue without
          marking moves on and records nothing for that example.
        </p>
        <p>
          Beside the image: Magnify enlarges the native pixels without adding resolution, Hide
          overlays clears the rings, crosshairs and labels and restores them at once, and Wheel
          steps slices is off until you turn it on, so an ordinary scroll moves the page. Checking
          an answer keeps the crop, magnification and scroll position you set.
        </p>
        <p>
          Help does not reset your marks.
          {s.phase === 'attempt' &&
            !attemptReady &&
            ' Show reference, Focus CT view and Return to the parent are in the task instructions.'}
        </p>
      </HelpDialog>
      <HelpDialog
        open={restartAsk}
        onClose={() => setRestartAsk(false)}
        title="Restart this lesson?"
      >
        <p>Restarting would discard:</p>
        <ul>
          {discards.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Kept either way: the marks you have already checked
          {attempts.length || checkedCount
            ? ` (${checkedCount} of ${exercises.length} ${exercises.length === 1 ? 'example' : 'examples'} checked so far)`
            : ''}
          , whether this lesson is marked reviewed, and every other lesson&rsquo;s draft. Nothing
          else in this browser is cleared.
        </p>
        <div className={styles.walkthroughControls}>
          <button onClick={() => act({ type: 'restart' })}>Restart the lesson</button>
          <button onClick={() => setRestartAsk(false)}>Cancel, keep my work</button>
        </div>
      </HelpDialog>
      <HelpDialog
        open={exitWarning}
        onClose={() => setExitWarning(false)}
        title="This draft could not be saved"
      >
        <p>
          Leaving now will lose changes since the last successful save. Keep working here, or leave
          without saving.
        </p>
        <button onClick={() => router.push(BASE_PATH)}>Leave without saving</button>
      </HelpDialog>
    </LessonShell>
  )
}
