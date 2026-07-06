'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import {
  Activity,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Gauge,
  LifeBuoy,
  Microscope,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

import { introBronchoscopyModules } from '../content/modules'
import {
  INTRO_BRONCHOSCOPY_SECTIONS,
  countIntroCompletedSections,
  emptyIntroBronchoscopyProgress,
  isIntroModuleComplete,
  readIntroBronchoscopyProgress,
  subscribeIntroBronchoscopyProgress,
} from '../engine/progress'

const iconByModule: Record<string, typeof Stethoscope> = {
  'decision-risk-planning': Stethoscope,
  'scope-anatomy-handling': Gauge,
  'airway-anatomy': Activity,
  'airway-pathology-description': Microscope,
  'diagnostic-tools-bal': FlaskConical,
  'therapeutic-tools-foreign-body': LifeBuoy,
  'icu-bronchoscopy': ShieldAlert,
  'airway-emergencies': ClipboardCheck,
  'documentation-communication': FileText,
}

export function IntroBronchoscopyCourseHub() {
  const progress = useSyncExternalStore(
    subscribeIntroBronchoscopyProgress,
    readIntroBronchoscopyProgress,
    emptyIntroBronchoscopyProgress,
  )
  const completed = introBronchoscopyModules.filter((module) =>
    isIntroModuleComplete(progress[module.id]),
  ).length
  const started = introBronchoscopyModules.filter(
    (module) => countIntroCompletedSections(progress[module.id]) > 0,
  ).length

  return (
    <div className="space-y-10">
      <section className="container space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Badge
              variant="info"
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              Intro bronchoscopy
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
                Intro to bronchoscopy curriculum
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                A visual, practice-forward curriculum for flexible bronchoscopy decision-making,
                scope handling, airway anatomy, diagnostic sampling, ICU physiology, emergencies,
                and documentation.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Course progress
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {completed}/{introBronchoscopyModules.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              modules complete · {started} started
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.round((completed / introBronchoscopyModules.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Educational use only.</span> These modules
          support training and simulation. They do not replace supervised bronchoscopy,
          institutional sedation policies, device instructions, or patient-specific clinical
          judgment.
        </div>
      </section>

      <section className="container grid gap-4 lg:grid-cols-3">
        {introBronchoscopyModules.map((module, index) => {
          const Icon = iconByModule[module.id] ?? Stethoscope
          const record = progress[module.id]
          const done = countIntroCompletedSections(record)
          const complete = isIntroModuleComplete(record)
          const href = `/intro-bronchoscopy/${module.slug}` as Route
          return (
            <Link
              key={module.id}
              href={href}
              className="group flex min-h-[19rem] flex-col rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 bg-background text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                    complete
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : done > 0
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {complete ? 'Complete' : done > 0 ? 'In progress' : 'Not started'}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Module {index + 1} · {module.estimatedMinutes} min
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {module.title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{module.summary}</p>
              </div>
              <div className="mt-auto pt-5">
                <div className="mb-3 flex gap-1">
                  {INTRO_BRONCHOSCOPY_SECTIONS.map((section) => (
                    <span
                      key={section}
                      className={cn(
                        'h-1.5 flex-1 rounded-full',
                        record?.[section] ? 'bg-primary' : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
                <span className="flex w-full justify-center rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors group-hover:border-primary/50">
                  Open module
                </span>
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
