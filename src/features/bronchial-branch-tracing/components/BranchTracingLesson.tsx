'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { draftSignature, readCtDraft, writeCtDraft, freshRouteView } from '../engine/ct-draft'
import { parseRouteDraft } from '../engine/route-draft'
import { ROUTE_DRAFT_ALIASES } from '../engine/local-draft-migration'
import type { CtViewerState } from '../content/ct-types'
import { CtProgressiveMap } from './CtBranchMap'
import { CtRouteAttemptHistory } from './CtRouteAttemptHistory'
import { CtRouteWorkspace } from './CtRouteWorkspace'
import { CourseOutline } from './CourseOutline'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { StepList } from '@/features/learning-module/stage/StepList'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { BASE_PATH, LESSONS, SOURCE, lessonAfter, lessonById } from '../content/lessons'
import { COURSE_OPTIONS, type CtLesson } from '../content/ct-types'
import { traceById, targetForTrace } from '../geometry/native-ct'
import { orientationFor, orientationName } from '../geometry/orientation'
import { CtOrientationTeaching, CtOrientationFeedback } from './CtOrientationTeaching'
import {
  browserStorage,
  readSelfPacedRecord,
  recommendedLesson,
  recordLessonOpened,
  setLessonReviewed,
} from '../engine/selfPacedProgress'
import {
  ctSessionReducer,
  emptyCtSession,
  traceComplete,
  junctionReady,
  reachableThrough,
  referenceIndex,
  type CtAction,
} from '../engine/ct-session'
import { NativeCtViewer } from './NativeCtViewer'
import {
  CtAirwayGuide,
  CtBranchDecision,
  CtJunctionTeaching,
  CtCourseControl,
  CtTraceList,
  CtTargetRelationControl,
  CtTargetFeedback,
} from './CtTraceControls'
import { LocalCtLesson } from './LocalCtLesson'
import { ModuleFrame } from './ModuleFrame'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import styles from './branch-tracing.module.css'
import { resetPaneScroll } from './resetPaneScroll'

