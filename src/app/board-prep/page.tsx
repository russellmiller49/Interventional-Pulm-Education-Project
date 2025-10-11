import type { Metadata } from 'next'
import Link from 'next/link'

import { BoardReviewCatalog } from '@/components/board-review/BoardReviewCatalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { boardReviewCategoryLabels } from '@/data/board-review'
import { listBoardReviewChapters } from '@/lib/board-review-loader'

export const metadata: Metadata = {
  title: 'IP Board Prep Modules',
  description:
    'Interactive study modules, exam-aligned checklists, and high-yield notes to help you prepare for the Interventional Pulmonology board exam.',
}

export default function BoardPrepPage() {
  const chapters = listBoardReviewChapters()
  const totalMinutes = chapters.reduce((sum, chapter) => sum + chapter.estimatedMinutes, 0)

  return (
    <div className="space-y-16 py-16">
      <section className="container grid gap-10 overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-8 md:grid-cols-[1.3fr_0.7fr] md:p-12">
        <div className="space-y-6">
          <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            IP board prep
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Interactive board review for interventional pulmonology
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Accelerate exam readiness with modular chapters that blend high-yield pearls, exam mapping,
              collapsible study sections, and locally-tracked progress.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {Object.entries(boardReviewCategoryLabels).map(([key, label]) => (
              <Badge key={key} variant="outline" className="rounded-full px-3 py-1">
                {label}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/board-prep/${chapters[0]?.slug ?? ''}`}>Start with first chapter</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/training">Visit simulation modules</Link>
            </Button>
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-border/60 bg-background/70 p-6 text-sm text-muted-foreground">
          <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
            Study system snapshot
          </h2>
          <p className="text-xs text-muted-foreground/80">
            Progress syncs locally for now. Contentlayer integration and analytics arrive with the next milestone,
            so you can expand this library without migrations.
          </p>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
              <dt className="text-muted-foreground/70">Chapters ready</dt>
              <dd className="text-lg font-semibold text-foreground">{chapters.length}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
              <dt className="text-muted-foreground/70">Estimated study time</dt>
              <dd className="text-lg font-semibold text-foreground">~{totalMinutes} min</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
              <dt className="text-muted-foreground/70">High-yield focus areas</dt>
              <dd className="text-lg font-semibold text-foreground">
                {chapters.reduce((sum, chapter) => sum + chapter.focus.length, 0)}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
              <dt className="text-muted-foreground/70">Exam domain coverage</dt>
              <dd className="text-lg font-semibold text-foreground">
                {chapters.reduce((sum, chapter) => sum + chapter.examDomains.length, 0)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="container space-y-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Choose your board review path</h2>
          <p className="text-sm text-muted-foreground">
            Filter by domain or search for anatomy, procedural, pleural, oncology, and practice-management topics. Each
            module supports collapsible study notes, high-yield summaries, and local progress tracking.
          </p>
        </div>
        <BoardReviewCatalog chapters={chapters} />
      </section>

      <section className="container">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="grid gap-6 p-6 text-sm text-muted-foreground md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">What’s bundled today</h3>
              <ul className="space-y-1">
                <li>• Collapsible chapter sections with instant search</li>
                <li>• High-yield pearls surfaced separately for rapid review</li>
                <li>• Local progress tracking and estimated reading time</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">Coming next</h3>
              <ul className="space-y-1">
                <li>• Contentlayer-powered MDX workflow with shared components</li>
                <li>• Integrated quizzes and adaptive question banks</li>
                <li>• Study analytics and cohort dashboards</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

