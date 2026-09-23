'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { CONTACT_MODE_LABELS } from '@/lib/ebus-model-contract'
import { BASE, CHAPTERS, LESSONS, chapterForLesson, lessonHref } from '../content/curriculum'
import { activitiesForLesson, type LessonActivity } from '../content/stage'
import { labGoalMet, labGoalRequirements, type Lesson, type Question } from '../content/types'
import {
  recordLocation,
  setLessonReviewed,
  setLessonReviewLater,
} from '../engine/selfPacedProgress'
import { retainedImageAvailable } from '../engine/evidence'
import { COURSE_NAV, EbusModuleFrame } from './ModuleFrame'
import { SourceList } from './SourceList'
import { TeachingDiagram } from './Diagram'
import { QuestionBody } from './QuestionBody'
import { MatchingActivity } from './MatchingActivity'
import { StationFigure } from './StationFigure'
import { SequenceActivity } from './SequenceActivity'
import { Workbench } from './Workbench'
import { ExaminationWorkspace } from './ExaminationWorkspace'
import { useCourseProgress } from './useCourseProgress'
import { useLessonChromeClearance } from './useLessonChromeClearance'
import { GlossaryTerms } from './Glossary'
import { CaseSpecimens } from './CaseSpecimens'
import { TroubleshootingFlow } from './TroubleshootingFlow'
import { GLOSSARY, glossaryForLesson } from '../content/glossary'
import styles from './course.module.css'

/**
 * One lesson, self-paced (EBUS-01, owner decision of 2026-09-14).
 *
 * Navigation is the learner's: every activity can be continued past, an unanswered check can be
 * skipped, an explanation opens before an answer, a wrong or unsafe response gets its feedback and
 * can be retried, and the outline jumps anywhere in the lesson or the course. None of that is
 * recorded: only the location, the lesson opened, the finish (which marks the lesson reviewed) and
 * "save for later" are saved, in `selfPacedProgress.ts`.
 *
 * What stays fixed is what the simulation can truthfully claim. A held image exists only after the
 * workbench reports a real acquisition that meets the lab goal and, for recorded labs, acknowledges
 * the paused frame (`labGoalMet`, `retainedImageAvailable`, the hold handshake). An image
 * interpretation check cannot be answered without that image, and skipping the acquisition holds
 * nothing. A record task is completed only when its check accepts the entries. The finish card lists
 * exactly what was and was not done in this session.
 */
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
type TaskOutcome = 'completed' | 'shown' | 'skipped'
const TASK_INTERACTIONS = ['matching', 'sequence', 'record']
/**
 * What each kind of activity is, in the learner's words (EBUS-PRE-REVIEW-04, part H). The eyebrow
 * printed the internal kind ("transfer", "application", "interpretation"); a check that sits beside
 * the lesson's key points now says it is guided practice instead of looking like an examination.
 */
