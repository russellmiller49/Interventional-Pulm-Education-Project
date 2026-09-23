'use client'
import { useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { BASE_PATH, LESSONS } from '../content/lessons'
import { courseMap, patternFor } from '../content/course-guide'
import { setLessonReviewLater } from '../engine/selfPacedProgress'
import { useSelfPacedProgress } from './useSelfPacedProgress'

export function CourseOutline({ currentId }: { currentId?: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const { record, status } = useSelfPacedProgress()
  const index = LESSONS.findIndex((lesson) => lesson.id === currentId)
  const previous = index > 0 ? LESSONS[index - 1] : undefined
  const next = index >= 0 ? LESSONS[index + 1] : undefined
  const savedForLater = index >= 0 && record.reviewLaterLessonIds.includes(LESSONS[index].id)
  const canSave = status === 'empty' || status === 'saved'
  const map = courseMap()
  return (
    <>
      <Link href={previous ? `${BASE_PATH}/learn?lesson=${previous.id}` : BASE_PATH}>
        {previous ? 'Previous lesson' : 'Back to overview'}
      </Link>
      {next && <Link href={`${BASE_PATH}/learn?lesson=${next.id}`}>Next lesson</Link>}
      <button ref={trigger} onClick={() => setOpen(true)}>
        Course outline
      </button>
      {index >= 0 && canSave && (
        // A bookmark only (the record's reviewLaterLessonIds); separate from Mark reviewed.
        <button
          aria-pressed={savedForLater}
          onClick={() => setLessonReviewLater(LESSONS[index].id, !savedForLater)}
        >
          Save for later
        </button>
      )}
      <HelpDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Course outline · ${LESSONS.length} lessons`}
        returnFocusTo={trigger}
      >
        <p>
          Every lesson is open. Take them in order or go straight to the one you need. Times are the
          authors’ estimates.
        </p>
        <ol>
          {LESSONS.map((lesson) => {
            const pattern = patternFor(lesson.id)
            return (
              <li key={lesson.id}>
                <Link
                  href={`${BASE_PATH}/learn?lesson=${lesson.id}`}
                  aria-current={lesson.id === currentId ? 'page' : undefined}
                >
                  {lesson.title}
                </Link>
                {pattern ? ` · ${pattern.name.toLowerCase()} pattern` : ''} · about {lesson.minutes}{' '}
                min
                {record.reviewedLessonIds.includes(lesson.id)
                  ? ' · marked reviewed'
                  : record.visitedLessonIds.includes(lesson.id)
                    ? ' · opened'
                    : ''}
                {record.reviewLaterLessonIds.includes(lesson.id) ? ' · saved for later' : ''}
              </li>
            )
          })}
        </ol>
        <p>
          After the lessons (suggested, always open):{' '}
          <Link href={`${BASE_PATH}/practice`}>Practice</Link>, full routes to a simulated nodule in
          one of {map.practiceTargets} segments; then, if you want more,{' '}
          <Link href={`${BASE_PATH}/assess`}>More routes</Link>, an optional revisit set of{' '}
          {map.moreRoutes} routes in the same CT.
        </p>
        <p>
          Save for later bookmarks a lesson; Mark reviewed, offered at the end of each lesson, is
          your own note that you reached the end. Neither is a result.
        </p>
      </HelpDialog>
    </>
  )
}
