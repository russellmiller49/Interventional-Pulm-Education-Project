import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS } from '@/features/preference-cards/excel/external-review-remediation-contract'

export const metadata: Metadata = {
  title: 'Focused external-review remediation',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function ExternalReviewRemediationPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const downloadUrl = `/api/preference-cards/external-review-remediation/export?locale=${encodeURIComponent(
    locale,
  )}`

  const cohorts = [
    ['Product and role rows', EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows],
    [
      'Exact-slot rows (includes drainage)',
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows,
    ],
    [
      'Of which: drainage proposals',
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.focusedDrainageUnitSlotRows,
    ],
  ] as const

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Preference-card catalog governance
        </p>
        <h1 className="text-4xl font-black tracking-tight">Focused external-review remediation</h1>
        <p className="max-w-4xl text-muted-foreground">
          Download the bounded clinician-review workbook for the Olympus 180 lifecycle policy, TBNA
          and guiding-device role splits, targeted role corrections, dressing semantics, ViziShot
          consistency, and a representative drainage-unit proposal subset.
        </p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <aside className="space-y-1 rounded-2xl border border-amber-400/60 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-bold">Recommendation-only review boundary</p>
        <p>
          Exporting or completing this workbook does not apply catalog changes. Reviewer decisions
          start blank, and clinician-review rows remain unapproved until an explicit governed
          decision is returned.
        </p>
        <p>
          Confirm current manufacturer instructions, platform compatibility, local orderability,
          service support, accessory availability, and institutional policy. Do not enter patient
          information.
        </p>
      </aside>

      <section className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">External-review focused workbook</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Stable identifiers are exported as text. Both focused review sheets include filters,
                frozen headers, protected reference columns, and blank reviewer decision/rationale
                cells.
              </p>
            </div>
            <dl className="grid gap-2 sm:grid-cols-3">
              {cohorts.map(([label, count]) => (
                <div key={label} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums">
                    {count.toLocaleString(locale)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid min-w-72 gap-2">
            <Button asChild>
              <a href={downloadUrl}>Download focused workbook</a>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/admin/preference-cards/catalog-qa/slot-options` as Route}>
                Open exact-slot proposal review
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold">Included cohorts</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Six Olympus 180-series installed-base products and ten scope-slot policy rows.</li>
          <li>All 21 original TBNA_NEEDLE and all 34 original GUIDING_DEVICE products.</li>
          <li>Scivita Bracket and Hot Biopsy Forceps targeted role corrections.</li>
          <li>Four dressing/securement slots and two ViziShot exact-slot rows.</li>
          <li>
            Six representative GENERIC_DRAINAGE_UNIT products across all three drainage slots; these
            remain unreviewed, nonselectable proposals.
          </li>
        </ul>
      </section>
    </div>
  )
}