const KIND_LABELS: Record<LessonActivity['kind'], string> = {
  briefing: 'Teaching',
  demonstration: 'Worked demonstration',
  application: 'Guided task',
  acquisition: 'Your acquisition',
  interpretation: 'Check',
  transfer: 'Guided practice · new situation',
  record: 'Case record',
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
  const { progress, status } = useCourseProgress()
  const activities = useMemo(() => activitiesForLesson(lesson), [lesson])
  const [activeId, setActiveId] = useState(activities[0].id)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questionPositions, setQuestionPositions] = useState<Record<string, number>>({})
  const [taskOutcomes, setTaskOutcomes] = useState<Record<string, TaskOutcome>>({})
  const [heldFor, setHeldFor] = useState<Record<string, boolean>>({})
  const [explanationOpen, setExplanationOpen] = useState<Record<string, boolean>>({})
  const [observation, setObservation] = useState<EbusObservation>(EMPTY_EBUS_OBSERVATION)
  const [retained, setRetained] = useState<EbusObservation | null>(null)
  const [finished, setFinished] = useState(false)
  const [holdRequested, setHoldRequested] = useState(false)
  const [dialogTrigger, setDialogTrigger] = useState<'outline' | 'help'>('help')
  const [dialog, setDialog] = useState<'outline' | 'help' | null>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const outlineButton = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const lessonFlow = useRef<HTMLDivElement>(null)
  const lessonChrome = useRef<HTMLDivElement>(null)
  useLessonChromeClearance(lessonFlow, lessonChrome)
  const [sessionId] = useState(() => lesson.id + '-' + Math.random().toString(36).slice(2))
  const position = activities.findIndex((activity) => activity.id === activeId)
  const current = activities.find((activity) => activity.id === (reviewId ?? activeId))!
  const active = activities[position]
  const runtimeActivity = activities
    .slice(0, position + 1)
    .findLast((activity) => activity.interaction === 'acquire')
  const runtimeLab = runtimeActivity?.task === 'changed-window' ? lesson.transferLab : lesson.lab
  const questionPosition = questionPositions[current.id] ?? 0
  const hasTask = TASK_INTERACTIONS.includes(current.interaction)
  const taskOutcome = taskOutcomes[current.id]
  const taskOpen = hasTask && !taskOutcome
  const questionSlot = taskOpen ? undefined : current.questions[questionPosition]
  const question = questionSlot ? lesson[questionSlot] : undefined
  const committed = question ? answers[question.id] : undefined
  const lastQuestion = !question || questionPosition >= current.questions.length - 1
  const missingImage =
    !!question && !retainedImageAvailable(question, runtimeLab, retained, observation)
  const labDone = !!runtimeLab && labGoalMet(runtimeLab, observation)
  /*
   * What the acquisition is still waiting for (EBUS-PRE-REVIEW-02, L7-3). Reported from the same
   * conditions the gate applies, so the learner can see which one is open instead of reading one
   * sentence that names a camera this lab does not have. Nothing here changes the gate.
   */
  const labOutstanding = runtimeLab
    ? labGoalRequirements(runtimeLab, observation).filter((requirement) => !requirement.met)
    : []
  const acquireStep = !reviewId && current.interaction === 'acquire'
  const onObservation = useCallback((value: EbusObservation) => {
    setObservation(value)
    // An actual reboot/error cancels an in-flight hold so recovery can reacquire.
    // A normal decoded-frame acknowledgement carries the current session.
    if (!value.ready && !value.acquisitionSession) setHoldRequested(false)
  }, [])
  const chapter = chapterForLesson(lesson.id)
  const lessonIndex = LESSONS.findIndex((entry) => entry.id === lesson.id)
  const following = LESSONS[lessonIndex + 1]
  const reviewed = progress.reviewedLessonIds.includes(lesson.id)
  const savedForLater = progress.reviewLaterLessonIds.includes(lesson.id)
  const foundation = activities.find((activity) => activity.teaching.includes('foundation'))
  useEffect(() => {
    recordLocation({ kind: 'lesson', id: lesson.id })
  }, [lesson.id])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [activeId, reviewId, questionPosition, finished])

  /** Move to a later activity. Crossing an acquisition starts it fresh: nothing is carried over. */
  function goTo(id: string) {
    const targetIndex = activities.findIndex((activity) => activity.id === id)
    if (targetIndex <= position) return
    const crossesAcquire = activities
      .slice(position + 1, targetIndex + 1)
      .some((activity) => activity.interaction === 'acquire')
    if (crossesAcquire) {
      setObservation(EMPTY_EBUS_OBSERVATION)
      setRetained(null)
      setHoldRequested(false)
    }
    setReviewId(null)
    setActiveId(id)
  }
  function moveOn() {
    if (!current.transitions.next) {
      setLessonReviewed(lesson.id, true)
      setFinished(true)
      return
    }
    goTo(current.transitions.next)
  }
  function holdAndMove(value: EbusObservation) {
    setRetained(value)
    setHeldFor((held) => ({ ...held, [current.id]: true }))
    setHoldRequested(false)
    moveOn()
  }
  /** The primary action: hold a real acquisition, or move on past whatever is in front of the learner. */
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
      holdAndMove(observation)
      return
    }
    if (taskOpen) {
      setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'skipped' }))
      if (current.questions.length) return
      moveOn()
      return
    }
    if (question && !lastQuestion) {
      setQuestionPositions((value) => ({ ...value, [current.id]: questionPosition + 1 }))
      return
    }
    moveOn()
  }
  /** Leave an acquisition without an image. Holds nothing; the next check then has no image. */
  function skipAcquisition() {
    setHoldRequested(false)
    setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'skipped' }))
    setRetained(null)
    moveOn()
  }
  /** Go back to the acquisition that feeds the current check, to hold an image for real. */
  function returnToAcquisition() {
    if (!runtimeActivity) return
    setTaskOutcomes((outcomes) => {
      const next = { ...outcomes }
      delete next[runtimeActivity.id]
      return next
    })
    setRetained(null)
    setHoldRequested(false)
    setReviewId(null)
    setActiveId(runtimeActivity.id)
  }
  function checkAnswer(item: Question) {
    if (missingImage) return
    const id = selected[item.id]
    if (!item.choices.some((choice) => choice.id === id)) return
    setAnswers((value) => ({ ...value, [item.id]: id }))
  }
  function retryAnswer(item: Question) {
    setAnswers((value) => {
      const next = { ...value }
      delete next[item.id]
      return next
    })
    setSelected((value) => ({ ...value, [item.id]: '' }))
  }
  const nextTitle = current.transitions.next
    ? activities.find((activity) => activity.id === current.transitions.next)!.title
    : null
  const finishOrNext = nextTitle ? 'Continue to ' + nextTitle : 'Finish lesson'
  const primaryLabel = holdRequested
    ? 'Holding the selected frame…'
    : reviewId
      ? 'Return to current task'
      : acquireStep
        ? 'Hold this acquisition'
        : taskOpen
          ? (nextTitle || current.questions.length ? 'Continue' : 'Finish lesson') +
            (current.interaction === 'record'
              ? ' without completing this record'
              : ' without completing this task')
          : question && !committed
            ? (nextTitle || !lastQuestion ? 'Continue' : 'Finish lesson') + ' without answering'
            : question && !lastQuestion
              ? 'Next check'
              : finishOrNext
  const primaryDisabled = holdRequested || (acquireStep && !labDone)
  /*
   * How much weight the advance control carries (EBUS-PRE-REVIEW-01, L1-7). It is always in the
   * same place and always says the same thing; only its prominence follows what it is offering.
   *
   *  - While a matching, sequence or record task is open it offers to leave that task
   *    uncompleted. That stays one click away and plainly labelled, but the brightest control on
   *    a screen whose point is the task should not be the one that skips it.
   *  - While the primary is disabled on an acquisition step there would otherwise be no prominent
   *    way forward at all, so "Continue without an image" carries the weight until a real
   *    acquisition enables "Hold this acquisition" and takes it back. Nothing about what either
   *    control does, or about the acquisition gate itself, changes here.
   */
  const advanceIsProminent = !(taskOpen && !reviewId) && !primaryDisabled
  const skipLeadsWhileDisabled = acquireStep && primaryDisabled && !holdRequested
  const disabledReason = holdRequested
    ? 'Waiting for the workbench to acknowledge the paused frame.'
    : 'Complete the acquisition to hold an image, or continue without one.'
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
    setHeldFor((held) => ({ ...held, [current.id]: true }))
    setHoldRequested(false)
    setActiveId(current.transitions.next)
  }, [holdRequested, current, observation, labDone])
  const showRuntime = !reviewId && ['live', 'held'].includes(current.image)
  /** The lesson's figure, when this activity shows one (EBUS-PRE-REVIEW-04: none for four lessons). */
  const figure = current.image === 'diagram' ? lesson.diagram : undefined
  const showDemo = !runtimeActivity && !reviewId && current.image === 'demonstration'
  /*
   * What the evidence beside the task actually is (EBUS-PRE-REVIEW-01: L3-8, L5-1, L9-4, L11-5).
   *
   * Four things appear in this pane and the learner could not tell them apart: the supplied
   * reference figure or diagram, the live workbench with nothing held yet, the frame this
   * session really acquired and held, and an authored demonstration. A held frame in particular
   * carried the instruction "This is the image you acquired. Interpret it", and the checks that
   * followed were not always about it — some describe a scenario in words and are answerable
   * without it. Saying which is which costs nothing and stops the pane from claiming more than
   * it is. Nothing here changes what is displayed, what is held, or which checks are open.
   */
  const evidenceKind = reviewId
    ? undefined
    : current.image === 'demonstration' && showDemo
      ? ('demonstration' as const)
      : current.image === 'held' && retained
        ? ('held' as const)
        : current.image === 'held'
          ? ('held-missing' as const)
          : current.image === 'live'
            ? ('live' as const)
            : ['reference', 'diagram'].includes(current.image)
              ? ('supplied' as const)
              : undefined
  const heldContactMode =
    retained?.model?.package === 'contact' ? retained.model.contactMode : undefined
  const evidenceLabel: Record<NonNullable<typeof evidenceKind>, string> = {
    /*
     * What counts, said once (EBUS-PRE-REVIEW-04, L5-2). The embedded demonstration also carried
     * "exploration does not complete your activity" beside a step counter that looked like
     * tracking. The counter now says it records nothing; this says what does.
     */
    demonstration:
      'Worked demonstration, not an acquisition of yours: nothing you do here is recorded. Your own acquisition is the next task, and it counts once you hold it. Continuing without one is allowed; the lesson summary then lists that task as “No image held”.',
    held:
      'Your held acquisition, from this session in this workbench.' +
      /*
       * Which of the five modelled contact conditions is actually held
       * (EBUS-PRE-REVIEW-02, carry-forward of L5-1). The workbench now reports it with the
       * observation, so the pane can say what the held frame is instead of leaving the learner
       * to assume it matches whichever state the next check happens to name. The wording of the
       * checks is untouched; this only stops the evidence claiming more than it is.
       */
      (heldContactMode
        ? ' Contact condition held: ' + CONTACT_MODE_LABELS[heldContactMode] + '.'
        : ''),
    'held-missing':
      'No acquisition is held in this session, so there is no image of yours to read here.',
    live: 'Live workbench. Nothing is held yet; what you see moves with the controls.',
    supplied: 'Supplied reference, authored for this course. It is not an acquisition of yours.',
  }
  /*
   * Whether the check in front of the learner is a reading of the held frame or a described
   * scenario. `imagePolicy` already carries that distinction — it is what decides whether a
   * check can be answered at all without a held image — so this only says out loud what the
   * content already declares. Rewording any question is a clinical change and is not done here.
   */
  const checkUsesHeldImage = question?.imagePolicy === 'retained-acquisition'
  const scenarioCheckBesideHeldImage = !!question && evidenceKind === 'held' && !checkUsesHeldImage
  /*
   * L5-1, presentation only (EBUS-PRE-REVIEW-04). A check that reads the held frame can name one
   * modelled contact condition while the learner held another: lesson 5's second check names the
   * reflector whatever was selected when the frame was held. The frame is not replaced, relabelled
   * or reconstructed, and the question is not reworded (that alignment is held for owner review).
   * What is said is only what is true: which condition is held, which one the check names, and
   * that the named one was inspected in this session — the activity cannot be held until all five
   * conditions have been inspected (`MODEL_STEPS.contact`, checked by `labGoalMet`).
   */
  const namedContactMode = checkUsesHeldImage ? question?.namesContactMode : undefined
  const heldConditionDiffers =
    evidenceKind === 'held' &&
    !!heldContactMode &&
    !!namedContactMode &&
    heldContactMode !== namedContactMode
  const reveal =
    current.image === 'held' && (!!committed || !!(question && explanationOpen[question.id]))
  const instruction =
    current.interaction === 'acquire'
      ? (runtimeLab?.instruction ?? current.instruction)
      : /*
         * A held activity's authored instruction is "This is the image you acquired. Interpret
         * it". It is not true of a check that describes a situation in words rather than reading
         * the frame, and it is not true at all when the acquisition was skipped and there is no
         * image of the learner's to interpret (EBUS-PRE-REVIEW-01, L5-1, L3-8, L11-5). The
         * evidence and the checks are unchanged; only the sentence that mis-described their
         * relationship is corrected.
         */
        evidenceKind === 'held-missing'
        ? 'No image of yours is held for this task. The checks below stay open: go back to the acquisition to hold one, read the explanation, or continue.'
        : heldConditionDiffers
          ? 'This check names a different contact condition (' +
            CONTACT_MODE_LABELS[namedContactMode!] +
            ') from the one your held image shows (' +
            CONTACT_MODE_LABELS[heldContactMode!] +
            '). Your held image stays as you acquired it. You inspected the condition the check names in the workbench before holding, so answer from that inspection.'
          : scenarioCheckBesideHeldImage
            ? 'The image you acquired stays beside this check. This one describes a situation in words, so answer it from the description.'
            : current.instruction
  const unavailableReason = !question
    ? undefined
    : !missingImage
      ? undefined
      : retained
        ? 'The held image is unavailable in the current view. Return to a supported width, or go back to the acquisition to hold a new image. The explanation stays open, and you can continue without answering.'
        : 'No image is held for this check because the acquisition was not completed in this session. Read the explanation, go back to acquire an image, or continue without answering.'

  /** What happened to an activity in this session — truthfully, for the outline and the finish card. */
  function activityStatus(activity: LessonActivity, index: number): string {
    if (!finished && index > position) return 'Not yet reached'
    if (!finished && index === position && !reviewId) return 'Current task'
    const checks = activity.questions.map((slot) => lesson[slot])
    const answered = checks.filter((item) => answers[item.id]).length
    const checkStatus = !checks.length
      ? ''
      : answered === checks.length
        ? checks.length === 1
          ? 'check answered'
          : 'both checks answered'
        : answered
          ? answered + ' of ' + checks.length + ' checks answered'
          : checks.length === 1
            ? 'check not answered'
            : 'checks not answered'
    switch (activity.interaction) {
      case 'read':
        return 'Read'
      case 'acquire':
        return heldFor[activity.id] ? 'Image acquired and held' : 'No image held'
      case 'questions':
        return checkStatus.charAt(0).toUpperCase() + checkStatus.slice(1)
      default: {
        const outcome = taskOutcomes[activity.id]
        const task =
          outcome === 'completed'
            ? 'Task completed'
            : outcome === 'shown'
              ? 'Answer shown, task not completed'
              : 'Task not completed'
        return checkStatus ? task + ' · ' + checkStatus : task
      }
    }
  }
  /*
   * The hint for the check on screen (EBUS-PRE-REVIEW-04, L1-9). A check that carries a passage
   * from this lesson's teaching shows that passage; the lesson's recall — which in lesson 1 is a
   * course prerequisite, not help with any check — is used only where no passage is authored.
   */
  const hint = (
    <>
      {question?.hint ? (
        <p data-hint-excerpt>
          <strong>From this lesson:</strong> {question.hint}
        </p>
      ) : (
        <p>{lesson.recall}</p>
      )}
      <ul>
        {lesson.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {foundation && !reviewId && (
        <p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setReviewId(foundation.id)}
          >
            Review this concept: {foundation.title}
          </button>
        </p>
      )}
    </>
  )

  return (
    <EbusModuleFrame locale={locale} active="Learn" activity>
      <div
        ref={lessonFlow}
        className={styles.lessonFlow}
        data-ebus-flow
        data-activity-id={current.id}
        data-presentation={current.presentation}
      >
        <nav className={styles.flowNav} aria-label="EBUS course">
          {COURSE_NAV.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              aria-current={item.title === 'Learn' ? 'page' : undefined}
            >
              {item.title}
            </Link>
          ))}
          <span>Unlisted preview · For education and supervised training</span>
        </nav>
        {/*
         * Lesson identity, the lesson controls and the task counter, kept together and kept in
         * view while the host scrolls the task heading (EBUS-PRE-REVIEW-01, L1-1). See
         * `useLessonChromeClearance` for how much room the scrolling reserves and when this
         * stops being pinned.
         */}
        <div className={styles.lessonChrome} ref={lessonChrome} data-lesson-chrome>
          <header className={styles.flowHeader}>
            <div>
              <p className={styles.eyebrow}>
                Lesson {lessonIndex + 1} of {LESSONS.length} · {chapter.title}
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
                  setDialog('help')
                }}
              >
                Help
              </button>
              <button
                className={styles.secondary}
                aria-pressed={savedForLater}
                onClick={() => setLessonReviewLater(lesson.id, !savedForLater)}
              >
                {savedForLater ? 'Saved for later' : 'Save for later'}
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
                ? 'Finished'
                : 'Task ' + (activities.indexOf(current) + 1) + ' of ' + activities.length}
            </span>
            <progress
              max={activities.length}
              value={finished ? activities.length : position}
              aria-label="Position in this lesson"
            />
            <span>
              {progress.reviewedLessonIds.length} of {LESSONS.length} lessons reviewed
            </span>
          </div>
        </div>
        {status === 'unavailable' && (
          <p role="status" className={styles.notice}>
            This browser is not saving your place in the course. Everything stays open; your place,
            reviewed marks and saved-for-later marks will not survive a reload.
          </p>
        )}
        {status === 'unreadable' && (
          <p role="status" className={styles.notice}>
            A saved course record in this browser could not be read. It has been left unchanged and
            nothing new is being saved. Everything stays open.
          </p>
        )}
        <section className={styles.taskSurface} data-now-card aria-labelledby="ebus-task-title">
          <div className={styles.taskHeading}>
            <p className={styles.eyebrow} data-activity-kind={current.kind}>
              {reviewId ? 'Review · Current activity paused' : KIND_LABELS[current.kind]}
            </p>
            <h2 id="ebus-task-title" ref={heading} tabIndex={-1}>
              {finished ? 'Lesson finished' : current.title}
            </h2>
            <p
              data-task-instruction
              data-instruction-evidence={
                !finished && !reviewId && scenarioCheckBesideHeldImage ? 'scenario' : undefined
              }
            >
              {finished
                ? 'This lesson is now marked reviewed in this browser. Reviewed means you reached the end of the lesson, whether you completed, skipped or only read its tasks; the list below shows which, for this session only. It does not grade your answers and is not a record of procedural competence.'
                : reviewId
                  ? 'Read the earlier task without repeating its actions. Your current acquisition remains paused.'
                  : instruction}
            </p>
            {!finished && !reviewId && current.purpose && (
              <p className={styles.purpose} data-activity-purpose>
                {current.purpose}
              </p>
            )}
          </div>
          <div
            className={styles.taskComposition}
            data-composition={current.presentation}
            /*
             * An acquisition step gives the workbench the room (EBUS-PRE-REVIEW-02, A). The
             * column beside it carries one short instruction and the status, so the split that
             * suits a reading task starves the one surface the learner is actually working in.
             */
            data-acquiring={current.interaction === 'acquire' && !reviewId ? 'true' : undefined}
          >
            <div
              className={styles.taskEvidence}
              hidden={
                finished ||
                (runtimeActivity
                  ? !showRuntime
                  : !showDemo && !(current.image === 'reference' || !!figure))
              }
            >
              {evidenceKind && (
                <p
                  className={styles.evidenceIdentity}
                  data-evidence-identity={evidenceKind}
                  role="note"
                >
                  {evidenceLabel[evidenceKind]}
                </p>
              )}
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
              ) : figure === 'specimens' ? (
                <CaseSpecimens />
              ) : figure === 'troubleshooting' ? (
                <TroubleshootingFlow />
              ) : figure ? (
                <TeachingDiagram kind={figure} />
              ) : null}
            </div>
            <div className={styles.taskContent}>
              {finished && (
                <section className={styles.lessonTeaching} data-session-summary>
                  <h3>What you did in this session</h3>
                  <ul className={styles.taskSummary}>
                    {activities.map((activity, index) => (
                      <li key={activity.id}>
                        {activity.title}: {activityStatus(activity, index)}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.muted}>
                    Nothing in this list is stored. Restart the lesson at any time to try a task
                    again.
                  </p>
                  <p>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setLessonReviewed(lesson.id, !reviewed)}
                    >
                      {reviewed ? 'Unmark as reviewed' : 'Mark as reviewed'}
                    </button>
                  </p>
                  {/*
                   * Where else the learner can go from here. The footer offers the next lesson,
                   * or the integrated cases after the last one; practice was never named in the
                   * flow at all (EBUS-PRE-REVIEW-01, L26-5). Both are optional and both are open
                   * now: practice is not a prerequisite for the cases.
                   */}
                  <div className={styles.actions} data-lesson-destinations>
                    <Link className={styles.secondary} href={BASE + '/practice'}>
                      Practice cases and labs
                    </Link>
                    <Link className={styles.secondary} href={BASE + '/assess'}>
                      Integrated cases
                    </Link>
                  </div>
                  <p className={styles.muted}>
                    Either is open at any time, in any order, before or after the remaining lessons.
                  </p>
                </section>
              )}
              {!finished && current.teaching.includes('foundation') && (
                <div className={styles.lessonTeaching}>
                  <p>
                    <strong>Clinical objective.</strong> {lesson.objective}
                  </p>
                  <p>
                    <strong>Recall.</strong> {lesson.recall}
                  </p>
                  {lesson.refreshers?.length ? (
                    <p className={styles.refreshers} data-refreshers>
                      Optional refreshers in separate courses, also in development (each opens in a
                      new tab; nothing here requires them):{' '}
                      {lesson.refreshers.map((item, index) => (
                        <span key={item.href}>
                          {index ? ' · ' : ''}
                          <Link href={item.href} target="_blank" rel="noopener">
                            {item.label}
                          </Link>{' '}
                          ({item.course})
                        </span>
                      ))}
                    </p>
                  ) : null}
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
                  {/* First-use definitions from the course's own teaching (NAV-3, L1-4, L15-4). */}
                  <GlossaryTerms
                    entries={glossaryForLesson(lesson.id)}
                    heading="Terms used in this lesson"
                    intro="Open a term for the course’s own definition. The full course glossary is under Help."
                    currentLessonId={lesson.id}
                  />
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
                  onComplete={() =>
                    setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'completed' }))
                  }
                />
              )}
              {!finished &&
                !taskOpen &&
                (current.interaction === 'matching' || current.interaction === 'sequence') && (
                  <p className={styles.notice} data-task-explanation>
                    {taskOutcome === 'skipped'
                      ? 'You continued without completing this task. '
                      : taskOutcome === 'shown'
                        ? 'You opened the answer to this task. '
                        : ''}
                    {current.interaction === 'matching'
                      ? lesson.matching?.explanation
                      : lesson.sequence?.explanation}
                  </p>
                )}
              {!finished && taskOpen && !reviewId && (
                <>
                  {current.interaction === 'matching' && lesson.matching && (
                    <MatchingActivity
                      activity={lesson.matching}
                      onComplete={() =>
                        setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'completed' }))
                      }
                      onReveal={() =>
                        setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'shown' }))
                      }
                    />
                  )}
                  {current.interaction === 'sequence' && lesson.sequence && (
                    <SequenceActivity
                      sequence={lesson.sequence}
                      onComplete={() =>
                        setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'completed' }))
                      }
                      onReveal={() =>
                        setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'shown' }))
                      }
                    />
                  )}
                </>
              )}
              {!finished && question && (
                <QuestionBody
                  key={question.id}
                  question={question}
                  selected={selected[question.id] ?? committed ?? ''}
                  committed={committed}
                  readOnly={!!reviewId}
                  unavailableReason={unavailableReason}
                  hint={hint}
                  onSelect={(id) => {
                    if (!reviewId) setSelected((value) => ({ ...value, [question.id]: id }))
                  }}
                  onCheck={() => checkAnswer(question)}
                  onRetry={() => retryAnswer(question)}
                  onExplanationChange={(open) =>
                    setExplanationOpen((value) => ({ ...value, [question.id]: open }))
                  }
                />
              )}
              {!finished && question && missingImage && runtimeActivity && !reviewId && (
                <p>
                  <button type="button" className={styles.secondary} onClick={returnToAcquisition}>
                    Back to the acquisition: {runtimeActivity.title}
                  </button>
                </p>
              )}
              {!finished &&
                current.image === 'held' &&
                runtimeLab?.goal === 'capture' &&
                retained?.recorded && (
                  <section className={styles.recordCard}>
                    <h3>Capture record</h3>
                    {/*
                     * The internal clip name ("Depth4_Gain_4") is replaced by what the recording
                     * is (EBUS-PRE-REVIEW-04, L10-4), read from the example the frame carries. An
                     * older frame without that description says only that it is a recorded
                     * teaching example. Either way it is a library recording, not the learner's
                     * patient image.
                     */}
                    <p data-capture-example>
                      {retained.recorded.example
                        ? 'Recorded teaching example at ' +
                          retained.recorded.example.depthCm +
                          ' cm depth, ' +
                          (retained.recorded.example.control === 'flow'
                            ? 'a flow-mode recording'
                            : retained.recorded.example.control +
                              ' example ' +
                              retained.recorded.example.index +
                              ' of ' +
                              retained.recorded.example.levels)
                        : 'Recorded teaching example'}{' '}
                      · Selected depth {retained.depth / 10} cm · Two calipers saved in this
                      activity.
                    </p>
                    <p>
                      Station identity and clinical borders are not validated by this control
                      exercise. No calibrated dimension, specimen or pathology is inferred.
                    </p>
                  </section>
                )}
              {!finished && current.interaction === 'acquire' && (
                <div role="status" className={styles.taskStatus} data-acquisition-status>
                  {reviewId ? (
                    <p>An earlier acquisition is not replayed during review.</p>
                  ) : labDone ? (
                    <p>The acquisition is ready. Hold this image to interpret it.</p>
                  ) : (
                    <>
                      <p>
                        Waiting for your acquisition.{' '}
                        {runtimeLab?.kind === 'knobology'
                          ? 'Selecting a recording is not yet an acquisition.'
                          : 'Loading a preset or moving the observer camera is not an acquisition.'}{' '}
                        You can also continue without an image; the next check then has nothing to
                        interpret.
                      </p>
                      {labOutstanding.length > 0 && (
                        <>
                          <p>Still open on this acquisition:</p>
                          <ul className={styles.taskSummary} data-acquisition-outstanding>
                            {labOutstanding.map((requirement) => (
                              <li key={requirement.id} data-requirement={requirement.id}>
                                {requirement.text}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              {!finished && current.teaching.includes('takeaways') && (
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
              {current.companion && (
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
            {acquireStep && !holdRequested && !finished && (
              <button
                type="button"
                className={
                  (skipLeadsWhileDisabled ? styles.button : styles.secondary) + ' ' + styles.skip
                }
                data-skip-acquisition
                data-prominent={skipLeadsWhileDisabled || undefined}
                onClick={skipAcquisition}
              >
                Continue without an image
              </button>
            )}
            {finished ? (
              <Link
                data-now-primary
                className={styles.button + ' ' + styles.advance}
                href={following ? lessonHref(following.id) : BASE + '/assess'}
              >
                {following ? 'Continue to ' + following.title : 'Open the integrated cases'}
              </Link>
            ) : (
              <button
                data-now-primary
                data-prominent={advanceIsProminent || undefined}
                className={
                  (advanceIsProminent ? styles.button : styles.secondary) + ' ' + styles.advance
                }
                disabled={primaryDisabled}
                onClick={advance}
              >
                {primaryLabel}
              </button>
            )}
            {/*
             * The footer keeps one row of controls and one line of explanation under it, whether
             * or not there is anything to explain (EBUS-PRE-REVIEW-02, L6-6). The note used to be
             * inserted only while the primary was disabled, and inserting a full-width line into
             * a wrapping flex row moved both buttons: becoming ready pulled "Continue without an
             * image" up into the place the disabled "Hold this acquisition" had just occupied,
             * under the pointer that was resting there. The slot is always present now, so
             * neither control moves when readiness changes.
             */}
            <p role="status" className={styles.advanceNote} data-advance-note>
              {primaryDisabled ? disabledReason : ''}
            </p>
          </footer>
        </section>
        <div className={styles.flowFooter}>
          <p>
            This browser saves only your place in the course, the lessons you have opened, finished
            or saved for later, and the cases you have opened. Responses, held images and help use
            are not stored. Reopening an unfinished lesson starts it from its first task.
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
                      aria-current={
                        !finished && ordinal === position && !reviewId ? 'step' : undefined
                      }
                      onClick={() => {
                        if (finished || ordinal < position) setReviewId(activity.id)
                        else if (ordinal > position) goTo(activity.id)
                        else setReviewId(null)
                        setDialog(null)
                      }}
                    >
                      {activity.title} · {activityStatus(activity, ordinal)}
                      {!finished && ordinal < position
                        ? ' · Review'
                        : !finished && ordinal > position
                          ? ' · Jump ahead'
                          : ''}
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
                          {progress.reviewedLessonIds.includes(item.id)
                            ? ' · Reviewed'
                            : progress.visitedLessonIds.includes(item.id)
                              ? ' · Opened'
                              : ''}
                          {progress.reviewLaterLessonIds.includes(item.id)
                            ? ' · Saved for later'
                            : ''}
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
                workbench; Back reviews an earlier task without repeating its actions; the course
                outline jumps to any task or lesson.
              </p>
              <p>
                Every check is optional: open the hint or the explanation first, check a response,
                try again, or continue without answering. Restart begins a new acquisition. Exit
                keeps your place; the unfinished lesson starts over when reopened.
              </p>
              <p>{lesson.boundary}</p>
              <GlossaryTerms
                entries={GLOSSARY}
                heading="Course glossary"
                intro="Definitions taken from the course’s own teaching. Terms the course uses without defining are not listed."
                currentLessonId={lesson.id}
              />
            </>
          )}
        </HelpDialog>
      </div>
    </EbusModuleFrame>
  )
}
