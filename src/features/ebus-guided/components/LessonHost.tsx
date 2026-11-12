'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { CONTACT_MODE_LABELS } from '@/lib/ebus-model-contract'
import {
  BASE,
  CHAPTERS,
  LESSONS,
  chapterForLesson,
  lessonHref,
  partsOf,
} from '../content/curriculum'
import { activitiesForLesson, labForActivity, type LessonActivity } from '../content/stage'
import {
  labGoalMet,
  labGoalRequirements,
  type Lab,
  type Lesson,
  type Question,
} from '../content/types'
import {
  recordLocation,
  setLessonReviewed,
  setLessonReviewLater,
} from '../engine/selfPacedProgress'
import { retainedImageAvailable } from '../engine/evidence'
import { COURSE_NAV, EbusModuleFrame } from './ModuleFrame'
import { SourceList } from './SourceList'
import { TeachingDiagram } from './Diagram'
import { NodeFeatureAtlas, NodeFeatureReading } from './NodeFeatureFigures'
import { QuestionBody } from './QuestionBody'
import { MatchingActivity } from './MatchingActivity'
import { StationFigure } from './StationFigure'
import { StationMap } from './StationMap'
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
import { ClipFigure } from './ClipFigure'
import { NeedleTipFigure } from './NeedleTipFigure'
import { StagingRecord } from './StagingRecord'

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
  prediction: 'Predict first',
  debrief: 'Your image',
  briefing: 'Teaching',
  demonstration: 'Worked example',
  application: 'Guided task',
  acquisition: 'Your acquisition',
  interpretation: 'Check',
  transfer: 'Guided practice · new situation',
  record: 'Case record',
}

