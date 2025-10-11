import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { formatDuration } from '@/lib/format-duration'
import type { BoardReviewChapterMeta } from '@/data/board-review'
import { boardReviewCategoryLabels } from '@/data/board-review'

interface BoardReviewCardProps {
  chapter: BoardReviewChapterMeta
}

export function BoardReviewCard({ chapter }: BoardReviewCardProps) {
  return (
    <Card className="flex h-full flex-col justify-between border-border/70 bg-card/80">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            {boardReviewCategoryLabels[chapter.category]}
          </Badge>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {formatDuration(chapter.estimatedMinutes)} read
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{chapter.title}</h3>
          <p className="text-sm text-muted-foreground">{chapter.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p className="text-xs text-muted-foreground/80">{chapter.summary}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {chapter.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full px-3 py-1">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border/60 bg-muted/20 p-4">
        <span className="text-xs text-muted-foreground">Exam domains: {chapter.examDomains.length}</span>
        <Link
          href={`/board-prep/${chapter.slug}`}
          className="text-sm font-semibold text-primary transition hover:text-primary/80"
        >
          Enter module →
        </Link>
      </CardFooter>
    </Card>
  )
}

