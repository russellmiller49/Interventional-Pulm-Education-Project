'use client'
import { useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { BASE_PATH, LESSONS } from '../content/lessons'
import { setLessonReviewLater } from '../engine/selfPacedProgress'
import { useSelfPacedProgress } from './useSelfPacedProgress'

export function CourseOutline({ currentId }: { currentId?: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const { record, status } = useSelfPacedProgress()
  const index = LESSONS.findIndex((lesson) => lesson.id === currentId)
  const previous = index > 0 ? LESSONS[index - 1] : undefined
  const next = index >= 0 ? LESSONS[index + 1] : undefined
  const savedForReview = index >= 0 && record.reviewLaterLessonIds.includes(LESSONS[index].id)
  const canSave = status === 'empty' || status === 'saved'
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
        <button
          aria-pressed={savedForReview}
          onClick={() => setLessonReviewLater(LESSONS[index].id, !savedForReview)}
        >
          Save for review
        </button>
      )}
      <HelpDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Course outline · ${LESSONS.length} lessons`}
        returnFocusTo={trigger}
      >
        <p>Every lesson is open. Take them in order or go straight to the one you need.</p>
        <ol>
          {LESSONS.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`${BASE_PATH}/learn?lesson=${lesson.id}`}
                aria-current={lesson.id === currentId ? 'page' : undefined}
              >
                {lesson.title}
              </Link>
              {record.reviewedLessonIds.includes(lesson.id)
                ? ' · reviewed'
                : record.visitedLessonIds.includes(lesson.id)
                  ? ' · opened'
                  : ''}
              {record.reviewLaterLessonIds.includes(lesson.id) ? ' · saved for review' : ''}
            </li>
          ))}
        </ol>
      </HelpDialog>
    </>
  )
}
