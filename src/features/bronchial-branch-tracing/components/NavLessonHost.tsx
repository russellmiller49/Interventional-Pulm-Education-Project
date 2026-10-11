'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { TEACHING_SIMULATOR_STATEMENT, summaryLines } from '../content/bench-copy'
import {
  NAMING_KEY,
  NAMING_USE,
  SLICE_DIRECTION_NOTE,
  SUBSEGMENT_NOTE,
  patternFor,
} from '../content/course-guide'
import { BASE_PATH, SOURCE, lessonHref } from '../content/module'
import {
  NAV_LESSONS,
  buildTrip,
  lessonAfter,
  lessonById,
  lessonNumber,
  type NavLesson,
} from '../content/nav-lessons'
import { summarize } from '../engine/nav-session'
import { navKey, readNavEntry, writeNavEntry } from '../engine/nav-storage'
import { recordLessonOpened, setLessonReviewed } from '../engine/selfPacedProgress'
import { ModuleFrame } from './ModuleFrame'
import { NavigationBench } from './NavigationBench'
import { useHydrated } from './useHydrated'
import { useTrip } from './useTrip'
import styles from './nav-bench.module.css'

export function NavLessonHost({ requestedId }: { requestedId?: string }) {
  const lesson = lessonById(requestedId) ?? NAV_LESSONS[0]
  const hydrated = useHydrated()
  return (
    <ModuleFrame section="learn" activity>
      {hydrated ? (
        <LessonTrips key={lesson.id} lesson={lesson} />
      ) : (
        <section aria-busy="true">
          <p role="status" style={{ padding: '1rem' }}>
            Loading lesson {lessonNumber(lesson.id)}…
          </p>
        </section>
      )}
    </ModuleFrame>
  )
}

function LessonTrips({ lesson }: { lesson: NavLesson }) {
  const key = navKey('learn', lesson.id)
  const [tripIndex, setTripIndex] = useState(() => {
    const saved = readNavEntry(key).entry
    if (!saved) return 0
    const last = lesson.trips.length - 1
    // A lesson already driven to its end opens again from its first trip.
    if (
      saved.leg >= last &&
      (saved.session.phase === 'arrived' || saved.session.phase === 'done')
    ) {
      writeNavEntry(key, null)
      return 0
    }
    return Math.min(last, saved.leg)
  })
  useEffect(() => {
    recordLessonOpened(lesson.id)
  }, [lesson.id])
  return (
    <Trip
      key={tripIndex}
      lesson={lesson}
      tripIndex={tripIndex}
      storageKey={key}
      onNext={() => setTripIndex((index) => Math.min(lesson.trips.length - 1, index + 1))}
      onTrip={setTripIndex}
    />
  )
}

function Trip({
  lesson,
  tripIndex,
  storageKey,
  onNext,
  onTrip,
}: {
  lesson: NavLesson
  tripIndex: number
  storageKey: string
  onNext: () => void
  onTrip: (index: number) => void
}) {
  const trip = useMemo(() => buildTrip(lesson.trips[tripIndex]), [lesson, tripIndex])
  const [session, dispatch] = useTrip(trip.trace, trip.plan, storageKey, tripIndex)
  const lastTrip = tripIndex === lesson.trips.length - 1
  const over = session.phase === 'arrived' || session.phase === 'done'
  useEffect(() => {
    // Reaching the end of a lesson is the learner's place in the course, not a result.
    if (over && lastTrip) setLessonReviewed(lesson.id, true)
  }, [over, lastTrip, lesson.id])
  const next = lessonAfter(lesson.id)
  const forkNames = trip.plan.stations.map(
    (station) => trip.trace.checkpoints[station.checkpointIndex].decision!.parent.airway.code,
  )
  // A count of first tries says something only over a route of several forks.
  const summary = trip.plan.stations.length >= 3 ? summaryLines(summarize(session), forkNames) : []
  const pattern = patternFor(lesson.id)
  const number = lessonNumber(lesson.id)
  return (
    <NavigationBench
      section="learn"
      title={`Lesson ${number} · ${lesson.title}`}
      subtitle={
        lesson.trips.length > 1
          ? `Trip ${tripIndex + 1} of ${lesson.trips.length} · ${trip.spec.title}`
          : trip.spec.title
      }
      trace={trip.trace}
      plan={trip.plan}
      teach={trip.teach}
      intro={trip.spec.intro}
      independent={trip.spec.independent}
      help
      session={session}
      dispatch={dispatch}
      closing={
        lastTrip
          ? {
              heading:
                session.phase === 'arrived'
                  ? 'You have reached the lesion. End of the lesson.'
                  : 'End of the lesson',
              body: [lesson.closing, ...summary, TEACHING_SIMULATOR_STATEMENT],
              next: next
                ? { label: `Lesson ${number + 1}: ${next.title}`, href: lessonHref(next.id) }
                : { label: 'Practice: pick a lesion', href: `${BASE_PATH}/practice` },
            }
          : {
              heading:
                session.phase === 'arrived' ? 'You have reached the lesion' : 'End of this trip',
              body: [...summary, `Next: ${lesson.trips[tripIndex + 1].title}.`],
              next: { label: 'Next trip', onActivate: onNext },
            }
      }
      exit={<Link href={BASE_PATH}>Course overview</Link>}
      notes={
        <details className={styles.notes} data-lesson-notes>
          <summary>Lesson notes</summary>
          <p>{lesson.concept}</p>
          <p>
            <strong>After this lesson you can:</strong> {lesson.objective}
          </p>
          {lesson.trips.length > 1 && (
            <ol className={styles.tripList}>
              {lesson.trips.map((spec, index) => (
                <li key={spec.title} data-trip-current={index === tripIndex || undefined}>
                  {index === tripIndex ? (
                    spec.title
                  ) : (
                    <button onClick={() => onTrip(index)}>{spec.title}</button>
                  )}
                </li>
              ))}
            </ol>
          )}
          {pattern && (
            <dl>
              <dt>Fork pattern: {pattern.name}</dt>
              {pattern.definition.map((line) => (
                <dd key={line}>{line}</dd>
              ))}
            </dl>
          )}
          <dl>
            <dt>Names</dt>
            <dd>
              {NAMING_KEY} {NAMING_USE} {SUBSEGMENT_NOTE}
            </dd>
            <dt>Slices</dt>
            <dd>{SLICE_DIRECTION_NOTE}</dd>
            <dt>Source</dt>
            <dd>
              <a href={SOURCE.url} target="_blank" rel="noreferrer">
                {SOURCE.title}
              </a>
            </dd>
          </dl>
        </details>
      }
    />
  )
}
