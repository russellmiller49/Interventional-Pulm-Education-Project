'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { Link } from '@/i18n/navigation'

import { curriculumChapter, curriculumSection, curriculumSections } from '../../content/curriculum'
import { lessonParts, type LessonPartId } from '../../content/lessonParts'
import { modelBoundary } from '../../content/modelBoundaries'
import { isOpenable, sectionLinkTarget } from '../../content/pathwayResolver'
import { pleuralZones } from '../../content/pleuralZones'
import { writtenSection } from '../../content/sections'
import { MEDICAL_THORACOSCOPY_LEARN_HREF } from '../../content/routes'
import type { ThoracoscopySectionId } from '../../content/sectionIds'
import { teachingExample } from '../../content/teachingExamples'
import type { ThoracoscopySectionSpec } from '../../content/types'
import { recordLocation, setSectionReviewed } from '../../engine/selfPacedProgress'
import { exampleStart } from '../../engine/space/exampleStarts'
import {
  lessonReducer,
  partDone,
  startLesson,
  type LessonAction,
  type LessonSession,
} from '../../engine/stageSession'
import { SpacePane } from '../space/SpacePane'
import type { SpaceCommand, SpaceInputMode } from '../space/types'
import { useSpaceEngine, type SpaceEngineSession, type SpaceLoader } from '../space/useSpaceEngine'
import { useReducedMotion } from '../space/useSpaceSupport'
import { useThoracoscopyProgress } from '../useThoracoscopyProgress'
import { PivotView, SurveyView, TourView } from './LessonActivities'
import { QuestionView } from './QuestionView'
import styles from './lesson.module.css'
import { LESSON_WORDS, partTitle } from './lessonWords'

/**
 * One written section, as a lesson in document flow (plan, section 4.2, "Lesson host"). The parts
 * come in the order the section's question sets; the learner can open any of them at any time, and
 * Continue, Back and moving on never count as doing a part's work. Three kinds of action are kept
 * visibly apart: the course (the outline, Back, Continue, moving on, finishing), the teaching example
 * (putting the space back as the example has it), and the scope controls in the space pane.
 *
 * The progress record gets the visit and the place when the section opens, and "reviewed" only when
 * the learner marks it, which they can take back. Nothing else is stored: not an answer, not the
 * survey's note, not what the telescope has shown.
 */
export function SectionLesson({
  sectionId,
  load,
}: {
  readonly sectionId: ThoracoscopySectionId
  /** How the space is loaded; the packaged proxies unless a test gives another. */
  readonly load?: SpaceLoader
}) {
  const spec = writtenSection(sectionId)
  if (!spec) throw new Error(`${sectionId} is not written`)
  return <Lesson spec={spec} load={load} />
}

