import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChecklistButton } from '@/components/training/ChecklistButton'
import { LongitudinalCurriculum } from '@/components/training/LongitudinalCurriculum'
import { Quiz } from '@/components/training/Quiz'
import { VideoPlayer } from '@/components/training/VideoPlayer'
import { rigidBronchoscopyCurriculum } from '@/data/rigid-bronchoscopy-curriculum'
import { trainingModuleSlugs, trainingModules } from '@/data/training-modules'
import { formatDuration } from '@/lib/format-duration'

interface TrainingModulePageProps {
  params: { module: string }
}

const categoryLabels = {
  'rigid-bronchoscopy': 'Rigid Bronchoscopy',
  ebus: 'EBUS',
  navigation: 'Navigation',
  ablation: 'Ablation',
  stents: 'Airway Stents',
} as const

const difficultyLabels = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const

const formatLabels = {
  theory: 'Theory',
  video: 'Video',
  'hands-on': 'Hands-on',
  simulation: 'Simulation',
  assessment: 'Assessment',
} as const

type ModuleFormatLabel = keyof typeof formatLabels

export function generateStaticParams() {
  return trainingModuleSlugs.map((slug) => ({ module: slug }))
}

export function generateMetadata({ params }: TrainingModulePageProps): Metadata {
  const trainingModule = trainingModules.find((item) => item.slug === params.module)

  if (!trainingModule) {
    return {
      title: 'Training module not found',
    }
  }

  return {
    title: `${trainingModule.title} | Training Module`,
    description: trainingModule.summary,
  }
}

export default function TrainingModulePage({ params }: TrainingModulePageProps) {
  const trainingModule = trainingModules.find((item) => item.slug === params.module)

  if (!trainingModule) {
    notFound()
  }

  const checklistItems = trainingModule.sections.flatMap((section) => section.checklistItems ?? [])
  const uniqueFormats = Array.from(
    new Set(trainingModule.sections.map((section) => section.format)),
  ) as ModuleFormatLabel[]
  const defaultTab = uniqueFormats[0] ?? 'theory'

  const jsonLdCourse = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: trainingModule.title,
    description: trainingModule.summary,
    educationalLevel: difficultyLabels[trainingModule.difficulty],
    provider: {
      '@type': 'Organization',
      name: 'Interventional Pulmonology Collaborative',
    },
  }

  return (
    <div className="space-y-16 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdCourse) }}
      />
      <section className="container grid gap-10 overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="space-y-6">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]"
          >
            {categoryLabels[trainingModule.category]}
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              {trainingModule.title}
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">{trainingModule.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
              {difficultyLabels[trainingModule.difficulty]}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Duration · {formatDuration(trainingModule.durationMinutes)}
            </Badge>
            {trainingModule.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="rounded-full px-3 py-1">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="default">
              Launch module flow
            </Button>
            {checklistItems.length ? (
              <ChecklistButton moduleTitle={trainingModule.title} items={checklistItems} />
            ) : null}
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-border/60 bg-background/70 p-6 text-sm text-muted-foreground">
          <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
            Prerequisites
          </h2>
          <ul className="space-y-2">
            {trainingModule.prerequisites.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
              Equipment
            </h3>
            <ul className="mt-2 space-y-1">
              {trainingModule.equipment.map((item) => (
                <li key={item} className="text-xs text-muted-foreground/90">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">Curriculum</h2>
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-2">
            {uniqueFormats.map((format) => (
              <TabsTrigger
                key={format}
                value={format}
                className="rounded-full px-4 py-2 text-sm font-medium"
              >
                {formatLabels[format]}
              </TabsTrigger>
            ))}
          </TabsList>
          {uniqueFormats.map((format) => (
            <TabsContent key={format} value={format} className="space-y-6">
              {trainingModule.sections
                .filter((section) => section.format === format)
                .map((section) => (
                  <Card key={section.title} className="border-border/60 bg-card/80">
                    <CardContent className="space-y-4 p-5 text-sm text-muted-foreground">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/80">
                        <span className="font-semibold text-foreground">{section.title}</span>
                        {section.durationMinutes ? (
                          <span>{section.durationMinutes} min</span>
                        ) : null}
                      </div>
                      <p>{section.description}</p>
                      {section.videoUrl ? (
                        <VideoPlayer src={section.videoUrl} title={section.title} />
                      ) : null}
                      {section.checklistItems && section.checklistItems.length ? (
                        <div className="space-y-2 rounded-2xl border border-border/60 bg-background/60 p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
                            Checklist focus
                          </h4>
                          <ul className="space-y-1">
                            {section.checklistItems.map((item) => (
                              <li key={item} className="text-xs text-muted-foreground/90">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {section.resources && section.resources.length ? (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
                            Resources
                          </h4>
                          <ul className="space-y-1 text-xs">
                            {section.resources.map((resource) => (
                              <li key={resource.href}>
                                <a
                                  className="text-primary hover:text-primary/80"
                                  href={resource.href}
                                >
                                  {resource.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {trainingModule.slug === 'rigid-bronchoscopy-foundations' ? (
        <section className="container">
          <LongitudinalCurriculum months={rigidBronchoscopyCurriculum} />
        </section>
      ) : null}

      <section className="container grid gap-8 md:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-border/60 bg-card/70 p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Learning outcomes
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {trainingModule.outcomes.map((outcome) => (
              <li key={outcome} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </div>
        {trainingModule.quiz ? (
          <Quiz title={trainingModule.quiz.title} questions={trainingModule.quiz.questions} />
        ) : null}
      </section>
    </div>
  )
}
