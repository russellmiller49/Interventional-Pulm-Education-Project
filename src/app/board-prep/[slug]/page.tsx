import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BoardReviewProgressToggle } from '@/components/board-review/BoardReviewProgressToggle'
import { BoardReviewSections } from '@/components/board-review/BoardReviewSections'
import { MarkdownContent } from '@/components/board-review/MarkdownContent'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { boardReviewCategoryLabels } from '@/data/board-review'
import { formatDuration } from '@/lib/format-duration'
import { loadBoardReviewChapter, listBoardReviewChapters } from '@/lib/board-review-loader'

interface BoardPrepModulePageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  return listBoardReviewChapters().map((chapter) => ({ slug: chapter.slug }))
}

export async function generateMetadata({ params }: BoardPrepModulePageProps): Promise<Metadata> {
  const chapter = await loadBoardReviewChapter(params.slug)

  if (!chapter) {
    return {
      title: 'Board review chapter not found',
    }
  }

  return {
    title: `${chapter.title} | IP Board Prep`,
    description: chapter.summary,
  }
}

export default async function BoardPrepModulePage({ params }: BoardPrepModulePageProps) {
  const chapter = await loadBoardReviewChapter(params.slug)

  if (!chapter) {
    notFound()
  }

  const categoryLabel = boardReviewCategoryLabels[chapter.category]
  const allChapters = listBoardReviewChapters()
  const peerChapters = allChapters.filter((item) => item.category === chapter.category && item.slug !== chapter.slug)

  return (
    <div className="space-y-16 py-16">
      <section className="container grid gap-10 overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="space-y-6">
          <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            {categoryLabel}
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{chapter.title}</h1>
            <p className="text-lg text-muted-foreground md:text-xl">{chapter.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
              {chapter.examDomains.join(' • ')}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Reading time · {formatDuration(chapter.readingMinutes)}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Word count · {chapter.wordCount.toLocaleString()}
            </Badge>
          </div>
          <BoardReviewProgressToggle slug={chapter.slug} title={chapter.title} />
        </div>
        <div className="space-y-4 rounded-3xl border border-border/60 bg-background/70 p-6 text-sm text-muted-foreground">
          <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
            Exam mapping & scope
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{chapter.examScope}</p>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">Focus this round</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground/90">
              {chapter.focus.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {chapter.intro ? (
            <Card className="border-border/60 bg-card/80">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
                  Orientation
                </h2>
                <MarkdownContent content={chapter.intro} />
              </CardContent>
            </Card>
          ) : null}
          <BoardReviewSections sections={chapter.sections} />
        </div>
        <aside className="space-y-6">
          <Card className="border-emerald-500/40 bg-emerald-500/10">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
                High-yield pearls
              </h2>
              <ul className="space-y-2 text-sm text-emerald-700 dark:text-emerald-200">
                {chapter.highYield.length ? (
                  chapter.highYield.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>{point}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground">
                    This chapter’s pearls will auto-populate when the “High-Yield” section is ready.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
                Related chapters
              </h2>
              {peerChapters.length ? (
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {peerChapters.slice(0, 4).map((peer) => (
                    <li key={peer.slug} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                      <a className="text-primary hover:text-primary/80" href={`/board-prep/${peer.slug}`}>
                        {peer.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground/80">
                  This domain will expand as additional chapters publish.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardContent className="space-y-3 p-6 text-xs text-muted-foreground">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
                Study notes
              </h2>
              <p>
                Coming soon: embed flashcards, attach question banks, and export PDF summaries once MDX components land
                in the content system.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  )
}
