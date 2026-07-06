import type { Route } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Hero } from '@/components/home/hero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { canCurrentUserViewDraftModules } from '@/lib/draft-module-guard'
import { isVisibleModulePath } from '@/lib/draft-modules'
import { HandoffContent } from '@/i18n/handoff'

const featureHighlightDefinitions = [
  {
    key: 'podcast',
    href: '/journal-club-podcasts',
  },
  {
    key: 'ebus',
    href: '/ebus-training',
  },
  {
    key: 'adminPreview',
    href: '/ebus-training/virtual-bronchoscopy',
  },
  {
    key: 'tnm',
    href: '/tnm-9-staging',
  },
  {
    key: 'anatomy',
    href: '/learn/anatomy',
  },
  {
    key: 'board',
    href: '/board-prep',
  },
  {
    key: 'fluoro',
    href: '/fluoroview',
  },
  {
    key: 'nav',
    href: '/bronch-navigation-trainer',
  },
  {
    key: 'intro',
    href: '/intro-bronchoscopy',
  },
  {
    key: 'pleural',
    href: '/pleural-procedures',
  },
  {
    key: 'pleuroscopy',
    href: '/pleural-procedures/pleuroscopy',
  },
  {
    key: 'rigidBronchoscopy',
    href: '/rigid-bronchoscopy',
  },
  {
    key: 'resources',
    href: '/resources',
  },
] as const

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')
  const canViewDrafts = await canCurrentUserViewDraftModules()
  const visibleFeatureHighlights = featureHighlightDefinitions
    .filter((link) => isVisibleModulePath(link.href, { isAdmin: canViewDrafts }))
    .map((item) => ({
      ...item,
      badge: t(`cards.${item.key}.badge`),
      title: t(`cards.${item.key}.title`),
      description: t(`cards.${item.key}.description`),
      cta: t(`cards.${item.key}.cta`),
    }))

  return (
    <HandoffContent>
      {
        <div className="space-y-20 py-12 md:py-16">
          <div className="container">
            <Hero />
          </div>

          <section aria-labelledby="launch-catalog" className="container space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl space-y-3">
                <Badge
                  variant="success"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  {t('launchCatalog')}
                </Badge>
                <h2
                  id="launch-catalog"
                  className="text-3xl font-semibold tracking-tight md:text-4xl"
                >
                  {t('coreModules')}
                </h2>
                <p className="text-base leading-7 text-muted-foreground md:text-lg">
                  {t('coreModulesBody')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:max-w-xl md:justify-end">
                <Button
                  asChild
                  variant="secondary"
                  className="w-fit whitespace-nowrap rounded-full px-6"
                >
                  <Link href={'/pccm-intro-course' as Route}>{t('pccmIntroParticipants')}</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="w-fit whitespace-nowrap rounded-full px-6"
                >
                  <Link href={'/socal-ebus-course' as Route}>{t('socalParticipants')}</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {visibleFeatureHighlights.map((link) => (
                <Link
                  key={link.href}
                  href={link.href as Route}
                  className="group flex h-full flex-col justify-between rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="space-y-3">
                    <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {link.badge}
                    </span>
                    <h3 className="text-lg font-semibold text-foreground">{link.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{link.description}</p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {link.cta}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="course-participants" className="container">
            <div className="grid gap-8 rounded-3xl border border-border/70 bg-muted/30 p-8 md:grid-cols-[1fr_0.9fr] md:p-10">
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  {t('participantCourse')}
                </Badge>
                <h2
                  id="course-participants"
                  className="text-2xl font-semibold tracking-tight md:text-3xl"
                >
                  {t('participantTitle')}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground md:text-base">
                  {t('participantBody')}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 sm:flex-row md:flex-col">
                <Button asChild className="rounded-full px-6">
                  <Link href={'/socal-ebus-course' as Route}>{t('openCoursePortal')}</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6">
                  <Link href={'/ebus-training' as Route}>{t('openEbus')}</Link>
                </Button>
              </div>
            </div>
          </section>

          <section aria-labelledby="upcoming" className="container">
            <div className="grid gap-8 rounded-3xl border border-border/70 bg-primary/10 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-10">
              <div className="space-y-4">
                <Badge
                  variant="info"
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                >
                  {t('roadmap')}
                </Badge>
                <h2
                  id="upcoming"
                  className="text-3xl font-semibold tracking-tight text-primary-foreground md:text-4xl"
                >
                  {t('upcomingModules')}
                </h2>
                <p className="text-base leading-7 text-primary-foreground/80 md:text-lg">
                  {t('upcomingBody')}
                </p>
              </div>
              <div className="flex items-center md:justify-end">
                <Button asChild elevated>
                  <Link href={'/coming-soon' as Route}>{t('viewComingSoon')}</Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
