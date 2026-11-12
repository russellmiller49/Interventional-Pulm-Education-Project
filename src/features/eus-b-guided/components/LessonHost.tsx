'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard, type NowCardAction } from '@/features/learning-module/stage/NowCard'
import type { EusbHeld, EusbObservation } from '@/lib/eus-b-guided-bridge'
import {
  BASE,
  CHAPTERS,
  LESSONS,
  chapterOf,
  labStepFor,
  lessonHref,
  lessonNumber,
  lessonUsesLab,
  nextLesson,
} from '../content/curriculum'
import { eusbRequirements, eusbTaskMet, eusbViewShown } from '../content/tasks'
import type { Lesson, Step, StepKind } from '../content/types'
import { clearProgress, recordLocation, setLessonReviewed } from '../engine/progress'
import { ConsoleStrip } from './ConsoleStrip'
import { EusbModuleFrame } from './ModuleFrame'
import { QuestionBody } from './QuestionBody'
import { ReachTable } from './ReachTable'
import { SourceList } from './SourceList'
import { SurveyRoute } from './SurveyRoute'
import { Workbench, type StageRequest } from './Workbench'
import styles from './eus-b-guided.module.css'

/** What each kind of task is called in the task counter and the outline. */
export const STEP_KIND_LABEL: Record<StepKind, string> = {
  predict: 'Predict first',
  brief: 'Read',
  lab: 'Find the view',
  debrief: 'Explanation',
  check: 'Check',
}

type Arrange = 'hidden' | 'beside' | 'console'
type Answers = Record<string, { selected: string; committed?: string }>

/** A lesson, restartable: a restart is a fresh mount, so nothing from the earlier pass survives. */
export function LessonHost({ lesson, locale = 'en' }: { lesson: Lesson; locale?: string }) {
  const [run, setRun] = useState(0)
  return (
    <LessonRun
      key={lesson.id + '-' + run}
      lesson={lesson}
      locale={locale}
      run={run}
      onRestart={() => setRun((value) => value + 1)}
    />
  )
}

/** What the lab should show for a task, or nothing when the task has no image. */
function stageFor(
  lesson: Lesson,
  index: number,
  answers: Answers,
  explained: Record<string, boolean>,
  held: Record<string, EusbHeld>,
): StageRequest | null {
  const step = lesson.steps[index]
  if (!step) return null
  const base = { panes: ['ultrasound' as const] }
  const numbered = (stage: Omit<StageRequest, 'request'>): StageRequest => ({
    ...stage,
    request:
      index * 8 +
      (stage.phase === 'review' ? 4 : 0) +
      (stage.names === 'shown' ? 2 : 0) +
      (stage.held ? 1 : 0),
  })
  // A scope task also shows what the scope's own lens sees.
  if (step.kind === 'lab')
    return numbered({
      panes: ['ultrasound', 'endoscope'],
      labId: step.lab,
      phase: 'work',
      names: 'hidden',
    })
  if (step.kind === 'debrief') {
    const lab = labStepFor(lesson, step)
    if (!lab) return null
    const image = held[lab.id]
    return numbered({
      ...base,
      labId: lab.lab,
      phase: 'review',
      names: 'shown',
      held: image ? [image] : undefined,
    })
  }
  if (!step.view) return null
  if (step.kind === 'brief')
    return numbered({ ...base, labId: step.view, phase: 'review', names: 'shown' })
  // A question on an image: nothing is named until the learner has answered or opened the explanation.
  const open = !!answers[step.question.id]?.committed || !!explained[step.question.id]
  return numbered({
    ...base,
    labId: step.view,
    phase: 'review',
    names: open ? 'shown' : 'hidden',
  })
}

function useFixedWorkspace() {
  const [fixed, setFixed] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px) and (min-height: 700px)')
    if (!query) return
    const sync = () => setFixed(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return fixed
}