/** Labs worked in the one-screen console: every linked acquisition, and the needle lab. */
function consoleLab(lab: Lab | undefined) {
  return (
    (lab?.kind === 'simulator' && !!lab.linkedLesson) ||
    (lab?.kind === 'model' && lab.modelPackage === 'needle')
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
  const [continueWhenReady, setContinueWhenReady] = useState(false)
  const [dialogTrigger, setDialogTrigger] = useState<'outline' | 'help' | 'stations'>('help')
  const [dialog, setDialog] = useState<'outline' | 'help' | 'stations' | null>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const outlineButton = useRef<HTMLButtonElement>(null)
  // The nodal map is one press away in every lesson (2026-11-10): it is the course's own map of
  // where each station lies, and the station, staging and sampling lessons all lean on it.
  const stationsButton = useRef<HTMLButtonElement>(null)
  /*
   * The lesson controls used on most tasks stay in the header; the four used once a lesson at
   * most (save, the two restarts, exit) sit behind "More" (flow review of 2026-11-10: six buttons
   * above every task). Outside press or Escape closes it; Escape returns focus to the button.
   */
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenu = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!moreOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!moreMenu.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMoreOpen(false)
      moreButton.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])
  const outlineList = useRef<HTMLDivElement>(null)
  // On opening the outline, the current lesson is brought to the middle of the list (as in ECMO).
  useEffect(() => {
    if (dialog !== 'outline') return
    const list = outlineList.current
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !current) return
    const offset = current.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTop += offset - (list.clientHeight - current.offsetHeight) / 2
  }, [dialog])
  const heading = useRef<HTMLHeadingElement>(null)
  const lessonFlow = useRef<HTMLDivElement>(null)
  const lessonChrome = useRef<HTMLDivElement>(null)
  const [sessionId] = useState(() => lesson.id + '-' + Math.random().toString(36).slice(2))
  const position = activities.findIndex((activity) => activity.id === activeId)
  const current = activities.find((activity) => activity.id === (reviewId ?? activeId))!
  const active = activities[position]
  /*
   * The content unit behind a step (consolidation of 2026-11-10). Most lessons are one unit; five
   * hold a second that used to be a lesson of its own, with its own lab, checks and boundary.
   * Everything a step shows or checks is read from its unit; the lesson keeps identity, order
   * and the saved marks.
   */
  const units = useMemo(() => partsOf(lesson), [lesson])
  const unitOf = (activity: LessonActivity) =>
    units.find((unit) => unit.id === activity.lessonId) ?? lesson
  const content = unitOf(current)
  // A lesson built from two units states its own objective once, on its first briefing.
  const firstBriefingId = activities.find((activity) =>
    activity.teaching.includes('foundation'),
  )?.id
  /*
   * The acquisition in force is the last one in the unbroken run of the active unit's steps. A
   * lesson with two labs must not carry the first lab's workbench into the second unit's
   * briefing, or back into a closing check that belongs to the first unit.
   */
  let runStart = position
  while (runStart > 0 && activities[runStart - 1].lessonId === active.lessonId) runStart -= 1
  const runtimeActivity = activities
    .slice(runStart, position + 1)
    .findLast((activity) => activity.interaction === 'acquire')
  const runtimeUnit = runtimeActivity ? unitOf(runtimeActivity) : unitOf(active)
  const runtimeLab = labForActivity(runtimeUnit, runtimeActivity)
  /*
   * One workbench session per lab. A unit's second station is a guided task like its first, so
   * the task alone cannot tell the two labs apart: without this the second lab would inherit the
   * first one's found landmarks and sweep.
   */
  const runtimeLabKey = runtimeActivity?.secondLab
    ? 'second-station'
    : (runtimeActivity?.task ?? 'guided')
  const questionPosition = questionPositions[current.id] ?? 0
  const hasTask = TASK_INTERACTIONS.includes(current.interaction)
  const taskOutcome = taskOutcomes[current.id]
  const taskOpen = hasTask && !taskOutcome
  const questionSlot = taskOpen ? undefined : current.questions[questionPosition]
  const question = questionSlot ? content[questionSlot] : undefined
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
  const labUnmet = runtimeLab
    ? labGoalRequirements(runtimeLab, observation).filter((requirement) => !requirement.met)
    : []
  /*
   * While a slider moves, the image is a frame behind for a moment, so the "wait for the image"
   * conditions go unmet and met again many times a second. Listing them made the to-do row and
   * the button flash on every step of a drag (owner feedback of 2026-10-11). They are not steps
   * the learner takes, so they are not listed, and a lab that is only waiting on them is shown as
   * it will be once the frame arrives. The gate itself still waits: `advance` checks `labDone`.
   */
  const labSteps = labUnmet.filter(
    (r) => !['ready', 'frame-ready', 'linked-frame', 'frame-matches-settings'].includes(r.id),
  )
  const labSettling = labUnmet.length > 0 && labSteps.length === 0
  const labShownDone = labDone || labSettling
  // "Move a control" says nothing once a more specific step is listed; any of those moves one.
  const labOutstanding =
    labSteps.length > 1 ? labSteps.filter((r) => r.id !== 'used-a-control') : labSteps
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
  // The teaching a check's hint can reopen: this unit's own briefing, once it has been shown.
  const foundation = activities
    .slice(0, position)
    .findLast(
      (activity) =>
        activity.teaching.includes('foundation') && activity.lessonId === current.lessonId,
    )
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
      if (!labDone) {
        // The button is shown ready while the image catches up; a click in that instant is
        // remembered and carried through when the frame arrives, instead of doing nothing.
        if (labSettling) setContinueWhenReady(true)
        return
      }
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
        ? 'Continue with this image'
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
  const primaryDisabled = holdRequested || (acquireStep && !labShownDone)
  /*
   * The filled button is always the task: hold the acquisition, move on once a task is done.
   * When the same control would instead leave a task or a check unanswered, it is a text link,
   * and so is "Continue without an image". The brightest control on a screen used to be the one
   * that skipped its point (visual review of 2026-10-07, item 7).
   */
  /*
   * A linked acquisition is worked in a console that fits one screen: task, checklist and the
   * Hold button in a strip, the three views under it, nothing to scroll (visual review of
   * 2026-10-07, item 1). The needle lab is laid out the same way: its handle, scope tip,
   * ultrasound picture and steps share one screen. Recorded-clip and the other model labs keep
   * the reading layout for now.
   */
  const consoleStage =
    !finished && !reviewId && current.interaction === 'acquire' && consoleLab(runtimeLab)
  useLessonChromeClearance(lessonFlow, lessonChrome, consoleStage)
  useEffect(() => {
    if (!continueWhenReady) return
    // Something the learner did reopened a step: the remembered click no longer applies.
    if (!acquireStep || (!labDone && !labSettling)) {
      setContinueWhenReady(false)
      return
    }
    if (!labDone) return
    setContinueWhenReady(false)
    advance()
    // `advance` reads the current render's state; it is called only when that state is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueWhenReady, labDone, labSettling, acquireStep])
  const advanceIsSkip =
    !reviewId && !holdRequested && !acquireStep && (taskOpen || (!!question && !committed))
  const advanceIsProminent = !advanceIsSkip
  const disabledReason = holdRequested
    ? 'Waiting for the workbench to acknowledge the paused frame.'
    : labOutstanding.length
      ? 'To turn this on: ' + labOutstanding[0].text
      : 'Loading the simulator…'
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

    setRetained(observation)
    setHeldFor((held) => ({ ...held, [current.id]: true }))
    setHoldRequested(false)
    setActiveId(current.transitions.next)
  }, [holdRequested, current, observation, labDone])
  const showRuntime = !reviewId && ['live', 'held'].includes(current.image)
  /** The lesson's figure, when this activity shows one (EBUS-PRE-REVIEW-04: none for four lessons). */
  const figure = current.image === 'diagram' ? (current.figure ?? content.diagram) : undefined
  /** A step that reads a patient recording shows it, whatever lab the lesson ran before it. */
  const clipSlug =
    figure === 'clip-doppler'
      ? 'doppler-node-vessels'
      : figure === 'clip-needle'
        ? 'needle-in-node'
        : undefined
  /** A step with a figure of its own shows that figure, not the lab the lesson ran before it. */
  const clipStep = !!clipSlug || figure === 'needle-tip' || figure === 'staging-summary'
  const showDemo = !runtimeActivity && !reviewId && current.image === 'demonstration'
  /*
   * A briefing with a live example shows a short lead, then the three views, then the rest of the
   * reading (flow review of 2026-11-10). With all of the text above it the example started below
   * the bottom of a 900 px screen, and a learner read 250 words before finding there was one.
   */
  const leadOnly = showDemo && !finished && current.teaching.includes('foundation')
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
            : ['reference', 'diagram'].includes(current.image) &&
                figure !== 'node-reading' &&
                // The capstone's record is the learner's own examination, not a reference figure.
                figure !== 'staging-summary'
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
    demonstration: 'Try the controls. Nothing on this screen is scored.',
    held:
      'The image you continued with.' +
      /*
       * Which of the five modelled contact conditions is actually held
       * (EBUS-PRE-REVIEW-02, carry-forward of L5-1). The workbench now reports it with the
       * observation, so the pane can say what the held frame is instead of leaving the learner
       * to assume it matches whichever state the next check happens to name. The wording of the
       * checks is untouched; this only stops the evidence claiming more than it is.
       */
      (heldContactMode ? ' Contact condition: ' + CONTACT_MODE_LABELS[heldContactMode] + '.' : ''),
    'held-missing': 'You continued without an image, so there is none to read here.',
    live: 'Live image. It moves with the controls.',
    supplied: 'Reference figure.',
  }
  /*
   * Whether the check in front of the learner is a reading of the held frame or a described
   * scenario. `imagePolicy` already carries that distinction — it is what decides whether a
   * check can be answered at all without a held image — so this only says out loud what the
   * content already declares. Rewording any question is a clinical change and is not done here.
   */
  const checkUsesHeldImage = question?.imagePolicy === 'retained-acquisition'
  const scenarioCheckBesideHeldImage = !!question && evidenceKind === 'held' && !checkUsesHeldImage
  /* A named condition can differ from a held frame. OD-01 now compares mechanisms without
   * naming a required held condition; preserve this support for explicitly named questions. */
  const namedContactMode = checkUsesHeldImage ? question?.namesContactMode : undefined
  const heldConditionDiffers =
    evidenceKind === 'held' &&
    !!heldContactMode &&
    !!namedContactMode &&
    heldContactMode !== namedContactMode
  // A debrief has no check to wait for: the learner's image is shown with its structures named.
  const reveal =
    current.image === 'held' &&
    (current.kind === 'debrief' || !!committed || !!(question && explanationOpen[question.id]))
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
        ? current.questions.length
          ? 'No image of yours is held for this task. The checks below stay open: go back to the acquisition to hold one, read the explanation, or continue.'
          : 'No image of yours is held for this task. Go back to the acquisition to hold one, or continue.'
        : question?.id === 'cutaway-observe'
          ? 'Compare the air-gap and reflector states you inspected in the echo schematic. Your held image stays as you acquired it; this comparison does not depend on which contact condition you held.'
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
    const checks = activity.questions.map((slot) => unitOf(activity)[slot])
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
        return heldFor[activity.id] ? 'Image acquired' : 'No image'
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
        <p>{content.recall}</p>
      )}
      <ul>
        {content.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {/* A prediction comes before the teaching, so there is no earlier concept to reopen. */}
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

  const recallAndRefreshers = (
    <>
      <p>
        <strong>Recall.</strong> {content.recall}
      </p>
      {content.refreshers?.length ? (
        <p className={styles.refreshers} data-refreshers>
          Optional refreshers in separate courses (each opens in a new tab; nothing here requires
          them):{' '}
          {content.refreshers.map((item, index) => (
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
    </>
  )
  const checklistAndTerms = (
    <>
      <ul>
        {content.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {/* First-use definitions from the course's own teaching (NAV-3, L1-4, L15-4). */}
      <GlossaryTerms
        entries={glossaryForLesson(content.id)}
        heading="Terms used in this lesson"
        intro="Open a term for its definition, source and limits. The full course glossary is under Help."
        currentLessonId={lesson.id}
      />
    </>
  )
  const workedExample = (
    <section className={styles.workedExample}>
      <h3>Worked example</h3>
      <p>{content.worked.context}</p>
      <p>
        <strong>Reasoning.</strong> {content.worked.reasoning}
      </p>
    </section>
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
          <span>For education and supervised training</span>
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
                ref={stationsButton}
                className={styles.secondary}
                data-open-station-map
                onClick={() => {
                  setDialogTrigger('stations')
                  setDialog('stations')
                }}
              >
                Station map
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
              <div className={styles.moreMenu} ref={moreMenu}>
                <button
                  ref={moreButton}
                  className={styles.secondary}
                  aria-expanded={moreOpen}
                  aria-controls="ebus-lesson-more"
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  More
                </button>
                <div
                  id="ebus-lesson-more"
                  className={styles.moreList}
                  hidden={!moreOpen}
                  data-lesson-more
                >
                  <button
                    className={styles.secondary}
                    aria-pressed={savedForLater}
                    onClick={() => setLessonReviewLater(lesson.id, !savedForLater)}
                  >
                    {savedForLater ? 'Saved for later' : 'Save for later'}
                  </button>
                  <button
                    className={styles.secondary}
                    onClick={() => {
                      setMoreOpen(false)
                      onRestart()
                    }}
                  >
                    Restart lesson
                  </button>
                  {/* The course's first lesson, at its first task. In the first lesson it restarts it. */}
                  {lessonIndex <= 0 ? (
                    <button
                      className={styles.secondary}
                      onClick={() => {
                        setMoreOpen(false)
                        onRestart()
                      }}
                      data-restart-course
                    >
                      Restart course
                    </button>
                  ) : (
                    <Link
                      className={styles.secondary}
                      href={lessonHref(LESSONS[0].id)}
                      data-restart-course
                    >
                      Restart course
                    </Link>
                  )}
                  <Link className={styles.secondary} href={BASE}>
                    Exit lesson
                  </Link>
                </div>
              </div>
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
        <section
          className={styles.taskSurface}
          data-now-card
          data-console={consoleStage || undefined}
          /*
           * Every other acquisition (model and recorded-clip labs) keeps its reading layout but
           * carries Back, the skip link and the primary button in the heading row, so the button
           * is not below a workbench taller than the screen (owner request of 2026-10-11).
           */
          data-top-advance={
            (!consoleStage && !finished && !reviewId && current.interaction === 'acquire') ||
            undefined
          }
          aria-labelledby="ebus-task-title"
        >
          <div className={styles.taskHeading}>
            <p className={styles.eyebrow} data-activity-kind={current.kind}>
              {reviewId
                ? 'Review · Current activity paused'
                : current.kind === 'debrief' && current.image !== 'held'
                  ? // An explanation read on a figure is not the learner's own image.
                    figure === 'staging-summary'
                    ? 'Your examination'
                    : 'Explanation'
                  : KIND_LABELS[current.kind]}
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
                ? 'This lesson is now marked reviewed in this browser. Reviewed means you reached the end of the lesson, whether you completed, skipped or only read its tasks; the list below shows which, for this session only.'
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
            /*
             * A briefing with a live example puts the text above and gives the example the full
             * width, so the three views and their controls sit in one row on one screen (owner
             * feedback of 2026-10-11). Beside the text the workbench was too narrow for a row
             * and stacked its views, and the controls scrolled away from the image they change.
             */
            data-stacked={
              (showDemo || figure === 'node-reading' || figure === 'staging-summary') && !finished
                ? 'true'
                : undefined
            }
            data-figure={figure}
          >
            <div
              className={styles.taskEvidence}
              hidden={
                finished ||
                (clipStep
                  ? false
                  : runtimeActivity
                    ? !showRuntime
                    : !showDemo && !(current.image === 'reference' || !!figure))
              }
            >
              {evidenceKind && evidenceKind !== 'held-missing' && (
                <p
                  className={styles.evidenceIdentity}
                  data-evidence-identity={evidenceKind}
                  role="note"
                >
                  {evidenceLabel[evidenceKind]}
                </p>
              )}
              {evidenceKind === 'held-missing' && runtimeActivity ? (
                // After a skip there is nothing to show. The pane used to draw a frame titled
                // "Retained ultrasound" beside a sentence saying no image was held.
                <div className={styles.emptyEvidence} data-evidence-identity="held-missing">
                  <strong>No image</strong>
                  <p>You continued without an image, so there is nothing of yours to read here.</p>
                  <button type="button" className={styles.button} onClick={returnToAcquisition}>
                    Go back and acquire one
                  </button>
                </div>
              ) : runtimeActivity && runtimeLab && !clipStep ? (
                // A step that reads a patient recording shows that, not the lesson's earlier lab.
                <Workbench
                  key={runtimeActivity.lessonId + ':' + runtimeLabKey}
                  lab={runtimeLab}
                  locked={
                    !!reviewId || holdRequested || active.interaction !== 'acquire' || finished
                  }
                  reveal={reveal && !reviewId}
                  sessionId={
                    sessionId +
                    '-' +
                    (units.length > 1 ? runtimeActivity.lessonId + '-' : '') +
                    runtimeLabKey
                  }
                  onObservation={onObservation}
                  console={consoleStage}
                />
              ) : showDemo && content.lab ? (
                <Workbench
                  key={content.id + ':demonstration'}
                  lab={content.lab}
                  locked={false}
                  reveal
                  demonstration
                  sessionId={sessionId + '-' + content.id + '-demonstration'}
                  onObservation={onObservation}
                  console={consoleLab(content.lab)}
                />
              ) : current.image === 'reference' && content.station ? (
                <StationFigure key={content.station} station={content.station} allowSelect />
              ) : figure === 'specimens' ? (
                <CaseSpecimens />
              ) : figure === 'troubleshooting' ? (
                <TroubleshootingFlow />
              ) : figure === 'node-features' ? (
                <NodeFeatureAtlas />
              ) : figure === 'node-reading' ? (
                <NodeFeatureReading />
              ) : clipSlug ? (
                // Labels on its paused frame open once the step's question is answered or explained.
                <ClipFigure
                  key={clipSlug}
                  clip={clipSlug}
                  unlocked={!!committed || !!(question && explanationOpen[question.id])}
                />
              ) : figure === 'station-map' ||
                figure === 'station-map-n' ||
                figure === 'station-map-access' ? (
                <StationMap
                  key={content.id + figure}
                  view={
                    figure === 'station-map-n'
                      ? 'n-category'
                      : figure === 'station-map-access'
                        ? 'access'
                        : 'stations'
                  }
                  station={content.station}
                />
              ) : figure === 'needle-tip' ? (
                <NeedleTipFigure />
              ) : figure === 'staging-summary' ? (
                <StagingRecord
                  scanned={(unitId) => !!heldFor[unitId + ':scan']}
                  answers={answers}
                />
              ) : figure === 'ultrasound' || figure === 'needle' ? (
                <TeachingDiagram kind={figure} />
              ) : null}
            </div>
            <div className={styles.taskContent} data-lead={leadOnly || undefined}>
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
                    <strong>Clinical objective.</strong>{' '}
                    {current.id === firstBriefingId ? lesson.objective : content.objective}
                  </p>
                  {!leadOnly && recallAndRefreshers}
                  <h3>{content.concept}</h3>
                  {current.note && <p className={styles.notice}>{current.note}</p>}
                  {(leadOnly ? content.paragraphs.slice(0, 1) : content.paragraphs).map(
                    (paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ),
                  )}
                  {!leadOnly && checklistAndTerms}
                </div>
              )}
              {!finished && !leadOnly && current.teaching.includes('worked') && workedExample}
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
                      ? content.matching?.explanation
                      : content.sequence?.explanation}
                  </p>
                )}
              {!finished &&
                taskOutcome === 'shown' &&
                current.interaction === 'matching' &&
                content.matching && (
                  <section
                    className={styles.sequence}
                    aria-label="The matches"
                    data-task-reference="matching"
                  >
                    <h3>The matches</h3>
                    <dl>
                      {content.matching.pairs.map((pair) => (
                        <div key={pair.id} className={styles.sequence}>
                          <dt>
                            <strong>{pair.cue}</strong>
                          </dt>
                          <dd>{pair.response}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
              {!finished &&
                taskOutcome === 'shown' &&
                current.interaction === 'sequence' &&
                content.sequence && (
                  <section
                    className={styles.sequence}
                    aria-label="The sequence"
                    data-task-reference="sequence"
                  >
                    <h3>The sequence</h3>
                    <ol style={{ listStylePosition: 'inside' }}>
                      {content.sequence.steps.map((step) => (
                        <li key={step.id}>{step.text}</li>
                      ))}
                    </ol>
                  </section>
                )}
              {!finished && taskOpen && !reviewId && (
                <>
                  {current.interaction === 'matching' && content.matching && (
                    <MatchingActivity
                      activity={content.matching}
                      onComplete={() =>
                        setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'completed' }))
                      }
                      onReveal={() =>
                        setTaskOutcomes((outcomes) => ({ ...outcomes, [current.id]: 'shown' }))
                      }
                    />
                  )}
                  {current.interaction === 'sequence' && content.sequence && (
                    <SequenceActivity
                      sequence={content.sequence}
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
                  ) : labShownDone ? (
                    <p>Ready. Select “Continue with this image”.</p>
                  ) : (
                    <>
                      <p data-acquisition-waiting>
                        Work through the steps below. You can also continue without an image; the
                        next check then has nothing to interpret.
                      </p>
                      {labOutstanding.length > 0 && (
                        <>
                          <p>Still to do:</p>
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
                    {content.takeaways.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {!finished &&
                content.boundary &&
                (current.interaction === 'acquire' || current.image === 'held') && (
                  <p className={styles.muted}>{content.boundary}</p>
                )}
              {current.companion && (
                <Link className={styles.secondary} href={lessonHref(current.companion)}>
                  Related concept: {LESSONS.find((entry) => entry.id === current.companion)?.title}
                </Link>
              )}
            </div>
            {leadOnly && (
              <div className={styles.taskMore} data-teaching-more>
                <div className={styles.lessonTeaching}>
                  <h3>In more detail</h3>
                  {content.paragraphs.slice(1).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {recallAndRefreshers}
                  {checklistAndTerms}
                </div>
                {current.teaching.includes('worked') && workedExample}
              </div>
            )}
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
                className={styles.skipLink + ' ' + styles.skip}
                data-skip-acquisition
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
                  (advanceIsProminent ? styles.button : styles.skipLink) + ' ' + styles.advance
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
              {/*
               * In the console the outstanding steps are listed right beside this button, so
               * repeating the first of them here said the same thing twice (flow review of
               * 2026-11-10). The note still explains a button that is waiting on something else.
               */}
              {primaryDisabled && !(consoleStage && labOutstanding.length) ? disabledReason : ''}
            </p>
          </footer>
        </section>
        <div className={styles.flowFooter}>
          <p>
            This browser saves your place in the course, the lessons you have opened, finished or
            saved for later, the cases you have opened, and the entries you make in a case record.
            Answers to checks, images and help use are not stored. Reopening an unfinished lesson
            starts it from its first task.
          </p>
          <SourceList ids={lesson.sources} />
        </div>
        <HelpDialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          title={
            dialog === 'outline'
              ? 'Course outline'
              : dialog === 'stations'
                ? 'Nodal station map'
                : 'Help with this task'
          }
          returnFocusTo={
            dialogTrigger === 'outline'
              ? outlineButton
              : dialogTrigger === 'stations'
                ? stationsButton
                : helpButton
          }
        >
          {dialog === 'stations' ? (
            // Opens on the stations view, not the N categories, so a staging check is not answered
            // by opening it; the learner can still switch views, as with any reference.
            <div className={styles.outline} data-station-map-dialog>
              <StationMap station={content.station} inDialog />
            </div>
          ) : dialog === 'outline' ? (
            /*
             * Laid out like the ECMO Sections list (owner request, 2026-11-04): every lesson
             * numbered 01–26 to match "Lesson 12 of 26" in the header, grouped under its chapter,
             * the current one highlighted with its tasks beneath it.
             */
            <div className={styles.outline} ref={outlineList} data-ebus-outline>
              <p className={styles.outlineIntro}>
                <strong>
                  Lesson {lessonIndex + 1} of {LESSONS.length}
                </strong>
                <small>Jump ahead or revisit any lesson or task</small>
              </p>
              {CHAPTERS.map((entry, chapterIndex) => (
                <section key={entry.id} aria-labelledby={`ebus-outline-chapter-${entry.id}`}>
                  <h3 id={`ebus-outline-chapter-${entry.id}`}>
                    Chapter {chapterIndex + 1} · {entry.title}
                  </h3>
                  <ol>
                    {entry.lessons.map((item) => {
                      const number = LESSONS.findIndex((other) => other.id === item.id) + 1
                      const current = item.id === lesson.id
                      const marks = [
                        progress.reviewedLessonIds.includes(item.id)
                          ? 'Reviewed'
                          : progress.visitedLessonIds.includes(item.id)
                            ? 'Opened'
                            : '',
                        progress.reviewLaterLessonIds.includes(item.id) ? 'Saved for later' : '',
                      ].filter(Boolean)
                      return (
                        <li key={item.id}>
                          <Link
                            href={lessonHref(item.id)}
                            aria-current={current ? 'page' : undefined}
                            className={styles.outlineLesson}
                          >
                            <span aria-hidden="true">{String(number).padStart(2, '0')}</span>
                            <span>
                              <strong>
                                <span className="sr-only">Lesson {number}: </span>
                                {item.title}
                              </strong>
                              {marks.length > 0 && <small>{' · ' + marks.join(' · ')}</small>}
                            </span>
                          </Link>
                          {current && (
                            <ol aria-label="Tasks in this lesson" className={styles.outlineTasks}>
                              {activities.map((activity, ordinal) => (
                                <li key={activity.id}>
                                  <button
                                    aria-current={
                                      !finished && ordinal === position && !reviewId
                                        ? 'step'
                                        : undefined
                                    }
                                    onClick={() => {
                                      if (finished || ordinal < position) setReviewId(activity.id)
                                      else if (ordinal > position) goTo(activity.id)
                                      else setReviewId(null)
                                      setDialog(null)
                                    }}
                                  >
                                    <span aria-hidden="true">Task {ordinal + 1}</span>
                                    <span>
                                      {activity.title} · {activityStatus(activity, ordinal)}
                                      {!finished && ordinal < position
                                        ? ' · Review'
                                        : !finished && ordinal > position
                                          ? ' · Jump ahead'
                                          : ''}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                      )
                    })}
                  </ol>
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
              {content.boundary && <p>{content.boundary}</p>}
              <GlossaryTerms
                entries={GLOSSARY}
                heading="Course glossary"
                intro="The terms this course uses, with where each comes from."
                currentLessonId={lesson.id}
              />
            </>
          )}
        </HelpDialog>
      </div>
    </EbusModuleFrame>
  )
}
