'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/ui/badge'
import {
  type ModuleProgressMap,
  countCompletedSections,
  isModuleComplete,
  readModuleProgress,
} from '@/features/learning-module/engine/moduleProgress'

import type { PleuralModule } from '../content/types'

const statusLabel: Record<PleuralModule['status'], string> = {
  live: 'Live',
  planned: 'Coming soon',
}

interface PleuralLearningPathProps {
  modules: readonly PleuralModule[]
}

export function PleuralLearningPath({ modules }: PleuralLearningPathProps) {
  const [progress, setProgress] = useState<ModuleProgressMap>({})

  useEffect(() => {
    setProgress(readModuleProgress())
  }, [])

  const pathModules = modules
    .filter((module) => !module.experimental)
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  const experimentalModules = modules.filter((module) => module.experimental)

  return (
    <div className="space-y-10">
      <ol className="grid gap-4">
        {pathModules.map((module, index) => (
          <li key={module.id}>
            <ModuleCard module={module} step={index + 1} record={progress[module.id]} />
          </li>
        ))}
      </ol>

      {experimentalModules.length ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Experimental / prototypes</h2>
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Not part of the core path
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {experimentalModules.map((module) => (
              <ModuleCard key={module.id} module={module} record={progress[module.id]} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ModuleCard({
  module,
  step,
  record,
}: {
  module: PleuralModule
  step?: number
  record?: ModuleProgressMap[string]
}) {
  const completedSections = countCompletedSections(record)
  const complete = isModuleComplete(record)

  return (
    <Link
      href={module.route as Route}
      className="group flex gap-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {step ? (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-sky-600">
          {step}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{module.title}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {statusLabel[module.status]}
          </span>
          {complete ? (
            <Badge
              variant="success"
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
            >
              Complete
            </Badge>
          ) : completedSections > 0 ? (
            <Badge
              variant="info"
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
            >
              {completedSections}/3 sections
            </Badge>
          ) : null}
        </div>
        {module.summary ? (
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{module.summary}</p>
        ) : null}
      </div>
    </Link>
  )
}
