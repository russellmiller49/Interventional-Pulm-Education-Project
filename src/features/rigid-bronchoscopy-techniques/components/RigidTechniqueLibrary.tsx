import type { Route } from 'next'
import Link from 'next/link'

import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import { canPublishClip } from '@/features/rigid-bronchoscopy-techniques/lib/validation'
import type {
  RigidBronchoscopyClip,
  TechniqueLesson,
} from '@/features/rigid-bronchoscopy-techniques/types'

interface RigidTechniqueLibraryProps {
  /** Lessons in display order. */
  lessons: TechniqueLesson[]
  clips: RigidBronchoscopyClip[]
  /** Route prefix for lesson links, e.g. `/en/rigid-bronchoscopy/techniques`. */
  basePath: string
  /** Development / admin only. Adds the draft-preview notice. */
  showDrafts?: boolean
}

/** Grid of technique lessons with a per-lesson production/approval summary. */
export function RigidTechniqueLibrary({
  lessons,
  clips,
  basePath,
  showDrafts = false,
}: RigidTechniqueLibraryProps) {
  const clipsByLesson = new Map<string, RigidBronchoscopyClip[]>()
  for (const clip of clips) {
    const existing = clipsByLesson.get(clip.lessonId)
    if (existing) {
      existing.push(clip)
    } else {
      clipsByLesson.set(clip.lessonId, [clip])
    }
  }

  return (
    <div className="space-y-4">
      {showDrafts ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
          {techniqueCopy.draftPreviewNotice}
        </p>
      ) : null}

      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lessons.map((lesson) => {
          const lessonClips = clipsByLesson.get(lesson.id) ?? []
          const approvedCount = lessonClips.filter(canPublishClip).length
          const status =
            approvedCount > 0
              ? `${approvedCount} of ${lessonClips.length} approved`
              : `${lessonClips.length} clips · in production`

          return (
            <li key={lesson.id}>
              <Link
                href={`${basePath}/${lesson.id}` as Route}
                className="group flex h-full flex-col rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-sky-600">
                  {lesson.order}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{lesson.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-6 text-muted-foreground">
                  {lesson.objective}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {status}
                </p>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
