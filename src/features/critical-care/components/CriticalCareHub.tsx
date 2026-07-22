import type { Route } from 'next'
import {
  Activity,
  ArrowRight,
  Droplets,
  Gauge,
  HeartPulse,
  ShieldCheck,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

import { criticalCareModules, type CriticalCareModuleIcon } from '../content/modules'

const moduleIcons: Record<CriticalCareModuleIcon, LucideIcon> = {
  hemodynamics: Activity,
  ventilation: Wind,
  'circulatory-support': HeartPulse,
  ecmo: Gauge,
  crrt: Droplets,
}

export function CriticalCareHub() {
  return (
    <main className="relative overflow-hidden py-12 md:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-gradient-to-b from-sky-500/10 via-cyan-500/5 to-transparent"
      />

      <div className="container space-y-10">
        <header className="max-w-4xl space-y-5">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Critical care education
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Critical Care Learning Center
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Open a focused learning lab for hemodynamics, ventilation, circulatory support, ECMO,
              or continuous renal replacement therapy. Each module keeps its own learning path and
              saved progress.
            </p>
          </div>
          <div className="flex max-w-3xl items-start gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 text-sm leading-6 text-muted-foreground shadow-sm backdrop-blur">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              For clinician education and simulation only. Apply institutional protocols,
              manufacturer instructions, patient-specific assessment, and clinical judgment in real
              care.
            </p>
          </div>
        </header>

        <section aria-labelledby="critical-care-modules" className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Module library
              </p>
              <h2 id="critical-care-modules" className="mt-1 text-2xl font-semibold tracking-tight">
                Choose a learning lab
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">Five independent modules</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {criticalCareModules.map((module) => {
              const Icon = moduleIcons[module.icon]

              return (
                <Card key={module.slug} className="h-full hover:border-primary/40">
                  <CardHeader className="gap-4 border-b-0 pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        {module.eyebrow}
                      </p>
                      <CardTitle>{module.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pt-2">
                    <p className="text-sm leading-6 text-muted-foreground">{module.description}</p>
                    <ul className="flex flex-wrap gap-2" aria-label={`${module.title} topics`}>
                      {module.topics.map((topic) => (
                        <li
                          key={topic}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={module.href as Route}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={`Open ${module.title}`}
                    >
                      Open module
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
