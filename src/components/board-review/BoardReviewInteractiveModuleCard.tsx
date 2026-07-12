import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { BoardReviewInteractiveModule } from '@/data/board-review'
import { HandoffContent } from '@/i18n/handoff'
import type { ActiveLocale } from '@/i18n/locale'
import { localizePath } from '@/i18n/path'

interface BoardReviewInteractiveModuleCardProps {
  interactiveModule: BoardReviewInteractiveModule
  locale: ActiveLocale
}

export function BoardReviewInteractiveModuleCard({
  interactiveModule,
  locale,
}: BoardReviewInteractiveModuleCardProps) {
  const titleId = 'board-review-interactive-module-title'

  return (
    <HandoffContent>
      {
        <Card
          aria-labelledby={titleId}
          className="border-primary/40 bg-gradient-to-br from-primary/15 via-primary/10 to-card shadow-md shadow-primary/10"
          role="region"
        >
          <CardContent className="space-y-4 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Interactive chapter
            </p>
            <div className="space-y-2">
              <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
                {interactiveModule.label}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {interactiveModule.description}
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={localizePath(interactiveModule.href, locale) as Route}
            >
              <span>{interactiveModule.label}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      }
    </HandoffContent>
  )
}
