'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { TEACHING_SIMULATOR_STATEMENT, summaryLines } from '../content/bench-copy'
import {
  NAMING_KEY,
  NAMING_USE,
  SLICE_DIRECTION_NOTE,
  SUBSEGMENT_NOTE,
} from '../content/course-guide'
import { BASE_PATH, METHOD_SOURCE, SOURCE, lessonHref } from '../content/module'
import {
  MATCH_REQUIRED_LESSONS,
  NAV_LESSONS,
  ORIENTATION_CHECK,
  ORIENTATION_CHECK_RESULT,
  ORIENTATION_LESSON,
  REFRESHER_LESSONS,
  buildTrip,
  lessonAfter,
  lessonById,
  lessonLabel,
  type NavLesson,
} from '../content/nav-lessons'
import { planSummaryLines } from '../content/plan-copy'
import { summarize } from '../engine/nav-session'
import {
  navKey,
  orientationShown,
  readNavEntry,
  readOrientationProgress,
  recordOrientationProgress,
  writeNavEntry,
} from '../engine/nav-storage'
import { summarizePlan } from '../engine/plan-session'
import { readPrefs } from '../engine/prefs-storage'
import { recordLessonOpened, setLessonReviewed } from '../engine/selfPacedProgress'
import { ModuleFrame } from './ModuleFrame'
import { TripBench, tripOver } from './TripBench'
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
            Loading {lessonLabel(lesson, ': ')}…
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
    if (saved.leg >= last && tripOver(saved.trip)) {
      writeNavEntry(key, null)
      return 0
    }
    return Math.min(last, saved.leg)
  })
  useEffect(() => {
    recordLessonOpened(lesson.id)
  }, [lesson.id])
  // The orientation check: which of its forks matched at the first check, on this visit.
  const [firstCheck, setFirstCheck] = useState<Record<number, boolean>>({})
  const onFirstCheck = useCallback(
    (index: number, clean: boolean) =>
      setFirstCheck((all) => (all[index] === clean ? all : { ...all, [index]: clean })),
    [],
  )
  return (
    <Trip
      key={tripIndex}
      lesson={lesson}
      tripIndex={tripIndex}
      storageKey={key}
      firstCheck={firstCheck}
      onFirstCheck={onFirstCheck}
      onNext={() => setTripIndex((index) => Math.min(lesson.trips.length - 1, index + 1))}
      onTrip={setTripIndex}
    />
  )
}

function Trip({
  lesson,
  tripIndex,
  storageKey,
  firstCheck,
  onFirstCheck,
  onNext,
  onTrip,
}: {
  lesson: NavLesson
  tripIndex: number
  storageKey: string
  firstCheck: Record<number, boolean>
  onFirstCheck: (index: number, clean: boolean) => void
  onNext: () => void
  onTrip: (index: number) => void
}) {
  // Turning the CT is asked for in the first lesson, and afterwards until the learner has shown
  // it, on a drive that reads the CT at each fork. A drive that follows a map never waits for it:
  // the CT was read in planning, and past the ostium the map is what sits beside the scope.
  const spec = lesson.trips[tripIndex]
  const drivesWithMap = Boolean(spec.from && spec.plan?.parts.includes('arcs'))
  const matchOptional = useMemo(
    () =>
      !MATCH_REQUIRED_LESSONS.includes(lesson.id) &&
      (drivesWithMap || orientationShown(readOrientationProgress())),
    [lesson.id, drivesWithMap],
  )
  const trip = useMemo(
    () => buildTrip(lesson.trips[tripIndex], { matchOptional, cruise: !readPrefs().everyFork }),
    [lesson, tripIndex, matchOptional],
  )
  const [session, dispatch] = useTrip(trip.trace, trip.target, trip.trip, storageKey, tripIndex)
  const lastTrip = tripIndex === lesson.trips.length - 1
  const over = tripOver(session)
  useEffect(() => {
    // Reaching the end of a lesson is the learner's place in the course, not a result.
    if (over && lastTrip) setLessonReviewed(lesson.id, true)
    if (over && lastTrip && lesson.id === ORIENTATION_LESSON)
      recordOrientationProgress({ lessonOneDone: true })
  }, [over, lastTrip, lesson.id])
  // The orientation check: this fork matched at the first check, without being shown.
  const isCheck = lesson.id === ORIENTATION_CHECK.id
  const forkLog = session.nav?.log[0]
  const cleanHere = Boolean(
    forkLog?.matchAsked && !forkLog.matchMisses && !forkLog.matchShown && over,
  )
  useEffect(() => {
    if (isCheck && over) onFirstCheck(tripIndex, cleanHere)
  }, [isCheck, over, tripIndex, cleanHere, onFirstCheck])
  const allFirstCheck =
    isCheck && lesson.trips.every((_, i) => (i === tripIndex ? cleanHere : firstCheck[i] === true))
  // After the check: on to planning, or to the first refresher when a fork did not match.
  const next = isCheck && !allFirstCheck ? REFRESHER_LESSONS[0] : lessonAfter(lesson.id)
  const stations = trip.trip.nav?.stations ?? []
  const forkNames = stations.map(
    (station) => trip.trace.checkpoints[station.checkpointIndex].decision!.parent.airway.code,
  )
  // A count of first tries says something only over a route of several forks.
  const summary = [
    ...(session.plan && trip.trip.plan
      ? planSummaryLines(summarizePlan(trip.trip.plan, session.plan))
      : []),
    ...(session.nav && stations.length >= 3 ? summaryLines(summarize(session.nav), forkNames) : []),
  ]
  const arrived = session.nav?.phase === 'arrived'
  return (
    <TripBench
      section="learn"
      title={lessonLabel(lesson)}
      subtitle={
        lesson.trips.length > 1
          ? `Trip ${tripIndex + 1} of ${lesson.trips.length} · ${trip.spec.title}`
          : trip.spec.title
      }
      trace={trip.trace}
      target={trip.target}
      trip={trip.trip}
      teach={trip.teach}
      planTeach={trip.spec.plan?.teach}
      divisionTeach={trip.divisionTeach}
      locators={trip.spec.plan?.locators}
      intro={trip.spec.intro}
      independent={trip.spec.independent}
      help={!lesson.unaided}
      session={session}
      dispatch={dispatch}
      closing={
        lastTrip
          ? {
              heading: arrived
                ? 'You have reached the lesion. End of the lesson.'
                : isCheck
                  ? 'End of the check'
                  : 'End of the lesson',
              body: [
                ...(isCheck
                  ? [
                      allFirstCheck
                        ? ORIENTATION_CHECK_RESULT.matched
                        : ORIENTATION_CHECK_RESULT.notYet,
                    ]
                  : []),
                lesson.closing,
                ...summary,
                TEACHING_SIMULATOR_STATEMENT,
              ],
              next: next
                ? { label: lessonLabel(next, ': '), href: lessonHref(next.id) }
                : { label: 'Practice: pick a lesion', href: `${BASE_PATH}/practice` },
            }
          : {
              heading: arrived ? 'You have reached the lesion' : 'End of this trip',
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
          <dl>
            <dt>Names</dt>
            <dd>
              {NAMING_KEY} {NAMING_USE} {SUBSEGMENT_NOTE}
            </dd>
            <dt>Slices</dt>
            <dd>{SLICE_DIRECTION_NOTE}</dd>
            <dt>Sources</dt>
            <dd>
              <a href={METHOD_SOURCE.url} target="_blank" rel="noreferrer">
                {METHOD_SOURCE.title}
              </a>
            </dd>
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
