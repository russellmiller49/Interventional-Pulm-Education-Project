import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { Gauge, Map, Radar, ScanEye } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { adminEbusTrainingModules, publicEbusTrainingModules } from '@/data/ebus-training'
import { canCurrentUserViewDraftModules } from '@/lib/draft-module-guard'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'EBUS Training',
  description:
    'EBUS training assets for knobology, mediastinal stations, and EBUS simulation without course participant lockout requirements.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const moduleIcons = {
  knobology: Gauge,
  stations: Map,
  simulator: Radar,
  'virtual-bronchoscopy': ScanEye,
} as const

export default async function EbusTrainingPage() {
  const canViewAdminModules = await canCurrentUserViewDraftModules()
  const modules = canViewAdminModules
    ? [...publicEbusTrainingModules, ...adminEbusTrainingModules]
    : publicEbusTrainingModules

  return (
    <HandoffContent>
      {
        <div className="space-y-14 py-16">
          <section className="container space-y-6">
            <div className="max-w-4xl space-y-3">
              <Badge
                variant="info"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                EBUS training
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">EBUS Training</h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Standalone EBUS learning assets for ultrasound knobology, mediastinal stations, and
                simulation practice. These modules do not require the Southern California EBUS
                Course lecture sequence, pretest, or sign-in.
              </p>
            </div>
          </section>

          <section className="container grid gap-4 md:grid-cols-3">
            {modules.map((module) => {
              const Icon = moduleIcons[module.slug as keyof typeof moduleIcons]

              return (
                <Link
                  key={module.slug}
                  href={module.href as Route}
                  className="group rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-sky-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{module.title}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                  <span className="mt-5 inline-flex text-sm font-semibold text-primary">
                    Open module
                  </span>
                </Link>
              )
            })}
          </section>
        </div>
      }
    </HandoffContent>
  )
}
