import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { Ruler, Telescope } from 'lucide-react'

import { BronchoscopeSizeExplorer } from '@/components/bronchoscope-size-explorer/BronchoscopeSizeExplorer'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Intro to Bronchoscopy Modules',
  description:
    'Introductory bronchoscopy education modules for scope sizing, airway reach, and instrument compatibility.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const introModules = [
  {
    href: '/intro-bronchoscopy',
    title: 'Bronchoscope Size Explorer',
    description: 'Compare scope diameter, working channel size, airway reach, and tool fit.',
    status: 'Live',
    icon: Ruler,
  },
  {
    href: '/coming-soon',
    title: 'Scope handling foundations',
    description: 'Orientation, insertion ergonomics, and basic bronchoscopic navigation drills.',
    status: 'Planned',
    icon: Telescope,
  },
] as const

export default function IntroBronchoscopyPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-14 py-16">
          <section className="container space-y-8">
            <div className="max-w-4xl space-y-4">
              <Badge
                variant="info"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                Intro bronchoscopy
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  Intro to bronchoscopy modules
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                  Foundational learning tools for flexible bronchoscopy concepts, scope dimensions,
                  airway access, and instrument-channel tradeoffs.
                </p>
              </div>
            </div>

            <nav aria-label="Intro bronchoscopy module tabs">
              <div className="grid gap-3 rounded-2xl border border-border/80 bg-background/70 p-2 shadow-sm md:grid-cols-2">
                {introModules.map((module) => {
                  const Icon = module.icon
                  const isActive = module.href === '/intro-bronchoscopy'

                  return (
                    <Link
                      key={module.title}
                      href={module.href as Route}
                      aria-current={isActive ? 'page' : undefined}
                      className={
                        isActive
                          ? 'group flex min-h-24 items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                          : 'group flex min-h-24 items-start gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      }
                    >
                      <span
                        className={
                          isActive
                            ? 'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground'
                            : 'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary'
                        }
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{module.title}</span>
                          <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {module.status}
                          </span>
                        </span>
                        <span className="block text-xs leading-5 text-muted-foreground">
                          {module.description}
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </nav>
          </section>

          <BronchoscopeSizeExplorer />
        </div>
      }
    </HandoffContent>
  )
}
