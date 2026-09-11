'use client'

import { useEffect, useReducer, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { StepList } from '@/features/learning-module/stage/StepList'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { BASE_PATH, LESSONS, lessonById, nextLesson, SOURCE } from '../content/lessons'
import type { Lesson } from '../content/types'
import {
  completedLessons,
  readProgress,
  saveBranchFirst,
  saveFirst,
  saveVisit,
  browserStorage,
} from '../engine/progress'
import {
  emptySession,
  feedbackFor,
  mapComplete,
  scoreResponse,
  sessionReducer,
  validChoice,
} from '../engine/session'
import { AxialStack, ReferenceComparison } from './TracingViews'
import { BranchChoice, LearnerRoute, OpeningEditor } from './ResponseControls'
import { ModuleFrame } from './ModuleFrame'
import { useDeviceProgress } from './useDeviceProgress'
import styles from './branch-tracing.module.css'

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
  // Resolve once per URL. Completion must never auto-advance a direct /learn visit.
  const [lesson] = useState(
    () => lessonById(requestedId) ?? nextLesson(completedLessons(readProgress())) ?? LESSONS[0],
  )
  return <LessonSession lesson={lesson} />
}

function LessonSession({ lesson }: { lesson: Lesson }) {
  const [session, dispatch] = useReducer(
    sessionReducer(lesson.prediction, lesson.transfer),
    undefined,
    emptySession,
  )
  const [review, setReview] = useState<number | null>(null)
  const [saved, setSaved] = useState(() => browserStorage() !== null)
  useEffect(() => {
    saveVisit(lesson.id)
  }, [lesson.id])
  const index = LESSONS.indexOf(lesson)
  const step = lesson.steps[session.step]
  const transfer = session.step === 5
  const exercise =
    session.step === 0 ? lesson.example : transfer ? lesson.transfer : lesson.prediction
  const response = transfer ? session.transfer : session.prediction
  const revealed = session.step === 0 || Boolean(response)
  const answering = session.step === 1 || session.step === 2 || (transfer && !response)
  const showMap = session.step === 2 || (transfer && !response)
  const disabled =
    session.step === 1
      ? !validChoice(exercise, session.choice)
      : showMap
        ? !validChoice(exercise, session.choice) || !mapComplete(exercise, session.openings)
        : false
  const scores = response ? scoreResponse(exercise, response) : null
  const next = nextLesson([...completedLessons(readProgress()), lesson.id])
  const primaryLabel = transfer && response ? 'Finish lesson' : step.actionLabel
  const select = (id: string) => dispatch({ type: 'choose', id })
  const perform = () => {
    setReview(null)
    const action = { type: showMap ? ('submit' as const) : ('advance' as const) }
    const nextState = sessionReducer(lesson.prediction, lesson.transfer)(session, action)
    if (!session.committedBranch && nextState.committedBranch)
      setSaved(
        saveBranchFirst(
          `learn.${lesson.id}.prediction`,
          lesson.prediction,
          nextState.committedBranch,
        ),
      )
    if (!session.prediction && nextState.prediction)
      setSaved(saveFirst(`learn.${lesson.id}.prediction`, lesson.prediction, nextState.prediction))
    if (!session.transfer && nextState.transfer)
      setSaved(saveFirst(`learn.${lesson.id}.transfer`, lesson.transfer, nextState.transfer))
    if (!session.complete && nextState.complete) setSaved(saveVisit(lesson.id, true))
    dispatch(action)
  }
  const doneIds = new Set(
    lesson.steps.slice(0, session.step + (session.complete ? 1 : 0)).map((s) => s.id),
  )
  return (
    <StageLayout
      stageId={session.complete ? 'complete' : step.id}
      label="Branch tracing lesson"
      module="bronchial-branch-tracing"
      workspaceLabel="Branch tracing workspace"
      paneOrder={['steps', 'teaching', 'simulator']}
      defaultWidthFractions={{ primary: 0.26, secondary: 0.29 }}
      paneMinimums={{ primary: 300, secondary: 280, tertiary: 340 }}
      paneCaptions={{
        steps: 'what to do',
        teaching: 'what to read',
        simulator: 'CT and airway comparison',
      }}
      compactPane={session.complete || response ? 'steps' : step.lookIn?.pane}
      header={
        <SectionHeader
          kicker={`Learn · Lesson ${index + 1} of ${LESSONS.length}`}
          title={lesson.title}
          meta={[`${lesson.minutes} min`, 'Synthetic geometry · unpublished preview']}
          onRestart={() => {
            dispatch({ type: 'restart' })
            setReview(null)
          }}
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
          <span>Patient axes: R / L · A / P · cranial / caudal</span>
          <span>Reference roll: {exercise.phantom.camera.roll}°</span>
          <span>{session.hints ? `${session.hints} hints used` : 'No hints used'}</span>
        </div>
      }
      task={
        <>
          <NowCard
            model={{
              kicker: session.complete
                ? 'Lesson completed'
                : `Step ${session.step + 1} of ${lesson.steps.length} · ${step.phase}`,
              heading: session.complete ? 'Ready for the next branch' : step.title,
              body: session.complete
                ? 'You submitted a branch interpretation and opening map, reviewed the comparison, and applied the concept to a changed arrangement. Completion is separate from correctness.'
                : step.instruction,
              where: session.complete ? undefined : <LookInLine location={step.lookIn!} />,
              primary: session.complete
                ? {
                    label: next ? `Next: ${next.title}` : 'Return to overview',
                    href: next ? `${BASE_PATH}/learn?lesson=${next.id}` : BASE_PATH,
                  }
                : {
                    label: primaryLabel,
                    onActivate: perform,
                    disabled,
                    disabledReason:
                      session.step === 1
                        ? 'Select a branch or state that continuation is unresolved.'
                        : 'Choose a branch and place every proximal opening at a distinct position.',
                  },
            }}
          >
            {(session.step === 1 || (transfer && !response)) && (
              <BranchChoice exercise={exercise} selected={session.choice} onChange={select} />
            )}
            {showMap && (
              <OpeningEditor
                exercise={exercise}
                openings={session.openings}
                onChange={(id, position) => dispatch({ type: 'place', id, position })}
              />
            )}
            {response && (
              <div className={styles.feedback} role="status">
                <strong>
                  {scores?.connectivity
                    ? 'Branch choice consistent with the evidence'
                    : 'Review the branch connection'}
                </strong>
                <p>{feedbackFor(exercise, response)}</p>
                <p>
                  Opening arrangement: {scores?.viewpoint}/{scores?.viewpointTotal} positions match
                  this reference.{' '}
                  {response.hints > 0 ? 'Supported attempt.' : 'Unassisted attempt.'}
                </p>
              </div>
            )}
            {answering && (
              <div className={styles.hints}>
                <button
                  disabled={session.hints >= exercise.hints.length}
                  onClick={() => dispatch({ type: 'hint' })}
                >
                  Show a hint
                </button>
                {exercise.hints.slice(0, session.hints).map((h) => (
                  <p key={h}>{h}</p>
                ))}
              </div>
            )}
          </NowCard>
          <StepList
            lesson={{
              sectionId: lesson.id,
              title: lesson.title,
              minutes: lesson.minutes,
              index,
              total: LESSONS.length,
              steps: lesson.steps,
              predictionStepIndex: 1,
            }}
            currentIndex={session.step}
            furthestPerformedIndex={session.step - 1}
            performedStepIds={doneIds}
            predictionCommitted={session.step >= 2}
            reviewIndex={review}
            recapFor={(i) => [
              i === 0
                ? lesson.worked
                : i === 1
                  ? `Recorded branch: ${session.prediction?.branchId.replace('branch-', '').toUpperCase() ?? session.choice?.replace('branch-', '').toUpperCase() ?? 'unresolved'}.`
                  : 'Review only. Your first attempt and the current exercise remain unchanged.',
            ]}
            onSelect={(i) => setReview(review === i ? null : i)}
          />
        </>
      }
      teaching={
        <div className={styles.teaching}>
          {session.step === 0 ? (
            <>
              <StageBlock kind="question" heading="Clinical purpose">
                <h2>Clinical purpose</h2>
                <p>{lesson.objective}</p>
                <p className={styles.small}>Prerequisite: {lesson.prerequisite}</p>
              </StageBlock>
              <StageBlock kind="pattern" heading="Read the course">
                <h2>Read the course</h2>
                <p>
                  <strong>{lesson.concept}</strong>
                </p>
                {lesson.teaching.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </StageBlock>
              <StageBlock kind="signals" heading="Worked example">
                <h2>Worked example</h2>
                <p>{lesson.worked}</p>
                <p>{lesson.example.rationale}</p>
              </StageBlock>
            </>
          ) : (
            <>
              <h2>
                {session.step === 4
                  ? 'Why this branch'
                  : transfer
                    ? 'A changed arrangement'
                    : 'Trace this airway'}
              </h2>
              <p>{exercise.question}</p>
              <p>{exercise.evidence}</p>
              {session.step === 4 ? (
                <>
                  <p>{session.prediction && feedbackFor(lesson.prediction, session.prediction)}</p>
                  <h3>Use the same sequence next time</h3>
                  <ol>
                    {lesson.checklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </>
              ) : (
                <p>
                  Use the axial plane control to inspect the course. The diagram records your route;
                  the comparison becomes available after you submit the opening map.
                </p>
              )}
              <h3>Your branch map</h3>
              <LearnerRoute branchId={response?.branchId ?? session.choice} exercise={exercise} />
            </>
          )}
          <p className={styles.small}>
            A phantom makes the geometry explicit. It cannot establish named patient anatomy,
            mucosal appearance, or device passage.
          </p>
        </div>
      }
      simulator={
        <div className={styles.viewStack}>
          <AxialStack
            key={exercise.id}
            exercise={exercise}
            onSelect={session.step === 1 || (transfer && !response) ? select : undefined}
            selected={response?.branchId ?? session.choice}
          />
          {revealed ? (
            <ReferenceComparison key={`ref-${exercise.id}`} exercise={exercise} />
          ) : (
            <div className={styles.locked}>
              <h3>Comparison after your prediction</h3>
              <p>
                Submit the branch choice and opening map to see the parent view and exterior
                geometry.
              </p>
            </div>
          )}
        </div>
      }
      footer={
        <div className={styles.footer}>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            {SOURCE.title}
          </a>
          <span>{lesson.sourcePages}</span>
          <span>Restart and reload preserve first attempts; incomplete work restarts.</span>
          <Link href={BASE_PATH}>Lesson pathway</Link>
        </div>
      }
    />
  )
}
