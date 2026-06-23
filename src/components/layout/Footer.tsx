import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { canCurrentUserViewDraftModules } from '@/lib/draft-module-guard'
import { isVisibleModulePath } from '@/lib/draft-modules'

type InternalFooterHref =
  | '/'
  | '/board-prep'
  | '/bronch-navigation-trainer'
  | '/ebus-training'
  | '/fluoroview'
  | '/intro-bronchoscopy'
  | '/journal-club-podcasts'
  | '/learn/anatomy'
  | '/pleural-procedures'
  | '/resources'
  | '/resources/creative-commons'
  | '/socal-ebus-course'
  | '/tnm-9-staging'
  | '/coming-soon'
  | '/privacy'
  | '/terms'
  | '/community/code-of-conduct'

type FooterLink =
  | {
      label: string
      href: string
      external: true
      route?: never
    }
  | {
      label: string
      href: string
      external?: false
      route: InternalFooterHref
    }

export async function Footer() {
  const canViewDrafts = await canCurrentUserViewDraftModules()
  const footer = await getTranslations('footer')
  const common = await getTranslations('common')
  const nav = await getTranslations('navigation')
  const columnLinks: Array<{ title: string; links: FooterLink[] }> = [
    {
      title: footer('explore'),
      links: [
        { label: footer('home'), href: '/', route: '/' },
        { label: nav('items.ebusTraining.title'), href: '/ebus-training', route: '/ebus-training' },
        { label: nav('items.tnm9.title'), href: '/tnm-9-staging', route: '/tnm-9-staging' },
        { label: nav('items.anatomy.title'), href: '/learn/anatomy', route: '/learn/anatomy' },
        {
          label: nav('items.resources.title'),
          href: '/resources',
          route: '/resources',
        },
        { label: nav('items.comingSoon.title'), href: '/coming-soon', route: '/coming-soon' },
      ],
    },
    {
      title: footer('learning'),
      links: [
        { label: nav('items.boardPrep.shortTitle'), href: '/board-prep', route: '/board-prep' },
        {
          label: nav('items.podcastLibrary.title'),
          href: '/journal-club-podcasts',
          route: '/journal-club-podcasts',
        },
        { label: nav('items.fluoroview.title'), href: '/fluoroview', route: '/fluoroview' },
        {
          label: nav('items.bronchNavigation.title'),
          href: '/bronch-navigation-trainer',
          route: '/bronch-navigation-trainer',
        },
        {
          label: nav('items.introBronchoscopy.title'),
          href: '/intro-bronchoscopy',
          route: '/intro-bronchoscopy',
        },
        {
          label: nav('items.pleuralProcedures.title'),
          href: '/pleural-procedures',
          route: '/pleural-procedures',
        },
        {
          label: nav('items.socalEbusCourse.title'),
          href: '/socal-ebus-course',
          route: '/socal-ebus-course',
        },
      ],
    },
    {
      title: footer('comingSoon'),
      links: [
        { label: footer('introPleuralDisease'), href: '/coming-soon', route: '/coming-soon' },
        {
          label: footer('rigidBronchoscopyFoundations'),
          href: '/coming-soon',
          route: '/coming-soon',
        },
        {
          label: footer('introToBronchoscopy'),
          href: '/coming-soon',
          route: '/coming-soon',
        },
      ],
    },
  ]

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container space-y-10 py-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm space-y-4">
            <div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                {common('siteName')}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{footer('tagline')}</p>
            <div className="text-xs text-muted-foreground">{footer('motion')}</div>
          </div>
          <div className="grid flex-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {columnLinks.map((column) => (
              <div key={column.title} className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">{column.title}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {column.links
                    .filter(
                      (link) =>
                        link.external || isVisibleModulePath(link.href, { isAdmin: canViewDrafts }),
                    )
                    .map((link) => (
                      <li key={link.label}>
                        {link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            href={link.route as Route}
                            className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-6 text-xs text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{footer('copyright', { year: new Date().getFullYear() })}</p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={'/privacy' as Route}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {footer('privacy')}
              </Link>
              <Link
                href={'/terms' as Route}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {footer('terms')}
              </Link>
              <Link
                href={'/community/code-of-conduct' as Route}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {footer('codeOfConduct')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
