'use client'

import { Check, Circle } from 'lucide-react'

import type { StentLessonId } from '../../engine/learningLabTypes'
import { cn } from '@/lib/cn'

export interface LessonStepperItem {
  id: StentLessonId
  label: string
  shortLabel: string
}

interface LessonStepperProps {
  activeLessonId: StentLessonId
  completedLessonIds: StentLessonId[]
  lessons: LessonStepperItem[]
  onSelect: (lessonId: StentLessonId) => void
}

export function LessonStepper({
  activeLessonId,
  completedLessonIds,
  lessons,
  onSelect,
}: LessonStepperProps) {
  const completed = new Set(completedLessonIds)

  return (
    <nav aria-label="Airway stent learning lab lessons">
      <ol className="flex snap-x gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0">
        {lessons.map((lesson, index) => {
          const isActive = lesson.id === activeLessonId
          const isComplete = completed.has(lesson.id)

          return (
            <li key={lesson.id} className="min-w-[11.5rem] snap-start lg:min-w-0">
              <button
                type="button"
                onClick={() => onSelect(lesson.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex min-h-20 w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none',
                  isActive
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-foreground shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-cyan-500/35 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                    isComplete
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isActive
                        ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                        : 'border-border bg-background',
                  )}
                  aria-hidden
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-5 text-current">
                    {lesson.shortLabel}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs leading-4">
                    {!isComplete ? <Circle className="h-2.5 w-2.5" aria-hidden /> : null}
                    {isComplete ? 'Completed' : isActive ? 'In progress' : 'Open lesson'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
