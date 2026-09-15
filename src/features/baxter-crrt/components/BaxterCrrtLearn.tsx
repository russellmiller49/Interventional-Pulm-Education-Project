'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { baxterCrrtLearnLessonById } from '../content/learnLessons'
import type { BaxterCrrtLearnLessonId } from '../content/learnerRegistry'
import { CrrtFoundationLesson } from './CrrtFoundationLesson'
import { BaxterCrrtLearnLanding } from './BaxterCrrtLearnLanding'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'

function validLessonId(value: string | undefined): value is BaxterCrrtLearnLessonId {
  return value !== undefined && baxterCrrtLearnLessonById.has(value as BaxterCrrtLearnLessonId)
}

export function BaxterCrrtLearn({
  locale = 'en',
  initialLessonId,
}: {
  readonly locale?: string
  readonly initialLessonId?: string
}) {
  const [selection, setSelection] = useState(() => ({
    lessonId: validLessonId(initialLessonId) ? initialLessonId : null,
    revision: 0,
  }))
  const transition = useCallback((lessonId: BaxterCrrtLearnLessonId | null) => {
    setSelection((current) => ({ lessonId, revision: current.revision + 1 }))
  }, [])
  useEffect(() => {
    const restore = () => {
      const id = new URL(window.location.href).searchParams.get('lesson') ?? undefined
      transition(validLessonId(id) ? id : null)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [transition])
  const previousProp = useRef(initialLessonId)
  useEffect(() => {
    if (previousProp.current === initialLessonId) return
    previousProp.current = initialLessonId
    const timer = window.setTimeout(
      () => transition(validLessonId(initialLessonId) ? initialLessonId : null),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [initialLessonId, transition])
  function navigate(lessonId: BaxterCrrtLearnLessonId) {
    const url = new URL(window.location.href)
    url.searchParams.set('lesson', lessonId)
    window.history.pushState({}, '', `${url.pathname}${url.search}`)
    transition(lessonId)
  }
  if (!selection.lessonId)
    return (
      <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/learn`}>
        <BaxterCrrtLearnLanding />
      </BaxterCrrtModuleFrame>
    )
  const key = `${selection.lessonId}:${selection.revision}`
  return (
    <BaxterCrrtModuleFrame
      locale={locale}
      activeHref={`${baxterCrrtNavBase}/learn`}
      activityMode
      focusedLesson
    >
      <CrrtFoundationLesson
        key={key}
        lessonId={selection.lessonId}
        onNavigate={navigate}
        onRestart={() => transition(selection.lessonId)}
      />
    </BaxterCrrtModuleFrame>
  )
}
