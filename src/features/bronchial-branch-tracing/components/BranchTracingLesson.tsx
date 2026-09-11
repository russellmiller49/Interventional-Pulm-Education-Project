'use client'

import dynamic from 'next/dynamic'
import { useEffect, useReducer, useState } from 'react'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { StepList } from '@/features/learning-module/stage/StepList'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { BASE_PATH, LESSONS, SOURCE, lessonById, nextLesson } from '../content/lessons'
import { COURSE_OPTIONS, type CtLesson } from '../content/ct-types'
import { traceById, sliceZ } from '../geometry/native-ct'
import { DISPLAY_PRESETS } from '../geometry/coordinates'
import {
  completedLessons,
  readProgress,
  saveCtAttempt,
  saveVisit,
  browserStorage,
} from '../engine/progress'
import {
  ctSessionReducer,
  emptyCtSession,
  marksComplete,
  type CtAction,
} from '../engine/ct-session'
import { NativeCtViewer } from './NativeCtViewer'
import { CtCourseControl, CtTraceList } from './CtTraceControls'
import { ModuleFrame } from './ModuleFrame'
import { useDeviceProgress } from './useDeviceProgress'
import styles from './branch-tracing.module.css'

const ClinicalAirwayView = dynamic(
  () => import('./ClinicalAirwayView').then((m) => m.ClinicalAirwayView),
  { ssr: false, loading: () => <p>Loading airway comparison…</p> },
)
export function BranchTracingLesson({ requestedId }: { requestedId?: string }) {
  const { ready } = useDeviceProgress()
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
  const [lesson] = useState(
    () => lessonById(requestedId) ?? nextLesson(completedLessons(readProgress())) ?? LESSONS[0],
  )
  return <LessonSession lesson={lesson} />
}
function LessonSession({ lesson }: { lesson: CtLesson }) {
  const prediction = traceById(lesson.prediction),
    transferTrace = traceById(lesson.transfer)
  const reduce = ctSessionReducer(prediction, transferTrace)
  const [s, dispatch] = useReducer(reduce, undefined, emptyCtSession)
  const [review, setReview] = useState<number | null>(null)
  const [saved, setSaved] = useState(() => browserStorage() !== null)
  const [comparison3d, setComparison3d] = useState(false)
  const [levelRequest, setLevelRequest] = useState(0)
  useEffect(() => {
    saveVisit(lesson.id)
  }, [lesson.id])
  const step = lesson.steps[s.step],
    transfer = s.step === 5
  const trace = s.step === 0 ? traceById(lesson.example) : transfer ? transferTrace : prediction
  const response = transfer ? s.transfer : s.prediction
  const revealed = s.step === 0 || Boolean(response)
  const marking = s.step === 1 || (transfer && !response)
  const describing = s.step === 2 || (transfer && !response)
  const disabled =
    s.step === 1
      ? !marksComplete(s.marks)
      : describing
        ? !marksComplete(s.marks) || !s.course
        : false
  const next = nextLesson([...completedLessons(readProgress()), lesson.id])
  function perform(action: CtAction) {
    const nextState = reduce(s, action)
    if (s.step === 1 && nextState.step === 2)
      setSaved(saveCtAttempt(`learn.${lesson.id}.prediction`, s.hints))
    if (!s.prediction && nextState.prediction)
      setSaved(saveCtAttempt(`learn.${lesson.id}.prediction`, nextState.prediction.hints))
    if (!s.transfer && nextState.transfer)
      setSaved(saveCtAttempt(`learn.${lesson.id}.transfer`, nextState.transfer.hints))
    if (!s.complete && nextState.complete) setSaved(saveVisit(lesson.id, true))
    if (action.type === 'advance' || action.type === 'restart') {
      setReview(null)
      setComparison3d(false)
    }
    dispatch(action)
  }
  const done = new Set(lesson.steps.slice(0, s.step + (s.complete ? 1 : 0)).map((v) => v.id))
  return (
    <StageLayout
      module="bronchial-branch-tracing"
      stageId={s.complete ? 'complete' : step.id}
      label="Branch tracing lesson"
      workspaceLabel="Branch tracing workspace"
      paneOrder={['steps', 'teaching', 'simulator']}
      defaultWidthFractions={{ primary: 0.26, secondary: 0.29 }}
      paneMinimums={{ primary: 300, secondary: 280, tertiary: 340 }}
      paneCaptions={{
        steps: 'your CT trace',
        teaching: 'how to read the airway',
        simulator: 'real CT and comparison',
      }}
      compactPane={s.complete ? 'steps' : step.lookIn?.pane}
      header={
        <SectionHeader
          kicker={`Learn · Lesson ${LESSONS.indexOf(lesson) + 1} of ${LESSONS.length}`}
          title={lesson.title}
          meta={['Real CT · 0.5 mm slices', `${lesson.minutes} min`]}
          onRestart={() => perform({ type: 'restart' })}
          restartLabel="Restart lesson"
          saveAndExitHref={BASE_PATH}
          resumedNote={
            !saved
              ? 'Browser storage is unavailable. Work continues, but progress cannot be saved.'
              : undefined
          }
        />
      }
      contextStrip={
        <div className={styles.context}>
          <span>{trace.region}</span>
          <span>{DISPLAY_PRESETS[trace.preset]}</span>
          <span>One source CT · ungraded interpretation</span>
        </div>
      }
      task={
        <>
          <NowCard
            model={{
              kicker: s.complete ? 'Lesson completed' : `Step ${s.step + 1} of 6 · ${step.phase}`,
              heading: s.complete ? 'CT trace completed' : step.title,
              body: s.complete
                ? 'You recorded two CT interpretations and compared their continuity. Completion records the work, not clinical competence.'
                : step.instruction,
              where: s.complete ? undefined : <LookInLine location={step.lookIn!} />,
              primary: s.complete
                ? {
                    label: next ? `Next: ${next.title}` : 'Return to overview',
                    href: next ? `${BASE_PATH}/learn?lesson=${next.id}` : BASE_PATH,
                  }
                : {
                    label: transfer && response ? 'Finish lesson' : step.actionLabel,
                    onActivate: () => perform({ type: 'advance' }),
                    disabled,
                    disabledReason:
                      s.step === 1
                        ? 'Record a lumen mark or unresolved continuation at all three CT levels.'
                        : 'Record three levels and select the airway course.',
                  },
            }}
          >
            {s.step > 0 && !s.complete && (
              <CtTraceList
                trace={trace}
                marks={s.marks}
                active={s.active}
                onActive={(index) => {
                  perform({ type: 'active', index })
                  setLevelRequest((v) => v + 1)
                }}
              />
            )}
            {describing && (
              <CtCourseControl
                value={s.course}
                onChange={(value) => perform({ type: 'course', value })}
              />
            )}
            {response && (
              <div className={styles.feedback} role="status">
                <strong>Your interpretation is recorded</strong>
                <p>
                  {COURSE_OPTIONS[response.course]}.{' '}
                  {response.marks.filter((m) => m.pixel === null).length} levels marked unresolved.
                </p>
                <p>
                  Compare the image evidence before accepting either trace. No clinical accuracy
                  score is assigned.
                </p>
              </div>
            )}
            {marking && (
              <div className={styles.hints}>
                <button disabled={s.hints > 0} onClick={() => perform({ type: 'hint' })}>
                  Tracing reminder
                </button>
                {s.hints > 0 && (
                  <p>
                    Return to Start, follow the same air column through neighboring planes, then
                    mark it at each numbered level. A nearby vessel does not establish airway
                    continuity.
                  </p>
                )}
              </div>
            )}
          </NowCard>
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
              i === 0
                ? lesson.worked
                : 'Review only. The current trace and the original recorded attempt are preserved.',
            ]}
          />
        </>
      }
      teaching={
        <div className={styles.teaching}>
          {s.step === 0 ? (
            <>
              <StageBlock kind="question" heading="Clinical purpose" visibility="shown">
                <h2>Clinical purpose</h2>
                <p>{lesson.objective}</p>
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
                <p className={styles.small}>
                  The gold crosses identify the source-derived trace in this worked example. Your
                  next trace begins without those crosses.
                </p>
              </StageBlock>
            </>
          ) : (
            <>
              <StageBlock kind="question" heading="Start from the parent" visibility="shown">
                <h2>{transfer ? 'Another airway to trace' : 'Start from the parent'}</h2>
                <p>
                  {transfer
                    ? lesson.transferPrompt
                    : `Use Start to identify the parent in the ${trace.region.toLowerCase()} region, then trace its continuity to the three numbered CT levels.`}
                </p>
                <p>
                  Browse between the numbered levels. Place your marks on the visible air column, or
                  record that the continuation is unresolved.
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
        </div>
      }
      simulator={
        <div className={styles.viewStack}>
          <NativeCtViewer
            key={`${trace.id}-${s.step === 0 ? 'example' : transfer ? 'transfer' : 'prediction'}`}
            trace={trace}
            marks={s.step === 0 ? [null, null, null] : s.marks}
            active={s.active}
            levelRequest={levelRequest}
            onActive={(index) => perform({ type: 'active', index })}
            onMark={
              marking ? (mark) => perform({ type: 'mark', index: s.active, mark }) : undefined
            }
            revealed={revealed}
            showAnchor
          />
          {revealed ? (
            <div className={styles.optionalComparison}>
              <button onClick={() => setComparison3d((v) => !v)}>
                {comparison3d
                  ? 'Close airway comparison'
                  : 'Open exterior / virtual airway comparison'}
              </button>
              {comparison3d && (
                <ClinicalAirwayView
                  position={trace.scopePositionLps}
                  direction={trace.scopeDirectionLps}
                  roll={0}
                  slice={Math.round(
                    (sliceZ(trace.checkpoints[s.active].slice) + 368.5) / 1.2421875,
                  )}
                />
              )}
            </div>
          ) : (
            <p className={styles.comparisonLock}>
              CT and airway comparisons become available after you record the trace and its course.
            </p>
          )}
        </div>
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
