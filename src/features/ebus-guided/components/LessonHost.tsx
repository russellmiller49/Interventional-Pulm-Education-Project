'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import {
  BASE,
  CHAPTERS,
  LESSONS,
  chapterForLesson,
  lessonHref,
  nextLesson,
} from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { labGoalMet, type Lesson } from '../content/types'
import {
  completeLesson,
  firstAttempt,
  recordLinkedObservation,
  recordSupportRequest,
  updateRecord,
} from '../engine/progress'
import { retainedImageAvailable } from '../engine/evidence'
import { linkedTaskKey } from '@/lib/ebus-linked-contract'
import { EbusModuleFrame } from './ModuleFrame'
import { SourceList } from './SourceList'
import { TeachingDiagram } from './Diagram'
import { QuestionBody } from './QuestionBody'
import { MatchingActivity } from './MatchingActivity'
import { StationFigure } from './StationFigure'
import { SequenceActivity } from './SequenceActivity'
import { Workbench } from './Workbench'
import { ExaminationWorkspace } from './ExaminationWorkspace'
import { useCourseRecord } from './useCourseRecord'
import styles from './course.module.css'

export function LessonHost({ lesson, locale = 'en' }: { lesson: Lesson; locale?: string }) {
  const [restart, setRestart] = useState(0)
  return (
    <LessonSession
      key={lesson.id + restart}
      lesson={lesson}
      locale={locale}
      onRestart={() => setRestart((value) => value + 1)}
    />
  )
}
function LessonSession({
  lesson,
  locale,
  onRestart,
}: {
  lesson: Lesson
  locale: string
  onRestart: () => void
}) {
  const record = useCourseRecord()
  const activities = useMemo(() => activitiesForLesson(lesson), [lesson])
  const [activeId, setActiveId] = useState(activities[0].id)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questionPositions, setQuestionPositions] = useState<Record<string, number>>({})
  const [actions, setActions] = useState<Record<string, boolean>>({})
  const [observation, setObservation] = useState<EbusObservation>(EMPTY_EBUS_OBSERVATION)
  const [retained, setRetained] = useState<EbusObservation | null>(null)
  const [finished, setFinished] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const [holdRequested, setHoldRequested] = useState(false)
  const [dialogTrigger, setDialogTrigger] = useState<'outline' | 'help'>('help')
  const [dialog, setDialog] = useState<'outline' | 'help' | null>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const outlineButton = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [sessionId] = useState(() => lesson.id + '-' + Math.random().toString(36).slice(2))
  const position = activities.findIndex((activity) => activity.id === activeId)
  const current = activities.find((activity) => activity.id === (reviewId ?? activeId))!
  const active = activities[position]
  const runtimeActivity = activities
    .slice(0, position + 1)
    .findLast((activity) => activity.interaction === 'acquire')
  const runtimeLab = runtimeActivity?.task === 'changed-window' ? lesson.transferLab : lesson.lab
  const questionPosition = questionPositions[current.id] ?? 0
  const interactionDone =
    !['matching', 'sequence', 'record'].includes(current.interaction) || !!actions[current.id]
  const questionSlot = interactionDone ? current.questions[questionPosition] : undefined
  const question = questionSlot ? lesson[questionSlot] : undefined
  const committed = question ? answers[question.id] : undefined
  const unsafe = !!question?.choices.find((choice) => choice.id === committed)?.unsafe
  const pendingQuestion = !!question && !committed
  const missingImage =
    !!question && !retainedImageAvailable(question, runtimeLab, retained, observation)
  const labDone = !!runtimeLab && labGoalMet(runtimeLab, observation)
  const onObservation = useCallback((value: EbusObservation) => {
    setObservation(value)
    // An actual reboot/error cancels an in-flight hold so recovery can reacquire.
    // A normal decoded-frame acknowledgement carries the current session.
    if (!value.ready && !value.acquisitionSession) setHoldRequested(false)
  }, [])
  const safeFeedback = !!committed && !unsafe && questionPosition === current.questions.length - 1
  const next = nextLesson(record.completed)
  const chapter = chapterForLesson(lesson.id)
  useEffect(() => {
    const saved = updateRecord((value) => ({ ...value, lastLesson: lesson.id }))
    // Reflect the browser-only storage operation after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageFailed(!saved)
  }, [lesson.id])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [activeId, reviewId, questionPosition, finished])

  function advance() {
    if (reviewId) {
      setReviewId(null)
      return
    }
    if (finished) return
    if (current.interaction === 'acquire') {
      if (!labDone) return
      if (runtimeLab?.kind === 'knobology' && !observation.recorded?.held) {
        setHoldRequested(true)
        return
      }
      setRetained(observation)
    }
    if (!interactionDone) return
    if (question && !committed) {
      if (missingImage) return
      const id = selected[question.id]
      if (!question.choices.some((choice) => choice.id === id)) return
      setAnswers((value) => ({ ...value, [question.id]: id }))
      setStorageFailed(
        !updateRecord((value) => {
          const first = firstAttempt(
            value,
            lesson.id + ':' + question.id,
            question,
            id,
            value.supportRequests[lesson.id]?.some((entry) => entry.sessionId === sessionId),
          )
          return retained && runtimeLab && current.image === 'held'
            ? recordLinkedObservation(first, runtimeLab, retained, question, id)
            : first
        }),
      )
      return
    }
    if (unsafe && question) {
      setAnswers((value) => {
        const nextAnswers = { ...value }
        delete nextAnswers[question.id]
        return nextAnswers
      })
      setSelected((value) => ({ ...value, [question.id]: '' }))
      return
    }
    if (question && questionPosition < current.questions.length - 1) {
      setQuestionPositions((value) => ({ ...value, [current.id]: questionPosition + 1 }))
      return
    }
    if (!current.transitions.next) {
      setStorageFailed(!updateRecord((value) => completeLesson(value, lesson.id)))
      setFinished(true)
      return
    }
    const following = activities.find((activity) => activity.id === current.transitions.next)!
    if (following.interaction === 'acquire') {
      setObservation(EMPTY_EBUS_OBSERVATION)
      setRetained(null)
    }
    setActiveId(following.id)
  }
  const disabled =
    !reviewId &&
    (holdRequested ||
      missingImage ||
      !interactionDone ||
      (pendingQuestion && !selected[question!.id]) ||
      (current.interaction === 'acquire' && !labDone))
  const disabledReason = missingImage
    ? 'The held image is unavailable in the current view. Return to a supported width, or restart the lesson to acquire new evidence. Earlier first responses are retained.'
    : !interactionDone
      ? 'Complete the task before reviewing its interpretation.'
      : current.interaction === 'acquire'
        ? 'Complete the required acquisition and wait for its image.'
        : 'Select a response first.'
  const primaryLabel = holdRequested
    ? 'Holding the selected frame…'
    : reviewId
      ? 'Return to current task'
      : unsafe
        ? 'Revise this response'
        : pendingQuestion
          ? 'Submit response'
          : current.interaction === 'acquire'
            ? 'Hold this acquisition'
            : question && questionPosition < current.questions.length - 1
              ? 'Consider the next decision'
              : !current.transitions.next
                ? 'Finish lesson'
                : activities.find((activity) => activity.id === current.transitions.next)!.title
  useEffect(() => {
    if (
      !holdRequested ||
      current.interaction !== 'acquire' ||
      !observation.recorded?.held ||
      !labDone ||
      !current.transitions.next
    )
      return
    // The child acknowledges the actual decoded, paused frame before interpretation opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRetained(observation)
    setHoldRequested(false)
    setActiveId(current.transitions.next)
  }, [holdRequested, current, observation, labDone])
  const showRuntime = !reviewId && ['live', 'held'].includes(current.image)
  const showDemo = !runtimeActivity && !reviewId && current.image === 'demonstration'
  const reveal = !pendingQuestion && !unsafe && current.image === 'held'
  const instruction =
    current.interaction === 'acquire'
      ? (runtimeLab?.instruction ?? current.instruction)
      : current.instruction

  return (
    <EbusModuleFrame locale={locale} active="Learn" activity>
      <div
        className={styles.lessonFlow}
        data-ebus-flow
        data-activity-id={current.id}
        data-presentation={current.presentation}
      >
        <nav className={styles.flowNav} aria-label="EBUS course">
          {['Overview', 'Learn', 'Practice', 'Assess'].map((label) => (
            <Link
              key={label}
              href={BASE + (label === 'Overview' ? '' : '/' + label.toLowerCase())}
              aria-current={label === 'Learn' ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
          <span>Unlisted preview · For education and supervised training</span>
        </nav>
        <header className={styles.flowHeader}>
          <div>
            <p className={styles.eyebrow}>
              Lesson {LESSONS.findIndex((entry) => entry.id === lesson.id) + 1} of {LESSONS.length}{' '}
              · {chapter.title}
            </p>
            <h1>{lesson.title}</h1>
          </div>
          <nav aria-label="Lesson controls">
            <button
              ref={outlineButton}
              className={styles.secondary}
              onClick={() => {
                setDialogTrigger('outline')
                setDialog('outline')
              }}
            >
              Course outline
            </button>
            <button
              ref={helpButton}
              className={styles.secondary}
              onClick={() => {
                setDialogTrigger('help')
                setStorageFailed(
                  !updateRecord((value) =>
                    recordSupportRequest(value, lesson.id, activeId, sessionId),
                  ),
                )
                setDialog('help')
              }}
            >
              Help
            </button>
            <button className={styles.secondary} onClick={onRestart}>
              Restart lesson
            </button>
            <Link className={styles.secondary} href={BASE}>
              Exit lesson
            </Link>
          </nav>
        </header>
        <div className={styles.flowProgress}>
          <span>
            {finished
              ? 'Completed'
              : 'Task ' + (activities.indexOf(current) + 1) + ' of ' + activities.length}
          </span>
          <progress
            max={activities.length}
            value={finished ? activities.length : position}
            aria-label="Lesson activity progress"
          />
          <span>
            {record.completed.length} of {LESSONS.length} lessons completed
          </span>
        </div>
        {storageFailed && (
          <p role="status" className={styles.notice}>
            Browser storage is unavailable. This work may not survive a reload.
          </p>
        )}
        {lesson.lab?.linkedLesson &&
          record.completed.includes(lesson.id) &&
          !record.skillObservations[linkedTaskKey(lesson.lab.linkedLesson, 'guided')] && (
            <p className={styles.notice}>
              Earlier completion is retained. The current acquisition task has no recorded
              observation yet.
            </p>
          )}
        <section className={styles.taskSurface} data-now-card aria-labelledby="ebus-task-title">
          <div className={styles.taskHeading}>
            <p className={styles.eyebrow}>
              {reviewId ? 'Review · Current activity paused' : current.kind}
            </p>
            <h2 id="ebus-task-title" ref={heading} tabIndex={-1}>
              {finished ? 'Lesson completed' : current.title}
            </h2>
            <p>
              {finished
                ? 'The required activities and responses are recorded. This course completion does not establish procedural competence.'
                : reviewId
                  ? 'Read the earlier task without repeating its actions. Your current acquisition remains paused.'
                  : instruction}
            </p>
          </div>
          <div className={styles.taskComposition} data-composition={current.presentation}>
            <div
              className={styles.taskEvidence}
              hidden={
                finished ||
                (runtimeActivity
                  ? !showRuntime
                  : !showDemo && !['reference', 'diagram'].includes(current.image))
              }
            >
              {runtimeActivity && runtimeLab ? (
                <Workbench
                  key={runtimeActivity.task ?? 'guided'}
                  lab={runtimeLab}
                  locked={
                    !!reviewId || holdRequested || active.interaction !== 'acquire' || finished
                  }
                  reveal={reveal && !reviewId}
                  sessionId={sessionId + '-' + (runtimeActivity.task ?? 'guided')}
                  onObservation={onObservation}
                />
              ) : showDemo && lesson.lab ? (
                <Workbench
                  key="demonstration"
                  lab={lesson.lab}
                  locked={false}
                  reveal
                  demonstration
                  sessionId={sessionId + '-demonstration'}
                  onObservation={onObservation}
                />
              ) : current.image === 'reference' && lesson.station ? (
                <StationFigure key={lesson.station} station={lesson.station} allowSelect />
              ) : current.image === 'diagram' ? (
                <TeachingDiagram kind={lesson.diagram} />
              ) : null}
            </div>
            <div className={styles.taskContent}>
              {!finished && current.teaching.includes('foundation') && (
                <div className={styles.lessonTeaching}>
                  <p>
                    <strong>Clinical objective.</strong> {lesson.objective}
                  </p>
                  <p>
                    <strong>Recall.</strong> {lesson.recall}
                  </p>
                  <h3>{lesson.concept}</h3>
                  {current.note && <p className={styles.notice}>{current.note}</p>}
                  {lesson.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <ul>
                    {lesson.checklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!finished && current.teaching.includes('worked') && (
                <section className={styles.workedExample}>
                  <h3>Worked example</h3>
                  <p>{lesson.worked.context}</p>
                  <p>
                    <strong>Reasoning.</strong> {lesson.worked.reasoning}
                  </p>
                </section>
              )}
              {!finished && current.recordTask && current.caseData && (
                <ExaminationWorkspace
                  key={current.id}
                  caseData={current.caseData}
                  task={current.recordTask}
                  source={
                    retained?.linked?.source &&
                    observation.linked?.source?.sessionId === retained.linked.source.sessionId &&
                    observation.frameReady
                      ? retained.linked.source
                      : undefined
                  }
                  readOnly={!!reviewId}
                  onComplete={() => setActions((value) => ({ ...value, [current.id]: true }))}
                />
              )}
              {!finished &&
                interactionDone &&
                safeFeedback &&
                (current.interaction === 'matching' || current.interaction === 'sequence') && (
                  <p className={styles.notice}>
                    {current.interaction === 'matching'
                      ? lesson.matching?.explanation
                      : lesson.sequence?.explanation}
                  </p>
                )}
              {!finished && !interactionDone && !reviewId && (
                <>
                  {current.interaction === 'matching' && lesson.matching && (
                    <MatchingActivity
                      activity={lesson.matching}
                      onComplete={() => setActions((value) => ({ ...value, [current.id]: true }))}
                    />
                  )}
                  {current.interaction === 'sequence' && lesson.sequence && (
                    <SequenceActivity
                      sequence={lesson.sequence}
                      onComplete={() => setActions((value) => ({ ...value, [current.id]: true }))}
                    />
                  )}
                </>
              )}
              {!finished && question && (
                <QuestionBody
                  question={question}
                  selected={selected[question.id] ?? committed ?? ''}
                  committed={committed}
                  onSelect={(id) => {
                    if (!reviewId) setSelected((value) => ({ ...value, [question.id]: id }))
                  }}
                />
              )}
              {!finished &&
                current.image === 'held' &&
                runtimeLab?.goal === 'capture' &&
                retained?.recorded && (
                  <section className={styles.recordCard}>
                    <h3>Capture record</h3>
                    <p>
                      Recorded example {retained.recorded.segmentId} · Selected depth{' '}
                      {retained.depth / 10} cm · Two calipers saved in this activity.
                    </p>
                    <p>
                      Station identity and clinical borders are not validated by this control
                      exercise. No calibrated dimension, specimen or pathology is inferred.
                    </p>
                  </section>
                )}
              {!finished && current.interaction === 'acquire' && (
                <p role="status" className={styles.taskStatus}>
                  {reviewId
                    ? 'An earlier acquisition is not replayed during review.'
                    : labDone
                      ? 'The required acquisition is ready. Hold this image to interpret it.'
                      : 'Waiting for your acquisition. Preset loading and observer-camera movement earn no acquisition credit.'}
                </p>
              )}
              {!finished && current.teaching.includes('takeaways') && safeFeedback && (
                <section className={styles.lessonTeaching}>
                  <h3>Carry this into the next examination</h3>
                  <ul>
                    {lesson.takeaways.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {!finished && (current.interaction === 'acquire' || current.image === 'held') && (
                <p className={styles.muted}>{lesson.boundary}</p>
              )}
              {current.companion && !pendingQuestion && (
                <Link className={styles.secondary} href={lessonHref(current.companion)}>
                  Related concept: {LESSONS.find((entry) => entry.id === current.companion)?.title}
                </Link>
              )}
            </div>
          </div>
          <footer className={styles.taskAdvance}>
            <button
              className={styles.secondary}
              disabled={position === 0 && !reviewId}
              onClick={() =>
                setReviewId(
                  reviewId
                    ? activities[
                        Math.max(
                          0,
                          activities.findIndex((activity) => activity.id === reviewId) - 1,
                        )
                      ].id
                    : activities[position - 1].id,
                )
              }
            >
              Back
            </button>
            {finished ? (
              <Link
                data-now-primary
                className={styles.button}
                href={next ? lessonHref(next.id) : BASE + '/assess'}
              >
                {next ? 'Continue to ' + next.title : 'Open final assessment'}
              </Link>
            ) : (
              <button
                data-now-primary
                className={styles.button}
                disabled={disabled}
                onClick={advance}
              >
                {primaryLabel}
              </button>
            )}
            {disabled && <p role="status">{disabledReason}</p>}
          </footer>
        </section>
        <div className={styles.flowFooter}>
          <p>
            First responses and completed lessons are saved in this browser. An unfinished activity
            restarts from the beginning of its lesson.
          </p>
          <SourceList ids={lesson.sources} />
        </div>
        <HelpDialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          title={dialog === 'outline' ? 'Course outline' : 'Help with this task'}
          returnFocusTo={dialogTrigger === 'outline' ? outlineButton : helpButton}
        >
          {dialog === 'outline' ? (
            <div className={styles.outline}>
              <ol aria-label="Tasks in this lesson">
                {activities.map((activity, ordinal) => (
                  <li key={activity.id}>
                    <button
                      disabled={ordinal >= position}
                      onClick={() => {
                        setReviewId(activity.id)
                        setDialog(null)
                      }}
                    >
                      {activity.title}
                      {ordinal < position ? ' · Review' : ''}
                    </button>
                  </li>
                ))}
              </ol>
              {CHAPTERS.map((entry) => (
                <section key={entry.id}>
                  <h3>{entry.title}</h3>
                  <ul>
                    {entry.lessons.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={lessonHref(item.id)}
                          aria-current={item.id === lesson.id ? 'page' : undefined}
                        >
                          {item.title}
                          {record.completed.includes(item.id) ? ' · Completed' : ''}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <>
              <p>{instruction}</p>
              <p>
                Use the controls beside the image. Tab moves between controls and out of the
                workbench; Back reviews an earlier task without repeating its actions.
              </p>
              <p>
                Restart begins a new acquisition and keeps your first responses. Exit retains
                completed lessons; the unfinished lesson starts over when reopened.
              </p>
              <p>{lesson.boundary}</p>
            </>
          )}
        </HelpDialog>
      </div>
    </EbusModuleFrame>
  )
}
