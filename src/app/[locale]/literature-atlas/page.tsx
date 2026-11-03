import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HandoffContent } from '@/i18n/handoff'

/**
 * The Atlas is a separate service reached through the same-origin relay at
 * `src/app/api/literature-atlas/[[...path]]/route.ts`; its root redirects to its own landing view.
 * No trailing slash: the site strips it with a redirect (`trailingSlash: false`).
 */
const ATLAS_ENTRY = '/api/literature-atlas'

export const metadata: Metadata = {
  title: 'Literature Atlas (tester preview)',
  description:
    'Read-only evidence map of the interventional pulmonology literature with machine-generated structured study briefs.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

export default async function LiteratureAtlasPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

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
                  Tester preview
                </Badge>
                <h1 className={simulatorPage.title}>Literature Atlas</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  About this preview
                </a>
                <Button asChild size="sm">
                  <a href={ATLAS_ENTRY} target="_blank" rel="noreferrer">
                    Open Full Window
                  </a>
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Research preview. Machine-generated structured study briefs; unverified by a physician
              unless explicitly labeled. Check all metrics against the original article via DOI. Not
              clinical guidance.
            </p>
            <div className={simulatorPage.frame}>
              {/* One line taller than the simulator frame's offset: the disclaimer sits above it. */}
              <iframe
                title="Literature Atlas"
                src={ATLAS_ENTRY}
                className="h-[calc(100dvh-var(--site-header-height)-6rem)] min-h-[600px] w-full bg-background"
              />
            </div>
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              A read-only evidence map of the interventional pulmonology literature. Browse indexed
              studies by topic on the map or in a filtered list to view standardized study briefs.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Briefs are machine-generated into a structured factual schema and are explicitly
              labeled when a physician has reviewed them (~35 reviewed to date). Unreviewed machine
              briefs can contain extraction errors or incomplete context—always verify anything you
              rely on against the primary publication. The Atlas does not provide clinical guidance.
            </p>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
