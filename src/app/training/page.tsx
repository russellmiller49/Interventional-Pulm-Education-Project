import Link from 'next/link'

import { ModuleCard } from '@/components/training/ModuleCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { trainingModules } from '@/data/training-modules'

const categoryOrder = [
  'rigid-bronchoscopy',
  'ebus',
  'navigation',
  'ablation',
  'stents',
] as const

const categoryLabels: Record<typeof categoryOrder[number], string> = {
  'rigid-bronchoscopy': 'Rigid Bronchoscopy',
  ebus: 'EBUS',
  navigation: 'Navigation',
  ablation: 'Ablation',
  stents: 'Airway Stents',
}

const progressPlaceholders = [
  { label: 'Cohort A fellows', value: 42 },
  { label: 'Visiting scholars', value: 18 },
  { label: 'Simulation faculty', value: 65 },
]

export default function TrainingPage() {
  return (
    <div className="space-y-16 py-16">
      <section className="container grid gap-10 overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="space-y-6">
          <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            Training platform
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Simulation-driven curricula for the IP lab</h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Cohesive training pathways spanning rigid bronchoscopy, EBUS, navigation, and airway stenting—complete with checklists, quizzes, and downloadable teaching aids.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {categoryOrder.map((category) => (
              <Badge key={category} variant="outline" className="rounded-full px-3 py-1">
                {categoryLabels[category]}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="#modules">Browse modules</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/training/rigid-bronchoscopy-foundations">Start with foundations</Link>
            </Button>
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-border/60 bg-background/70 p-6 text-sm text-muted-foreground">
          <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">Progress snapshot</h2>
          <p className="text-xs text-muted-foreground/80">
            Progress and credentialing dashboards will connect once learner accounts go live. Until then, track cohorts manually using the exported checklists.
          </p>
          <div className="space-y-3">
            {progressPlaceholders.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div style={{ width: `${item.value}%` }} className="h-full rounded-full bg-primary" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="container space-y-10">
        {categoryOrder.map((category) => {
          const modules = trainingModules.filter((module) => module.category === category)
          if (!modules.length) {
            return null
          }
          return (
            <div key={category} className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{categoryLabels[category]}</h2>
                  <p className="text-sm text-muted-foreground">
                    {modules.length} module{modules.length === 1 ? '' : 's'} covering core skills and assessment checklists.
                  </p>
                </div>
                <Button asChild variant="ghost">
                  <Link href={`/training/${modules[0].slug}`}>View recommended path →</Link>
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => (
                  <ModuleCard key={module.slug} module={module} />
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section className="container space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Competency aligned',
              description:
                'Each module maps directly to AABIP and program-specific milestones, with printable checklists and assessment rubrics.',
            },
            {
              title: 'Blended delivery',
              description:
                'Mix theory, video, simulation, and hands-on labs. Learners access curated resources and submit reflections in your LMS.',
            },
            {
              title: 'Assess & iterate',
              description:
                'Quizzes with explanations, PDF checklists, and analytics (M11) help faculty measure progress and adjust curricula quickly.',
            },
          ].map((item) => (
            <Card key={item.title} className="border-border/60 bg-card/80">
              <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p>{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
