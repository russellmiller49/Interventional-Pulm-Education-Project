'use client'

import dynamic from 'next/dynamic'

const AirwayAnatomyLesson = dynamic(
  () => import('./AirwayAnatomyLesson').then((module) => module.AirwayAnatomyLesson),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading airway anatomy lesson...
      </div>
    ),
  },
)

export function AirwayAnatomyLessonDynamic() {
  return <AirwayAnatomyLesson />
}