function LessonRun({
  lesson,
  locale,
  run,
  onRestart,
}: {
  lesson: Lesson
  locale: string
  run: number
  onRestart: () => void
}) {
  const steps = lesson.steps
  const [index, setIndex] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [explained, setExplained] = useState<Record<string, boolean>>({})
  const [held, setHeld] = useState<Record<string, EusbHeld>>({})
  const [labRun, setLabRun] = useState(0)
  const [observation, setObservation] = useState<EusbObservation | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const outlineButton = useRef<HTMLButtonElement>(null)
  const routeButton = useRef<HTMLButtonElement>(null)
  const textPane = useRef<HTMLDivElement>(null)
  const more = useRef<HTMLDetailsElement>(null)
  const fixed = useFixedWorkspace()

  const finished = index >= steps.length
  const step: Step | undefined = steps[index]
  const usesLab = lessonUsesLab(lesson)

  useEffect(() => {
    recordLocation(lesson.id)
  }, [lesson.id])
  useEffect(() => {
    if (finished) setLessonReviewed(lesson.id)
  }, [finished, lesson.id])

  // A new task takes focus, so a keyboard or screen-reader user starts at its instruction.
  const entered = useRef(false)
  useEffect(() => {
    if (!entered.current) {
      entered.current = true
      return
    }
    textPane.current?.focus()
  }, [index])

  const goTo = useCallback(
    (target: number) => {
      const next = steps[target]
      if (next?.kind === 'lab') {
        // Entering a scope task always starts it fresh; an image held on an earlier pass is let go.
        setLabRun((value) => value + 1)
        setHeld((current) => {
          const rest = { ...current }
          delete rest[next.id]
          return rest
        })
      }
      setObservation(null)
      setIndex(target)
      setFurthest((value) => Math.max(value, Math.min(target, steps.length - 1)))
    },
    [steps],
  )
  const moveOn = useCallback(() => goTo(index + 1), [goTo, index])
  const onObservation = useCallback((next: EusbObservation) => setObservation(next), [])

  /*
   * The stage shows the current task's image. While the task has none, the lab is already told
   * about the next task that does, so it is drawn by the time the learner gets there; the stage
   * itself stays off screen.
   */
  const current = stageFor(lesson, index, answers, explained, held)
  const upcoming = useMemo(() => {
    for (let at = index + 1; at < steps.length; at += 1) {
      const stage = stageFor(lesson, at, {}, {}, {})
      if (stage) return stage
    }
    return null
  }, [lesson, index, steps.length])
  // Past the last image the lab keeps the one before, so going back a task does not reload it.
  let previous: StageRequest | null = null
  for (let at = Math.min(index, steps.length) - 1; at >= 0 && !previous; at -= 1)
    previous = stageFor(lesson, at, answers, explained, held)
  const stage = current ?? upcoming ?? previous
  const arrange: Arrange =
    !current || finished ? 'hidden' : step?.kind === 'lab' ? 'console' : 'beside'

  const kicker = step
    ? `Task ${index + 1} of ${steps.length} · ${STEP_KIND_LABEL[step.kind]}`
    : 'Lesson reviewed'
  const last = index === steps.length - 1
  const back: NowCardAction | undefined =
    index > 0 ? { label: 'Previous task', onActivate: () => goTo(index - 1) } : undefined
  const forward = (label: string): NowCardAction => ({
    label: last ? 'Finish lesson' : label,
    onActivate: moveOn,
  })

  let body: ReactNode = null
  if (finished) {
    const next = nextLesson(lesson.id)
    body = (
      <section className={styles.finish} data-lesson-finish>
        <p className={styles.eyebrow}>Lesson reviewed</p>
        <h2>{lesson.title}</h2>
        <ul>
          {lesson.takeaways.map((takeaway) => (
            <li key={takeaway}>{takeaway}</li>
          ))}
        </ul>
        <p className={styles.muted}>
          Reviewed means you reached the end of the lesson, whether you completed, skipped or only
          read its tasks.
        </p>
        <div className={styles.actions}>
          {next ? (
            <Link className={styles.button} href={lessonHref(next.id)} data-next-lesson>
              Next: {next.title}
            </Link>
          ) : (
            <Link className={styles.button} href={BASE} data-next-lesson>
              Back to the course overview
            </Link>
          )}
          <button type="button" className={styles.secondary} onClick={onRestart}>
            Go through this lesson again
          </button>
        </div>
        <SourceList ids={lesson.sources} />
        {!next && (
          <p className={styles.muted} data-course-boundary>
            The ultrasound images in this course are simulated from one patient’s CT. They show
            where each landmark lies and what surrounds it; they are not clinical recordings.
          </p>
        )}
      </section>
    )
  } else if (step?.kind === 'predict' || step?.kind === 'check') {
    const question = step.question
    const answer = answers[question.id] ?? { selected: '' }
    body = (
      <NowCard
        model={{
          kicker,
          heading: step.title,
          body: step.stem,
          back,
          pinActions: true,
          primary: forward(answer.committed ? 'Continue' : 'Continue without answering'),
        }}
      >
        <QuestionBody
          question={question}
          selected={answer.selected}
          committed={answer.committed}
          onSelect={(selected) =>
            setAnswers((all) => ({ ...all, [question.id]: { ...all[question.id], selected } }))
          }
          onCheck={() =>
            setAnswers((all) => ({
              ...all,
              [question.id]: { selected: answer.selected, committed: answer.selected },
            }))
          }
          onRetry={() => setAnswers((all) => ({ ...all, [question.id]: { selected: '' } }))}
          onExplanationChange={(open) =>
            setExplained((all) => ({ ...all, [question.id]: all[question.id] || open }))
          }
        />
      </NowCard>
    )
  } else if (step?.kind === 'brief') {
    const [lead, ...rest] = step.body
    body = (
      <NowCard
        model={{
          kicker,
          heading: step.title,
          back,
          pinActions: true,
          primary: forward('Continue'),
        }}
      >
        <div className={styles.prose} data-brief-figure={step.figure}>
          <div>
            <p>{lead}</p>
            {step.points && (
              <ol>
                {step.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ol>
            )}
            {rest.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {step.figure === 'survey-route' && <SurveyRoute current={lesson.stop} />}
          {step.figure === 'reach-table' && <ReachTable />}
        </div>
      </NowCard>
    )
  } else if (step?.kind === 'lab') {
    const requirements = eusbRequirements(step.lab, observation)
    const met = eusbTaskMet(step.lab, observation)
    const shown = eusbViewShown(step.lab, observation)
    body = (
      <ConsoleStrip
        kicker={kicker}
        title={step.title}
        instruction={step.instruction}
        requirements={requirements}
        met={met}
        primaryLabel={shown ? 'Continue with the view shown' : 'Continue with this image'}
        onContinue={() => {
          const image = shown ? observation?.target?.shownAt : observation?.target?.foundAt
          if (image) setHeld((all) => ({ ...all, [step.id]: image }))
          moveOn()
        }}
        onSkip={moveOn}
        onRestart={() => {
          setObservation(null)
          setLabRun((value) => value + 1)
        }}
      />
    )
  } else if (step?.kind === 'debrief') {
    const lab = labStepFor(lesson, step)
    const image = lab ? held[lab.id] : undefined
    const own = image?.source === 'learner'
    body = (
      <NowCard
        model={{
          kicker,
          heading: step.title,
          back,
          pinActions: true,
          primary: forward('Continue'),
        }}
      >
        <div className={styles.prose}>
          <div>
            {!own && (
              <p className={styles.muted} data-debrief-reference={image ? 'shown' : 'skipped'}>
                {image
                  ? 'You asked to be shown this view, so the image beside this text is the landmark as the course shows it.'
                  : 'You moved on without holding a view, so the image beside this text is the landmark as the course shows it.'}
              </p>
            )}
            {step.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {step.points && (
              <ul>
                {step.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>Point at a structure in the image to see its name.</p>
          </div>
        </div>
      </NowCard>
    )
  }

  const closeMore = () => more.current?.removeAttribute('open')
  const chapter = chapterOf(lesson.id)
  return (
    <EusbModuleFrame active="Learn" activity locale={locale}>
      <div
        className={styles.lesson}
        data-eusb-flow
        data-arrange={arrange}
        data-activity-id={step ? lesson.id + ':' + step.id : lesson.id + ':finished'}
        data-step-kind={step?.kind ?? 'finished'}
      >
        <header className={styles.lessonBar}>
          <div className={styles.lessonTitle}>
            <p className={styles.eyebrow}>
              Lesson {lessonNumber(lesson.id)} of {LESSONS.length}
              {chapter ? ' · ' + chapter.title : ''}
            </p>
            <h1>{lesson.title}</h1>
          </div>
          <div className={styles.lessonMeta}>
            <span data-task-counter>
              {finished ? 'All tasks seen' : `Task ${index + 1} of ${steps.length}`}
            </span>
            <progress
              max={steps.length}
              value={Math.min(index, steps.length)}
              aria-label="Tasks seen in this lesson"
            />
          </div>
          <div className={styles.lessonActions}>
            <button
              type="button"
              ref={outlineButton}
              className={styles.secondary}
              data-open-outline
              onClick={() => setOutlineOpen(true)}
            >
              Course outline
            </button>
            <button
              type="button"
              ref={routeButton}
              className={styles.secondary}
              data-open-survey-route
              onClick={() => setRouteOpen(true)}
            >
              Survey route
            </button>
            <details className={styles.more} ref={more}>
              <summary className={styles.secondary}>More</summary>
              <div className={styles.moreMenu}>
                <button
                  type="button"
                  data-restart-lesson
                  onClick={() => {
                    closeMore()
                    onRestart()
                  }}
                >
                  Restart lesson
                </button>
                <Link
                  href={lessonHref(LESSONS[0].id)}
                  data-restart-course
                  onClick={() => {
                    clearProgress()
                    closeMore()
                    // Already in the first lesson: the address does not change, so start it over here.
                    if (LESSONS[0].id === lesson.id) onRestart()
                  }}
                >
                  Restart course
                </Link>
                <Link href={BASE + '/learn'} data-exit-lesson>
                  Exit lesson
                </Link>
              </div>
            </details>
          </div>
        </header>
        <div className={styles.work}>
          <div className={styles.textPane} ref={textPane} tabIndex={-1} data-text-pane>
            {body}
          </div>
          {usesLab && stage && (
            <div className={styles.stagePane} hidden={arrange === 'hidden'} data-stage>
              <Workbench
                stage={stage}
                sessionId={`${lesson.id}-${run}-${labRun}`}
                locale={locale}
                fill={fixed}
                onObservation={onObservation}
              />
            </div>
          )}
        </div>
        <HelpDialog
          open={outlineOpen}
          onClose={() => setOutlineOpen(false)}
          title="Course outline"
          returnFocusTo={outlineButton}
        >
          <div className={styles.outline} data-outline>
            {CHAPTERS.map((entry) => (
              <section key={entry.id}>
                <h3>{entry.title}</h3>
                <ol start={lessonNumber(entry.lessons[0].id)}>
                  {entry.lessons.map((item) => (
                    <li key={item.id} aria-current={item.id === lesson.id ? 'page' : undefined}>
                      {item.id === lesson.id ? (
                        <>
                          <strong>{item.title}</strong>
                          <ol className={styles.outlineTasks}>
                            {steps.map((task, at) => (
                              <li key={task.id} aria-current={at === index ? 'step' : undefined}>
                                {at <= furthest ? (
                                  <button
                                    type="button"
                                    className={styles.inlineLink}
                                    onClick={() => {
                                      setOutlineOpen(false)
                                      goTo(at)
                                    }}
                                  >
                                    {STEP_KIND_LABEL[task.kind]}: {task.title}
                                  </button>
                                ) : (
                                  // A task not yet reached is named by its kind only.
                                  <span className={styles.muted}>{STEP_KIND_LABEL[task.kind]}</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <Link href={lessonHref(item.id)}>{item.title}</Link>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </HelpDialog>
        <HelpDialog
          open={routeOpen}
          onClose={() => setRouteOpen(false)}
          title="Survey route"
          returnFocusTo={routeButton}
        >
          <SurveyRoute current={lesson.stop} />
        </HelpDialog>
      </div>
    </EusbModuleFrame>
  )
}
