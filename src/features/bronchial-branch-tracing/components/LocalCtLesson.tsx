'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import type { CtLesson, CtViewerState } from '../content/ct-types'
import { BASE_PATH, LESSONS, SOURCE } from '../content/lessons'
import { localExercise, MODEL_REFERENCE_LABEL } from '../content/local-exercises'
import { browserStorage, saveCtAttempt, saveVisit } from '../engine/progress'
import { draftSignature, readCtDraft, writeCtDraft } from '../engine/ct-draft'
import {
  emptyLocalSession,
  localReady,
  localSessionReducer,
  parseLocalSession,
  type LocalAction,
} from '../engine/local-session'
import { CT_TARGETS, targetForTrace } from '../geometry/native-ct'
import { TargetCtPreview } from './TargetCtPreview'
import { CtCourseControl } from './CtTraceControls'
import { CtParentMap } from './CtBranchMap'
import { NativeCtViewer } from './NativeCtViewer'
import styles from './branch-tracing.module.css'

export function LocalCtLesson({ lesson }: { lesson: CtLesson }) {
  const router = useRouter()
  const exercises = useMemo(() => lesson.exercises!.map(localExercise), [lesson])
  const signature = useMemo(() => draftSignature([lesson, exercises]), [lesson, exercises])
  const draftKey = `learn.${lesson.id}`
  const [loaded] = useState(() =>
    readCtDraft(browserStorage(), draftKey, signature, (v) => parseLocalSession(v, exercises)),
  )
  const [s, setSession] = useState(() => loaded.value ?? emptyLocalSession(exercises))
  const [saveFailed, setSaveFailed] = useState(false)
  const [help, setHelp] = useState(false)
  const helpRef = useRef<HTMLButtonElement>(null)
  const [exitWarning, setExitWarning] = useState(false)
  const [reviewAttempt, setReviewAttempt] = useState<number | null>(null)
  const [viewerEpoch, setViewerEpoch] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const [request, setRequest] = useState<{ slice: number; serial: number }>()
  const exercise = exercises[s.exercise]
  const point = exercise.trace.checkpoints[0]
  const slot = exercise.answerPoints[s.slot]
  const attempts = s.history[exercise.id] ?? []
  const first = attempts[0]
  const nextLesson = LESSONS[LESSONS.indexOf(lesson) + 1]
  const sameLumen = exercise.spec.kind === 'same-lumen'
  const attemptReady = s.phase === 'attempt' && localReady(s, exercise)
  const markPlaced = sameLumen && Boolean(s.marks[0]?.pixel)
  const lastExercise = s.exercise === exercises.length - 1
  const nextDestination = nextLesson ? `${BASE_PATH}/learn?lesson=${nextLesson.id}` : BASE_PATH
  const showingWalkthrough =
    s.phase === 'demo' ||
    s.phase === 'compare' ||
    (s.phase === 'attempt' && s.hints === 3 && !attemptReady)
  const complete = s.phase === 'complete'
  const locatingParent = exercise.spec.kind === 'integration' && !s.parentConfirmed
  const target = targetForTrace(exercise.trace)
  const title = sameLumen
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
          : 'Warm-up completed'
    : locatingParent
      ? 'Identify the segmental parent'
      : s.phase === 'demo'
        ? 'Watch the CT walkthrough'
        : s.phase === 'attempt'
          ? attemptReady
            ? 'Tracing ready to review'
            : 'Your turn'
          : s.phase === 'compare'
            ? 'Compare and repair'
            : s.phase === 'parent-view'
              ? 'Relate the parent view'
              : 'Local exercises recorded'
  const goToSlice = (slice: number) => setRequest((r) => ({ slice, serial: (r?.serial ?? 0) + 1 }))
  function act(action: LocalAction) {
    const next = localSessionReducer(exercises, s, action)
    if (action.type === 'check' && next.phase === 'compare')
      saveCtAttempt(`learn.${lesson.id}.${exercise.id}`, s.hints)
    if (next.phase === 'complete' && !complete) saveVisit(lesson.id, true)
    if (action.type === 'frame') goToSlice(exercise.frames[next.frame].slice)
    if (action.type === 'slot') {
      setPlaying(false)
      goToSlice(exercise.answerPoints[next.slot].slice)
    }
    if (action.type === 'restart') setViewerEpoch((v) => v + 1)
    if (action.type === 'retry' || action.type === 'next' || action.type === 'restart')
      setReviewAttempt(null)
    if (action.type === 'begin' || action.type === 'retry') goToSlice(exercise.trace.anchor.slice)
    if (action.type === 'check' || action.type === 'parent-view') goToSlice(slot.slice)
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
    saveVisit(lesson.id)
  }, [lesson.id])
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
    if (level === 2) goToSlice(exercise.trace.anchor.slice)
    if (level === 3) {
      goToSlice(exercise.frames[0].slice)
      setSession((v) => ({ ...v, frame: 0 }))
    }
  }
  const canAdvance = locatingParent
    ? Boolean(s.parentChoice)
    : s.phase !== 'attempt' || localReady(s, exercise)
  const primaryLabel = locatingParent
    ? 'Use this starting parent'
    : s.phase === 'demo'
      ? sameLumen
        ? 'Start tracing'
        : 'Your turn'
      : s.phase === 'attempt'
        ? sameLumen
          ? 'Review my mark'
          : 'Check my tracing'
        : s.phase === 'compare' && !sameLumen
          ? 'Relate the parent view'
          : lastExercise
            ? sameLumen
              ? 'Continue to bifurcations'
              : 'Finish lesson'
            : sameLumen
              ? 'Next airway'
              : 'Try another local example'
  const primaryAction = () => {
    const next = act({
      type: locatingParent
        ? 'record-parent'
        : s.phase === 'demo'
          ? 'begin'
          : s.phase === 'attempt'
            ? 'check'
            : s.phase === 'compare' && !sameLumen
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
  const nextActionLabel = complete
    ? sameLumen
      ? 'Continue to bifurcations'
      : nextLesson
        ? `Next lesson: ${nextLesson.title}`
        : 'Return to overview'
    : primaryLabel
  const taskInstruction = sameLumen
    ? complete
      ? 'The next lesson follows a parent airway through its division into daughter branches.'
      : s.phase === 'demo'
        ? `Follow ${exercise.trace.anchor.airway.name} from slice ${exercise.trace.anchor.slice} to slice ${slot.slice}. Then select Start tracing to place your own mark.`
        : s.phase === 'attempt'
          ? attemptReady
            ? `Your ${markPlaced ? 'mark' : 'uncertainty response'} on slice ${slot.slice} is ready. Select Review my mark to compare it with the starting slice.`
            : `Scroll from slice ${exercise.trace.anchor.slice} to ${slot.slice}, keeping the same lumen in view. Click inside it on slice ${slot.slice}, then select Review my mark.`
          : lastExercise
            ? 'Compare the starting slice with your marked slice. Then select Continue to bifurcations to begin the next lesson.'
            : `Compare the starting slice with your marked slice. Then select Next airway to repeat this on ${exercises[s.exercise + 1].trace.anchor.airway.name}.`
    : locatingParent
      ? `Inspect the target region in ${target.segment.code}, then select the segmental bronchus you would start from.`
      : complete
        ? 'Completion records participation and comparison, not tracing competence.'
        : s.phase === 'parent-view'
          ? `Which numbered opening corresponds to CT daughter ${exercise.answerPoints[0].label}? Choose before revealing the matched view.`
          : s.phase === 'demo'
            ? 'Follow the captioned CT walkthrough. Step through the interval, then choose Your turn.'
            : s.phase === 'compare'
              ? 'Compare your marks with the model locations. Review neighboring slices, then retry or relate the parent view.'
              : attemptReady
                ? 'Your responses are ready. Select Check my tracing to review this attempt before continuing.'
                : exercise.task
  // Model points appear only in the demonstration, requested hint, or committed comparison.
  const viewSlice = s.views[exercise.id]?.slice ?? exercise.trace.anchor.slice
  const frame = showingWalkthrough ? exercise.frames.find((f) => f.slice === viewSlice) : undefined
  const showAnchor = s.phase === 'attempt' && s.hints < 3
  return (
    <LessonShell
      section="learn"
      stage={s.phase}
      module="bronchial-branch-tracing"
      label="Local CT tracing lesson"
      header={
        <SectionHeader
          kicker={`Learn · ${LESSONS.indexOf(lesson) + 1} of ${LESSONS.length}`}
          title={lesson.title}
          helpRef={helpRef}
          onHelp={() => setHelp(true)}
          onRestart={() => act({ type: 'restart' })}
          restartLabel="Restart lesson"
          onSaveAndExit={exit}
          resumedNote={
            saveFailed
              ? 'Draft saving failed. Keep this page open; Save & exit will explain how to leave without saving.'
              : !loaded.value && loaded.notice
                ? loaded.notice
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
      <div className={styles.localWorkspace}>
        <div
          className={styles.currentTask}
          data-current-task
          data-response-ready={attemptReady}
          aria-live="polite"
        >
          <NowCard
            model={{
              kicker: `${sameLumen ? 'Viewer warm-up · airway' : 'Example'} ${s.exercise + 1} of ${exercises.length} · ${locatingParent ? target.segment.code : exercise.trace.anchor.airway.code}`,
              heading: title,
              body: taskInstruction,
              status:
                s.phase === 'parent-view' && s.viewAnswer === null
                  ? 'Choose an opening below to continue.'
                  : s.phase === 'attempt' && !sameLumen
                    ? `${s.marks.filter(Boolean).length} of ${exercise.answerPoints.length} lumen responses placed`
                    : undefined,
              primary:
                s.phase !== 'parent-view' || s.viewAnswer !== null
                  ? {
                      label: nextActionLabel,
                      href: complete ? nextDestination : undefined,
                      onActivate: primaryAction,
                      disabled: !canAdvance,
                      disabledReason:
                        s.phase === 'attempt'
                          ? 'Use the CT image to place each mark, or choose Lumen unresolved here.'
                          : undefined,
                    }
                  : undefined,
            }}
          />
        </div>
        <section className={styles.localInstructions} aria-label="Current exercise instructions">
          <h2>
            {complete
              ? 'Review your work'
              : sameLumen
                ? 'Keep the same airway in view'
                : 'CT tracing instructions'}
          </h2>
          {sameLumen && !complete && (
            <div className={styles.warmupPurpose}>
              <h3>Why start here?</h3>
              <p>
                This is a brief viewer warm-up. Follow one airway across adjacent CT slices; placing
                a mark records which lumen you followed. Two short intervals introduce scrolling and
                marking before the next lesson adds a bifurcation.
              </p>
            </div>
          )}
          {locatingParent && (
            <>
              <p>
                Inspect the simulated nodule in {target.segment.name}. Choose a segmental parent
                before verifying the route distally.
              </p>
              <label className={styles.courseChoice}>
                Starting segmental bronchus
                <select
                  aria-label="Starting segmental bronchus"
                  value={s.parentChoice ?? ''}
                  onChange={(e) => act({ type: 'select-parent', value: e.target.value })}
                >
                  <option value="" disabled>
                    Choose a parent airway
                  </option>
                  {[...new Set(CT_TARGETS.map((t) => t.segment.bronchusCode))].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {exercise.spec.kind === 'integration' && s.parentConfirmed && (
            <p>
              Your proposed parent: {s.parentChoice}. This model route starts from{' '}
              {exercises[0].trace.anchor.airway.code}. Compare the CT evidence before accepting the
              planned route; no clinical accuracy grade is assigned.
            </p>
          )}

          {showingWalkthrough && !locatingParent && !(sameLumen && s.phase === 'compare') && (
            <section className={styles.walkthrough} aria-label="Captioned CT walkthrough">
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
              </div>
              <p>
                {frame?.caption ??
                  `Browsing slice ${viewSlice}. Return to a demonstration slice to see its caption.`}
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
            </section>
          )}
          {s.phase === 'demo' && !locatingParent && !sameLumen && (
            <>
              <p>{lesson.objective}</p>
              <p>{lesson.concept}</p>
              <p>
                Watch or step through the native CT interval. Rings identify model locations;
                examine the air-filled lumen and its walls between those locations.
              </p>
            </>
          )}
          {s.phase === 'attempt' && !(sameLumen && attemptReady) && (
            <>
              <fieldset className={styles.markSlots}>
                <legend>{sameLumen ? 'Mark the same lumen' : 'Mark each daughter lumen'}</legend>
                {exercise.answerPoints.map((p, i) => (
                  <button
                    key={i}
                    aria-pressed={s.slot === i}
                    onClick={() => act({ type: 'slot', index: i })}
                  >
                    {p.label} · slice {p.slice}
                    {s.marks[i] ? ' · recorded' : ''}
                  </button>
                ))}
              </fieldset>
              {sameLumen ? (
                <p>
                  Follow the lumen from slice {exercise.trace.anchor.slice} to {slot.slice} using
                  the CT slice controls. Place a mark on {slot.slice}. If you lose track, return to
                  the starting slice or record uncertainty. Then select{' '}
                  <strong>Review my mark</strong>.
                </p>
              ) : (
                <p>
                  Browse freely. Select a lumen above, then use <strong>Go to answer slice</strong>{' '}
                  beside the CT to place its mark. Each lumen also allows an unresolved response.
                </p>
              )}
              {exercise.spec.kind === 'pattern' && (
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
                <h3>Hints</h3>
                {['Highlight the region', 'Return to the parent', 'Replay the walkthrough'].map(
                  (label, i) => (
                    <button key={label} onClick={() => hint(i + 1)}>
                      {i + 1}. {label}
                    </button>
                  ),
                )}
                {s.hints > 0 && <p role="status">{exercise.hints[s.hints - 1]}</p>}
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
                      ? 'Your mark records the lumen you chose'
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
                  <p>
                    {lastExercise
                      ? 'You have now used the viewer on two short airway intervals. Continue to bifurcations to follow a parent airway into its daughters.'
                      : `Next, repeat this on ${exercises[s.exercise + 1].trace.anchor.airway.name}. The lesson after this follows a bifurcation.`}
                  </p>
                </>
              ) : (
                <p>{exercise.explanation}</p>
              )}
              {exercise.spec.kind === 'pattern' && s.exercise === 0 && (
                <>
                  <h3>Reading this pattern</h3>
                  <p>{lesson.interpretation}</p>
                </>
              )}
              <p>
                ○ Your marks · gold rings: model locations. No automatic accuracy verdict is
                assigned.
              </p>
              <button onClick={() => act({ type: 'retry' })}>
                {sameLumen ? 'Try this lumen again' : 'Try this bifurcation again'}
              </button>
              {!sameLumen &&
                exercise.answerPoints.map((p, i) => (
                  <button key={i} onClick={() => act({ type: 'slot', index: i })}>
                    Compare {p.label} · slice {p.slice}
                  </button>
                ))}
            </div>
          )}
          {s.phase === 'parent-view' && (
            <>
              <p>
                The schematic looks distally from the same parent bronchus. Choose the numbered
                opening for CT daughter <strong>{exercise.answerPoints[0].label}</strong>. Letters
                identify the CT daughters; numbers identify positions in the schematic.
              </p>
              <CtParentMap
                trace={exercise.trace}
                labels={s.viewAnswer !== null}
                ctLabels={exercise.answerPoints.map((p) => p.label)}
                choice={s.viewAnswer}
                onChoose={
                  s.viewAnswer === null ? (value) => act({ type: 'view-answer', value }) : undefined
                }
              />
              {s.viewAnswer !== null && (
                <p role="status">
                  Your choice is recorded. The labels now show the model relationship; open the
                  parent airway view to compare it. This schematic does not validate clinical
                  opening positions.
                </p>
              )}
            </>
          )}
          {complete && (
            <>
              <p>
                {sameLumen
                  ? 'You placed or recorded uncertainty for a lumen on two short CT intervals. Continue to bifurcations to follow a parent airway into its daughters.'
                  : `You recorded ${exercises.length} local exercises and reviewed their comparisons. These examples come from one patient CT.`}
              </p>
              <p>
                Different regions or repeated bifurcations in this scan do not establish performance
                on an unfamiliar patient.
              </p>
            </>
          )}
          {first && (
            <details>
              <summary>First attempt and retries · {attempts.length} recorded</summary>
              {attempts.map((attempt, i) => (
                <div key={i}>
                  <strong>{i === 0 ? 'First attempt (preserved)' : `Retry ${i}`}</strong>
                  <p>
                    {attempt.marks.filter((m) => m.pixel === null).length} unresolved responses ·
                    hint level {attempt.hints}
                  </p>
                  <button
                    onClick={() => {
                      setPlaying(false)
                      setReviewAttempt(i)
                      goToSlice(attempt.marks[s.slot].slice)
                    }}
                  >
                    Inspect recorded attempt
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
          {!sameLumen && (
            <details>
              <summary>Your progressive branch map</summary>
              <p>
                A division joins this map after you record its parent-view interpretation. Sibling
                branches remain visible; a chosen continuation is highlighted.
              </p>
              {exercises.map((ex, i) =>
                s.history[ex.id]?.length &&
                (i < s.exercise || (i === s.exercise && s.viewAnswer !== null)) ? (
                  <CtParentMap
                    key={ex.id}
                    trace={ex.trace}
                    ctLabels={ex.answerPoints.map((p) => p.label)}
                    choice={s.history[ex.id].at(-1)!.branch}
                  />
                ) : null,
              )}
            </details>
          )}
          <details>
            <summary>Full-route rehearsal and source limits</summary>
            <Link href={`${BASE_PATH}/practice`}>Open coached full-route practice</Link>
            <p>
              {exercise.review.status === 'provisional'
                ? exercise.review.reason
                : `Reviewed by ${exercise.review.reviewer}, ${exercise.review.date}`}
            </p>
            <p>
              Educational spatial reasoning only. This activity does not establish instrument reach,
              tool-in-lesion or procedural competence.
            </p>
          </details>
        </section>
        <div className={styles.localImageWorkspace} data-warmup={sameLumen || undefined}>
          {locatingParent ? (
            <TargetCtPreview traceId={exercise.spec.traceId} />
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
              orientationControls={
                exercise.spec.kind === 'parent-view' || s.phase === 'parent-view'
              }
              highlightRegion={s.phase === 'attempt' && s.hints > 0}
              showAnchor={showAnchor}
              answerSlice={slot.slice}
              sliceRequest={request}
              teachingFrame={frame}
              annotationReview={exercise.review}
              demonstrate={s.phase === 'demo'}
              scopeAvailable={s.phase === 'parent-view' && s.viewAnswer !== null}
              onMark={s.phase === 'attempt' ? (mark) => act({ type: 'mark', mark }) : undefined}
              orientation={s.orientation}
              onOrientation={(orientation) => setSession((v) => ({ ...v, orientation }))}
              initialView={s.views[exercise.id]}
              onViewChange={onViewChange}
              onReadyChange={setImageReady}
            />
          )}
          <p className={styles.referenceNotice}>
            {MODEL_REFERENCE_LABEL}. No reviewed wall contours or distractor verdicts are supplied
            for this interval.
          </p>
        </div>
      </div>
      <HelpDialog open={help} onClose={() => setHelp(false)} returnFocusTo={helpRef}>
        <p>{lesson.minutes} min · One teaching CT · ungraded</p>
        <p>
          {loaded.notice ||
            'Draft saves on this device, including the CT view and separate attempts.'}
        </p>
        <p>
          <strong>{title}</strong> ·{' '}
          {locatingParent ? target.segment.code : exercise.trace.anchor.airway.code}
        </p>
        <p>{taskInstruction}</p>
        <p>
          Slice controls browse the CT. Go to answer slice restores the marking frame.{' '}
          {sameLumen ? 'Review my mark' : 'Check my tracing'} records this attempt and opens the
          comparison; it does not grade anatomical accuracy.
        </p>
        <p>
          Help does not reset your answers.
          {s.phase === 'attempt' &&
            !attemptReady &&
            ' Graduated hints are available beside the image.'}
        </p>
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
