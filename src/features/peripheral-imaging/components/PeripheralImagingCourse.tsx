'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers3,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { LESSONS, OBJECTIVES } from '../data/lessons'
import { QUESTION_BY_ID } from '../data/questions'
import { SOURCES, REVIEWED_ON } from '../data/sources'
import { DECISION_GUIDE, GLOSSARY, MODALITIES } from '../data/resources'
import {
  answerKey,
  casePassed,
  commitAnswer,
  emptyProgress,
  lessonStatus,
  nextIncomplete,
  parseProgress,
  STORAGE_KEY,
} from '../lib/progress'
import type { Lesson, Phase, Progress, SourceId } from '../types'
import { ImagingLab, Scene3D } from './ImagingLab'
import styles from '../imaging.module.css'

type View = 'overview' | 'lesson' | 'guide' | 'glossary' | 'sources'
const phases: { id: Phase; title: string }[] = [
  { id: 'learn', title: 'Learn' },
  { id: 'lab', title: 'Explore' },
  { id: 'check', title: 'Check' },
  { id: 'debrief', title: 'Review' },
]
const groups = Array.from(new Set(LESSONS.map((lesson) => lesson.group)))
const totalMinutes = LESSONS.reduce((total, lesson) => total + lesson.minutes, 0)
const labCount = new Set(LESSONS.flatMap((lesson) => (lesson.lab ? [lesson.lab] : []))).size

function SourceLinks({ ids }: { ids: SourceId[] }) {
  if (!ids.length) return null
  return (
    <div className={styles.sourceLinks}>
      <span>Published sources</span>
      {ids.map((id) => {
        const index = SOURCES.findIndex((source) => source.id === id),
          source = SOURCES[index]
        return (
          <a key={id} href={source.url} target="_blank" rel="noreferrer" title={source.title}>
            [{index + 1}] {source.authors.split(',')[0].replace(/\.$/, '')} · {source.year}
          </a>
        )
      })}
    </div>
  )
}

function KnowledgeCheck({
  lesson,
  progress,
  onCommit,
  onReview,
  onAcknowledge,
}: {
  lesson: Lesson
  progress: Progress
  onCommit: (id: string, choice: string) => void
  onReview: () => void
  onAcknowledge: () => void
}) {
  const [selection, setSelection] = useState<string | null>(null)
  const status = lessonStatus(progress, lesson)
  const questionId = lesson.checkIds.find((id) => !progress.answers[answerKey(lesson.id, id)])
  const displayedId = progress.feedbackQuestion[lesson.id] ?? questionId
  const question = displayedId ? QUESTION_BY_ID[displayedId] : null
  const attempt = displayedId ? progress.answers[answerKey(lesson.id, displayedId)] : undefined
  if (!question)
    return (
      <div className={styles.checkCard}>
        <h3>All decisions recorded</h3>
        <p>Your first decisions have been saved. Review the explanations to complete this unit.</p>
        <button type="button" className={styles.primary} onClick={onReview}>
          Review this unit <ArrowRight size={17} />
        </button>
      </div>
    )
  return (
    <div className={styles.checkCard}>
      <div className={styles.eyebrow}>
        Authored case · Decision {lesson.checkIds.indexOf(question.id) + 1} of{' '}
        {lesson.checkIds.length}
        {lesson.id !== 'suite-cases' && lesson.checkIds.indexOf(question.id) > 0
          ? ' · Earlier concept revisited'
          : ''}
      </div>
      <h2 className={styles.questionStem} id="imaging-question">
        {question.stem}
      </h2>
      <fieldset className={styles.choices} aria-labelledby="imaging-question">
        <legend className={styles.srOnly}>Select the single best response</legend>
        {question.choices.map((choice, i) => (
          <label
            key={choice.id}
            className={
              styles.choice + (attempt?.choice === choice.id ? ' ' + styles.committedChoice : '')
            }
          >
            <input
              type="radio"
              name={question.id}
              value={choice.id}
              checked={(attempt?.choice ?? selection) === choice.id}
              disabled={Boolean(attempt)}
              onChange={() => setSelection(choice.id)}
            />
            <span className={styles.choiceLetter}>{String.fromCharCode(65 + i)}</span>
            <span>{choice.text}</span>
          </label>
        ))}
      </fieldset>
      {!attempt ? (
        <>
          <p className={styles.small}>
            Choose your response, then commit to see the reasoning. There is no time limit.
          </p>
          <button
            className={styles.primary}
            type="button"
            disabled={!selection}
            onClick={() => {
              if (selection) {
                onCommit(question.id, selection)
              }
            }}
          >
            Commit response <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <div className={styles.feedback} role="status">
          <div className={styles.feedbackVerdict}>
            {attempt.correct ? <CheckCircle2 size={22} /> : <BookOpen size={22} />}
            <strong>{attempt.correct ? 'Correct reasoning' : 'A point to revisit'}</strong>
          </div>
          <p>{question.choices.find((choice) => choice.id === attempt.choice)?.rationale}</p>
          {!attempt.correct && (
            <p>
              <strong>Best response:</strong>{' '}
              {question.choices.find((choice) => choice.id === question.correct)?.text}{' '}
              {question.choices.find((choice) => choice.id === question.correct)?.rationale}
            </p>
          )}
          <details>
            <summary>Reasoning for every option</summary>
            {question.choices.map((choice) => (
              <p key={choice.id}>
                <strong>{choice.text}</strong> {choice.rationale}
              </p>
            ))}
          </details>
          <p className={styles.takeawayLine}>{question.takeaway}</p>
          <SourceLinks ids={question.sources} />
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              setSelection(null)
              onAcknowledge()
              if (status.allAnswered) onReview()
            }}
          >
            {status.allAnswered ? 'Review this unit' : 'Continue to the next decision'}{' '}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  )
}

