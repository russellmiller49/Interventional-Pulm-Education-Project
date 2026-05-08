import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const roadmapSections = [
  {
    id: 'tools',
    label: 'Tools',
    title: 'Procedure planning tools',
    description:
      'Re-launching the tooling catalog with search, release notes, and guided deployments so you can run navigation planners, segmentation pipelines, and QA calculators without hunting through repositories.',
    bullets: [
      'One-click deploys to hosted sandboxes',
      'Detailed changelogs and compatibility notes',
      'Authenticated API keys for data-backed widgets',
    ],
  },
  {
    id: 'make',
    label: 'DIY Lab',
    title: 'Maker projects & printable simulators',
    description:
      'A refreshed DIY Lab with validated STLs, BOMs, and build videos for airway trainers, pleural models, and safety testing rigs.',
    bullets: [
      'Step-by-step build flows with tool lists',
      'Bill of materials downloads and purchasing sources',
      'Simulation scenarios that align with competency checklists',
    ],
  },
  {
    id: 'training',
    label: 'Training',
    title: 'Simulation-backed training pathways',
    description:
      'Interactive curricula with facilitator guides, longitudinal tracking, and assessment exports so programs can adopt modules out-of-the-box.',
    bullets: [
      'Modular objectives tied to exam blueprints',
      'Printable and digital assessment checklists',
      'Analytics for cohort and individual progress',
    ],
  },
  {
    id: 'community',
    label: 'Community',
    title: 'Contributor and discussion hub',
    description:
      'Highlighting contributor stories, governance updates, and discussion spaces that keep clinicians, engineers, and educators aligned.',
    bullets: [
      'Spotlights on new labs and implementations',
      'Calls for collaboration and pilot programs',
      'Best-practice repositories + governance updates',
    ],
  },
]

export const metadata: Metadata = {
  title: 'Coming Soon | Interventional Pulmonology Collaborative',
  description:
    'Preview the Tools, DIY Lab, Training, and Community experiences that are currently in development.',
}

export default function ComingSoonPage() {
  return (
    <div className="space-y-16 py-16">
      <section className="container space-y-6 text-center">
        <Badge variant="info" className="rounded-full px-4 py-1 text-xs uppercase tracking-[0.3em]">
          In development
        </Badge>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Coming soon</h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            Tools, DIY build guides, simulation curricula, and community hubs are being refactored.
            Here&apos;s what to expect as these sections return to production.
          </p>
        </div>
      </section>
      <section className="container grid gap-6 md:grid-cols-2">
        {roadmapSections.map((section) => (
          <Card
            key={section.id}
            id={section.id}
            className="border-border/60 bg-card/80 shadow-sm transition hover:shadow-lg"
          >
            <CardHeader className="space-y-2">
              <Badge variant="outline" className="w-fit rounded-full uppercase tracking-[0.3em]">
                {section.label}
              </Badge>
              <CardTitle className="text-xl font-semibold tracking-tight">
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>{section.description}</p>
              <ul className="space-y-2 text-xs text-muted-foreground/80">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
