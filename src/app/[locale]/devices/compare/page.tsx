import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PrintControls } from '@/features/preference-cards/components/PrintControls'
import { ProductStatusBadges } from '@/features/device-intelligence/components/ProductStatus'
import {
  comparisonValue,
  getDeviceComparison,
  type ComparisonCitation,
} from '@/features/device-intelligence/server/reference-workspace.server'
import {
  MAX_COMPARISON_DEVICES,
  parseDeviceIds,
} from '@/features/device-intelligence/domain/saved-devices'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'
import { getTaxonomyLabels } from '@/features/device-intelligence/server/product-taxonomy.server'
import { getSafetyEvidence } from '@/features/device-intelligence/server/safety-evidence.server'
import { safetyEvidenceFreshness } from '@/features/device-intelligence/domain/evidence-freshness'
import styles from '@/features/device-intelligence/components/ReferencePrint.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Device comparison',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function DeviceComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ ids?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.comparison')
  const raw = (await searchParams)?.ids
  const ids = Array.isArray(raw) ? null : parseDeviceIds(raw, MAX_COMPARISON_DEVICES)
  const comparison = getDeviceComparison(ids ?? [])
  const statusLabels = await getProductStatusLabels(locale)
  const taxonomyLabels = getTaxonomyLabels(locale)
  const today = new Date().toISOString().slice(0, 10)
  const citations: ComparisonCitation[] = []
  const citationNumber = (citation: ComparisonCitation) => {
    let index = citations.findIndex((item) => JSON.stringify(item) === JSON.stringify(citation))
    if (index < 0) {
      index = citations.length
      citations.push(citation)
    }
    return index + 1
  }
  const cells = comparison.fields.map((field) => ({
    field,
    values: comparison.devices.map((device) => {
      const value = comparisonValue(device, field)
      return { ...value, references: value.citations.map(citationNumber) }
    }),
  }))
  const cellClass = 'min-w-0 border-t border-border p-4 align-top text-sm [overflow-wrap:anywhere]'

  return (
    <div className={`device-reference-output container space-y-5 py-8 ${styles.output}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          className="inline-flex min-h-11 items-center text-sm underline"
          href={`/${locale}/devices/saved` as Route}
        >
          {t('changeDevices')}
        </Link>
        {comparison.devices.length >= 2 ? <PrintControls /> : null}
      </div>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('prepared', { date: today })}</p>
        <p className="max-w-4xl text-sm leading-6">{t('boundary')}</p>
      </header>
      {!ids ? <p role="alert">{t('invalid')}</p> : null}
      {comparison.unavailableCount > 0 ? (
        <p role="status">{t('unavailable', { count: comparison.unavailableCount })}</p>
      ) : null}
      {comparison.devices.length < 2 ? (
        <p>{t('choose')}</p>
      ) : (
        <>
          {comparison.mixedClasses ? (
            <p className="rounded-xl border border-amber-500/60 p-4 text-sm">{t('mixedClasses')}</p>
          ) : null}
          <p className="text-xs text-muted-foreground print:hidden">{t('scroll')}</p>
          <div
            role="region"
            aria-label={t('tableLabel')}
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table
              className={`w-full table-fixed border-collapse text-left ${comparison.devices.length === 4 ? 'min-w-[1100px]' : comparison.devices.length === 3 ? 'min-w-[900px]' : 'min-w-[700px]'}`}
            >
              <thead>
                <tr>
                  <th scope="col" className="w-40 p-4 text-sm">
                    {t('field')}
                  </th>
                  {comparison.devices.map((device) => (
                    <th
                      scope="col"
                      key={device.product.product_id}
                      className="p-4 align-top [overflow-wrap:anywhere]"
                    >
                      <Link
                        className="text-sm font-semibold underline"
                        href={`/${locale}/devices/${device.product.product_id}` as Route}
                      >
                        {device.product.product_name}
                      </Link>
                      <p className="mt-2 text-xs font-normal text-muted-foreground">
                        {device.product.manufacturerDisplay}
                      </p>
                      <p className="mt-1 font-mono text-xs">
                        {device.product.catalog_number ?? t('missingIdentifier')}
                      </p>
                      <p className="mt-1 text-xs font-normal">{device.product.size_display}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={cellClass}>
                    {t('type')}
                  </th>
                  {comparison.devices.map((device) => (
                    <td key={device.product.product_id} className={cellClass}>
                      {taxonomyLabels.subtypes[device.taxonomy.deviceSubtypeCode]}
                      {device.taxonomy.needsReview ? (
                        <p className="mt-1 text-xs">{t('taxonomyReview')}</p>
                      ) : null}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={cellClass}>
                    {t('safety')}
                  </th>
                  {comparison.devices.map((device) => {
                    const evidence = getSafetyEvidence(device.product.product_id)
                    const freshness = safetyEvidenceFreshness(evidence, today)
                    return (
                      <td key={device.product.product_id} className={cellClass}>
                        <ProductStatusBadges status={device.status} labels={statusLabels} />
                        <p className="mt-2 text-xs font-semibold">
                          {statusLabels.evidence.freshness[freshness]}
                        </p>
                        <p className="mt-1 text-xs">
                          {statusLabels.snapshotLabel}{' '}
                          {device.status.researchSnapshotDate ?? statusLabels.notResearched}
                        </p>
                        {device.status.statusRecommendationGate !== 'clear' ? (
                          <p className="mt-2 text-xs font-semibold">
                            {statusLabels.gateHeading}:{' '}
                            {statusLabels.gate[device.status.statusRecommendationGate]}
                          </p>
                        ) : null}
                        <ul className="mt-2 space-y-2 text-xs">
                          {evidence?.notices.map((notice) => (
                            <li key={notice.recall_number}>
                              {notice.official_record_url ? (
                                <a
                                  href={notice.official_record_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  {notice.recall_number}
                                </a>
                              ) : (
                                notice.recall_number
                              )}
                              {' · '}
                              {statusLabels.evidence.recordedState[notice.recorded_state]}
                            </li>
                          ))}
                        </ul>
                        <Link
                          className="mt-2 inline-block text-xs underline"
                          href={
                            `/${locale}/devices/${device.product.product_id}#device-safety` as Route
                          }
                        >
                          {t('openSafety')}
                        </Link>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <th scope="row" className={cellClass}>
                    {t('summary')}
                  </th>
                  {comparison.devices.map((device) => (
                    <td key={device.product.product_id} className={cellClass}>
                      <p lang="en">{device.publicDescription?.text ?? t('missing')}</p>
                      {device.publicDescription ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t(`origin.${device.publicDescription.origin}`)}
                          {device.profile
                            ? ` · ${t(`descriptionScope.${device.profile.description_scope}`)} · ${device.profile.as_of_date}`
                            : ''}
                        </p>
                      ) : null}
                      <Link
                        className="mt-1 inline-block text-xs underline"
                        href={
                          `/${locale}/devices/${device.product.product_id}${device.profile ? '#d2d-profile-heading' : '#device-sources'}` as Route
                        }
                      >
                        {t('descriptionSources')}
                      </Link>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={cellClass}>
                    {t('configuration')}
                  </th>
                  {comparison.devices.map((device) => {
                    const reviewed =
                      device.profile?.runtime_state === 'reviewed'
                        ? device.profile.exact_configuration_summary
                        : null
                    const text = device.profile ? reviewed?.text : device.product.compatibility_text
                    return (
                      <td key={device.product.product_id} className={cellClass}>
                        <p lang="en">{text ?? t('missing')}</p>
                        {text ? (
                          <>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t(`origin.${reviewed ? 'reviewed' : 'catalog'}`)}
                              {reviewed ? ` · ${t(`scope.${reviewed.evidence_scope}`)}` : ''}
                            </p>
                            <Link
                              className="mt-1 inline-block text-xs underline"
                              href={
                                `/${locale}/devices/${device.product.product_id}${reviewed ? '#d2d-profile-heading' : '#device-sources'}` as Route
                              }
                            >
                              {t('configurationSources')}
                            </Link>
                          </>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
                {cells.map(({ field, values }) => (
                  <tr key={field}>
                    <th scope="row" className={cellClass}>
                      {t(`fields.${field}`)}
                    </th>
                    {values.map((value, index) => (
                      <td key={comparison.devices[index].product.product_id} className={cellClass}>
                        {value.value === null ? (
                          <span className="text-muted-foreground">{t('missing')}</span>
                        ) : (
                          <>
                            <span lang="en" className="font-semibold">
                              {String(value.value)}
                              {value.unit ? ` ${value.unit}` : ''}
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t(`origin.${value.origin}`)}
                              {value.scope ? ` · ${t(`scope.${value.scope}`)}` : ''}
                            </p>
                            {value.origin === 'catalog' ? (
                              <Link
                                className="mt-1 inline-block text-xs underline"
                                href={
                                  `/${locale}/devices/${comparison.devices[index].product.product_id}#device-sources` as Route
                                }
                              >
                                {t('catalogSources')}
                              </Link>
                            ) : null}
                            {value.references.map((reference) => (
                              <a
                                key={reference}
                                href={`#comparison-source-${reference}`}
                                className="mr-2 inline-block text-xs underline"
                              >
                                [{reference}]
                              </a>
                            ))}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-5">{t('sourceNote')}</p>
          <p className="text-xs leading-5">{t('safetyNote')}</p>
          {citations.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('sources')}</h2>
              <ol className="list-inside list-decimal space-y-3 text-xs">
                {citations.map((citation, index) => (
                  <li
                    key={index}
                    id={`comparison-source-${index + 1}`}
                    className="scroll-mt-24 [overflow-wrap:anywhere]"
                  >
                    {citation.url ? (
                      <a
                        className="underline"
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {citation.title}
                      </a>
                    ) : (
                      citation.title
                    )}{' '}
                    · {citation.asOf}
                    <p lang="en" className="mt-1 text-muted-foreground">
                      {citation.locator}
                    </p>
                    {citation.url ? (
                      <p className="mt-1 hidden print:block">{citation.url}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
