import type { Metadata } from 'next'
import { ExternalLink, FileText, ShieldCheck } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { tracheostomyNavBase } from '@/features/learning-module/moduleRoutes'
import { TracheostomyModuleHeader } from '@/features/tracheostomy/components/TracheostomyModuleHeader'
import { TracheostomyNav } from '@/features/tracheostomy/components/TracheostomyNav'
import { tracheostomyReferences } from '@/features/tracheostomy/content/references'
import { HandoffContent } from '@/i18n/handoff'

export const metadata: Metadata = {
  title: 'References · Tracheostomy Knowledge Lab',
  description:
    'Source notes, adult clinical guidelines, consensus statements, studies, and evidence boundaries.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

const sourceTypeLabel = {
  guideline: 'Clinical guideline',
  consensus: 'Consensus',
  trial: 'Clinical trial',
  review: 'Review',
  study: 'Study',
  'source-brief': 'Authoring brief',
} as const

export default async function TracheostomyReferencesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <TracheostomyModuleHeader
            title="Evidence, boundaries, and source notes"
            description="See where the module's claims come from, which recommendations are consensus rather than high-grade evidence, and where local policy or manufacturer instructions must take over."
          />
          <TracheostomyNav activeHref={`${tracheostomyNavBase}/references`} />

          <section className="container max-w-5xl space-y-6">
            <article
              id="knowledge-base"
              className="scroll-mt-28 rounded-3xl border border-sky-500/30 bg-sky-500/5 p-6 shadow-sm"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                    <FileText className="h-5 w-5" aria-hidden />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                      Attached knowledge source
                    </p>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">
                    Tracheostomy Education Module Knowledge Base
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    The supplied July 2026 Word knowledge base defined the adult scope, sixteen-part
                    curriculum, tube taxonomy, procedure and care sequences, simulation cases,
                    competency targets, and seventeen primary literature anchors. It contained no
                    instructional images or 3D assets, so every visual in this module was created or
                    modeled for the learning experience.
                  </p>
                </div>
                <Badge variant="info" className="w-fit rounded-full px-3 py-1">
                  Primary authoring brief
                </Badge>
              </div>
            </article>

            <div className="grid gap-4 md:grid-cols-2">
              {tracheostomyReferences
                .filter((reference) => reference.sourceType !== 'source-brief')
                .map((reference) => (
                  <article
                    key={reference.id}
                    className="flex h-full flex-col rounded-3xl border border-border/70 bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Badge
                        variant="outline"
                        className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide"
                      >
                        {sourceTypeLabel[reference.sourceType]}
                      </Badge>
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open source: ${reference.title}`}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-foreground">
                      {reference.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {reference.citation}
                    </p>
                    <p className="mt-4 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
                      <span className="font-semibold text-foreground">Used for:</span>{' '}
                      {reference.use}
                    </p>
                  </article>
                ))}
            </div>

            <article className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300"
                  aria-hidden
                />
                <div>
                  <h2 className="text-base font-semibold text-foreground">Evidence boundary</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Many tracheostomy care practices are supported by consensus, implementation
                    studies, and indirect evidence rather than high-certainty randomized data. The
                    2026 adult-ICU consensus contains expert-opinion recommendations, including the
                    educational cuff-pressure range used here. Exact tube care, cuff targets,
                    fenestration, cleaning, change intervals, speaking-valve setup, and emergency
                    actions must be reconciled with the device instructions and the
                    institution&apos;s airway policy before clinical use.
                  </p>
                </div>
              </div>
            </article>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
