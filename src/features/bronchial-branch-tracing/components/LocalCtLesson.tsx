'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import type { CtLesson, CtViewerState, LocalCtExercise } from '../content/ct-types'
import { BASE_PATH, LESSONS, SOURCE, lessonAfter, ORIENTATION_CONTRACT } from '../content/lessons'
import { parentViewTask } from '../content/local-teaching'
import { CtViewpointComparison } from './CtViewpointComparison'
import { JunctionFeedback } from './JunctionFeedback'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { CourseOutline } from './CourseOutline'
import { LOCAL_DRAFT_ALIASES } from '../engine/local-draft-migration'
import {
  orientationName,
  sameOrientation,
  STANDARD_ORIENTATION,
  type CtOrientation,
} from '../geometry/orientation'
import { pairedScope } from '../geometry/paired-scope'
import { divisionIdentities, sourceNamingNote } from '../engine/branch-identity'
import {
  courseLocatorNote,
  demonstrationFrameIndex,
  modelCourseLocators,
} from '../engine/model-course'
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
import { CourseReference } from './CourseReference'
import { DivisionPrimer } from './DivisionPrimer'
import {
  REGIONAL_NOTES,
  NAMING_KEY,
  NAMING_USE,
  SLICE_DIRECTION_NOTE,
  lessonHref,
  lessonNumber,
  patternFor,
} from '../content/course-guide'
import { targetForTrace } from '../geometry/native-ct'
import { displayName } from '../engine/display-text'
import { resetPaneScroll } from './resetPaneScroll'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import styles from './branch-tracing.module.css'

/**
 * The reference's own display (PR #273 final repair). While a worked walkthrough, Show reference or
 * the comparison is on screen, whatever the learner does to that CT (plane, crop focus, Full CT
 * field, magnification, paired parent view, flip, rotation) changes this envelope and nothing else.
 * It opens from the display on screen, which is the learner's own, is never written to the draft,
 * and is discarded when the reference closes, when the viewer is handed the learner's saved view back.
 */
