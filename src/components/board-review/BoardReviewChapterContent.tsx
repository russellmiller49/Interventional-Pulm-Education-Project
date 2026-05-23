'use client'

import dynamic from 'next/dynamic'

import { Card, CardContent } from '@/components/ui/card'
import type { BoardReviewSection } from '@/lib/board-review-loader'

const BoardReviewHtmlFrame = dynamic(
  () => import('./BoardReviewHtmlFrame').then((module) => module.BoardReviewHtmlFrame),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        Loading chapter content...
      </div>
    ),
  },
)

const BoardReviewSections = dynamic(
  () => import('./BoardReviewSections').then((module) => module.BoardReviewSections),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        Loading interactive sections...
      </div>
    ),
  },
)

const MarkdownContent = dynamic(
  () => import('./MarkdownContent').then((module) => module.MarkdownContent),
  {
    ssr: false,
  },
)

interface BoardReviewChapterContentProps {
  formattedHtml?: string
  intro?: string
  sections: BoardReviewSection[]
  title: string
}

export function BoardReviewChapterContent({
  formattedHtml,
  intro,
  sections,
  title,
}: BoardReviewChapterContentProps) {
  if (formattedHtml) {
    return <BoardReviewHtmlFrame html={formattedHtml} title={title} />
  }

  return (
    <>
      {intro ? (
        <Card className="border-border/60 bg-card/80">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
              Orientation
            </h2>
            <MarkdownContent content={intro} />
          </CardContent>
        </Card>
      ) : null}
      <BoardReviewSections sections={sections} />
    </>
  )
}
