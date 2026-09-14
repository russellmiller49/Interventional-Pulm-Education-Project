'use client'
import { useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { BASE_PATH, LESSONS } from '../content/lessons'

export function CourseOutline({ currentId }: { currentId?: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const previous = LESSONS[LESSONS.findIndex((lesson) => lesson.id === currentId) - 1]
  return (
    <>
      <Link href={previous ? `${BASE_PATH}/learn?lesson=${previous.id}` : BASE_PATH}>
        {previous ? 'Previous lesson' : 'Back to overview'}
      </Link>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Course outline
      </button>
      <HelpDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Course outline · ${LESSONS.length} lessons`}
        returnFocusTo={trigger}
      >
        <ol>
          {LESSONS.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`${BASE_PATH}/learn?lesson=${lesson.id}`}
                aria-current={lesson.id === currentId ? 'page' : undefined}
              >
                {lesson.title}
              </Link>
            </li>
          ))}
        </ol>
      </HelpDialog>
    </>
  )
}
