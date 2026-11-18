import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Link } from '@/i18n/navigation'
import { setRequestLocale } from 'next-intl/server'

import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  EVIDENCE_ENTRY,
  VIEWER_SESSION_END_ENDPOINT,
  viewerState,
} from '@/features/literature-atlas-viewer/paths'
import {
  sessionCookie,
  verifySession,
  viewerConfig,
} from '@/features/literature-atlas-viewer/server/access'
import { ViewerGate, ViewerUnavailable } from '@/features/literature-atlas-viewer/ViewerGate'
import { HandoffContent } from '@/i18n/handoff'

/**
 * Literature Atlas draft evidence: a direct-link page under the unlisted `/literature-atlas`
 * prefix, opened with the shared viewer password (no site account). Once open, it frames the
 * Atlas's draft-evidence pages through the same-origin relay, which adds a signed note for a
 * verified viewer to its Atlas requests (`src/app/api/literature-atlas/[[...path]]/route.ts`).
 * Rendered per request: the page depends on this browser's session.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Literature Atlas draft evidence (working-group preview)',
  description: 'Machine-drafted evidence and meta-analyses for a small working group.',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function LiteratureAtlasEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const config = viewerConfig()
  if (!config) return <ViewerUnavailable />
  const store = await cookies()
  const unlocked = verifySession(config, store.get(sessionCookie().name)?.value)
  if (!unlocked)
    return <ViewerGate locale={locale} state={viewerState((await searchParams).viewer)} />

  return (
    <HandoffContent>
      {
        <div className={simulatorPage.root}>
          <section className={simulatorPage.stage}>
            <div className={simulatorPage.header}>
              <div className={simulatorPage.identity}>
                <Badge
                  variant="warning"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300"
                >
                  Machine draft
                </Badge>
                <h1 className={simulatorPage.title}>Draft evidence</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  About this preview
                </a>
                <Button asChild size="sm" variant="outline">
                  <Link href="/literature-atlas">Literature Atlas map</Link>
                </Button>
                <Button asChild size="sm">
                  <a href={EVIDENCE_ENTRY} target="_blank" rel="noreferrer">
                    Open Full Window
                  </a>
                </Button>
                <form method="post" action={VIEWER_SESSION_END_ENDPOINT}>
                  <input type="hidden" name="locale" value={locale} />
                  <Button type="submit" size="sm" variant="ghost">
                    Leave
                  </Button>
                </form>
              </div>
            </div>
            <p className="text-sm text-foreground/90">
              Working-group preview. Machine-drafted analyses; not physician-verified, not accepted
              and not clinical guidance. Studies on hold from public release are shown and marked.
            </p>
            <div className={simulatorPage.frame}>
              <iframe
                title="Literature Atlas draft evidence"
                src={EVIDENCE_ENTRY}
                className="h-[calc(100dvh-var(--site-header-height)-6rem)] min-h-[600px] w-full bg-background"
              />
            </div>
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base leading-7 text-foreground/90 md:text-lg">
              Each clinical question gathers its studies from the Literature Atlas and shows the
              machine-drafted analyses of its reporting plan: direct comparisons, network
              meta-analysis and single-group proportions, with the studies on the Atlas map.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-foreground/90">
              Every number is a machine draft. An independent audit of the research prototype that
              produced them did not accept it; corrections are awaiting re-audit. Physician review
              of these studies has not opened. This page is shared with a small working group by
              password and is not listed on the site.
            </p>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