export function BranchTracingLesson({ requestedId }: { requestedId?: string }) {
  const { ready } = useSelfPacedProgress()
  return (
    <ModuleFrame section="learn" activity>
      {ready ? (
        <LessonEntry key={requestedId ?? 'resume'} requestedId={requestedId} />
      ) : (
        <p className={styles.loading}>Loading your lesson…</p>
      )}
    </ModuleFrame>
  )
}
function LessonEntry({ requestedId }: { requestedId?: string }) {
  // A named lesson always opens. Otherwise resume from the self-paced record only.
  const [lesson] = useState(
    () =>
      lessonById(requestedId) ??
      recommendedLesson(readSelfPacedRecord().record)?.lesson ??
      LESSONS[0],
  )
  return lesson.exercises ? <LocalCtLesson lesson={lesson} /> : <LessonSession lesson={lesson} />
}
function LessonSession({ lesson }: { lesson: CtLesson }) {
  const router = useRouter()
  const [help, setHelp] = useState(false)
  const [exitWarning, setExitWarning] = useState(false)
  const helpRef = useRef<HTMLButtonElement>(null)
  const prediction = traceById(lesson.prediction),
    transferTrace = traceById(lesson.transfer)
  const reduce = ctSessionReducer(prediction, transferTrace, traceById(lesson.example))
  const signature = useMemo(
    () => draftSignature([lesson, prediction, transferTrace, traceById(lesson.example)]),
    [lesson, prediction, transferTrace],
  )
  const draftKey = `learn.${lesson.id}`
  const [loaded] = useState(() =>
    readCtDraft(
      browserStorage(),
      draftKey,
      signature,
      (v) => parseRouteDraft(v, prediction, transferTrace, traceById(lesson.example)),
      ROUTE_DRAFT_ALIASES[lesson.id] ?? [],
    ),
  )
  const [s, dispatch] = useReducer(reduce, loaded.value?.session ?? emptyCtSession(prediction))
  const { record } = useSelfPacedProgress()
  const [saved, setSaved] = useState(() => browserStorage() !== null)
  const [viewerEpoch, setViewerEpoch] = useState(0)
  const [views, setViews] = useState<Record<string, CtViewerState>>(loaded.value?.views ?? {})
  // Junction references the learner chose to show, per trace. Transient; records nothing.
  const [shownRefs, setShownRefs] = useState<Record<string, number[]>>({})
  useEffect(() => {
    // Report whether synchronization with browser storage succeeded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(writeCtDraft(browserStorage(), draftKey, signature, { session: s, views }))
  }, [draftKey, signature, s, views])
  const [imageReady, setImageReady] = useState(false)
  const [review, setReview] = useState<number | null>(null)
  const [levelRequest, setLevelRequest] = useState(0)
  useEffect(() => {
    recordLessonOpened(lesson.id)
  }, [lesson.id])
  const step = lesson.steps[s.step],
    transfer = s.step === 5
  const trace = s.step === 0 ? traceById(lesson.example) : transfer ? transferTrace : prediction
  const viewKey = `${trace.id}.${s.step === 0 ? 'demo' : 'work'}`
  const onViewChange = useCallback(
    (view: CtViewerState) =>
      setViews((current) =>
        JSON.stringify(current[viewKey]) === JSON.stringify(view)
          ? current
          : { ...current, [viewKey]: view },
      ),
    [viewKey],
  )
  const target = targetForTrace(trace)
  const response = transfer ? s.transfer : s.prediction
  // The comparison steps show the reference whether or not an interpretation was recorded.
  const revealed = s.step === 0 || s.step === 3 || s.step === 4 || Boolean(response)
  const marking = !s.complete && (s.step === 1 || (transfer && !response))
  const orienting = marking && !s.alignment
  const routeDone = traceComplete(trace, s)
  const stationDone = Boolean(s.recorded[s.active])
  const shown = new Set(shownRefs[trace.id] ?? [])
  const referenceShown = shown.has(s.active)
  const taskTop = useRef<HTMLDivElement>(null)
  const teachingTop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    resetPaneScroll(taskTop.current)
    resetPaneScroll(teachingTop.current)
  }, [s.active, s.step, s.alignment, stationDone])
  const stationTask = marking && !orienting && !routeDone
  const maxActive = marking
    ? orienting
      ? 0
      : reachableThrough(s.recorded, s.reached)
    : trace.checkpoints.length - 1
  const describing = !s.complete && (s.step === 2 || (transfer && !response && routeDone))
  // Recording needs its real parts; moving on does not.
  const disabled =
    !imageReady ||
    (orienting
      ? false
      : stationTask
        ? !stationDone && !junctionReady(trace, s.active, s.marks, s.branches)
        : s.step === 1
          ? !routeDone
          : describing
            ? !routeDone || !s.course || !s.targetRelation || !s.targetViewed[trace.id]
            : false)
  const stationAction = stationDone
    ? s.active + 1 === trace.checkpoints.length - 1
      ? 'Inspect the distal airway–nodule relationship'
      : 'Continue to the next division'
    : trace.checkpoints[s.active].decision
      ? 'Check this junction'
      : 'Record nodule approach'
  const next = lessonAfter(lesson.id)
  const reviewed = record.reviewedLessonIds.includes(lesson.id)
  const recordedCount = [s.prediction, s.transfer].filter(Boolean).length
  function perform(action: CtAction) {
    const nextState = reduce(s, action)
    // Reaching the end marks the lesson reviewed on this device; no trace or hint is recorded.
    if (!s.complete && nextState.complete) setLessonReviewed(lesson.id, true)
    if (
      action.type === 'active' ||
      action.type === 'skip-junction' ||
      (action.type === 'check-orientation' && nextState.alignment)
    )
      setLevelRequest((v) => v + 1)
    if (action.type === 'restart') {
      setViews({})
      setShownRefs({})
      setViewerEpoch((v) => v + 1)
    }
    if (action.type === 'advance' || action.type === 'restart') {
      setReview(null)
    }
    dispatch(action)
  }
  function toggleReference() {
    setShownRefs((current) => {
      const list = current[trace.id] ?? []
      return {
        ...current,
        [trace.id]: list.includes(s.active)
          ? list.filter((i) => i !== s.active)
          : [...list, s.active],
      }
    })
  }
  const skipJunction =
    stationTask && !stationDone && s.active < trace.checkpoints.length - 1
      ? {
          label: 'Continue without recording',
          onActivate: () => perform({ type: 'skip-junction' }),
        }
      : undefined
  const skipTrace =
    !s.complete && (s.step === 1 || s.step === 2 || (transfer && !response))
      ? {
          label:
            s.step === 2
              ? 'Show the comparison without recording'
              : transfer
                ? 'Finish without recording'
                : 'Continue without recording this trace',
          onActivate: () => perform({ type: 'continue-without-recording' }),
        }
      : undefined
  const done = new Set(lesson.steps.slice(0, s.step + (s.complete ? 1 : 0)).map((v) => v.id))
  return (
    <CtRouteWorkspace
      section="learn"
      stageId={s.complete ? 'complete' : step.id}
      label="Branch tracing lesson"
      explanationOpen={s.step === 0 || s.step === 3 || s.step === 4}
      header={
        <SectionHeader
          kicker={`Learn · Lesson ${LESSONS.indexOf(lesson) + 1} of ${LESSONS.length}`}
          title={lesson.title}
          sectionsControl={<CourseOutline currentId={lesson.id} />}
          onRestart={() => perform({ type: 'restart' })}
          restartLabel="Restart lesson"
          helpRef={helpRef}
          onHelp={() => setHelp(true)}
          onSaveAndExit={() => {
            if (writeCtDraft(browserStorage(), draftKey, signature, { session: s, views }))
              router.push(BASE_PATH)
            else setExitWarning(true)
          }}
          resumedNote={
            !saved
              ? 'Browser storage is unavailable. Work continues, but your draft cannot be saved.'
              : loaded.notice || undefined
          }
        />
      }
      contextStrip={
        <div className={styles.context}>
          <span>
            Target: {target.segment.code} · {target.segment.name}
          </span>
          <span>Orient the CT · compare the parent view</span>
          <span>One source CT · self-paced, not scored</span>
        </div>
      }
      task={
        <div ref={taskTop}>
          <NowCard
            model={{
              kicker: s.complete ? 'Lesson finished' : `Step ${s.step + 1} of 6 · ${step.phase}`,
              heading: s.complete
                ? 'Lesson finished'
                : orienting
                  ? 'Orient before tracing'
                  : stationTask
                    ? trace.checkpoints[s.active].decision
                      ? `Junction ${s.active + 1} of ${trace.checkpoints.length - 1}`
                      : 'Distal nodule approach'
                    : step.title,
              body: s.complete
                ? `${
                    recordedCount === 2
                      ? 'You recorded both routes toward simulated nodules and compared their CT continuity.'
                      : recordedCount === 1
                        ? 'You recorded one of the two routes and compared it with the CT; the other was passed without recording.'
                        : 'You moved through both routes without recording an interpretation.'
                  } Finishing is a note for finding your place, not a result or clinical competence.`
                : orienting
                  ? 'Standard axial is a valid tracing display. Use the patient labels to maintain direction; regional display conventions are optional aids. Record the display you choose.'
                  : stationTask
                    ? 'Select the branch you would follow, then mark its lumen on the answer slice. Check this fork to compare it, show the reference first, or continue without recording.'
                    : step.instruction,
              primary: s.complete
                ? {
                    label: next ? `Next: ${next.title}` : 'Return to overview',
                    href: next ? `${BASE_PATH}/learn?lesson=${next.id}` : BASE_PATH,
                  }
                : {
                    label: orienting
                      ? 'Use this orientation'
                      : stationTask
                        ? stationAction
                        : transfer && response
                          ? 'Finish lesson'
                          : step.actionLabel,
                    onActivate: () =>
                      orienting
                        ? perform({ type: 'check-orientation' })
                        : stationTask
                          ? stationDone
                            ? perform({ type: 'active', index: s.active + 1 })
                            : perform({ type: 'record-junction' })
                          : perform({ type: 'advance' }),
                    disabled,
                    disabledReason: !imageReady
                      ? 'Wait for the CT image to load.'
                      : stationTask
                        ? 'To check this junction, select a daughter branch (or uncertainty) and mark its lumen (or unresolved lumen). You can also continue without recording.'
                        : 'To record, mark every junction and the distal approach, use Show target to inspect the nodule, then describe the course and distal relationship. You can also continue without recording.',
                  },
              secondary: skipJunction ?? skipTrace,
            }}
          />
          <div className={styles.routeResponses}>
            {orienting && s.orientationAttempts.length > 0 && (
              <div className={styles.feedback} role="status">
                <strong>Recheck the direction letters</strong>
                <p>
                  You selected{' '}
                  {orientationName(
                    s.orientationAttempts[s.orientationAttempts.length - 1],
                  ).toLowerCase()}
                  . For this region, the book uses{' '}
                  {orientationName(orientationFor(trace.preset)).toLowerCase()} from standard axial.
                  Standard axial remains a valid choice; the regional convention is an optional
                  comparison aid.
                </p>
              </div>
            )}
            {marking && !orienting && (
              <>
                <CtBranchDecision
                  trace={trace}
                  active={s.active}
                  choice={s.branches[s.active]}
                  recorded={stationDone}
                  reveal={stationDone || referenceShown}
                  onChange={
                    !stationDone
                      ? (value) => perform({ type: 'branch', index: s.active, value })
                      : undefined
                  }
                />
                {!stationDone && (
                  <button aria-pressed={referenceShown} onClick={toggleReference}>
                    Show reference for this junction
                  </button>
                )}
                {stationDone && (
                  <button onClick={() => perform({ type: 'retry-junction' })}>
                    Retry this junction
                  </button>
                )}
                <CtRouteAttemptHistory
                  key={`${trace.id}.${s.active}`}
                  trace={trace}
                  active={s.active}
                  attempts={
                    s.junctionHistory[`${trace.id}.${trace.checkpoints[s.active].id}`] ?? []
                  }
                />
                <p role="status">
                  {stationDone
                    ? 'Response recorded. Review this fork, then continue.'
                    : referenceShown
                      ? 'Reference shown. Choosing a branch and placing a mark are still yours to do, or continue without recording.'
                      : !s.marks[s.active]
                        ? 'Lumen mark needed in the CT tracing stack to check this junction.'
                        : s.marks[s.active]?.pixel === null
                          ? 'Lumen recorded as unresolved.'
                          : 'Lumen marked. Check this junction to compare.'}
                </p>
              </>
            )}
            {describing && !orienting && (
              <>
                <CtCourseControl
                  from={trace.focusAirway?.code}
                  value={s.course}
                  onChange={(value) => perform({ type: 'course', value })}
                />
                <CtTargetRelationControl
                  value={s.targetRelation}
                  onChange={(value) => perform({ type: 'target-relation', value })}
                />
              </>
            )}
            {response && (
              <div className={styles.feedback} role="status">
                <strong>Your interpretation is recorded</strong>
                <CtOrientationFeedback trace={trace} {...response.orientation} />
                <p>
                  {COURSE_OPTIONS[response.course]}.{' '}
                  {response.marks.filter((m) => m.pixel === null).length} checkpoints marked
                  unresolved.
                </p>
                <CtTargetFeedback value={response.targetRelation} />
                <p>
                  Compare the image evidence before accepting either trace. No clinical accuracy
                  score is assigned.
                </p>
              </div>
            )}
            {!response && (s.step === 3 || s.step === 4) && (
              <div className={styles.feedback} role="status">
                <strong>No interpretation recorded for this trace</strong>
                <p>
                  You continued without recording one. The reference route is shown on the CT;
                  compare it level by level, then trace another airway when ready.
                </p>
              </div>
            )}
            {s.complete && (
              <p role="status">
                {reviewed
                  ? 'Marked reviewed on this device — a note for finding your place, not a result.'
                  : 'Not marked reviewed.'}{' '}
                <button onClick={() => setLessonReviewed(lesson.id, !reviewed)}>
                  {reviewed ? 'Undo reviewed' : 'Mark reviewed'}
                </button>
              </p>
            )}
            {marking && !orienting && (
              <div className={styles.hints}>
                <button disabled={s.hints > 0} onClick={() => perform({ type: 'hint' })}>
                  Tracing reminder
                </button>
                {s.hints > 0 && (
                  <p>
                    Use View parent CT before this fork, follow its walls through neighboring
                    planes, then mark the daughter lumen on Current junction CT. A nearby vessel
                    does not establish airway continuity.
                  </p>
                )}
              </div>
            )}
          </div>
          {s.step > 0 && !s.complete && (
            <CtTraceList
              trace={trace}
              marks={s.marks}
              recorded={s.recorded}
              active={s.active}
              maxActive={maxActive}
              onActive={(index) => perform({ type: 'active', index })}
            />
          )}

          <details>
            <summary>Review earlier route tasks</summary>
            <StepList
              lesson={{
                sectionId: lesson.id,
                title: lesson.title,
                minutes: lesson.minutes,
                index: LESSONS.indexOf(lesson),
                total: LESSONS.length,
                steps: lesson.steps,
                predictionStepIndex: 1,
              }}
              currentIndex={s.step}
              furthestPerformedIndex={s.step - 1}
              performedStepIds={done}
              predictionCommitted={Boolean(s.prediction)}
              reviewIndex={review}
              onSelect={(i) => setReview(review === i ? null : i)}
              recapFor={(i) => [
                i === 0 && !orienting
                  ? lesson.worked
                  : 'Review only. The current trace and your recorded responses are unchanged.',
              ]}
            />
          </details>
        </div>
      }
      map={
        <CtProgressiveMap
          trace={trace}
          recorded={s.recorded}
          branches={s.branches}
          active={s.active}
          onReview={(index) => perform({ type: 'active', index })}
        />
      }
      teaching={
        <div ref={teachingTop} className={styles.teaching}>
          {!orienting && s.step !== 0 && <CtJunctionTeaching trace={trace} active={s.active} />}
          {s.step === 0 ? (
            <>
              <details>
                <summary>Review display conventions</summary>
                <CtOrientationTeaching trace={trace} />
              </details>
              <StageBlock kind="question" heading="Clinical purpose" visibility="shown">
                <h2>Clinical purpose</h2>
                <p>{lesson.objective}</p>
                <p>
                  Plan an airway approach to the simulated nodule in the{' '}
                  <strong>
                    {target.segment.name.toLowerCase()} ({target.segment.code})
                  </strong>
                  .
                </p>
                <p className={styles.small}>Prerequisite: {lesson.prerequisite}</p>
              </StageBlock>
              <StageBlock kind="pattern" heading="Read the course" visibility="shown">
                <h2>Read the course</h2>
                <p>
                  <strong>{lesson.concept}</strong>
                </p>
                {lesson.teaching.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </StageBlock>
              <StageBlock kind="signals" heading="Worked CT example" visibility="shown">
                <h2>Worked CT example</h2>
                <p>{lesson.worked}</p>
                <p>
                  Use <strong>Show target</strong> to inspect the nodule, then Start at the trachea.
                  Use <strong>Continue to the next division</strong> beneath the paired views to
                  inspect each worked junction. Every route includes all modeled branch decisions
                  before the distal approach.
                </p>
                <p className={styles.small}>
                  The gold crosses identify the source-derived trace in this worked example. Your
                  next trace begins without them; Show reference brings them back at any junction.
                </p>
              </StageBlock>
            </>
          ) : (
            <>
              <StageBlock kind="question" heading="Start from the parent" visibility="shown">
                <h2>{transfer ? 'Another airway to trace' : 'Start from the parent'}</h2>
                <p>
                  <strong>
                    Destination: {target.segment.name} ({target.segment.code}).
                  </strong>{' '}
                  Inspect the simulated nodule with Show target before tracing from Start.
                </p>
                <p>
                  {orienting
                    ? 'Use the patient direction letters to choose the display orientation before following the air column.'
                    : transfer
                      ? lesson.transferPrompt
                      : `Use Start to identify the ${trace.anchor.airway.name.toLowerCase()}, then follow each intervening junction toward the target.`}
                </p>
                <p>
                  At each fork, inspect all daughter branches. Choose the branch you would follow
                  and mark the visible continuation on Current junction CT, or record uncertainty.
                  Check the junction to compare it, or show the reference first. You can continue
                  without recording at any junction.
                </p>
                <p>
                  At the distal checkpoint, scroll toward the nodule. Decide whether you can follow
                  the air column toward it, whether the connection remains unresolved, or whether
                  you may have followed an adjacent structure.
                </p>
              </StageBlock>
              {s.step === 3 || s.step === 4 || (transfer && response) ? (
                <StageBlock
                  kind="after-commitment"
                  heading="Reading this airway"
                  visibility="shown"
                >
                  <h2>Reading this airway</h2>
                  <p>
                    {transfer
                      ? 'Compare the marked air column with the source-derived trace at each level. State the patient-space course, then explain how the display convention changes its appearance.'
                      : lesson.interpretation}
                  </p>
                  <p className={styles.small}>
                    The comparison follows existing centerline geometry. It is not a
                    physician-approved clinical answer key or an annotation of mucosal ostia.
                  </p>
                </StageBlock>
              ) : (
                <StageBlock kind="pattern" heading="Keep the view straight" visibility="shown">
                  <h2>Keep the view straight</h2>
                  <p>
                    Use the R/L/A/P letters after changing the display. A slice number describes an
                    axial level, not the order of a bronchial generation.
                  </p>
                  <p>
                    At a horizontal division, inspect the next branch from the parent direction
                    instead of copying the axial Y shape.
                  </p>
                </StageBlock>
              )}
            </>
          )}
          {s.step === 0 && <CtJunctionTeaching trace={trace} active={s.active} />}
          {revealed && (
            <CtBranchDecision
              trace={trace}
              active={s.active}
              choice={s.step === 0 ? null : s.branches[s.active]}
              recorded={s.step !== 0}
              reveal
            />
          )}
          <CtAirwayGuide trace={trace} active={s.active} pending={!revealed} />
        </div>
      }
      simulator={
        <div className={styles.viewStack}>
          <NativeCtViewer
            key={`${trace.id}-${s.step === 0 ? 'example' : transfer ? 'transfer' : 'prediction'}.${viewerEpoch}`}
            trace={trace}
            initialView={views[viewKey] ?? freshRouteView(trace)}
            onViewChange={onViewChange}
            onReadyChange={setImageReady}
            onTargetReady={() => perform({ type: 'target-inspected' })}
            scopeAvailable={revealed || stationDone || referenceShown}
            marks={s.step === 0 ? trace.checkpoints.map(() => null) : s.marks}
            active={s.active}
            levelRequest={levelRequest}
            maxActive={maxActive}
            referenceThrough={marking || s.step === 2 ? referenceIndex(s.recorded, shown) : -1}
            onActive={(index) => perform({ type: 'active', index })}
            onMark={
              marking && !orienting && !stationDone
                ? (mark) => perform({ type: 'mark', index: s.active, mark })
                : undefined
            }
            orientation={s.orientation}
            onOrientation={(value) => perform({ type: 'orientation', value })}
            orientationPending={orienting}
            demonstrate={s.step === 0}
            revealed={revealed}
            showAnchor
          />
        </div>
      }
      overlay={
        <>
          <HelpDialog open={help} onClose={() => setHelp(false)} returnFocusTo={helpRef}>
            <p>
              {orienting
                ? 'Use the rotate or flip controls, then use this orientation.'
                : stationTask
                  ? 'Select the branch you would follow. Browse neighboring CT slices, then use Go to response slice to mark its lumen or record uncertainty. Show reference for this junction displays the model continuation without recording anything.'
                  : step.instruction}
            </p>
            <p>
              Slice controls browse the CT; Continue to the next division changes the active fork.
              Continue without recording moves on and records nothing for that junction or trace.
              Nothing here is scored. Help preserves your current responses.
            </p>
          </HelpDialog>
          <HelpDialog
            open={exitWarning}
            onClose={() => setExitWarning(false)}
            title="This draft could not be saved"
          >
            <p>Leaving will lose changes since the last successful save.</p>
            <button onClick={() => router.push(BASE_PATH)}>Leave without saving</button>
          </HelpDialog>
        </>
      }
      footer={
        <div className={styles.footer}>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            {SOURCE.title}
          </a>
          <span>{lesson.sourcePages}</span>
          <span>Native CT · Slicer 5.12.3 · clinical review pending</span>
        </div>
      }
    />
  )
}
