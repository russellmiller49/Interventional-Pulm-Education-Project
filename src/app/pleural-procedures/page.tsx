import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { Activity, FlaskConical, Gauge, Stethoscope } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Pleural Procedures',
  description:
    'Interactive pleural procedure education modules for chest drainage physiology, knobology, troubleshooting, and assessment.',
}

const pleuralModules = [
  {
    href: '/pleural-procedures/chest-drainage',
    title: 'Chest Drainage Systems',
    description:
      'Dry-seal drainage simulator with water seal, air leak monitor, suction indicator, collection chamber, and troubleshooting rounds.',
    status: 'Live',
    icon: Gauge,
  },
  {
    href: '/pleural-procedures/pleural-fluid-analysis',
    title: 'Pleural Fluid Analysis',
    description:
      'Advanced diagnostic cockpit with ranked differentials, quiz mode, Light criteria, pseudoexudates, rare diseases, and clinical reconciliation.',
    status: 'Live',
    icon: FlaskConical,
  },
  {
    href: '/coming-soon',
    title: 'Thoracentesis and Pleural Access',
    description:
      'Ultrasound-guided access, safety checklist, needle path planning, and complications.',
    status: 'Planned',
    icon: Stethoscope,
  },
  {
    href: '/coming-soon',
    title: 'Pleural Infection Pathways',
    description: 'Drainage, loculation strategy, escalation logic, and source-control cases.',
    status: 'Planned',
    icon: Activity,
  },
] as const

export default function PleuralProceduresPage() {
  return (
    <div className="space-y-12 py-16">
      <section className="container space-y-6">
        <div className="max-w-4xl space-y-3">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Pleural procedures
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Pleural procedure modules
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            Interactive pleural education focused on pressure physiology, procedural equipment,
            device interpretation, and patient-first troubleshooting.
          </p>
        </div>
      </section>

      <section className="container grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pleuralModules.map((module) => {
          const Icon = module.icon

          return (
            <Link
              key={module.title}
              href={module.href as Route}
              className="group rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-sky-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{module.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {module.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