interface ReferenceDisplay {
  /** The viewer instance it belongs to: a new example or a restart opens a new envelope. */
  viewer: string
  orientation: CtOrientation
  view?: CtViewerState
}

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
  const currentTaskRef = useRef<HTMLDivElement>(null)
  const instructionsRef = useRef<HTMLElement>(null)
  const previousTask = useRef<string | null>(null)
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
  // Opens the paired parent view for a teaching moment; the learner's own toggle still rules.
  const [scopeRequest, setScopeRequest] = useState<{ show: boolean; serial: number }>()
  const [displayedSlice, setDisplayedSlice] = useState<number | null>(null)
  // Reference viewing (PR #273 review, finding 3). The demonstration cursor, and any CT movement made
  // while a worked walkthrough, a reference or the comparison is on screen, live in component state.
  // The draft keeps the learner's own position; its stored `frame` changes only with lesson
  // transitions (begin, next example, restart), never because a reference was stepped. An older
  // draft's frame is still read as the starting cursor.
  const [demoFrame, setDemoFrame] = useState(() => loaded.value?.frame ?? 0)
  // The plane the viewer is showing now, which a reference may have moved; the draft's stored
  // slice is the learner's own position and can differ from it.
  const [liveSlice, setLiveSlice] = useState<number | null>(null)
  const referenceViewing = useRef(false)
  const currentFrames = useRef<LocalCtExercise['frames']>([])
  // The display a reference is shown in; null while the learner's own display is on screen.
  const [referenceDisplay, setReferenceDisplay] = useState<ReferenceDisplay | null>(null)
  // Bumped each time a reference closes. The viewer is handed the learner's saved view back with
  // this serial and stamps every later report with it, so a report stamped with an earlier serial
  // was made on a reference's display and is never saved as the learner's.
  const [learnerViewSerial, setLearnerViewSerial] = useState(0)
  const reportSerial = useRef(0)
  const exercise = exercises[s.exercise]
  const point = exercise.trace.checkpoints[0]
  const slot = exercise.answerPoints[s.slot]
  // Neutral Parent / Daughter A / Daughter B identities for display. The stored answer labels,
  // marks and draft signature keep their own form; nothing below rewrites them.
  const identities = divisionIdentities(point)
  const displayLabel = (index: number) =>
    identities?.daughters[index]?.display ?? exercise.answerPoints[index].label
  // The fixed parent camera at the introductory plane, shown beside the two CT copies (BBTF-04).
  const comparisonScope = useMemo(
    () => ({
      ...pairedScope(exercise.trace, exercise.trace.anchor.slice, 0, true),
      airwayCode: exercise.trace.anchor.airway.code,
    }),
    [exercise],
  )
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
  // Learn ends in Practice, which stays optional (BBTF-48).
  const nextDestination = nextLesson
    ? `${BASE_PATH}/learn?lesson=${nextLesson.id}`
    : `${BASE_PATH}/practice`
  // An example of a division an earlier example already traced is an optional revisit, not a new
  // case (BBTF-41). Later examples open straight into the try; only the first has a demonstration.
  const revisitOf = exercises.findIndex(
    (e, i) => i < s.exercise && e.spec.checkpointId === exercise.spec.checkpointId,
  )
  const revisit = revisitOf >= 0
  const demonstrated = s.exercise === 0
  const pattern = patternFor(lesson.id)
  const regionalNote = REGIONAL_NOTES[lesson.id]
  const target = targetForTrace(exercise.trace)
  // Worked example, try and comparison are named apart (BBTF-02); none of them records a mark.
  const mode = guide
    ? 'Display comparison'
    : s.phase === 'demo'
      ? 'Worked example'
      : s.phase === 'attempt'
        ? 'Try tracing'
        : s.phase === 'compare'
          ? 'Compare with reference'
          : s.phase === 'parent-view'
            ? 'Parent view'
            : 'Lesson finished'
  const showingWalkthrough =
    !guide &&
    (s.phase === 'demo' ||
      s.phase === 'compare' ||
      (s.phase === 'attempt' && (referenceShown || (s.hints === 3 && !attemptReady))))
  const complete = s.phase === 'complete'
  // The reference's display opens and closes with the walkthrough itself. Adjusting it during render
  // means no committed frame pairs reference viewing with the learner's display or the reverse.
  const referenceViewer = showingWalkthrough ? `${exercise.id}.${viewerEpoch}` : null
  if ((referenceDisplay?.viewer ?? null) !== referenceViewer) {
    if (referenceDisplay) setLearnerViewSerial((serial) => serial + 1)
    setReferenceDisplay(
      referenceViewer
        ? { viewer: referenceViewer, orientation: s.orientation, view: s.views[exercise.id] }
        : null,
    )
  }
  // Read by onViewChange, which must keep one identity: the viewer re-reports its state whenever
  // that callback changes, which would save a reference position as the learner's own.
  useLayoutEffect(() => {
    referenceViewing.current = showingWalkthrough
    reportSerial.current = learnerViewSerial
    currentFrames.current = exercise.frames
  })
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
        ? '1. Worked example: watch this division'
        : s.phase === 'attempt'
          ? attemptReady
            ? '2. Branch responses ready to review'
            : s.marks[s.slot]
              ? `2. ${displayLabel(s.slot)} placed`
              : `2. Mark ${displayLabel(s.slot)}`
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
  /** Step the worked walkthrough: reference viewing, so component state only. */
  function showFrame(index: number) {
    if (index < 0 || index >= exercise.frames.length) return
    setDemoFrame(index)
    goToSlice(exercise.frames[index].slice)
  }
  function act(action: LocalAction) {
    const next = localSessionReducer(exercises, s, action)
    if (next === s) return s
    if (
      next.phase !== s.phase &&
      next.exercise === s.exercise &&
      next.orientationGuide === s.orientationGuide &&
      currentTaskRef.current
    ) {
      // A shorter phase summary must not pull the CT upward in document flow.
      // Reserve the space already occupied; longer feedback can still grow naturally.
      const task = currentTaskRef.current
      task.style.minBlockSize = `${task.getBoundingClientRect().height}px`
    }
    // Reaching the end marks the lesson reviewed on this device; nothing about the marks is stored.
    if (next.phase === 'complete' && !complete) setLessonReviewed(lesson.id, true)
    if (action.type === 'begin' || action.type === 'restart' || next.exercise !== s.exercise)
      setDemoFrame(0)
    if (action.type === 'restart' || next.exercise !== s.exercise) setLiveSlice(null)
    if (action.type === 'slot') {
      setPlaying(false)
      goToSlice(exercise.answerPoints[next.slot].slice)
    }
    if (action.type === 'restart') {
      setViewerEpoch((v) => v + 1)
      setRestarted(true)
      setRestartAsk(false)
    }
    // Relating the parent view, and the viewpoint lesson's own exercise, are the moments the
    // pairing teaches: open the parent airway view beside the CT. The learner's toggle still rules
    // afterwards and is kept in the saved view state.
    if (
      (next.phase === 'parent-view' && s.phase !== 'parent-view') ||
      (action.type === 'finish-orientation' && (next.phase === 'parent-view' || viewpoint))
    )
      setScopeRequest((r) => ({ show: true, serial: (r?.serial ?? 0) + 1 }))
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
    (view: CtViewerState, serial?: number) => {
      // Made before the viewer took the learner's view back, so it shows a reference's display. It
      // can arrive after the reference has closed (a display change and the close in one batch), so
      // it is dropped, never routed by whichever mode is on now.
      if (serial !== reportSerial.current) return
      // Browsing to another plane moves the demonstration to the occurrence nearest the step
      // the learner is on, so leaving a pass and returning cannot rewind them into an earlier one.
      setLiveSlice(view.slice)
      setDemoFrame((current) => {
        const matched = demonstrationFrameIndex(currentFrames.current, current, view.slice)
        return matched < 0 ? current : matched
      })
      // A reference's plane, crop, full field, magnification and paired view are the reference's
      // own; none of them is the learner's, so none reaches the draft.
      if (referenceViewing.current) {
        setReferenceDisplay((current) => current && { ...current, view })
        return
      }
      setSession((current) => {
        const key = exercises[current.exercise].id
        return JSON.stringify(current.views[key]) === JSON.stringify(view)
          ? current
          : { ...current, views: { ...current.views, [key]: view } }
      })
    },
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
    // Feedback updates this pane without making the surrounding workspace a new task.
    resetPaneScroll(pane)
  }, [guide, exercise.id, s.phase])
  useLayoutEffect(() => {
    // A new task owns its own natural footprint; no previous task's space is carried over.
    if (currentTaskRef.current) currentTaskRef.current.style.minBlockSize = ''
  }, [guide, exercise.id])
  useEffect(() => {
    const pane = instructionsRef.current
    const task = `${guide}:${exercise.id}`
    const changed = previousTask.current !== null && previousTask.current !== task
    previousTask.current = task
    // Only entering another guide/exercise positions the document. A phase change
    // within this task must leave the learner's CT inspection where it is.
    if (changed && pane && getComputedStyle(pane).overflowY === 'visible')
      workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [guide, exercise.id])
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
      if (demoFrame === exercise.frames.length - 1) {
        setPlaying(false)
        return
      }
      const frame = demoFrame + 1
      setDemoFrame(frame)
      setRequest((r) => ({ slice: exercise.frames[frame].slice, serial: (r?.serial ?? 0) + 1 }))
    }, 900)
    return () => window.clearTimeout(timer)
  }, [playing, imageReady, showingWalkthrough, demoFrame, exercise])
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
            ? `Mark ${displayLabel(nextMarkSlot)}`
            : 'Check my tracing'
        : s.phase === 'compare' && parentRequired
          ? independentParent
            ? 'Continue to branch matching'
            : 'Study the parent view'
          : lastExercise
            ? sameLumen
              ? nextLesson
                ? `Next lesson: ${nextLesson.title}`
                : 'Continue to Practice'
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
      : 'Continue to Practice'
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
        ? `You finished the ${exercises.length} examples. ${nextLesson ? `Continue to ${nextLesson.title}.` : 'Practice is the suggested next step; every lesson stays open.'}`
        : s.phase === 'parent-view'
          ? !independentParent
            ? 'The labels show how this same division projects into the declared parent view. Follow each CT daughter to its schematic opening; this is guided application.'
            : s.viewAnswer === null && !labelsShown
              ? `Which numbered opening in the diagram matches CT branch ${displayLabel(0)}? Choose an opening, or select Show the labels. You can continue at any point.`
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
                  ? `Your ${displayLabel(s.slot)} ${s.marks[s.slot]?.pixel ? 'mark' : 'uncertainty response'} is placed. Next, mark ${displayLabel(nextMarkSlot)} on slice ${exercise.answerPoints[nextMarkSlot].slice}.`
                  : missingSlot < 0
                    ? needsCourse
                      ? 'Your branch marks are placed. Choose the Airway course below, then select Check my tracing.'
                      : 'Your branch marks are placed. Choose which branch to follow below, then select Check my tracing.'
                    : `Trace ${displayLabel(s.slot)} from ${identities?.parent.display ?? exercise.trace.anchor.airway.code} to slice ${slot.slice}, then click inside its lumen. You can also record Lumen unresolved here, show the reference, or continue without marking.`
  const learnerView = s.views[exercise.id]
  // The learner's saved view, handed back to the viewer whenever a reference closes.
  const viewRequest = useMemo(
    () => ({ view: learnerView, serial: learnerViewSerial }),
    [learnerView, learnerViewSerial],
  )
  // What the viewer opens with if it mounts: the open reference's display, else the learner's.
  const displayView = referenceDisplay ? referenceDisplay.view : learnerView
  // Model points appear in the demonstration, the comparison, and whenever the learner shows the reference.
  const viewSlice = liveSlice ?? learnerView?.slice ?? exercise.trace.anchor.slice
  // A plane is demonstrated once per daughter pass, so the step the learner is on is the frame
  // index and never the slice number: resolving either the overlays or the caption by slice
  // alone hands a later pass the first pass's branch identity.
  const frameIndex = showingWalkthrough
    ? demonstrationFrameIndex(exercise.frames, demoFrame, viewSlice)
    : -1
  const frame = frameIndex < 0 ? undefined : exercise.frames[frameIndex]
  const showAnchor = Boolean(guide) || (s.phase === 'attempt' && s.hints < 3 && !referenceShown)
  const displayedFrameIndex = demonstrationFrameIndex(exercise.frames, demoFrame, displayedSlice)
  const displayedFrame = displayedFrameIndex < 0 ? undefined : exercise.frames[displayedFrameIndex]
  // Model course locators for the demonstration's intermediate planes (BBTF-26): only where a
  // source edge of this division crosses the displayed plane, drawn dotted and unlabelled.
  const courseLocators = useMemo(
    () =>
      frameIndex < 0
        ? []
        : modelCourseLocators(exercise, frameIndex).map((l) => ({
            id: l.id,
            pixel: l.pixel,
            ariaLabel: `Model course locator: ${l.roleLabel} · ${l.code}, centreline crossing on slice ${l.slice}; provisional model position, not a lumen boundary`,
          })),
    [exercise, frameIndex],
  )
  const displayedCourseNote =
    displayedFrameIndex >= 0
      ? courseLocatorNote(modelCourseLocators(exercise, displayedFrameIndex))
      : null
  // Opening letters in the paired view follow the same rule as the model locators on the CT:
  // shown in the worked demonstration, the comparison and the parent view; in the attempt only
  // once the learner asks for the reference; never while a matching try is still open.
  const scopeLabels =
    !guide &&
    (s.phase === 'demo' ||
      s.phase === 'compare' ||
      complete ||
      (s.phase === 'attempt' && referenceShown) ||
      (s.phase === 'parent-view' && (!independentParent || s.viewAnswer !== null || labelsShown)))
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
            if (!playing) goToSlice(exercise.frames[demoFrame].slice)
            setPlaying((v) => !v)
          }}
        >
          {playing ? 'Pause walkthrough' : 'Play walkthrough'}
        </button>
        <button
          disabled={demoFrame === 0}
          onClick={() => {
            setPlaying(false)
            showFrame(demoFrame - 1)
          }}
        >
          Previous demonstration slice
        </button>
        <button
          disabled={demoFrame === exercise.frames.length - 1}
          onClick={() => {
            setPlaying(false)
            showFrame(demoFrame + 1)
          }}
        >
          Next demonstration slice
        </button>
        <button
          onClick={() => {
            setPlaying(false)
            showFrame(0)
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
        {displayedCourseNote ? ` ${displayedCourseNote}` : ''}
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
          ref={currentTaskRef}
          className={styles.currentTask}
          data-current-task
          data-response-ready={attemptReady}
          aria-live="polite"
        >
          <NowCard
            model={{
              kicker: `${mode} · ${revisit ? 'Optional revisit · ' : ''}${viewpoint ? 'Viewpoint application · airway' : sameLumen ? 'Same-lumen interval' : 'Example'} ${s.exercise + 1} of ${exercises.length} · ${exercise.trace.anchor.airway.code}`,
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
              {viewpoint && (
                <CourseReference
                  parts={['terms']}
                  summary="Terms used here: parent airway view, parent viewpoint, camera roll (optional)"
                />
              )}
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
              {s.phase === 'demo' && !sameLumen && (
                <p className={styles.modeNote} data-mode="worked">
                  <strong>Worked example.</strong> The model reference is shown while the interval
                  plays. Nothing is recorded; your own try follows with a clean view.
                </p>
              )}
              {s.phase === 'attempt' && !sameLumen && (
                <div className={styles.modeNote} data-mode="try">
                  <p>
                    <strong>Try tracing.</strong>{' '}
                    {revisit
                      ? `Optional revisit: the same ${exercise.trace.anchor.airway.code} division as example ${revisitOf + 1}, traced here into its other daughter. It is not a new case; continue without marking if example ${revisitOf + 1} was enough.`
                      : demonstrated
                        ? 'A clean view of the example you just watched. Show reference brings the model reference back at any time and records nothing. Marking an example you have just watched is guided practice on it, not an independent test.'
                        : 'This example opens without a demonstration. Watch its worked walkthrough first, or start from the parent; both are optional and record nothing.'}
                  </p>
                  <p className={styles.revisitControls}>
                    <button
                      onClick={() => {
                        // The same transient reference state as Show reference: nothing recorded.
                        setPlaying(false)
                        setReferenceFor(stepKey)
                        showFrame(0)
                      }}
                    >
                      {demonstrated
                        ? 'Replay the worked walkthrough'
                        : 'Watch a worked walkthrough'}
                    </button>
                    <button onClick={() => goToSlice(exercise.trace.anchor.slice)}>
                      Start from the parent · slice {exercise.trace.anchor.slice}
                    </button>
                  </p>
                  <details>
                    <summary>Before you mark: levels and what decides identity</summary>
                    <DivisionPrimer exercise={exercise} packet={packet} lessonId={lesson.id} />
                  </details>
                </div>
              )}
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
                  <p data-slice-direction>{SLICE_DIRECTION_NOTE}</p>
                  {checklist}
                  <p className={styles.small} data-naming-key>
                    <strong>Naming:</strong> {NAMING_KEY} {NAMING_USE}
                  </p>
                </div>
              )}
              {authoredInterval && s.phase === 'demo' && (
                <CourseReference summary="Course reference: naming, the four patterns and key terms (optional)" />
              )}
              {viewpoint && s.phase !== 'complete' && (
                <p data-viewpoint-framing>
                  Same airway, different display: this is the tracheal interval from Lesson{' '}
                  {lessonNumber('follow-one-airway')}, now traced in the display you chose, with the
                  parent airway view beside the CT. The task stays the same on purpose, so the only
                  things that change are the display and the viewpoint.
                </p>
              )}
              {exercise.spec.kind === 'integration' && s.parentConfirmed && (
                <p data-route-target={target.segment.code}>
                  Supplied starting parent: {exercises[0].trace.anchor.airway.code}. Target: the
                  simulated nodule in {target.segment.code} ({target.segment.name.toLowerCase()}),
                  which the source places at the end of {target.approachCode}. Compare the CT
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
              {identities && !sameLumen && ['demo', 'attempt'].includes(s.phase) && (
                <section
                  className={styles.branchIdentities}
                  aria-label="Branch identities on this CT"
                  data-branch-identities={exercise.spec.checkpointId}
                >
                  <h3>Branch identities on this CT</h3>
                  <ul>
                    <li>
                      {identities.parent.display} · {displayName(identities.parent.name)} · parent
                      point on slice {identities.parent.slice}
                    </li>
                    {identities.daughters.map((d) => (
                      <li key={d.sourceEdgeId}>
                        {d.display}
                        {d.repeatedName ? '' : ` (source label “${d.direction.toLowerCase()}”)`} ·
                        response slice {d.slice}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.small}>{sourceNamingNote(identities)}</p>
                </section>
              )}
              {s.phase === 'demo' && !sameLumen && (
                <>
                  {pattern && (
                    <p data-pattern={pattern.name}>
                      <strong>Pattern: {pattern.name.toLowerCase()}.</strong> The four patterns are
                      described together in the course reference below.
                    </p>
                  )}
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
                  <h3>Before you mark</h3>
                  <DivisionPrimer exercise={exercise} packet={packet} lessonId={lesson.id} />
                  <CourseReference
                    parts={
                      pattern ? ['patterns', 'terms', 'naming'] : ['terms', 'naming', 'patterns']
                    }
                    currentLessonId={lesson.id}
                    summary="Course reference: the four patterns, key terms and naming (optional)"
                  />
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
                        {displayLabel(i)} · slice {p.slice}
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
                      Each branch button above jumps straight to that daughter’s response slice. To
                      follow continuity, start from the parent and step through the slices in
                      between; the jump is there when you want it. Place its mark, then follow the
                      next action above. Once all daughter responses are placed, select{' '}
                      <strong>Check my tracing</strong>. If you cannot identify a lumen, choose{' '}
                      <strong>Lumen unresolved here</strong> beside the CT.
                    </p>
                  )}
                  {authoredInterval && s.exercise > 0 && <p>{lesson.transferPrompt}</p>}
                  {authoredInterval && checklist}
                  {['pattern', 'integration'].includes(exercise.spec.kind) && (
                    <>
                      <CtCourseControl
                        value={s.course}
                        onChange={(value) => act({ type: 'course', value })}
                      />
                      <p className={styles.small}>
                        Record the course you traced. The worked example’s captions describe the
                        model’s course; after you check, the source levels are shown beside your
                        choice.
                      </p>
                    </>
                  )}
                  {exercise.spec.kind === 'integration' && (
                    <fieldset>
                      <legend>
                        Which daughter would you follow toward the simulated nodule in{' '}
                        {target.segment.code} ({target.segment.name.toLowerCase()})?
                      </legend>
                      <p className={styles.small}>
                        The source places this target at the end of {target.approachCode}.
                        {identities?.anyRepeatedName
                          ? ` Both daughters here carry the source name ${identities.daughters[0].code}; their direction words tell them apart.`
                          : ''}
                      </p>
                      {point.decision?.options.map((option, i) => (
                        <label className={styles.localOption} key={option.sourceEdgeId}>
                          <input
                            type="radio"
                            name="continuation"
                            checked={s.branch === option.sourceEdgeId}
                            onChange={() => act({ type: 'branch', value: option.sourceEdgeId })}
                          />
                          {displayLabel(i)}
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
                      {viewpoint && (
                        <p data-optional-reflection>
                          <strong>Optional reflection, not recorded:</strong> which direction
                          letters moved when you changed the display, and did the parent airway view
                          beside the CT change?{' '}
                          <strong>Compare the regional display convention</strong> below the CT
                          shows the Changed and Unchanged list again; your mark is kept.
                        </p>
                      )}
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
                            Compare {displayLabel(i)} · slice {p.slice}
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
              {identities && !sameLumen && !complete && s.phase !== 'parent-view' && (
                <details data-parent-schematic>
                  <summary>Model parent view schematic (optional)</summary>
                  <p className={styles.small}>
                    How this division’s daughters sit when looked at from {identities.parent.code},
                    in the same fixed camera as the paired parent airway view beside the CT.
                  </p>
                  <CtParentMap
                    trace={exercise.trace}
                    labels={!independentParent || s.viewAnswer !== null || labelsShown}
                  />
                </details>
              )}
              {s.phase === 'parent-view' && (
                <>
                  <CtParentMap
                    trace={exercise.trace}
                    labels={!independentParent || s.viewAnswer !== null || labelsShown}
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
                              `${displayLabel(j)}: ${m.pixel ? `(${m.pixel.map((p) => p.toFixed(1)).join(', ')})` : 'unresolved'}`,
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
                  {regionalNote && (
                    <div data-regional-note={regionalNote.region}>
                      <h3>{regionalNote.heading}</h3>
                      <p>{regionalNote.text}</p>
                      <p className={styles.small}>
                        The left upper division is traced in{' '}
                        <Link href={lessonHref(regionalNote.seeLesson)}>
                          Lesson {lessonNumber(regionalNote.seeLesson)}
                        </Link>
                        ’s second example.
                      </p>
                    </div>
                  )}
                  <p>{lesson.sourcePages}</p>
                </details>
              )}
              <details>
                <summary>Optional: full-route Practice and source limits</summary>
                <p>
                  <Link href={`${BASE_PATH}/practice`}>Open full-route Practice (optional)</Link>.
                  Practice is open whenever you want it.{' '}
                  {nextLesson
                    ? `The suggested path continues with Lesson ${lessonNumber(nextLesson.id)}: ${nextLesson.title}.`
                    : 'It is the suggested next step after this lesson.'}
                </p>
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
              scope={comparisonScope}
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
              scopeAvailable={!guide || guide === 'context'}
              scopeLabels={scopeLabels}
              scopeDefault={viewpoint}
              scopeRequest={scopeRequest}
              courseLocators={courseLocators}
              onMark={
                !guide && s.phase === 'attempt' ? (mark) => act({ type: 'mark', mark }) : undefined
              }
              orientation={referenceDisplay ? referenceDisplay.orientation : s.orientation}
              onOrientation={(value) =>
                // Flipping or rotating a reference turns the reference's display only.
                referenceDisplay
                  ? setReferenceDisplay((current) => current && { ...current, orientation: value })
                  : act({ type: 'orientation', value })
              }
              initialView={
                // A viewer that mounts during a paired teaching moment opens paired; a saved
                // preference to hide the view is honoured again as soon as the learner toggles it.
                displayView && (s.phase === 'parent-view' || viewpoint)
                  ? { ...displayView, showScope: true }
                  : displayView
              }
              viewRequest={viewRequest}
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
              {(!sameLumen || viewpoint) && (
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
            Gold crosshairs are model reference points, not yet faculty reviewed; this interval has
            no reviewed wall outlines.
          </p>
        </div>
        {exercise.spec.kind === 'integration' && (
          <div className={styles.localRouteMap}>
            <CtLocalRouteMap exercises={exercises} history={s.history} active={s.exercise} />
          </div>
        )}
      </div>
      <HelpDialog open={help} onClose={() => setHelp(false)} returnFocusTo={helpRef}>
        <p>
          About {lesson.minutes} min by the authors’ estimate · One teaching CT · self-paced,
          nothing is scored
        </p>
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
          Show parent airway view opens the model camera beside the CT: it looks along the parent
          airway with a declared roll for this region, follows the model route and records nothing.
          Turning or reflecting the CT never moves it.
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
