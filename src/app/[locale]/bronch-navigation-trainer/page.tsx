import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { TrainerEmbedShell } from '@/components/bronch-navigation/TrainerEmbedShell'
import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { bronchNavigationTrainerAppPath, buildEmbeddedAppSrc } from '@/lib/embedded-app-locale'

const handoffMetadata: Metadata = {
  title: 'Bronch Navigation Trainer',
  description:
    'Practice CT-to-bronchoscope airway navigation with target nodules, branching choices, virtual bronchoscopy, and airway-aligned CT views.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const trainerHighlights = [
  'Drive a virtual bronchoscope from central airway landmarks toward peripheral targets.',
  'Practice branch-by-branch decision making with labeled A/B/C airway choices.',
  'Correlate axial, coronal, sagittal, and airway-aligned CT views with the live scope position.',
  'Use accepted target paths and a 3D airway map to build navigation intuition before lab day.',
]

interface BronchNavigationTrainerPageProps {
  params: Promise<{ locale: string }>
}

export default async function BronchNavigationTrainerPage({
  params,
}: BronchNavigationTrainerPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const embeddedTrainerAppPath = buildEmbeddedAppSrc(bronchNavigationTrainerAppPath, locale)

  return (
    <HandoffContent>
      {
        <div className={simulatorPage.root}>
          <section className={simulatorPage.stage}>
            <div className={simulatorPage.header}>
              <div className={simulatorPage.identity}>
                <Badge
                  variant="info"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Simulation · Navigation
                </Badge>
                <h1 className={simulatorPage.title}>Bronch Navigation Trainer</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  What&apos;s inside
                </a>
                <Button asChild size="sm">
                  <a href={embeddedTrainerAppPath} target="_blank" rel="noreferrer">
                    Open Dedicated View
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/board-prep/advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy">
                    Pair With Board Review
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/hardware">Hardware Scope Setup</Link>
                </Button>
              </div>
            </div>
            <TrainerEmbedShell locale={locale} />
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
              A browser-based rehearsal space for peripheral bronchoscopy navigation. Follow a
              target from CT planning into the airway, drive to each branch point, and choose the
              route that keeps the scope moving toward the lesion.
            </p>

            <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">What&apos;s inside</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {trainerHighlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
