import Link from 'next/link'
import type { Route } from 'next'

import { Hero } from '@/components/home/hero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { canCurrentUserViewDraftModules } from '@/lib/draft-module-guard'
import { isVisibleModulePath } from '@/lib/draft-modules'

const featureHighlights = [
  {
    badge: 'New · Audio',
    title: 'Journal Club Podcasts',
    description:
      'Listen to article-focused IP journal club discussions in English, Spanish, Mandarin, Arabic, and Korean.',
    href: '/journal-club-podcasts',
    cta: 'Browse Podcasts',
  },
  {
    badge: 'EBUS',
    title: 'EBUS Training',
    description:
      'Open knobology, mediastinal station, and EBUS simulator modules without course-participant lockout.',
    href: '/ebus-training',
    cta: 'Open EBUS Training',
  },
  {
    badge: 'Admin preview',
    title: 'EBUS Simulator + Virtual Bronchoscopy',
    description:
      'Review the synchronized virtual bronchoscopy pane alongside the EBUS simulator before it is production-ready.',
    href: '/ebus-training/virtual-bronchoscopy',
    cta: 'Open Admin Preview',
  },
  {
    badge: 'Staging',
    title: 'TNM-9 Staging',
    description:
      'Standalone lung cancer staging practice with descriptor reference, stage grouping, N map, and cases.',
    href: '/tnm-9-staging',
    cta: 'Open TNM-9',
  },
  {
    badge: '3D Anatomy',
    title: 'Interactive Anatomy Viewer',
    description:
      'Explore airway, mediastinal, pleural, and intervention-focused 3D anatomy with CT planes and segment controls.',
    href: '/learn/anatomy',
    cta: 'Browse Anatomy',
  },
  {
    badge: 'Board Review',
    title: 'IP Board Prep Chapters',
    description:
      'Case-based coverage of malignant, benign, and procedural domains mapped to interventional pulmonology review.',
    href: '/board-prep',
    cta: 'Start Board Prep',
  },
  {
    badge: 'Simulation',
    title: 'FluoroView',
    description:
      'Practice CT-to-fluoroscopy orientation, C-arm angles, airway overlays, and non-diagnostic image controls.',
    href: '/fluoroview',
    cta: 'Launch FluoroView',
  },
  {
    badge: 'Navigation',
    title: 'Bronch Navigation Trainer',
    description:
      'Drive a virtual bronchoscope through branch choices while correlating CT planes, airway views, and targets.',
    href: '/bronch-navigation-trainer',
    cta: 'Start Navigation',
  },
  {
    badge: 'Bronchoscopy',
    title: 'Intro Bronchoscopy',
    description:
      'Foundational tools for scope sizing, airway reach concepts, and instrument compatibility.',
    href: '/intro-bronchoscopy',
    cta: 'Open Intro Module',
  },
  {
    badge: 'Pleural',
    title: 'Pleural Procedures',
    description:
      'Learn pleural disease, ultrasound pattern recognition, fluid analysis, pneumothorax pathways, and drainage systems.',
    href: '/pleural-procedures',
    cta: 'Open Pleural Modules',
  },
  {
    badge: 'Resources',
    title: 'Resource Library',
    description:
      'Browse Creative Commons medical images and clinician-builder learning guides for teaching and development.',
    href: '/resources',
    cta: 'Browse Resources',
  },
] as const

export default async function HomePage() {
  const canViewDrafts = await canCurrentUserViewDraftModules()
  const visibleFeatureHighlights = featureHighlights.filter((link) =>
    isVisibleModulePath(link.href, { isAdmin: canViewDrafts }),
  )

  return (
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
              Launch catalog
            </Badge>
            <h2 id="launch-catalog" className="text-3xl font-semibold tracking-tight md:text-4xl">
              Core learning modules
            </h2>
            <p className="text-base leading-7 text-muted-foreground md:text-lg">
              Start with the modules that are ready for learners now: EBUS training, TNM-9 staging,
              3D anatomy, board review, journal club podcasts, Nav Bronch, FluoroView, and teaching
              resources.
            </p>
          </div>
          <Button asChild variant="secondary" className="w-fit rounded-full px-6">
            <Link href={'/socal-ebus-course' as Route}>SoCal EBUS Course participants</Link>
          </Button>
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
              Participant course
            </Badge>
            <h2
              id="course-participants"
              className="text-2xl font-semibold tracking-tight md:text-3xl"
            >
              Southern California EBUS Course participants
            </h2>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">
              The full course portal remains available for registered participants who need the
              lecture pathway, surveys, tests, progress tracking, and course-specific materials.
              EBUS training assets are also available separately above.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row md:flex-col">
            <Button asChild className="rounded-full px-6">
              <Link href={'/socal-ebus-course' as Route}>Open Course Portal</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href={'/ebus-training' as Route}>Open EBUS Training</Link>
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
              Roadmap
            </Badge>
            <h2
              id="upcoming"
              className="text-3xl font-semibold tracking-tight text-primary-foreground md:text-4xl"
            >
              Upcoming modules
            </h2>
            <p className="text-base leading-7 text-primary-foreground/80 md:text-lg">
              The next public releases focus on intro pleural disease, rigid bronchoscopy
              foundations, and intro bronchoscopy.
            </p>
          </div>
          <div className="flex items-center md:justify-end">
            <Button asChild elevated>
              <Link href={'/coming-soon' as Route}>View Coming Soon</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
