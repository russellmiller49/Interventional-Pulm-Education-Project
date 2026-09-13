'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { StepList } from '@/features/learning-module/stage/StepList'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { BASE, LESSONS, lessonHref, nextLesson } from '../content/curriculum'
import { stageLesson } from '../content/stage'
import { labGoalMet, type Lesson } from '../content/types'
import { completeLesson, firstAttempt, updateRecord } from '../engine/progress'
import { EbusModuleFrame } from './ModuleFrame'
import { SourceList } from './SourceList'
import { TeachingDiagram } from './Diagram'
import { QuestionBody } from './QuestionBody'
import { MatchingActivity } from './MatchingActivity'
import { StationFigure } from './StationFigure'
import { SequenceActivity } from './SequenceActivity'
import { Workbench } from './Workbench'
import { useCourseRecord } from './useCourseRecord'
import styles from './course.module.css'
export function LessonHost({ lesson, locale = 'en' }: { lesson: Lesson; locale?: string }) {
  const [restart, setRestart] = useState(0)
  return (
    <LessonSession
      key={lesson.id + restart}
      lesson={lesson}
      locale={locale}
      onRestart={() => setRestart((v) => v + 1)}
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
  const stage = useMemo(() => stageLesson(lesson), [lesson])
  const [index, setIndex] = useState(0)
  const [review, setReview] = useState<number | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [actionDone, setActionDone] = useState(false)
  const [observation, setObservation] = useState<EbusObservation>(EMPTY_EBUS_OBSERVATION)
  const [finished, setFinished] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const [sessionId] = useState(() => lesson.id + '-' + Math.random().toString(36).slice(2))
  useEffect(() => {
    const saved = updateRecord((r) => ({ ...r, lastLesson: lesson.id }))
    // This state reflects a browser storage operation performed only after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageFailed(!saved)
  }, [lesson.id])
  const currentIndex = review ?? index
  const current = stage.steps[currentIndex]
  const question =
    currentIndex === 2
      ? lesson.question
      : currentIndex === 4
        ? lesson.observation
        : currentIndex === 6
          ? lesson.transfer
          : null
  const committed = question ? answers[question.id] : undefined
  const choice = question?.choices.find((c) => c.id === committed)
  const unsafe = !!choice?.unsafe
  const predictionCommitted = !!answers[lesson.question.id]
  const pendingQuestion = !!question && !committed
  const onObservation = useCallback((v: EbusObservation) => setObservation(v), [])
  const labDone = lesson.lab ? labGoalMet(lesson.lab, observation) : actionDone
  const performed = new Set(stage.steps.slice(0, index).map((s) => s.id))
  if (finished) stage.steps.forEach((s) => performed.add(s.id))
  function advance() {
    if (review !== null) {
      setReview(null)
      return
    }
    if (question && !committed) {
      const id = selected[question.id]
      if (!question.choices.some((c) => c.id === id)) return
      setAnswers((a) => ({ ...a, [question.id]: id }))
      setStorageFailed(
        !updateRecord((r) => firstAttempt(r, lesson.id + ':' + question.id, question, id)),
      )
      return
    }
    if (unsafe && question) {
      setAnswers((a) => {
        const next = { ...a }
        delete next[question.id]
        return next
      })
      setSelected((a) => ({ ...a, [question.id]: '' }))
      return
    }
    if (index === 3 && !labDone) return
    if (index === 6) {
      setStorageFailed(!updateRecord((r) => completeLesson(r, lesson.id)))
      setFinished(true)
      return
    }
    if (index === 3) setActionDone(true)
    setIndex((v) => v + 1)
  }
  const next = nextLesson(record.completed)
  const instruction =
    review !== null
      ? 'Review of a completed step. Returning to this step does not repeat its actions.'
      : current.instruction
  const disabled =
    review === null && ((pendingQuestion && !selected[question!.id]) || (index === 3 && !labDone))
  const primary = finished
    ? {
        label: next ? 'Continue to ' + next.title : 'Open final assessment',
        href: next ? lessonHref(next.id) : BASE + '/assess',
      }
    : {
        label:
          review !== null
            ? 'Return to current step'
            : unsafe
              ? 'Revise this response'
              : pendingQuestion
                ? 'Submit response'
                : index === 6
                  ? 'Finish lesson'
                  : 'Continue',
        onActivate: advance,
        disabled,
        disabledReason: disabled
          ? index === 3
            ? 'Complete the guided activity and wait for its image before continuing.'
            : 'Select a response first.'
          : undefined,
      }
  const showModel = !pendingQuestion && !unsafe && currentIndex !== 6
  return (
    <EbusModuleFrame locale={locale} active="Learn" activity>
      <StageTeachingScope value={{ phase: current.phase, predictionCommitted, stepId: current.id }}>
        <StageLayout
          stageId={lesson.id}
          label={lesson.title}
          module="ebus-guided"
          workspaceLabel="EBUS guided lesson"
          paneOrder={['steps', 'teaching', 'simulator']}
          defaultWidthFractions={{ primary: 0.26, secondary: 0.29 }}
          paneMinimums={{ primary: 300, secondary: 280, tertiary: 340 }}
          paneCaptions={{
            steps: 'what to do',
            teaching: 'what to read',
            simulator: 'images, anatomy and acquisition controls',
          }}
          compactPane={current.lookIn?.pane}
          header={
            <SectionHeader
              kicker={
                'EBUS · Lesson ' +
                (stage.index + 1) +
                ' of ' +
                LESSONS.length +
                ' · ' +
                lesson.minutes +
                ' min'
              }
              title={lesson.title}
              sectionsControl={
                <Link className={styles.secondary} href={BASE + '/learn'}>
                  Lesson map
                </Link>
              }
              restartLabel="Restart lesson"
              onRestart={onRestart}
              saveAndExitHref={BASE}
              onHelp={() => {
                const tabs = Array.from(
                  document.querySelectorAll<HTMLButtonElement>(
                    '[role="tablist"][aria-label="Workspace panel views"] [role="tab"]',
                  ),
                )
                tabs.find((tab) => tab.textContent === 'Steps')?.click()
                requestAnimationFrame(() =>
                  document.querySelector('[data-now-card]')?.scrollIntoView({ block: 'nearest' }),
                )
              }}
            />
          }
          contextStrip={
            <div className={styles.context}>
              <span>{lesson.topic}</span>
              <span>In development · First responses are retained</span>
              <span>An unfinished lesson restarts from its first step.</span>
            </div>
          }
          task={
            <>
              {storageFailed && (
                <p role="status" className={styles.notice}>
                  Browser storage is unavailable. You can work through this activity, but progress
                  may not survive a reload.
                </p>
              )}
              <NowCard
                model={{
                  kicker: finished
                    ? 'Lesson completed'
                    : 'Step ' +
                      (currentIndex + 1) +
                      ' of ' +
                      stage.steps.length +
                      ' · ' +
                      current.phase,
                  heading: finished ? 'Lesson completed' : current.title,
                  body: finished
                    ? storageFailed
                      ? 'You finished this lesson, but this browser could not save its completion.'
                      : 'Your required activities and responses have been recorded. This is an educational completion record.'
                    : instruction,
                  where:
                    !finished && current.lookIn ? (
                      <LookInLine location={current.lookIn} />
                    ) : undefined,
                  primary,
                  tone: unsafe ? 'safety' : 'neutral',
                }}
              >
                {!finished && question && (
                  <QuestionBody
                    question={question}
                    selected={selected[question.id] ?? committed ?? ''}
                    committed={committed}
                    onSelect={(id) => setSelected((s) => ({ ...s, [question.id]: id }))}
                  />
                )}
                {!finished &&
                  currentIndex === 3 &&
                  review === null &&
                  (lesson.lab ? (
                    <p role="status">
                      {labDone
                        ? 'The acquisition goal is met. Return to the Steps panel to continue.'
                        : 'Complete the activity in the EBUS workbench. Preset loading alone does not complete it.'}
                    </p>
                  ) : lesson.sequence ? (
                    <SequenceActivity
                      sequence={lesson.sequence}
                      onComplete={() => setActionDone(true)}
                    />
                  ) : lesson.matching ? (
                    <MatchingActivity
                      activity={lesson.matching}
                      onComplete={() => setActionDone(true)}
                    />
                  ) : null)}
                {review !== null && (
                  <p>Previously completed. The current activity remains paused during review.</p>
                )}
              </NowCard>
              <StepList
                lesson={stage}
                currentIndex={index}
                furthestPerformedIndex={index - 1}
                performedStepIds={performed}
                predictionCommitted={predictionCommitted}
                reviewIndex={review}
                recapFor={(i) => [stage.steps[i].title + ' completed.']}
                onSelect={(i) => {
                  if (i < index) setReview(i)
                }}
              />
            </>
          }
          teaching={
            <div className={styles.teaching}>
              {currentIndex === 0 && (
                <StageBlock kind="question" heading="Teaching" visibility="shown">
                  <h2>Teaching</h2>
                  <p>
                    <strong>Clinical objective.</strong> {lesson.objective}
                  </p>
                  <p>
                    <strong>Recall.</strong> {lesson.recall}
                  </p>
                  <h3>{lesson.concept}</h3>
                  {lesson.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  <ul>
                    {lesson.checklist.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </StageBlock>
              )}
              {currentIndex === 1 && (
                <StageBlock kind="pattern" heading="Worked example" visibility="shown">
                  <h2>Worked example</h2>
                  <p>{lesson.worked.context}</p>
                  <p>
                    <strong>Reasoning.</strong> {lesson.worked.reasoning}
                  </p>
                </StageBlock>
              )}
              {(currentIndex === 2 || currentIndex === 4 || currentIndex === 6) && (
                <>
                  <h2>{current.title}</h2>
                  <p>
                    Use the clinical situation in the Steps panel. Explanations appear after you
                    submit your response.
                  </p>
                  {committed && !unsafe && (
                    <p>{question?.choices.find((c) => c.id === committed)?.rationale}</p>
                  )}
                </>
              )}
              {currentIndex === 3 && (
                <>
                  <h2>Guided activity</h2>
                  <p>
                    {lesson.lab?.instruction ?? lesson.sequence?.prompt ?? lesson.matching?.prompt}
                  </p>
                  <p>{lesson.boundary}</p>
                </>
              )}
              {currentIndex === 5 && (
                <StageBlock
                  kind="after-commitment"
                  heading="Clinical explanation"
                  visibility="shown"
                >
                  <h2>Clinical explanation</h2>
                  <p>{lesson.observation.explanation}</p>
                  <ul>
                    {lesson.takeaways.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <p>{lesson.boundary}</p>
                </StageBlock>
              )}
            </div>
          }
          simulator={
            lesson.lab && (index === 3 || (lesson.lab.linkedLesson && index >= 4 && index <= 5)) ? (
              <div>
                <div hidden={review !== null}>
                  <Workbench
                    lab={lesson.lab}
                    locked={review !== null || index !== 3}
                    reveal={index === 5 && review === null}
                    sessionId={sessionId}
                    onObservation={onObservation}
                  />
                </div>
                {review !== null && <TeachingDiagram kind={lesson.diagram} />}
              </div>
            ) : lesson.lab?.linkedLesson && currentIndex === 1 && review === null ? (
              <Workbench
                lab={lesson.lab}
                locked={false}
                reveal
                demonstration
                sessionId={sessionId + '-demonstration'}
                onObservation={onObservation}
              />
            ) : showModel ? (
              lesson.station ? (
                <StationFigure key={lesson.station} station={lesson.station} allowSelect />
              ) : (
                <TeachingDiagram kind={lesson.diagram} />
              )
            ) : (
              <div className={styles.figure}>
                <h2>Clinical situation</h2>
                <p>Read the scenario and submit your interpretation in the Steps panel.</p>
                <p className={styles.muted}>Teaching annotations are withheld for this decision.</p>
              </div>
            )
          }
          footer={<SourceList ids={lesson.sources} />}
        />
      </StageTeachingScope>
    </EbusModuleFrame>
  )
}
