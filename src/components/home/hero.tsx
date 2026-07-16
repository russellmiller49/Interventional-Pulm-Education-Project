'use client'

import type { Route } from 'next'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'
import { HandoffContent } from '@/i18n/handoff'

export function Hero() {
  const t = useTranslations('home')

  const highlights = [
    {
      href: '/ebus-training/simulator',
      label: t('heroHighlights.ebusSimulator'),
    },
    {
      href: '/therapeutic-bronchoscopy',
      label: t('heroHighlights.therapeuticBronchoscopy'),
    },
    {
      href: '/tracheostomy',
      label: t('heroHighlights.tracheostomy'),
    },
    {
      href: '/journal-club-podcasts',
      label: t('heroHighlights.podcastLibrary'),
    },
  ] as const

  return (
    <HandoffContent>
      {
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-sky-500/90 via-sky-500/80 to-teal-500/80 p-[1px] shadow-lg">
          <section
            className={cn(
              'relative isolate flex flex-col gap-8 overflow-hidden rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-sky-950/80 via-sky-900/70 to-teal-900/70 px-8 py-16 text-white shadow-[0_20px_60px_-40px_rgba(14,165,233,0.8)]',
              'md:px-16 md:py-24',
            )}
          >
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent_55%)]" />
              <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_bottom,_rgba(20,184,166,0.25),_transparent_65%)] blur-3xl" />
            </div>
            <div className="max-w-4xl space-y-6">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
                {t('heroEyebrow')}
              </span>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                {t('heroTitle')}
              </h1>
              <p className="text-base text-sky-100 md:text-lg">{t('heroBody')}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-11 rounded-full bg-white text-sky-900 hover:bg-sky-100"
                >
                  <Link href={'/therapeutic-bronchoscopy' as Route}>
                    {t('exploreTherapeuticBronchoscopy')}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-full border-white/60 bg-transparent text-white hover:border-white hover:bg-white/10"
                >
                  <Link href={'/ebus-training/simulator' as Route}>{t('openUpdatedEbus')}</Link>
                </Button>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {highlights.map((highlight) => (
                <Link
                  key={highlight.href}
                  href={highlight.href as Route}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
                >
                  {highlight.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