function Lesson({
  spec,
  load,
}: {
  readonly spec: ThoracoscopySectionSpec
  readonly load?: SpaceLoader
}) {
  const section = curriculumSection(spec.id)
  const chapter = curriculumChapter(section.chapter)
  const parts = useMemo(() => lessonParts(spec), [spec])
  const [session, dispatch] = useReducer(lessonReducer, parts, startLesson)
  const reducedMotion = useReducedMotion()
  const start = useMemo(
    () => exampleStart(spec.teachingExample ?? 'space-made'),
    [spec.teachingExample],
  )
  const space = useSpaceEngine(start, { reducedMotion, load })
  const { progress, status, hydrated } = useThoracoscopyProgress()
  const headings = useRef(new Map<LessonPartId, HTMLHeadingElement>())
  const moved = useRef(false)

  useEffect(() => {
    recordLocation({ kind: 'section', id: spec.id })
  }, [spec.id])

  // Navigation moves the reader: focus the part it leads to.
  const navigate = useCallback((action: LessonAction) => {
    moved.current = true
    dispatch(action)
  }, [])
  const current = session.parts[session.current]
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    const heading = headings.current.get(current)
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [current, reducedMotion])

  const visible = session.parts.filter(
    (part, index) => index <= session.furthest || session.openedAhead.includes(part),
  )
  const last = session.current === session.parts.length - 1
  const workToDo =
    (current === 'question' || current === 'transfer' || current === 'activity') &&
    !partDone(session, current, spec.activity)
  const reviewed = progress.reviewedSectionIds.includes(spec.id)
  const next = curriculumSections.slice(section.number).find(isOpenable)
  const cannotSave = hydrated && (status === 'unavailable' || status === 'unreadable')

  return (
    <article className={styles.lesson} aria-labelledby="lesson-title" data-section={spec.id}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          <Link href={MEDICAL_THORACOSCOPY_LEARN_HREF}>{LESSON_WORDS.allSections}</Link> · Section{' '}
          {section.number} of {curriculumSections.length} · {chapter.title} · about{' '}
          {section.minutes} min
        </p>
        <h1 id="lesson-title">{section.title}</h1>
        <p className={styles.notReviewed} role="note">
          {LESSON_WORDS.notReviewed}
        </p>
        {cannotSave ? (
          <p className={styles.cannotSave} role="alert">
            {LESSON_WORDS.cannotSave}
          </p>
        ) : null}
      </header>

      <nav className={styles.outline} aria-labelledby="parts-heading">
        <h2 id="parts-heading" className={styles.outlineHeading}>
          {LESSON_WORDS.partsHeading}
        </h2>
        <p className={styles.note}>{LESSON_WORDS.partsNote}</p>
        <ol className={styles.outlineList}>
          {session.parts.map((part, index) => {
            const state =
              index === session.current
                ? LESSON_WORDS.here
                : partDone(session, part, spec.activity)
                  ? LESSON_WORDS.done
                  : session.movedPast.includes(part)
                    ? LESSON_WORDS.movedPast
                    : null
            return (
              <li key={part}>
                <button
                  type="button"
                  className={styles.outlineButton}
                  aria-current={index === session.current ? 'step' : undefined}
                  onClick={() => navigate({ type: 'open', part })}
                  data-part-link={part}
                >
                  {partTitle(part, spec)}
                  {state ? <span className={styles.partState}> · {state}</span> : null}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className={styles.parts}>
        {visible.map((part) => (
          <section
            key={part}
            className={styles.part}
            data-lesson-part={part}
            data-current={part === current || undefined}
            aria-labelledby={`part-${part.replace(':', '-')}`}
          >
            <h2
              id={`part-${part.replace(':', '-')}`}
              className={styles.partHeading}
              tabIndex={-1}
              ref={(element) => {
                if (element) headings.current.set(part, element)
                else headings.current.delete(part)
              }}
            >
              {partTitle(part, spec)}
            </h2>
            <PartBody
              part={part}
              spec={spec}
              session={session}
              dispatch={dispatch}
              space={space}
              start={start}
              reducedMotion={reducedMotion}
            />
          </section>
        ))}
      </div>

      <div className={styles.courseBar} role="group" aria-label="Course" data-course-bar>
        <button
          type="button"
          className={styles.courseButton}
          onClick={() => navigate({ type: 'back' })}
          disabled={session.current === 0}
        >
          {LESSON_WORDS.back}
        </button>
        {last ? null : workToDo ? (
          <button
            type="button"
            className={styles.courseButtonPrimary}
            onClick={() => navigate({ type: 'move-past' })}
            data-move-on
          >
            {LESSON_WORDS.moveOn}
          </button>
        ) : (
          <button
            type="button"
            className={styles.courseButtonPrimary}
            onClick={() => navigate({ type: 'continue' })}
            data-continue
          >
            {LESSON_WORDS.continue}
          </button>
        )}
      </div>

      <section className={styles.finish} aria-labelledby="finish-heading" data-finish>
        <h2 id="finish-heading" className={styles.partHeading}>
          {LESSON_WORDS.finishHeading}
        </h2>
        <p className={styles.note}>{LESSON_WORDS.finishNote}</p>
        {reviewed ? (
          <p className={styles.marked} role="status">
            {LESSON_WORDS.marked}{' '}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setSectionReviewed(spec.id, false)}
            >
              {LESSON_WORDS.unmark}
            </button>
          </p>
        ) : (
          <button
            type="button"
            className={styles.courseButtonPrimary}
            onClick={() => setSectionReviewed(spec.id, true)}
            data-mark-reviewed
          >
            {LESSON_WORDS.markReviewed}
          </button>
        )}
        <p className={styles.finishLinks}>
          <Link href={MEDICAL_THORACOSCOPY_LEARN_HREF}>
            {reviewed ? LESSON_WORDS.allSections : LESSON_WORDS.leave}
          </Link>
          {next ? (
            <>
              {' · '}
              <Link href={sectionLinkTarget(next.id)} data-next-section={next.id}>
                {LESSON_WORDS.next}: {next.title}
              </Link>
            </>
          ) : null}
        </p>
      </section>
    </article>
  )
}

function Paragraphs({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/\n\n+/).map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </>
  )
}

function PartBody({
  part,
  spec,
  session,
  dispatch,
  space,
  start,
  reducedMotion,
}: {
  readonly part: LessonPartId
  readonly spec: ThoracoscopySectionSpec
  readonly session: LessonSession
  readonly dispatch: (action: LessonAction) => void
  readonly space: SpaceEngineSession
  readonly start: ReturnType<typeof exampleStart>
  readonly reducedMotion: boolean
}) {
  if (part.startsWith('block:')) {
    const block = spec.blocks.find((entry) => `block:${entry.id}` === part)
    if (!block) return null
    return (
      <div className={styles.prose}>
        <Paragraphs text={block.body} />
        {block.list ? (
          <>
            <p className={styles.listLabel}>{block.list.label}</p>
            <ul>
              {block.list.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        {block.zoneList ? (
          <ol className={styles.zoneList}>
            {pleuralZones.map((zone) => (
              <li key={zone.id}>{zone.name}</li>
            ))}
          </ol>
        ) : null}
      </div>
    )
  }
  switch (part) {
    case 'orientation':
      return (
        <div className={styles.prose}>
          <dl className={styles.orientation}>
            <dt>{LESSON_WORDS.objective}</dt>
            <dd>{spec.objective}</dd>
            <dt>{LESSON_WORDS.clinicalQuestion}</dt>
            <dd>{spec.clinicalQuestion}</dd>
          </dl>
          <h3 className={styles.subHeading}>{LESSON_WORDS.signalsHeading}</h3>
          <ul className={styles.signals}>
            {spec.signals.map((signal) => (
              <li key={signal.name} data-provenance={signal.provenance}>
                <strong>{signal.name}</strong> <span className={styles.label}>{signal.label}</span>
                <br />
                {signal.detail}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'teaching-example': {
      if (!spec.teachingExample) return null
      const example = teachingExample(spec.teachingExample)
      return (
        <div
          className={styles.example}
          role="group"
          aria-label="Teaching example"
          data-teaching-example={example.id}
        >
          <p className={styles.exampleLabel}>{example.label}</p>
          <h3 className={styles.subHeading}>{example.title}</h3>
          <p>{example.loaded}</p>
          <p>{example.notPerformed}</p>
          <p className={styles.listLabel}>{LESSON_WORDS.exampleTaughtIn}</p>
          <ul>
            {example.stepsTaughtIn.map((id) => {
              const taught = curriculumSection(id)
              return (
                <li key={id}>
                  {isOpenable(taught) ? (
                    <Link href={sectionLinkTarget(id)}>{taught.title}</Link>
                  ) : (
                    taught.title
                  )}{' '}
                  <span className={styles.partState}>
                    ({isOpenable(taught) ? LESSON_WORDS.open : LESSON_WORDS.inPreparation})
                  </span>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className={styles.exampleButton}
            onClick={() => space.restart(start)}
            disabled={space.paneState.readiness.kind !== 'ready'}
            data-load-example
          >
            {LESSON_WORDS.exampleLoadAgain}
          </button>
        </div>
      )
    }
    case 'question':
    case 'transfer':
      return (
        <QuestionView
          question={part === 'question' ? spec.question : spec.transfer}
          answer={session.answers[part]}
          which={part}
          dispatch={dispatch}
        />
      )
    case 'concept':
      return (
        <div className={styles.prose}>
          <p className={styles.newConcept}>{spec.newConcept}</p>
          <p>
            <strong>{LESSON_WORDS.increment}:</strong> {spec.increment}
          </p>
          <h3 className={styles.subHeading}>{LESSON_WORDS.analogy}</h3>
          <p>{spec.anchor.analogy}</p>
          <h3 className={styles.subHeading}>{LESSON_WORDS.precise}</h3>
          <p>{spec.anchor.precise}</p>
          <h3 className={styles.subHeading}>{spec.anchor.checklistLabel}</h3>
          <ol>
            {spec.anchor.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <h3 className={styles.subHeading}>{LESSON_WORDS.application}</h3>
          <p>{spec.anchor.application}</p>
        </div>
      )
    case 'worked-example':
      return (
        <div className={styles.prose}>
          <p className={styles.note}>{LESSON_WORDS.workedExampleNote}</p>
          <h3 className={styles.subHeading}>{spec.workedExample.heading}</h3>
          <p>{spec.workedExample.situation}</p>
          <ol>
            {spec.workedExample.steps.map((step) => (
              <li key={step.action}>
                <strong>{step.action}</strong> {step.reason}
              </li>
            ))}
          </ol>
          <p>{spec.workedExample.outcome}</p>
        </div>
      )
    case 'activity':
      return (
        <ActivityPart
          spec={spec}
          session={session}
          dispatch={dispatch}
          space={space}
          reducedMotion={reducedMotion}
        />
      )
    case 'misconceptions':
      return (
        <ul className={styles.prose}>
          {spec.misconceptions.map((entry) => (
            <li key={entry.belief}>
              <strong>{entry.belief}</strong> {entry.correction}
            </li>
          ))}
        </ul>
      )
    case 'harmful-reflex':
      return (
        <dl className={styles.orientation}>
          <dt>{LESSON_WORDS.harmfulHeading}</dt>
          <dd>{spec.harmfulReflex.move}</dd>
          <dt>{LESSON_WORDS.risk}</dt>
          <dd>{spec.harmfulReflex.risk}</dd>
          <dt>{LESSON_WORDS.inThisModel}</dt>
          <dd>{spec.harmfulReflex.inThisModel}</dd>
        </dl>
      )
    case 'model-leaves-out':
      return (
        <ul className={styles.prose}>
          {spec.modelLeavesOut.shared.map((id) => (
            <li key={id}>{modelBoundary(id).text}</li>
          ))}
          {spec.modelLeavesOut.section.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

function ActivityPart({
  spec,
  session,
  dispatch,
  space,
  reducedMotion,
}: {
  readonly spec: ThoracoscopySectionSpec
  readonly session: LessonSession
  readonly dispatch: (action: LessonAction) => void
  readonly space: SpaceEngineSession
  readonly reducedMotion: boolean
}) {
  // The learner's own moves of the telescope, counted so that a pivot target is reached only after
  // the learner moved it there; loading a stop or an example is never a move.
  const [moves, setMoves] = useState<Readonly<Record<number, number>>>({})
  const target = session.pivot.target
  const onCommand = useCallback(
    (command: SpaceCommand, input: SpaceInputMode) => {
      if (command.kind === 'pivot' || command.kind === 'depth' || command.kind === 'roll') {
        setMoves((counts) => ({ ...counts, [target]: (counts[target] ?? 0) + 1 }))
      }
      space.onCommand(command, input)
    },
    [space, target],
  )
  const pane = (
    <SpacePane
      state={space.paneState}
      space={space.space}
      shown={spec.controls.shown}
      operable={spec.controls.operable}
      reducedMotion={reducedMotion}
      onCommand={onCommand}
    />
  )
  const activity = spec.activity
  return (
    <div className={styles.activity} data-activity={activity.kind}>
      <p className={styles.prompt}>{activity.prompt}</p>
      {activity.kind === 'tour' ? (
        <TourView activity={activity} session={session} dispatch={dispatch} space={space} />
      ) : activity.kind === 'pivot' ? (
        <PivotView
          activity={activity}
          session={session}
          dispatch={dispatch}
          space={space}
          moves={moves[target] ?? 0}
        />
      ) : (
        <SurveyView activity={activity} session={session} dispatch={dispatch} space={space} />
      )}
      {pane}
    </div>
  )
}