export function PeripheralImagingCourse() {
  const [progress, setProgress] = useState<Progress>(emptyProgress)
  const [loaded, setLoaded] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  const [view, setView] = useState<View>('overview')
  const [query, setQuery] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [mobilePath, setMobilePath] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const lesson = LESSONS.find((item) => item.id === progress.lessonId) ?? LESSONS[0]
  const completed = LESSONS.filter((item) => lessonStatus(progress, item).complete).length
  const remaining = LESSONS.filter((item) => !lessonStatus(progress, item).complete).reduce(
    (total, item) => total + item.minutes,
    0,
  )
  const next = nextIncomplete(progress)
  const currentStatus = lessonStatus(progress, lesson)
  const allDone = completed === LESSONS.length
  const resumable =
    loaded &&
    Boolean(
      Object.keys(progress.answers).length ||
      Object.keys(progress.labValues).length ||
      progress.lessonId !== LESSONS[0].id ||
      progress.phase !== 'learn',
    )
  const resumeLesson = currentStatus.complete ? next : lesson

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setProgress(parseProgress(window.localStorage.getItem(STORAGE_KEY)))
      } catch {
        setStorageOk(false)
      }
      setLoaded(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (!loaded) return
    let available = true
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      available = false
    }
    if (available !== storageOk) {
      const timer = window.setTimeout(() => setStorageOk(available), 0)
      return () => window.clearTimeout(timer)
    }
  }, [loaded, progress, storageOk])
  const focusContent = useCallback(
    () =>
      requestAnimationFrame(() => {
        heading.current?.focus({ preventScroll: true })
        heading.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
      }),
    [],
  )
  const navigate = (newView: View) => {
    setView(newView)
    setMobilePath(false)
    focusContent()
  }
  const openLesson = (id: string, phase: Phase = 'learn') => {
    setProgress((p) => ({ ...p, lessonId: id, phase }))
    navigate('lesson')
  }
  const changePhase = (phase: Phase) => {
    setProgress((p) => ({ ...p, phase }))
    focusContent()
  }
  const reviewUnit = () => {
    changePhase('debrief')
  }
  const completeAndContinue = () => {
    if (!currentStatus.allAnswered) return
    const updated = {
      ...progress,
      reviewed: Array.from(new Set([...progress.reviewed, lesson.id])),
    }
    const destination = nextIncomplete(updated)
    setProgress(destination ? { ...updated, lessonId: destination.id, phase: 'learn' } : updated)
    navigate(destination ? 'lesson' : 'overview')
  }
  const onLabChange = useCallback(
    (values: Record<string, string | number | boolean>) =>
      setProgress((p) => ({ ...p, labValues: { ...p.labValues, [p.lessonId]: values } })),
    [],
  )
  const lessonIndex = LESSONS.indexOf(lesson)
  const nextAfterReview = LESSONS.find(
    (item) => item.id !== lesson.id && !lessonStatus(progress, item).complete,
  )
  const title =
    view === 'overview'
      ? 'See the target. Understand the image.'
      : view === 'lesson'
        ? lesson.title
        : view === 'guide'
          ? 'The imaging decision guide'
          : view === 'glossary'
            ? 'Imaging language, explained'
            : 'The published evidence'
  return (
    <div className={styles.course}>
      <a className={styles.skipLink} href="#imaging-content">
        Skip the course navigation
      </a>
      <div className={styles.courseTopbar}>
        <button type="button" className={styles.brand} onClick={() => navigate('overview')}>
          <ScanLine size={22} />
          <span>
            FluoroView <b>Imaging Academy</b>
          </span>
        </button>
        <span className={styles.topbarMeta}>Peripheral bronchoscopy</span>
      </div>
      <div className={styles.courseNavigation}>
        <nav aria-label="Course resources">
          {(
            [
              ['overview', 'Course'],
              ['guide', 'Imaging guide'],
              ['glossary', 'Glossary'],
              ['sources', 'References'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              aria-current={
                view === id || (id === 'overview' && view === 'lesson') ? 'page' : undefined
              }
            >
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.topProgress}>
          <span>
            {completed}/{LESSONS.length} complete
          </span>
          <progress max={LESSONS.length} value={completed} aria-label="Course completion" />
        </div>
      </div>
      {!storageOk && (
        <p role="status" className={styles.storageNotice}>
          Browser storage is unavailable. You can use the whole course, but progress may not survive
          closing or reloading this page.
        </p>
      )}
      <div className={styles.layout}>
        <aside className={styles.pathway} aria-label="Learning pathway">
          <button
            type="button"
            className={styles.mobilePathButton}
            aria-expanded={mobilePath}
            onClick={() => setMobilePath(!mobilePath)}
          >
            Learning pathway · {completed}/{LESSONS.length} <ChevronRight size={18} />
          </button>
          <div className={mobilePath ? styles.pathContentsOpen : styles.pathContents}>
            <div className={styles.pathTitle}>
              <span className={styles.eyebrow}>Your learning pathway</span>
              <p>
                {LESSONS.length} units · about {totalMinutes} min
              </p>
            </div>
            {groups.map((group) => (
              <div className={styles.pathGroup} key={group}>
                <h2>{group}</h2>
                <ol>
                  {LESSONS.filter((item) => item.group === group).map((item) => {
                    const status = lessonStatus(progress, item),
                      active = view === 'lesson' && item.id === lesson.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={active ? styles.activeLesson : undefined}
                          aria-current={active ? 'step' : undefined}
                          onClick={() => openLesson(item.id)}
                        >
                          <span className={styles.pathNumber}>
                            {status.complete ? (
                              <Check size={14} />
                            ) : (
                              String(LESSONS.indexOf(item) + 1).padStart(2, '0')
                            )}
                          </span>
                          <span>
                            {item.title}
                            <small>
                              {item.minutes} min ·{' '}
                              {status.complete
                                ? status.needsReview
                                  ? 'Complete · review needed'
                                  : 'Complete'
                                : status.answered
                                  ? 'In progress'
                                  : 'Read' + (item.lab ? ' · explore' : '') + ' · check'}
                            </small>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
            <div className={styles.pathFooter}>
              <span>Progress stays in this browser.</span>
              <button type="button" onClick={() => setShowReset(true)}>
                <RotateCcw size={13} /> Reset course progress
              </button>
              {showReset && (
                <div className={styles.resetConfirm}>
                  <p>Clear this course’s answers, lab settings and saved position?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setProgress(emptyProgress())
                      setShowReset(false)
                      navigate('overview')
                    }}
                  >
                    Clear course progress
                  </button>
                  <button type="button" onClick={() => setShowReset(false)}>
                    Keep progress
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
        <div
          className={styles.main}
          id="imaging-content"
          role="region"
          aria-label="Imaging course content"
        >
          {view === 'overview' ? (
            <>
              <section className={styles.hero}>
                <div className={styles.heroCopy}>
                  <div className={styles.eyebrow}>A practical course for the bronch suite</div>
                  <h1 ref={heading} tabIndex={-1}>
                    {title}
                  </h1>
                  <p>
                    Learn to choose, optimize, and interpret imaging for peripheral
                    bronchoscopy—from a useful fluoroscopic view to confident assessment of the
                    sampling tool.
                  </p>
                  <div className={styles.heroTags}>
                    <span>
                      <Clock3 size={14} /> {totalMinutes} min in short units
                    </span>
                    <span>
                      <Layers3 size={14} /> {labCount} interactive labs
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!loaded}
                    onClick={() => {
                      if (allDone) openLesson('suite-cases', 'debrief')
                      else if (resumeLesson)
                        openLesson(
                          resumeLesson.id,
                          resumeLesson.id === lesson.id && !currentStatus.complete
                            ? progress.phase
                            : 'learn',
                        )
                    }}
                  >
                    {!loaded
                      ? 'Loading your progress…'
                      : allDone
                        ? 'Review your case results'
                        : resumable
                          ? 'Continue — ' + resumeLesson?.title
                          : 'Start — ' + LESSONS[0].title}
                    <ArrowRight size={18} />
                  </button>
                  {resumable && !allDone && (
                    <p className={styles.resumeLine}>
                      About {remaining} min of unfinished units · resume where you left off
                    </p>
                  )}
                </div>
                <div className={styles.heroVisual}>
                  <div className={styles.visualEyebrow}>Explore the geometry of imaging</div>
                  <Scene3D orbit={-18} tilt={8} compact />
                  <p>CT-derived anatomy · original FluoroView C-arm · drag to inspect</p>
                </div>
              </section>
              <div className={styles.audience}>
                <div>
                  <span className={styles.eyebrow}>Who this is for</span>
                  <p>
                    Pulmonary and IP fellows, bronchoscopists, and imaging team members. Assumes
                    basic chest CT anatomy and familiarity with bronchoscopy.
                  </p>
                </div>
                <div>
                  <span className={styles.eyebrow}>How to use it</span>
                  <p>
                    Follow the pathway in short sittings: learn, explore, commit a decision, and
                    review the reasoning. All units remain available for focused review.
                  </p>
                </div>
              </div>
              {allDone && (
                <section className={styles.completion}>
                  <CheckCircle2 size={28} />
                  <div>
                    <h2>Course complete</h2>
                    <p>
                      {casePassed(progress)
                        ? 'Independent case check passed.'
                        : 'Independent case check: review needed.'}{' '}
                      Completion records participation and reviewed decisions. Supervised C-arm
                      operation, anesthesia, biopsy training and local radiation credentialing
                      remain necessary.
                    </p>
                  </div>
                </section>
              )}
              <section className={styles.objectiveSection}>
                <div className={styles.sectionTitle}>
                  <div>
                    <span className={styles.eyebrow}>What you will be able to decide</span>
                    <h2>One procedure. Different information.</h2>
                  </div>
                  <Target size={26} />
                </div>
                <div className={styles.objectiveGrid}>
                  {OBJECTIVES.map((objective, i) => (
                    <article key={objective.id}>
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <h3>{objective.title}</h3>
                      <p>{objective.description}</p>
                    </article>
                  ))}
                </div>
              </section>
              <section className={styles.boundary}>
                <ShieldCheck size={24} />
                <div>
                  <h2>Learn the reasoning. Build the practical skill under supervision.</h2>
                  <p>
                    For education only. Models combine CT-derived anatomy with authored targets and
                    illustrative values, and do not predict patient dose, safe tool placement,
                    diagnostic yield, or actual equipment performance. Follow current device
                    instructions, local protocols, and operator, anesthesia and medical-physics
                    judgment.
                  </p>
                </div>
              </section>
              <section className={styles.modalitySection}>
                <div className={styles.sectionTitle}>
                  <div>
                    <span className={styles.eyebrow}>The information landscape</span>
                    <h2>Choose the question before the technology.</h2>
                  </div>
                </div>
                <div className={styles.modalityGrid}>
                  {MODALITIES.map((mode) => (
                    <button type="button" key={mode.name} onClick={() => openLesson(mode.lesson)}>
                      <h3>{mode.name}</h3>
                      <p>{mode.information}</p>
                      <span>
                        Explore in the pathway <ArrowRight size={15} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : view === 'lesson' ? (
            <>
              <div className={styles.breadcrumb}>
                <button type="button" onClick={() => navigate('overview')}>
                  Course
                </button>
                <ChevronRight size={13} />
                <span>{lesson.group}</span>
                <ChevronRight size={13} />
                <span>
                  {lessonIndex + 1} of {LESSONS.length}
                </span>
              </div>
              <header className={styles.lessonHeader} role="group" aria-label="Unit orientation">
                <div className={styles.eyebrow}>
                  {lesson.stage} · about {lesson.minutes} min
                </div>
                <h1 ref={heading} tabIndex={-1}>
                  {lesson.title}
                </h1>
                <p>
                  {progress.phase === 'check'
                    ? 'Apply what you have learned to a new decision. Commit before revealing the reasoning.'
                    : lesson.outcome}
                </p>
                {progress.phase !== 'check' && (
                  <p className={styles.why}>
                    <strong>In the suite:</strong> {lesson.why}
                  </p>
                )}
              </header>
              <nav className={styles.phaseNav} aria-label="Unit stages">
                {phases
                  .filter((phase) => phase.id !== 'lab' || lesson.lab)
                  .map((phase, i) => (
                    <button
                      type="button"
                      key={phase.id}
                      aria-current={progress.phase === phase.id ? 'step' : undefined}
                      disabled={phase.id === 'debrief' && !currentStatus.allAnswered}
                      title={
                        phase.id === 'debrief' && !currentStatus.allAnswered
                          ? 'Commit each unit response to open Review'
                          : undefined
                      }
                      onClick={() => changePhase(phase.id)}
                    >
                      <span>{i + 1}</span>
                      {phase.title}
                    </button>
                  ))}
              </nav>
              {progress.phase === 'learn' && (
                <div className={styles.lessonBody}>
                  <details className={styles.recall}>
                    <summary>Recall before you begin: {lesson.recall.prompt}</summary>
                    <p>{lesson.recall.answer}</p>
                  </details>
                  {lesson.blocks.map((block) => (
                    <section className={styles.teachingBlock} key={block.title}>
                      <h2>{block.title}</h2>
                      <p>{block.body}</p>
                      {block.points && (
                        <ul>
                          {block.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      )}
                      {block.detail && (
                        <details className={styles.deepDive}>
                          <summary>{block.detail.title}</summary>
                          <p>{block.detail.body}</p>
                        </details>
                      )}
                      <SourceLinks ids={block.sources} />
                    </section>
                  ))}
                  <section className={styles.worked}>
                    <span className={styles.eyebrow}>
                      {lesson.id === 'suite-cases'
                        ? 'Prepare your reasoning'
                        : 'Worked example · not scored'}
                    </span>
                    <h2>{lesson.worked.scenario}</h2>
                    <p>{lesson.worked.reasoning}</p>
                  </section>
                  <div className={styles.nextBar}>
                    <span>
                      {lesson.lab
                        ? 'Explore the concept with linked images and models.'
                        : 'Apply this concept to a short case.'}
                    </span>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => changePhase(lesson.lab ? 'lab' : 'check')}
                    >
                      {lesson.lab
                        ? 'Explore the model'
                        : lesson.id === 'suite-cases'
                          ? 'Start the suite cases'
                          : 'Check your reasoning'}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              )}
              {progress.phase === 'lab' && lesson.lab && (
                <>
                  <div className={styles.taskPrompt}>
                    <ScanLine size={22} />
                    <div>
                      <h2>Your exploration</h2>
                      <p>{lesson.labTask}</p>
                    </div>
                  </div>
                  <ImagingLab
                    key={lesson.id}
                    lab={lesson.lab}
                    lessonId={lesson.id}
                    values={progress.labValues[lesson.id] ?? {}}
                    onChange={onLabChange}
                  />
                  <div className={styles.nextBar}>
                    <span>
                      Exploration is unscored. The next screen asks for an independent decision.
                    </span>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => changePhase('check')}
                    >
                      Check your reasoning
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </>
              )}
              {progress.phase === 'check' && (
                <KnowledgeCheck
                  key={lesson.id}
                  lesson={lesson}
                  progress={progress}
                  onCommit={(id, choice) =>
                    setProgress((p) => commitAnswer(p, lesson.id, QUESTION_BY_ID[id], choice))
                  }
                  onAcknowledge={() =>
                    setProgress((p) => {
                      const feedbackQuestion = { ...p.feedbackQuestion }
                      delete feedbackQuestion[lesson.id]
                      return { ...p, feedbackQuestion }
                    })
                  }
                  onReview={reviewUnit}
                />
              )}
              {progress.phase === 'debrief' && currentStatus.allAnswered && (
                <div className={styles.lessonBody}>
                  <section className={styles.debriefSummary}>
                    <div className={styles.eyebrow}>
                      First decisions · {currentStatus.correct}/{lesson.checkIds.length} correct
                    </div>
                    <h2>
                      {lesson.id === 'suite-cases'
                        ? casePassed(progress)
                          ? 'Independent case check passed'
                          : 'Independent case check: review needed'
                        : currentStatus.needsReview
                          ? 'Review the decisions that need another look'
                          : 'Your reasoning is on track'}
                    </h2>
                    <p>
                      {lesson.id === 'suite-cases'
                        ? 'Pass standard: at least 7 of 8 first decisions correct, including every critical safety decision. This assesses knowledge, not procedural competence.'
                        : 'Reviewing an explanation completes the learning cycle. It does not replace your original response.'}
                    </p>
                  </section>
                  {lesson.checkIds.map((id) => {
                    const question = QUESTION_BY_ID[id],
                      answer = progress.answers[answerKey(lesson.id, id)]
                    return (
                      <details className={styles.reviewItem} key={id}>
                        <summary>
                          <span>
                            {answer.correct ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}
                          </span>
                          {question.stem}
                        </summary>
                        <p>
                          <strong>Your response:</strong>{' '}
                          {question.choices.find((choice) => choice.id === answer.choice)?.text}
                        </p>
                        {question.choices.map((choice) => (
                          <p key={choice.id}>
                            <strong>
                              {choice.id === question.correct ? 'Best response: ' : ''}
                              {choice.text}
                            </strong>{' '}
                            {choice.rationale}
                          </p>
                        ))}
                        {question.critical && (
                          <p className={styles.small}>
                            Critical safety decision ·{' '}
                            {answer.correct ? 'correct' : 'review required'}
                          </p>
                        )}
                        <SourceLinks ids={question.sources} />
                      </details>
                    )
                  })}
                  <section className={styles.keyPoints}>
                    <span className={styles.eyebrow}>Take to your next case</span>
                    <h2>Keep these distinctions clear.</h2>
                    <ul>
                      {lesson.takeaway.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </section>
                  <div className={styles.nextBar}>
                    <span>
                      {nextAfterReview
                        ? 'Next unfinished unit: ' + nextAfterReview.title
                        : 'Return to your course overview and results.'}
                    </span>
                    <button type="button" className={styles.primary} onClick={completeAndContinue}>
                      {nextAfterReview
                        ? 'Complete unit & continue'
                        : 'Complete unit & view results'}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.lessonFooter}>
                <button type="button" onClick={() => navigate('overview')}>
                  <ArrowLeft size={15} /> Back to course
                </button>
                <span>
                  Education only · actual technique follows current IFU and local protocols.
                </span>
              </div>
            </>
          ) : (
            <>
              <header
                className={styles.resourceHeader}
                role="group"
                aria-label="Resource orientation"
              >
                <div className={styles.eyebrow}>Course reference</div>
                <h1 ref={heading} tabIndex={-1}>
                  {title}
                </h1>
                <p>
                  {view === 'sources'
                    ? 'Published documents supporting the course. Evidence type and limitations stay attached to each source. Bibliography reviewed ' +
                      REVIEWED_ON +
                      '.'
                    : view === 'guide'
                      ? 'An authored decision aid synthesized from the cited literature. Adapt to the patient, installed system and local protocols.'
                      : 'Return to a term whenever you need it. The course uses the same terminology throughout.'}
                </p>
              </header>
              {view === 'guide' && (
                <>
                  <div className={styles.decisionGuide}>
                    {DECISION_GUIDE.map((row) => (
                      <article key={row.finding}>
                        <h2>{row.finding}</h2>
                        <p>
                          <strong>{row.question}</strong>
                        </p>
                        <p>{row.action}</p>
                        <button type="button" onClick={() => openLesson(row.lesson)}>
                          Review the related unit <ArrowRight size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                  <SourceLinks ids={['setser', 'tg272', 'saad', 'wabip', 'aapm12']} />
                  <h2 className={styles.resourceSubhead}>What each technology can contribute</h2>
                  <div className={styles.comparison}>
                    {MODALITIES.map((mode) => (
                      <article key={mode.name}>
                        <h3>{mode.name}</h3>
                        <dl>
                          <dt>Information</dt>
                          <dd>{mode.information}</dd>
                          <dt>Useful question</dt>
                          <dd>{mode.use}</dd>
                          <dt>Interpretation limit</dt>
                          <dd>{mode.limit}</dd>
                        </dl>
                      </article>
                    ))}
                  </div>
                  <h2 className={styles.resourceSubhead}>A practical acquisition record</h2>
                  <ul className={styles.recordList}>
                    <li>
                      Target, instrument and sampling component; supporting images and unresolved
                      limitations.
                    </li>
                    <li>
                      Patient position and respiratory state at confirmation; changes before
                      sampling.
                    </li>
                    <li>
                      Equipment, software, protocols, acquisition counts and reasons for repeats.
                    </li>
                    <li>
                      Total KAP and reference air kerma with units, fluoroscopy time, included modes
                      and any dose-management action.
                    </li>
                  </ul>
                  <SourceLinks ids={['wabip', 'setser', 'aapm12']} />
                  <button type="button" className={styles.secondary} onClick={() => window.print()}>
                    Print the imaging guide
                  </button>
                </>
              )}
              {view === 'glossary' && (
                <>
                  <label className={styles.searchLabel}>
                    Find a term
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Try: parallax, KAP, registration…"
                    />
                  </label>
                  <dl className={styles.glossary}>
                    {GLOSSARY.filter(([term, definition]) =>
                      (term + ' ' + definition).toLowerCase().includes(query.toLowerCase()),
                    ).map(([term, definition]) => (
                      <div key={term}>
                        <dt>{term}</dt>
                        <dd>{definition}</dd>
                      </div>
                    ))}
                  </dl>
                  {!GLOSSARY.some(([term, definition]) =>
                    (term + ' ' + definition).toLowerCase().includes(query.toLowerCase()),
                  ) && (
                    <p role="status">
                      No matching term. Try a shorter word or browse the full glossary.
                    </p>
                  )}
                  <SourceLinks ids={['setser', 'tg272', 'wabip', 'saad']} />
                </>
              )}
              {view === 'sources' && (
                <>
                  <div className={styles.evidenceIntro}>
                    <BookOpen size={25} />
                    <div>
                      <h2>Read the endpoint with the result.</h2>
                      <p>
                        Technical image quality, tool localization and diagnostic yield are
                        different endpoints. Single-arm studies of combined workflows do not isolate
                        the effect of one imaging technology. These references support principles
                        and tradeoffs, not a platform ranking.
                      </p>
                    </div>
                  </div>
                  <ol className={styles.sourceList}>
                    {SOURCES.map((source, i) => (
                      <li key={source.id} id={'ref-' + source.id}>
                        <span className={styles.referenceNumber}>{i + 1}</span>
                        <article>
                          <span className={styles.sourceKind}>
                            {source.kind} · {source.year}
                          </span>
                          <h2>
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.title}
                            </a>
                          </h2>
                          <p className={styles.citation}>
                            {source.authors} {source.publication}
                          </p>
                          <p>
                            <strong>Supports:</strong> {source.supports}
                          </p>
                          <p>
                            <strong>Interpretation limit:</strong> {source.limitation}
                          </p>
                        </article>
                      </li>
                    ))}
                  </ol>
                  <section className={styles.assetDownloads}>
                    <h2>3D teaching assets</h2>
                    <p>
                      The layered thorax was rebuilt in 3D Slicer from the existing FluoroView CT
                      and segmented airways. The separate needle model defines the fictional
                      sampling-window geometry used in the slice exercise.
                    </p>
                    <div className={styles.buttonRow}>
                      <a href="/peripheral-imaging/anatomy/thorax.glb" download>
                        CT-derived thorax (.glb)
                      </a>
                      <a href="/peripheral-imaging/sampling-window.glb" download>
                        Needle and sampling window (.glb)
                      </a>
                    </div>
                  </section>
                  <section className={styles.boundary}>
                    <Layers3 size={24} />
                    <div>
                      <h2>Visual and model provenance</h2>
                      <p>
                        Anatomy and image backgrounds derive from the existing FluoroView teaching
                        case. 3D Slicer generated the lung, bone and body surfaces; the original
                        airway segmentation and SlicerHeart-based FluoroView C-arm animation are
                        reused. The CT volume is downsampled and quantized for browser delivery.
                        Targets, instruments, cases and numerical examples are authored for
                        education. DRR and limited-angle images are simulations, not acquired
                        fluoroscopy or clinical CBCT. The gantry animation is a generic motion
                        reference, not a device-specific clearance model. Clinical statements link
                        to the published sources above.
                      </p>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
