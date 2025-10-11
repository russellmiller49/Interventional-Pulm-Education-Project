'use client'

import { useState } from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MarkdownContent } from '@/components/board-review/MarkdownContent'
import type { CurriculumMonth } from '@/types/curriculum'

interface LongitudinalCurriculumProps {
  months: CurriculumMonth[]
}

export function LongitudinalCurriculum({ months }: LongitudinalCurriculumProps) {
  const [expanded, setExpanded] = useState<number | null>(months[0]?.month ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Yearlong Rigid Bronchoscopy Curriculum
          </h2>
          <p className="text-sm text-muted-foreground">
            Twelve-month progression blending didactics, simulation, live case application, and
            reflection. Expand any month to review objectives, clinical focus areas, practice labs,
            and assessment prompts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(null)}
            disabled={expanded === null}
          >
            Collapse all
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setExpanded(months[0]?.month ?? null)}
            disabled={expanded === months[0]?.month}
          >
            Reset to Month 1
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {months.map((month) => {
          const isOpen = expanded === month.month
          return (
            <Card
              key={month.month}
              className="border-border/70 bg-card/70 transition hover:border-primary/60 focus-within:border-primary/60"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : month.month)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]"
                    >
                      Month {month.month}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Rigid Bronchoscopy Foundations
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{month.title}</h3>
                  <p className="text-sm text-muted-foreground">{month.description}</p>
                </div>
                <ChevronDownIcon
                  className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <CardContent className="space-y-6 border-t border-border/60 bg-background/80 px-5 py-6 text-sm text-muted-foreground">
                  {month.sections.map((section) => (
                    <div key={section.id} className="space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
                        {section.title}
                      </h4>
                      <MarkdownContent content={section.body} />
                    </div>
                  ))}
                </CardContent>
              ) : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
